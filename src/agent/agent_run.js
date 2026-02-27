import fs from "node:fs/promises";
import path from "node:path";
import { z } from "zod";
import { runResearch } from "../pipeline/research.js";
import { generateInvestmentBriefFromDossier } from "./memo_engine.js";

function slugify(s) {
  return (s || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
    .slice(0, 60);
}

const InputSchema = z.object({
  company: z.string().min(2),
  website: z.string().url().optional(),
  country: z.string().min(2).optional(),
});

export async function runAgent(input) {
  const { company, website, country } = InputSchema.parse(input);

  // 1) Research
  const researchOut = await runResearch({ company, website, country });

  // 2) Build dossier JSON (normalized)
  const slug = slugify(company);
  const dossierDir = path.join(process.cwd(), "dossiers");
  await fs.mkdir(dossierDir, { recursive: true });

  const sources = (researchOut.scraped || []).map((x) => ({
    url: x.url,
    ok: Boolean(x.ok),
    chars: x.text ? String(x.text).length : 0,
    ...(x.ok ? {} : { error: x.error || "Unknown error" }),
  }));

  const dossierJson = {
    company,
    website: website || null,
    created_at: new Date().toISOString(),
    sources,
    dossier_text: researchOut.rawText || "",
  };

  const dossierPath = path.join(dossierDir, `${slug}.json`);
  await fs.writeFile(dossierPath, JSON.stringify(dossierJson, null, 2), "utf-8");

  // 3) Memo from dossier
  const { memo } = await generateInvestmentBriefFromDossier(dossierPath);

  // 4) Save memo
  const memosDir = path.join(process.cwd(), "memos");
  await fs.mkdir(memosDir, { recursive: true });

  const memoPath = path.join(memosDir, `${slug}_investment-brief.md`);
  await fs.writeFile(memoPath, memo, "utf-8");

  // 5) Return API payload
  return {
    ok: true,
    company,
    slug,
    dossier_path: dossierPath,
    memo_path: memoPath,
    memo_markdown: memo,
    research_meta: {
      urls: researchOut.urls || [],
      scraped_ok: (sources || []).filter((s) => s.ok).length,
      scraped_total: (sources || []).length,
    },
  };
}
