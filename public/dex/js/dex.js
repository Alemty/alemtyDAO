import { initVelodrome } from "./velodrome.js";
import { initInternalAmm } from "./alem-amm.js";

console.log("[DEX] phase: cards (swap + pools + veStake)");

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

  if (mode === "internal") {
    fromSel.innerHTML = `<option value="AURA">AURA</option><option value="ALEM">ALEM</option>`;
    toSel.innerHTML   = `<option value="ALEM">ALEM</option><option value="AURA">AURA</option>`;
    hintFrom.textContent = "Pool interno Aura ↔ ALEM (tokenomics)";
    hintTo.textContent = "Salida (quote interno pronto)";
  } else {
    fromSel.innerHTML = `<option value="ALEM">ALEM</option><option value="ETH">ETH</option>`;
    toSel.innerHTML   = `<option value="ETH">ETH</option><option value="ALEM">ALEM</option>`;
    hintFrom.textContent = "(Base) — ALEM ↔ ETH";
    hintTo.textContent = "Salida (quote base pronto)";
  }

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
    return;
  }
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
   veALEM Stake (Aerodrome-style)
========================= */
const STAKE_OPTIONS = [
  { months: 6,  label: '6 meses',  veMultiplier: 0.25, apr: 8  },
  { months: 12, label: '1 año',    veMultiplier: 0.50, apr: 15 },
  { months: 24, label: '2 años',   veMultiplier: 0.75, apr: 25 },
  { months: 48, label: '4 años',   veMultiplier: 1.00, apr: 40 },
];

// Simular balance on-chain (después se conecta a contrato real)
let simulatedBalance = 10000; // ALEM en wallet
let simulatedLocked = 0;
let simulatedVe = 0;
let simulatedExpiry = null;

function getSelectedOption() {
  const checked = document.querySelector('input[name="veLock"]:checked');
  if (!checked) return STAKE_OPTIONS[3]; // default 4 años
  return STAKE_OPTIONS.find(o => o.months === Number(checked.value)) || STAKE_OPTIONS[3];
}

function updateVeInfo() {
  const opt = getSelectedOption();
  const lockedEl = document.getElementById('veInfoLocked');
  const veEl = document.getElementById('veInfoVe');
  const expiryEl = document.getElementById('veInfoExpiry');
  const aprEl = document.getElementById('veInfoApr');
  const voteEl = document.getElementById('veInfoVote');

  if (lockedEl) lockedEl.textContent = simulatedLocked.toLocaleString();
  if (veEl) veEl.textContent = simulatedVe.toLocaleString();
  if (expiryEl) {
    expiryEl.textContent = simulatedExpiry
      ? new Date(simulatedExpiry).toLocaleDateString('es', { day:'numeric', month:'short', year:'numeric' })
      : '—';
  }
  if (aprEl) aprEl.textContent = simulatedLocked > 0 ? `${opt.apr}%` : '—';
  if (voteEl) {
    const votePower = simulatedLocked > 0 ? (simulatedVe * (simulatedLocked / 10000)).toFixed(1) : '—';
    voteEl.textContent = votePower;
  }

  const balanceEl = document.getElementById('veStakeBalance');
  if (balanceEl) balanceEl.textContent = (simulatedBalance - simulatedLocked).toLocaleString();
}

function initVeStake() {
  // MAX button
  const maxBtn = document.getElementById('veStakeMaxBtn');
  maxBtn?.addEventListener('click', () => {
    const input = document.getElementById('veStakeAmount');
    if (input) input.value = String(Math.max(0, simulatedBalance - simulatedLocked));
  });

  // Radio change -> update info
  document.querySelectorAll('input[name="veLock"]').forEach(r => {
    r.addEventListener('change', updateVeInfo);
  });

  // Lock button
  const lockBtn = document.getElementById('veStakeBtn');
  lockBtn?.addEventListener('click', async () => {
    const statusEl = document.getElementById('veStakeStatus');
    const input = document.getElementById('veStakeAmount');
    const amount = Number(input?.value || 0);
    if (!amount || amount <= 0) {
      if (statusEl) statusEl.textContent = '❌ Ingresa una cantidad';
      return;
    }
    if (amount > simulatedBalance - simulatedLocked) {
      if (statusEl) statusEl.textContent = '❌ Saldo insuficiente';
      return;
    }

    const opt = getSelectedOption();
    const veAmount = Math.floor(amount * opt.veMultiplier);
    const now = new Date();
    const expiry = new Date(now.getFullYear(), now.getMonth() + opt.months, now.getDate());

    if (statusEl) statusEl.textContent = '🔒 Lockeando... (simulado)';

    // Simular delay de transacción
    await new Promise(r => setTimeout(r, 1200));

    simulatedLocked += amount;
    simulatedVe += veAmount;
    simulatedExpiry = expiry.getTime();

    if (statusEl) statusEl.textContent = `✅ Lock exitoso! ${amount} ALEM → ${veAmount} veALEM por ${opt.label}`;
    if (input) input.value = '';

    updateVeInfo();
  });

  updateVeInfo();
}

/* =========================
   Init modules (stubs)
========================= */
initInternalAmm();
initVelodrome();

applyMode("internal");
applyPoolFilters();
initVeStake();
