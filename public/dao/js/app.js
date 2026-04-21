
import { mountShell } from '/shared/js/shell.js';
mountShell();

// =========================
// API base (DEV vs PROD)
// =========================

const isENS = location.hostname.endsWith(".eth.limo");
const isLocal =
  location.hostname === "localhost" ||
  location.hostname === "127.0.0.1";

const API_WORKER = "https://alemtydao.alejandrogtzz93.workers.dev";
const API_BASE = (isENS || isLocal) ? API_WORKER : "";


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
    commentsCount,
    comments: Array.isArray(p?.comments) ? p.comments : [],
    created_at: p?.created_at || null,
  };
}

const API = {
  async getPosts() {
    const r = await fetch(`${API_BASE}/api/posts`, { cache: "no-store" });
    if (!r.ok) throw new Error("getPosts failed");
    const data = await r.json().catch(() => ({}));
    const arr = Array.isArray(data?.posts) ? data.posts : [];
    return arr.map(mapPostFromApi);
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
    const r = await fetch(`${API_BASE}/api/posts/${postId}`, { cache: "no-store" });
    if (!r.ok) throw new Error("getPost failed");
    const data = await r.json().catch(() => ({}));
    const base = data?.post ? data.post : data;

    const post = mapPostFromApi(base);

    // 2) Comments reales
    let rawComments = [];
    try {
      const cr = await fetch(`${API_BASE}/api/posts/${postId}/comments`, { cache: "no-store" });
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

const DEFAULT_TOPICS = [
  '🔬 Ciencia y Tecnología',
  '🤖 IA & Agentes',
  '🧱 Web3 & DAOs',
  '🕶️ AR/VR',
  '💬 Off Topic'
];

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
  return d.toLocaleString('es-MX', { year:'numeric', month:'short', day:'2-digit', hour:'2-digit', minute:'2-digit' });
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
function authorLinkHTML(addr){
  const full = String(addr || '').toLowerCase();
  const label = displayAuthor(full);
  return `<a href="#" class="post-author-link" data-profile-open="${esc(full)}">${esc(label)}</a>`;
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
    id: c.id || uid(),
    ts: c.ts || now(),
    text: c.text || '',
    likes: Number(c.likes || 0),
    points: Number(c.points || 0),
    replies: Array.isArray(c.replies)
      ? c.replies.map(r => ({
          id: r.id || uid(),
          ts: r.ts || now(),
          text: r.text || '',
          likes: Number(r.likes || 0),
          points: Number(r.points || 0),
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
  return String(s ?? '').replace(/[&<>"']/g, ch => ({
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

/* =========================
   Delegación GLOBAL (sin duplicados en web/móvil)
   - pointerup + click (dedupe)
   - evita doble trigger en desktop y mobile
========================= */

let __lastPointerTs = 0;

// Define qué elementos consideramos "accionables"
function isActionableTarget(t){
  if(!t || !t.closest) return false;

return !!t.closest(
  '[data-close], [data-like], [data-point], .pill[data-action], [data-open-post], [data-share], [data-send], [data-topic-pick], [data-reply-cancel], [data-replies-more], [data-replies-less], [data-feed-open], [data-feed-prev], [data-feed-next], [data-profile-open]'
);
}

async function handleGlobalAction(e) {

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

  // Reusa tu daoModal para mostrar perfil básico (read-only)
  document.getElementById('daoModalTitle').textContent = 'Perfil';
  document.getElementById('daoModalBody').innerHTML = `
    <div class="sheet-item">
      <div class="t">Usuario</div>
      <div class="m">${esc(shortHex(addr))}</div>
      <div class="small muted" style="margin-top:10px;">
        Perfil público (stats) — SOON. Por ahora mostramos address.
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
    if (userId === 'visitor') return; // backend requiere JWT

    const actions = loadActions();
    const entry = getActionEntry(actions, userId, targetKeyPost(postId));
    if (entry.liked) return;

    // Optimistic UI
    mutatePost(postId, p => ({
      ...ensurePostSchema(p),
      likes: (p.likes || 0) + 1
    }));

    // Ledger local
    entry.liked = true;
    saveActions(actions);

    // Backend
    try { await reactSafe(postId, 'like'); } catch {}

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

    const actions = loadActions();
    const entry = getActionEntry(actions, userId, targetKeyPost(postId));
    if (entry.pointsGiven >= POINTS_MAX_PER_POST) return;

    // Optimistic UI
    mutatePost(postId, p => ({
      ...ensurePostSchema(p),
      points: (p.points || 0) + 1
    }));

    // Ledger local
    entry.pointsGiven += 1;
    saveActions(actions);

    // Backend
    try { await reactSafe(postId, 'points'); } catch {}

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

  // ✅ Target: si es reply real (id numérico), reaccionamos al reply
  const replyNum = replyId ? Number(replyId) : NaN;
  const hasRealReply = replyId && Number.isFinite(replyNum);
  const targetId = hasRealReply ? replyId : commentId;

  // Ledger key distinto para comment vs reply
  const actionsLedger = loadActions();
  const key = hasRealReply
    ? targetKeyReply(postId, commentId, replyId)
    : targetKeyComment(postId, commentId);

  const entry = getActionEntry(actionsLedger, userId, key);

  // UI optimista (estado activo)
  if (action === 'c-like') {
    if (entry.liked) return;     // like es 1 por usuario
    entry.liked = true;
  } else {
    if (entry.pointsGiven >= POINTS_MAX_PER_POST) return;
    entry.pointsGiven += 1;
  }
  saveActions(actionsLedger);

  // 1) Backend
  let res = null;
  try {
    res = await API.reactComment(postId, targetId, action === 'c-like' ? 'like' : 'points');
  } catch (e) {
    console.warn("API comment/react offline, usando estado local:", e);
  }

  // 2) ✅ UI inmediata con counts (acepta number o string)
  const counts = res?.counts || null;
  const countEl = pill.querySelector('.count');
  if (countEl && counts) {
    if (action === 'c-like') {
      const n = Number(counts.likes);
      if (Number.isFinite(n)) countEl.textContent = String(n);
    } else {
      const n = Number(counts.points);
      if (Number.isFinite(n)) countEl.textContent = String(n);
    }
  } else {
    // fallback visual mínimo si no hubo counts:
    if (countEl) {
      const cur = Number(countEl.textContent || "0");
      if (Number.isFinite(cur)) countEl.textContent = String(cur + 1);
    }
  }

  // 3) Refresco “suave” del modal (evita read-lag inmediato)
  //    Esto alinea UI con backend sin pisar el primer click.
  setTimeout(async () => {
    try { await openPostModal(postId); } catch {}
  }, 220);

  // No necesitas renderAll inmediato aquí; el modal ya se actualizó en DOM.
  return;
}




    // Acciones del POST (backend-first)
    if (action === 'comment') {
      await openPostModal(postId);
      return;
    }

    const userId = getUserId();
    if (userId === 'visitor') return;

    const actions = loadActions();
    const entry = getActionEntry(actions, userId, targetKeyPost(postId));

    if (action === 'like') {
      if (entry.liked) return;

      mutatePost(postId, p => ({
        ...ensurePostSchema(p),
        likes: (p.likes || 0) + 1
      }));

      entry.liked = true;
      saveActions(actions);

      try { await reactSafe(postId, 'like'); } catch {}

      renderAll();
      updateModalPostCounts(postId);
      return;
    }

    if (action === 'points') {
      if (entry.pointsGiven >= POINTS_MAX_PER_POST) return;

      mutatePost(postId, p => ({
        ...ensurePostSchema(p),
        points: (p.points || 0) + 1
      }));

      entry.pointsGiven += 1;
      saveActions(actions);

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
        c.replies.push({ id: uid(), ts: now(), text: textRaw, likes: 0, points: 0 });
        return post;
      }

      post.comments = post.comments || [];
      post.comments.push({ id: uid(), ts: now(), text: textRaw, likes: 0, points: 0, replies: [] });
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
   Seed demo
========================= */
async function seedIfEmpty(){
  const posts = await getPostsSafe();
  if(posts.length) return;

  const seed = [
    {
      id: uid(),
      title: 'Bienvenida a la DAO alemty',
      body: 'Este es un foro estilo Reddit/Taringa con glass UI. Publica ideas, vota y comenta.',
      topic: DEFAULT_TOPICS[2],
      ts: now() - 1000 * 60 * 80,
      likes: 5,
      points: 2,
      comments: [{ ts: now() - 1000*60*60, text:'Se ve increíble el glass.' }]
    },
    {
      id: uid(),
      title: 'Tokenomics: Aura consumo, Alem salida',
      body: 'Aura = consumo de contenido. Alem = salida a mercado para creadores. Emisión por epochs.',
      topic: DEFAULT_TOPICS[2],
      ts: now() - 1000 * 60 * 160,
      likes: 9,
      points: 4,
      comments: []
    },
    {
      id: uid(),
      title: 'Backrooms: grupos privados',
      body: 'Propongo backrooms por temas con roles, acceso y reglas simples.',
      topic: DEFAULT_TOPICS[0],
      ts: now() - 1000 * 60 * 240,
      likes: 3,
      points: 1,
      comments: []
    },
    {
      id: uid(),
      title: 'IA como copiloto de gobernanza',
      body: 'IA que resume debates, detecta consenso y sugiere acciones sin mandar.',
      topic: DEFAULT_TOPICS[1],
      ts: now() - 1000 * 60 * 400,
      likes: 6,
      points: 3,
      comments: []
    }
  ];

  saveJSON(DB_KEY, seed);

  const rooms = loadJSON(ROOMS_KEY, []);
  if(!rooms.length) saveJSON(ROOMS_KEY, ['Genesis', 'Builders', 'Economía', 'Círculo']);

  const topics = loadJSON(TOPICS_KEY, []);
  if(!topics.length) saveJSON(TOPICS_KEY, DEFAULT_TOPICS);
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
    return;
  }

  // 1) Render del carrusel (KPIs con clases semánticas)
  track.innerHTML = top5.map(p => `
    <div class="car-card" data-open-post="${esc(p.id)}"> 
<div class="car-title">${esc(p.title)}</div>
<div class="car-author">${authorLinkHTML(p.author)}</div>
<div class="car-meta">${esc(p.topic || 'Sin tema')} · ${esc(fmt(p.ts))}</div>
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

  // 2) Dots
  carIndex = Math.max(0, Math.min(carIndex, top5.length - 1));
  dots.innerHTML = top5.map((_, i) =>
    `<span class="dot ${i === carIndex ? 'active' : ''}" data-dot="${i}"></span>`
  ).join('');

  
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
function renderTopicsSelect(){
  const sel = document.getElementById('postTopic');
  if(!sel) return;

  const topics = loadJSON(TOPICS_KEY, DEFAULT_TOPICS);
  
  sel.innerHTML =
    `<option value="">Sin tema</option>` +
    topics.map(t => `<option value="${esc(t)}">${esc(t)}</option>`).join('');
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

 
if (metaEl) {
  metaEl.innerHTML = `
    <div class="post-author">${authorLinkHTML(latest.author)}</div>
    <div>${esc(latest.topic || 'Sin tema')} · ${esc(fmt(latest.ts))}</div>
  `;
}
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



function applyActionState(){
  const userId = getUserId();
  const actions = loadActions();
  const mine = actions[userId] || {};

  // posts (ya lo hacías)
  document.querySelectorAll('.pill[data-action][data-post-id]').forEach(el => {
    const postId = el.dataset.postId;
    const act = el.dataset.action;

    if (act === 'like') {
      const entry = mine[targetKeyPost(postId)];
      el.classList.toggle('active', !!entry?.liked);
    }

    if (act === 'points') {
      const entry = mine[targetKeyPost(postId)];
      el.classList.toggle('active', (entry?.pointsGiven || 0) >= POINTS_MAX_PER_POST);
    }
  });

  // comentarios y replies (nuevo)
  document.querySelectorAll('.pill[data-action="c-like"], .pill[data-action="c-points"]').forEach(el => {
    const postId = el.dataset.postId;
    const commentId = el.dataset.commentId;
    const replyId = el.dataset.replyId || null;
    if(!postId || !commentId) return;

    const key = replyId
      ? targetKeyReply(postId, commentId, replyId)
      : targetKeyComment(postId, commentId);

    const entry = mine[key];
    if (!entry) return;

    if (el.dataset.action === 'c-like') {
      el.classList.toggle('active', !!entry.liked);
    } else {
      el.classList.toggle('active', (entry.pointsGiven || 0) >= POINTS_MAX_PER_POST);
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
      <div class="t">${esc(p.title.slice(0,52))}${p.title.length>52?'…':''}</div>
      <div class="m">${esc(p.topic || 'Sin tema')} · ${esc(fmt(p.ts))}</div>
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
      <div class="vote">
        <button class="vbtn" data-like="${esc(p.id)}" type="button">▲</button>
        <div class="vnum">${score(p)}</div>
        <button class="vbtn" data-point="${esc(p.id)}" type="button">✨</button>
      </div>

      <div class="post-body">
        
<div class="post-title">${esc(p.title)}</div>
<div class="post-author">${authorLinkHTML(p.author)}</div>
<div class="post-meta">${esc(p.topic || 'Sin tema')} · ${esc(fmt(p.ts))}</div>
<div class="post-snippet">${esc((p.body || '').slice(0,220))}${(p.body || '').length > 220 ? '…' : ''}</div>

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
      <div class="comment-head">
        <span class="muted small">${esc(fmt(r.ts))}</span>
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
      <div class="comment-head">
        <span class="muted small">${esc(fmt(c.ts))}</span>
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

async function openPostModal(postId) {
  // Normaliza a string (en tu UI usas ids como string)
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

  document.getElementById('daoModalTitle').textContent = 'Post';

  const ui = loadUI();
  const replyingTo =
    ui.replyTo && String(ui.replyTo.postId) === idStr ? ui.replyTo : null;

  // Nota: fmt(p.ts) usa timestamp; si viene de backend ya lo mapearon a ts
  document.getElementById('daoModalBody').innerHTML = `
    <div class="sheet-item">
      
<div class="t">${esc(p.title)}</div>
<div class="post-author">${authorLinkHTML(p.author)}</div>
<div class="m">${esc(p.topic || 'Sin tema')} · ${esc(fmt(p.ts))}</div>
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

  // ✅ Abre modal
  openModal();

  // ✅ FIX 3: aplica el estado visual (active/opaco) A LOS NUEVOS ELEMENTOS del modal
  // Esto evita que “despierte” hasta el primer click o hasta renderAll().
  applyActionState();

  // ✅ (Opcional recomendado): sincroniza contadores del post en el modal con el cache
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



/* =========================
   Rooms / Topics modales
========================= */
function openRoomsModal(){
  const rooms = loadJSON(ROOMS_KEY, []);
  document.getElementById('daoModalTitle').textContent = 'Backrooms';
  document.getElementById('daoModalBody').innerHTML = `
    <p class="muted">Salas (demo local). Luego se conecta a permisos.</p>
    ${(rooms.length ? rooms : ['Sin salas']).map(r => `
      <div class="sheet-item">
        <div class="t">🏚️ ${esc(r)}</div>
        <div class="m">Backroom · UI lista · backend soon</div>
      </div>
    `).join('')}
    <button class="btn primary" id="addRoom" type="button">Crear sala</button>
  `;
  openModal();
}

function openTopicsModal(){
  const topics = loadJSON(TOPICS_KEY, DEFAULT_TOPICS);
  document.getElementById('daoModalTitle').textContent = 'Temas';
  document.getElementById('daoModalBody').innerHTML = `
    <p class="muted">Lista de temas. Al elegir, rellena el selector.</p>
    ${topics.map(t => `
      <div class="sheet-item" data-topic-pick="${esc(t)}">
        <div class="t">${esc(t)}</div>
        <div class="m">Seleccionar tema</div>
      </div>
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
        <div class="t">${esc(p.title)}</div>
        <div class="m">${esc(p.topic || 'Sin tema')} · ${esc(fmt(p.ts))}</div>
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

  daoMain.querySelector('#carDots')?.addEventListener('click', async (e) => {
    const d = e.target.closest('[data-dot]');
    if (!d) return;
    pauseCarouselAuto();
    carIndex = Number(d.dataset.dot || 0);
    await renderAll();
    startCarouselAuto();
  });

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

      // ✅ (3) Asegura que el autoplay vuelva (por si estaba pausado)
      startCarouselAuto();

      if (created?.id) await openPostModal(String(created.id));
    } catch (err) {
      console.error('createPost error:', err);
      if (status) status.textContent = 'Error publicando.';
    }
  });
})();
