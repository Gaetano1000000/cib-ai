export function cleanMarkdown(md = "") {
  let t = String(md);

  // Remove images: ![](url)
  t = t.replace(/!\[[^\]]*\]\([^)]+\)/g, "");

  // Remove excessive nav-like lines (very common)
  const lines = t.split("\n").map(l => l.trim());

  const filtered = [];
  for (const line of lines) {
    if (!line) { filtered.push(""); continue; }

    // Drop very short menu items / boilerplate
    if (line.length <= 2) continue;
    if (/^(log in|sign up|privacy|cookies|terms|support|pricing|contact)$/i.test(line)) continue;

    // Drop pure separators
    if (/^[-_*]{3,}$/.test(line)) continue;

    filtered.push(line);
  }

  t = filtered.join("\n");

  // Collapse too many blank lines
  t = t.replace(/\n{3,}/g, "\n\n");

  // Trim
  t = t.trim();

  return t;
}

export function dedupeLines(text = "") {
  const lines = String(text).split("\n");
  const seen = new Set();
  const out = [];
  for (const l of lines) {
    const key = l.trim().toLowerCase();
    if (!key) { out.push(""); continue; }
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(l);
  }
  return out.join("\n").replace(/\n{3,}/g, "\n\n").trim();
}
