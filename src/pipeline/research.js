import { serperSearch, serperNews } from "../services/serper.js";
import { firecrawlScrape } from "../services/firecrawl.js";
import { clip, normalizeWhitespace } from "../utils/text.js";
import pLimit from "p-limit";
import { z } from "zod";

const InputSchema = z.object({
  company: z.string().min(2),
  website: z.string().url().optional(),
  country: z.string().min(2).optional(),
});

function uniqUrls(urls) {
  const seen = new Set();
  const out = [];
  for (const u of urls) {
    if (!u) continue;
    const key = u.split("#")[0];
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(key);
  }
  return out;
}

export async function runResearch(input) {
  const { company, website, country } = InputSchema.parse(input);

  const gl = country ? country.toLowerCase() : "us";
  const hl = "en";

  const qBase = website ? `${company} site:${new URL(website).hostname}` : company;
  const qNews = `${company} funding partnership acquisition revenue hiring`;

  const [search, news] = await Promise.all([
    serperSearch(qBase, { gl, hl, num: 10 }),
    serperNews(qNews, { gl, hl, num: 10 }),
  ]);

  const searchUrls = (search?.organic || []).map(r => r?.link).filter(Boolean);
  const newsUrls = (news?.news || []).map(r => r?.link).filter(Boolean);

  const urls = uniqUrls([
    ...(website ? [website] : []),
    ...searchUrls.slice(0, 6),
    ...newsUrls.slice(0, 6),
  ]).slice(0, 10);

  const limit = pLimit(3);

  const scraped = await Promise.all(
    urls.map((u) =>
      limit(async () => {
        try {
          const md = await firecrawlScrape(u);
          const text = normalizeWhitespace(clip(md, 7000));
          return { url: u, ok: true, text };
        } catch (e) {
          return { url: u, ok: false, error: String(e?.message || e) };
        }
      })
    )
  );

  const okDocs = scraped.filter(x => x.ok && x.text);
  const rawText = okDocs
    .map((d, i) => `### SOURCE ${i + 1}\nURL: ${d.url}\n\n${d.text}\n`)
    .join("\n");

  return {
    input: { company, website: website || null, country: country || null },
    urls,
    scraped,
    rawText,
  };
}
