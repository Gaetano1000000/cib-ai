import fs from "node:fs/promises";
import path from "node:path";
import { generateInvestmentBriefFromDossier } from "./src/agent/memo_engine.js";

function slugify(s) {
  return (s || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
    .slice(0, 60);
}

async function main() {
  const companyName = process.argv[2];
  const dossierPathArg = process.argv[3];

  if (!companyName) {
    console.error('Usage: node run-agent.js "Company Name" [dossiers/<slug>.json]');
    process.exit(1);
  }

  const slug = slugify(companyName);
  const dossierPath = dossierPathArg
    ? String(dossierPathArg)
    : path.join(process.cwd(), "dossiers", `${slug}.json`);

  // Safety: ensure dossierPath is a string
  if (typeof dossierPath !== "string") {
    throw new Error("dossierPath is not a string (bug).");
  }

  // Check dossier exists
  await fs.access(dossierPath);

  const { memo } = await generateInvestmentBriefFromDossier(dossierPath);

  const outDir = path.join(process.cwd(), "memos");
  await fs.mkdir(outDir, { recursive: true });

  const outFile = path.join(outDir, `${slug}_investment-brief.md`);
  await fs.writeFile(outFile, memo, "utf-8");

  console.log("OK: memo scritto in", outFile);
  console.log("----- PREVIEW -----");
  console.log(memo.split("\n").slice(0, 40).join("\n"));
}

main().catch((e) => {
  console.error("ERROR:", e?.message || e);
  process.exit(1);
});
