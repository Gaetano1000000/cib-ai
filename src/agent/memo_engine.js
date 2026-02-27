import "dotenv/config";
import fs from "node:fs/promises";
import path from "node:path";
import OpenAI from "openai";
import { extractFactsFromDossier } from "./extract_facts.js";
import { enforceNumericCitations } from "./memo_guardrails.js";

const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const MODEL = process.env.OPENAI_MODEL || "gpt-4o-mini";

async function loadPrompt() {
  const p = path.join(process.cwd(), "src", "prompts", "investment_brief.md");
  return fs.readFile(p, "utf-8");
}

function domainFromUrl(u = "") {
  try {
    return new URL(u).hostname.replace(/^www\./, "");
  } catch {
    return u;
  }
}

function buildSourcesList(dossierJson) {
  const sources = Array.isArray(dossierJson?.sources) ? dossierJson.sources : [];
  if (!sources.length) return "SOURCES (numbered):\nNone\n";

  const lines = ["SOURCES (numbered):"];
  sources.forEach((s, i) => {
    const idx = i + 1;
    const label = domainFromUrl(s?.url || `source_${idx}`);
    const ok = s?.ok === false ? " (blocked/failed)" : "";
    lines.push(`Source ${idx}: ${label}${ok}`);
  });
  return lines.join("\n");
}

function buildFactsBlock(facts) {
  const items = Array.isArray(facts?.items) ? facts.items : [];
  if (!items.length) return "FACTS (use only these; otherwise Unknown):\nNone\n";
  const lines = ["FACTS (use only these; otherwise Unknown):"];
  for (const f of items) {
    const src = f.source === 0 ? "Source 0" : `Source ${f.source}`;
    const note = f.note ? ` — ${f.note}` : "";
    lines.push(`- ${f.key}: ${f.value} (${src})${note}`);
  }
  return lines.join("\n");
}

function sanitizeMemoWithFacts(memo, facts) {
  const items = Array.isArray(facts?.items) ? facts.items : [];
  if (!memo || !items.length) return memo;

  // Build map: value -> source index (first occurrence wins)
  const valueToSource = new Map();
  for (const f of items) {
    const v = String(f.value || "").trim();
    if (!v) continue;
    if (!valueToSource.has(v)) valueToSource.set(v, f.source);
    // also store minor variants for decimals/comma (e.g. 0.20 vs 0,20)
    if (v.includes(",")) valueToSource.set(v.replace(",", "."), f.source);
    if (v.includes(".")) valueToSource.set(v.replace(".", ","), f.source);
  }

  const lines = memo.split("\n");
  const out = lines.map((line) => {
    // If no digits, nothing to do
    if (!/\d/.test(line)) return line;

    // If already cited or explicitly assumption, leave
    if (/\(Source\s+\d+\)/.test(line) || /\(Assumption/.test(line)) return line;

    // Try to find any fact value in this line
    for (const [val, src] of valueToSource.entries()) {
      if (!val) continue;
      if (line.includes(val)) {
        // append only if line doesn't already end with a citation-like token
        return `${line} (Source ${src})`;
      }
    }
    return line;
  });

  return out.join("\n");
}

export async function generateInvestmentBriefFromDossier(dossierPath) {
  const raw = await fs.readFile(dossierPath, "utf-8");
  const dossierJson = JSON.parse(raw);

  const prompt = await loadPrompt();
  const sourcesList = buildSourcesList(dossierJson);

  const facts = extractFactsFromDossier(dossierJson);
  const factsBlock = buildFactsBlock(facts);

  const company = dossierJson?.company || "Company";
  const website = dossierJson?.website || "";
  const dossierText = dossierJson?.dossier_text || "";

  const userPayload = [
  "FACTS_JSON (authoritative, ONLY use these for any numbers/names):",
  JSON.stringify(facts, null, 2),
  "",

    `COMPANY: ${company}`,
    website ? `WEBSITE: ${website}` : "WEBSITE: Unknown",
    "",
    factsBlock,
    "",
    sourcesList,
    "",
    "DOSSIER_TEXT (do not invent beyond FACTS; if not in FACTS write Unknown):",
    dossierText,
  ].join("\n");

  const resp = await client.chat.completions.create({
    model: MODEL,
    temperature: 0.2,
    messages: [
      { role: "system", content: prompt + "\n\nFACTS-ONLY ENFORCEMENT:\n- You may ONLY use quantitative values and specific claims that appear in FACTS_JSON.\n- If a number/metric is not present in FACTS_JSON, write: Unknown (Confidence: Low).\n- Never infer or derive new numbers (no arithmetic, no extrapolation).\n- Every quantitative claim must include (Source X) matching the fact's source.\n" },
      { role: "user", content: userPayload },
    ],
  });

  let memo = resp.choices?.[0]?.message?.content?.trim() || "";
  // Guardrail: never allow (Source 0) to appear in output
  memo = memo.replaceAll('(Source 0)', '').replaceAll('  ', ' ');
  if (!memo) throw new Error("Empty memo returned from model.");

  // Auto-fix: add missing (Source X) when a line contains a FACT value but no citation
  memo = sanitizeMemoWithFacts(memo, facts);

    // Guardrail: never allow numeric lines without (Source ...) or (Assumption ...)
    const g = enforceNumericCitations(memo);
    memo = g.memo;
    if (g.patched) console.warn(`WARN: auto-patched ${g.patched} numeric line(s) with (Assumption, Confidence: Low)`);


    // Guardrail (post-sanitize): strip any (Source 0) reintroduced by sanitizer
    memo = memo.replaceAll('(Source 0)', '').replaceAll('  ', ' ');


  
  // EDGEON_SANITIZE_MEMO: remove filler lines (Unknown/N/A/Not available + "not evidenced"/"diligence required")
  if (typeof memo === "string") {
    memo = memo
      .split("\n")
      .filter(l => !(
        /\bUnknown\b|\bN\/?A\b|Not available/i.test(l) ||
        /not evidenced in the provided sources/i.test(l) ||
        /diligence required\.?\s*$/i.test(l) ||
        /Market framing is not evidenced/i.test(l) ||
        /Competitive positioning details are not evidenced/i.test(l) ||
        /Growth signals are not evidenced/i.test(l) ||
        /Required inputs for modeling are not evidenced/i.test(l) ||
        /Key risks and diligence priorities are not evidenced/i.test(l)
      ))
      .join("\n");
  }

return { memo, company };
}
