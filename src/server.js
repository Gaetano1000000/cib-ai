import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import fs from "node:fs/promises";
import path from "node:path";
import { runResearch } from "./pipeline/research.js";
import { generateInvestmentBriefFromDossier } from "./agent/memo_engine.js";

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json({ limit: "2mb" }));

// Serve Landing Page (Phase 4)
app.use(express.static(path.join(process.cwd(), "public")));


function slugify(s) {
  return (s || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
    .slice(0, 60);
}

app.get("/", (req, res) => res.send("CIB AI server running 🚀"));

app.post("/api/research", async (req, res) => {
  try {
    const out = await runResearch(req.body || {});
    res.json(out);
  } catch (e) {
    res.status(400).json({ error: String(e?.message || e) });
  }
});

app.post("/api/agent/run", async (req, res) => {
  try {
    const { company, website, country } = req.body || {};
    if (!company || typeof company !== "string" || company.trim().length < 2) {
      return res.status(400).json({ error: "Missing/invalid 'company'." });
    }

    const research = await runResearch({ company, website, country });

    const dossiersDir = path.join(process.cwd(), "dossiers");
    await fs.mkdir(dossiersDir, { recursive: true });

    const slug = slugify(company);
    const dossierPath = path.join(dossiersDir, `${slug}.json`);

    const dossierJson = {
      company: company.trim(),
      website: website || null,
      created_at: new Date().toISOString(),
      sources: (research.scraped || []).map((s) => ({
        url: s.url,
        ok: !!s.ok,
        chars: s.text ? String(s.text).length : 0,
        error: s.error || null,
      })),
      dossier_text: research.rawText || "",
    };

    await fs.writeFile(dossierPath, JSON.stringify(dossierJson, null, 2), "utf-8");

    const { memo } = await generateInvestmentBriefFromDossier(dossierPath);

    res.json({
      ok: true,
      company: company.trim(),
      dossier_path: dossierPath,
      memo,
    });
  } catch (e) {
    res.status(400).json({ error: String(e?.message || e) });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, "0.0.0.0", () => console.log(`Server running on port ${PORT}`));
