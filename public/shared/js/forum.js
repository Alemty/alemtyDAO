
// shared/js/forum.js
import { esc } from './core.js';
import { loadJSON, saveJSON, KEYS } from './storage.js';

/* =========================================================
   Utils / IDs
========================================================= */
const uid = () =>
  (crypto.randomUUID?.() || (String(Date.now()) + Math.random()));

/* =========================================================
   Normalización de posts
========================================================= */
export function normalizePost(p){
  const post = { ...p };
  post.id = post.id || uid();
  post.addr = post.addr || '';
  post.ens = post.ens || '';
  post.title = post.title || '';
  post.body = post.body || '';
  post.topic = post.topic || '';
  post.ts = Number(post.ts || Date.now());
  post.likes = Number(post.likes || 0);
  post.points = Number(post.points || 0);
  post.likedBy =
    (post.likedBy && typeof post.likedBy === 'object') ? post.likedBy : {};
  post.comments = Array.isArray(post.comments) ? post.comments : [];
  post.comments = post.comments.map(c => ({
    id: c.id || uid(),
    addr: c.addr || '',
    text: c.text || '',
    ts: Number(c.ts || Date.now())
  }));
  return post;
}

/* =========================================================
   Storage helpers
========================================================= */
export function loadPosts(){
  return loadJSON(KEYS.POSTS, []).map(normalizePost);
}

export function savePosts(list){
  saveJSON(KEYS.POSTS, list);
}

export function loadAnnouncement(defaultText=''){
  const val = localStorage.getItem(KEYS.ANN);
  return (val == null) ? defaultText : val;
}

export function saveAnnouncement(text){
  localStorage.setItem(KEYS.ANN, String(text || ''));
}

/* =========================================================
   Mutations (likes / points / comments)
========================================================= */
export function createPost({addr,title,body,topic}){
  const list = loadPosts();
  list.push(
    normalizePost({
      id: uid(),
      addr,
      title,
      body,
      topic: topic || '',
      ts: Date.now(),
      likes: 0,
      points: 0,
      likedBy: {},
      comments: []
    })
  );
  savePosts(list);
  return list;
}

export function toggleLike(postId, byLower){
  const list = loadPosts();
  const idx = list.findIndex(p => p.id === postId);
  if(idx < 0) return list;
  const p = list[idx];
  p.likedBy = p.likedBy || {};
  if(p.likedBy[byLower]){
    delete p.likedBy[byLower];
    p.likes = Math.max(0, Number(p.likes||0)-1);
  } else {
    p.likedBy[byLower] = true;
    p.likes = Number(p.likes||0)+1;
  }
  list[idx] = p;
  savePosts(list);
  return list;
}

export function awardPoints(postId, delta){
  const list = loadPosts();
  const idx = list.findIndex(p => p.id === postId);
  if(idx < 0) return list;
  list[idx].points =
    Math.max(0, Number(list[idx].points||0) + Number(delta||0));
  savePosts(list);
  return list;
}

export function addComment(postId, {addr, text}){
  const list = loadPosts();
  const idx = list.findIndex(p => p.id === postId);
  if(idx < 0) return list;
  list[idx].comments = Array.isArray(list[idx].comments)
    ? list[idx].comments
    : [];
  list[idx].comments.push({ id: uid(), addr, text, ts: Date.now() });
  savePosts(list);
  return list;
}

/* =========================================================
   Scoring / sorting
========================================================= */
export function score(p){
  return (
    Number(p.likes||0) +
    Number((p.comments||[]).length) +
    Number(p.points||0)
  );
}

export function topPosts(list, {sinceMs=null, limit=7}={}){
  let arr = Array.isArray(list) ? list.slice() : [];
  if(sinceMs != null){
    arr = arr.filter(p => Number(p.ts||0) >= sinceMs);
  }
  arr.sort((a,b) => score(b)-score(a));
  return arr.slice(0, limit);
}

/* =========================================================
   UI HELPERS (FASE 3.1)
   ⚠️ Solo helpers, NO DOM directo
========================================================= */

/** Formatea autor: ENS si existe, si no 0x1234…abcd */
export function formatAuthor(addr, ens){
  if (ens) return esc(ens);
  if (!addr) return '—';
  return esc(addr.slice(0,6) + '…' + addr.slice(-4));
}

/** Fecha corta MX */
export function formatDate(ts){
  try{
    return new Date(ts).toLocaleDateString('es-MX', {
      day: '2-digit',
      month: 'short',
      year: 'numeric'
    });
  }catch{
    return '';
  }
}

/** Header visual estándar de post (HTML string) */
export function renderPostHeader(post){
  return `
    <div class="post-header">
      <div class="post-title">${esc(post.title)}</div>

      <div class="post-sub">
        <a
          href="#"
          class="post-author"
          data-author="${esc(post.addr)}"
          role="button"
        >
          ${formatAuthor(post.addr, post.ens)}
        </a>
        <span class="post-dot">·</span>
        <span class="post-topic">${esc(post.topic || 'Sin tema')}</span>
        <span class="post-dot">·</span>
        <span class="post-date">${formatDate(post.ts)}</span>
      </div>
    </div>
  `;
}

/* =========================================================
   Rooms / Topics (custom)
========================================================= */
export function loadList(key){
  try{ return JSON.parse(localStorage.getItem(key) || '[]'); }
  catch{ return []; }
}

export function saveList(key, arr){
  localStorage.setItem(key, JSON.stringify(arr||[]));
}

export function slug(s){
  return String(s||'')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g,'')
    .replace(/[^a-z0-9]+/g,'-')
    .replace(/(^-|-$)/g,'');
}
