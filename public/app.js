const $ = (id) => document.getElementById(id);

const ui = {
  lang: "en",
  t: {
    en: {
      heroTitle: "Investment Brief Generator",
      heroCopy: "Generate an IC-ready memo using only verified facts with explicit source tags — no filler, no invented KPIs.",
      lblCompany: "Company",
      lblCountry: "Country",
      lblWebsite: "Website",
      run: "Run brief",
      demo: "Load demo",
      outTitle: "Memo Output",
      foot: "Output is constrained by your FACTS pipeline. If sources are thin, the memo will focus on diligence questions."
    },
    it: {
      heroTitle: "Generatore Investment Brief",
      heroCopy: "Memo IC-ready basato solo su FACTS con citazioni esplicite — niente filler, niente KPI inventati.",
      lblCompany: "Azienda",
      lblCountry: "Paese",
      lblWebsite: "Sito",
      run: "Esegui brief",
      demo: "Carica demo",
      outTitle: "Output Memo",
      foot: "L’output dipende dalla pipeline FACTS. Se le fonti sono poche, il memo si concentra su domande di due diligence."
    }
  }
};

function setLang(lang){
  ui.lang = lang;
  const tt = ui.t[lang];
  $("heroTitle").textContent = tt.heroTitle;
  $("heroCopy").textContent = tt.heroCopy;
  $("lblCompany").textContent = tt.lblCompany;
  $("lblCountry").textContent = tt.lblCountry;
  $("lblWebsite").textContent = tt.lblWebsite;
  $("runBtn").textContent = tt.run;
  $("fillDemo").textContent = tt.demo;
  $("outTitle").textContent = tt.outTitle;
  $("footNote").textContent = tt.foot;
  $("langToggle").textContent = lang === "en" ? "IT" : "EN";
}

function countCites(memo){
  const m = memo.match(/\(Source\s+\d+\)/g);
  return m ? m.length : 0;
}

function downloadText(filename, text){
  const blob = new Blob([text], {type:"text/markdown;charset=utf-8"});
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  URL.revokeObjectURL(a.href);
  a.remove();
}

async function runBrief(payload){
  $("status").textContent = "Running…";
  $("runBtn").disabled = true;
  $("copyBtn").disabled = true;
  $("dlBtn").disabled = true;

  try{
    const res = await fetch("/api/agent/run", {
      method:"POST",
      headers:{ "Content-Type":"application/json" },
      body: JSON.stringify(payload)
    });

    if(!res.ok){
      const t = await res.text().catch(()=> "");
      throw new Error(`HTTP ${res.status} ${t}`.slice(0, 500));
    }

    const data = await res.json();
    const memo = data.memo || "";
    $("memo").textContent = memo || "No memo returned.";
    const cites = countCites(memo);
    $("pillCites").textContent = `Citations: ${cites}`;

    $("copyBtn").disabled = memo.length === 0;
    $("dlBtn").disabled = memo.length === 0;

    $("status").textContent = `OK • dossier: ${data.dossier_path || "—"}`;
  }catch(e){
    $("status").textContent = `Error: ${e.message}`;
  }finally{
    $("runBtn").disabled = false;
  }
}

$("runForm").addEventListener("submit", (e)=>{
  e.preventDefault();
  const payload = {
    company: $("company").value.trim(),
    website: $("website").value.trim(),
    country: $("country").value.trim()
  };
  runBrief(payload);
});

$("fillDemo").addEventListener("click", ()=>{
  $("company").value = "LVMH";
  $("website").value = "https://www.lvmh.com";
  $("country").value = "fr";
});

$("copyBtn").addEventListener("click", async ()=>{
  const memo = $("memo").textContent || "";
  await navigator.clipboard.writeText(memo);
  $("status").textContent = "Copied to clipboard.";
});

$("dlBtn").addEventListener("click", ()=>{
  const memo = $("memo").textContent || "";
  const name = ($("company").value || "memo").trim().toLowerCase().replace(/\s+/g,"-");
  downloadText(`${name}-investment-brief.md`, memo);
});

$("langToggle").addEventListener("click", ()=>{
  setLang(ui.lang === "en" ? "it" : "en");
});

setLang("en");
