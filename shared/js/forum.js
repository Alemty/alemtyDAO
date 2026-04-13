// shared/js/forum.js
import { esc } from './core.js';
import { loadJSON, saveJSON, KEYS } from './storage.js';

const uid = () => (crypto.randomUUID?.() || (String(Date.now()) + Math.random()));

export function normalizePost(p){
  const post = { ...p };
  post.id = post.id || uid();
  post.addr = post.addr || '';
  post.title = post.title || '';
  post.body = post.body || '';
  post.topic = post.topic || '';
  post.ts = Number(post.ts || Date.now());
  post.likes = Number(post.likes || 0);
  post.points = Number(post.points || 0);
  post.likedBy = (post.likedBy && typeof post.likedBy === 'object') ? post.likedBy : {};
  post.comments = Array.isArray(post.comments) ? post.comments : [];
  post.comments = post.comments.map(c => ({
    id: c.id || uid(),
    addr: c.addr || '',
    text: c.text || '',
    ts: Number(c.ts || Date.now())
  }));
  return post;
}

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

export function createPost({addr,title,body,topic}){
  const list = loadPosts();
  list.push(normalizePost({ id: uid(), addr, title, body, topic: topic || '', ts: Date.now(), likes:0, points:0, likedBy:{}, comments:[] }));
  savePosts(list);
  return list;
}

export function toggleLike(postId, byLower){
  const list = loadPosts();
  const idx = list.findIndex(p => p.id === postId);
  if(idx < 0) return list;
  const p = list[idx];
  p.likedBy = p.likedBy || {};
  if(p.likedBy[byLower]){ delete p.likedBy[byLower]; p.likes = Math.max(0, Number(p.likes||0)-1); }
  else{ p.likedBy[byLower] = true; p.likes = Number(p.likes||0)+1; }
  list[idx] = p;
  savePosts(list);
  return list;
}

export function awardPoints(postId, delta){
  const list = loadPosts();
  const idx = list.findIndex(p => p.id === postId);
  if(idx < 0) return list;
  list[idx].points = Math.max(0, Number(list[idx].points||0) + Number(delta||0));
  savePosts(list);
  return list;
}

export function addComment(postId, {addr, text}){
  const list = loadPosts();
  const idx = list.findIndex(p => p.id === postId);
  if(idx < 0) return list;
  list[idx].comments = Array.isArray(list[idx].comments) ? list[idx].comments : [];
  list[idx].comments.push({ id: uid(), addr, text, ts: Date.now() });
  savePosts(list);
  return list;
}

export function fmt(ts){
  try{ return new Date(ts).toLocaleString(); }catch{ return ''; }
}

export function score(p){
  return (Number(p.likes||0) + Number((p.comments||[]).length) + Number(p.points||0));
}

export function topPosts(list, {sinceMs=null, limit=7}={}){
  let arr = Array.isArray(list) ? list.slice() : [];
  if(sinceMs != null) arr = arr.filter(p => Number(p.ts||0) >= sinceMs);
  arr.sort((a,b) => score(b)-score(a));
  return arr.slice(0, limit);
}

// Rooms / Topics (custom)
export function loadList(key){
  try{ return JSON.parse(localStorage.getItem(key) || '[]'); }catch{ return []; }
}
export function saveList(key, arr){
  localStorage.setItem(key, JSON.stringify(arr||[]));
}

export function slug(s){
  return String(s||'').trim().toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g,'').replace(/[^a-z0-9]+/g,'-').replace(/(^-|-$)/g,'');
}
