/* Lás: efnið er dulkóðað í efni.bin og opnast bara með réttu svari.
   Á eigin tölvu (þar sem leynt/efni.js er til) opnast það beint án lykilorðs. */
(() => {
  "use strict";
  const MINNI = "dagatal-svar";
  const nf = (s) => s.normalize("NFC").trim().toLowerCase().replace(/\s+/g, " ");
  const b64 = (s) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));
  const main = document.querySelector("main");

  // Skiptir "myndir/..." slóðum út hvar sem þær eru í efninu.
  const skiptaUt = (v, kort) => typeof v === "string" ? (kort(v) ?? v)
    : Array.isArray(v) ? v.map((x) => skiptaUt(x, kort))
    : v && typeof v === "object" ? Object.fromEntries(Object.entries(v).map(([k, x]) => [k, skiptaUt(x, kort)])) : v;

  const raesa = (efni) => { main.hidden = false; document.getElementById("las")?.remove(); window.raesaDagatal(efni); };

  const stadbundid = () => new Promise((r) => {
    if (location.protocol === "https:" && !/^(localhost|127\.)/.test(location.hostname)) return r(null);
    const s = document.createElement("script");
    s.src = "leynt/efni.js?v=" + Date.now();
    s.onload = () => r(window.DAGATAL_EFNI || null);
    s.onerror = () => r(null);
    document.head.append(s);
  });

  async function lesaSkra() {
    const buf = new Uint8Array(await (await fetch("efni.bin", { cache: "no-cache" })).arrayBuffer());
    const len = new DataView(buf.buffer).getUint32(0, true);
    return { haus: JSON.parse(new TextDecoder().decode(buf.subarray(4, 4 + len))), dulmal: buf.subarray(4 + len) };
  }

  async function opna(svar, { haus, dulmal }) {
    const grunnur = await crypto.subtle.importKey("raw", new TextEncoder().encode(nf(svar)), "PBKDF2", false, ["deriveKey"]);
    const lykill = await crypto.subtle.deriveKey({ name: "PBKDF2", salt: b64(haus.salt), iterations: haus.it, hash: "SHA-256" },
      grunnur, { name: "AES-GCM", length: 256 }, false, ["decrypt"]);
    const texti = new TextDecoder().decode(await crypto.subtle.decrypt({ name: "AES-GCM", iv: b64(haus.iv) }, lykill, dulmal));
    const { efni, myndir } = JSON.parse(texti);
    const slodir = {};
    for (const [slod, [tegund, gogn]] of Object.entries(myndir)) slodir[slod] = URL.createObjectURL(new Blob([b64(gogn)], { type: tegund }));
    return skiptaUt(efni, (s) => slodir[s]);
  }

  function lasSkjar(skra) {
    const box = document.createElement("div");
    box.id = "las";
    box.innerHTML = `<form class="las-kort" autocomplete="off">
      <div class="las-takn" aria-hidden="true"><svg viewBox="0 0 48 48" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="21" width="30" height="21" rx="4"/><path d="M15 21v-6a9 9 0 0 1 18 0v6"/><path d="M24 29v5"/></svg></div>
      <h1>Jóladagatal</h1>
      <p class="las-texti">Þetta dagatal er bara fyrir eina manneskju.</p>
      <label for="las-svar"></label>
      <input id="las-svar" type="text" autocapitalize="off" spellcheck="false" required>
      <button class="takki" type="submit">Opna</button>
      <p class="las-villa" role="alert"></p>
    </form>`;
    box.querySelector("label").textContent = skra.haus.spurning;
    const form = box.querySelector("form"), inntak = box.querySelector("input"), villa = box.querySelector(".las-villa"), takki = box.querySelector("button");
    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      takki.disabled = true; takki.textContent = "Augnablik…"; villa.textContent = "";
      try {
        const efni = await opna(inntak.value, skra);
        try { localStorage.setItem(MINNI, nf(inntak.value)); } catch (_) {}
        box.classList.add("opnast");
        setTimeout(() => raesa(efni), 450);
      } catch (_) {
        villa.textContent = "Ekki alveg. Reyndu aftur.";
        form.classList.remove("hrista"); void form.offsetWidth; form.classList.add("hrista");
        takki.disabled = false; takki.textContent = "Opna"; inntak.select();
      }
    });
    document.body.append(box);
    inntak.focus();
  }

  (async () => {
    main.hidden = true;
    const heima = await stadbundid();
    // Á eigin tölvu: alltaf nýjasta útgáfa myndanna (ekki gamlar úr skyndiminni vafrans).
    const ny = Date.now();
    if (heima) return raesa(skiptaUt(heima, (s) => s.startsWith("myndir/") ? "leynt/" + s + "?v=" + ny : null));
    let skra;
    try { skra = await lesaSkra(); } catch (_) { document.body.append(Object.assign(document.createElement("p"), { className: "las-villa", textContent: "Dagatalið fannst ekki." })); return; }
    let munad = null;
    try { munad = localStorage.getItem(MINNI); } catch (_) {}
    if (munad) {
      try { return raesa(await opna(munad, skra)); } catch (_) { try { localStorage.removeItem(MINNI); } catch (_) {} }
    }
    lasSkjar(skra);
  })();
})();
