import { mountShell } from "/shared/js/shell.js";
mountShell();

/* =====================================================
  DEFI — Pure Trading Terminal
===================================================== */
const $ = id => document.getElementById(id);

/* =====================================================
  Palette — friendly, no yellow/orange
===================================================== */
const PALETTE = {
  'ALEM/ETH':  { color: '#3b82f6', up: '#22c55e', down: '#ef4444' },
  'AURA/ALEM': { color: '#22c55e', up: '#22c55e', down: '#ef4444' },
  'ALEM/USD':  { color: '#6366f1', up: '#22c55e', down: '#ef4444' },
  'veALEM/ETH':{ color: '#a855f7', up: '#22c55e', down: '#ef4444' },
  'ETH/USD':   { color: '#ec4899', up: '#22c55e', down: '#ef4444' },
};

/* =====================================================
  Timeframe config — data points per timeframe
===================================================== */
const TF = {
  'MAX': { points: 500, volFactor: 1.0,  label: 'MAX' },
  '1Y':  { points: 365, volFactor: 0.6,  label: '1 AÑO' },
  '1M':  { points: 120, volFactor: 0.35, label: '1 MES' },
  '1W':  { points: 84,  volFactor: 0.2,  label: '1 SEM' },
  '1D':  { points: 48,  volFactor: 0.1,  label: '1 DÍA' },
  '1H':  { points: 24,  volFactor: 0.04, label: '1 HORA' },
};

let currentPair = 'ALEM/ETH';
let currentTf = '1D';

/* =====================================================
  Data generators
===================================================== */
function genSeries(pairKey, tfKey) {
  const cfg = TF[tfKey] || TF['1D'];
  const n = cfg.points;
  const vf = cfg.volFactor;
  const base = getBase(pairKey);
  const vol = getVol(pairKey) * vf;
  return Array.from({length: n}, (_, i) => {
    return base
      + Math.sin(i / (n * 0.15)) * vol * 1.5
      + Math.cos(i / (n * 0.07)) * vol * 0.6
      + (Math.random() - 0.5) * vol * 0.8
      + (Math.random() < 0.03 ? (Math.random() - 0.5) * vol * 2 : 0)
      + (i / n) * vol * (0.1 - Math.random() * 0.2);
  });
}

function getBase(pair) {
  if (pair === 'ALEM/ETH') return 0.0138;
  if (pair === 'AURA/ALEM') return 0.001;
  if (pair === 'ALEM/USD') return 13.8;
  if (pair === 'veALEM/ETH') return 0.007;
  if (pair === 'ETH/USD') return 2870;
  return 1;
}

function getVol(pair) {
  if (pair === 'ALEM/ETH') return 0.00035;
  if (pair === 'AURA/ALEM') return 0.00001;
  if (pair === 'ALEM/USD') return 0.35;
  if (pair === 'veALEM/ETH') return 0.0002;
  if (pair === 'ETH/USD') return 45;
  return 0.1;
}

// ETH/USD real: inject real price into series
let ethRealPrice = 2870;
let ethHistory = [];

async function fetchEthUsd() {
  try {
    const r = await fetch('https://api.coingecko.com/api/v3/simple/price?ids=ethereum&vs_currencies=usd');
    const d = await r.json();
    if (d?.ethereum?.usd) ethRealPrice = d.ethereum.usd;
  } catch {}
}

function genEthSeries(tfKey) {
  const cfg = TF[tfKey] || TF['1D'];
  const n = cfg.points;
  // Append real price to rolling history
  ethHistory.push(ethRealPrice);
  if (ethHistory.length > n) ethHistory = ethHistory.slice(-n);

  // If not enough history, backfill
  if (ethHistory.length < n) {
    const need = n - ethHistory.length;
    for (let i = 0; i < need; i++) {
      ethHistory.unshift(ethRealPrice + (Math.random() - 0.5) * 60 + Math.sin(i / 8) * 30);
    }
  }
  return [...ethHistory];
}

/* =====================================================
  Light mode detection for canvas
===================================================== */
function isLightMode() {
  return document.documentElement.classList.contains('light');
}

/* =====================================================
  Chart drawing
===================================================== */
function drawTradingChart(pairKey, tfKey) {
  const canvas = $('tradingChart');
  if (!canvas) return;
  const pair = PALETTE[pairKey];
  if (!pair) return;

  let series;
  if (pairKey === 'ETH/USD') {
    series = genEthSeries(tfKey);
  } else {
    series = genSeries(pairKey, tfKey);
  }

  const ctx = canvas.getContext('2d');
  const W = canvas.width, H = canvas.height;
  ctx.clearRect(0, 0, W, H);

  const padL = 10, padR = 10, padT = 20, padB = 14;
  const plotW = W - padL - padR, plotH = H - padT - padB;
  const minY = Math.min(...series), maxY = Math.max(...series);
  const range = Math.max(1e-9, maxY - minY);

  // Grid — light-aware
  const light = isLightMode();
  ctx.strokeStyle = light ? 'rgba(0,0,0,.08)' : 'rgba(255,255,255,.10)';
  ctx.lineWidth = 1;
  for (let i = 0; i <= 4; i++) {
    const y = padT + (plotH * i / 4);
    ctx.beginPath(); ctx.moveTo(padL, y); ctx.lineTo(padL + plotW, y); ctx.stroke();
  }

  // Gradient fill
  const grad = ctx.createLinearGradient(0, padT, 0, padT + plotH);
  grad.addColorStop(0, pair.color + (light ? '33' : '55'));
  grad.addColorStop(0.4, pair.color + (light ? '15' : '22'));
  grad.addColorStop(1, pair.color + (light ? '04' : '02'));
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

  // Y-axis labels — light-aware
  ctx.fillStyle = light ? 'rgba(0,0,0,.55)' : 'rgba(255,255,255,.65)';
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

  // Stats: Open, High, Low, Close, Volatility, Volume
  const open = series[0];
  const close = lastPrice;
  const high = Math.max(...series);
  const low = Math.min(...series);

  let openFmt, closeFmt, highFmt, lowFmt;
  const fmt2 = (v) => {
    if (pairKey === 'AURA/ALEM') return v.toFixed(5);
    if (v < 0.01) return v.toFixed(5);
    if (v < 1) return '$' + v.toFixed(4);
    if (v < 100) return '$' + v.toFixed(2);
    return '$' + v.toFixed(1);
  };
  openFmt = fmt2(open); closeFmt = fmt2(close); highFmt = fmt2(high); lowFmt = fmt2(low);

  $('tsOpen') && ($('tsOpen').textContent = openFmt);
  $('tsHigh') && ($('tsHigh').textContent = highFmt);
  $('tsLow') && ($('tsLow').textContent = lowFmt);
  $('tsClose') && ($('tsClose').textContent = closeFmt);
  $('tsVol') && ($('tsVol').textContent = pairKey === 'AURA/ALEM' ? 'Estable' : (changePct < 0 ? Math.abs(changePct).toFixed(1) + '%' : changePct.toFixed(1) + '%'));
  $('tsVolAmt') && ($('tsVolAmt').textContent = (series.length * 100 + Math.floor(Math.random() * 1000)).toLocaleString());
}

/* =====================================================
  ETH/USD real-time polling
===================================================== */
async function updateEthPrice() {
  await fetchEthUsd();
  if (currentPair === 'ETH/USD') drawTradingChart('ETH/USD', currentTf);
}

// First fetch on boot
async function initEthPrice() {
  await fetchEthUsd();
}

/* =====================================================
  Bind tabs
===================================================== */
function bindTradingTabs() {
  document.querySelectorAll('.trading-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('.trading-tab').forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      currentPair = tab.getAttribute('data-pair');
      drawTradingChart(currentPair, currentTf);
    });
  });
}

function bindTimeframes() {
  document.querySelectorAll('.tf-btn').forEach(btn => {
    // Set 1D as active by default
    if (btn.id === 'tfDefault') btn.classList.add('active');
    btn.addEventListener('click', () => {
      document.querySelectorAll('.tf-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      currentTf = btn.getAttribute('data-tf');
      drawTradingChart(currentPair, currentTf);
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
    if (rate) outEl.value = (amt * rate).toFixed(6);
    else outEl.value = '—';
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
  $('slBtn')?.addEventListener('click', () => {
    const price = Number($('slPrice')?.value);
    if (!price || price <= 0) { if ($('slStatus')) $('slStatus').textContent = '❌ Precio inválido'; return; }
    if ($('slStatus')) $('slStatus').textContent = `✅ Stop Loss configurado en $${price}`;
  });

  $('tpBtn')?.addEventListener('click', () => {
    const price = Number($('tpPrice')?.value);
    if (!price || price <= 0) { if ($('tpStatus')) $('tpStatus').textContent = '❌ Precio inválido'; return; }
    if ($('tpStatus')) $('tpStatus').textContent = `✅ Take Profit configurado en $${price}`;
  });

  $('schedBtn')?.addEventListener('click', () => {
    const dateVal = $('schedDate')?.value;
    if (!dateVal) { if ($('schedStatus')) $('schedStatus').textContent = '❌ Selecciona fecha y hora'; return; }
    const d = new Date(dateVal);
    if ($('schedStatus')) $('schedStatus').textContent = `⏰ Trading programado para ${d.toLocaleString('es')}`;
  });
}

/* =====================================================
  Boot
===================================================== */
async function boot() {
  await initEthPrice();
  drawTradingChart('ALEM/ETH', '1D');
  bindTradingTabs();
  bindTimeframes();
  initMiniTrade();
  initTradeControls();

  // Poll ETH/USD every 60s
  setInterval(updateEthPrice, 60000);
}

boot();
