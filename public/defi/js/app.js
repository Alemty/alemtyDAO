import { mountShell } from "/shared/js/shell.js";
mountShell();

/* =====================================================
  DEFI — Pure Trading Terminal
===================================================== */
const $ = id => document.getElementById(id);

/* =====================================================
  Colour palette — friendly, no yellow/orange
===================================================== */
const PALETTE = {
  'ALEM/ETH':  { color: '#3b82f6', up: '#3b82f6', down: '#ef4444' },  // blue
  'AURA/ALEM': { color: '#22c55e', up: '#22c55e', down: '#ef4444' },  // green (stable)
  'ALEM/USD':  { color: '#6366f1', up: '#6366f1', down: '#ef4444' },  // indigo
  'veALEM/ETH':{ color: '#a855f7', up: '#a855f7', down: '#ef4444' },  // purple
  'ETH/USD':   { color: '#ec4899', up: '#ec4899', down: '#ef4444' },  // pink
};

/* =====================================================
  ETH/USD — real price from CoinGecko
===================================================== */
async function fetchEthUsd() {
  try {
    const r = await fetch('https://api.coingecko.com/api/v3/simple/price?ids=ethereum&vs_currencies=usd');
    const d = await r.json();
    return d?.ethereum?.usd ?? null;
  } catch {
    return null;
  }
}

/* =====================================================
  Data generators per pair
===================================================== */
function generateSeries(pairKey) {
  const now = Date.now();
  if (pairKey === 'ETH/USD') return generateETHSeries();
  if (pairKey === 'AURA/ALEM') {
    return Array.from({length: 120}, () => 0.001 + (Math.random()-0.5)*0.00001);
  }
  if (pairKey === 'ALEM/ETH') {
    const base = 0.0138, vol = 0.00035;
    return Array.from({length: 120}, (_, i) =>
      base + Math.sin(i/24)*0.0005 + (Math.random()-0.5)*vol + (Math.random()<0.03?(Math.random()-0.5)*0.0008:0) - 0.000001*i
    );
  }
  if (pairKey === 'veALEM/ETH') {
    const base = 0.007, vol = 0.0002;
    return Array.from({length: 120}, (_, i) =>
      base + Math.sin(i/20)*0.0003 + (Math.random()-0.5)*vol + (Math.random()<0.02?(Math.random()-0.5)*0.0004:0)
    );
  }
  if (pairKey === 'ALEM/USD') {
    const base = 13.8, vol = 0.35;
    return Array.from({length: 120}, (_, i) =>
      base + Math.cos(i/24)*0.5 + (Math.random()-0.5)*vol + (Math.random()<0.03?(Math.random()-0.5)*0.8:0) - 0.002*i
    );
  }
  return [];
}

// ETH/USD — real-time with historical buffer
let ethHistory = [];
const HIST_LEN = 120;

function generateETHSeries() {
  // If we have enough history, add latest real price; else fill with mock
  const realPrice = window._lastEthPrice || 2870;
  ethHistory.push(realPrice);
  if (ethHistory.length > HIST_LEN) ethHistory = ethHistory.slice(-HIST_LEN);
  if (ethHistory.length < HIST_LEN) {
    const fill = HIST_LEN - ethHistory.length;
    for (let i = 0; i < fill; i++) {
      const v = realPrice + (Math.random()-0.5)*60 + Math.sin(i/8)*30;
      ethHistory.unshift(v);
    }
  }
  return [...ethHistory];
}

/* =====================================================
  Chart rendering
===================================================== */
let currentPair = 'ALEM/ETH';

function drawTradingChart(pairKey) {
  const canvas = $('tradingChart');
  if (!canvas) return;
  const pair = PALETTE[pairKey];
  if (!pair) return;

  const series = generateSeries(pairKey);
  const ctx = canvas.getContext('2d');
  const W = canvas.width, H = canvas.height;
  ctx.clearRect(0, 0, W, H);

  const padL = 10, padR = 10, padT = 20, padB = 14;
  const plotW = W - padL - padR, plotH = H - padT - padB;
  const minY = Math.min(...series), maxY = Math.max(...series);
  const range = Math.max(1e-9, maxY - minY);

  // Grid
  ctx.strokeStyle = 'rgba(255,255,255,.06)'; ctx.lineWidth = 1;
  for (let i = 0; i <= 4; i++) {
    const y = padT + (plotH * i / 4);
    ctx.beginPath(); ctx.moveTo(padL, y); ctx.lineTo(padL + plotW, y); ctx.stroke();
  }

  // Gradient fill
  const grad = ctx.createLinearGradient(0, padT, 0, padT + plotH);
  grad.addColorStop(0, pair.color + '55');
  grad.addColorStop(0.4, pair.color + '22');
  grad.addColorStop(1, pair.color + '02');
  ctx.beginPath();
  series.forEach((v, i) => {
    const x = padL + plotW * (i / (series.length - 1));
    const y = padT + plotH * (1 - (v - minY) / range);
    if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
  });
  ctx.lineTo(padL + plotW, padT + plotH);
  ctx.lineTo(padL, padT + plotH);
  ctx.closePath();
  ctx.fillStyle = grad;
  ctx.fill();

  // Line
  const lineGrad = ctx.createLinearGradient(0, padT, W, padT);
  lineGrad.addColorStop(0, pair.color);
  lineGrad.addColorStop(1, pair.color + 'ee');
  ctx.strokeStyle = lineGrad;
  ctx.lineWidth = 2.8;
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  ctx.beginPath();
  series.forEach((v, i) => {
    const x = padL + plotW * (i / (series.length - 1));
    const y = padT + plotH * (1 - (v - minY) / range);
    if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
  });
  ctx.stroke();

  // Y-axis labels
  ctx.fillStyle = 'rgba(255,255,255,.45)';
  ctx.font = '700 10px Inter, system-ui, sans-serif';
  for (let i = 0; i <= 4; i++) {
    const y = padT + (plotH * i / 4);
    const val = maxY - (range * i / 4);
    let label;
    if (pairKey === 'AURA/ALEM') label = val.toFixed(5);
    else if (val < 0.01) label = val.toFixed(5);
    else if (val < 1) label = val.toFixed(4);
    else if (val < 100) label = val.toFixed(2);
    else label = val.toFixed(1);
    ctx.fillText(label, padL + plotW - ctx.measureText(label).width - 4, y + 4);
  }

  // Overlay
  const lastPrice = series[series.length - 1];
  const firstPrice = series[0];
  const changePct = ((lastPrice - firstPrice) / firstPrice * 100);
  const isUp = changePct >= 0;

  let fmt;
  if (pairKey === 'AURA/ALEM') fmt = v => v.toFixed(5);
  else if (lastPrice < 0.01) fmt = v => v.toFixed(5);
  else if (lastPrice < 1) fmt = v => '$' + v.toFixed(4);
  else if (lastPrice < 100) fmt = v => '$' + v.toFixed(2);
  else fmt = v => '$' + v.toFixed(2);

  const priceEl = $('tradingPrice');
  const changeEl = $('tradingChange');
  if (priceEl) {
    priceEl.textContent = fmt(lastPrice);
    priceEl.className = 'trading-price' + (isUp ? ' up' : ' down');
  }
  if (changeEl) {
    changeEl.textContent = (isUp ? '+' : '') + changePct.toFixed(2) + '%';
    changeEl.className = 'trading-change' + (isUp ? ' up' : ' down');
  }

  // Stats
  const high = Math.max(...series);
  const low = Math.min(...series);
  let highFmt, lowFmt;
  if (pairKey === 'AURA/ALEM') { highFmt = high.toFixed(5); lowFmt = low.toFixed(5); }
  else if (high < 1) { highFmt = '$' + high.toFixed(4); lowFmt = '$' + low.toFixed(4); }
  else if (high < 100) { highFmt = '$' + high.toFixed(2); lowFmt = '$' + low.toFixed(2); }
  else { highFmt = '$' + high.toFixed(1); lowFmt = '$' + low.toFixed(1); }

  const hiEl = $('tsHigh');
  const loEl = $('tsLow');
  const volEl = $('tsVol');
  const mcEl = $('tsMc');
  if (hiEl) hiEl.textContent = highFmt;
  if (loEl) loEl.textContent = lowFmt;
  if (volEl) volEl.textContent = pairKey === 'AURA/ALEM' ? 'Estable' : '—';
  if (mcEl) mcEl.textContent = '—';
}

/* =====================================================
  ETH/USD real-time polling
===================================================== */
async function updateEthPrice() {
  const price = await fetchEthUsd();
  if (price) {
    window._lastEthPrice = price;
    if (currentPair === 'ETH/USD') drawTradingChart('ETH/USD');
  }
}

function bindTradingTabs() {
  document.querySelectorAll('.trading-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('.trading-tab').forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      currentPair = tab.getAttribute('data-pair');
      drawTradingChart(currentPair);
    });
  });
}

/* =====================================================
  Mini Trade (swap)
===================================================== */
function initMiniTrade() {
  const fromSel = $('tradeFrom');
  const toSel = $('tradeTo');
  const inEl = $('tradeAmount');
  const outEl = $('tradeOut');
  const btn = $('tradeBtn');
  const statusEl = $('tradeStatus');
  const flipBtn = $('tradeFlip');

  if (!fromSel || !toSel) return;

  // Rates (simulated)
  const RATES = {
    'AURA': { 'ALEM': 0.001, 'ETH': 0.00000035, 'USDC': 0.000012 },
    'ALEM': { 'AURA': 1000, 'ETH': 0.00035, 'USDC': 13.84 },
    'ETH':  { 'AURA': 2857143, 'ALEM': 2857, 'USDC': 2874 },
    'USDC': { 'AURA': 83333, 'ALEM': 0.072, 'ETH': 0.000348 },
  };

  function quote() {
    const from = fromSel.value;
    const to = toSel.value;
    const amt = Number(String(inEl.value || '0').replace(',', '.'));
    if (!Number.isFinite(amt) || amt <= 0 || from === to) {
      outEl.value = '—';
      return;
    }
    const rate = RATES[from]?.[to];
    if (rate) {
      outEl.value = (amt * rate).toFixed(6);
    } else {
      outEl.value = '—';
    }
  }

  inEl?.addEventListener('input', quote);
  fromSel?.addEventListener('change', quote);
  toSel?.addEventListener('change', quote);
  flipBtn?.addEventListener('click', () => {
    const a = fromSel.value;
    fromSel.value = toSel.value;
    toSel.value = a;
    quote();
  });

  btn?.addEventListener('click', async () => {
    if (!statusEl) return;
    const from = fromSel.value;
    const to = toSel.value;
    const amt = Number(String(inEl.value || '0').replace(',', '.'));
    if (!Number.isFinite(amt) || amt <= 0 || from === to) {
      statusEl.textContent = '❌ Selecciona tokens diferentes';
      return;
    }
    statusEl.textContent = '⏳ Ejecutando swap... (simulado)';
    await new Promise(r => setTimeout(r, 1500));
    statusEl.textContent = `✅ Swap exitoso: ${amt} ${from} → ${outEl.value} ${to}`;
  });
}

/* =====================================================
  Advanced Trading Controls
===================================================== */
function initTradeControls() {
  // Stop Loss / Take Profit
  const slInput = $('slPrice');
  const tpInput = $('tpPrice');
  const slBtn = $('slBtn');
  const tpBtn = $('tpBtn');
  const slStatus = $('slStatus');
  const tpStatus = $('tpStatus');

  slBtn?.addEventListener('click', () => {
    const price = Number(slInput?.value);
    if (!price || price <= 0) { if (slStatus) slStatus.textContent = '❌ Precio inválido'; return; }
    if (slStatus) slStatus.textContent = `✅ Stop Loss configurado en $${price}`;
  });

  tpBtn?.addEventListener('click', () => {
    const price = Number(tpInput?.value);
    if (!price || price <= 0) { if (tpStatus) tpStatus.textContent = '❌ Precio inválido'; return; }
    if (tpStatus) tpStatus.textContent = `✅ Take Profit configurado en $${price}`;
  });

  // Schedule
  const schedBtn = $('schedBtn');
  const schedStatus = $('schedStatus');
  schedBtn?.addEventListener('click', () => {
    const dateVal = $('schedDate')?.value;
    if (!dateVal) { if (schedStatus) schedStatus.textContent = '❌ Selecciona fecha y hora'; return; }
    const d = new Date(dateVal);
    if (schedStatus) schedStatus.textContent = `⏰ Trading programado para ${d.toLocaleString('es')}`;
  });
}

/* =====================================================
  Agents/Oracles section
===================================================== */
function initOracles() {
  // Stat rows updated by future agent integration
  console.log('[DEFI] Oracles ready for agent connection');
}

/* =====================================================
  Boot
===================================================== */
async function boot() {
  // Fetch real ETH price
  const ethPrice = await fetchEthUsd();
  if (ethPrice) window._lastEthPrice = ethPrice;
  else window._lastEthPrice = 2870;

  drawTradingChart('ALEM/ETH');
  bindTradingTabs();
  initMiniTrade();
  initTradeControls();
  initOracles();

  // Poll ETH/USD every 60s
  setInterval(updateEthPrice, 60000);
}

boot();
