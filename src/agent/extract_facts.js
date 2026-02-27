function splitBySource(dossierText = "") {
  const parts = [];
  const re = /### SOURCE\s+(\d+)\s*\nURL:\s*(.+?)\n\n([\s\S]*?)(?=\n### SOURCE\s+\d+\s*\nURL:|\s*$)/g;
  let m;
  while ((m = re.exec(dossierText)) !== null) {
    parts.push({
      idx: Number(m[1]),
      url: (m[2] || "").trim(),
      text: (m[3] || "").trim(),
    });
  }
  return parts;
}

function normNum(nStr = "", scale = "") {
  const n = Number(String(nStr).replace(",", "."));
  if (!Number.isFinite(n)) return null;
  const s = String(scale || "").toLowerCase();
  if (["billion", "bn", "b"].includes(s)) return Math.round(n * 1_000_000_000);
  if (["million", "mn", "m"].includes(s)) return Math.round(n * 1_000_000);
  if (["thousand", "k"].includes(s)) return Math.round(n * 1_000);
  return Math.round(n);
}

function pushFact(facts, type, value, sourceIdx, confidence = "High") {
  if (value === null || value === undefined || value === "") return;
  facts.push({ type, value, source: sourceIdx, confidence });
}

function uniqFacts(facts = []) {
  const seen = new Set();
  const out = [];
  for (const f of facts) {
    const key = `${f.type}||${String(f.value)}||${f.source}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(f);
  }
  return out;
}

export function extractFactsFromDossier(dossierJson) {
  const dossierText = dossierJson?.dossier_text || dossierJson?.rawText || "";
  const chunks = splitBySource(dossierText);

  const facts = [];

  for (const c of chunks) {
    const t = c.text || "";

    // users
    {
      const reUsers = /\b(?:over\s+|more\s+than\s+|reported\s+)?(\d+(?:[.,]\d+)?)\s*(million|billion|thousand|mn|m|bn|b|k)?\s+users?\b/gi;
      let m;
      while ((m = reUsers.exec(t)) !== null) {
        const v = normNum(m[1], m[2]);
        if (v) pushFact(facts, "users", v, c.idx, "High");
      }
    }

    // merchants/shops/stores
    {
      const reMerch = /\b(?:over\s+|more\s+than\s+|reported\s+)?(\d+(?:[.,]\d+)?)\s*(million|billion|thousand|mn|m|bn|b|k)?\s+(?:merchants?|shops?|stores?|affiliated\s+shops?|accepting\s+stores?)\b/gi;
      let m;
      while ((m = reMerch.exec(t)) !== null) {
        const v = normNum(m[1], m[2]);
        if (v) pushFact(facts, "merchants", v, c.idx, "High");
      }
    }

    // fee per transaction (€, euros)
    {
      const reFeeEuro1 = /€\s*([0-9]+(?:[.,][0-9]+)?)\s*(?:per|\/)\s*transaction\b/gi;
      const reFeeEuro2 = /\b([0-9]+(?:[.,][0-9]+)?)\s*(?:euros?|eur)\s*(?:per|\/)\s*transaction\b/gi;
      let m;
      while ((m = reFeeEuro1.exec(t)) !== null) {
        const v = Number(String(m[1]).replace(",", "."));
        if (Number.isFinite(v)) pushFact(facts, "fee_eur_per_txn", v, c.idx, "High");
      }
      while ((m = reFeeEuro2.exec(t)) !== null) {
        const v = Number(String(m[1]).replace(",", "."));
        if (Number.isFinite(v)) pushFact(facts, "fee_eur_per_txn", v, c.idx, "High");
      }
    }

    // valuation ($)
    {
      const reVal = /\bvalued\s+at\s*\$?\s*([0-9]+(?:[.,][0-9]+)?)\s*(billion|million|bn|m)\b/gi;
      let m;
      while ((m = reVal.exec(t)) !== null) {
        const v = normNum(m[1], m[2]);
        if (v) pushFact(facts, "valuation_usd", v, c.idx, "High");
      }
    }

    // employees / people
    {
      const reEmp = /\b(?:approximately|about|around)?\s*([0-9]{2,6})\s+(?:employees?|people)\b/gi;
      let m;
      while ((m = reEmp.exec(t)) !== null) {
        const v = normNum(m[1], "");
        if (v) pushFact(facts, "employees", v, c.idx, "High");
      }
    }

    // founded year
    {
      const reFounded = /\bfounded\s+in\s+(19\d{2}|20\d{2})\b/i;
      const m = t.match(reFounded);
      if (m) pushFact(facts, "founded_year", Number(m[1]), c.idx, "High");
    }

    // HQ / headquartered
    {
      const reHQ = /\bheadquartered\s+in\s+([A-Za-z .'-]+?)(?:,|\s)\s*([A-Za-z .'-]+)\b/i;
      const m = t.match(reHQ);
      if (m) pushFact(facts, "hq", `${m[1].trim()}, ${m[2].trim()}`, c.idx, "Medium");
    }
  }

  return uniqFacts(facts);
}
