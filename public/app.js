const form = document.getElementById("form");
const btn = document.getElementById("btn");
const btnText = document.getElementById("btnText");
const btnSpinner = document.getElementById("btnSpinner");
const statusEl = document.getElementById("status");
const memoEl = document.getElementById("memo");
const metaEl = document.getElementById("meta");
const copyBtn = document.getElementById("copy");
const downloadBtn = document.getElementById("download");

let lastMemo = "";
let lastCompany = "memo";

function setLoading(on) {
  btn.disabled = on;
  btnText.textContent = on ? "Generating..." : "Generate";
  btnSpinner.classList.toggle("hidden", !on);
}

function setStatus(msg, kind) {
  statusEl.textContent = msg || "";
  statusEl.classList.remove("ok", "err");
  if (kind) statusEl.classList.add(kind);
}

function renderMemo(md) {
  lastMemo = md || "";
  memoEl.classList.remove("empty");
  memoEl.innerHTML = marked.parse(md || "");
  copyBtn.disabled = !md;
  downloadBtn.disabled = !md;
}

function renderEmpty() {
  memoEl.classList.add("empty");
  memoEl.innerHTML = `
    <div class="empty-state">
      <div class="empty-title">Nessun memo ancora</div>
      <div class="empty-subtitle">Genera un brief per vedere il risultato qui.</div>
    </div>`;
  metaEl.classList.add("hidden");
  copyBtn.disabled = true;
  downloadBtn.disabled = true;
}

function slugify(s) {
  return (s || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
    .slice(0, 60) || "memo";
}

copyBtn.addEventListener("click", async () => {
  try {
    await navigator.clipboard.writeText(lastMemo);
    setStatus("Copied to clipboard.", "ok");
    setTimeout(() => setStatus(""), 1200);
  } catch {
    setStatus("Copy failed (browser permissions).", "err");
  }
});

downloadBtn.addEventListener("click", () => {
  const blob = new Blob([lastMemo], { type: "text/markdown;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${slugify(lastCompany)}_investment-brief.md`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
});

form.addEventListener("submit", async (e) => {
  e.preventDefault();
  setStatus("");
  setLoading(true);

  const company = document.getElementById("company").value.trim();
  const website = document.getElementById("website").value.trim();
  const country = document.getElementById("country").value.trim();

  lastCompany = company;

  try {
    const payload = {
      company,
      website: website || undefined,
      country: country || undefined,
    };

    const res = await fetch("/api/agent/run", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    const data = await res.json().catch(() => ({}));

    if (!res.ok) {
      throw new Error(data?.error || `HTTP ${res.status}`);
    }

    const memo = data?.memo || "";
    if (!memo) throw new Error("Empty memo returned.");

    metaEl.classList.remove("hidden");
    metaEl.textContent = `OK • company=${data.company} • dossier=${data.dossier_path}`;

    renderMemo(memo);
    setStatus("Done.", "ok");
  } catch (err) {
    renderEmpty();
    setStatus(String(err?.message || err), "err");
  } finally {
    setLoading(false);
  }
});

renderEmpty();
