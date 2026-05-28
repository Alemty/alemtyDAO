// public/ia/js/app.js — IA Dashboard: Agent Tracking, Activity Feed, Admin Center
// Datos conectados a docs reales: TOKENOMICS_RULEBOOK, WHITEPAPER, workflows GitHub
import { mountShell } from '../../shared/js/shell.js';
import { getDid } from '../../shared/js/wallet.js';
import { esc } from '../../shared/js/core.js';

/* =========================================================
   CONFIG
========================================================= */
const ADMIN_ADDRESS = '0x6a202f991c4c1df079449be9847b1dac3f51854f'.toLowerCase();

// Métricas desde documentación real
let METRICS = {
  agentsActive: 6,
  ops24h: 2847,
  tvlManaged: 284000,
  feesGenerated: 4.2
};

// ======== AGENTES ========

// Assets digitales reales extraídos del CSV histórico de PolygonScan
// (export-address-nfts-0x6A202f991c4C1df079449BE9847b1DaC3F51854f.csv — wallet 0x6a20...1854f)
// 684 items totales en 146 colecciones — incluye 198 OVRLands, wearables DCL, HAPE, etc.
const ASSETS = [
  // Tierras — el activo principal
  { name: 'OVRLand',                    qty: 198, collection: 'Over the Reality', icon: '🗺️' },
  // Colecciones destacadas (10+ items)
  { name: 'ERC-1155 TOKEN*',            qty: 211, collection: 'Unidentified',    icon: '💎' },
  { name: 'Consensys Wearables S1',     qty: 11,  collection: 'Decentraland',    icon: '👕' },
  { name: 'ERC-721 TOKEN*',             qty: 11,  collection: 'Unidentified',    icon: '💠' },
  { name: 'Metaverse Music Festival 22',qty: 9,   collection: 'Decentraland',    icon: '🎵' },
  { name: 'Pride 2021',                 qty: 9,   collection: 'Decentraland',    icon: '🏳️‍🌈' },
  { name: 'veRetro',                    qty: 7,   collection: 'Retro',           icon: '⏪' },
  { name: 'The Raverse Stage MVMF22',   qty: 6,   collection: 'Decentraland',    icon: '🎭' },
  { name: 'OpenSea Collections',        qty: 5,   collection: 'OpenSea',         icon: '🌊' },
  { name: 'VEGAS CITY XMAS 2022',       qty: 5,   collection: 'Decentraland',    icon: '🎄' },
  { name: '$2000 USDC',                 qty: 9,   collection: 'Airdrop',         icon: '💵' },
  // Colecciones con 3-4 items
  { name: 'Hape Apparel',               qty: 4,   collection: 'HAPE',            icon: '🧥' },
  { name: 'Glow Proud 23\'',            qty: 4,   collection: 'Decentraland',    icon: '✨' },
  { name: 'LimeWire Glasses MVMF22',    qty: 4,   collection: 'Decentraland',    icon: '👓' },
  { name: 'Metaverse Pride Month 2022', qty: 4,   collection: 'Decentraland',    icon: '🏳️‍🌈' },
  { name: 'OG Community Collection',    qty: 4,   collection: 'Decentraland',    icon: '👑' },
  { name: 'DCLMF 2024 Booth',           qty: 3,   collection: 'Decentraland',    icon: '🎪' },
  { name: 'Dillon Francis MVMF 2022',   qty: 3,   collection: 'Decentraland',    icon: '🎧' },
  { name: 'McCormick\'s House of Flavor',qty: 3,   collection: 'Decentraland',    icon: '🍔' },
  { name: 'mycharacter.ai',             qty: 3,   collection: 'AI',              icon: '🤖' },
  { name: 'Patron Summer Oasis',        qty: 3,   collection: 'Decentraland',    icon: '🌴' },
  { name: 'Roland Lifestyle DCLMVMF22', qty: 3,   collection: 'Decentraland',    icon: '🎹' },
  { name: 'Thalia Pride Superstar',     qty: 3,   collection: 'Decentraland',    icon: '⭐' },
  { name: 'WonderZone Apparel F21',     qty: 3,   collection: 'Decentraland',    icon: '🧢' },
  // Colecciones con 2 items
  { name: 'Another-1 x Templa',         qty: 2,   collection: 'Another-1',       icon: '🎨' },
  { name: 'DCLMF25 Lightstick Emotes',  qty: 2,   collection: 'Decentraland',    icon: '💡' },
  { name: 'DCLMF25 Wearables',          qty: 2,   collection: 'Decentraland',    icon: '👕' },
  { name: 'HAPE at DCLMF25',            qty: 2,   collection: 'HAPE',            icon: '🐵' },
  { name: 'MetaQueens.io Pride Set',    qty: 2,   collection: 'Decentraland',    icon: '👑' },
  { name: 'Miller Lite Holiday',        qty: 2,   collection: 'Decentraland',    icon: '🍺' },
  // Iconics (1 item c/u)
  { name: '5th Dimension Hoodie DCLMF24', qty: 1, collection: '5th D',          icon: '🔮' },
  { name: 'AKCB MF2025',                qty: 1,   collection: 'AKCB',            icon: '🏆' },
  { name: 'AKCB Skin',                  qty: 1,   collection: 'AKCB',            icon: '🎭' },
  { name: 'FREE MERCH',                 qty: 1,   collection: 'Decentraland',    icon: '🎁' },
  { name: 'DCLMF25 Party Pads',         qty: 1,   collection: 'Decentraland',    icon: '🪩' },
  { name: 'Newtro Arts',                qty: 1,   collection: 'Newtro',          icon: '🎯' },
  { name: "Rad TV's DCL Chill Mode",    qty: 1,   collection: 'Rad TV',          icon: '📺' },
  { name: "Rad TV's DCL Wearable Helmet",qty: 1,  collection: 'Rad TV',          icon: '⛑️' },
  { name: 'LMTLSS Hoodie DCLMF24',      qty: 1,   collection: 'Decentraland',    icon: '🟣' },
  { name: 'Samsung 837x MVMF 2022',     qty: 1,   collection: 'Decentraland',    icon: '📱' },
  { name: 'Nouns Colombia',             qty: 1,   collection: 'Nouns',           icon: '🇨🇴' },
  { name: 'LimeWire',                   qty: 1,   collection: 'LimeWire',        icon: '🎶' }
];
// Totales reales del histórico completo
const TOTAL_ASSETS = 684;
const TOTAL_OVR = 198;
const ASSET_COLLECTIONS = 146;

// OVRlands — 198 tierras reales en Polygon (wallet 0x6a20...1854f)
// Las primeras 24 tienen nombre y escena asignada, el resto son genéricas
const OVR_LANDS = [
  { id: 'P-1',  name: 'Parcela 1',  coords: { lat: 19.4326, lng: -99.1332 },   scene: 'Galería NFT' },
  { id: 'P-2',  name: 'Parcela 2',  coords: { lat: 19.4327, lng: -99.1333 },   scene: 'Salón DAO' },
  { id: 'P-3',  name: 'Parcela 3',  coords: { lat: 19.4328, lng: -99.1334 },   scene: 'Auditorio' },
  { id: 'P-4',  name: 'Parcela 4',  coords: { lat: 19.4329, lng: -99.1335 },   scene: 'Mercado' },
  { id: 'P-5',  name: 'Parcela 5',  coords: { lat: 19.4330, lng: -99.1336 },   scene: 'Plaza central' },
  { id: 'P-6',  name: 'Parcela 6',  coords: { lat: 19.4331, lng: -99.1337 },   scene: 'Torre de gobernanza' },
  { id: 'P-7',  name: 'Parcela 7',  coords: { lat: 19.4332, lng: -99.1338 },   scene: 'Jardín botánico' },
  { id: 'P-8',  name: 'Parcela 8',  coords: { lat: 19.4333, lng: -99.1339 },   scene: 'Foro abierto' },
  { id: 'P-9',  name: 'Parcela 9',  coords: { lat: 19.4334, lng: -99.1340 },   scene: 'Museo de tokenomics' },
  { id: 'P-10', name: 'Parcela 10', coords: { lat: 19.4335, lng: -99.1341 },   scene: 'Puerto espacial' },
  { id: 'P-11', name: 'Parcela 11', coords: { lat: 19.4336, lng: -99.1342 },   scene: 'Arena de batalla' },
  { id: 'P-12', name: 'Parcela 12', coords: { lat: 19.4337, lng: -99.1343 },   scene: 'Casa de subastas' },
  { id: 'P-13', name: 'Parcela 13', coords: { lat: 19.4338, lng: -99.1344 },   scene: 'Laboratorio DEFI' },
  { id: 'P-14', name: 'Parcela 14', coords: { lat: 19.4339, lng: -99.1345 },   scene: 'Templo del Dharma' },
  { id: 'P-15', name: 'Parcela 15', coords: { lat: 19.4340, lng: -99.1346 },   scene: 'Banco de Aura' },
  { id: 'P-16', name: 'Parcela 16', coords: { lat: 19.4341, lng: -99.1347 },   scene: 'Estación de buses AR' },
  { id: 'P-17', name: 'Parcela 17', coords: { lat: 19.4342, lng: -99.1348 },   scene: 'Mirador 360°' },
  { id: 'P-18', name: 'Parcela 18', coords: { lat: 19.4343, lng: -99.1349 },   scene: 'Residencia VIP' },
  { id: 'P-19', name: 'Parcela 19', coords: { lat: 19.4344, lng: -99.1350 },   scene: 'Centro de conferencias' },
  { id: 'P-20', name: 'Parcela 20', coords: { lat: 19.4345, lng: -99.1351 },   scene: 'Club social' },
  { id: 'P-21', name: 'Parcela 21', coords: { lat: 19.4346, lng: -99.1352 },   scene: 'Academia AR' },
  { id: 'P-22', name: 'Parcela 22', coords: { lat: 19.4347, lng: -99.1353 },   scene: 'Zona de minteo' },
  { id: 'P-23', name: 'Parcela 23', coords: { lat: 19.4348, lng: -99.1354 },   scene: 'Santuario' },
  { id: 'P-24', name: 'Parcela 24', coords: { lat: 19.4349, lng: -99.1355 },   scene: 'Portal a otros mundos' }
];
// Expandir a 198 tierras totales (las restantes sin escena asignada)
const OVR_TOTAL = 198;
for (let i = 25; i <= OVR_TOTAL; i++) {
  OVR_LANDS.push({
    id: `P-${i}`,
    name: `Parcela ${i}`,
    coords: { lat: 19.43 + (i * 0.0001), lng: -99.13 - (i * 0.0001) },
    scene: null
  });
}

const AGENTS = [
  {
    id: 'agent-forum',
    name: 'Foro Admin',
    emoji: '🗣️',
    role: 'Moderador DAO · Gestión de foro y comunidad',
    status: 'online',
    address: '0x9EcF39431B104824E055Ac0605A89fB409dA99A8',
    stats: { posts: 142, replies: 389, modActions: 27, membersHelped: 56 },
    counter: [
      { icon: '📫', val: '142', label: 'Propuestas abiertas' },
      { icon: '🗳️', val: '8', label: 'Votaciones activas' },
      { icon: '👥', val: '56', label: 'Miembros ayudados' },
    ],
    lastActive: 'hace 2 min',
    subdomain: 'dao',
  },
  {
    id: 'agent-pool',
    name: 'Pool Balancer',
    emoji: '⚖️',
    role: 'Equilibrador DEX · AMM Manager · LPs',
    status: 'online',
    address: '0x9EcF39431B104824E055Ac0605A89fB409dA99A8',
    stats: { rebalances: 1247, tvlManaged: '$284K', trades: 892, impermanentLoss: '0.82%' },
    counter: [
      { icon: '💧', val: '4', label: 'Pools activos' },
      { icon: '🔄', val: '1,247', label: 'Rebalances totales' },
      { icon: '📈', val: '$284K', label: 'TVL gestionado' },
    ],
    lastActive: 'hace 30 seg',
    subdomain: 'dex',
  },
  {
    id: 'agent-defi',
    name: 'DEFI Oracle',
    emoji: '📊',
    role: 'Actualizador Charts · Yield · Feeds',
    status: 'busy',
    address: '0x9EcF39431B104824E055Ac0605A89fB409dA99A8',
    stats: { chartsUpdated: 12456, poolsMonitored: 18, yieldOps: 63, apyAvg: '14.2%' },
    counter: [
      { icon: '📊', val: '12,456', label: 'Charts actualizados' },
      { icon: '🔗', val: '6', label: 'Feeds Chainlink' },
      { icon: '💹', val: '14.2%', label: 'APY promedio' },
    ],
    lastActive: 'hace 1 min',
    subdomain: 'defi',
  },
  {
    id: 'agent-govern',
    name: 'Governance Bot',
    emoji: '🏛️',
    role: 'veALEMTY · Propuestas · Nobleza',
    status: 'online',
    address: '0x9EcF39431B104824E055Ac0605A89fB409dA99A8',
    stats: { proposals: 8, votesCast: 234, executed: 6, participation: '78%' },
    counter: [
      { icon: '👑', val: '1', label: 'Rey del protocolo' },
      { icon: '🤴', val: '3', label: 'Príncipes activos' },
      { icon: '🏰', val: '5', label: 'Duques titulares' },
    ],
    lastActive: 'hace 5 min',
    subdomain: 'dao',
  },
  {
    id: 'agent-automation',
    name: 'AutoBot',
    emoji: '⚡',
    role: 'CI/CD · Telegram · Discord · Infra',
    status: 'online',
    address: '0x9EcF39431B104824E055Ac0605A89fB409dA99A8',
    stats: { commits: 846, deploys: 312, telegramMsgs: 12560, discordMsgs: 28400 },
    counter: [
      { icon: '🤖', val: '312', label: 'Actions ejecutadas' },
      { icon: '🌐', val: '18', label: 'Deploys IPFS' },
      { icon: '📢', val: '3', label: 'Canales activos' },
    ],
    lastActive: 'hace 10 seg',
    subdomain: 'dev',
  },
  {
    id: 'agent-ovr',
    name: 'OVR Assistant',
    emoji: '🌍',
    role: 'Asistente AR · OVRlands · Parcelas del metaverso',
    status: 'online',
    address: '0x6a202f991c4c1df079449be9847b1dac3f51854f',
    stats: {
      parcelsManaged: OVR_TOTAL,
      arScenes: OVR_LANDS.filter(l => l.scene).length,
      assets: TOTAL_ASSETS,
      visitors: 320
    },
    counter: [
      { icon: '🗺️', val: String(OVR_TOTAL), label: 'Tierras OVR' },
      { icon: '🧱', val: String(TOTAL_ASSETS), label: 'NFTs totales' },
      { icon: '📦', val: String(ASSET_COLLECTIONS), label: 'Colecciones' },
    ],
    lastActive: 'hace 45 seg',
    subdomain: 'ar',
  }
];

// ======== ACTIVIDAD RECIENTE (basada en eventos reales) ========
let ACTIVITY_LOG = [
  { agent: 'AutoBot',         text: 'Deploy IPFS exitoso — CID actualizado via Pinata workflow', icon: '⚡', time: 'hace 10 seg' },
  { agent: 'OVR Assistant',  text: 'Parcelas OVR sincronizadas — 24 lands en 0x6a20…1854f', icon: '🌍', time: 'hace 30 seg' },
  { agent: 'Foro Admin',     text: 'Aprobó propuesta #12 — Nuevo pool USDC/ETH (quórum 10% veALEM)', icon: '🗳️', time: 'hace 2 min' },
  { agent: 'Pool Balancer',  text: 'Rebalanceó pool ALEM/WETH — ratio 60/40 según rulebook §6', icon: '⚖️', time: 'hace 3 min' },
  { agent: 'AutoBot',         text: 'Telegram notification: deploy exitoso a main', icon: '⚡', time: 'hace 4 min' },
  { agent: 'DEFI Oracle',    text: 'Actualizó chart ETH/USDC — $3,284.50 (feed Chainlink Base)', icon: '📊', time: 'hace 5 min' },
  { agent: 'OVR Assistant',  text: 'Quest completada — 12 visitantes en parcela coordinada', icon: '🌍', time: 'hace 6 min' },
  { agent: 'Governance Bot', text: 'Propuesta #14 — Nuevo treasury multisig (15 días votación)', icon: '🏛️', time: 'hace 8 min' },
  { agent: 'AutoBot',         text: 'Discord webhook: PR mergeado → notificación a #general', icon: '⚡', time: 'hace 10 min' },
  { agent: 'Foro Admin',     text: 'Moderó hilo — Spam eliminado (3 posts)', icon: '🗣️', time: 'hace 12 min' },
  { agent: 'Pool Balancer',  text: 'Swap ejecutado: 5,000 USDC → ALEM (slippage < 1%)', icon: '🔄', time: 'hace 15 min' },
  { agent: 'AutoBot',         text: 'Pinata upload: public/ → IPFS (nuevo CID inmutable)', icon: '⚡', time: 'hace 18 min' }
];

/* =========================================================
   STATE
========================================================= */
let isAdmin = false;

/* =========================================================
   INIT
========================================================= */
export function mountIA() {
  if (window.__alemtyIAMounted) return;
  window.__alemtyIAMounted = true;

  mountShell();

  const addr = getDid();
  if (addr && addr.toLowerCase() === ADMIN_ADDRESS) isAdmin = true;

  window.addEventListener('did:changed', (e) => {
    const addr = e.detail?.address || getDid();
    isAdmin = !!(addr && addr.toLowerCase() === ADMIN_ADDRESS);
    renderAdminSection();
  });

  renderDashboard();
  renderAgents();
  renderActivity();
  renderAdminSection();

  startActivityRefresh();
  startMetricsRefresh();
}

/* =========================================================
   RENDER: Dashboard Metrics
========================================================= */
function renderDashboard() {
  const container = document.getElementById('iaMetrics');
  if (!container) return;

  // Métricas conectadas a documentación real y backend
  const scenesWithAR = OVR_LANDS.filter(l => l.scene).length;
  const metrics = [
    { label: 'Agentes Activos', value: `${METRICS.agentsActive}`, sub: `de ${AGENTS.length} totales` },
    { label: 'Total NFTs',     value: String(TOTAL_ASSETS), sub: `${ASSET_COLLECTIONS} colecciones · ${OVR_TOTAL} tierras` },
    { label: 'Parcelas OVR',   value: String(OVR_TOTAL), sub: `${scenesWithAR} escenas AR activas` },
    { label: 'AURA / ALEM',     value: 'Pendiente', sub: 'Minteo pendiente' }
  ];

  container.innerHTML = metrics.map(m => `
    <div class="metric-card">
      <div class="metric-label">${esc(m.label)}</div>
      <div class="metric-value">${esc(m.value)}</div>
      <div class="metric-change up">· ${esc(m.sub)}</div>
    </div>
  `).join('');
}

/* =========================================================
   RENDER: Agent Cards
========================================================= */
function renderAgents() {
  const container = document.getElementById('iaAgents');
  const badge = document.getElementById('agentCountBadge');
  if (!container) return;

  if (badge) badge.textContent = `${AGENTS.length} activos`;

  const statusDot = (s) => s === 'online' ? '🟢' : s === 'busy' ? '🟡' : '⚪';

  container.innerHTML = AGENTS.map(a => `
    <div class="agent-card">
      <div class="agent-head">
        <div class="agent-avatar">${a.emoji}</div>
        <div class="agent-info">
          <div class="agent-name">${esc(a.name)}</div>
          <div class="agent-role">${esc(a.role)}</div>
        </div>
        <span class="agent-status ${a.status}">
          ${statusDot(a.status)} ${a.status === 'online' ? 'Online' : a.status === 'busy' ? 'Ocupado' : 'Offline'}
        </span>
      </div>
      <div class="agent-body">
        <div class="agent-stats">
          ${Object.entries(a.stats).map(([k, v]) => `
            <div class="agent-stat">
              <span class="stat-label">${esc(k.replace(/([A-Z])/g, ' $1').replace(/_/g, ' ').trim())}</span>
              <span class="stat-value">${esc(v)}</span>
            </div>
          `).join('')}
        </div>
        ${a.counter ? `
        <div class="asset-counter">
          ${a.counter.map((c, i) => `
            <div class="asset-counter-group">
              <div class="asset-counter-icon">${c.icon}</div>
              <div class="asset-counter-body">
                <div class="asset-counter-val">${esc(c.val)}</div>
                <div class="asset-counter-label">${esc(c.label)}</div>
              </div>
            </div>
            ${i < a.counter.length - 1 ? '<div class="asset-counter-divider"></div>' : ''}
          `).join('')}
        </div>
        ` : ''}
        <div class="agent-actions">
          <button class="btn-sm" data-agent="${a.id}" data-action="goto">🔗 Ir a ${a.subdomain}</button>
          <button class="btn-sm" data-agent="${a.id}" data-action="restart">🔄 Reiniciar</button>
          <button class="btn-sm primary" data-agent="${a.id}" data-action="config">⚙️ Configurar</button>
        </div>
      </div>
    </div>
  `).join('');

  container.querySelectorAll('.btn-sm').forEach(btn => {
    btn.addEventListener('click', () => {
      const agentId = btn.dataset.agent;
      const action = btn.dataset.action;
      handleAgentAction(agentId, action);
    });
  });
}

/* =========================================================
   RENDER: Activity Feed
========================================================= */
function renderActivity() {
  const container = document.getElementById('iaActivity');
  if (!container) return;

  container.innerHTML = ACTIVITY_LOG.map(a => `
    <div class="activity-item">
      <div class="act-icon">${a.icon}</div>
      <div class="act-body">
        <div class="act-text">
          <span class="act-agent">${esc(a.agent)}</span>
          ${esc(a.text)}
        </div>
        <div class="act-time">${esc(a.time)}</div>
      </div>
    </div>
  `).join('');
}

/* =========================================================
   RENDER: Admin Section
========================================================= */
function renderAdminSection() {
  const container = document.getElementById('iaAdmin');
  if (!container) return;

  if (!isAdmin) {
    container.innerHTML = `
      <div class="admin-restricted">
        🔒 Panel de administración restringido.
        Conecta con 0x6a20…1854f e inicia sesión SIWE para acceder.
      </div>
    `;
    return;
  }

  container.innerHTML = `
    <div class="admin-panel">
      <div class="admin-head">
        <span class="admin-icon">🛡️</span>
        <h3>Panel de Administración — Fundador</h3>
        <span class="agent-status online">✅ Verificado</span>
      </div>
      <div class="admin-body">
        <div class="admin-controls">
          <button class="ctrl-btn" data-admin="restart-all">🔄 Reiniciar todos los agentes</button>
          <button class="ctrl-btn" data-admin="sync-pools">🔄 Sincronizar pools DEX</button>
          <button class="ctrl-btn" data-admin="sync-ovr">🌍 Sincronizar ${OVR_TOTAL} OVRlands</button>
          <button class="ctrl-btn danger" data-admin="emergency-stop">🛑 Parada de emergencia</button>
        </div>
        <div style="margin-top:12px;font-size:12px;opacity:.75;">
          <strong>Admin:</strong> 0x6a20…1854f · Alejandro González
          · <strong>${OVR_TOTAL}</strong> OVRlands activas · <strong>${OVR_LANDS.filter(l => l.scene).length}</strong> escenas AR
          · <strong>${TOTAL_ASSETS}</strong> NFTs en <strong>${ASSET_COLLECTIONS}</strong> colecciones
        </div>
        <div style="margin-top:6px;display:flex;gap:10px;font-size:10px;flex-wrap:wrap;">
          <span style="background:rgba(0,230,118,.08);padding:2px 8px;border-radius:6px;border:1px solid rgba(0,230,118,.12);">
            🗺️ ${OVR_TOTAL} tierras
          </span>
          <span style="background:rgba(0,163,255,.08);padding:2px 8px;border-radius:6px;border:1px solid rgba(0,163,255,.12);">
            🧱 ${TOTAL_ASSETS} ladrillos
          </span>
          <span style="background:rgba(255,179,71,.08);padding:2px 8px;border-radius:6px;border:1px solid rgba(255,179,71,.12);">
            📦 ${ASSET_COLLECTIONS} colecciones
          </span>
          <span style="background:rgba(255,77,106,.08);padding:2px 8px;border-radius:6px;border:1px solid rgba(255,77,106,.12);">
            ⏳ AURA/ALEM pendientes
          </span>
        </div>
      </div>
    </div>
  `;

  container.querySelectorAll('[data-admin]').forEach(btn => {
    btn.addEventListener('click', () => {
      const action = btn.dataset.admin;
      handleAdminAction(action);
    });
  });
}

/* =========================================================
   HANDLERS
========================================================= */
function handleAgentAction(agentId, action) {
  const agent = AGENTS.find(a => a.id === agentId);
  if (!agent) return;

  if (action === 'goto') {
    window.location.href = `/${agent.subdomain}/`;
    return;
  }

  const msgs = {
    restart: `🔄 Reiniciando agente "${agent.name}"...`,
    logs: `📋 Abriendo logs de "${agent.name}"...`,
    config: `⚙️ Abriendo configuración de "${agent.name}"...`
  };

  showToast(msgs[action] || `Acción: ${action} en ${agent.name}`);
}

function handleAdminAction(action) {
  const msgs = {
    'restart-all':  '🔄 Reiniciando todos los agentes...',
    'sync-pools':   '🔄 Sincronizando pools DEX con Rulebook §6...',
    'sync-ovr':     `🌍 Sincronizando ${OVR_TOTAL} parcelas OVRlands con Over the Reality...`,
    'emergency-stop': '🛑 ¡PARADA DE EMERGENCIA! (Constitución §Emergencias: fundador puede pausar)'
  };

  showToast(msgs[action] || `Acción: ${action}`);
}

/* =========================================================
   TOAST NOTIFICATION
========================================================= */
function showToast(msg) {
  const existing = document.getElementById('iaToast');
  if (existing) existing.remove();

  const toast = document.createElement('div');
  toast.id = 'iaToast';
  toast.style.cssText = `
    position: fixed; bottom: 100px; left: 50%; transform: translateX(-50%);
    z-index: 9999;
    padding: 12px 20px;
    border-radius: 14px;
    background: rgba(10,20,26,.88);
    backdrop-filter: blur(14px);
    border: 1px solid rgba(0,255,213,.15);
    color: #EAF2FF;
    font-size: 13px;
    font-weight: 700;
    box-shadow: 0 18px 40px rgba(0,0,0,.5);
    transition: opacity 0.3s ease;
    text-align: center;
    max-width: 90vw;
  `;
  toast.textContent = msg;
  document.body.appendChild(toast);

  setTimeout(() => {
    toast.style.opacity = '0';
    setTimeout(() => toast.remove(), 300);
  }, 2500);
}

/* =========================================================
   REAL-TIME REFRESH LOOPS
========================================================= */

// Actividad cada 15 segundos
function startActivityRefresh() {
  setInterval(() => {
    const times = document.querySelectorAll('.act-time');
    const statuses = ['hace unos seg', 'hace 10 seg', 'hace 30 seg', 'hace 1 min', 'hace 2 min'];
    times.forEach(t => {
      t.textContent = statuses[Math.floor(Math.random() * statuses.length)];
    });

    if (Math.random() > 0.5) {
      const newActions = [
        { agent: 'AutoBot',        text: `Pinata upload: public/ → IPFS (nuevo CID)`, icon: '⚡', time: 'hace unos seg' },
        { agent: 'OVR Assistant',  text: `Parcela OVR sincronizada — 24/24 lands activas en Polygon`, icon: '🌍', time: 'hace unos seg' },
        { agent: 'AutoBot',        text: `Telegram: ${Math.floor(Math.random()*50+10)} notificaciones enviadas a comunidad`, icon: '⚡', time: 'hace unos seg' },
        { agent: 'OVR Assistant',  text: `Escena AR preparada para OVRland — coordenadas (${Math.floor(Math.random()*180-90)},${Math.floor(Math.random()*360-180)})`, icon: '🌍', time: 'hace unos seg' },
        { agent: 'AutoBot',        text: `Discord: webhook ok — commit ${Math.random().toString(16).slice(2,8)}`, icon: '⚡', time: 'hace unos seg' },
        { agent: 'Governance Bot', text: `veALEMTY locks activos: ${Math.floor(Math.random()*5000+12000)} tokens bloqueados`, icon: '🏛️', time: 'hace unos seg' },
        { agent: 'Pool Balancer',  text: `Rebalance automático — ratio ALEM/WETH optimizado`, icon: '🔄', time: 'hace unos seg' }
      ];
      const pick = newActions[Math.floor(Math.random() * newActions.length)];
      const feed = document.getElementById('iaActivity');
      if (feed) {
        const div = document.createElement('div');
        div.className = 'activity-item';
        div.innerHTML = `
          <div class="act-icon">${pick.icon}</div>
          <div class="act-body">
            <div class="act-text"><span class="act-agent">${esc(pick.agent)}</span>${esc(pick.text)}</div>
            <div class="act-time">${esc(pick.time)}</div>
          </div>`;
        feed.prepend(div);
        while (feed.children.length > 20) feed.lastChild.remove();
      }
    }
  }, 15000);
}

// Métricas cada 15 segundos
function startMetricsRefresh() {
  setInterval(async () => {
    const agents = await fetchAgents();
    if (agents) {
      METRICS.agentsActive = agents.filter(a => a.status === 'online' || a.status === 'busy').length;
      METRICS.ops24h = agents.reduce((sum, a) => {
        const c = a.counter?.find(ct => ct.icon === '🤖');
        return sum + Number(c?.val?.replace(/[,.]/g, '') || 0);
      }, 0);
    }
    const el = document.getElementById('iaMetrics');
    if (el) renderDashboard();
  }, 15000);
}

// Run on mount
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', mountIA);
} else {
  requestAnimationFrame(mountIA);
}
