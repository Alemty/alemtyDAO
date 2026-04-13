// shared/js/core.js
export const VERSION = 'alemtydao.v0.02';
export const $ = (sel, ctx=document) => ctx.querySelector(sel);
export const $$ = (sel, ctx=document) => Array.from(ctx.querySelectorAll(sel));
export const esc = (s) => String(s ?? '').replace(/[&<>"']/g, c => ({
  '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'
}[c]));
export const shortAddr = (a) => {
  const s = String(a ?? '').trim();
  return (s.length < 10) ? '—' : (s.slice(0,6) + '…' + s.slice(-4));
};
export function loadTheme(){
  const root = document.documentElement;
  const saved = localStorage.getItem('theme') || 'dark';
  root.classList.toggle('light', saved === 'light');
}
export function toggleTheme(){
  const root = document.documentElement;
  root.classList.toggle('light');
  localStorage.setItem('theme', root.classList.contains('light') ? 'light' : 'dark');
}
export function hasEthereum(){
  return typeof window !== 'undefined' && !!window.ethereum;
}
export async function requestAccounts(){
  if(!hasEthereum()) throw new Error('No wallet');
  const accounts = await window.ethereum.request({ method: 'eth_requestAccounts' });
  return accounts?.[0] || null;
}
