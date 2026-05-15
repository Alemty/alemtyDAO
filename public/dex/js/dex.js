
import { initVelodrome } from "./velodrome.js";
import { initInternalAmm } from "./alem-amm.js";

console.log("[DEX] phase: cards (swap + pools)");

/* =========================
   Topbar offset (fix overlay)
========================= */
function syncTopbarOffset() {
  const tb = document.getElementById("topbar");
  const h = tb ? tb.offsetHeight : 0;
  const safe = h > 0 ? h : 72;
  document.documentElement.style.setProperty("--app-topbar-h", `${safe}px`);
}

function bootTopbarOffset() {
  syncTopbarOffset();
  [25, 60, 120, 250, 500, 900].forEach((ms) => setTimeout(syncTopbarOffset, ms));
  let tries = 0;
  const tick = () => {
    syncTopbarOffset();
    tries += 1;
    if (tries < 10) requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
}

window.addEventListener("load", bootTopbarOffset);
window.addEventListener("resize", () => requestAnimationFrame(syncTopbarOffset));

/* =========================
   UI: Swap card
========================= */
const $ = (sel, root = document) => root.querySelector(sel);

const modeBtns = [...document.querySelectorAll(".dex-seg-btn")];
const fromSel = $("#swapFrom");
const toSel = $("#swapTo");
const amountIn = $("#swapAmount");
const outEl = $("#swapOut");
const hintFrom = $("#swapFromHint");
const hintTo = $("#swapToHint");
const flipBtn = $("#swapFlip");
const btnQuote = $("#btnQuote");

let mode = "internal"; // internal | external

function applyMode(next) {
  mode = next;
  modeBtns.forEach(b => b.classList.toggle("active", b.dataset.mode === mode));

  // Reglas de tokens por modo (sin contratos aún)
  if (mode === "internal") {
    // Solo Aura <-> Alem
    fromSel.innerHTML = `<option value="AURA">AURA</option><option value="ALEM">ALEM</option>`;
    toSel.innerHTML   = `<option value="ALEM">ALEM</option><option value="AURA">AURA</option>`;
    hintFrom.textContent = "Pool interno Aura ↔ ALEM (tokenomics)";
    hintTo.textContent = "Salida (quote interno pronto)";
  } else {
    // Solo Alem <-> Eth
    fromSel.innerHTML = `<option value="ALEM">ALEM</option><option value="ETH">ETH</option>`;
    toSel.innerHTML   = `<option value="ETH">ETH</option><option value="ALEM">ALEM</option>`;
    hintFrom.textContent = "Velodrome (Base) — ALEM ↔ ETH";
    hintTo.textContent = "Salida (quote velodrome pronto)";
  }

  // default coherente
  fromSel.value = mode === "internal" ? "AURA" : "ALEM";
  toSel.value = mode === "internal" ? "ALEM" : "ETH";
  outEl.value = "—";
}

modeBtns.forEach(btn => {
  btn.addEventListener("click", () => applyMode(btn.dataset.mode));
});

flipBtn?.addEventListener("click", () => {
  const a = fromSel.value;
  fromSel.value = toSel.value;
  toSel.value = a;
  outEl.value = "—";
});

btnQuote?.addEventListener("click", () => {
  const amt = Number(String(amountIn.value || "0").replace(",", "."));
  if (!Number.isFinite(amt) || amt <= 0) {
    outEl.value = "—";
    console.warn("[DEX] amount inválido");
    return;
  }

  // Placeholder: solo muestra “quote” simulada
  // (Luego conectamos: internal amm / velodrome router)
  const fakeRate = mode === "internal" ? 0.001 : 0.00025;
  const out = amt * (fromSel.value === "AURA" ? fakeRate : (1 / fakeRate));
  outEl.value = out.toFixed(6);

  console.log("[DEX][Quote]", { mode, from: fromSel.value, to: toSel.value, amt, out });
});

/* =========================
   UI: Pools card (search + filter)
========================= */
const poolSearch = $("#poolSearch");
const poolFilter = $("#poolFilter");
const poolList = $("#poolList");

function applyPoolFilters() {
  const q = (poolSearch?.value || "").toLowerCase().trim();
  const f = (poolFilter?.value || "all");

  poolList?.querySelectorAll(".dex-pool").forEach(row => {
    const kind = row.getAttribute("data-kind") || "";
    const name = row.getAttribute("data-name") || "";
    const okKind = f === "all" ? true : kind === f;
    const okText = q ? name.includes(q) : true;
    row.style.display = (okKind && okText) ? "" : "none";
  });
}

poolSearch?.addEventListener("input", applyPoolFilters);
poolFilter?.addEventListener("change", applyPoolFilters);

/* =========================
   Init modules (stubs)
========================= */
initInternalAmm();  // Aura/ALEM interno (stub) 【3-d10e92】
initVelodrome();    // Velodrome externo (stub) 【4-4bbd92】

applyMode("internal");
applyPoolFilters();
