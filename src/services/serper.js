const SERPER_ENDPOINT = "https://google.serper.dev";

function mustEnv(name) {
  const v = process.env[name];
  if (!v) throw new Error(`Missing env var: ${name}`);
  return v;
}

async function post(path, payload) {
  const key = mustEnv("SERPER_API_KEY");
  const res = await fetch(`${SERPER_ENDPOINT}${path}`, {
    method: "POST",
    headers: {
      "X-API-KEY": key,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const t = await res.text().catch(() => "");
    throw new Error(`Serper ${path} failed: ${res.status} ${t}`);
  }
  return res.json();
}

export async function serperSearch(query, { gl = "us", hl = "en", num = 10 } = {}) {
  return post("/search", { q: query, gl, hl, num });
}

export async function serperNews(query, { gl = "us", hl = "en", num = 10 } = {}) {
  return post("/news", { q: query, gl, hl, num });
}
