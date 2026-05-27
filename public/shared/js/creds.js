// shared/js/creds.js
// Carruseles de POAPs y Certificaciones (credenciales)
// Solo para uso en el dominio ID (pageIdentity)

import { $, esc } from './core.js';
import { fetchFirstJson } from './api.js';

function shuffle(arr) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = crypto.getRandomValues(new Uint32Array(1))[0] % (i + 1);
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function normAssetPath(path, defaultDir = "/assets/data/") {
  const s = String(path || "").trim();
  if (!s) return "";
  if (/^https?:\/\//i.test(s)) return s;
  if (s.startsWith("/assets/")) return s;
  if (s.startsWith("assets/")) return "/" + s;
  if (s.startsWith("../assets/")) return s.replace("../", "/");
  if (s.startsWith("./assets/")) return s.replace("./", "/");
  if (s.startsWith("../alemty.eth/assets/")) return s.replace("../alemty.eth", "");
  if (!s.includes("/")) return defaultDir + s;
  return s;
}

function repeatToMin(arr, min) {
  const a = Array.isArray(arr) ? arr.slice() : [];
  if (a.length === 0) return [];
  while (a.length < min) a.push(...a);
  return a.slice(0, min);
}

function pauseOnHold(row) {
  if (!row) return;
  const pause = () => row.classList.add("is-paused");
  const play = () => row.classList.remove("is-paused");
  row.addEventListener("mouseenter", pause);
  row.addEventListener("mouseleave", play);
  row.addEventListener("pointerdown", pause);
  row.addEventListener("pointerup", play);
  row.addEventListener("pointercancel", play);
  row.addEventListener("touchstart", pause, { passive: true });
  row.addEventListener("touchend", play, { passive: true });
}

/**
 * Monta los carruseles POAP y certificaciones dentro del contenedor dado
 * @param {HTMLElement} root - Elemento contenedor (ej: modal completo)
 */
export async function mountCreds(root = document) {
  const scope = root?.querySelector ? root : document;

  const poapEl   = scope.querySelector("#poapStrip");
  const tabsEl   = scope.querySelector("#certTabs");
  const stripEl  = scope.querySelector("#certStrip");
  const detailEl = scope.querySelector("#certDetail");

  if (!poapEl || !tabsEl || !stripEl || !detailEl) return;

  const poapUrls = ["/assets/poap/poaps.v3.json", "assets/poap/poaps.v3.json"];
  const certUrls = ["/assets/data/certifications.json", "assets/data/certifications.json"];

  // --- POAPs ---
  const poaps = await fetchFirstJson(poapUrls);
  if (poaps && Array.isArray(poaps) && poaps.length) {
    const base = poaps.map(p => {
      const title = esc(p.title ?? "POAP");
      const href = (p.hasUrl && p.url) ? p.url : "#";
      const dis = href === "#" ? ` aria-disabled="true" tabindex="-1"` : "";
      const img = esc(p.img ?? "");
      return `<a class="poap" href="${esc(href)}" target="_blank" rel="noopener noreferrer"${dis}><img src="${img}" alt="${title}" loading="lazy"><span class="label">${title}</span></a>`;
    });

    const baseShuffled = shuffle(base);
    const filled = repeatToMin(baseShuffled, Math.max(12, baseShuffled.length * 3)).join("");

    poapEl.innerHTML = `<div class="poap-row" id="poapRow"><div class="poap-marquee"><div class="poap-track">${filled}</div><div class="poap-track" aria-hidden="true">${filled}</div></div></div>`;

    const poapRow = poapEl.querySelector("#poapRow");
    if (poapRow) { poapRow.style.setProperty("--poap-duration", "36s"); pauseOnHold(poapRow); }
  } else {
    poapEl.innerHTML = `<div class="small muted">POAPs no disponibles.</div>`;
  }

  // --- Certificaciones ---
  const certs = await fetchFirstJson(certUrls);
  if (!certs || !Array.isArray(certs) || !certs.length) {
    tabsEl.innerHTML = "";
    stripEl.innerHTML = `<div class="small muted">Certificaciones no disponibles.</div>`;
    detailEl.innerHTML = `<div class="t">Sin datos</div><div class="m small muted">No se pudieron cargar certificaciones.</div>`;
    return;
  }

  const groups = {};
  for (const c of certs) {
    const cat = c.category ?? "Otros";
    (groups[cat] = groups[cat] ?? []).push(c);
  }

  const preferred = ["IA", "TI", "Cloud", "Web 3.0", "Design", "Marketing", "Games", "Jobs", "Education", "Otros"];
  let cats = Object.keys(groups).sort((a, b) => {
    const ia = preferred.indexOf(a), ib = preferred.indexOf(b);
    if (ia !== -1 || ib !== -1) return (ia === -1 ? 999 : ia) - (ib === -1 ? 999 : ib);
    return a.localeCompare(b, "es");
  });

  const readyByCat = {};
  for (const cat of cats) {
    readyByCat[cat] = groups[cat]
      .slice()
      .sort((x, y) => (y.score ?? 0) - (x.score ?? 0))
      .map(x => ({ ...x, _badge: normAssetPath(x.badgeImg) }))
      .filter(x => typeof x._badge === "string" && x._badge.trim().length > 0);
  }
  cats = cats.filter(cat => readyByCat[cat].length > 0);

  if (!cats.length) {
    tabsEl.innerHTML = "";
    stripEl.innerHTML = `<div class="small muted">Aún no hay medallas con imagen.</div>`;
    detailEl.innerHTML = `<div class="t">Acreditaciones</div><div class="m small muted">Sube PNGs y agrega badgeImg en el JSON.</div>`;
    return;
  }

  // Tabs
  tabsEl.innerHTML = cats.map((cat, i) =>
    `<button class="cert-tab ${i === 0 ? "active" : ""}" type="button" data-cat="${esc(cat)}">${esc(cat)} <span class="n">${readyByCat[cat].length}</span></button>`
  ).join("");

  // Strips por categoría
  stripEl.innerHTML = cats.map((cat, i) => {
    const ready = readyByCat[cat];
    const base = ready.map((c, realIdx) => {
      const title = esc(c.title ?? "Acreditación");
      const href = c.url ?? "#";
      const dis = href === "#" ? ` aria-disabled="true" tabindex="-1"` : "";
      const img = `<img src="${esc(c._badge)}" alt="${title}" loading="lazy">`;
      return { html: `<a class="cert-badge" href="${esc(href)}" target="_blank" rel="noopener noreferrer"${dis} data-cat="${esc(cat)}" data-idx="${realIdx}">${img}<span class="label">${title}</span></a>` };
    });

    const REPEAT = 4, MIN_ITEMS = 12;
    let expanded = [];
    if (base.length) {
      while (expanded.length < Math.max(MIN_ITEMS, base.length * REPEAT)) expanded = expanded.concat(base);
      expanded = expanded.slice(0, Math.max(MIN_ITEMS, base.length * REPEAT));
    }
    const tiles = expanded.map(x => x.html).join("");

    return `<div class="cert-row ${i === 0 ? "active" : ""}" data-cat="${esc(cat)}"><div class="cert-marquee"><div class="cert-track">${tiles}</div><div class="cert-track" aria-hidden="true">${tiles}</div></div></div>`;
  }).join("");

  stripEl.querySelectorAll(".cert-row").forEach(row => {
    row.style.setProperty("--cert-duration", "40s");
    pauseOnHold(row);
  });

  stripEl.querySelectorAll(".cert-badge img").forEach(img => {
    img.addEventListener("error", () => { const a = img.closest(".cert-badge"); if (a) a.remove(); }, { once: true });
  });

  detailEl.innerHTML = `<div class="t">${esc(cats[0])}</div><div class="m small muted">Selecciona una medalla para ver detalles.</div>`;

  // Tabs click
  tabsEl.querySelectorAll(".cert-tab").forEach(btn => {
    btn.addEventListener("click", () => {
      tabsEl.querySelectorAll(".cert-tab").forEach(x => x.classList.remove("active"));
      btn.classList.add("active");
      const cat = btn.getAttribute("data-cat");
      stripEl.querySelectorAll(".cert-row").forEach(r => r.classList.toggle("active", r.getAttribute("data-cat") === cat));
      detailEl.innerHTML = `<div class="t">${esc(cat)}</div><div class="m small muted">Selecciona una medalla para ver detalles.</div>`;
    });
  });

  // Badge click
  stripEl.querySelectorAll(".cert-badge").forEach(a => {
    a.addEventListener("click", (e) => {
      e.preventDefault();
      const cat = a.getAttribute("data-cat");
      const idx = Number(a.getAttribute("data-idx") ?? "0");
      const ready = readyByCat[cat] ?? [];
      const c = ready[idx];
      if (!c) return;

      const title = esc(c.title ?? "Acreditación");
      const issuer = esc(c.issuer ?? "");
      const year = c.year ? ` · ${esc(c.year)}` : "";
      const category = esc(c.category ?? cat ?? "Otros");
      const url = c.url ?? "#";

      detailEl.innerHTML = `<div class="t">${title}</div><div class="m small muted">${issuer}${year} · ${category}</div><div class="actions"><a class="cert-cta" href="${esc(url)}" target="_blank" rel="noopener noreferrer">Ver certificado</a></div>`;
    });
  });
}
