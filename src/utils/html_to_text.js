function htmlToText(html) {
  if (!html || typeof html !== "string") return "";

  // rimuovi script/style/noscript
  html = html.replace(/<script[\s\S]*?<\/script>/gi, " ");
  html = html.replace(/<style[\s\S]*?<\/style>/gi, " ");
  html = html.replace(/<noscript[\s\S]*?<\/noscript>/gi, " ");

  // elimina tag e lascia testo
  let text = html
    .replace(/<\/(p|div|br|li|h1|h2|h3|h4|h5|tr|td)>/gi, "\n")
    .replace(/<[^>]+>/g, " ");

  // decode minimale HTML entities comuni
  text = text
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">");

  // pulizia whitespace
  text = text.replace(/[ \t\r]+/g, " ");
  text = text.replace(/\n{3,}/g, "\n\n");
  text = text.trim();

  return text;
}

module.exports = { htmlToText };
