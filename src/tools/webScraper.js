const firecrawl = require("../services/firecrawl");
const { fetchTextFromUrl } = require("../services/fetch_http");
const { htmlToText } = require("../utils/html_to_text");

// API compatibile: alcuni file potrebbero chiamare "scrape" o "webScraper.scrape"
async function scrape(url, opts = {}) {
  // 1) Prova Firecrawl (se configurato e con crediti)
  try {
    if (process.env.FIRECRAWL_API_KEY) {
      const r = await firecrawl.scrape(url);
      if (r?.content && String(r.content).trim().length > 200) {
        return {
          ok: true,
          url,
          method: "firecrawl",
          status: 200,
          text: String(r.content).trim(),
        };
      }
    }
  } catch (e) {
    const code = e?.code || "";
    const msg = String(e?.message || e || "");
    // Se è "no credits" → fallback silenzioso
    if (code !== "FIRECRAWL_NO_CREDITS") {
      // altri errori li logghiamo ma continuiamo
      console.warn("WARN webScraper: Firecrawl failed, falling back:", code, msg.slice(0, 200));
    }
  }

  // 2) Fallback gratuito: fetch HTML + pulizia
  const http = await fetchTextFromUrl(url, {
    timeoutMs: opts.timeoutMs ?? 20000,
    maxBytes: opts.maxBytes ?? 1_500_000,
  });

  if (!http.ok || !http.body) {
    return {
      ok: false,
      url,
      method: "http",
      status: http.status || 0,
      text: "",
      error: http.error || `HTTP fetch failed (${http.status || 0})`,
    };
  }

  const cleaned = htmlToText(http.body);
  const text = cleaned.length > 0 ? cleaned : "";

  return {
    ok: text.length > 0,
    url,
    method: "http",
    status: http.status || 200,
    text,
    error: text.length > 0 ? undefined : "Empty text after HTML cleaning",
  };
}

module.exports = { scrape, scrapeUrl: scrape };
