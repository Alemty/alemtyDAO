
import { mountShell } from '/shared/js/shell.js';
mountShell();

const API = {
  async getPosts() {
    const r = await fetch("/api/posts", { cache: "no-store" });
    if (!r.ok) throw new Error("getPosts failed");
    return r.json();
  },
  async react(postId, type) {
    const r = await fetch(`/api/posts/${postId}/react`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ type })
    });
    if (!r.ok) throw new Error("react failed");
    return r.json().catch(() => ({}));
  }
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

// =========================
// Comentarios (schema + helpers)
// =========================
const UI_KEY = 'alemty.dao.ui.v1'; // guarda UI state (reply target, expand)
function loadUI(){ return loadJSON(UI_KEY, { replyTo:null, expand:{} }); }
function saveUI(v){ saveJSON(UI_KEY, v); }

function ensureCommentSchema(c){
  // migra comentarios viejos {ts,text} -> nuevo
  if(!c || typeof c !== 'object') return null;
  return {
    id: c.id || uid(),
    ts: c.ts || now(),
    text: c.text || '',
    likes: Number(c.likes || 0),
    points: Number(c.points || 0),
    replies: Array.isArray(c.replies) ? c.replies.map(r => ({
      id: r.id || uid(),
      ts: r.ts || now(),
      text: r.text || '',
      likes: Number(r.likes || 0),
      points: Number(r.points || 0),
    })) : []
  };
}

function ensurePostSchema(p){
  if(!p || typeof p !== 'object') return p;
  const comments = Array.isArray(p.comments) ? p.comments.map(ensureCommentSchema).filter(Boolean) : [];
  return { ...p, comments };
}

function getPostByIdFromLocal(postId){
  const posts = loadJSON(DB_KEY, []);
  const p = posts.find(x => x.id === postId);
  return p ? ensurePostSchema(p) : null;
}

// encuentra comentario por id
function findComment(p, commentId){
  if(!p || !Array.isArray(p.comments)) return null;
  return p.comments.find(c => c.id === commentId) || null;
}


function esc(s){
  return String(s ?? '').replace(/[&<>"']/g, ch => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
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
  '[data-close], [data-like], [data-point], .pill[data-action], [data-open-post], [data-share], [data-send], [data-topic-pick], [data-reply-cancel], [data-replies-more], [data-replies-less]'
);



}

async function handleGlobalAction(e) {
  // =========================
  // Cerrar modal
  // =========================
  if (e.target.closest('[data-close]')) {
    e.preventDefault?.();
    closeModal();
    return;
  }

const cancel = e.target.closest('[data-reply-cancel]');
if (cancel) {
  const postId = cancel.getAttribute('data-reply-cancel');
  const ui = loadUI();
  ui.replyTo = null;
  saveUI(ui);
  await openPostModal(postId);
  return;
}

const more = e.target.closest('[data-replies-more]');
if (more) {
  const postId = more.getAttribute('data-post-id');
  const commentId = more.getAttribute('data-replies-more');
  const ui = loadUI();
  ui.expand = ui.expand || {};
  ui.expand[commentId] = true;
  saveUI(ui);
  await openPostModal(postId);
  return;
}

const less = e.target.closest('[data-replies-less]');
if (less) {
  const postId = less.getAttribute('data-post-id');
  const commentId = less.getAttribute('data-replies-less');
  const ui = loadUI();
  ui.expand = ui.expand || {};
  ui.expand[commentId] = false;
  saveUI(ui);
  await openPostModal(postId);
  return;
}

  
// =========================
// LIKE (botones data-like)
// =========================
const like = e.target.closest('[data-like]');
if (like) {
  e.preventDefault();

  const postId = like.getAttribute('data-like');
  const userId = getUserId();
  const actions = loadActions();
  const entry = getActionEntry(actions, userId, targetKeyPost(postId));

  // evita doble-like por usuario
  if (entry.liked) return;

  // 1) Optimistic UI: SIEMPRE muta local para reflejo instantáneo
  mutatePost(postId, p => ({
    ...p,
    likes: (p.likes || 0) + 1
  }));

  // 2) Ledger: marca que ya dio like
  entry.liked = true;
  saveActions(actions);

  // 3) Dispara backend (si falla, ya tienes el cambio local; luego el backend se alinea)
  try { await reactSafe(postId, 'like'); } catch {}

  // 4) Re-render general + update instantáneo del modal
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

  const postId = point.getAttribute('data-point');
  const userId = getUserId();
  const actions = loadActions();
  const entry = getActionEntry(actions, userId, postId);

  // respeta límite por usuario/post
  if (entry.pointsGiven >= POINTS_MAX_PER_POST) return;

  // 1) Optimistic UI: SIEMPRE muta local para reflejo instantáneo
  mutatePost(postId, p => ({
    ...p,
    points: (p.points || 0) + 1
  }));

  // 2) Ledger: suma puntos dados
  entry.pointsGiven += 1;
  saveActions(actions);

  // 3) Dispara backend (si falla, ya tienes el cambio local; luego el backend se alinea)
  try { await reactSafe(postId, 'points'); } catch {}

  // 4) Re-render general + update instantáneo del modal
  renderAll();
  updateModalPostCounts(postId);

  return;
}


  // =========================
  // PILLs: like / points / comment
  // =========================
  
const pill = e.target.closest('.pill[data-action]');
if (pill) {
  e.preventDefault();
  e.stopPropagation();

  // ✅ define primero
  const action = pill.dataset.action;
  let postId = pill.dataset.postId;

  // fallback: si no viene postId (por ejemplo en latestCard)
  if (!postId) {
    const latestCard = document.getElementById('latestCard');
    postId = latestCard?.dataset.openPost;
  }
  if (!postId) return;

  // ✅ 1) Acciones nuevas: replies/comentarios
  if (action === 'c-reply') {
    const ui = loadUI();
    ui.replyTo = { postId, commentId: pill.dataset.commentId };
    saveUI(ui);
    await openPostModal(postId);
    return;
  }

  
if (action === 'c-like' || action === 'c-points') {
  const commentId = pill.dataset.commentId;
  const replyId = pill.dataset.replyId || null;

  const userId = getUserId();
  const actionsLedger = loadActions();

  const key = replyId
    ? targetKeyReply(postId, commentId, replyId)
    : targetKeyComment(postId, commentId);

  const entry = getActionEntry(actionsLedger, userId, key);

  // ✅ límites por DID emisor
  if (action === 'c-like') {
    if (entry.liked) return; // 1 like máximo
    entry.liked = true;
    saveActions(actionsLedger);
  } else {
    if (entry.pointsGiven >= POINTS_MAX_PER_POST) return; // 10 puntos máximo (reusa tu constante)
    entry.pointsGiven += 1;
    saveActions(actionsLedger);
  }

  // ✅ aplica el cambio al post/comentario en localStorage
  mutatePost(postId, post => {
    post = ensurePostSchema(post);

    const c = findComment(post, commentId);
    if (!c) return post;

    // si es reply
    if (replyId) {
      const r = (c.replies || []).find(x => x.id === replyId);
      if (!r) return post;

      if (action === 'c-like') r.likes = (r.likes || 0) + 1;
      else r.points = (r.points || 0) + 1;

      return post;
    }

    // comentario raíz
    if (action === 'c-like') c.likes = (c.likes || 0) + 1;
    else c.points = (c.points || 0) + 1;

    return post;
  });

  // refresca modal + feed
  await openPostModal(postId);
  renderAll();
  return;
}


  // ✅ 2) Tus acciones existentes: like/points/comment del POST
  const userId = getUserId();

  if (userId === 'visitor') {
    if (action === 'comment') {
      await openPostModal(postId);
    }
    return;
  }

  const actions = loadActions();
  const entry = getActionEntry(actions, userId, postId);

  if (action === 'like') {
    if (entry.liked) return;

    const ok = await reactSafe(postId, 'like');
    entry.liked = true;
    saveActions(actions);

    if (!ok) {
      mutatePost(postId, p => ({ ...p, likes: (p.likes || 0) + 1 }));
    }

    renderAll();
    return;
  }

  if (action === 'points') {
    if (entry.pointsGiven >= POINTS_MAX_PER_POST) return;

    const ok = await reactSafe(postId, 'points');
    entry.pointsGiven += 1;
    saveActions(actions);

    if (!ok) {
      mutatePost(postId, p => ({ ...p, points: (p.points || 0) + 1 }));
    }

    renderAll();
    return;
  }

  if (action === 'comment') {
    await openPostModal(postId);
    return;
  }
}


  // =========================
  // Abrir post
  // =========================
  const openPost = e.target.closest('[data-open-post]');
  if (openPost) {
    e.preventDefault();
    const id = openPost.dataset.openPost;
    if (id) await openPostModal(id);
    return;
  }

  // =========================
  // SHARE
  // =========================
  const share = e.target.closest('[data-share]');
  if (share) {
    e.preventDefault();
    await copyLink(share.getAttribute('data-share'));
    return;
  }

  // =========================
  // SEND comment
  // =========================
  
const send = e.target.closest('[data-send]');
if (send) {
  const id = send.getAttribute('data-send');
  const text = (document.getElementById('commentText')?.value || '').trim();
  if (text.length < 2) return;

  const ui = loadUI();
  const replying = ui.replyTo && ui.replyTo.postId === id ? ui.replyTo : null;

  mutatePost(id, post => {
    post = ensurePostSchema(post);

    if (replying) {
      const c = findComment(post, replying.commentId);
      if(!c) return post;
      c.replies = c.replies || [];
      c.replies.push({ id: uid(), ts: now(), text, likes:0, points:0 });
      return post;
    }

    post.comments = post.comments || [];
    post.comments.push({ id: uid(), ts: now(), text, likes:0, points:0, replies:[] });
    return post;
  });

  // si era reply, limpia estado
  if (replying) {
    ui.replyTo = null;
    saveUI(ui);
  }

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
}

/* =========================
   LISTENERS (la parte que faltaba)
   - pointerup: maneja mouse/touch
   - click: fallback + dedupe (evita doble en desktop y mobile)
========================= */

document.addEventListener('pointerup', async (e) => {
  // Solo botón primario en mouse
  if (e.pointerType === 'mouse' && e.button !== 0) return;

  // Solo procesamos si tocó algo accionable (evita bloquear clicks normales)
  if (!isActionableTarget(e.target)) return;

  __lastPointerTs = Date.now();
  await handleGlobalAction(e);
}, { passive: false });

document.addEventListener('click', async (e) => {
  // Solo procesamos si tocó algo accionable
  if (!isActionableTarget(e.target)) return;

  // Si hubo pointerup reciente, ignoramos este click para evitar doble ejecución
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
    await API.react(postId, type);
    return true; // backend aceptó
  } catch (e) {
    console.warn("API react offline, usando mutación local:", type);
    return false; // fallback local
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
function score(p){
  const c = (p.comments || []).length;
  return (p.likes||0)*2 + (p.points||0)*3 + c;
}
function byRecent(a,b){ return (b.ts||0)-(a.ts||0); }
function byScore(a,b){ return score(b)-score(a); }

function filterWeek(posts){
  const weekAgo = now() - 7*24*60*60*1000;
  return posts.filter(p => (p.ts||0) >= weekAgo);
}
function filterMonth(posts){
  const monthAgo = now() - 30*24*60*60*1000;
  return posts.filter(p => (p.ts||0) >= monthAgo);
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
      <div class="car-meta">${esc(p.topic || 'Sin tema')} · ${esc(fmt(p.ts))}</div>
      <div class="car-title">${esc(p.title)}</div>
      <div class="car-snippet">
        ${esc((p.body || '').slice(0,160))}${(p.body || '').length > 160 ? '…' : ''}
      </div>

      <div class="car-kpis">
        
<span class="pill like" data-action="like" data-post-id="${esc(p.id)}">
  ♥️ <span class="count">${p.likes||0}</span>
</span>
<span class="pill points" data-action="points" data-post-id="${esc(p.id)}">
  ⭐ <span class="count">${p.points||0}</span>
</span>
<span class="pill comment" data-action="comment" data-post-id="${esc(p.id)}">
  💬 <span class="count">${(p.comments||[]).length}</span>
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

    const cardW = first.getBoundingClientRect().width;
    const gap = 10;

    // Si todavía no hay ancho (0), intenta un frame extra
    if(!cardW){
      requestAnimationFrame(() => {
        const f2 = track.firstElementChild;
        const w2 = f2 ? f2.getBoundingClientRect().width : 0;
        const x2 = (w2 + gap) * carIndex;
        track.style.transform = `translateX(${-x2}px)`;
      });
      return;
    }

    const x = (cardW + gap) * carIndex;
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
  actions[userId] ||= {};
  actions[userId][key] ||= { liked:false, pointsGiven:0 };
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

  if(metaEl) metaEl.textContent = `${latest.topic || 'Sin tema'} · ${fmt(latest.ts)}`;
  if(titleEl) titleEl.textContent = latest.title;
  if(snipEl) snipEl.textContent =
    (latest.body || '').slice(0,180) + ((latest.body || '').length > 180 ? '…' : '');

  // Contadores (compatibles con tu HTML: likes ya tiene <span.count>, points/comments tal vez no)
  setPillCount(likesEl, '♥️', latest.likes || 0);
  setPillCount(pointsEl, '⭐', latest.points || 0);
  setPillCount(commentsEl, '💬', (latest.comments || []).length);

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
  ♥️ <span class="count">${p.likes||0}</span>
</span>
<span class="pill points" data-action="points" data-post-id="${esc(p.id)}">
  ⭐ <span class="count">${p.points||0}</span>
</span>
<span class="pill comment" data-action="comment" data-post-id="${esc(p.id)}">
  💬 <span class="count">${(p.comments||[]).length}</span>
</span>


      </div>
    </div>
  `).join('');
}

function renderFeed(posts){
  const feed = document.getElementById('feed');
  if(!feed) return;

  const q = (document.getElementById('search').value || '').trim().toLowerCase();
  let list = posts.slice();

  if(activeView === 'recientes') list.sort(byRecent);
  else if(activeView === 'top-semana') list = filterWeek(list).sort(byScore);
  else if(activeView === 'top-mes') list = filterMonth(list).sort(byScore);
  else list.sort(byScore);

  if(q.length >= 2){
    list = list.filter(p => (`${p.title} ${p.body} ${p.topic}`).toLowerCase().includes(q));
  }

  if(!list.length){
    feed.innerHTML = `<p class="muted">Sin resultados.</p>`;
    return;
  }

  feed.innerHTML = list.map(p => `
    <article class="post" data-open-post="${esc(p.id)}">
      <div class="vote">
        <button class="vbtn" data-like="${esc(p.id)}" type="button">▲</button>
        <div class="vnum">${score(p)}</div>
        <button class="vbtn" data-point="${esc(p.id)}" type="button">✨</button>
      </div>
      <div class="post-body">
        <div class="post-title">${esc(p.title)}</div>
        <div class="post-meta">${esc(p.topic||'Sin tema')} · ${esc(fmt(p.ts))}</div>
        <div class="post-snippet">${esc((p.body||'').slice(0,220))}${(p.body||'').length>220?'…':''}</div>
        <div class="post-tags">
          

<span class="pill like" data-action="like" data-post-id="${esc(p.id)}">
  ♥️ <span class="count">${p.likes||0}</span>
</span>
<span class="pill points" data-action="points" data-post-id="${esc(p.id)}">
  ⭐ <span class="count">${p.points||0}</span>
</span>
<span class="pill comment" data-action="comment" data-post-id="${esc(p.id)}">
  💬 <span class="count">${(p.comments||[]).length}</span>
</span>


        </div>
      </div>
    </article>
  `).join('');
}

let POSTS_CACHE = [];

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

  // Tomamos el post desde local (porque ahí mutas en fallback)
  const p = getPostByIdFromLocal(postId);
  if (!p) return;

  const likeBtn = m.querySelector(`button[data-like="${postId}"] .count`);
  const pointBtn = m.querySelector(`button[data-point="${postId}"] .count`);

  if (likeBtn) likeBtn.textContent = String(p.likes || 0);
  if (pointBtn) pointBtn.textContent = String(p.points || 0);
}


/* =========================
   Post modal
========================= */


let CURRENT_MODAL_POST_ID = null;

async function openPostModal(postId){
  const posts = POSTS_CACHE.length ? POSTS_CACHE : await getPostsSafe();
  const raw = posts.find(x => x.id === postId);
  const p = ensurePostSchema(raw);
  if(!p) return;

  CURRENT_MODAL_POST_ID = postId;

  document.getElementById('daoModalTitle').textContent = 'Post';

  const ui = loadUI();
  const replyingTo = ui.replyTo && ui.replyTo.postId === postId ? ui.replyTo : null;

  document.getElementById('daoModalBody').innerHTML = `
    <div class="sheet-item">
      <div class="t">${esc(p.title)}</div>
      <div class="m">${esc(p.topic || 'Sin tema')} · ${esc(fmt(p.ts))}</div>
      <div style="margin-top:10px;white-space:pre-wrap;">${esc(p.body || '')}</div>

      <div style="margin-top:12px;display:flex;gap:10px;flex-wrap:wrap;">
        <button class="btn" type="button" data-like="${esc(p.id)}">
          ♥️ <span class="count">${p.likes||0}</span>
        </button>
        <button class="btn" type="button" data-point="${esc(p.id)}">
          ⭐ <span class="count">${p.points||0}</span>
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
}


async function copyLink(id){
  const url = location.href.split('#')[0] + `#post-${id}`;
  try{ await navigator.clipboard.writeText(url); }catch{}
}


function mutatePost(id, fn){
  const posts = loadJSON(DB_KEY, []);
  const idx = posts.findIndex(p => p.id === id);
  if(idx === -1) return;

  const next = fn(ensurePostSchema(posts[idx])) || posts[idx];
  posts[idx] = next;

  saveJSON(DB_KEY, posts);

  // ✅ sincroniza cache para que openPostModal/renderAll usen lo nuevo
  if (Array.isArray(POSTS_CACHE) && POSTS_CACHE.length) {
    const cidx = POSTS_CACHE.findIndex(p => p.id === id);
    if (cidx !== -1) POSTS_CACHE[cidx] = next;
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

/* =========================
   Wire-up (SIN romper shell)
   Solo escuchamos dentro del main.container
========================= */
seedIfEmpty();


// =========================
// Wire-up estático del DAO
// (tabs, search, publish, carrusel)
// =========================
const daoMain = document.querySelector('main.container');

if (!daoMain) {
  // Si no encuentra el contenedor, igual renderizamos por si acaso
  renderAll();

} else {
  // Render inicial
  renderAll();

  // =========================
  // Tabs
  // =========================
  daoMain.querySelectorAll('.dao-tab').forEach(btn => {
    btn.addEventListener('click', () => {
      activeView = btn.dataset.view;

      daoMain.querySelectorAll('.dao-tab').forEach(b => {
        const on = b === btn;
        b.classList.toggle('active', on);
        b.setAttribute('aria-selected', on ? 'true' : 'false');
      });

      carIndex = 0;
      renderAll();
    });
  });

  // =========================
  // Backrooms / Topics
  // =========================
  daoMain.querySelector('#openRooms')
    ?.addEventListener('click', openRoomsModal);

  daoMain.querySelector('#openTopics')
    ?.addEventListener('click', openTopicsModal);

  // =========================
  // Carrusel
  // =========================
  daoMain.querySelector('#carPrev')
    ?.addEventListener('click', () => {
      carIndex = Math.max(0, carIndex - 1);
      renderAll();
    });

  daoMain.querySelector('#carNext')
    ?.addEventListener('click', () => {
      carIndex += 1;
      renderAll();
    });

  daoMain.querySelector('#carDots')
    ?.addEventListener('click', (e) => {
      const d = e.target.closest('[data-dot]');
      if (!d) return;
      carIndex = Number(d.dataset.dot || 0);
      renderAll();
    });

  // =========================
  // Search
  // =========================
  daoMain.querySelector('#search')
    ?.addEventListener('input', () => renderAll());

  daoMain.querySelector('#clearSearch')
    ?.addEventListener('click', () => {
      const s = daoMain.querySelector('#search');
      if (s) s.value = '';
      renderAll();
    });

  // =========================
  // Crear post (demo local)
  // =========================
  daoMain.querySelector('#publishPost')
    ?.addEventListener('click', () => {

      const title = (daoMain.querySelector('#postTitle')?.value || '').trim();
      const body  = (daoMain.querySelector('#postBody')?.value || '').trim();
      const topic = (daoMain.querySelector('#postTopic')?.value || '').trim();
      const status = daoMain.querySelector('#publishStatus');

      if (title.length < 3 || body.length < 10) {
        if (status) {
          status.textContent = 'Completa título (3+) y cuerpo (10+).';
        }
        return;
      }

      const posts = loadJSON(DB_KEY, []);
      posts.unshift({
        id: uid(),
        title,
        body,
        topic,
        ts: now(),
        likes: 0,
        points: 0,
        comments: []
      });

      saveJSON(DB_KEY, posts);

      const t = daoMain.querySelector('#postTitle');
      const b = daoMain.querySelector('#postBody');
      if (t) t.value = '';
      if (b) b.value = '';

      if (status) status.textContent = 'Publicado.';
      carIndex = 0;
      renderAll();
    });

}



