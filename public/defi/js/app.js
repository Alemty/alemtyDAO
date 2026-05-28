import { mountShell } from "/shared/js/shell.js";
mountShell();

/* =====================================================
  Utils
===================================================== */
const $ = (id) => document.getElementById(id);
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (ch) => ({
  "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"
}[ch]));

function clamp(n,a,b){ return Math.max(a, Math.min(b,n)); }

/* =====================================================
  Modal (sheet)
===================================================== */
function openModal(title, html, afterOpen){
  $("defiModalTitle").textContent = title;
  $("defiModalBody").innerHTML = html;
  const m = $("defiModal");
  m.classList.add("open");
  m.setAttribute("aria-hidden","false");
  if (typeof afterOpen === "function") setTimeout(afterOpen, 50);
}
function closeModal(){
  const m = $("defiModal");
  m.classList.remove("open");
  m.setAttribute("aria-hidden","true");
}
document.addEventListener("click", (e) => {
  if (e.target.closest("[data-close='defiModal']")) closeModal();
});
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape") closeModal();
});

/* =====================================================
  Canon: Mint ALEM (supply + distribución)
===================================================== */
const ALEM_MAX_SUPPLY = 1_000_000_000;
const ALEM_DISTRIBUTION = [
  { key:"Comunidad (LP, staking, incentivos)", pct:0.50, color:"rgba(0,255,213,0.90)" },
  { key:"Reserva estratégica", pct:0.20, color:"rgba(0,163,255,0.85)" },
  { key:"Equipo fundador", pct:0.15, color:"rgba(255,205,120,0.85)" },
  { key:"DAO / Tesorería", pct:0.10, color:"rgba(255,70,90,0.85)" },
  { key:"Growth / Grants", pct:0.05, color:"rgba(90,160,255,0.85)" },
];

/* =====================================================
  Canon: Aura emisión por epoch
===================================================== */
const AURA = {
  aura0: 1.0, alpha: 0.001, H: 26, hMin: 0.05, epochs: 52,
  eventsPerEpoch: (e) => 2500 + Math.floor(1200 * Math.sin(e / 6)),
};
function auraPerEvent(e){
  const Ne = Math.max(0, AURA.eventsPerEpoch(e));
  const m = 1 / (1 + AURA.alpha * Math.log(1 + Ne));
  const h = Math.max(AURA.hMin, Math.pow(2, -e / AURA.H));
  return AURA.aura0 * m * h;
}

/* =====================================================
  Canon: ALEM emisión determinista
===================================================== */
const ALEM_EMIT = {
  baseRate: 1.0, Nref: 1000, k: 0.65, mMin: 0.02, weeks: 52,
  activeDids: (w) => 800 + Math.floor(700 * (1 + Math.sin(w/7))),
  qualifiedEventsPerWeek: (w) => 2 + (w % 2),
};
function alemM(N){
  const denom = Math.max(Number(N) || 0, ALEM_EMIT.Nref);
  return clamp(Math.pow(ALEM_EMIT.Nref / denom, ALEM_EMIT.k), ALEM_EMIT.mMin, 1.0);
}
function alemPerEvent(N){ return ALEM_EMIT.baseRate * alemM(N); }

/* =====================================================
  Canon: Cap Aura
===================================================== */
const POOL = { ratioAuraPerAlem: 1000, betaDailyOut: 0.01 };
function auraCapFromPool(alemInPool){
  return (Number(alemInPool) || 0) * POOL.ratioAuraPerAlem * 2;
}

/* =====================================================
  Canvas drawing
===================================================== */
function drawLineChart(canvas, series, opts = {}){
  const ctx = canvas.getContext("2d");
  const W = canvas.width, H = canvas.height;
  ctx.clearRect(0,0,W,H);
  const pad = opts.pad ?? 14;
  const plotW = W - pad*2, plotH = H - pad*2;
  const minY = (opts.minY != null) ? opts.minY : Math.min(...series);
  const maxY = (opts.maxY != null) ? opts.maxY : Math.max(...series);
  const dy = Math.max(1e-9, maxY - minY);
  if (opts.grid === true){
    ctx.strokeStyle = "rgba(255,255,255,0.08)";
    ctx.lineWidth = 1;
    for(let i=0;i<=3;i++){
      const y = pad + (plotH * i/3);
      ctx.beginPath(); ctx.moveTo(pad, y); ctx.lineTo(pad+plotW, y); ctx.stroke();
    }
  }
  const grad = ctx.createLinearGradient(0, pad, W, pad);
  grad.addColorStop(0, "rgba(0,255,213,0.95)");
  grad.addColorStop(1, "rgba(0,163,255,0.92)");
  ctx.strokeStyle = grad; ctx.lineWidth = 2.6; ctx.lineJoin = "round"; ctx.lineCap = "round";
  ctx.beginPath();
  series.forEach((v,i) => {
    const x = pad + plotW * (i/(series.length-1));
    const t = (v - minY) / dy;
    const y = pad + plotH * (1 - t);
    if(i===0) ctx.moveTo(x,y); else ctx.lineTo(x,y);
  });
  ctx.stroke();
  if(opts.label){
    ctx.fillStyle = "rgba(255,255,255,0.86)";
    ctx.font = "900 12px Inter, system-ui, sans-serif";
    ctx.fillText(opts.label, pad, 14);
  }
}

function drawPieChart(canvas, alloc, total){
  const ctx = canvas.getContext("2d");
  const W = canvas.width, H = canvas.height;
  ctx.clearRect(0,0,W,H);
  const cx = Math.floor(W*0.46), cy = Math.floor(H*0.50);
  const r = Math.min(W, H) * 0.42, inner = r * 0.58;
  ctx.save();
  ctx.shadowColor = "rgba(0,0,0,.22)"; ctx.shadowBlur = 10; ctx.shadowOffsetY = 6;
  let a = -Math.PI/2;
  for(const seg of alloc){
    const ang = Math.max(0, seg.pct) * Math.PI * 2;
    ctx.beginPath(); ctx.moveTo(cx,cy); ctx.arc(cx,cy,r,a,a+ang); ctx.closePath();
    ctx.fillStyle = seg.color; ctx.fill(); a += ang;
  }
  ctx.restore();
  ctx.globalCompositeOperation = "destination-out";
  ctx.beginPath(); ctx.arc(cx,cy,inner,0,Math.PI*2); ctx.fill();
  ctx.globalCompositeOperation = "source-over";
  ctx.fillStyle = "rgba(255,255,255,0.90)";
  ctx.font = "1000 11px Inter"; ctx.fillText("Total", cx-16, cy-4);
  ctx.font = "1000 12px Inter";
  ctx.fillText(String(total).replace(/\B(?=(\d{3})+(?!\d))/g, ","), cx-34, cy+12);
}

/* =====================================================
  Chart series
===================================================== */
const SERIES = {
  auraSmall: Array.from({length: AURA.epochs}, (_,e) => auraPerEvent(e)),
  alemSmall: Array.from({length: ALEM_EMIT.weeks}, (_,w) => {
    const N = ALEM_EMIT.activeDids(w);
    return ALEM_EMIT.qualifiedEventsPerWeek(w) * alemPerEvent(N);
  }),
  capSmall: Array.from({length: 26}, (_,i) => {
    const alemInPool = 50_000 + Math.floor(30_000 * (1 + Math.sin(i/4)));
    return auraCapFromPool(alemInPool);
  }),
};

/* =====================================================
  Draw charts (small + legends)
===================================================== */
function drawAllCharts(){
  drawPieChart($("chartPie"), ALEM_DISTRIBUTION, ALEM_MAX_SUPPLY);
  drawLineChart($("chartAura"), SERIES.auraSmall, { pad: 14 });
  drawLineChart($("chartAlem"), SERIES.alemSmall, { pad: 14 });
  drawLineChart($("chartCap"), SERIES.capSmall, { pad: 14 });

  // Legend mint
  const bar = $("pieBar"), totalEl = $("mintTotalText");
  if(bar && totalEl){
    totalEl.textContent = `Total ALEM: ${ALEM_MAX_SUPPLY.toLocaleString("es-MX")}`;
    bar.innerHTML = ALEM_DISTRIBUTION.map(seg => {
      const pct = Math.round(seg.pct * 1000) / 10;
      return `<div class="pie-row"><span class="swatch" style="background:${seg.color}"></span><span class="pie-name">${esc(seg.key)}</span><span class="pie-pct">${pct}%</span></div>`;
    }).join("");
  }
}

/* =====================================================
  Chart modals
===================================================== */
function openChartModal(kind){
  if(kind === "mintPie"){
    openModal("Mint: división + total", `
      <div class="h2">Mint ALEM (inmutable)</div>
      <p class="muted">Supply máximo: <strong>${ALEM_MAX_SUPPLY.toLocaleString("es-MX")}</strong> ALEM. Distribución canónica fijada.</p>
      <div class="modal-chart modal-pie">
        <div class="chart-head" style="margin-bottom:8px;">
          <div><div class="t">Distribución</div><div class="small muted" id="modalMintTotalText">—</div></div>
        </div>
        <div class="pie-grid modal-pie-grid">
          <canvas id="modalPie" width="420" height="320"></canvas>
          <div class="pie-bar" id="modalPieBar"></div>
        </div>
      </div>
    `, () => {
      const c = document.getElementById("modalPie");
      const bar = document.getElementById("modalPieBar");
      const total = document.getElementById("modalMintTotalText");
      if(c) drawPieChart(c, ALEM_DISTRIBUTION, ALEM_MAX_SUPPLY);
      if(bar && total){
        total.textContent = `Total ALEM: ${ALEM_MAX_SUPPLY.toLocaleString("es-MX")}`;
        bar.innerHTML = ALEM_DISTRIBUTION.map(seg => {
          const pct = Math.round(seg.pct * 1000) / 10;
          return `<div class="pie-row"><span class="swatch" style="background:${seg.color}"></span><span class="pie-name">${esc(seg.key)}</span><span class="pie-pct">${pct}%</span></div>`;
        }).join("");
      }
    });
    return;
  }

  if(kind === "aura"){
    openModal("Aura: emisión por epoch", `
      <div class="h2">Aura — Emisión (canónica)</div>
      <p class="muted">Aura se genera desde Dharma Social (DS). Decae con adopción pero nunca llega a cero por piso h_min.</p>
      <div class="small muted">AuraPerEvent(e) = Aura₀ × m(Nₑ) × h(e) · α=0.001 · H=26 · h_min=0.05 · epoch semanal.</div>
      <div class="modal-chart"><canvas id="modalAura" width="840" height="320"></canvas></div>
      <div class="small muted" style="margin-top:10px;">Eventos: Like recibido, Punto recibido, AuraSeed (+5 condicionado).</div>
    `, () => drawLineChart(document.getElementById("modalAura"), SERIES.auraSmall, { label:"AuraPerEvent(e)" }));
    return;
  }

  if(kind === "alem"){
    openModal("ALEM: emisión por señal", `
      <div class="h2">$ALEM — Emisión determinista</div>
      <p class="muted">No se emite por likes ni puntos. Solo por eventos calificados de alta señal, con decay por adopción.</p>
      <div class="small muted">ALEM_por_evento = base_rate × m(N) · base_rate=1 · N_ref=1000 · k=0.65 · m_min=0.02.</div>
      <div class="modal-chart"><canvas id="modalAlem" width="840" height="320"></canvas></div>
      <div class="small muted" style="margin-top:10px;">Eventos: post destacado (score ≥200), misiones, voto, proveer liquidez, lock veSTAKE, contribución verificada.</div>
    `, () => drawLineChart(document.getElementById("modalAlem"), SERIES.alemSmall, { label:"ALEM semanal (conceptual)" }));
    return;
  }

  if(kind === "cap"){
    openModal("Aura cap dinámico", `
      <div class="h2">Cap de Aura (canónico)</div>
      <p class="muted">El cap del Aura circulante depende del pool. Si se alcanza, la emisión se detiene temporalmente hasta que el pool crece.</p>
      <div class="small muted">Aura_max_circulante = ALEM_en_pool × ratio × 2 · ratio inicial: 1000 Aura = 1 ALEM · β=1% circuit breaker diario.</div>
      <div class="modal-chart"><canvas id="modalCap" width="840" height="320"></canvas></div>
    `, () => drawLineChart(document.getElementById("modalCap"), SERIES.capSmall, { label:"Aura_max_circ (conceptual)" }));
    return;
  }
}

/* =====================================================
  Bind chart clicks
===================================================== */
let __lastPointerTs = 0;
function bindChartClicks(){
  document.querySelectorAll(".chart-card[data-chart]").forEach(card => {
    const kind = card.getAttribute("data-chart");
    card.addEventListener("pointerup", (e) => {
      if (e.pointerType === "mouse" && e.button !== 0) return;
      __lastPointerTs = Date.now();
      openChartModal(kind);
    });
    card.addEventListener("click", (e) => {
      if (Date.now() - __lastPointerTs < 650) return;
      openChartModal(kind);
    });
    card.addEventListener("keydown", (e) => {
      if (e.key === "Enter" || e.key === " ") openChartModal(kind);
    });
  });
  document.querySelectorAll("[data-action='open-mint']").forEach(b => b.addEventListener("click", e=>{ e.stopPropagation(); openChartModal("mintPie"); }));
  document.querySelectorAll("[data-action='open-aura']").forEach(b => b.addEventListener("click", e=>{ e.stopPropagation(); openChartModal("aura"); }));
  document.querySelectorAll("[data-action='open-alem']").forEach(b => b.addEventListener("click", e=>{ e.stopPropagation(); openChartModal("alem"); }));
  document.querySelectorAll("[data-action='open-cap']").forEach(b => b.addEventListener("click", e=>{ e.stopPropagation(); openChartModal("cap"); }));
}

/* =====================================================
  Trading Charts (Binance-style)
===================================================== */
const TRADING_PAIRS = {
  'AURA/USD': {
    label: 'AURA/USD', price: 0.0423, change24h: 3.27,
    vol24h: '1.24M', high24h: 0.0441, low24h: 0.0408, mcap: '42.3M',
    color: '#00ffd5',
    generate: () => {
      const base = 0.042, vol = 0.006;
      return Array.from({length: 120}, (_, i) => base + Math.sin(i/18)*0.008 + (Math.random()-0.5)*vol + (Math.random()<0.04?(Math.random()-0.5)*0.015:0) + 0.0003*i);
    }
  },
  'ALEM/USD': {
    label: 'ALEM/USD', price: 13.84, change24h: -1.42,
    vol24h: '8.7M', high24h: 14.22, low24h: 13.61, mcap: '1.38B',
    color: '#00a3ff',
    generate: () => {
      const base = 13.8, vol = 0.35;
      return Array.from({length: 120}, (_, i) => base + Math.cos(i/24)*0.5 + (Math.random()-0.5)*vol + (Math.random()<0.03?(Math.random()-0.5)*0.8:0) - 0.002*i);
    }
  },
  'ETH/USD': {
    label: 'ETH/USD', price: 2874.50, change24h: 1.86,
    vol24h: '18.2B', high24h: 2910.30, low24h: 2825.80, mcap: '345.8B',
    color: '#8b8cf7',
    generate: () => {
      const base = 2870, vol = 45;
      return Array.from({length: 120}, (_, i) => base + Math.sin(i/8)*30 + (Math.random()-0.5)*vol + (Math.random()<0.02?(Math.random()-0.5)*70:0) + 1.2*i);
    }
  }
};

let currentPair = 'AURA/USD';

function drawTradingChart(pairKey) {
  const canvas = document.getElementById('tradingChart');
  if (!canvas) return;
  const pair = TRADING_PAIRS[pairKey];
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
    const label = val < 1 ? val.toFixed(4) : val < 100 ? val.toFixed(2) : val.toFixed(1);
    ctx.fillText(label, padL + plotW - ctx.measureText(label).width - 4, y + 4);
  }

  // Overlay price
  const lastPrice = series[series.length - 1], firstPrice = series[0];
  const changePct = ((lastPrice - firstPrice) / firstPrice * 100);
  const isUp = changePct >= 0;
  const fmt = v => v < 1 ? '$' + v.toFixed(4) : v < 100 ? '$' + v.toFixed(2) : '$' + v.toFixed(2);
  document.getElementById('tradingPrice').textContent = fmt(lastPrice);
  document.getElementById('tradingPrice').className = 'trading-price' + (isUp ? ' up' : ' down');
  document.getElementById('tradingChange').textContent = (isUp ? '+' : '') + changePct.toFixed(2) + '%';
  document.getElementById('tradingChange').className = 'trading-change' + (isUp ? ' up' : ' down');
  document.getElementById('tsVol').textContent = pair.vol24h;
  document.getElementById('tsHigh').textContent = '$' + (pair.high24h < 100 ? pair.high24h.toFixed(2) : pair.high24h.toFixed(1));
  document.getElementById('tsLow').textContent = '$' + (pair.low24h < 100 ? pair.low24h.toFixed(2) : pair.low24h.toFixed(1));
  document.getElementById('tsMc').textContent = '$' + pair.mcap;
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
  drawTradingChart('AURA/USD');
  bindTradingTabs();
  drawAllCharts();
  bindChartClicks();
}
boot();

addEventListener("resize", () => drawAllCharts());
