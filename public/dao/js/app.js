
import { mountShell } from '/shared/js/shell.js';
mountShell();

// =========================
// API base (DEV vs PROD)
// =========================
const isENS = location.hostname.endsWith(".eth.limo");
const isLocal =
  location.hostname === "localhost" ||
  location.hostname === "127.0.0.1";

const isPages = location.hostname.endsWith(".pages.dev");
const isWorkers = location.hostname.endsWith(".workers.dev");

// ✅ endpoints
const API_WORKER_LOCAL = "http://127.0.0.1:8788"; // API local (wrangler dev)
const API_WORKER_REMOTE = "https://alemtydao.alejandrogtzz93.workers.dev"; // prod

// ✅ mantenemos compat si algo usa API_WORKER
const API_WORKER = API_WORKER_REMOTE;

// ✅ regla:
// - Si estás en Workers (mismo origin), usa "" (rutas relativas)
// - En local: API local
// - En ENS/Pages/otros: API remoto
const API_BASE = isWorkers ? "" : (isLocal ? API_WORKER_LOCAL : API_WORKER_REMOTE);



// JWT (guardado por SIWE)
function getJWT() {
  return localStorage.getItem("alemty.jwt") || "";
}

function authHeaders(extra = {}) {
  const jwt = getJWT();
  return {
    "content-type": "application/json",
    ...(jwt ? { Authorization: `Bearer ${jwt}` } : {}),
    ...extra,
  };
}

function authHeadersGet(extra = {}) {
  const jwt = getJWT();
  return {
    ...(jwt ? { Authorization: `Bearer ${jwt}` } : {}),
    ...extra,
  };
}

// ✅ Access info (backend manda)
// Requiere que el backend exponga:
// GET /api/rooms/:name/access?type=backroom|governance (con auth JWT)
async function getRoomAccess(name, type) {
  try {
    const token = localStorage.getItem("alemty.jwt");
    if (!token) return { access: false, visibility: "private", role: "" };

    const url = `${API_BASE}/api/rooms/${encodeURIComponent(name)}/access?type=${encodeURIComponent(type)}`;
    const res = await fetch(url, {
      headers: { Authorization: "Bearer " + token },
      cache: "no-store",
    });

    const data = await res.json().catch(() => ({}));
    return {
      access: data?.access === true,
      visibility: String(data?.visibility || "private").toLowerCase(),
      role: String(data?.role || ""),
    };
  } catch (e) {
    console.warn("getRoomAccess error:", e);
    return { access: false, visibility: "private", role: "" };
  }
}


async function readErr(r) {
  const ct = r.headers.get('content-type') || '';
  if (ct.includes('application/json')) {
    const j = await r.json().catch(() => null);
    return j?.error || j?.message || null;
  }
  const t = await r.text().catch(() => '');
  return t || null;
}


function normAddr(a) {
  return String(a || '').trim().toLowerCase();
}



function getViewerAddress() {
  // 1) Preferidos: DID/address guardados por el flujo SIWE del shell
  const did = localStorage.getItem('alemty.did') || localStorage.getItem('did');
  if (did) return normAddr(did);

  // 2) Compat: si en algún punto guardas address explícito
  const a = localStorage.getItem('alemty.address');
  if (a) return normAddr(a);

  // 3) Fallback: getUserId (si existe y trae address)
  const u = getUserId?.() || '';
  if (u && u !== 'visitor') return normAddr(u);

  return 'visitor';
}




function isOwnerPost(p) {
  const me = getViewerAddress();
  const author = normAddr(p?.author);
  return me !== 'visitor' && !!author && me === author;
}


function hasAuth() {
  return !!getJWT();
}


// Adaptador: backend -> schema UI
function mapPostFromApi(p) {
  const ts = p?.created_at ? Date.parse(p.created_at) : Date.now();

  const commentsCount =
    typeof p?.comments === "number"
      ? p.comments
      : Array.isArray(p?.comments)
      ? p.comments.length
      : Number(p?.commentsCount || 0);

  return {
    id: String(p?.id ?? ""),
    author: p?.author || null,
    title: p?.title || "",
    body: p?.body || "",
    topic: p?.topic || "Sin tema",
    ts: Number.isFinite(ts) ? ts : Date.now(),
    likes: Number(p?.likes || 0),
    points: Number(p?.points || 0),
    myLike: !!p?.myLike,
    myPoints: Number(p?.myPoints ?? 0),
    commentsCount,
    comments: Array.isArray(p?.comments) ? p.comments : [],
    created_at: p?.created_at || null,
  };
}

const API = {
  async getPosts() {
    
  const r = await fetch(`${API_BASE}/api/posts`, {
  cache: "no-store",
  headers: authHeadersGet(),
  });

    if (!r.ok) throw new Error("getPosts failed");
    const data = await r.json().catch(() => ({}));
    const arr = Array.isArray(data?.posts) ? data.posts : [];
    return arr.map(mapPostFromApi);
  },
  

async updatePost(postId, { title, body, topic }) {
  const r = await fetch(`${API_BASE}/api/posts/${postId}`, {
    method: "PUT",
    headers: authHeaders(),
    body: JSON.stringify({ title, body, topic }),
  });
  
if (!r.ok) {
  const msg = await readErr(r);
  throw new Error(msg || 'updatePost failed');
}

  return r.json().catch(() => ({}));
},

async deletePost(postId) {
  const r = await fetch(`${API_BASE}/api/posts/${postId}`, {
    method: "DELETE",
    headers: authHeaders(),
  });
  if (!r.ok) {
    const msg = await readErr(r);
    throw new Error(msg || 'deletePost failed');
  }
  return r.json().catch(() => ({}));
},

async reportPost(postId, reason) {
  const r = await fetch(`${API_BASE}/api/posts/${postId}/report`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify({ reason: String(reason || "").trim() }),
  });
if (!r.ok) {
  const msg = await readErr(r);
  throw new Error(msg || 'reportPost failed');
}
  return r.json().catch(() => ({}));
},


async reactComment(postId, commentId, type) {
  const norm = type === "points" ? "point" : type;
  const r = await fetch(`${API_BASE}/api/posts/${postId}/comments/${commentId}/react`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify({ type: norm }),
  });
  if (!r.ok) throw new Error("reactComment failed");
  return r.json().catch(() => ({}));
},


  // ✅ Trae post + comentarios reales (y anida replies)
  async getPost(postId) {
    // 1) Post
    
const r = await fetch(`${API_BASE}/api/posts/${postId}`, {
  cache: "no-store",
  headers: authHeadersGet(),
});

    if (!r.ok) throw new Error("getPost failed");
    const data = await r.json().catch(() => ({}));
    const base = data?.post ? data.post : data;

    const post = mapPostFromApi(base);

    // 2) Comments reales
    let rawComments = [];
    try {
      
const cr = await fetch(`${API_BASE}/api/posts/${postId}/comments`, {
  cache: "no-store",
  headers: authHeadersGet(),
});

      if (cr.ok) {
        const cdata = await cr.json().catch(() => ({}));
        rawComments = Array.isArray(cdata?.comments) ? cdata.comments : [];
      }
    } catch {
      rawComments = [];
    }

    // 3) Map a schema UI (comentarios planos)
    
const mapped = rawComments.map((c) => {
  const id = c?.id != null ? String(c.id) : (crypto.randomUUID?.() || String(Math.random()));
  const ts = c?.created_at ? Date.parse(c.created_at) : Date.now();
  return {
    id,
    ts: Number.isFinite(ts) ? ts : Date.now(),
    text: String(c?.body || ""),
    // ✅ AQUÍ estaba el bug: estabas forzando 0
    likes: Number(c?.likes || 0),
    points: Number(c?.points || 0),
    myLike: !!c?.myLike,
    myPoints: Number(c?.myPoints ?? 0),
    replies: [],
    author: c?.author || null,
  };
});


    // 4) Reagrupar replies bajo su comment padre:
    //    Tu UI manda replies como: "↪️ reply(c:<commentId>) <texto>"
    const byId = Object.create(null);
    for (const c of mapped) byId[String(c.id)] = c;

    const topLevel = [];
    for (const c of mapped) {
      const m = c.text.match(/^↪️\s*reply\(c:([^)]+)\)\s*/);
      if (m) {
        const parentId = String(m[1]);
        const parent = byId[parentId];

        // quita prefijo
        c.text = c.text.replace(m[0], "").trim();

        if (parent) {
          parent.replies = parent.replies || [];
          

parent.replies.push({
  id: c.id,
  ts: c.ts,
  text: c.text,
  likes: c.likes,
  points: c.points,
  myLike: !!c.myLike,
  myPoints: Number(c.myPoints ?? 0),
  author: c.author ?? null, // ✅ FIX: conservar autor
});


          continue; // NO va como top-level
        }
        // si el padre no existe, cae como top-level
      }
      topLevel.push(c);
    }

    post.comments = topLevel;
    post.commentsCount = topLevel.length;

    return post;
  },

  async createPost({ title, body, topic }) {
    const r = await fetch(`${API_BASE}/api/posts`, {
      method: "POST",
      headers: authHeaders(),
      body: JSON.stringify({ title, body, topic }),
    });
    if (!r.ok) throw new Error("createPost failed");
    const data = await r.json().catch(() => ({}));
    return data?.post ? mapPostFromApi(data.post) : null;
  },

  async react(postId, type) {
    const norm = type === "points" ? "point" : type; // compat
    const r = await fetch(`${API_BASE}/api/posts/${postId}/react`, {
      method: "POST",
      headers: authHeaders(),
      body: JSON.stringify({ type: norm }),
    });
    if (!r.ok) throw new Error("react failed");
    return r.json().catch(() => ({}));
  },

  async addComment(postId, body) {
    const r = await fetch(`${API_BASE}/api/posts/${postId}/comments`, {
      method: "POST",
      headers: authHeaders(),
      body: JSON.stringify({ body }),
    });
    if (!r.ok) throw new Error("addComment failed");
    return r.json().catch(() => ({}));
  },
};




/* =========================
   DB local (demo)
========================= */
const DB_KEY = 'alemty.dao.posts.v1';
const ROOMS_KEY = 'alemty.dao.rooms.v1';
const TOPICS_KEY = 'alemty.dao.topics.v1';

// =========================
// Rooms (Backrooms + Gobernanza) — Keys
// =========================
const GOV_ROOMS_KEY = 'alemty.dao.govrooms.v1';
const BACKROOMS_KEY = 'alemty.dao.backrooms.v1'; // <- nuevo (separa de ROOMS_KEY legacy)

const DEFAULT_TOPIC_GROUPS = [
  {
    label: '🌐 WEB3 & TECNOLOGÍA',
    items: [
      '🤖 IA & Agentes Autónomos',
      '🧑‍💻 Dev & Herramientas IA (GPT/Copilot/Claude)',
      '🧱 Web3, Smart Contracts & Infraestructura DAO',
      '🧾 Tokenomics, Incentivos & Gobernanza',
      '🪪 ENS v2 & Identidad Descentralizada (DID/VC)',
      '🧿 zkID, Pruebas de Persona & Privacidad',
      '💧 DeFi: Lending, Stablecoins & Yield',
      '🔁 DEX & AMMs (Pools, LP, Fees, Slippage)',
      '🌉 L2 / Rollups & OP Stack (Base, Optimism)',
      '🧰 Wallets, Account Abstraction (ERC-4337) & Onboarding',
      '📈 Oráculos, Indexing (The Graph) & Data Pipelines',
      '🧲 MEV, Mempool, Sandwich & Protección',
      '🛰️ DePIN, Infra Física & Redes Comunitarias',
      '🧬 Ciencia Descentralizada (DeSci)',
      '🐧 Sistemas, Kernels & Código Abierto',
      '📡 Hardware Libre & Telecomunicaciones',
      '🔐 Criptografía & Ciberseguridad',
    ]
  },
  {
    label: '🩺 BIOHACKING, SALUD & NUTRICIÓN',
    items: [
      '🧑‍⚕️ Medicina, Longevidad & Optimización Humana',
      '⚡ Bioenergética, Meridianos & Interferencias',
      '🥩 Nutrición Evolutiva & Protocolos Metabólicos',
      '🍳 Cocina & Preparación',
      '🧠 Salud Mental, Neuroplasticidad & Sueño',
      '🌿 Fitoterapia & Medicina Herbal',
    ],
  },
  {
    label: '🏛️ FILOSOFÍA, CONTRACULTURA & HISTORIA',
    items: [
      '🧠 Filosofía & Metafísica',
      '🔮 Gnosticismo, Hermetismo & Teología',
      '🗿 Historia Alternativa & Arqueología Prohibida',
      '🧿 Mitología Comparada & Simbología Antigua',
      '🎛️ Arte Digital, Glitch & Estética Cyberpunk',
      '📐 Arquitectura, Geometría Sagrada & Diseño Espacial',
      '🎚️ Música 432hz & Sintetizadores',
    ],
  },
  {
    label: '🔨 SOBERANÍA, DIY & HÁBITAT',
    items: [
      '🧰 DIY & Inteligencia Colectiva',
      '🏗️ Construcción, Hidráulica & Hogar',
      '🌱 Botánica, Árboles & Agricultura Urbana',
      '🕸️ Soberanía Digital, Privacidad & Redes Mesh',
      '🔋 Off-Grid & Energía Autosustentable',
      '🪙 Finanzas Personales, Oro & Activos Refugio',
    ],
  },
  {
    label: '🕹️ ENTRETENIMIENTO & CULTURA POP',
    items: [
      '🎮 Gaming, MMORPGs & Mecánicas',
      '🕹️ Emulación, Retro-Gaming & Modding',
      '🎬 Cine, Anime, Manga & Lore',
      '🖥️ Hardware Enthusiast, OC & Setups',
    ],
  },
  {
    label: '☕ COMUNIDAD',
    items: [
      '☕ Off-Topic — El Café de la DAO',
      '🧨 Memes & Shitposting',
      '🤝 Presentaciones & Networking',
      '🗣️ Anécdotas, Debates & Clasificados',
    ],
  },
];

function loadTopicsModel(){
  const raw = loadJSON(TOPICS_KEY, null);

  // ✅ si ya es formato nuevo
  if (raw && typeof raw === 'object' && Array.isArray(raw.groups)) {
    return raw;
  }

  // 🚨 si es legacy → MIGRAR a nuevo modelo
  if (Array.isArray(raw)) {
    console.log('Migrando topics legacy → nuevo modelo');

    const model = {
      version: 2,
      groups: DEFAULT_TOPIC_GROUPS
    };

    saveJSON(TOPICS_KEY, model);
    return model;
  }

  // ✅ si no hay nada → usar nuevos
  return {
    version: 2,
    groups: DEFAULT_TOPIC_GROUPS
  };
}

function saveTopicsModel(model){
  saveJSON(TOPICS_KEY, model);
}

function loadJSON(key, fallback){
  try{
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  }catch{
    return fallback;
  }
}

function saveJSON(key, value){
  localStorage.setItem(key, JSON.stringify(value));
}

function uid(){
  return Math.random().toString(16).slice(2) + Date.now().toString(16);
}

function now(){ return Date.now(); }

function fmt(ts){
  const d = new Date(ts);
  return d.toLocaleString('es-MX', {
    year:'numeric', month:'short', day:'2-digit', hour:'2-digit', minute:'2-digit'
  });
}

function shortHex(addr, start = 6, end = 4){
  const a = String(addr || '');
  if (!a) return '—';
  if (a.length <= start + end) return a;
  return `${a.slice(0, start)}…${a.slice(-end)}`;
}

// (FASE 3) Por ahora no tienes ENS real en posts; si luego lo agregas,
// aquí decides si muestra .eth o 0x...
function displayAuthor(addr){
  return shortHex(String(addr || '').toLowerCase());
}

// HTML del link del autor (clickable)
// ⚠️ requiere esc() definido en tu app.js (ya existe más abajo) 【1-9fbb90】
function authorLinkHTML(addr){
  const full = String(addr || '').toLowerCase();
  const label = displayAuthor(full);
  return `<a href="#" class="post-author-link" data-profile-open="${esc(full)}">${esc(label)}</a>`;
}

/* =========================================================
   ✅ FASE 3.5 — Invitación opción A (SIN backend)
   - Address Book local: ENS/DID/alias -> 0x...
   - Genera SQL y comando wrangler para meter a room_members
   - La “autorización” real sigue siendo: owner/founder (canManage) en UI.
========================================================= */

const ADDRESSBOOK_KEY = "alemty.addressbook.v1";

function loadAddressBook(){
  return loadJSON(ADDRESSBOOK_KEY, {});
}

function saveAddressBook(book){
  saveJSON(ADDRESSBOOK_KEY, book || {});
}

function isHexAddress(s){
  const v = String(s || "").trim();
  return /^0x[a-fA-F0-9]{40}$/.test(v);
}

/**
 * input puede ser:
 * - 0x... (directo)
 * - xxx.eth / DID / alias (buscado en AddressBook local)
 */
function resolveInviteTarget(input){
  const raw = String(input || "").trim();
  if (!raw) return { ok:false, kind:"empty", address:"" };

  if (isHexAddress(raw)) {
    return { ok:true, kind:"address", address: raw.toLowerCase() };
  }

  const key = raw.toLowerCase();
  const book = loadAddressBook();
  const addr = book[key];

  if (isHexAddress(addr)) {
    return { ok:true, kind:"alias", address: String(addr).toLowerCase() };
  }

  return { ok:false, kind:"unknown", address:"" };
}

function buildInviteSQL({ roomName, roomType, address, role="member" }){
  const escSql = (s) => String(s || "").replace(/'/g, "''");
  return `INSERT OR IGNORE INTO room_members(room_id,address,role)
SELECT id, '${escSql(address)}', '${escSql(role)}'
FROM rooms
WHERE name='${escSql(roomName)}' AND type='${escSql(roomType)}'
LIMIT 1;`;
}

function buildRevokeSQL({ roomName, roomType, address }){
  const escSql = (s) => String(s || "").replace(/'/g, "''");
  return `DELETE FROM room_members
WHERE address='${escSql(address)}'
  AND room_id=(SELECT id FROM rooms WHERE name='${escSql(roomName)}' AND type='${escSql(roomType)}' LIMIT 1);`;
}

function buildWranglerCmd({ remote=false, sql }){
  const flag = remote ? "--remote" : "--local";
  const oneLine = String(sql || "").replace(/\s+/g, " ").trim();
  return `npx wrangler d1 execute DB ${flag} --command "${oneLine}"`;
}

async function copyText(txt){
  try { await navigator.clipboard.writeText(String(txt || "")); return true; }
  catch { return false; }
}

function kebabMenuHTML(p) {
  const rawId = String(p?.id || '');
  const escId = esc(rawId);

  const canEdit = isOwnerPost(p);
  const canDelete = isOwnerPost(p); // (admin lo agregas luego si expones rol)
  const canReport = hasAuth() && !isOwnerPost(p);

  const items = [
    canEdit
      ? `<button class="kebab-item" type="button" data-kebab-item="1" data-kebab-action="edit" data-post-id="${rawId}">✏️ Editar</button>`
      : '',
    canDelete
      ? `<button class="kebab-item" type="button" data-kebab-item="1" data-kebab-action="delete" data-post-id="${rawId}">🗑️ Eliminar</button>`
      : '',
    canReport
      ? `<button class="kebab-item" type="button" data-kebab-item="1" data-kebab-action="report" data-post-id="${rawId}">🚩 Reportar</button>`
      : '',
  ].filter(Boolean).join('');

  return `
    <div class="kebab-menu" data-kebab-menu="${escId}" hidden>
      ${items || `<button class="kebab-item" type="button" disabled>Sin acciones</button>`}
    </div>
  `;
}

function commentKebabMenuHTML({ postId, comment, isReply = false, parentId = null }) {
  const rawId = String(comment?.id || '');
  const escId = esc(rawId);

  const me = getViewerAddress();
  const author = normAddr(comment?.author);
  const isOwner = me !== 'visitor' && author && me === author;

  const canEdit = isOwner;
  const canDelete = isOwner;
  const canReport = hasAuth() && !isOwner;

  const items = [
    canEdit
      ? `<button class="kebab-item" type="button"
          data-kebab-item="1"
          data-kebab-action="c-edit"
          data-post-id="${postId}"
          data-comment-id="${rawId}"
          ${isReply ? `data-reply-id="${rawId}" data-parent-id="${parentId}"` : ''}>
          ✏️ Editar
        </button>`
      : '',
    canDelete
      ? `<button class="kebab-item" type="button"
          data-kebab-item="1"
          data-kebab-action="c-delete"
          data-post-id="${postId}"
          data-comment-id="${rawId}"
          ${isReply ? `data-reply-id="${rawId}" data-parent-id="${parentId}"` : ''}>
          🗑️ Eliminar
        </button>`
      : '',
    canReport
      ? `<button class="kebab-item" type="button"
          data-kebab-item="1"
          data-kebab-action="c-report"
          data-post-id="${postId}"
          data-comment-id="${rawId}">
          🚩 Reportar
        </button>`
      : '',
  ].filter(Boolean).join('');

  return `
    <div class="kebab-menu" data-kebab-menu="${escId}" hidden>
      ${items || `<button class="kebab-item" type="button" disabled>Sin acciones</button>`}
    </div>
  `;
}



// =========================
// Kebab UI (FASE 4.1)
// =========================

function closeAllKebabs(){
  document.querySelectorAll('[data-kebab-menu]').forEach(m => {
    m.hidden = true;
    m.style.display = 'none'; // ✅ fuerza por si CSS anula hidden
  });
}




function toggleKebabFromButton(btn){
  const host =
    btn.closest('.comment') ||
    btn.closest('[data-open-post]') ||
    btn.closest('.car-card') ||
    btn.closest('#latestCard') ||
    btn.closest('.mini') ||
    btn.closest('.sheet-item') ||
    btn.parentElement;

  if(!host) return;

  const menu = host.querySelector('[data-kebab-menu]');
  if(!menu) return;

  const isOpen = !menu.hidden;

  // Cierra todo primero (con display:none forzado)
  closeAllKebabs();

  // Si estaba cerrado, abrir este
  if (!isOpen) {
    menu.hidden = false;
    menu.style.display = ''; // ✅ limpia inline para que CSS controle
  }
}



// =========================
// Comentarios (schema + helpers)
// =========================
const UI_KEY = 'alemty.dao.ui.v1'; // guarda UI state (reply target, expand)
function loadUI(){ return loadJSON(UI_KEY, { replyTo:null, expand:{} }); }
function saveUI(v){ saveJSON(UI_KEY, v); }

function ensureCommentSchema(c){
  if (!c || typeof c !== 'object') return null;
  return {
    id: c.id ?? uid(),
    ts: c.ts ?? now(),
    text: c.text ?? '',
    likes: Number(c.likes ?? 0),
    points: Number(c.points ?? 0),
    myLike: !!c.myLike,
    myPoints: Number(c.myPoints ?? 0),
    author: c.author ?? null, // ✅ FIX: conservar autor
    replies: Array.isArray(c.replies)
      ? c.replies.map(r => ({
          id: r.id ?? uid(),
          ts: r.ts ?? now(),
          text: r.text ?? '',
          likes: Number(r.likes ?? 0),
          points: Number(r.points ?? 0),
          myLike: !!r.myLike,
          myPoints: Number(r.myPoints ?? 0),
          author: r.author ?? null, // ✅ FIX: conservar autor en replies
        }))
      : []
  };
}


function ensurePostSchema(p){
  if (!p || typeof p !== 'object') return p;

  const commentsCount =
    typeof p.comments === "number"
      ? p.comments
      : Array.isArray(p.comments)
      ? p.comments.length
      : Number(p.commentsCount || 0);

  const commentsArr = Array.isArray(p.comments)
    ? p.comments.map(ensureCommentSchema).filter(Boolean)
    : [];

  return { ...p, comments: commentsArr, commentsCount };
}

function findComment(p, commentId){
  if (!p || !Array.isArray(p.comments)) return null;
  return p.comments.find(c => String(c.id) === String(commentId)) || null;
}

// ✅ Escape HTML correcto (evita XSS y NO rompe sintaxis)
function esc(s){
  return String(s ?? '').replace(/[&<>"']/g, (ch) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  }[ch]));
}





/* =========================
   Modal
========================= */
function openModal(){
  const m = document.getElementById('daoModal');
  if(!m) return;
  m.classList.add('open');
  m.setAttribute('aria-hidden','false');
}

function closeModal(){
  const m = document.getElementById('daoModal');
  if(!m) return;
  m.classList.remove('open');
  m.setAttribute('aria-hidden','true');
}

async function openEditPostModal(postId) {
  let p = null;
  try {
    p = await API.getPost(String(postId));
  } catch {}

  const post = p || CURRENT_MODAL_POST;
  if (!post) return;

  const topic = String(post.topic || 'Sin tema');
  const title = String(post.title || '');
  const body  = String(post.body || '');

  document.getElementById('daoModalTitle').textContent = 'Editar post';
  document.getElementById('daoModalBody').innerHTML = `
  
    <div class="sheet-item">
      <div class="t">Título</div>
      <input id="editPostTitle" value="${esc(title)}" />
    </div>
    <div class="sheet-item">
      <div class="t">Tema</div>
      <input id="editPostTopic" value="${esc(topic)}" />
      <div class="small muted" style="margin-top:6px;">Puedes escribir un tema o dejar “Sin tema”.</div>
    </div>
    <div class="sheet-item">
      <div class="t">Contenido</div>
      <textarea id="editPostBody" style="min-height:140px;">${esc(body)}</textarea>
    </div>
    <div style="margin-top:12px;display:flex;gap:10px;flex-wrap:wrap;">
      <button class="btn primary" type="button" data-post-save="${esc(String(postId))}">Guardar</button>
      <button class="btn" type="button" data-close="1">Cancelar</button>
    </div>
    <div id="editPostStatus" class="small muted" style="margin-top:10px;"></div>
  `;
  openModal();
}



async function openDeletePostModal(postId) {
  document.getElementById('daoModalTitle').textContent = 'Eliminar post';
  document.getElementById('daoModalBody').innerHTML = `
    <div class="sheet-item">
      <div class="t">Confirmación</div>
      <div class="m">¿Seguro que quieres eliminar este post? Esta acción no se puede deshacer.</div>
    </div>
    <div style="margin-top:12px;display:flex;gap:10px;flex-wrap:wrap;">
      <button class="btn" type="button" data-close="1">Cancelar</button>
      <button class="btn primary" type="button" data-post-delete-confirm="${esc(String(postId))}">Sí, eliminar</button>
    </div>
    <div id="deletePostStatus" class="small muted" style="margin-top:10px;"></div>
  `;
  openModal();
}


async function openReportPostModal(postId) {
  document.getElementById('daoModalTitle').textContent = 'Reportar post';
  document.getElementById('daoModalBody').innerHTML = `
    <div class="sheet-item">
      <div class="t">Motivo</div>
      <textarea id="reportPostReason" style="min-height:110px;" placeholder="Describe el motivo del reporte…"></textarea>
      <div class="small muted" style="margin-top:6px;">Evita datos personales. Sé breve y claro.</div>
    </div>
    <div style="margin-top:12px;display:flex;gap:10px;flex-wrap:wrap;">
      <button class="btn" type="button" data-close="1">Cancelar</button>
      <button class="btn primary" type="button" data-post-report-send="${esc(String(postId))}">Enviar reporte</button>
    </div>
    <div id="reportPostStatus" class="small muted" style="margin-top:10px;"></div>
  `;
  openModal();
}

/* =========================
   Delegación GLOBAL (sin duplicados en web/móvil)
   - pointerup + click (dedupe)
   - evita doble trigger en desktop y mobile
========================= */

let __lastPointerTs = 0;
let __modalJustOpenedTs = 0;
let __kebabSuppressUntil = 0;


// Define qué elementos consideramos "accionables"
function isActionableTarget(t){
  if(!t || !t.closest) return false;

return !!t.closest(
  '[data-close], [data-like], [data-point], .pill[data-action], [data-open-post], [data-share], [data-send], [data-topic-pick], [data-reply-cancel], [data-replies-more], [data-replies-less], [data-feed-open], [data-feed-prev], [data-feed-next], [data-profile-open], [data-kebab], [data-kebab-item], [data-post-save], [data-post-delete-confirm], [data-post-report-send]'
);
}

async function handleGlobalAction(e) {

  

// =========================
// Guardar edición de post
// =========================
const saveBtn = e.target.closest('[data-post-save]');
if (saveBtn) {
  e.preventDefault?.();

  const postId = String(saveBtn.getAttribute('data-post-save') || '');
  if (!postId) return;

  const title = (document.getElementById('editPostTitle')?.value || '').trim();
  const topic = ((document.getElementById('editPostTopic')?.value || '').trim()) || 'Sin tema';
  const body  = (document.getElementById('editPostBody')?.value || '').trim();
  const status = document.getElementById('editPostStatus');

  if (title.length < 3 || body.length < 10) {
    if (status) status.textContent = 'Completa título (3+) y contenido (10+).';
    return;
  }

  saveBtn.disabled = true;
  try {
    if (status) status.textContent = 'Guardando…';
    await API.updatePost(postId, { title, body, topic });
    if (status) status.textContent = 'Guardado ✅';

    closeModal();
    await renderAll();
    try { await openPostModal(postId); } catch {}
  } catch (err) {
    console.error(err);
    const msg = (err && err.message) ? String(err.message) : 'Error guardando.';
    if (status) status.textContent = msg;
  } finally {
    saveBtn.disabled = false;
  }
  return;
}

// =========================
// Confirmar delete de post
// =========================
const delBtn = e.target.closest('[data-post-delete-confirm]');
if (delBtn) {
  e.preventDefault?.();

  const postId = String(delBtn.getAttribute('data-post-delete-confirm') || '');
  const status = document.getElementById('deletePostStatus');
  if (!postId) return;

  delBtn.disabled = true;
  try {
    if (status) status.textContent = 'Eliminando…';
    await API.deletePost(postId);
    if (status) status.textContent = 'Eliminado ✅';

    closeModal();
    await renderAll();
  } catch (err) {
    console.error(err);
    const msg = (err && err.message) ? String(err.message) : 'Error eliminando.';
    if (status) status.textContent = msg;
  } finally {
    delBtn.disabled = false;
  }
  return;
}



// =========================
// Enviar reporte de post
// =========================
const repBtn = e.target.closest('[data-post-report-send]');
if (repBtn) {
  e.preventDefault?.();

  const postId = String(repBtn.getAttribute('data-post-report-send') || '');
  const reason = (document.getElementById('reportPostReason')?.value || '').trim();
  const status = document.getElementById('reportPostStatus');
  if (!postId) return;

  // ✅ Validación mínima
  if (reason.length < 3) {
    if (status) status.textContent = 'Escribe un motivo (mínimo 3 caracteres).';
    return;
  }

  // ✅ Anti doble-submit
  repBtn.disabled = true;

  try {
    if (status) status.textContent = 'Enviando…';

    await API.reportPost(postId, reason);

    if (status) status.textContent = 'Reporte enviado ✅';
    // cerrar después de un toque
    setTimeout(() => { try { closeModal(); } catch {} }, 350);

  } catch (err) {
    console.error(err);

    // ✅ Mensaje más útil (si existe)
    const msg = (err && err.message) ? String(err.message) : 'Error enviando reporte.';
    if (status) status.textContent = msg;

  } finally {
    repBtn.disabled = false;
  }

  return;
}



// =========================
  // FEED MODAL: abrir / paginar
  // =========================
  if (e.target.closest('[data-feed-open]')) {
    e.preventDefault?.();
    FEED_MODAL_PAGE = 0;
    openFeedListModal();
    return;
  }

  if (e.target.closest('[data-feed-prev]')) {
    e.preventDefault?.();
    FEED_MODAL_PAGE = Math.max(0, FEED_MODAL_PAGE - 1);
    openFeedListModal();
    return;
  }

  if (e.target.closest('[data-feed-next]')) {
    e.preventDefault?.();
    FEED_MODAL_PAGE = FEED_MODAL_PAGE + 1;
    openFeedListModal();
    return;
  }

// ✅ evita que un click residual abra kebabs justo al abrir el modal
if (Date.now() - __modalJustOpenedTs < 250) {
  if (e.target.closest('[data-kebab]')) {
    e.preventDefault?.();
    e.stopPropagation?.();
    return;
  }
}

// =========================
// KEBAB TOGGLE (FASE 4.1)
// =========================



const kb = e.target.closest('[data-kebab]');

if (kb) {
  // ✅ Si el botón está "lockeado" (opcional), no permitas toggle
  if (kb.dataset.kebabLock === "1") {
    e.preventDefault?.();
    e.stopPropagation?.();
    return;
  }

  const now = Date.now();
  const isInModal = !!kb.closest('#daoModalBody');

  // ✅ si el modal acaba de abrir, ignora cualquier toggle “fantasma”
  if (now < __kebabSuppressUntil || (isInModal && (now - __modalJustOpenedTs) < 450)) {
    e.preventDefault?.();
    e.stopPropagation?.();
    return;
  }

  e.preventDefault?.();
  e.stopPropagation?.();
  toggleKebabFromButton(kb);
  return;
}




// =========================
// KEBAB ITEM (POSTS + COMMENTS) — FASE 4.1 / 5.2.3
// =========================
const item = e.target.closest('[data-kebab-item]');
if (item) {
  e.preventDefault?.();
  e.stopPropagation?.();
  closeAllKebabs();

  const action = String(item.getAttribute('data-kebab-action') || '');
  const postId = String(item.getAttribute('data-post-id') || '');

  if (!action || !postId) return;

  // Requiere auth para cualquier acción
  if (!getJWT()) {
    alert('Necesitas iniciar sesión (SIWE) para esta acción.');
    return;
  }

  // =========================
  // POSTS
  // =========================
  if (action === 'edit') {
    await openEditPostModal(postId);
    return;
  }

  if (action === 'delete') {
    await openDeletePostModal(postId);
    return;
  }

  if (action === 'report') {
    await openReportPostModal(postId);
    return;
  }

  // =========================
  // COMMENTS / REPLIES — FASE 5.2.3
  // =========================
  if (action.startsWith('c-')) {
    const commentId = item.getAttribute('data-comment-id');
    const replyId   = item.getAttribute('data-reply-id');
    const parentId  = item.getAttribute('data-parent-id');

    if (!commentId) return;

    if (action === 'c-edit') {
      // TODO FASE 5.2.4
      alert('Editar comentario (FASE 5.2.4)');
      return;
    }

    
if (action === 'c-delete') {
  if (!confirm('¿Eliminar este comentario?')) return;

  try {
    await API.deleteComment(postId, commentId, replyId);
    await openPostModal(postId);
    await renderAll();
  } catch (e) {
    alert('Error eliminando comentario');
  }
  return;
}


    if (action === 'c-report') {
      alert('Reportar comentario (FASE 5.2.4)');
      return;
    }

    return;
  }

  return;
}


// =========================
// Cerrar modal
// =========================
if (e.target.closest('[data-close]')) {
  e.preventDefault?.();
  closeModal();
  return;
}

// =========================
// Cancel reply
// =========================
const cancel = e.target.closest('[data-reply-cancel]');
if (cancel) {
  const postId = String(cancel.getAttribute('data-reply-cancel') || '');
  const ui = loadUI();
  ui.replyTo = null;
  saveUI(ui);
  await openPostModal(postId);
  return;
}

// =========================
// Replies more/less (UI only)
// =========================
const more = e.target.closest('[data-replies-more]');
if (more) {
  const postId = String(more.getAttribute('data-post-id') || '');
  const commentId = String(more.getAttribute('data-replies-more') || '');
  const ui = loadUI();
  ui.expand = ui.expand || {};
  ui.expand[commentId] = true;
  saveUI(ui);
  await openPostModal(postId);
  return;
}

const less = e.target.closest('[data-replies-less]');
if (less) {
  const postId = String(less.getAttribute('data-post-id') || '');
  const commentId = String(less.getAttribute('data-replies-less') || '');
  const ui = loadUI();
  ui.expand = ui.expand || {};
  ui.expand[commentId] = false;
  saveUI(ui);
  await openPostModal(postId);
  return;
}


// =========================
// Abrir perfil (SOON) desde autor
// =========================
const prof = e.target.closest('[data-profile-open]');
if (prof) {
  e.preventDefault?.();
  e.stopPropagation?.();

  const addr = String(prof.getAttribute('data-profile-open') || '');
  if (!addr) return;

  document.getElementById('daoModalTitle').textContent = 'Perfil';
  document.getElementById('daoModalBody').innerHTML = `
    <div class="sheet-item">
      <div class="t">Usuario</div>
      <div class="m">${esc(shortHex(addr))}</div>
      <div class="small muted" style="margin-top:10px;">
        Perfil público (stats) — SOON.
      </div>
    </div>
  `;
  openModal();
  return;
}

// =========================
// LIKE (botones data-like)
// =========================

const like = e.target.closest('[data-like]');
if (like) {
  e.preventDefault();

  const postId = String(like.getAttribute('data-like') || '');
  if (!postId) return;

  const userId = getUserId();
  if (userId === 'visitor') return;

  // ✅ Fuente de verdad (cache del backend)
  const p0 = Array.isArray(POSTS_CACHE) ? POSTS_CACHE.find(x => String(x.id) === postId) : null;
  if (p0?.myLike) return; // ya dio like según backend

  // ✅ Optimistic UI: sube likes + marca myLike
  mutatePost(postId, p => ({
    ...ensurePostSchema(p),
    likes: (p.likes || 0) + 1,
    myLike: true,
  }));

  // Backend
  try { await reactSafe(postId, 'like'); } catch {}

  // Re-render
  renderAll();
  updateModalPostCounts(postId);
  return;
}


// =========================
// POINTS (data-point)
// =========================

const point = e.target.closest('[data-point]');
if (point) {
  e.preventDefault();

  const postId = String(point.getAttribute('data-point') || '');
  if (!postId) return;

  const userId = getUserId();
  if (userId === 'visitor') return;

  // ✅ Fuente de verdad (cache del backend)
  const p0 = Array.isArray(POSTS_CACHE) ? POSTS_CACHE.find(x => String(x.id) === postId) : null;
  const already = Number(p0?.myPoints ?? 0);
  if (already >= POINTS_MAX_PER_POST) return;

  // ✅ Optimistic UI: sube points + marca myPoints
  mutatePost(postId, p => ({
    ...ensurePostSchema(p),
    points: (p.points || 0) + 1,
    myPoints: Number(p.myPoints ?? 0) + 1,
  }));

  // Backend
  try { await reactSafe(postId, 'points'); } catch {}

  // Re-render
  renderAll();
  updateModalPostCounts(postId);
  return;
}


// =========================
// PILLs: like / points / comment / c-like / c-points / c-reply
// =========================
const pill = e.target.closest('.pill[data-action]');
if (pill) {
  e.preventDefault();
  e.stopPropagation();

  const action = pill.dataset.action;
  let postId = pill.dataset.postId;

  if (!postId) {
    const latestCard = document.getElementById('latestCard');
    postId = latestCard?.dataset.openPost;
  }

  postId = String(postId || '');
  if (!postId) return;

  // Reply UI (local)
  if (action === 'c-reply') {
    const ui = loadUI();
    ui.replyTo = { postId, commentId: pill.dataset.commentId };
    saveUI(ui);
    await openPostModal(postId);
    return;
  }

  // Reacciones a comentarios / replies (backend-first + UI inmediata)
  
if (action === 'c-like' || action === 'c-points') {
  const commentId = String(pill.dataset.commentId || '');
  const replyId = pill.dataset.replyId ? String(pill.dataset.replyId) : '';
  const userId = getUserId();
  if (!commentId || userId === 'visitor') return;

  // targetId: si es reply real y numérico, reaccionamos al reply
  const replyNum = replyId ? Number(replyId) : NaN;
  const hasRealReply = replyId && Number.isFinite(replyNum);
  const targetId = hasRealReply ? replyId : commentId;

  // Backend-driven source: CURRENT_MODAL_POST
  const post = CURRENT_MODAL_POST;
  if (!post) return;

  // Index rápido para encontrar target
  let target = null;
  if (hasRealReply) {
    for (const c of (post.comments || [])) {
      const r = (c.replies || []).find(x => String(x.id) === String(replyId));
      if (r) { target = r; break; }
    }
  } else {
    target = (post.comments || []).find(x => String(x.id) === String(commentId)) || null;
  }
  if (!target) return;

  // Check backend-driven limits
  if (action === 'c-like') {
    if (target.myLike) return;
  } else {
    if (Number(target.myPoints ?? 0) >= POINTS_MAX_PER_POST) return;
  }

  // Optimistic UI: actualiza target + DOM count
  const countEl = pill.querySelector('.count');

  if (action === 'c-like') {
    target.myLike = true;
    target.likes = Number(target.likes || 0) + 1;
    if (countEl) countEl.textContent = String(target.likes);
    pill.classList.add('active');
  } else {
    target.myPoints = Number(target.myPoints ?? 0) + 1;
    target.points = Number(target.points || 0) + 1;
    if (countEl) countEl.textContent = String(target.points);
    // active solo si ya alcanzó el límite
    pill.classList.toggle('active', Number(target.myPoints ?? 0) >= POINTS_MAX_PER_POST);
  }

  // Backend request
  let res = null;
  try {
    res = await API.reactComment(postId, targetId, action === 'c-like' ? 'like' : 'points');
  } catch (e) {
    console.warn("API comment/react offline:", e);
  }

  // Si backend devuelve counts, sincroniza
  const counts = res?.counts || null;
  if (counts && countEl) {
    if (action === 'c-like') {
      const n = Number(counts.likes);
      if (Number.isFinite(n)) {
        target.likes = n;
        countEl.textContent = String(n);
      }
    } else {
      const n = Number(counts.points);
      if (Number.isFinite(n)) {
        target.points = n;
        countEl.textContent = String(n);
      }
    }
  }

  // Refresh suave del modal para asegurar consistencia
  setTimeout(async () => {
    try { await openPostModal(postId); } catch {}
  }, 220);

  return;
  }

  // Acciones del POST (backend-first)
  if (action === 'comment') {
    await openPostModal(postId);
    return;
  }

  
// Acciones del POST (backend-driven)
const userId = getUserId();
if (userId === 'visitor') return;

// Source of truth: cache backend
const p0 = Array.isArray(POSTS_CACHE) ? POSTS_CACHE.find(x => String(x.id) === String(postId)) : null;

if (action === 'like') {
  if (p0?.myLike) return;

  mutatePost(postId, p => ({
    ...ensurePostSchema(p),
    likes: (p.likes || 0) + 1,
    myLike: true,
  }));

  try { await reactSafe(postId, 'like'); } catch {}
  renderAll();
  updateModalPostCounts(postId);
  return;
}

if (action === 'points') {
  const already = Number(p0?.myPoints ?? 0);
  if (already >= POINTS_MAX_PER_POST) return;

  mutatePost(postId, p => ({
    ...ensurePostSchema(p),
    points: (p.points || 0) + 1,
    myPoints: Number(p.myPoints ?? 0) + 1,
  }));

  try { await reactSafe(postId, 'points'); } catch {}
  renderAll();
  updateModalPostCounts(postId);
  return;
}


  return;
}

// =========================
// Abrir post
// =========================
const openPost = e.target.closest('[data-open-post]');
if (openPost) {
  e.preventDefault();
  const id = String(openPost.dataset.openPost || '');
  if (id) await openPostModal(id);
  return;
}

// =========================
// SHARE
// =========================
const share = e.target.closest('[data-share]');
if (share) {
  e.preventDefault();
  await copyLink(String(share.getAttribute('data-share') || ''));
  return;
}

// =========================
// SEND comment (backend-first con fallback local)
// =========================
const send = e.target.closest('[data-send]');
if (send) {
  e.preventDefault();

  const id = String(send.getAttribute('data-send') || '');
  const input = document.getElementById('commentText');
  const textRaw = (input?.value || '').trim();
  if (textRaw.length < 2) return;

  const ui = loadUI();
  const replying = ui.replyTo && String(ui.replyTo.postId) === id ? ui.replyTo : null;
  const text = replying ? `↪️ reply(c:${replying.commentId}) ${textRaw}` : textRaw;

  try {
    await API.addComment(id, text);
    if (input) input.value = '';
    if (replying) { ui.replyTo = null; saveUI(ui); }

    await openPostModal(id);
    renderAll();
    return;
  } catch (err) {
    console.warn("API comments offline, usando localStorage:", err);
  }

  mutatePost(id, post => {
    post = ensurePostSchema(post);

    if (replying) {
      const c = findComment(post, replying.commentId);
      if (!c) return post;
      c.replies = c.replies || [];
      
c.replies.push({
  id: uid(),
  ts: now(),
  text: textRaw,
  likes: 0,
  points: 0,
  author: getViewerAddress(), // ✅ FIX
});

      return post;
    }

    post.comments = post.comments || [];
    
post.comments.push({
  id: uid(),
  ts: now(),
  text: textRaw,
  likes: 0,
  points: 0,
  replies: [],
  author: getViewerAddress(), // ✅ FIX
});
    post.commentsCount = (post.commentsCount || 0) + 1;
    return post;
  });

  if (input) input.value = '';
  if (replying) { ui.replyTo = null; saveUI(ui); }

  await openPostModal(id);
  renderAll();
  return;
}

// =========================
// PICK TOPIC
// =========================
const pick = e.target.closest('[data-topic-pick]');
if (pick) {
  e.preventDefault();
  const t = pick.getAttribute('data-topic-pick');
  const sel = document.querySelector('#postTopic');
  if (sel) sel.value = t;
  closeModal();
  return;
}
} // ✅ <— ESTA LLAVE ES LA QUE FALTABA (CIERRA handleGlobalAction)

// =========================
// LISTENERS (dedupe pointerup + click)
// =========================
document.addEventListener('pointerup', async (e) => {
  if (e.pointerType === 'mouse' && e.button !== 0) return;
  if (!isActionableTarget(e.target)) return;

  __lastPointerTs = Date.now();
  await handleGlobalAction(e);
}, { passive: false });

document.addEventListener('click', async (e) => {
  if (!isActionableTarget(e.target)) return;
  if (Date.now() - __lastPointerTs < 650) return;

  await handleGlobalAction(e);
});

// =========================
// KEBAB: cerrar con Escape (una sola vez)
// =========================
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') closeAllKebabs();
});

// =========================
// KEBAB: cerrar con click afuera (una sola vez)
// =========================
document.addEventListener('pointerdown', (e) => {
  if (!e.target.closest('.kebab-btn') && !e.target.closest('.kebab-menu')) {
    closeAllKebabs();
  }
}, { passive: true });


async function getPostsSafe() {
  const local = loadJSON(DB_KEY, []); // siempre disponible

  try {
    const posts = await API.getPosts();
    // Si API trae posts reales, úsala.
    if (Array.isArray(posts) && posts.length > 0) return posts;

    // Si API responde pero vacío, mantén demo local si existe.
    if (Array.isArray(posts) && posts.length === 0 && local.length > 0) return local;

    // Si ambos están vacíos, devuelve vacío.
    if (Array.isArray(posts)) return posts;
  } catch (e) {
    console.warn("API offline, usando localStorage");
  }

  return local;
}

async function reactSafe(postId, type) {
  try {
    const res = await API.react(postId, type);

    // 1) Si backend devuelve counts explícitos
    const likes = res?.counts?.likes;
    const points = res?.counts?.points;

    if (typeof likes === "number" || typeof points === "number") {
      mutatePost(String(postId), p => ({
        ...ensurePostSchema(p),
        likes: typeof likes === "number" ? likes : (p.likes || 0),
        points: typeof points === "number" ? points : (p.points || 0),
      }));
      return true;
    }

    // 2) Si backend devuelve post actualizado
    if (res?.post) {
      mutatePost(String(postId), p => ({
        ...ensurePostSchema(p),
        likes: Number(res.post.likes ?? p.likes ?? 0),
        points: Number(res.post.points ?? p.points ?? 0),
      }));
      return true;
    }

    return true;
  } catch (e) {
    console.warn("API react offline, usando mutación local:", type);
    return false;
  }
}


/* =========================
   Seed demo (ajustado a Topics Groups + compat legacy)
========================= */
async function seedIfEmpty(){
  const posts = await getPostsSafe();
  if (posts.length) return;

  // ---------------------------------------------------------
  // Topic helpers (nuevo modelo agrupado + fallback legacy)
  // ---------------------------------------------------------
  const FALLBACK_TOPICS = (typeof DEFAULT_TOPICS !== 'undefined' && Array.isArray(DEFAULT_TOPICS))
    ? DEFAULT_TOPICS
    : [];

  // Busca un topic por texto dentro del modelo agrupado (si existe)
  function findTopicInGroups(wanted){
    try{
      if (typeof loadTopicsModel !== 'function') return null;
      const model = loadTopicsModel();
      const groups = Array.isArray(model?.groups) ? model.groups : [];
      for (const g of groups){
        const items = Array.isArray(g?.items) ? g.items : [];
        const hit = items.find(t => String(t).trim() === String(wanted).trim());
        if (hit) return hit;
      }
      return null;
    }catch{
      return null;
    }
  }

  // Elige topic preferido (nuevo) o cae al legacy por índice o a "Sin tema"
  function pickTopic(preferred, legacyIndex = 0){
    return (
      findTopicInGroups(preferred) ||
      FALLBACK_TOPICS[legacyIndex] ||
      preferred ||
      'Sin tema'
    );
  }

  // Topics “canon” (según tu nueva lista)
  const TOPIC_WEB3 = pickTopic('Web3, Smart Contracts & Infraestructura DAO', 2);
  const TOPIC_AI   = pickTopic('Inteligencia Artificial & Agentes Autónomos', 1);
  const TOPIC_DEV  = pickTopic('Desarrollo de Software & Herramientas IA (Cursor/Claude)', 0);

  // ---------------------------------------------------------
  // Seed posts
  // ---------------------------------------------------------
  const seed = [
    {
      id: uid(),
      title: 'Bienvenida a la DAO alemty',
      body: 'Este es un foro estilo Reddit/Taringa con glass UI. Publica ideas, vota y comenta.',
      topic: TOPIC_WEB3,
      ts: now() - 1000 * 60 * 80,
      likes: 5,
      points: 2,
      comments: [
        { ts: now() - 1000 * 60 * 60, text: 'Se ve increíble el glass.' }
      ]
    },
    {
      id: uid(),
      title: 'Tokenomics: Aura consumo, Alem salida',
      body: 'Aura = consumo de contenido. Alem = salida a mercado para creadores. Emisión por epochs.',
      topic: TOPIC_WEB3,
      ts: now() - 1000 * 60 * 160,
      likes: 9,
      points: 4,
      comments: []
    },
    {
      id: uid(),
      title: 'Backrooms: grupos privados',
      body: 'Propongo backrooms por temas con roles, acceso y reglas simples.',
      topic: TOPIC_DEV,
      ts: now() - 1000 * 60 * 240,
      likes: 3,
      points: 1,
      comments: []
    },
    {
      id: uid(),
      title: 'IA como copiloto de gobernanza',
      body: 'IA que resume debates, detecta consenso y sugiere acciones sin mandar.',
      topic: TOPIC_AI,
      ts: now() - 1000 * 60 * 400,
      likes: 6,
      points: 3,
      comments: []
    }
  ];

  saveJSON(DB_KEY, seed);

  // ---------------------------------------------------------
  // Seed topics (nuevo modelo si existe, si no legacy)
  // ---------------------------------------------------------
  const storedTopics = loadJSON(TOPICS_KEY, null);

  // Si NO hay topics guardados todavía:
  if (!storedTopics) {
    // Si existe el nuevo modelo (DEFAULT_TOPIC_GROUPS / saveTopicsModel) úsalo
    if (typeof DEFAULT_TOPIC_GROUPS !== 'undefined' && Array.isArray(DEFAULT_TOPIC_GROUPS)) {
      const model = { version: 1, groups: DEFAULT_TOPIC_GROUPS };
      if (typeof saveTopicsModel === 'function') {
        saveTopicsModel(model);
      } else {
        saveJSON(TOPICS_KEY, model);
      }
    } else {
      // Fallback legacy: array plano
      if (FALLBACK_TOPICS.length) saveJSON(TOPICS_KEY, FALLBACK_TOPICS);
    }
  }
}


/* =========================
   Ranking / filtros
========================= */
function getCommentsCount(p){
  if (!p) return 0;
  if (typeof p.comments === "number") return p.comments;
  if (typeof p.commentsCount === "number") return p.commentsCount;
  if (Array.isArray(p.comments)) return p.comments.length;
  return 0;
}

function byRecent(a,b){ return (b.ts||0)-(a.ts||0); }


function byScore(a, b) {
  // usa tu score(p) (ya existe) y rompe empates por fecha
  const sa = score(a);
  const sb = score(b);
  if (sb !== sa) return sb - sa;
  return ((b.ts || 0) - (a.ts || 0)); // ✅ más nuevo primero
}



function filterWeek(posts){
  const weekAgo = now() - 7*24*60*60*1000;
  return posts.filter(p => (p.ts||0) >= weekAgo);
}
function filterMonth(posts){
  const monthAgo = now() - 30*24*60*60*1000;
  return posts.filter(p => (p.ts||0) >= monthAgo);
}


// =========================
// Helpers de conteo (SOURCE OF TRUTH)
// =========================
function getLikesCount(p){
  if (!p) return 0;
  if (typeof p.likes === "number") return p.likes;
  if (typeof p.likesCount === "number") return p.likesCount;
  return 0;
}

function getPointsCount(p){
  if (!p) return 0;
  if (typeof p.points === "number") return p.points;
  if (typeof p.pointsCount === "number") return p.pointsCount;
  return 0;
}

// =========================
// Score (SOURCE OF TRUTH)
// =========================
function score(p){
  // coherente con byScore() que ya usa score/points/likes como fallback
  // y con tu UI: el número del voto debe ser estable
  const likes = getLikesCount(p);
  const points = getPointsCount(p);
  const comments = getCommentsCount(p);
  return (points * 2) + likes + comments; // ajuste simple; puedes cambiar pesos
}


/* =========================
   Panel + tabs
========================= */
const PANEL_MODEL = {
  'relevantes': { title:'Relevantes', desc:'Últimos 5 posts más relevantes en carrusel. Usa flechas.' },
  'recientes': { title:'Recientes', desc:'Ordenado por fecha. Ideal para ver lo nuevo.' },
  'top-semana': { title:'Top Semana', desc:'Ranking semanal por relevancia (likes/points/comentarios).' },
  'top-mes': { title:'Top Mes', desc:'Ranking mensual por relevancia (likes/points/comentarios).' }
};
let activeView = 'relevantes';

/* =========================
   Carousel
========================= */
let carIndex = 0;


// =========================
// Carousel indicator (JS-only)
// =========================
function ensureCarouselIndicator() {
  const dots = document.getElementById('carDots');
  if (!dots) return null;

  let bar = document.getElementById('carIndicator');
  if (bar) return bar;

  bar = document.createElement('div');
  bar.id = 'carIndicator';
  bar.setAttribute('aria-hidden', 'true');

  // Track (glass)
  bar.style.cssText = [
    'position:relative',
    'height:10px',
    'margin-top:10px',
    'border-radius:999px',
    'border:1px solid var(--border)',
    'background:rgba(255,255,255,.06)',
    'backdrop-filter:blur(12px) saturate(130%)',
    '-webkit-backdrop-filter:blur(12px) saturate(130%)',
    'overflow:hidden'
  ].join(';');

  const thumb = document.createElement('div');
  thumb.className = 'thumb';
  thumb.style.cssText = [
    'position:absolute',
    'top:1px',
    'bottom:1px',
    'left:1px',
    'border-radius:999px',
    'background:linear-gradient(135deg,var(--primary),var(--accent))',
    'box-shadow:0 0 18px rgba(0,255,213,.35)',
    'transform:translateX(0px)',
    'width:44px'
  ].join(';');

  bar.appendChild(thumb);

  // Lo insertamos debajo de los dots
  dots.insertAdjacentElement('afterend', bar);
  return bar;
}

function hideCarouselIndicator() {
  const bar = document.getElementById('carIndicator');
  if (bar) bar.style.display = 'none';
}

function updateCarouselIndicator(total, index) {
  const bar = ensureCarouselIndicator();
  if (!bar) return;
  bar.style.display = '';

  const thumb = bar.querySelector('.thumb');
  if (!thumb) return;

  requestAnimationFrame(() => {
    const w = bar.getBoundingClientRect().width;
    if (!w) return;

    // tamaño del thumb: proporcional al número de items (mínimo visible)
    const minW = 36;
    const usable = Math.max(0, w - 2);
    const thumbW = (total <= 1)
      ? usable
      : Math.max(minW, Math.round(usable / total));

    const maxX = Math.max(0, usable - thumbW);
    const x = (total <= 1)
      ? 0
      : Math.round(maxX * (index / (total - 1)));

    thumb.style.width = `${thumbW}px`;
    thumb.style.transform = `translateX(${x}px)`;
  });
}


function renderCarousel(posts){
  const track = document.getElementById('carTrack');
  const dots  = document.getElementById('carDots');
  if(!track || !dots) return;

  const top5 = posts.slice().sort(byScore).slice(0,5);

  if(!top5.length){
    track.innerHTML = `
      <div class="car-card">
        <div class="car-title">Sin posts</div>
        <div class="car-meta muted">Publica el primero.</div>
      </div>
    `;
    dots.innerHTML = '';
    track.style.transform = 'translateX(0px)';
    carIndex = 0;
    hideCarouselIndicator();
    return;
  }

  // 1) Render del carrusel (KPIs con clases semánticas)
  track.innerHTML = top5.map(p => `
    <div class="car-card" data-open-post="${esc(p.id)}"> 

<div class="car-headrow">
  <div>
    <div class="car-title">${esc(p.title)}</div>
    <div class="car-author">${authorLinkHTML(p.author)}</div>
    <div class="car-meta">${esc(p.topic || 'Sin tema')} · ${esc(fmt(p.ts))}</div>
  </div>

  <button class="kebab-btn" type="button" data-kebab="${esc(p.id)}" aria-label="Opciones">⋮</button>

  ${kebabMenuHTML(p)}
</div>
<div class="car-snippet">
        ${esc((p.body || '').slice(0,160))}${(p.body || '').length > 160 ? '…' : ''}
      </div>

      <div class="car-kpis">
        
<span class="pill like" data-action="like" data-post-id="${esc(p.id)}">
  ♥️ <span class="count">${getLikesCount(p)}</span>
</span>
<span class="pill points" data-action="points" data-post-id="${esc(p.id)}">
  ⭐ <span class="count">${getPointsCount(p)}</span>
</span>
<span class="pill comment" data-action="comment" data-post-id="${esc(p.id)}">
  💬 <span class="count">${getCommentsCount(p)}</span>
</span>

      </div>
    </div>
  `).join('');

  
// 2) Indicator bar (reemplaza dots)
carIndex = Math.max(0, Math.min(carIndex, top5.length - 1));

// Oculta dots para que no se duplique UI
dots.innerHTML = '';
dots.style.display = 'none';

updateCarouselIndicator(top5.length, carIndex);


  
// 3) Aplicar transform cuando el layout ya exista (evita “descuadre”)
requestAnimationFrame(() => {
  const first = track.firstElementChild;
  if(!first){
    track.style.transform = 'translateX(0px)';
    return;
  }

  const viewport = track.closest('.car-viewport');
  const viewportW = viewport ? viewport.getBoundingClientRect().width : 0;

  const cardW = first.getBoundingClientRect().width;
  const gap = 10;

  if(!cardW){
    requestAnimationFrame(() => {
      const f2 = track.firstElementChild;
      const w2 = f2 ? f2.getBoundingClientRect().width : 0;
      const vw2 = viewport ? viewport.getBoundingClientRect().width : 0;

      const raw2 = (w2 + gap) * carIndex;
      const centerOffset2 = Math.max(0, (vw2 - w2) / 2);
      const maxX2 = Math.max(0, (w2 + gap) * (track.children.length - 1));
      const x2 = Math.max(0, Math.min(maxX2, raw2 - centerOffset2));

      track.style.transform = `translateX(${-x2}px)`;
    });
    return;
  }

  const raw = (cardW + gap) * carIndex;
  const centerOffset = Math.max(0, (viewportW - cardW) / 2);
  const maxX = Math.max(0, (cardW + gap) * (track.children.length - 1));
  const x = Math.max(0, Math.min(maxX, raw - centerOffset));

  track.style.transform = `translateX(${-x}px)`;
});

}


// =========================
// Limits + ledger (preview local)
// =========================
const ACTIONS_KEY = 'alemty.dao.actions.v1';
const LIKE_MAX_PER_POST = 1;      // ❤️ máximo 1 por usuario/post
console.log('USER ID:', getUserId());  //BORRAR CUANDO CONECTES SIWE, aquí es donde verás el DID real en consola//
const POINTS_MAX_PER_POST = 10;   // ⭐ máximo 10 por usuario/post

function getUserId(){
  // Preview local (cuando conectes SIWE, aquí retornas el DID real)
  return localStorage.getItem('alemty.did') ||
         localStorage.getItem('did') ||
         'visitor';
}

function loadActions(){
  return loadJSON(ACTIONS_KEY, {});
}

function saveActions(actions){
  saveJSON(ACTIONS_KEY, actions);
}


// =========================
// Ledger por TARGET (post / comment / reply)
// =========================
function targetKeyPost(postId){
  return `p:${postId}`;
}
function targetKeyComment(postId, commentId){
  return `c:${postId}:${commentId}`;
}
function targetKeyReply(postId, commentId, replyId){
  return `r:${postId}:${commentId}:${replyId}`;
}


function getActionEntry(actions, userId, key){
  actions[userId] = actions[userId] || {};
  actions[userId][key] = actions[userId][key] || { liked:false, pointsGiven:0 };
  return actions[userId][key];
}





/* =========================
   Render UI
========================= */

/**
 * Inserta un botón "📚 Elegir tema" junto al select #postTopic
 * para abrir el modal de temas (scroll controlable).
 * - No duplica: si ya existe #topicPickerBtn, no vuelve a crear.
 */
function enhanceTopicPicker(){
  const sel = document.getElementById('postTopic');
  if (!sel) return;

  // Evita duplicar
  if (document.getElementById('topicPickerBtn')) return;

  // Wrapper para alinear select + botón (sin romper layout)
  const wrap = document.createElement('div');
  wrap.style.display = 'flex';
  wrap.style.gap = '10px';
  wrap.style.alignItems = 'center';
  wrap.style.width = '100%';

  // Inserta wrapper antes del select y mueve el select dentro
  sel.parentNode.insertBefore(wrap, sel);
  wrap.appendChild(sel);

  // Botón para abrir el modal de temas (UI controlable + scrollbar estilable)
  const btn = document.createElement('button');
  btn.id = 'topicPickerBtn';
  btn.type = 'button';
  btn.className = 'btn';
  btn.textContent = '📚 Elegir tema';
  btn.style.whiteSpace = 'nowrap';

  btn.addEventListener('click', () => {
    // Usa tu modal ya existente
    if (typeof openTopicsModal === 'function') openTopicsModal();
  });

  wrap.appendChild(btn);
}

function renderTopicsSelect(){
  const sel = document.getElementById('postTopic');
  if(!sel) return;

  const model = loadTopicsModel();
  const groups = Array.isArray(model.groups) ? model.groups : [];

  sel.innerHTML =
    `<option value="">Sin tema</option>` +
    groups.map(g => {
      const label = esc(g.label);
      const items = (g.items || [])
        .map(t => `<option value="${esc(t)}">${esc(t)}</option>`)
        .join('');
      return `<optgroup label="${label}">${items}</optgroup>`;
    }).join('');

  // ✅ Importante: el dropdown nativo no se puede estilizar bien,
  // así que añadimos el botón que abre el modal (sí estilable)
  enhanceTopicPicker();
}

/** Helper: asegura que un contenedor tenga <span class="count">N</span> y lo actualiza */
function setPillCount(pillEl, iconText, n){
  if(!pillEl) return;

  // Si ya existe span.count, solo actualiza
  const count = pillEl.querySelector('.count');
  if(count){
    count.textContent = String(n);
    return;
  }

  // Si no existe, reconstruye el contenido de forma consistente:
  // "ICON <span class='count'>N</span>"
  pillEl.innerHTML = `${iconText} <span class="count">${String(n)}</span>`;
}

function renderLatest(posts){
  const latest = posts.slice().sort(byRecent)[0];
  const card = document.getElementById('latestCard');
  if(!card) return;

  const metaEl = document.getElementById('latestMeta');
  const titleEl = document.getElementById('latestTitle');
  const snipEl  = document.getElementById('latestSnippet');

  const likesEl = document.getElementById('latestLikes');
  const pointsEl = document.getElementById('latestPoints');
  const commentsEl = document.getElementById('latestComments');

  if(!latest){
    card.dataset.openPost = '';

    if(metaEl) metaEl.textContent = '—';
    if(titleEl) titleEl.textContent = 'Aún no hay posts';
    if(snipEl) snipEl.textContent = 'Publica el primero.';

    setPillCount(likesEl, '♥️', 0);
    setPillCount(pointsEl, '⭐', 0);
    setPillCount(commentsEl, '💬', 0);

    // opcional: limpiar data-post-id
    likesEl?.removeAttribute('data-post-id');
    pointsEl?.removeAttribute('data-post-id');
    commentsEl?.removeAttribute('data-post-id');

    return;
  }

  // Importante: tu sistema de abrir modal usa esto
  card.dataset.openPost = latest.id;

 

metaEl.innerHTML = `
  <div class="post-headrow">
    <div>
      <div class="post-author">${authorLinkHTML(latest.author)}</div>
      <div>${esc(latest.topic || 'Sin tema')} · ${esc(fmt(latest.ts))}</div>
    </div>

    <button class="kebab-btn" type="button" data-kebab="${esc(latest.id)}" aria-label="Opciones">⋮</button>

    ${kebabMenuHTML(latest)}
  </div>
`;

if(titleEl) titleEl.textContent = latest.title;
  if(snipEl) snipEl.textContent =
    (latest.body || '').slice(0,180) + ((latest.body || '').length > 180 ? '…' : '');

  // Contadores (compatibles con tu HTML: likes ya tiene <span.count>, points/comments tal vez no)
  
setPillCount(likesEl, '♥️', getLikesCount(latest));
setPillCount(pointsEl, '⭐', getPointsCount(latest));
  setPillCount(commentsEl, '💬', getCommentsCount(latest));

  // Opcional (muy útil si ya vas a sumar con pills):
  // enlaza cada pill a este post
  likesEl?.setAttribute('data-post-id', latest.id);
  pointsEl?.setAttribute('data-post-id', latest.id);
  commentsEl?.setAttribute('data-post-id', latest.id);

  // Si ya usas data-action en HTML para sumar, también puedes asegurarlo aquí:
  likesEl?.setAttribute('data-action', 'like');
  pointsEl?.setAttribute('data-action', 'points');
  commentsEl?.setAttribute('data-action', 'comment');

  likesEl?.setAttribute('data-target', 'post');
  pointsEl?.setAttribute('data-target', 'post');
  commentsEl?.setAttribute('data-target', 'post');
}



function applyActionState() {
  // ========== POSTS (backend-driven) ==========
  const byId = Object.create(null);
  (Array.isArray(POSTS_CACHE) ? POSTS_CACHE : []).forEach(p => {
    byId[String(p.id)] = p;
  });

  document.querySelectorAll('.pill[data-action][data-post-id]').forEach(el => {
    const postId = el.dataset.postId;
    const act = el.dataset.action;
    const p = byId[String(postId)];
    if (!p) return;

    if (act === 'like') el.classList.toggle('active', !!p.myLike);
    if (act === 'points') el.classList.toggle('active', Number(p.myPoints ?? 0) >= POINTS_MAX_PER_POST);
  });

  // ========== COMMENTS / REPLIES (backend-driven) ==========
  const post = CURRENT_MODAL_POST;
  if (!post || !Array.isArray(post.comments)) return;

  const cMap = Object.create(null);
  const rMap = Object.create(null);

  for (const c of post.comments) {
    cMap[String(c.id)] = c;
    for (const r of (c.replies || [])) {
      rMap[String(r.id)] = r;
    }
  }

  document.querySelectorAll('.pill[data-action="c-like"], .pill[data-action="c-points"]').forEach(el => {
    const act = el.dataset.action;              // c-like | c-points
    const commentId = el.dataset.commentId;     // id comment padre
    const replyId = el.dataset.replyId || null; // id reply si aplica

    const target = replyId ? rMap[String(replyId)] : cMap[String(commentId)];
    if (!target) return;

    if (act === 'c-like') {
      el.classList.toggle('active', !!target.myLike);
    } else {
      el.classList.toggle('active', Number(target.myPoints ?? 0) >= POINTS_MAX_PER_POST);
    }
  });
}


function renderMiniGrid(elId, posts){
  const el = document.getElementById(elId);
  if(!el) return;

  const list = posts.slice().sort(byScore).slice(0,4);
  if(!list.length){
    el.innerHTML = `<div class="muted small">Sin datos aún.</div>`;
    return;
  }

  
el.innerHTML = list.map(p => `
  <div class="mini" data-open-post="${esc(p.id)}">
    <div class="post-headrow">
      <div>
        <div class="t">${esc(p.title.slice(0,52))}${p.title.length>52?'…':''}</div>
        <div class="m">${esc(p.topic || 'Sin tema')} · ${esc(fmt(p.ts))}</div>
      </div>

      <button class="kebab-btn" type="button" data-kebab="${esc(p.id)}" aria-label="Opciones">⋮</button>

      ${kebabMenuHTML(p)}
    </div>

    <div class="mini-snippet">
      ${esc((p.body || '').slice(0,110))}${(p.body || '').length > 110 ? '…' : ''}
    </div>

    <div class="k">
      <span class="pill like" data-action="like" data-post-id="${esc(p.id)}">
        ♥️ <span class="count">${getLikesCount(p)}</span>
      </span>
      <span class="pill points" data-action="points" data-post-id="${esc(p.id)}">
        ⭐ <span class="count">${getPointsCount(p)}</span>
      </span>
      <span class="pill comment" data-action="comment" data-post-id="${esc(p.id)}">
        💬 <span class="count">${getCommentsCount(p)}</span>
      </span>
    </div>
  </div>
`).join('');
}


// =========================
// Feed list builder (FEED SIEMPRE RECIENTE)
// - Ignora activeView: el feed siempre es "más recientes" (desc)
// - Mantiene búsqueda
// =========================
function buildFeedList(posts){
  const s = document.getElementById('search');
  const q = ((s && s.value) ? s.value : '').trim().toLowerCase();

  // ✅ FEED SIEMPRE POR FECHA DESC
  let list = posts.slice().sort(byRecent);

  // ✅ filtro por búsqueda
  if(q.length >= 2){
    list = list.filter(p => (`${p.title} ${p.body} ${p.topic}`).toLowerCase().includes(q));
  }

  return list;
}


function renderFeed(posts){
  const feed = document.getElementById('feed');
  if(!feed) return;

  // ✅ Usa la lógica centralizada (recientes / top-semana / top-mes / relevantes + búsqueda)
  const list = buildFeedList(posts);
  FEED_LAST_LIST = list;

  if(!list.length){
    feed.innerHTML = `<p class="muted">Sin resultados.</p>`;
    return;
  }

  // ✅ Solo primeros 5 en el feed principal
  const visible = list.slice(0, FEED_PREVIEW_LIMIT);

  
const cards = visible.map(p => `
  <article class="post" data-open-post="${esc(p.id)}">
    <div class="post-body">

      <div class="post-headrow">
        <div>
          <div class="post-title">${esc(p.title)}</div>
          <div class="post-meta">
            ${authorLinkHTML(p.author)} · ${esc(p.topic || 'Sin tema')} · ${esc(fmt(p.ts))}
          </div>
        </div>

        <button
          class="kebab-btn"
          type="button"
          data-kebab="${esc(p.id)}"
          aria-label="Opciones"
        >⋮</button>
        ${kebabMenuHTML(p)}
      </div>

      <div class="post-snippet">
        ${esc((p.body || '').slice(0, 220))}${(p.body || '').length > 220 ? '…' : ''}
      </div>

      <div class="post-tags">
        <span class="pill like" data-action="like" data-post-id="${esc(p.id)}">
          ♥️ <span class="count">${getLikesCount(p)}</span>
        </span>
        <span class="pill points" data-action="points" data-post-id="${esc(p.id)}">
          ⭐ <span class="count">${getPointsCount(p)}</span>
        </span>
        <span class="pill comment" data-action="comment" data-post-id="${esc(p.id)}">
          💬 <span class="count">${getCommentsCount(p)}</span>
        </span>
      </div>

    </div>
  </article>
`).join('');


  // ✅ Botón "Ver todos" si hay más de 5
  const more = (list.length > FEED_PREVIEW_LIMIT)
    ? `
      <div style="margin-top:12px;display:flex;justify-content:center;">
        <button class="btn" type="button" data-feed-open="1">
          Ver todos (${list.length})
        </button>
      </div>
    `
    : '';

  feed.innerHTML = cards + more;
}


let POSTS_CACHE = [];

// =========================
// Carousel autoplay (solo "relevantes")
// =========================
let CAR_AUTO_ID = null;
let CAR_AUTO_PAUSE_UNTIL = 0;
const CAR_AUTO_MS = 4200;      // velocidad del giro
const CAR_AUTO_PAUSE_MS = 8000; // pausa tras interacción manual

function stopCarouselAuto(){
  if (CAR_AUTO_ID) {
    clearInterval(CAR_AUTO_ID);
    CAR_AUTO_ID = null;
  }
}

function startCarouselAuto(){
  stopCarouselAuto();

  // Solo autoplay cuando estás en "relevantes"
  if (activeView !== 'relevantes') return;

  CAR_AUTO_ID = setInterval(() => {
    // pausa cuando el usuario tocó algo
    if (Date.now() < CAR_AUTO_PAUSE_UNTIL) return;

    // no girar si la pestaña está en background
    if (document.hidden) return;

    const total = Math.min(5, Array.isArray(POSTS_CACHE) ? POSTS_CACHE.length : 0);
    if (total <= 1) return;

    carIndex = (carIndex + 1) % total;

    // ✅ MUY IMPORTANTE: no llamamos renderAll() (evita fetch constante)
    // Solo repintamos carrusel/dots/transform:
    renderCarousel(POSTS_CACHE);
  }, CAR_AUTO_MS);
}

// helper para pausar al tocar flechas/dots
function pauseCarouselAuto(){
  CAR_AUTO_PAUSE_UNTIL = Date.now() + CAR_AUTO_PAUSE_MS;
}

// =========================
// Feed UI (limit + modal paging)
// =========================
const FEED_PREVIEW_LIMIT = 5;      // muestra solo 5 en el feed principal
const FEED_MODAL_PAGE_SIZE = 10;   // paginación de 10 en 10 en el modal
let FEED_MODAL_PAGE = 0;           // página actual en el modal
let FEED_LAST_LIST = [];           // cache del último listado (según filtros)


function renderPanel(){
  document.getElementById('panelTitle').textContent = PANEL_MODEL[activeView].title;
  document.getElementById('panelDesc').textContent = PANEL_MODEL[activeView].desc;
}

async function renderAll(){
  const posts = await getPostsSafe();
  POSTS_CACHE = posts;
  renderTopicsSelect();
  renderPanel();
  renderCarousel(posts);
  renderLatest(posts);
  renderFeed(posts);
  renderMiniGrid('topWeek', filterWeek(posts));
  renderMiniGrid('topMonth', filterMonth(posts));
  applyActionState(); // ✅ al final, cuando ya existe el DOM
}


function renderReplies(comment, postId){
  const ui = loadUI();
  const expanded = !!ui.expand?.[comment.id];
  const replies = (comment.replies || []).slice().reverse(); // newest first
  const visible = expanded ? replies : replies.slice(0, 2);

  const items = visible.map(r => `
<div class="comment comment-l2" data-reply-id="${esc(r.id)}">
  
<div class="comment-headrow">
  <div>
    <span class="comment-author">
      ${authorLinkHTML(r.author)}
    </span>
    <span class="muted small">
      ${esc(fmt(r.ts))}
    </span>
  </div>

  <button
    class="kebab-btn"
    type="button"
    data-kebab="${esc(r.id)}"
    aria-label="Opciones"
  >
    ⋮
  </button>

  ${commentKebabMenuHTML({
    postId,
    comment: r,
    isReply: true,
    parentId: comment.id
  })}
</div>

      

      <p>${esc(r.text)}</p>
      <div class="post-tags">
        <span class="pill like" data-action="c-like" data-post-id="${esc(postId)}" data-comment-id="${esc(comment.id)}" data-reply-id="${esc(r.id)}">
          ♥️ <span class="count">${r.likes||0}</span>
        </span>
        <span class="pill points" data-action="c-points" data-post-id="${esc(postId)}" data-comment-id="${esc(comment.id)}" data-reply-id="${esc(r.id)}">
          ⭐ <span class="count">${r.points||0}</span>
        </span>
      </div>
    </div>
  `).join('');

  const moreN = Math.max(0, replies.length - 2);
  const moreBtn = (!expanded && moreN > 0)
    ? `<button class="btn" type="button" data-replies-more="${esc(comment.id)}" data-post-id="${esc(postId)}">Ver más (${moreN})</button>`
    : (expanded && replies.length > 2)
      ? `<button class="btn" type="button" data-replies-less="${esc(comment.id)}" data-post-id="${esc(postId)}">Ocultar</button>`
      : '';

  return `
    <div class="comment-preview">
      ${items || ''}
      ${moreBtn ? `<div style="margin-top:8px">${moreBtn}</div>` : ''}
    </div>
  `;
}

function renderComments(post){
  const comments = (post.comments || []).slice().reverse(); // newest first

  if(!comments.length){
    return `<p class="small muted">Sin comentarios.</p>`;
  }

  return comments.map(c => `
    
<div class="comment comment-l1" data-comment-id="${esc(c.id)}">
  
<div class="comment-headrow">
  <div>
    <span class="comment-author">
      ${authorLinkHTML(c.author)}
    </span>
    <span class="muted small">
      ${esc(fmt(c.ts))}
    </span>
  </div>

  <button
    class="kebab-btn"
    type="button"
    data-kebab="${esc(c.id)}"
    aria-label="Opciones"
  >
    ⋮
  </button>

  ${commentKebabMenuHTML({ postId: post.id, comment: c })}
</div>


      <p>${esc(c.text)}</p>

      <div class="post-tags">
        <span class="pill like" data-action="c-like" data-post-id="${esc(post.id)}" data-comment-id="${esc(c.id)}">
          ♥️ <span class="count">${c.likes||0}</span>
        </span>
        <span class="pill points" data-action="c-points" data-post-id="${esc(post.id)}" data-comment-id="${esc(c.id)}">
          ⭐ <span class="count">${c.points||0}</span>
        </span>
        <span class="pill comment" data-action="c-reply" data-post-id="${esc(post.id)}" data-comment-id="${esc(c.id)}">
          ↩️ Responder
        </span>
      </div>

      ${renderReplies(c, post.id)}
    </div>
  `).join('');
}


function updateModalPostCounts(postId){
  const m = document.getElementById('daoModal');
  if (!m || !m.classList.contains('open')) return;

  const id = String(postId);

  // 1) Preferimos cache (source: renderAll/getPostsSafe)
  let p = Array.isArray(POSTS_CACHE) ? POSTS_CACHE.find(x => String(x.id) === id) : null;

  // 2) Fallback localStorage
  if (!p) p = getPostByIdFromLocal(id);
  if (!p) return;

  const likeBtn = m.querySelector(`button[data-like="${id}"] .count`);
  const pointBtn = m.querySelector(`button[data-point="${id}"] .count`);

  if (likeBtn) likeBtn.textContent = String(p.likes || 0);
  if (pointBtn) pointBtn.textContent = String(p.points || 0);
}



// =========================
// Post modal (BACKEND-first)
// =========================


let CURRENT_MODAL_POST_ID = null;
let CURRENT_MODAL_POST = null; // guarda el post completo del modal (source of truth para comments/replies)

async function openPostModal(postId) {
  const idStr = String(postId);

  // 1) Source of truth: backend
  let p = null;
  try {
    p = await API.getPost(idStr);
  } catch (err) {
    console.warn("API.getPost falló, usando fallback local:", err);
  }

  // 2) Fallback: cache/localStorage (modo demo/offline)
  if (!p) {
    const posts = POSTS_CACHE.length ? POSTS_CACHE : await getPostsSafe();
    const raw = posts.find(x => String(x.id) === idStr);
    p = ensurePostSchema(raw);
  }

  if (!p) return;

  CURRENT_MODAL_POST_ID = idStr;
  CURRENT_MODAL_POST = p;
  document.getElementById('daoModalTitle').textContent = 'Post';

  const ui = loadUI();
  const replyingTo =
    ui.replyTo && String(ui.replyTo.postId) === idStr ? ui.replyTo : null;

  // Render del modal (post + acciones + comentarios)
  document.getElementById('daoModalBody').innerHTML = `
    <div class="sheet-item">
      <div class="post-headrow">
        <div>
          <div class="t">${esc(p.title)}</div>
          <div class="post-author">${authorLinkHTML(p.author)}</div>
          <div class="m">${esc(p.topic || 'Sin tema')} · ${esc(fmt(p.ts))}</div>
        </div>

        <button class="kebab-btn" type="button" data-kebab="${esc(p.id)}" aria-label="Opciones">⋮</button>

        ${kebabMenuHTML(p)}
      </div>

      <div style="margin-top:10px;white-space:pre-wrap;">${esc(p.body || '')}</div>

      <div style="margin-top:12px;display:flex;gap:10px;flex-wrap:wrap;">
        <button class="btn" type="button" data-like="${esc(p.id)}">
          ♥️ <span class="count">${getLikesCount(p)}</span>
        </button>

        <button class="btn" type="button" data-point="${esc(p.id)}">
          ⭐ <span class="count">${getPointsCount(p)}</span>
        </button>

        <button class="btn" type="button" data-share="${esc(p.id)}">🔗 Copiar link</button>
      </div>
    </div>

    <div style="margin-top:14px;">
      <div class="h2">Comentarios</div>

      <div id="commentsWrap">
        ${renderComments(p)}
      </div>

      ${replyingTo ? `
        <div class="small muted" style="margin-top:10px;">
          Respondiendo a comentario…
          <button class="btn" type="button" data-reply-cancel="${esc(p.id)}">Cancelar</button>
        </div>
      ` : ''}

      <div style="margin-top:10px;display:flex;gap:10px;flex-wrap:wrap;">
        <input id="commentText" placeholder="${replyingTo ? 'Escribe una respuesta…' : 'Escribe un comentario…'}">
        <button class="btn primary" type="button" data-send="${esc(p.id)}">
          ${replyingTo ? 'Responder' : 'Enviar'}
        </button>
      </div>
    </div>
  `;



openModal();

__modalJustOpenedTs = Date.now();
__kebabSuppressUntil = Date.now() + 350;

// ✅ Un solo cierre garantizado post-reflow
setTimeout(() => {
  closeAllKebabs();
}, 0);

applyActionState();
updateModalPostCounts(idStr);


}




async function copyLink(id){
  const url = location.href.split('#')[0] + `#post-${id}`;
  try{ await navigator.clipboard.writeText(url); }catch{}
}



function mutatePost(id, fn) {
  const idStr = String(id);

  // 1) Actualiza cache en memoria SIEMPRE (backend-first)
  if (Array.isArray(POSTS_CACHE) && POSTS_CACHE.length) {
    const cidx = POSTS_CACHE.findIndex(p => String(p.id) === idStr);
    if (cidx !== -1) {
      const next = fn(ensurePostSchema(POSTS_CACHE[cidx])) || POSTS_CACHE[cidx];
      POSTS_CACHE[cidx] = next;
    }
  }

  // 2) Actualiza localStorage SOLO si existe (modo demo/offline)
  const posts = loadJSON(DB_KEY, []);
  const idx = posts.findIndex(p => String(p.id) === idStr);
  if (idx !== -1) {
    const next = fn(ensurePostSchema(posts[idx])) || posts[idx];
    posts[idx] = next;
    saveJSON(DB_KEY, posts);
  }
}

// =========================
// Rooms API (backend-ready) + fallback localStorage
// =========================
async function apiGetRooms(type){
  try{
    const r = await fetch(
      `${API_BASE}/api/rooms?type=${encodeURIComponent(type)}`,
      {
        cache: "no-store",
        headers: authHeadersGet(),
      }
    );

    if (r.ok) {
      const data = await r.json().catch(() => ({}));

      // ✅ Nuevo formato backend (objetos con metadata)
      if (Array.isArray(data?.rooms)) return data.rooms;

      // ✅ Compatibilidad con formato legacy
      if (Array.isArray(data?.names)) return data.names;
    }
  } catch (e) {
    // backend caído / offline
  }

  return null;
}

async function apiCreateRoom(type, name, days = 1, visibility = "private", password = ""){
  const r = await fetch(`${API_BASE}/api/rooms`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify({
      type,
      name,
      durationDays: days,
      visibility,
      password
    }),
  });

  if (!r.ok){
    const msg = await readErr(r);
    throw new Error(msg || "No se pudo crear la sala");
  }

  return await r.json().catch(() => ({}));
}


// Local storage helpers
function loadRoomsLocal(key){
  const raw = loadJSON(key, null);

  // Compat legacy: si antes guardabas en ROOMS_KEY
  if (!raw && key === BACKROOMS_KEY){
    const legacy = loadJSON(ROOMS_KEY, []);
    if (Array.isArray(legacy) && legacy.length) return legacy;
  }

  return Array.isArray(raw) ? raw : [];
}

function saveRoomsLocal(key, rooms){
  saveJSON(key, rooms);
}

/* =========================
   Rooms / Topics modales
========================= */

// --- helpers room modal (UI-only por ahora) ---
function roomCfgKey(type, name) {
  return `alemty.roomcfg.${type}.${String(name).toLowerCase()}`;
}

function loadRoomCfg(type, name) {
  try {
    const raw = localStorage.getItem(roomCfgKey(type, name));
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function saveRoomCfg(type, name, cfg) {
  localStorage.setItem(roomCfgKey(type, name), JSON.stringify(cfg));
}

// Modal tipo Discord (estructura editable por owner/founder; UX-only por ahora)
// --- helpers chat (UI-only por ahora) ---
function roomChatKey(type, name) {
  return `alemty.roomchat.${type}.${String(name).toLowerCase()}`;
}
function loadRoomChat(type, name) {
  try {
    const raw = localStorage.getItem(roomChatKey(type, name));
    const arr = raw ? JSON.parse(raw) : [];
    return Array.isArray(arr) ? arr : [];
  } catch {
    return [];
  }
}
function saveRoomChat(type, name, msgs) {
  localStorage.setItem(roomChatKey(type, name), JSON.stringify(msgs || []));
}


// Modal tipo Discord (estructura editable por owner/founder)
async function openRoomModal({ type, name }) {
  // ✅ CONTROL DE ACCESO REAL (backend)
  const gate = await getRoomAccess(name, type);

  if (!gate.access) {
    if (gate.visibility === "password") {
      const pwd = prompt("🔐 Esta sala requiere contraseña:");
      if (!pwd) return;

      const r = await fetch(
        `${API_BASE}/api/rooms/${encodeURIComponent(name)}/join?type=${encodeURIComponent(type)}`,
        {
          method: "POST",
          headers: authHeaders(),
          body: JSON.stringify({ password: pwd }),
        }
      );

      if (!r.ok) {
        const msg = await r.text().catch(() => "");
        alert("❌ Contraseña incorrecta" + (msg ? ` (${msg})` : ""));
        return;
      }

      return await openRoomModal({ type, name });
    }

    alert("⛔ No tienes acceso a esta sala");
    return;
  }

  // ✅ NO duplicar variables
  const addr = getViewerAddress();
  const me = String(addr || "").toLowerCase();

  const FOUNDER = "0x6a202f991c4c1df079449be9847b1dac3f51854f";
  const isFounder = me === FOUNDER;

  let cfg = loadRoomCfg(type, name);
  if (!cfg) {
    const defaultSections =
      type === "governance"
        ? [
            { id: "proposals", label: "📄 Propuestas" },
            { id: "votes", label: "🗳️ Votaciones" },
            { id: "constitution", label: "📌 Constitución" },
            { id: "chat", label: "🗨️ Foro libre" },
            { id: "settings", label: "⚙️ Ajustes" },
          ]
        : [
            { id: "general", label: "💬 General" },
            { id: "announcements", label: "📣 Anuncios" },
            { id: "chat", label: "🗨️ Foro libre" },
            { id: "mods", label: "🛡️ Moderación" },
            { id: "settings", label: "⚙️ Ajustes" },
          ];

    cfg = {
      version: 1,
      type,
      name,
      owner: me || "",
      visibility: "private",
      passwordHint: "",
      sections: defaultSections,
    };
    saveRoomCfg(type, name, cfg);
  }

  const isOwner = String(cfg.owner || "").toLowerCase() === me;
  const canManage = isFounder || isOwner;

  const icon = type === "governance" ? "🗳️" : "🏚️";
  document.getElementById("daoModalTitle").textContent = `${icon} ${name}`;
  document.getElementById("daoModalBody").innerHTML = `
    <div style="display:grid;grid-template-columns:240px 1fr;gap:12px;">
      <aside style="border:1px solid var(--border);border-radius:16px;padding:10px;background:rgba(255,255,255,.04);">
        <div class="small muted" style="margin-bottom:10px;">Secciones</div>
        <div id="roomNav" style="display:flex;flex-direction:column;gap:8px;">
          ${cfg.sections
            .map(
              (s) => `
              <button class="btn" type="button" data-room-tab="${esc(s.id)}" style="text-align:left;">
                ${esc(s.label)}
              </button>
            `
            )
            .join("")}
        </div>

        <div style="margin-top:12px;">
          <div class="small muted">Acceso</div>
          <div class="small" style="margin-top:6px;">
            <span class="pill">${canManage ? "👑 Admin" : "👤 Miembro"}</span>
            <span class="pill">${esc(String(gate.visibility || cfg.visibility || "private"))}</span>
          </div>
        </div>

        ${
          canManage
            ? `
          <div style="margin-top:12px;">
            <div class="small muted">Admin</div>
            <button class="btn primary" type="button" id="roomEditBtn">Editar estructura</button>
          </div>
        `
            : `
          <div class="small muted" style="margin-top:12px;">Solo creador/founder puede editar.</div>
        `
        }
      </aside>

      <section style="border:1px solid var(--border);border-radius:16px;padding:12px;background:rgba(255,255,255,.04);">
        <div id="roomTabTitle" class="h2" style="margin:0 0 6px;">${
          type === "governance" ? "📄 Propuestas" : "💬 General"
        }</div>
        <div id="roomTabContent" class="small muted">
          Contenido de sala — siguiente fase.
        </div>
      </section>
    </div>
  `;

  openModal();

  const tabTitle = document.getElementById("roomTabTitle");
  const tabContent = document.getElementById("roomTabContent");

  function renderChat() {
    const msgs = loadRoomChat(type, name);
    const canPost = !!getJWT();

    tabContent.innerHTML = `
      <div class="sheet-item">
        <div class="t">🗨️ Foro libre</div>
        <div class="small muted">Chat estilo foro (guardado local por ahora).</div>
      </div>

      <div id="roomChatList"
           style="display:flex; flex-direction:column; gap:10px; max-height:260px; overflow:auto; padding-right:4px; margin-top:10px;">
        ${
          msgs.length
            ? msgs
                .slice(-200)
                .map(
                  (m) => `
                  <div class="sheet-item">
                    <div class="small muted">${esc(m.author || "anon")} · ${esc(m.when || "")}</div>
                    <div style="white-space:pre-wrap;">${esc(m.text || "")}</div>
                  </div>
                `
                )
                .join("")
            : `<div class="small muted" style="padding:6px 2px;">Aún no hay mensajes.</div>`
        }
      </div>

      <div class="sheet-item" style="margin-top:10px; ${canPost ? "" : "opacity:.6;"}">
        <div class="t">Escribir</div>
        <textarea id="roomChatInput"
          placeholder="${canPost ? "Escribe un mensaje…" : "Inicia SIWE para escribir"}"
          style="min-height:90px;" ${canPost ? "" : "disabled"}></textarea>
        <div style="margin-top:10px; display:flex; gap:10px; flex-wrap:wrap;">
          <button class="btn primary" id="roomChatSend" type="button" ${canPost ? "" : "disabled"}>Enviar</button>
        </div>
      </div>
    `;

    document.getElementById("roomChatSend")?.addEventListener("click", () => {
      const input = document.getElementById("roomChatInput");
      const text = String(input?.value || "").trim();
      if (text.length < 1) return;

      const now = new Date();
      const entry = {
        id: (crypto.randomUUID?.() || String(Math.random())).slice(0, 12),
        author: me ? `${me.slice(0, 6)}…${me.slice(-4)}` : "anon",
        when: now.toLocaleString("es-MX"),
        text,
      };

      const current = loadRoomChat(type, name);
      current.push(entry);
      saveRoomChat(type, name, current);

      if (input) input.value = "";
      renderChat();
      const list = document.getElementById("roomChatList");
      if (list) list.scrollTop = list.scrollHeight;
    });
  }

  
function setTab(id) {
  const sec = cfg.sections.find((x) => x.id === id) || cfg.sections[0];
  tabTitle.textContent = sec.label;

  if (id === "proposals") {
    tabContent.innerHTML = `
      <div class="sheet-item">
        <div class="t">📄 Propuestas</div>
        <div class="small muted">Aquí irá listado de propuestas (fase siguiente).</div>
      </div>
    `;
    return;
  }

  if (id === "votes") {
    tabContent.innerHTML = `
      <div class="sheet-item">
        <div class="t">🗳️ Votaciones</div>
        <div class="small muted">Aquí irá sistema de votación (fase siguiente).</div>
      </div>
    `;
    return;
  }

  if (id === "constitution") {
    tabContent.innerHTML = `
      <div class="sheet-item">
        <div class="t">📌 Constitución</div>
        <div class="small muted">Aquí irá la constitución / documentos (fase siguiente).</div>
      </div>
    `;
    return;
  }

  if (id === "chat") {
    renderChat();
    return;
  }

  if (id === "mods") {
    tabContent.innerHTML = `
      <div class="sheet-item">
        <div class="t">🛡️ Moderación</div>
        <div class="small muted">Lista de mods / permisos (fase siguiente).</div>
      </div>
    `;
    return;
  }

  // ✅ SETTINGS + INVITACIÓN 3.5 (sin backend)
  if (id === "settings") {
    tabContent.innerHTML = canManage
      ? `
        <div class="sheet-item">
          <div class="t">Visibilidad</div>
          <select id="roomVis">
            <option value="public"${cfg.visibility === "public" ? " selected" : ""}>Pública</option>
            <option value="private"${cfg.visibility === "private" ? " selected" : ""}>Privada (solo invitados)</option>
            <option value="password"${cfg.visibility === "password" ? " selected" : ""}>Privada con contraseña</option>
          </select>
        </div>

        <div class="sheet-item">
          <div class="t">Contraseña (solo si password)</div>
          <input id="roomPass" value="${esc(cfg.passwordHint || "")}" />
        </div>

        <button class="btn primary" type="button" id="roomSaveCfg">Guardar</button>

        <hr style="border:none;border-top:1px solid var(--border);margin:12px 0;opacity:.6;" />

        <div class="sheet-item">
          <div class="t">Invitar (Address / ENS / DID)</div>
          <div class="small muted" style="margin-top:6px;">
            Sin backend: genera SQL/comando para insertar en <code>room_members</code>.
          </div>

          <input id="inviteTarget" placeholder="0xABC... ó satoshi.eth ó miDID" style="margin-top:10px;" />

          <div style="display:flex; gap:10px; flex-wrap:wrap; margin-top:10px;">
            <button class="btn" type="button" id="inviteCopySql">Copiar SQL</button>
            <button class="btn" type="button" id="inviteCopyLocal">Copiar comando (local)</button>
            <button class="btn" type="button" id="inviteCopyRemote">Copiar comando (remote)</button>
          </div>

          <div class="small muted" style="margin-top:10px;">
            Address Book local (para resolver ENS/DID):
          </div>

          <div style="display:flex; gap:10px; flex-wrap:wrap; margin-top:8px;">
            <input id="abLabel" placeholder="Etiqueta (ej: satoshi.eth / miDID)" style="max-width:240px;" />
            <input id="abAddr" placeholder="Address 0x..." style="min-width:260px; flex:1;" />
            <button class="btn" type="button" id="abSave">Guardar</button>
          </div>

          <div id="inviteStatus" class="small muted" style="margin-top:10px;"></div>
        </div>
      `
      : `<div class="small muted">Sin permisos para ajustar esta sala.</div>`;


      if (canManage) {
        queueMicrotask(() => {
          const vis = document.getElementById("roomVis");
          const pass = document.getElementById("roomPass");
          const btn = document.getElementById("roomSaveCfg");
          if (!vis || !pass || !btn) return;

          
// Sync UI password field
        const sync = () => {
          const isPwd = vis.value === "password";
          pass.disabled = !isPwd;
          pass.placeholder = isPwd ? "Ingresa contraseña" : "(no aplica)";
          if (!isPwd) pass.value = "";
        };
        vis.addEventListener("change", sync);
        sync();


          
// ✅ Guardar settings (backend)
        btn.onclick = async () => {
          const v = vis.value || "private";
          const p = (pass.value || "").trim();

          if (v === "password" && !p) {
            alert("Debes ingresar una contraseña");
            return;
          }


            const r = await fetch(
              `${API_BASE}/api/rooms/${encodeURIComponent(name)}/settings?type=${encodeURIComponent(type)}`,
              {
                method: "PATCH",
                headers: authHeaders(),
                body: JSON.stringify({
                  visibility: v,
                  password: v === "password" ? p : "",
                }),
              }
            );

            if (!r.ok) {
              const msg = await r.text().catch(() => "");
              alert("❌ No se pudo guardar" + (msg ? `: ${msg}` : ""));
              return;
            }

            const data = await r.json().catch(() => ({}));
            cfg.visibility = String(data?.visibility || v);
            cfg.passwordHint = v === "password" ? p : "";
            saveRoomCfg(type, name, cfg);

            alert("Guardado ✅ (backend)");
            await openRoomModal({ type, name });
          };


// ✅ Invitación (sin backend) — listeners
        const inviteTarget = document.getElementById("inviteTarget");
        const inviteStatus = document.getElementById("inviteStatus");
        const btnSql = document.getElementById("inviteCopySql");
        const btnLocal = document.getElementById("inviteCopyLocal");
        const btnRemote = document.getElementById("inviteCopyRemote");

        const abLabel = document.getElementById("abLabel");
        const abAddr = document.getElementById("abAddr");
        const abSave = document.getElementById("abSave");

        const setInviteStatus = (msg) => {
          if (inviteStatus) inviteStatus.textContent = String(msg || "");
          };

        });
      }
      return;
    }

    tabContent.textContent = "Contenido de sala — siguiente fase.";
  }

  // ✅ listeners de navegación (tabs)
  document.querySelectorAll("[data-room-tab]").forEach((b) => {
    b.addEventListener("click", () => setTab(b.getAttribute("data-room-tab")));
  });

  // ✅ Admin: editar estructura (solo si puede)
  if (canManage) {
    document.getElementById("roomEditBtn")?.addEventListener("click", () => {
      tabTitle.textContent = "⚙️ Editar estructura";
      tabContent.innerHTML = `
        <div class="sheet-item">
          <div class="t">Secciones (JSON)</div>
          <textarea id="roomSectionsJson" style="min-height:160px;">${esc(
            JSON.stringify(cfg.sections, null, 2)
          )}</textarea>
          <div class="small muted" style="margin-top:6px;">
            Formato: [{ "id": "chat", "label": "🗨️ Foro libre" }, ...]
          </div>
        </div>
        <button class="btn primary" type="button" id="roomApplySections">Aplicar</button>
      `;

      document.getElementById("roomApplySections")?.addEventListener("click", () => {
        try {
          const raw = document.getElementById("roomSectionsJson")?.value || "[]";
          const next = JSON.parse(raw);
          if (!Array.isArray(next) || next.length === 0) throw new Error("sections inválidas");
          cfg.sections = next;
          saveRoomCfg(type, name, cfg);
          openRoomModal({ type, name }); // re-render
        } catch {
          alert("JSON inválido para secciones");
        }
      });
    });
  }

  // ✅ default tab (SIEMPRE al final)
  if (type === "governance") setTab("proposals");
  else setTab("general");
}

// --- modal principal de backrooms ---
function openRoomsModal() {
  // 1) Cargar salas: backend-first; si no, fallback local
  const loadRooms = async () => {
    let rooms = null;
    try { rooms = await apiGetRooms("backroom"); } catch {}
    if (Array.isArray(rooms)) return rooms;

    const localNew = loadJSON(BACKROOMS_KEY, null);
    if (Array.isArray(localNew)) return localNew;

    const legacy = loadJSON(ROOMS_KEY, []);
    return Array.isArray(legacy) ? legacy : [];
  };

  (async () => {
    // ✅ Loading state rápido (UX)
    document.getElementById("daoModalTitle").textContent = "Backrooms";
    document.getElementById("daoModalBody").innerHTML = `
      <div class="small muted" style="padding:20px;text-align:center;">
        Cargando salas…
      </div>
    `;
    openModal();

    const rawRooms = await loadRooms();

    // ✅ Normaliza: acepta strings legacy Y objetos nuevos (metadata)
    const roomsAll = (Array.isArray(rawRooms) ? rawRooms : [])
      .map((r) => {
        if (typeof r === "string") {
          const n = r.trim();
          return n ? { id: null, name: n, visibility: "private", created_by: null } : null;
        }
        if (r && typeof r === "object") {
          const n = String(r.name || "").trim();
          if (!n) return null;
          return {
            id: r.id ?? null,
            name: n,
            visibility: String(r.visibility || "private"),
            created_by: r.created_by || null,
          };
        }
        return null;
      })
      .filter(Boolean);

    // Estado UI (persistente opcional)
    const STATE_KEY = "alemty.ui.backrooms.v1";
    const state = (() => {
      try { return JSON.parse(localStorage.getItem(STATE_KEY) || "{}"); } catch { return {}; }
    })();

    let q = String(state.q || "").trim();
    let page = Number.isFinite(state.page) ? Number(state.page) : 0;

    const saveState = () => {
      localStorage.setItem(STATE_KEY, JSON.stringify({ q, page }));
    };

    // Render base del modal
    document.getElementById("daoModalTitle").textContent = "Backrooms";
    document.getElementById("daoModalBody").innerHTML = `
      <div class="sheet-item">
        <div class="t">🏚️ Backrooms</div>
        <div class="m small muted">Crea salas temáticas. Toca una sala para abrirla.</div>
      </div>

      <!-- ✅ Crear sala (con select inline) -->
      <div class="sheet-item" style="margin-top:10px;">
        <div class="t">Crear sala</div>

        <input id="backroomName" placeholder="Nombre de la sala…" maxlength="48" />

        <div style="margin-top:10px;">
          <div class="small muted" style="margin-bottom:6px;">Tipo de acceso</div>
          <select id="backroomVisibility" style="width:100%;">
            <option value="public">🌐 Pública — cualquiera puede unirse</option>
            <option value="private" selected>🔒 Privada — solo por invitación</option>
            <option value="password">🔐 Contraseña — acceso con clave</option>
          </select>
        </div>

        <div id="backroomPassWrap" style="margin-top:10px; display:none;">
          <div class="small muted" style="margin-bottom:6px;">Contraseña de la sala</div>
          <input id="backroomPass" type="password" placeholder="Ingresa contraseña…" />
        </div>

        <div style="display:flex; gap:10px; margin-top:10px; align-items:center; flex-wrap:wrap;">
          <input id="backroomDays" type="number" min="1" value="1" placeholder="Días de acceso" style="max-width:160px;" />
          <button class="btn primary" id="createBackroomBtn" type="button">Crear</button>
          <button class="btn" type="button" data-close="1">Cerrar</button>
        </div>

        <div class="small muted" style="margin-top:8px;">
          Ej: 1 día = 100 Aura · 7 días = 700 Aura
        </div>

        <div id="backroomStatus" class="small muted" style="margin-top:10px;"></div>
      </div>

      <!-- ✅ Buscar -->
      <div class="sheet-item" style="margin-top:10px;">
        <div class="t">Buscar salas</div>
        <input id="roomsSearch" placeholder="Buscar…" value="${esc(q)}" />
        <div class="small muted" style="margin-top:6px;">
          Tip: escribe 2+ caracteres para filtrar.
        </div>
      </div>

      <!-- ✅ Lista -->
      <div class="sheet-item" style="margin-top:10px;">
        <div class="t">Salas</div>
        <div class="small muted" id="roomsMeta"></div>
      </div>

      <div id="roomsList"
           style="display:flex; flex-direction:column; gap:8px; max-height:320px; overflow:auto; padding-right:4px;">
      </div>

      <div id="roomsPager"
           style="margin-top:12px; display:flex; gap:10px; justify-content:space-between; align-items:center; flex-wrap:wrap;">
        <button class="btn" id="roomsPrev" type="button">◀ Anterior</button>
        <div class="small muted" id="roomsPageInfo"></div>
        <button class="btn" id="roomsNext" type="button">Siguiente ▶</button>
      </div>
    `;

    // ✅ mostrar/ocultar password según select
    document.getElementById("backroomVisibility")?.addEventListener("change", (e) => {
      const wrap = document.getElementById("backroomPassWrap");
      const v = e.target?.value || "private";
      if (wrap) wrap.style.display = v === "password" ? "block" : "none";
    });

    const statusEl = document.getElementById("backroomStatus");
    const btnCreate = document.getElementById("createBackroomBtn");
    const listEl = document.getElementById("roomsList");
    const metaEl = document.getElementById("roomsMeta");
    const pageInfoEl = document.getElementById("roomsPageInfo");
    const prevBtn = document.getElementById("roomsPrev");
    const nextBtn = document.getElementById("roomsNext");
    const searchEl = document.getElementById("roomsSearch");

    const PAGE_SIZE = 10;

    function getFiltered() {
      const needle = q.trim().toLowerCase();
      if (needle.length >= 2) {
        return roomsAll.filter((room) => room.name.toLowerCase().includes(needle));
      }
      return roomsAll.slice();
    }

    function visLabel(v) {
      return v === "public" ? "🌐 Pública" : v === "password" ? "🔐 Contraseña" : "🔒 Privada";
    }

    function renderList() {
      const filtered = getFiltered();
      const total = filtered.length;

      const maxPage = Math.max(0, Math.ceil(total / PAGE_SIZE) - 1);
      page = Math.max(0, Math.min(page, maxPage));

      const start = page * PAGE_SIZE;
      const pageItems = filtered.slice(start, start + PAGE_SIZE);

      metaEl.textContent = total
        ? `Mostrando ${Math.min(total, start + 1)}–${Math.min(total, start + pageItems.length)} de ${total}`
        : "Aún no hay salas. ¡Crea la primera!";

      pageInfoEl.textContent = `Página ${maxPage + 1 ? page + 1 : 0} de ${maxPage + 1}`;

      prevBtn.disabled = page <= 0;
      nextBtn.disabled = page >= maxPage || total === 0;

      listEl.innerHTML = pageItems.length
        ? pageItems.map((room) => `
            <button class="sheet-item room-item" type="button" data-room-open="${esc(room.name)}">
              <div class="t">${esc(room.name)}</div>
              <div class="small muted">${visLabel(room.visibility)} · Abrir</div>
            </button>
          `).join("")
        : `<div class="small muted" style="padding:8px 2px;">No hay resultados.</div>`;

      listEl.querySelectorAll("[data-room-open]").forEach((btn) => {
        btn.addEventListener("click", () => {
          const roomName = btn.getAttribute("data-room-open");
          if (roomName) openRoomModal({ type: "backroom", name: roomName });
        });
      });

      saveState();
    }

    prevBtn.addEventListener("click", () => { page = Math.max(0, page - 1); renderList(); });
    nextBtn.addEventListener("click", () => { page = page + 1; renderList(); });

    let tId = null;
    searchEl.addEventListener("input", () => {
      q = String(searchEl.value || "");
      page = 0;
      if (tId) clearTimeout(tId);
      tId = setTimeout(() => renderList(), 120);
    });

    // ✅ Crear sala (SIN prompt)
    btnCreate.onclick = async () => {
      const name = (document.getElementById("backroomName")?.value || "").trim();
      const visibility = document.getElementById("backroomVisibility")?.value || "private";
      const password = (document.getElementById("backroomPass")?.value || "").trim();

      if (name.length < 3) {
        if (statusEl) statusEl.textContent = "Nombre muy corto (mínimo 3 caracteres).";
        return;
      }

      if (visibility === "password" && password.length < 1) {
        if (statusEl) statusEl.textContent = "Debes ingresar una contraseña.";
        return;
      }

      if (!getJWT()) {
        if (statusEl) statusEl.textContent = "Necesitas SIWE (JWT) para crear salas.";
        return;
      }

      btnCreate.disabled = true;
      try {
        const days = Number(document.getElementById("backroomDays")?.value || 1);
        const safeDays = Number.isFinite(days) ? Math.max(1, Math.min(365, days)) : 1;
        const cost = safeDays * 100;

        if (statusEl) statusEl.textContent = `Costo: ${cost} Aura · Creando sala…`;

        // ✅ Usa tu helper actualizado
        await apiCreateRoom("backroom", name, safeDays, visibility, visibility === "password" ? password : "");

        if (statusEl) statusEl.textContent = "Sala creada ✅";
        openRoomsModal(); // refresh modal
      } catch (err) {
        if (statusEl) statusEl.textContent = err?.message || "Error creando sala.";
      } finally {
        btnCreate.disabled = false;
      }
    };

    renderList();
  })();
}

// =========================
// GOVERNANZA — Access gate (Nobleza + Moderación + Founder)
// Basado en docs:
// - Gobernanza política: veALEMTY (no Aura)
// - Nobleza: Rey/Príncipe/Duque (calculada sobre veALEMTY activo)
// Backend debe ENFORCEAR esto; frontend es UX.
// =========================

// Founder allowlist (tu address)
const GOVERNANCE_FOUNDERS = new Set([
  '0x6a202f991c4c1df079449be9847b1dac3f51854f'
]);

// Lee roles desde localStorage (fallback UX)

function getLocalRoles(){
  const raw = localStorage.getItem('alemty.roles') || localStorage.getItem('roles') || '';
  try{
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? arr.map(x => String(x).toLowerCase()) : [];
  }catch{
    return String(raw).split(',').map(s => s.trim().toLowerCase()).filter(Boolean);
  }
}
function isLocalModerator(){
  const roles = getLocalRoles();
  return roles.includes('moderator') || roles.includes('mod') || roles.includes('admin');
}
function getLocalNobleRank(){
  const raw =
    localStorage.getItem('alemty.nobleRank') ||
    localStorage.getItem('alemty.noble') ||
    localStorage.getItem('nobleRank') ||
    '';
  const v = String(raw || '').trim().toLowerCase();
  if (!v) return '';
  return (v === 'príncipe') ? 'principe' : v;
}
function getLocalVeAlem(){
  const raw =
    localStorage.getItem('alemty.vealem') ||
    localStorage.getItem('vealem') ||
    localStorage.getItem('veALEM') ||
    '0';
  const n = Number(raw);
  return Number.isFinite(n) ? n : 0;
}
function getLocalEns(){
  return String(
    localStorage.getItem('alemty.ens') ||
    localStorage.getItem('ens') ||
    ''
  ).trim().toLowerCase();
}

function isFounder(){
  const me = String(getViewerAddress()).toLowerCase();
  const ens = getLocalEns();
  return GOVERNANCE_FOUNDERS.has(me) || ens === 'alemty.eth';
}


/**
 * getGovernanceAccess()
 * - okRead: puede VER gobernanza (Rey/Principe/Duque o Moderación o Founder)
 * - okWrite: puede CREAR salas (Rey/Principe o Moderación o Founder)
 *
 * Backend recomendado:
 * GET /api/me -> { roles:[], nobleRank:'rey|principe|duque', veAlem:number, address, ens }
 */
async function getGovernanceAccess() {
  // =========================
  // 1) Verificar JWT
  // =========================
  const jwt = getJWT();
  if (!jwt) {
    return {
      okRead: false,
      okWrite: false,
      reason: "Necesitas SIWE (JWT) para acceder a gobernanza.",
      isModerator: false,
      nobleRank: "",
      veAlem: 0,
      isFounder: false,
    };
  }

  // Helpers locales (UX dev)
  const localIsModerator = isLocalModerator();
  const localNobleRank = getLocalNobleRank(); // 'rey'|'principe'|'duque'|''
  const localVeAlem = getLocalVeAlem();
  const localIsNoble =
    (localNobleRank === "rey" || localNobleRank === "principe" || localNobleRank === "duque") &&
    Number(localVeAlem) > 0;

  // Founder local: por address allowlist o ENS en localStorage
  // (tu allowlist ya existe arriba como GOVERNANCE_FOUNDERS)
  const meAddr = String(getViewerAddress()).toLowerCase();
  const localEns = (getLocalEns?.() || "").toLowerCase();
  const localIsFounder =
    (typeof GOVERNANCE_FOUNDERS !== "undefined" && GOVERNANCE_FOUNDERS.has(meAddr)) ||
    localEns === "alemty.eth";

  // Si eres founder por local, por UX ya puedes ver/escribir aunque backend /api/me esté caído
  const localOkRead = localIsFounder || localIsModerator || localIsNoble;
  const localOkWrite =
    localIsFounder ||
    localIsModerator ||
    (localIsNoble && (localNobleRank === "rey" || localNobleRank === "principe"));

  // =========================
  // 2) Backend (FUENTE REAL)
  // =========================
  try {
    const r = await fetch(`${API_BASE}/api/me`, {
      headers: authHeadersGet(),
      cache: "no-store",
    });

    // ✅ Si JWT realmente inválido/expirado: 401/403
    if (r.status === 401 || r.status === 403) {
      localStorage.removeItem("alemty.jwt");
      return {
        okRead: false,
        okWrite: false,
        reason: "Sesión expirada. Inicia SIWE nuevamente.",
        isModerator: false,
        nobleRank: "",
        veAlem: 0,
        isFounder: false,
      };
    }

    // ✅ Si /api/me NO existe (404) o backend falla (>=500), NO borres JWT.
    // Usa fallback local para no bloquear UI.
    if (!r.ok) {
      console.warn("⚠️ /api/me no disponible. Usando fallback local. Status:", r.status);
      return {
        okRead: localOkRead,
        okWrite: localOkWrite,
        reason: localOkRead ? "" : "Backend /api/me no disponible aún (modo local).",
        isModerator: localIsModerator,
        nobleRank: localIsFounder ? "founder" : (localIsNoble ? localNobleRank : ""),
        veAlem: Number(localVeAlem) || 0,
        isFounder: localIsFounder,
      };
    }

    const data = await r.json().catch(() => ({}));

    const address = String(data?.address || "").toLowerCase();
    const ens = String(data?.ens || "").toLowerCase();

    const roles = Array.isArray(data?.roles)
      ? data.roles.map((x) => String(x).toLowerCase())
      : [];

    const isModerator =
      roles.includes("moderator") ||
      roles.includes("mod") ||
      roles.includes("admin");

    // normalizar nobleza
    const nobleRaw = String(data?.nobleRank || data?.noble || "").toLowerCase();
    const nobleRank = nobleRaw === "príncipe" ? "principe" : nobleRaw;

    const veAlem = Number(data?.veAlem ?? data?.vealem ?? 0);
    const veAlemOk = Number.isFinite(veAlem) && veAlem > 0;

    // =========================
    // 3) Founder (backend válido)
    // =========================
    const isFounderUser =
      address === "0x6a202f991c4c1df079449be9847b1dac3f51854f" || ens === "alemty.eth";

    if (isFounderUser) {
      return {
        okRead: true,
        okWrite: true,
        reason: "",
        isModerator: false,
        nobleRank: "founder",
        veAlem,
        isFounder: true,
      };
    }

    // =========================
    // 4) Nobleza válida
    // =========================
    const isNoble =
      (nobleRank === "rey" || nobleRank === "principe" || nobleRank === "duque") &&
      veAlemOk;

    // =========================
    // 5) Permisos
    // =========================
    const okRead = isModerator || isNoble;
    const okWrite =
      isModerator || (isNoble && (nobleRank === "rey" || nobleRank === "principe"));

    return {
      okRead,
      okWrite,
      reason: okRead
        ? ""
        : "Acceso restringido: requiere Moderación o Nobleza (Rey/Príncipe/Duque) con veALEM activo.",
      isModerator,
      nobleRank: isNoble ? nobleRank : "",
      veAlem,
      isFounder: false,
    };
  } catch (err) {
    // =========================
    // 6) FALLBACK LOCAL (solo UX DEV)
    // =========================
    console.warn("Governance fallback local (fetch failed):", err);

    return {
      okRead: localOkRead,
      okWrite: localOkWrite,
      reason: localOkRead ? "" : "Modo local (sin backend).",
      isModerator: localIsModerator,
      nobleRank: localIsFounder ? "founder" : (localIsNoble ? localNobleRank : ""),
      veAlem: Number(localVeAlem) || 0,
      isFounder: localIsFounder,
    };
  }
}

async function openGovernanceRoomsModal() {
  // Rooms: backend-first → fallback local
  let rawRooms = null;
  try { rawRooms = await apiGetRooms("governance"); } catch {}
  if (!Array.isArray(rawRooms)) rawRooms = loadJSON(GOV_ROOMS_KEY, []);

  // Permisos (backend / fallback local)
  const access = await getGovernanceAccess(); // okRead/okWrite/reason

  // Normaliza rooms (acepta strings legacy u objetos nuevos)
  const roomsAll = (Array.isArray(rawRooms) ? rawRooms : [])
    .map((r) => {
      if (typeof r === "string") {
        const n = r.trim();
        return n ? { id: null, name: n, visibility: "private", created_by: null } : null;
      }
      if (r && typeof r === "object") {
        const n = String(r.name || "").trim();
        if (!n) return null;
        return {
          id: r.id ?? null,
          name: n,
          visibility: String(r.visibility || "private"),
          created_by: r.created_by || null,
        };
      }
      return null;
    })
    .filter(Boolean);

  // Estado UI (persistente opcional)
  const STATE_KEY = "alemty.ui.governance.v1";
  const state = (() => {
    try { return JSON.parse(localStorage.getItem(STATE_KEY) || "{}"); } catch { return {}; }
  })();
  let q = String(state.q || "").trim();
  let page = Number.isFinite(state.page) ? Number(state.page) : 0;
  const saveState = () => localStorage.setItem(STATE_KEY, JSON.stringify({ q, page }));

  // Render modal
  document.getElementById("daoModalTitle").textContent = "Gobernanza";
  document.getElementById("daoModalBody").innerHTML = `
    <div class="sheet-item">
      <div class="t">🗳️ Salas de Gobernanza</div>
      <div class="m small muted">
        Propuestas y votaciones. (Acceso por roles / nobleza — backend lo enforceará).
      </div>
      <div class="small muted" style="margin-top:8px;">
        Estado: ${access.okRead ? "✅ Autorizado" : "⛔ Restringido"}
        ${access.isFounder ? "· Founder" : ""}
        ${access.isModerator ? "· Moderación" : ""}
        ${access.nobleRank ? `· Nobleza: <b>${esc(access.nobleRank)}</b>` : ""}
      </div>
      ${!access.okRead ? `
        <div class="small muted" style="margin-top:8px;">
          ${esc(access.reason || "Acceso restringido.")}
        </div>
      ` : ""}
    </div>

    <div class="sheet-item" style="margin-top:10px;">
      <div class="t">Buscar salas</div>
      <input id="govSearch" placeholder="Buscar…" value="${esc(q)}" ${access.okRead ? "" : "disabled"} />
      <div class="small muted" style="margin-top:6px;">Tip: 2+ caracteres para filtrar.</div>
    </div>

    <div class="sheet-item" style="margin-top:10px; ${access.okWrite ? "" : "opacity:.55;"}">
      <div class="t">Crear sala</div>

      <input id="govRoomName" placeholder="Nombre de la sala…" maxlength="48" ${access.okWrite ? "" : "disabled"} />

      <div style="margin-top:10px;">
        <div class="small muted" style="margin-bottom:6px;">Tipo de acceso</div>
        <select id="govVisibility" style="width:100%;" ${access.okWrite ? "" : "disabled"}>
          <option value="public">🌐 Pública — cualquiera puede unirse</option>
          <option value="private" selected>🔒 Privada — solo por invitación</option>
          <option value="password">🔐 Contraseña — acceso con clave</option>
        </select>
      </div>

      <div id="govPassWrap" style="margin-top:10px; display:none;">
        <div class="small muted" style="margin-bottom:6px;">Contraseña</div>
        <input id="govPass" type="password" placeholder="Ingresa contraseña…" ${access.okWrite ? "" : "disabled"} />
      </div>

      <div style="margin-top:12px;display:flex;gap:10px;flex-wrap:wrap;">
        <button class="btn primary" id="createGovRoomBtn" type="button" ${access.okWrite ? "" : "disabled"}>Crear</button>
        <button class="btn" type="button" data-close="1">Cerrar</button>
      </div>

      <div id="govRoomStatus" class="small muted" style="margin-top:10px;"></div>
    </div>

    <div class="sheet-item" style="margin-top:10px;">
      <div class="t">Salas</div>
      <div class="small muted" id="govRoomsMeta"></div>
    </div>

    <div id="govRoomsList"
      style="display:flex; flex-direction:column; gap:8px; max-height:320px; overflow:auto; padding-right:4px;">
    </div>

    <div id="govRoomsPager"
      style="margin-top:12px; display:flex; gap:10px; justify-content:space-between; align-items:center; flex-wrap:wrap;">
      <button class="btn" id="govPrev" type="button">◀ Anterior</button>
      <div class="small muted" id="govPageInfo"></div>
      <button class="btn" id="govNext" type="button">Siguiente ▶</button>
    </div>
  `;

  openModal();

  // Toggle password field
  document.getElementById("govVisibility")?.addEventListener("change", (e) => {
    const wrap = document.getElementById("govPassWrap");
    const v = e.target?.value || "private";
    if (wrap) wrap.style.display = v === "password" ? "block" : "none";
  });

  const searchEl = document.getElementById("govSearch");
  const listEl = document.getElementById("govRoomsList");
  const metaEl = document.getElementById("govRoomsMeta");
  const pageInfoEl = document.getElementById("govPageInfo");
  const prevBtn = document.getElementById("govPrev");
  const nextBtn = document.getElementById("govNext");
  const statusEl = document.getElementById("govRoomStatus");
  const createBtn = document.getElementById("createGovRoomBtn");

  const PAGE_SIZE = 10;

  function visLabel(v) {
    return v === "public" ? "🌐 Pública" : v === "password" ? "🔐 Contraseña" : "🔒 Privada";
  }

  function getFiltered() {
    if (!access.okRead) return [];
    const needle = String(q || "").trim().toLowerCase();
    if (needle.length >= 2) return roomsAll.filter((r) => r.name.toLowerCase().includes(needle));
    return roomsAll.slice();
  }

  function renderList() {
    const filtered = getFiltered();
    const total = filtered.length;

    const maxPage = Math.max(0, Math.ceil(total / PAGE_SIZE) - 1);
    page = Math.max(0, Math.min(page, maxPage));

    const start = page * PAGE_SIZE;
    const pageItems = filtered.slice(start, start + PAGE_SIZE);

    metaEl.textContent = total
      ? `Mostrando ${Math.min(total, start + 1)}–${Math.min(total, start + pageItems.length)} de ${total}`
      : (access.okRead ? "Aún no hay salas. ¡Crea la primera!" : "Acceso restringido");

    pageInfoEl.textContent = `Página ${maxPage + 1 ? page + 1 : 0} de ${maxPage + 1}`;

    prevBtn.disabled = !access.okRead || page <= 0;
    nextBtn.disabled = !access.okRead || page >= maxPage || total === 0;

    listEl.innerHTML = pageItems.length
      ? pageItems.map((room) => `
          <button class="sheet-item room-item" type="button" data-gov-open="${esc(room.name)}">
            <div class="t">${esc(room.name)}</div>
            <div class="small muted">${visLabel(room.visibility)} · Abrir</div>
          </button>
        `).join("")
      : `<div class="small muted" style="padding:8px 2px;">${access.okRead ? "No hay resultados." : "—"}</div>`;

    listEl.querySelectorAll("[data-gov-open]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const roomName = btn.getAttribute("data-gov-open");
        if (roomName) openRoomModal({ type: "governance", name: roomName });
      });
    });

    saveState();
  }

  prevBtn.addEventListener("click", () => { page = Math.max(0, page - 1); renderList(); });
  nextBtn.addEventListener("click", () => { page = page + 1; renderList(); });

  let tId = null;
  searchEl?.addEventListener("input", () => {
    q = String(searchEl.value || "");
    page = 0;
    if (tId) clearTimeout(tId);
    tId = setTimeout(() => renderList(), 120);
  });

  // Crear governance room (SIN prompt)
  createBtn?.addEventListener("click", async () => {
    if (!access.okWrite) {
      if (statusEl) statusEl.textContent = "No tienes permisos para crear salas de gobernanza.";
      return;
    }

    const name = (document.getElementById("govRoomName")?.value || "").trim();
    const visibility = document.getElementById("govVisibility")?.value || "private";
    const password = (document.getElementById("govPass")?.value || "").trim();

    if (name.length < 3) {
      if (statusEl) statusEl.textContent = "Nombre muy corto (mínimo 3 caracteres).";
      return;
    }
    if (visibility === "password" && password.length < 1) {
      if (statusEl) statusEl.textContent = "Debes ingresar una contraseña.";
      return;
    }
    if (!getJWT()) {
      if (statusEl) statusEl.textContent = "Necesitas SIWE (JWT) para crear salas.";
      return;
    }

    createBtn.disabled = true;
    try {
      if (statusEl) statusEl.textContent = "Creando sala…";

      await apiCreateRoom("governance", name, 1, visibility, visibility === "password" ? password : "");

      if (statusEl) statusEl.textContent = "Sala creada ✅";
      openGovernanceRoomsModal(); // refresh
    } catch (err) {
      if (statusEl) statusEl.textContent = err?.message || "Error creando sala.";
    } finally {
      createBtn.disabled = false;
    }
  });

  renderList();
}


function openTopicsModal(){
  const model = loadTopicsModel();
  const groups = Array.isArray(model?.groups) ? model.groups : [];

  document.getElementById('daoModalTitle').textContent = 'Temas';
  document.getElementById('daoModalBody').innerHTML = `
    <p class="muted">Elige un tema y se aplicará al selector de “Crear post”.</p>

    ${groups.map(g => `
      <div class="topic-group">${esc(g.label)}</div>

      ${(g.items || []).map(t => `
        <div class="sheet-item topic-item" data-topic-pick="${esc(t)}">
          <div class="t">${esc(t)}</div>
        </div>
      `).join('')}
    `).join('')}

    <button class="btn primary" id="addTopic" type="button">Crear tema</button>
  `;

  openModal();
}



function openFeedListModal(){
  // Recalcula lista en vivo para respetar filtros/tabs/búsqueda
  const posts = Array.isArray(POSTS_CACHE) ? POSTS_CACHE : [];
  const list = buildFeedList(posts);
  FEED_LAST_LIST = list;

  // Ajuste de página si la lista cambió
  const maxPage = Math.max(0, Math.ceil(list.length / FEED_MODAL_PAGE_SIZE) - 1);
  FEED_MODAL_PAGE = Math.max(0, Math.min(FEED_MODAL_PAGE, maxPage));

  const start = FEED_MODAL_PAGE * FEED_MODAL_PAGE_SIZE;
  const pageItems = list.slice(start, start + FEED_MODAL_PAGE_SIZE);

  document.getElementById('daoModalTitle').textContent = 'Feed';
  document.getElementById('daoModalBody').innerHTML = `
    <div class="sheet-item" style="margin-bottom:12px;">
      <div class="t">Todos los posts</div>
      <div class="m small muted">Página ${FEED_MODAL_PAGE + 1} de ${maxPage + 1} · ${list.length} total</div>
    </div>

    ${pageItems.map(p => `
      
<div class="sheet-item" data-open-post="${esc(p.id)}" style="cursor:pointer;">
  <div class="post-headrow">
    <div>
      <div class="t">${esc(p.title)}</div>
      <div class="post-author">${authorLinkHTML(p.author)}</div>
      <div class="m">${esc(p.topic || 'Sin tema')} · ${esc(fmt(p.ts))}</div>
    </div>

    <button class="kebab-btn" type="button" data-kebab="${esc(p.id)}" aria-label="Opciones">⋮</button>

   ${kebabMenuHTML(p)}
  </div>

  <div class="small muted" style="margin-top:6px;">
    ${esc((p.body || '').slice(0,140))}${(p.body || '').length>140?'…':''}
  </div>

        <div class="post-tags" style="margin-top:10px;">
          <span class="pill like">♥️ <span class="count">${getLikesCount(p)}</span></span>
          <span class="pill points">⭐ <span class="count">${getPointsCount(p)}</span></span>
          <span class="pill comment">💬 <span class="count">${getCommentsCount(p)}</span></span>
        </div>
      </div>
    `).join('')}

    <div style="margin-top:14px;display:flex;gap:10px;justify-content:space-between;align-items:center;flex-wrap:wrap;">
      <button class="btn" type="button" data-feed-prev="1" ${FEED_MODAL_PAGE===0?'disabled':''}>◀ Anterior</button>
      <div class="small muted">Mostrando ${Math.min(list.length, start+1)}–${Math.min(list.length, start + pageItems.length)} de ${list.length}</div>
      <button class="btn" type="button" data-feed-next="1" ${FEED_MODAL_PAGE>=maxPage?'disabled':''}>Siguiente ▶</button>
    </div>
  `;

  openModal();
}


function waitForDaoContainer(timeout = 3000) {
  return new Promise((resolve) => {
    // Si ya existe, salimos rápido
    if (document.querySelector('main.container')) {
      resolve();
      return;
    }

    const obs = new MutationObserver(() => {
      if (document.querySelector('main.container')) {
        obs.disconnect();
        resolve();
      }
    });

    obs.observe(document.body, { childList: true, subtree: true });

    // Fallback: no cuelgues la app si por alguna razón nunca aparece
    setTimeout(() => {
      try { obs.disconnect(); } catch {}
      resolve();
    }, timeout);
  });
}

/* =========================
   Wire-up (SIN romper shell)
   Solo escuchamos dentro del main.container
========================= */

(async () => {
  await waitForDaoContainer(3000);

  try {
    const backendPosts = await API.getPosts().catch(() => null);
    const localPosts   = loadJSON(DB_KEY, []);

    if (Array.isArray(backendPosts) && backendPosts.length === 0 && localPosts.length === 0) {
      await seedIfEmpty();
    }
  } catch {
    try { await seedIfEmpty(); } catch {}
  }

  const daoMain = document.querySelector('main.container');
  await renderAll();

  // ✅ (1) Encender autoplay después del render inicial
  startCarouselAuto();

  if (!daoMain) return;

  // ✅ 3) Tabs
  daoMain.querySelectorAll('.dao-tab').forEach(btn => {
    btn.addEventListener('click', async () => {
      activeView = btn.dataset.view;
      daoMain.querySelectorAll('.dao-tab').forEach(b => {
        const on = b === btn;
        b.classList.toggle('active', on);
        b.setAttribute('aria-selected', on ? 'true' : 'false');
      });

      carIndex = 0;
      await renderAll();

      // ✅ (2) Reiniciar autoplay tras cambiar de tab
      startCarouselAuto();
    });
  });

  daoMain.querySelector('#openRooms')?.addEventListener('click', openRoomsModal);
  daoMain.querySelector('#openTopics')?.addEventListener('click', openTopicsModal);
daoMain.querySelector('#openGovRoom')?.addEventListener('click', openGovernanceRoomsModal);
daoMain.querySelector('#openBackrooms2')?.addEventListener('click', openRoomsModal);

  // ✅ 5) Carrusel (manual pausa + reanuda)
  daoMain.querySelector('#carPrev')?.addEventListener('click', async () => {
    pauseCarouselAuto();
    carIndex = Math.max(0, carIndex - 1);
    await renderAll();
    startCarouselAuto();
  });

  daoMain.querySelector('#carNext')?.addEventListener('click', async () => {
    pauseCarouselAuto();
    carIndex += 1;
    await renderAll();
    startCarouselAuto();
  });

  
// Click en la barra-indicador para saltar a un item
document.addEventListener('click', async (e) => {
  const bar = e.target.closest('#carIndicator');
  if (!bar) return;

  // total = top 5 (siempre 5 máximo)
  const total = Math.min(5, Array.isArray(POSTS_CACHE) ? POSTS_CACHE.length : 0);
  if (total <= 1) return;

  pauseCarouselAuto();

  const rect = bar.getBoundingClientRect();
  const x = Math.min(1, Math.max(0, (e.clientX - rect.left) / rect.width));
  carIndex = Math.round(x * (total - 1));

  await renderAll();
  startCarouselAuto();
}, { passive: true });


  // ✅ 6) Search
  daoMain.querySelector('#search')?.addEventListener('input', () => {
    void renderAll();
  });

  daoMain.querySelector('#clearSearch')?.addEventListener('click', () => {
    const s = daoMain.querySelector('#search');
    if (s) s.value = '';
    void renderAll();
  });

  // ✅ 7) Crear post (backend-first)
  daoMain.querySelector('#publishPost')?.addEventListener('click', async () => {
    const title  = (daoMain.querySelector('#postTitle')?.value || '').trim();
    const body   = (daoMain.querySelector('#postBody')?.value  || '').trim();
    const topic  = (daoMain.querySelector('#postTopic')?.value || '').trim();
    const status = daoMain.querySelector('#publishStatus');

    if (title.length < 3 || body.length < 10) {
      if (status) status.textContent = 'Completa título (3+) y cuerpo (10+).';
      return;
    }

    const jwt = localStorage.getItem('alemty.jwt') || '';
    if (!jwt) {
      if (status) status.textContent = 'Necesitas verificar SIWE para publicar.';
      return;
    }

    try {
      if (status) status.textContent = 'Publicando…';
      const created = await API.createPost({ title, body, topic });

      const t = daoMain.querySelector('#postTitle');
      const b = daoMain.querySelector('#postBody');
      if (t) t.value = '';
      if (b) b.value = '';

      if (status) status.textContent = 'Publicado ✅';

      carIndex = 0;
      await renderAll();
      enhanceTopicPicker();

      // ✅ (3) Asegura que el autoplay vuelva (por si estaba pausado)
      startCarouselAuto();

      if (created?.id) await openPostModal(String(created.id));
    } catch (err) {
      console.error('createPost error:', err);
      if (status) status.textContent = 'Error publicando.';
    }
  });
})();
window.getGovernanceAccess = getGovernanceAccess;