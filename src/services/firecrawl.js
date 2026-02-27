/**
 * EDGEON - Firecrawl wrapper with safe fallback
 * Goal: NEVER break the pipeline if Firecrawl is out of credits or missing.
 *
 * Exports:
 *   - firecrawlScrape(url, opts?)
 */

const FIRECRAWL_ENDPOINT =
  process.env.FIRECRAWL_ENDPOINT || "https://api.firecrawl.dev/v1/scrape";

function htmlToText(html) {
  if (!html) return "";
  html = html.replace(/<script[\s\S]*?<\/script>/gi, " ");
  html = html.replace(/<style[\s\S]*?<\/style>/gi, " ");
  let text = html.replace(/<\/?[^>]+>/g, " ");
  text = text
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">");
  return text.replace(/\s+/g, " ").trim();
}

async function fetchFallback(url) {
  const res = await fetch(url, {
    method: "GET",
    headers: {
      "User-Agent":
        "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome Safari",
      Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    },
    redirect: "follow",
  });

  const ct = (res.headers.get("content-type") || "").toLowerCase();
  const body = await res.text();

  const text = ct.includes("html") ? htmlToText(body) : (body || "").trim();

  const MAX = 20000;
  const clipped = text.length > MAX ? text.slice(0, MAX) : text;

  return {
    ok: res.ok,
    status: res.status,
    url,
    markdown: clipped,
    provider: "fallback-fetch",
  };
}

export async function firecrawlScrape(url, opts = {}) {
  const apiKey = process.env.FIRECRAWL_API_KEY;

  // no key => always fallback
  if (!apiKey) {
    return await fetchFallback(url);
  }

  try {
    const payload = { url, formats: ["markdown"] };

    if (opts && typeof opts === "object") {
      if (opts.onlyMainContent === true) payload.onlyMainContent = true;
      if (typeof opts.timeout === "number") payload.timeout = opts.timeout;
    }

    const res = await fetch(FIRECRAWL_ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify(payload),
    });

    const json = await res.json().catch(() => null);

    // any failure => fallback
    if (!res.ok || !json || json.success === false) {
      return await fetchFallback(url);
    }

    const md = json?.data?.markdown || json?.markdown || "";
    return {
      ok: true,
      status: res.status,
      url,
      markdown: (md || "").trim(),
      provider: "firecrawl",
    };
  } catch (e) {
    return await fetchFallback(url);
  }
}
