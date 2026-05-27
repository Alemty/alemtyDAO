// shared/js/notifications.js
// Notificaciones (🔔) + badge + modal
import { $, esc } from './core.js';
import { getDid } from './wallet.js';
import { fetchMeStats, API_BASE, getJWT } from './api.js';
import { isModOrAdminNow } from './moderation.js';

let __ME_STATS__ = null;

export function buildNotifModal() {
  const el = document.createElement("div");
  el.className = "modal";
  el.id = "notifModal";
  el.setAttribute("aria-hidden", "true");
  el.innerHTML = `
    <div class="modal-backdrop" id="notifBackdrop"></div>
    <div class="modal-card notif-card">
      <div class="modal-headbar">
        <strong>Notificaciones</strong>
        <button class="icon-btn" id="notifClose" type="button" aria-label="Cerrar">✕</button>
      </div>
      <div class="notif-body" id="notifBody"><div class="small muted">Cargando…</div></div>
    </div>`;
  return el;
}

async function fetchNotifStats() {
  if (__ME_STATS__) return __ME_STATS__;
  const addr = getDid();
  if (!addr) return null;
  __ME_STATS__ = await fetchMeStats();
  return __ME_STATS__;
}

async function fetchModPendingCount() {
  if (!isModOrAdminNow()) return 0;
  const token = getJWT();
  if (!token) return 0;
  try {
    const r = await fetch(`${API_BASE}/api/mod/reports?status=pending`, {
      headers: { Authorization: `Bearer ${token}` }, cache: "no-store"
    });
    if (!r.ok) return 0;
    const ct = r.headers.get("content-type") || "";
    if (!ct.includes("application/json")) return 0;
    const j = await r.json().catch(() => ({}));
    const n = Number(j?.total || j?.pending || 0);
    return Number.isFinite(n) ? n : 0;
  } catch { return 0; }
}

function setNotifBadge(n) {
  const badge = document.getElementById("notifBadge");
  if (!badge) return;
  const x = Number(n || 0);
  if (x > 0) { badge.hidden = false; badge.textContent = String(x); }
  else { badge.hidden = true; badge.textContent = "0"; }
}

export async function updateNotifUI() {
  const stats = await fetchNotifStats();
  const likesReceived = Number(stats?.received?.likesReceived || 0);
  const commentsReceived = Number(stats?.received?.commentsReceived || 0);
  const pointsReceived = Number(stats?.received?.pointsReceived || 0);
  const repliesReceived = Number(stats?.received?.repliesReceived || 0);
  const modPending = await fetchModPendingCount();
  const total = likesReceived + commentsReceived + pointsReceived + repliesReceived + modPending;
  setNotifBadge(total);
}

export async function openNotifModal() {
  const stats = await fetchNotifStats();
  const modPending = await fetchModPendingCount();
  renderNotifList({ stats, modPending });
  openModal("notifModal");
}

function renderNotifList({ stats, modPending }) {
  const body = document.getElementById("notifBody");
  if (!body) return;

  const addr = getDid();
  const isAuth = !!getJWT();

  if (!addr) {
    body.innerHTML = `<div class="small muted">Conecta tu wallet y verifica SIWE para ver notificaciones.</div>`;
    return;
  }
  if (!isAuth) {
    body.innerHTML = `<div class="small muted">Verifica SIWE para habilitar notificaciones.</div>`;
    return;
  }

  const items = [
    { ico: "♥️", txt: "Likes recibidos (acumulado)", n: Number(stats?.received?.likesReceived || 0) },
    { ico: "💬", txt: "Comentarios recibidos (acumulado)", n: Number(stats?.received?.commentsReceived || 0) },
    { ico: "⭐", txt: "Points recibidos (acumulado)", n: Number(stats?.received?.pointsReceived || 0) },
    { ico: "↪️", txt: "Respuestas (SOON)", n: Number(stats?.received?.repliesReceived || 0) },
  ];

  const modRow = isModOrAdminNow()
    ? `<button class="notif-item" type="button" data-open-mod="1"><span class="ico">⚖️</span><span class="txt">Moderación / Reportes</span><span class="n">${modPending}</span></button>`
    : "";

  body.innerHTML = `<div class="notif-list">${items.map(i =>
    `<div class="notif-item"><span class="ico">${i.ico}</span><span class="txt">${i.txt}</span><span class="n">${i.n}</span></div>`
  ).join('')}${modRow}</div><div class="small muted" style="margin-top:10px;">Notificaciones detalladas — SOON.</div>`;

  body.querySelector('[data-open-mod]')?.addEventListener("click", async () => {
    const { openModerationModal } = await import('./moderation.js');
    await openModerationModal();
  });
}

export function openModal(id) {
  const m = document.getElementById(id);
  if (m) { m.classList.add("open"); m.setAttribute("aria-hidden", "false"); }
}

export function closeModal(id) {
  const m = document.getElementById(id);
  if (m) { m.classList.remove("open"); m.setAttribute("aria-hidden", "true"); }
}

export function closeAllPanels() {
  ["profileModal", "notifModal", "modModal"].forEach(id => closeModal(id));
  const d = document.getElementById("drawer");
  const b = document.getElementById("drawerBackdrop");
  if (d) { d.classList.remove("open"); d.setAttribute("aria-hidden", "true"); }
  if (b) b.classList.remove("show");
}
