const { setTimeout: sleep } = require("timers/promises");

async function fetchTextFromUrl(url, opts = {}) {
  const timeoutMs = opts.timeoutMs ?? 20000;
  const maxBytes = opts.maxBytes ?? 1_500_000; // 1.5MB
  const headers = {
    "user-agent":
      opts.userAgent ??
      "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122 Safari/537.36",
    "accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    "accept-language": "en-US,en;q=0.9,it;q=0.8",
  };

  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);

  try {
    const res = await fetch(url, { method: "GET", headers, redirect: "follow", signal: ctrl.signal });
    const status = res.status;

    // Non proviamo a leggere roba enorme
    const reader = res.body?.getReader?.();
    if (!reader) {
      const body = await res.text().catch(() => "");
      return { ok: res.ok, status, body, url };
    }

    let chunks = [];
    let received = 0;
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      received += value.byteLength;
      if (received > maxBytes) break;
      chunks.push(value);
    }

    const buf = Buffer.concat(chunks.map((u) => Buffer.from(u)));
    const body = buf.toString("utf-8");

    return { ok: res.ok, status, body, url };
  } catch (e) {
    return { ok: false, status: 0, body: "", url, error: String(e?.message || e) };
  } finally {
    clearTimeout(t);
    // piccola pausa “educata” (anti rate-limit)
    await sleep(150);
  }
}

module.exports = { fetchTextFromUrl };
