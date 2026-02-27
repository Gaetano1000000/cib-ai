function mustEnv(name) {
  const v = process.env[name];
  if (!v) throw new Error(`Missing env var: ${name}`);
  return v;
}

export async function firecrawlScrape(url) {
  const key = mustEnv("FIRECRAWL_API_KEY");
  const res = await fetch("https://api.firecrawl.dev/v2/scrape", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${key}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      url,
      formats: ["markdown"],
    }),
  });

  if (!res.ok) {
    const t = await res.text().catch(() => "");
    throw new Error(`Firecrawl scrape failed: ${res.status} ${t}`);
  }

  const json = await res.json();
  const md =
    json?.data?.markdown ??
    json?.data?.content ??
    json?.markdown ??
    "";

  return String(md || "");
}
