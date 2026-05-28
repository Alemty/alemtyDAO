import { mountShell } from "/shared/js/shell.js";
mountShell();

/* =====================================================
  Utils
===================================================== */
const $ = (id) => document.getElementById(id);
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (ch) => ({
  "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"
}[ch]));

/* =====================================================
  Charts — Trading View (5 pares)
===================================================== */
const PAIRS = {
  'ALEM/ETH': {
    label: 'ALEM/ETH', base: 0.01384, vol: 0.00035,
    color: '#FFD84D',
    generate: () => {
      const base = 0.0138, vol = 0.00035;
      return Array.from({length: 120}, (_, i) => base + Math.sin(i/24)*0.0005 + (Math.random()-0.5)*vol + (Math.random()<0.03?(Math.random()-0.5)*0.0008:0) - 0.000001*i);
    }
  },
  'AURA/ALEM': {
    label: 'AURA/ALEM', base: 0.001, vol: 0.00001,
    color: '#6EC8FF',
    generate: () => {
      // Estable: 100 AURA = 1 ALEM → 0.001 ALEM por AURA
      return Array.from({length: 120}, () => 0.001 + (Math.random()-0.5)*0.00001);
    }
  },
  'ETH/USD': {
    label: 'ETH/USD', base: 2874.50, vol: 45,
    color: '#8b8cf7',
    generate: () => {
      const base = 2870, vol = 45;
      return Array.from({length: 120}, (_, i) => base + Math.sin(i/8)*30 + (Math.random()-0.5)*vol + (Math.random()<0.02?(Math.random()-0.5)*70:0) + 1.2*i);
    }
  },
  'veALEM/ETH': {
    label: 'veALEM/ETH', base: 0.007, vol: 0.0002,
    color: '#ff9f43',
    generate: () => {
      // Depende del ALEM staked: veALEM vale menos que ALEM líquido
      const base = 0.007, vol = 0.0002;
      return Array.from({length: 120}, (_, i) => base + Math.sin(i/20)*0.0003 + (Math.random()-0.5)*vol + (Math.random()<0.02?(Math.random()-0.5)*0.0004:0));
    }
  },
  'ALEM/USD': {
    label: 'ALEM/USD', base: 13.84, vol: 0.35,
    color: '#00a3ff',
    generate: () => {
      const base = 13.8, vol = 0.35;
      return Array.from({length: 120}, (_, i) => base + Math.cos(i/24)*0.5 + (Math.random()-0.5)*vol + (Math.random()<0.03?(Math.random()-0.5)*0.8:0) - 0.002*i);
    }
  }
};

let currentPair = 'ALEM/ETH';

function drawTradingChart(pairKey) {
  const canvas = document.getElementById('tradingChart');
  if (!canvas) return;
  const pair = PAIRS[pairKey];
  if (!pair) return;
  const series = pair.generate();
  const ctx = canvas.getContext('2d');
  const W = canvas.width, H = canvas.height;
  ctx.clearRect(0, 0, W, H);

  const padL = 8, padR = 8, padT = 16, padB = 12;
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
  grad.addColorStop(0, pair.color + '55'); grad.addColorStop(0.4, pair.color + '22'); grad.addColorStop(1, pair.color + '02');
  ctx.beginPath();
  series.forEach((v, i) => {
    const x = padL + plotW * (i / (series.length - 1));
    const y = padT + plotH * (1 - (v - minY) / range);
    if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
  });
  ctx.lineTo(padL + plotW, padT + plotH); ctx.lineTo(padL, padT + plotH); ctx.closePath();
  ctx.fillStyle = grad; ctx.fill();

  // Line
  const lineGrad = ctx.createLinearGradient(0, padT, W, padT);
  lineGrad.addColorStop(0, pair.color); lineGrad.addColorStop(1, pair.color + 'cc');
  ctx.strokeStyle = lineGrad; ctx.lineWidth = 2.8; ctx.lineJoin = 'round'; ctx.lineCap = 'round';
  ctx.beginPath();
  series.forEach((v, i) => {
    const x = padL + plotW * (i / (series.length - 1));
    const y = padT + plotH * (1 - (v - minY) / range);
    if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
  });
  ctx.stroke();

  // Y-axis labels
  ctx.fillStyle = 'rgba(255,255,255,.45)'; ctx.font = '700 10px Inter, system-ui, sans-serif';
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

  // Update overlay
  const lastPrice = series[series.length - 1], firstPrice = series[0];
  const changePct = ((lastPrice - firstPrice) / firstPrice * 100);
  const isUp = changePct >= 0;

  let fmt;
  if (pairKey === 'AURA/ALEM') fmt = v => v.toFixed(5);
  else if (lastPrice < 0.01) fmt = v => v.toFixed(5);
  else if (lastPrice < 1) fmt = v => '$' + v.toFixed(4);
  else if (lastPrice < 100) fmt = v => '$' + v.toFixed(2);
  else fmt = v => '$' + v.toFixed(2);

  document.getElementById('tradingPrice').textContent = fmt(lastPrice);
  document.getElementById('tradingPrice').className = 'trading-price' + (isUp ? ' up' : ' down');
  document.getElementById('tradingChange').textContent = (isUp ? '+' : '') + changePct.toFixed(2) + '%';
  document.getElementById('tradingChange').className = 'trading-change' + (isUp ? ' up' : ' down');

  // Stats mock
  const changeAbs = lastPrice - firstPrice;
  const high = Math.max(...series);
  const low = Math.min(...series);
  let highFmt, lowFmt;
  if (pairKey === 'AURA/ALEM') { highFmt = high.toFixed(5); lowFmt = low.toFixed(5); }
  else if (high < 1) { highFmt = '$' + high.toFixed(4); lowFmt = '$' + low.toFixed(4); }
  else if (high < 100) { highFmt = '$' + high.toFixed(2); lowFmt = '$' + low.toFixed(2); }
  else { highFmt = '$' + high.toFixed(1); lowFmt = '$' + low.toFixed(1); }

  document.getElementById('tsHigh').textContent = highFmt;
  document.getElementById('tsLow').textContent = lowFmt;
  document.getElementById('tsVol').textContent = pairKey === 'AURA/ALEM' ? 'Estable' : '—';
  document.getElementById('tsMc').textContent = '—';
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
  Boot
===================================================== */
function boot(){
  drawTradingChart('ALEM/ETH');
  bindTradingTabs();
}
boot();
