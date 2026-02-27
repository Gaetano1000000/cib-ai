import "dotenv/config";

async function serper(query) {
  const r = await fetch("https://google.serper.dev/search", {
    method: "POST",
    headers: {
      "X-API-KEY": process.env.SERPER_API_KEY,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ q: query, num: 3 }),
  });
  if (!r.ok) throw new Error("Serper error " + r.status);
  return r.json();
}

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
  return (j?.data?.markdown || "").slice(0, 1200);
}

const company = process.argv.slice(2).join(" ") || "Satispay";
const search = await serper(`${company} company overview`);

const urls = (search?.organic || []).map(x => x.link).slice(0, 3);
console.log("URLS:", urls);

let dossier = "";
for (let i = 0; i < urls.length; i++) {
  try {
    const md = await firecrawl(urls[i]);
    dossier += `\n\n### SOURCE ${i + 1}\n${urls[i]}\n\n${md}\n`;
  } catch (e) {
    dossier += `\n\n### SOURCE ${i + 1}\n${urls[i]}\n\nERROR: ${e.message}\n`;
  }
}

console.log("\n--- DOSSIER (preview) ---\n");
console.log(dossier);
