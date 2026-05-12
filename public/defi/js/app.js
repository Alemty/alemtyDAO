
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
function openModal(title, html){
  $("defiModalTitle").textContent = title;
  $("defiModalBody").innerHTML = html;
  const m = $("defiModal");
  m.classList.add("open");
  m.setAttribute("aria-hidden","false");
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
  Supply máximo: 1,000,000,000 ALEM (inmutable)
  Distribución: 50/20/15/10/5 (tabla canónica)
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
  Canon: Aura emisión por epoch (decay + piso)
  AuraPerEvent(e) = Aura0 * m(N_e) * h(e)
  m(N_e) = 1 / (1 + alpha * ln(1+N_e)), alpha=0.001
  h(e) = max(h_min, 2^(-e/H)), H=26, h_min=0.05
===================================================== */
const AURA = {
  aura0: 1.0,
  alpha: 0.001,
  H: 26,
  hMin: 0.05,
  epochs: 52,
  // N_e depende de adopción; aquí solo generamos una serie demo VISUAL.
  // No altera canonicidad (la fórmula sí es exacta).
  eventsPerEpoch: (e) => 2500 + Math.floor(1200 * Math.sin(e / 6)),
};

function auraPerEvent(e){
  const Ne = Math.max(0, AURA.eventsPerEpoch(e));
  const m = 1 / (1 + AURA.alpha * Math.log(1 + Ne));
  const h = Math.max(AURA.hMin, Math.pow(2, -e / AURA.H));
  return AURA.aura0 * m * h;
}

/* =====================================================
  Canon: ALEM emisión determinista por señal
  base_rate = 1 ALEM
  N_ref = 1000
  k = 0.65
  m_min = 0.02
  ALEM_por_evento = base_rate * m(N)
  (Aquí N = DIDs activos del mes, demo visual)
===================================================== */
const ALEM_EMIT = {
  baseRate: 1.0,
  Nref: 1000,
  k: 0.65,
  mMin: 0.02,
  weeks: 52,
  // Demo visual de N (activos mensuales). La fórmula y clamps son canónicos.
  activeDids: (w) => 800 + Math.floor(700 * (1 + Math.sin(w/7)) ),
  // Eventos calificados por semana: cap 1–3/semana por DID (regla).
  qualifiedEventsPerWeek: (w) => 2 + (w % 2), // 2–3
};

function alemM(N){
  // m(N) = clamp(m_min, 1.0, (Nref / max(N,Nref))^k )
  const denom = Math.max(Number(N) || 0, ALEM_EMIT.Nref);
  const raw = Math.pow(ALEM_EMIT.Nref / denom, ALEM_EMIT.k);
  return clamp(raw, ALEM_EMIT.mMin, 1.0);
}

function alemPerEvent(N){
  return ALEM_EMIT.baseRate * alemM(N);
}

/* =====================================================
  Canon: Cap Aura circulante (depende pool)
  Aura_max_circulante = ALEM_en_pool * ratio * 2
  ratio inicial: 1000 Aura = 1 ALEM
===================================================== */
const POOL = {
  ratioAuraPerAlem: 1000, // precio inicial
  betaDailyOut: 0.01,     // 1% circuit breaker
};

function auraCapFromPool(alemInPool){
  const x = Number(alemInPool) || 0;
  return x * POOL.ratioAuraPerAlem * 2;
}

/* =====================================================
  Canvas drawing (DAO-ish: grid + grad line)
===================================================== */


function drawLineChart(canvas, series, opts = {}){
  const ctx = canvas.getContext("2d");
  const W = canvas.width, H = canvas.height;

  ctx.clearRect(0,0,W,H);
  // ✅ SIN fillRect => fondo transparente (PNG look)

  const pad = opts.pad ?? 14;          // antes 22 (muy grande para mini)
  const plotW = W - pad*2;
  const plotH = H - pad*2;

  const minY = (opts.minY != null) ? opts.minY : Math.min(...series);
  const maxY = (opts.maxY != null) ? opts.maxY : Math.max(...series);
  const dy = Math.max(1e-9, maxY - minY);

  // ✅ Grid opcional (por defecto apagado)
  if (opts.grid === true){
    ctx.strokeStyle = "rgba(255,255,255,0.10)";
    ctx.lineWidth = 1;
    for(let i=0;i<=3;i++){
      const y = pad + (plotH * i/3);
      ctx.beginPath();
      ctx.moveTo(pad, y);
      ctx.lineTo(pad+plotW, y);
      ctx.stroke();
    }
  }

  // line gradient
  const grad = ctx.createLinearGradient(0, pad, W, pad);
  grad.addColorStop(0, "rgba(0,255,213,0.95)");
  grad.addColorStop(1, "rgba(0,163,255,0.92)");

  ctx.strokeStyle = grad;
  ctx.lineWidth = 2.6;
  ctx.lineJoin = "round";
  ctx.lineCap = "round";

  ctx.beginPath();
  series.forEach((v,i) => {
    const x = pad + plotW * (i/(series.length-1));
    const t = (v - minY) / dy;
    const y = pad + plotH * (1 - t);
    if(i===0) ctx.moveTo(x,y);
    else ctx.lineTo(x,y);
  });
  ctx.stroke();

  // label opcional (si lo quieres, déjalo; si no, no lo mandes)
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

  // ✅ SIN fillRect => fondo transparente

  const cx = Math.floor(W*0.46);
  const cy = Math.floor(H*0.50);

  // tamaño “normal” (como antes, sin tocar bordes)
  const r = Math.min(W, H) * 0.42;
  const inner = r * 0.58;

  // sombra suave tipo sticker (opcional, se ve premium)
  ctx.save();
  ctx.shadowColor = "rgba(0,0,0,.22)";
  ctx.shadowBlur = 10;
  ctx.shadowOffsetY = 6;

  let a = -Math.PI/2;
  for(const seg of alloc){
    const ang = Math.max(0, seg.pct) * Math.PI * 2;
    ctx.beginPath();
    ctx.moveTo(cx,cy);
    ctx.arc(cx,cy,r,a,a+ang);
    ctx.closePath();
    ctx.fillStyle = seg.color;
    ctx.fill();
    a += ang;
  }
  ctx.restore();

  // donut cut
  ctx.globalCompositeOperation = "destination-out";
  ctx.beginPath();
  ctx.arc(cx,cy,inner,0,Math.PI*2);
  ctx.fill();
  ctx.globalCompositeOperation = "source-over";

  // center text
  ctx.fillStyle = "rgba(255,255,255,0.90)";
  ctx.font = "1000 11px Inter, system-ui, sans-serif";
  ctx.fillText("Total", cx-16, cy-4);
  ctx.font = "1000 12px Inter, system-ui, sans-serif";
  ctx.fillText(String(total).replace(/\B(?=(\d{3})+(?!\d))/g, ","), cx-34, cy+12);
}





/* =====================================================
  Render UI: Cards
  - Sin botones “detalle/abrir modal”
  - Acciones internas abren modales distintos
===================================================== */
function renderTokenCard({ mountId, title, meta, tags, actions }){
  const el = $(mountId);
  if(!el) return;

  el.innerHTML = `
    <div class="mini-top">
      <div>
        <div class="mini-title">${esc(title)}</div>
        <div class="mini-meta">${esc(meta)}</div>
      </div>
    </div>
    <div class="mini-tags">
      ${tags.map(t => `<span class="mini-tag">${esc(t)}</span>`).join("")}
    </div>
    <div class="mini-actions">
      ${actions.map(a => `
        <button class="btn ${a.primary ? "primary" : ""}" type="button" data-open="${esc(a.key)}">
          ${esc(a.label)}
        </button>
      `).join("")}
    </div>
  `;

  // bind actions
  actions.forEach(a => {
    el.querySelector(`[data-open="${a.key}"]`)?.addEventListener("click", (ev) => {
      ev.preventDefault();
      openModal(a.modalTitle, a.modalHtml());
      // si el modal necesita chart grande, se dibuja en callback
      if (typeof a.afterOpen === "function") a.afterOpen();
    });
  });
}

/* =====================================================
  Build chart series (small + large)
===================================================== */
const SERIES = {
  auraSmall: Array.from({length: AURA.epochs}, (_,e) => auraPerEvent(e)),
  alemSmall: Array.from({length: ALEM_EMIT.weeks}, (_,w) => {
    const N = ALEM_EMIT.activeDids(w);
    const perEvent = alemPerEvent(N);
    const q = ALEM_EMIT.qualifiedEventsPerWeek(w);
    // semanal conceptual: eventos * ALEM_por_evento
    return q * perEvent;
  }),
  capSmall: Array.from({length: 26}, (_,i) => {
    // conceptual: cap según ALEM en pool (escala demo)
    const alemInPool = 50_000 + Math.floor(30_000 * (1 + Math.sin(i/4)));
    return auraCapFromPool(alemInPool);
  }),
};

/* =====================================================
  Mint legend bar
===================================================== */
function renderMintLegend(){
  const bar = $("pieBar");
  const totalEl = $("mintTotalText");
  if(!bar || !totalEl) return;

  totalEl.textContent = `Total ALEM: ${ALEM_MAX_SUPPLY.toLocaleString("es-MX")}`;

  bar.innerHTML = ALEM_DISTRIBUTION.map(seg => {
    const amount = Math.round(ALEM_MAX_SUPPLY * seg.pct);
    const pct = Math.round(seg.pct*1000)/10;
    
return `
  <div class="pie-row">
    <div class="pie-left">
      <span class="swatch" style="background:${seg.color}"></span>
      <span class="pie-name">${esc(seg.key)}</span>
      <span class="pie-pct">${pct}%</span>
    </div>
  </div>

    `;
  }).join("");
}

function renderMintLegendTo(barEl, totalEl){
  if(!barEl || !totalEl) return;
  totalEl.textContent = `Total ALEM: ${ALEM_MAX_SUPPLY.toLocaleString("es-MX")}`;

  barEl.innerHTML = ALEM_DISTRIBUTION.map(seg => {
    const pct = Math.round(seg.pct * 1000) / 10;
    return `
      <div class="pie-row">
        <div class="pie-left">
          <span class="swatch" style="background:${seg.color}"></span>
          <span class="pie-name">${esc(seg.key)}</span>
          <span class="pie-pct">${pct}%</span>
        </div>
      </div>
    `;
  }).join("");
}

/* =====================================================
  Render charts (small)
===================================================== */
function renderSmallCharts(){
  drawPieChart($("chartPie"), ALEM_DISTRIBUTION, ALEM_MAX_SUPPLY);
  
drawLineChart($("chartAura"), SERIES.auraSmall, { pad: 14 });
drawLineChart($("chartAlem"), SERIES.alemSmall, { pad: 14 });
drawLineChart($("chartCap"), SERIES.capSmall, { pad: 14 });


  renderMintLegend();
}

/* =====================================================
  Chart modals (click en cualquier chart)
  - Redibuja la MISMA gráfica en tamaño grande
===================================================== */
function openChartModal(kind){
  
if(kind === "mintPie"){
  openModal("Mint: división + total", `
    <div class="h2">Mint ALEM (inmutable)</div>
    <p class="muted">
      Supply máximo: <strong>${ALEM_MAX_SUPPLY.toLocaleString("es-MX")}</strong> ALEM.
      Distribución canónica por segmento está fijada.
    </p>

    <div class="modal-chart modal-pie">
      <div class="chart-head" style="margin-bottom:8px;">
        <div>
          <div class="t">Distribución</div>
          <div class="small muted" id="modalMintTotalText">—</div>
        </div>
      </div>

      <!-- ✅ MISMO LAYOUT que la card: pie izquierda + distribución derecha -->
      <div class="pie-grid modal-pie-grid">
        <canvas id="modalPie" width="420" height="320" aria-label="Gráfica de pastel mint (modal)"></canvas>
        <div class="pie-bar" id="modalPieBar" aria-label="Leyenda de mint (modal)"></div>
      </div>
    </div>
  `);

  // draw + legend (lado derecho)
  const c = document.getElementById("modalPie");
  const bar = document.getElementById("modalPieBar");
  const total = document.getElementById("modalMintTotalText");
  drawPieChart(c, ALEM_DISTRIBUTION, ALEM_MAX_SUPPLY);
  renderMintLegendTo(bar, total);
  return;
}


  if(kind === "aura"){
    openModal("Aura: emisión por epoch", `
      <div class="h2">Aura — Emisión (canónica)</div>
      <p class="muted">
        Aura se genera desde Dharma Social (DS). La emisión por evento decae con la adopción,
        pero nunca llega a cero por el piso h_min.
      </p>
      <div class="small muted">
        AuraPerEvent(e) = Aura₀ × m(Nₑ) × h(e) · α=0.001 · H=26 · h_min=0.05 · epoch semanal.
      </div>
      <div class="modal-chart">
        <canvas id="modalAura" width="840" height="320"></canvas>
      </div>
      <div class="small muted" style="margin-top:10px;">
        Eventos: Like recibido, Punto recibido (por punto), AuraSeed (+5 condicionado).
      </div>
    `);
    drawLineChart(document.getElementById("modalAura"), SERIES.auraSmall, { label:"AuraPerEvent(e) — grande" });
    return;
  }

  if(kind === "alem"){
    openModal("ALEM: emisión por señal", `
      <div class="h2">$ALEM — Emisión determinista</div>
      <p class="muted">
        ALEM no se emite por likes ni puntos. Se emite por eventos calificados de alta señal y baja frecuencia,
        con factor m(N) que decae por adopción (DIDs activos).
      </p>
      <div class="small muted">
        ALEM_por_evento = base_rate × m(N) · base_rate=1 · N_ref=1000 · k=0.65 · m_min=0.02.
      </div>
      <div class="modal-chart">
        <canvas id="modalAlem" width="840" height="320"></canvas>
      </div>
      <div class="small muted" style="margin-top:10px;">
        Ejemplos de eventos calificados: post destacado (score ≥200), misiones verificadas, voto, proveer liquidez, lock veSTAKE, contribución verificada.
      </div>
    `);
    drawLineChart(document.getElementById("modalAlem"), SERIES.alemSmall, { label:"ALEM semanal (conceptual) — grande" });
    return;
  }

  if(kind === "cap"){
    openModal("Aura cap dinámico", `
      <div class="h2">Cap de Aura (canónico)</div>
      <p class="muted">
        El cap del Aura circulante depende del pool: crece cuando crece ALEM en pool interno.
        Si se alcanza el cap, la emisión se detiene temporalmente hasta que el pool crece.
      </p>
      <div class="small muted">
        Aura_max_circulante = ALEM_en_pool × ratio × 2 · ratio inicial: 1000 Aura = 1 ALEM.
      </div>
      <div class="modal-chart">
        <canvas id="modalCap" width="840" height="320"></canvas>
      </div>
      <div class="small muted" style="margin-top:10px;">
        Circuit breaker diario: ALEM_out_max_día = β × ALEM_en_pool, β=1% (ajustable por gobernanza Tipo A).
      </div>
    `);
    drawLineChart(document.getElementById("modalCap"), SERIES.capSmall, { label:"Aura_max_circ (conceptual) — grande" });
    return;
  }
}

/* =====================================================
  Bind chart clicks (dedupe pointer/click como DAO)
===================================================== */
let __lastPointerTs = 0;

function bindChartClicks(){
  // toda la card abre
  document.querySelectorAll(".chart-card[data-chart]").forEach(card => {
    const kind = card.getAttribute("data-chart");
    // pointerup
    card.addEventListener("pointerup", (e) => {
      if (e.pointerType === "mouse" && e.button !== 0) return;
      __lastPointerTs = Date.now();
      // si clic fue en botón mini ↗ también abre
      openChartModal(kind);
    });
    // click fallback (evita doble)
    card.addEventListener("click", (e) => {
      if (Date.now() - __lastPointerTs < 650) return;
      openChartModal(kind);
    });
    // enter key
    card.addEventListener("keydown", (e) => {
      if (e.key === "Enter" || e.key === " ") openChartModal(kind);
    });
  });

  // icon buttons ↗ dentro de charts (no duplican, solo abren)
  document.querySelectorAll("[data-action='open-mint']").forEach(b => b.addEventListener("click", (e)=>{ e.stopPropagation(); openChartModal("mintPie"); }));
  document.querySelectorAll("[data-action='open-aura']").forEach(b => b.addEventListener("click", (e)=>{ e.stopPropagation(); openChartModal("aura"); }));
  document.querySelectorAll("[data-action='open-alem']").forEach(b => b.addEventListener("click", (e)=>{ e.stopPropagation(); openChartModal("alem"); }));
  document.querySelectorAll("[data-action='open-cap']").forEach(b => b.addEventListener("click", (e)=>{ e.stopPropagation(); openChartModal("cap"); }));
}

/* =====================================================
  Token cards content (canónico)
===================================================== */
function renderAllCards(){
  renderTokenCard({
    mountId: "cardDharma",
    title: "Dharma",
    meta: "XP / Reputación · off-chain · ❌ transferible",
    tags: ["Progreso", "Niveles", "DS→Aura"],
    actions: [
      {
        key:"dharma-reglas",
        label:"Reglas",
        modalTitle:"Dharma — reglas",
        modalHtml: () => `
          <div class="h2">Dharma — reglas canónicas</div>
          <p class="muted">
            Dos tipos: Dharma Social (DS) y Dharma Condicional (DC). Regla inmutable:
            solo DS genera Aura y solo DS paga Karma; DC acelera nivel pero no reputación.
          </p>
          <div class="small muted">
            DS: likes/puntos recibidos + bonos por post destacado; DC: staking ALEM/NFT con cap mensual 2,000 DC por DID.
          </div>
        `
      },
      {
        key:"dharma-fuentes",
        label:"Fuentes",
        primary:true,
        modalTitle:"Dharma — fuentes & caps",
        modalHtml: () => `
          <div class="h2">Dharma Social (DS)</div>
          <p class="muted">
            Fuentes permanentes: Like recibido (+1 DS), Punto recibido (+1 DS por punto), Post destacado orgánico (score ≥ 200) (+5 DS bono).
          </p>
          <div class="small muted">
            Anti-spam: 20 likes/día por emisor; 10 pts/post/emisor; 50 pts/día total; cap DS por par DID→DID (5/día).
          </div>
          <div class="h2" style="margin-top:14px;">Dharma Condicional (DC)</div>
          <p class="muted">
            DC viene de staking ALEM/NFT; cap total: 2,000 DC/mes por DID. Niveles Avanzado+ requieren mínimo 60% DS.
          </p>
        `
      }
    ]
  });

  renderTokenCard({
    mountId: "cardKarma",
    title: "Karma",
    meta: "Antitoken / Deuda · off-chain · ❌ transferible",
    tags: ["Fricción", "Bloqueo", "DS paga"],
    actions: [
      {
        key:"karma-pago",
        label:"Pago",
        modalTitle:"Karma — cómo se paga",
        modalHtml: () => `
          <div class="h2">Karma — pago</div>
          <p class="muted">
            Karma solo se paga con Dharma Social (DS) futuro: 1 DS ganado = 1 Karma saldado.
            No se paga con Aura, no con ALEM, no con dinero.
          </p>
          <div class="small muted">
            Si Karma > 0, el nivel queda congelado; DS nuevo primero resta Karma 1:1, luego acumula Dharma.
          </div>
        `
      },
      {
        key:"karma-apelacion",
        label:"Apelación",
        primary:true,
        modalTitle:"Karma — apelación",
        modalHtml: () => `
          <div class="h2">Karma — apelación (2 niveles)</div>
          <p class="muted">
            Nivel 1: Peer Review (48h) con 3 moderadores; si 2/3 revocan, se revierte.
            Nivel 2: DAO Vote Tipo A (48h) disponible si el Nivel 1 fue denegado y el usuario cumple requisitos.
          </p>
          <div class="small muted">
            Karma social puede aplicarse por spam, violación de reglas, fraude o ataques Sybil confirmados.
          </div>
        `
      }
    ]
  });

  renderTokenCard({
    mountId: "cardAura",
    title: "Aura",
    meta: "Utility interno · ✅ transferible interno · ❌ listed",
    tags: ["Gas social", "Decay", "Cap"],
    actions: [
      {
        key:"aura-emision",
        label:"Emisión",
        modalTitle:"Aura — emisión",
        modalHtml: () => `
          <div class="h2">Aura — emisión por epoch</div>
          <p class="muted">
            Emisión semanal (epoch) con decay y piso: AuraPerEvent(e) = Aura₀ × m(Nₑ) × h(e).
            α=0.001, H=26, h_min=0.05.
          </p>
          <div class="small muted">
            Eventos: Like recibido, Punto recibido (por punto), AuraSeed (+5) condicionado (anti-Sybil).
          </div>
          <div class="modal-chart">
            <canvas id="modalAura2" width="840" height="320"></canvas>
          </div>
        `,
        afterOpen: () => drawLineChart(document.getElementById("modalAura2"), SERIES.auraSmall, { label:"AuraPerEvent(e) — grande" })
      },
      {
        key:"aura-costos",
        label:"Costos",
        primary:true,
        modalTitle:"Aura — costos (gas social)",
        modalHtml: () => `
          <div class="h2">Aura — costos</div>
          <div class="small muted">Destino: quema / treasury / autor según acción.</div>
          <div class="modal-chart">
            <div class="small muted">• Post: 3 Aura (50% quema · 50% treasury)</div>
            <div class="small muted">• Dar 1 punto: 1 Aura/pt (100% al autor)</div>
            <div class="small muted">• Crear tema: 8 Aura (50/50)</div>
            <div class="small muted">• Crear sala: 10 Aura (50/50)</div>
            <div class="small muted">• Premium: 5 Aura (80% autor · 20% treasury)</div>
            <div class="small muted">• Boost: 20 Aura (50/50)</div>
          </div>
        `
      }
    ]
  });

  renderTokenCard({
    mountId: "cardAlem",
    title: "$ALEM",
    meta: "Governance token · ✅ Base · sin ICO/preventa",
    tags: ["1B supply", "DEX", "veSTAKE"],
    actions: [
      {
        key:"alem-mint",
        label:"Mint",
        modalTitle:"$ALEM — supply & distribución",
        modalHtml: () => `
          <div class="h2">$ALEM — supply máximo</div>
          <p class="muted">
            Supply máximo (inmutable): ${ALEM_MAX_SUPPLY.toLocaleString("es-MX")} ALEM.
            Distribución canónica por segmentos.
          </p>
          <div class="modal-chart">
            <canvas id="modalPie2" width="840" height="320"></canvas>
          </div>
        `,
        afterOpen: () => drawPieChart(document.getElementById("modalPie2"), ALEM_DISTRIBUTION, ALEM_MAX_SUPPLY)
      },
      {
        key:"alem-emision",
        label:"Emisión",
        primary:true,
        modalTitle:"$ALEM — emisión por señal",
        modalHtml: () => `
          <div class="h2">$ALEM — emisión determinista</div>
          <p class="muted">
            No se emite por likes ni puntos. Emite por eventos calificados, con decay por adopción:
            ALEM_por_evento = base_rate × m(N).
          </p>
          <div class="small muted">
            base_rate=1 · N_ref=1000 · k=0.65 · m_min=0.02.
          </div>
          <div class="modal-chart">
            <canvas id="modalAlem2" width="840" height="320"></canvas>
          </div>
        `,
        afterOpen: () => drawLineChart(document.getElementById("modalAlem2"), SERIES.alemSmall, { label:"ALEM semanal (conceptual) — grande" })
      }
    ]
  });

  // Extra: $ALEM/veALEM (gobernanza) — mini en línea
  
renderTokenCard({
  mountId: "cardAlemVeAlem",
  title: "Pool $ALEM / veALEM",
  meta: "AMM + lock · intercambio interno · puente a gobernanza",
  tags: ["AMM", "Lock", "SwapFactor"],
  actions: [
    {
      key:"alem-vealem-pool",
      label:"Pool",
      modalTitle:"Pool $ALEM / veALEM — reglas",
      modalHtml: () => `
        <div class="h2">Pool $ALEM ↔ veALEM (interno)</div>
        <p class="muted">
          Pool conceptual para intercambio entre $ALEM y su poder bloqueado (veALEM).
          Se integra al DEX y respeta lock/decay. (UI v1)
        </p>
        <div class="small muted">
          Nota: veALEM representa poder no líquido (lock). El intercambio debe considerar restricciones de lock/unlock.
        </div>
      `
    },
    {
      key:"alem-vealem-roadmap",
      label:"Roadmap",
      primary:true,
      modalTitle:"Pool $ALEM / veALEM — roadmap",
      modalHtml: () => `
        <div class="h2">Roadmap Pool $ALEM / veALEM</div>
        <p class="muted">
          Este panel DeFi es la UI para integrar el pool y enlazarlo con el DEX.
        </p>
        <div class="small muted">
          Fases: UI → reglas → validaciones de lock → integración con pools/staking → gobernanza.
        </div>
      `
    }
  ]
});


  // Extra: Pool veALEM / veSTAKE
  renderTokenCard({
    mountId: "cardPoolVeAlemVeStake",
    title: "Pool veALEM / veSTAKE",
    meta: "AMM + límites · stake/lock · DEX future",
    tags: ["AMM", "Breaker", "SwapFactor"],
    actions: [
      {
        key:"pool-reglas",
        label:"Pool",
        modalTitle:"Pool — reglas",
        modalHtml: () => `
          <div class="h2">Pool interno Aura ↔ ALEM</div>
          <p class="muted">
            AMM producto constante (x·y=k). Precio inicial: 1,000 Aura = 1 ALEM.
            Circuit breaker diario: ALEM_out_max_día = β × ALEM_en_pool, β=1%.
          </p>
          <div class="small muted">
            SwapFactor por Karma: 1 / (1 + 0.002 × K). La diferencia va a treasury.
          </div>
        `
      },
      {
        key:"pool-roadmap",
        label:"Roadmap",
        primary:true,
        modalTitle:"DEX — roadmap (UI)",
        modalHtml: () => `
          <div class="h2">Roadmap DEX (UI)</div>
          <p class="muted">
            Este panel DeFi es la UI para integrar swap, pools, staking y gobernanza conforme avancen las fases del DEX.
          </p>
          <div class="small muted">
            (UI plan) Swap · LP Pools · Staking · Vote · Rewards/Bribes.
          </div>
        `
      }
    ]
  });
}

/* =====================================================
  Roadmap button (modal)
===================================================== */
function bindRoadmap(){
  $("openRoadmap")?.addEventListener("click", () => {
    openModal("Roadmap DEX", `
      <div class="h2">Roadmap DEX (UI)</div>
      <p class="muted">
        Este subdominio DeFi mantiene el estilo visual del DAO y concentra la capa económica/DEX.
      </p>
      <div class="small muted">
        Nota: tokens no son equity ni promesa de retorno.
      </div>
    `);
  });
}

/* =====================================================
  Boot
===================================================== */
function boot(){
  renderAllCards();
  renderSmallCharts();
  bindChartClicks();
  bindRoadmap();
}
boot();

// Resize: re-render charts (mantiene crisp)
addEventListener("resize", () => renderSmallCharts());
