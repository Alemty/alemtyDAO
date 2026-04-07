
import { mountShell } from '/shared/js/shell.js';
mountShell();

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
function esc(s){
  return String(s ?? '').replace(/[&<>"']/g, m => ({
    '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'
  }[m]));
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
/* cierre global ok */
document.addEventListener('click', (e)=>{
  if(e.target.closest('[data-close]')) closeModal();
});


async function getPostsSafe() {
  try {
    const posts = await API.getPosts();
    if (Array.isArray(posts)) return posts;
  } catch (e) {
    console.warn("API offline, usando localStorage");
  }
  return loadJSON(DB_KEY, []); // fallback
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

// ✅ ESTA ES LA FUNCIÓN QUE TE FALTA (y que tu click handler ya está usando)
function getActionEntry(actions, userId, postId){
  actions[userId] ||= {};
  actions[userId][postId] ||= { liked:false, pointsGiven:0 };
  return actions[userId][postId];
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

  document.querySelectorAll('.pill[data-action][data-post-id]').forEach(el => {
    const postId = el.dataset.postId;
    const entry = mine[postId];
    if (!entry) return;

    if (el.dataset.action === 'like') {
      el.classList.toggle('active', !!entry.liked);
    }
    if (el.dataset.action === 'points') {
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

function renderPanel(){
  document.getElementById('panelTitle').textContent = PANEL_MODEL[activeView].title;
  document.getElementById('panelDesc').textContent = PANEL_MODEL[activeView].desc;
}

async function renderAll(){
  const posts = await getPostsSafe();
  renderTopicsSelect();
  renderPanel();
  renderCarousel(posts);
  renderLatest(posts);
  renderFeed(posts);
  renderMiniGrid('topWeek', filterWeek(posts));
  renderMiniGrid('topMonth', filterMonth(posts));
  applyActionState(); // ✅ al final, cuando ya existe el DOM
}


/* =========================
   Post modal
========================= */
function openPostModal(postId){
  const posts = loadJSON(DB_KEY, []);
  const p = posts.find(x => x.id === postId);
  if(!p) return;

  document.getElementById('daoModalTitle').textContent = 'Post';
  const comments = (p.comments||[]).slice().reverse().map(c => `
    <div class="sheet-item">
      <div class="t">${esc(fmt(c.ts))}</div>
      <div class="m">${esc(c.text)}</div>
    </div>
  `).join('');

  document.getElementById('daoModalBody').innerHTML = `
    <div class="sheet-item">
      <div class="t">${esc(p.title)}</div>
      <div class="m">${esc(p.topic||'Sin tema')} · ${esc(fmt(p.ts))}</div>
      <div style="margin-top:10px;white-space:pre-wrap;">${esc(p.body||'')}</div>
      <div style="margin-top:12px;display:flex;gap:10px;flex-wrap:wrap;">
        <button class="btn" type="button" data-like="${esc(p.id)}">♥️ ${p.likes||0}</button>
        <button class="btn" type="button" data-point="${esc(p.id)}">⭐ ${p.points||0}</button>
        <button class="btn" type="button" data-share="${esc(p.id)}">🔗 Copiar link</button>
      </div>
    </div>

    <div style="margin-top:14px;">
      <div class="h2">Comentarios</div>
      ${comments || `<p class="small muted">Sin comentarios.</p>`}

      <div style="margin-top:10px;display:flex;gap:10px;flex-wrap:wrap;">
        <input id="commentText" placeholder="Escribe un comentario…">
        <button class="btn primary" type="button" data-send="${esc(p.id)}">Enviar</button>
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
  posts[idx] = fn(posts[idx]) || posts[idx];
  saveJSON(DB_KEY, posts);
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

const daoMain = document.querySelector('main.container');
if(!daoMain){
  // Si no encuentra el contenedor, igual renderizamos por si acaso
  renderAll();
} else {
  renderAll();

  // Tabs
  daoMain.querySelectorAll('.dao-tab').forEach(btn=>{
    btn.addEventListener('click', ()=>{
      activeView = btn.dataset.view;
      daoMain.querySelectorAll('.dao-tab').forEach(b=>{
        const on = b === btn;
        b.classList.toggle('active', on);
        b.setAttribute('aria-selected', on ? 'true' : 'false');
      });
      carIndex = 0;
      renderAll();
    });
  });

  // Backrooms / Topics
  daoMain.querySelector('#openRooms')?.addEventListener('click', openRoomsModal);
  daoMain.querySelector('#openTopics')?.addEventListener('click', openTopicsModal);

  // Carousel controls
  daoMain.querySelector('#carPrev')?.addEventListener('click', ()=>{
    carIndex = Math.max(0, carIndex-1);
    renderAll();
  });
  daoMain.querySelector('#carNext')?.addEventListener('click', ()=>{
    carIndex = carIndex + 1;
    renderAll();
  });
  daoMain.querySelector('#carDots')?.addEventListener('click', (e)=>{
    const d = e.target.closest('[data-dot]');
    if(!d) return;
    carIndex = Number(d.dataset.dot||0);
    renderAll();
  });

  // Search
  daoMain.querySelector('#search')?.addEventListener('input', ()=> renderAll());
  daoMain.querySelector('#clearSearch')?.addEventListener('click', ()=>{
    daoMain.querySelector('#search').value = '';
    renderAll();
  });

  // Crear post
  daoMain.querySelector('#publishPost')?.addEventListener('click', ()=>{
    const title = (daoMain.querySelector('#postTitle').value||'').trim();
    const body  = (daoMain.querySelector('#postBody').value||'').trim();
    const topic = (daoMain.querySelector('#postTopic').value||'').trim();
    const status = daoMain.querySelector('#publishStatus');

    if(title.length < 3 || body.length < 10){
      status.textContent = 'Completa título (3+) y cuerpo (10+).';
      return;
    }

    const posts = loadJSON(DB_KEY, []);
    posts.unshift({ id: uid(), title, body, topic, ts: now(), likes:0, points:0, comments:[] });
    saveJSON(DB_KEY, posts);

    daoMain.querySelector('#postTitle').value = '';
    daoMain.querySelector('#postBody').value = '';
    status.textContent = 'Publicado.';
    carIndex = 0;
    renderAll();
  });

  // Click handler interno (open post / like / points / share / comment / add room/topic / pick topic)
  daoMain.addEventListener('click', async (e)=>{
    



// =========================
// Pills: like / points / comment (visitor = lectura)
// =========================
const pill = e.target.closest('.pill[data-action]');
if (pill) {
  e.preventDefault();
  e.stopPropagation();

  const action = pill.dataset.action;
  let postId = pill.dataset.postId;

  // fallback: latestCard si viene vacío
  if (!postId) {
    const latestCard = document.getElementById('latestCard');
    postId = latestCard?.dataset.openPost;
  }
  if (!postId) return;

  const userId = getUserId();

  // ✅ VISITOR: lectura (sí puede abrir post/comentarios)
  if (userId === 'visitor') {
    if (action === 'comment') {
      openPostModal(postId);
      return;
    }
    // like/points bloqueados
    // UX: muestra hint (elige una)
    // 1) alert simple:
    // alert('Conecta tu wallet (☰) para participar.');
    //
    // 2) abre el modal de Backrooms/Temas como CTA (si te gusta):
    // openRoomsModal();
    //
    // 3) o abre Temas:
    // openTopicsModal();
    return;
  }

  // ✅ Usuario conectado: aplica límites
  const actions = loadActions();
  const entry = getActionEntry(actions, userId, postId);

  if (action === 'like') {
    if (entry.liked) return;
    entry.liked = true;
    mutatePost(postId, p => ({ ...p, likes: (p.likes || 0) + 1 }));
    saveActions(actions);
    renderAll();
    return;
  }

  if (action === 'points') {
    if (entry.pointsGiven >= POINTS_MAX_PER_POST) return;
    entry.pointsGiven += 1;
    mutatePost(postId, p => ({ ...p, points: (p.points || 0) + 1 }));
    saveActions(actions);
    renderAll();
    return;
  }

  if (action === 'comment') {
    openPostModal(postId);
    return;
  }
}




    const openPost = e.target.closest('[data-open-post]');
    if(openPost){
      const id = openPost.getAttribute('data-open-post') || openPost.dataset.openPost;
      if(id) openPostModal(id);
      return;
    }

    
const like = e.target.closest('[data-like]');
if (like) {
  const postId = like.getAttribute('data-like');
  const userId = getUserId();
  const actions = loadActions();
  const entry = getActionEntry(actions, userId, postId);

  if (entry.liked) return; // ❤️ max 1
  entry.liked = true;

  mutatePost(postId, p => ({ ...p, likes: (p.likes || 0) + 1 }));
  saveActions(actions);
  renderAll();
  openPostModal(postId); // refresca modal con valores nuevos
  return;
}


    
const point = e.target.closest('[data-point]');
if (point) {
  const postId = point.getAttribute('data-point');
  const userId = getUserId();
  const actions = loadActions();
  const entry = getActionEntry(actions, userId, postId);

  if (entry.pointsGiven >= POINTS_MAX_PER_POST) return; // ⭐ max 10
  entry.pointsGiven += 1;

  mutatePost(postId, p => ({ ...p, points: Math.max(0, (p.points || 0) + 1) }));
  saveActions(actions);
  renderAll();
  openPostModal(postId);
  return;
}


    const share = e.target.closest('[data-share]');
    if(share){
      await copyLink(share.getAttribute('data-share'));
      return;
    }

    const send = e.target.closest('[data-send]');
    if(send){
      const id = send.getAttribute('data-send');
      const text = (document.getElementById('commentText')?.value||'').trim();
      if(text.length < 2) return;
      mutatePost(id, p => ({...p, comments: [...(p.comments||[]), { ts: now(), text }]}));
      openPostModal(id);
      renderAll();
      return;
    }

    if(e.target.id === 'addRoom'){
      const name = prompt('Nombre de la sala/backroom:');
      if(!name) return;
      const rooms = loadJSON(ROOMS_KEY, []);
      rooms.unshift(name.trim());
      saveJSON(ROOMS_KEY, rooms);
      openRoomsModal();
      return;
    }

    if(e.target.id === 'addTopic'){
      const name = prompt('Nombre del tema:');
      if(!name) return;
      const topics = loadJSON(TOPICS_KEY, DEFAULT_TOPICS);
      topics.unshift(name.trim());
      saveJSON(TOPICS_KEY, topics);
      openTopicsModal();
      return;
    }

    const pick = e.target.closest('[data-topic-pick]');
    if(pick){
      const t = pick.getAttribute('data-topic-pick');
      const sel = daoMain.querySelector('#postTopic');
      if(sel) sel.value = t;
      closeModal();
    }
  });
}

/* =========================================
   Marcar Backrooms / Temas como activos
   ========================================= */

const btnRooms  = document.getElementById('openRooms');
const btnTopics = document.getElementById('openTopics');

/* Siempre encendidos */
btnRooms?.classList.add('glow');
btnTopics?.classList.add('glow');

/* Opcional: alternar glow según modal abierto */
function setActiveGlow(type){
  btnRooms?.classList.toggle('glow', type === 'rooms');
  btnTopics?.classList.toggle('glow', type === 'topics');
}

/* Si quieres que al abrir el modal se destaque uno */
const _openRooms = openRoomsModal;
const _openTopics = openTopicsModal;

window.openRoomsModal = function(){
  setActiveGlow('rooms');
  _openRooms();
};

window.openTopicsModal = function(){
  setActiveGlow('topics');
  _openTopics();
};

const API = {
  async getPosts() {
    return fetch("/api/posts").then(r => r.json());
  },
  async react(postId, type) {
    return fetch(`/api/posts/${postId}/react`, {
      method: "POST",
      body: JSON.stringify({ type })
    });
  }
}
