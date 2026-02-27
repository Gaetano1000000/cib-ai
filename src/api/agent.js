import fs from "node:fs/promises";
import path from "node:path";
import { z } from "zod";
import { runResearch } from "../pipeline/research.js";
import { generateInvestmentBriefFromDossier } from "../agent/memo_engine.js";

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

  // 1) Research (Phase 1 output)
  const research = await runResearch({ company, website, country });

  // 2) Persist dossier (single unified JSON)
  const dossiersDir = path.join(process.cwd(), "dossiers");
  await fs.mkdir(dossiersDir, { recursive: true });

  const slug = slugify(company);
  const dossierPath = path.join(dossiersDir, `${slug}.json`);

  const dossierJson = {
    company,
    website: website || null,
    created_at: new Date().toISOString(),
    sources: (research.scraped || []).map((s) => ({
      url: s.url,
      ok: !!s.ok,
      chars: s.text ? s.text.length : 0,
      error: s.ok ? null : (s.error || null),
    })),
    dossier_text: research.rawText || "",
  };

  await fs.writeFile(dossierPath, JSON.stringify(dossierJson, null, 2), "utf-8");

  // 3) Generate memo (Phase 2 engine)
  const { memo } = await generateInvestmentBriefFromDossier(dossierPath);

  // 4) Persist memo
  const memosDir = path.join(process.cwd(), "memos");
  await fs.mkdir(memosDir, { recursive: true });

  const memoPath = path.join(memosDir, `${slug}_investment-brief.md`);
  await fs.writeFile(memoPath, memo, "utf-8");

  return {
    ok: true,
    company,
    dossierPath,
    memoPath,
    memo,
  };
}
