import "dotenv/config";
import { cleanMarkdown, dedupeLines } from "../utils/clean_text.js";

// --- Serper search (Google)
async function serperSearch(query, num = 8) {
  const r = await fetch("https://google.serper.dev/search", {
    method: "POST",
    headers: {
      "X-API-KEY": process.env.SERPER_API_KEY,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ q: query, num }),
  });
  if (!r.ok) throw new Error("Serper error " + r.status);
  return r.json();
}

// --- Serper news
async function serperNews(query, num = 8) {
  const r = await fetch("https://google.serper.dev/news", {
    method: "POST",
    headers: {
      "X-API-KEY": process.env.SERPER_API_KEY,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ q: query, num }),
  });
  if (!r.ok) throw new Error("Serper news error " + r.status);
  return r.json();
}

// --- Firecrawl scrape
async function firecrawl(url) {
  const r = await fetch("https://api.firecrawl.dev/v2/scrape", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${process.env.FIRECRAWL_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ url, formats: ["markdown"] }),
  });
  if (!r.ok) throw new Error("Firecrawl error " + r.status);
  const j = await r.json();
  return String(j?.data?.markdown || "");
}

// --- Utility
function uniq(arr) {
  const out = [];
  const seen = new Set();
  for (const x of arr) {
    const k = String(x || "").trim();
    if (!k) continue;
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(k);
  }
  return out;
}

function safeFilename(name) {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 60) || "company";
}

export async function buildDossier(company, { website = "", maxUrls = 8 } = {}) {
  if (!process.env.SERPER_API_KEY) throw new Error("Missing SERPER_API_KEY");
  if (!process.env.FIRECRAWL_API_KEY) throw new Error("Missing FIRECRAWL_API_KEY");

  const qBase = company;
  const [s, n] = await Promise.all([
    serperSearch(`${qBase} company overview`, maxUrls),
    serperNews(`${qBase} funding OR acquisition OR partnership OR expansion`, Math.min(maxUrls, 6)),
  ]);

  const organicUrls = (s?.organic || []).map(x => x.link);
  const newsUrls = (n?.news || []).map(x => x.link);

  let urls = uniq([website, ...organicUrls, ...newsUrls]).slice(0, maxUrls);

  const sources = [];
  let merged = "";

  for (let i = 0; i < urls.length; i++) {
    const url = urls[i];
    try {
      const raw = await firecrawl(url);
      const cleaned = dedupeLines(cleanMarkdown(raw)).slice(0, 6000);
      sources.push({ url, ok: true, chars: cleaned.length });
      merged += `\n\n### SOURCE ${i + 1}\nURL: ${url}\n\n${cleaned}\n`;
    } catch (e) {
      sources.push({ url, ok: false, error: e.message });
    }
  }

  merged = dedupeLines(cleanMarkdown(merged));

  return {
    company,
    website,
    created_at: new Date().toISOString(),
    sources,
    dossier_text: merged,
  };
}

// --- CLI usage
// node src/pipeline/build_dossier.js "Satispay" "https://www.satispay.com"
if (import.meta.url === `file://${process.argv[1]}`) {
  const company = process.argv[2];
  const website = process.argv[3] || "";
  if (!company) {
    console.log('Usage: node src/pipeline/build_dossier.js "Company Name" "https://website.com"');
    process.exit(1);
  }
  const out = await buildDossier(company, { website, maxUrls: 8 });
  const fname = `dossiers/${safeFilename(company)}.json`;
  await (await import("node:fs/promises")).writeFile(fname, JSON.stringify(out, null, 2), "utf-8");
  console.log("OK: dossier salvato in", fname);
  console.log("Sources:", out.sources);
  console.log("Dossier chars:", out.dossier_text.length);
}
