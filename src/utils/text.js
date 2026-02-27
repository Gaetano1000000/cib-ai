export function clip(s, max = 6000) {
  const t = String(s || "").replace(/\u0000/g, "");
  return t.length > max ? t.slice(0, max) : t;
}

export function normalizeWhitespace(s) {
  return String(s || "")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}
