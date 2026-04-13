// shared/js/tokenomics.js
import { loadPosts } from './forum.js';

export const RANKS = [
  {name:'Novato',min:0},{name:'Iniciado',min:100},{name:'Plata',min:500},{name:'Oro',min:1500},
  {name:'Diamante',min:5000},{name:'Avanzado',min:12000},{name:'Refinado',min:30000},{name:'Único',min:75000},
  {name:'Elite',min:150000},{name:'Superior',min:300000},{name:'Amasterdamo',min:600000}
];

export function computeUserStats(addr, posts){
  const a = String(addr||'').toLowerCase();
  const list = Array.isArray(posts) ? posts : [];
  let postsCount=0, commentsCount=0, likesReceived=0, likesGiven=0;

  for(const p of list){
    const lb = p?.likedBy;
    if(lb && typeof lb==='object' && lb[a]) likesGiven++;
  }

  for(const p of list){
    if(!p) continue;
    if(String(p.addr||'').toLowerCase()===a){
      postsCount++;
      likesReceived += Number(p.likes||0);
    }
    const cs = Array.isArray(p.comments) ? p.comments : [];
    for(const c of cs){
      if(String(c?.addr||'').toLowerCase()===a) commentsCount++;
    }
  }

  // Copiamos la semántica legacy (aprox) para que "se sienta igual"
  const karma = Math.max(0, likesReceived + Math.floor(commentsCount*0.5) + postsCount);
  const xp = Math.max(0, postsCount*20 + commentsCount*6 + likesReceived*3 + likesGiven);
  const level = Math.max(1, Math.floor(xp/100)+1);

  let current = RANKS[0];
  for(const r of RANKS) if(xp >= r.min) current = r;
  const idx = RANKS.findIndex(r => r.name === current.name);
  const next = (idx >= 0 && idx < RANKS.length-1) ? RANKS[idx+1] : null;
  const nextMin = next ? next.min : null;
  const baseMin = current ? current.min : 0;
  const span = nextMin ? Math.max(1, nextMin-baseMin) : 1;
  const within = nextMin ? Math.min(span, Math.max(0, xp-baseMin)) : span;
  const progress = nextMin ? Math.round((within/span)*100) : 100;

  return { addr, postsCount, commentsCount, likesReceived, likesGiven, karma, xp, level,
    rank: current.name, nextRank: next?.name, nextRankMin: nextMin, progress };
}

export function getAuraBalance(addr){
  const a = String(addr||'').toLowerCase();
  const v = Number(localStorage.getItem(`aura.balance.${a}`));
  return Number.isFinite(v) ? Math.max(0, v) : 0;
}

export function getAlemBalance(addr){
  const a = String(addr||'').toLowerCase();
  const v = Number(localStorage.getItem(`alem.balance.${a}`));
  return Number.isFinite(v) ? Math.max(0, v) : 0;
}

export function snapshotMyTokenState(addr){
  const posts = loadPosts();
  const s = computeUserStats(addr, posts);
  return { ...s, aura: getAuraBalance(addr), alem: getAlemBalance(addr) };
}
