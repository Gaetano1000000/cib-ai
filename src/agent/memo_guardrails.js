export function enforceNumericCitations(memo = "") {
  const lines = String(memo).split("\n");
  let patched = 0;

  const out = lines.map((line) => {
    const t = line.trim();

    // ignore headings like "# 1) ..."
    if (t.startsWith("#")) return line;

    // if no digits, ignore
    if (!/\d/.test(line)) return line;

    // already has an acceptable marker
    if (line.includes("(Source") || line.includes("(Assumption") || line.includes("Unknown (Confidence:")) {
      return line;
    }

    patched += 1;
    return line + " (Assumption, Confidence: Low)";
  });

  return { memo: out.join("\n"), patched };
}
