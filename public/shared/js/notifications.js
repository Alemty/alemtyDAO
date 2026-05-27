// shared/js/notifications.js
// Notificaciones (🔔) + badge + modal
import { $, esc } from './core.js';
import { getDid } from './wallet.js';
import { fetchMeStats, API_BASE, getJWT } from './api.js';
import { isModOrAdminNow } from './moderation.js';

let __ME_STATS__ = null;
let __TIMELINE__ = [];
let __PAGE__ = 0;
const PER_PAGE = 10;

function fmtTs(ts) {
  if (!ts) return '';
  var d = new Date(ts);
  var now = Date.now();
  if (!d.getTime()) return '';
  var diff = now - d.getTime();
  if (diff < 60000) return 'ahora';
  if (diff < 3600000) return Math.floor(diff / 60000) + 'm';
  if (diff < 86400000) return Math.floor(diff / 3600000) + 'h';
  if (diff < 604800000) return Math.floor(diff / 86400000) + 'd';
  return d.toLocaleDateString('es-MX', { day:'numeric', month:'short' });
}

function shortAddr(addr) {
  if (!addr || addr.length < 10) return addr || '—';
  return addr.slice(0,6) + '...' + addr.slice(-4);
}

export function buildNotifModal() {
  const el = document.createElement("div");
  el.className = "modal";
  el.id = "notifModal";
  el.setAttribute("aria-hidden", "true");
  el.innerHTML = `
    <div class="modal-backdrop" id="notifBackdrop"></div>
    <div class="modal-card notif-card">
      <div class="modal-headbar">
        <button class="icon-btn" id="notifBack" type="button" aria-label="Atrás">←</button>
        <strong>Notificaciones</strong>
        <button class="icon-btn" id="notifClose" type="button" aria-label="Cerrar">✕</button>
      </div>
      <div class="notif-body" id="notifBody"><div class="small muted">Cargando…</div></div>
      <div class="notif-footer" id="notifFooter" style="display:none;padding:10px 16px;border-top:1px solid var(--ui-border);">
        <div style="display:flex;gap:10px;justify-content:center;">
          <button class="btn" id="notifPrev" type="button" disabled style="font-size:12px;padding:6px 14px;">← Anterior</button>
          <span id="notifPageInfo" style="font-size:12px;font-weight:700;display:flex;align-items:center;opacity:.6;">Página 1</span>
          <button class="btn" id="notifNext" type="button" style="font-size:12px;padding:6px 14px;">Siguiente →</button>
        </div>
      </div>
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
  return 0;
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
  var body = document.getElementById("notifBody");
  if (body) body.innerHTML = '<div class="small muted">Cargando notificaciones...</div>';
  openModal("notifModal");
  var notifData = await fetchRecentNotifications();
  __TIMELINE__ = mergeByDate(notifData && notifData.likes, notifData && notifData.points, notifData && notifData.comments);
  __PAGE__ = 0;
  renderNotifList({ stats: stats });
}

async function fetchRecentNotifications() {
  var token = getJWT();
  if (!token) return null;
  try {
    var r = await fetch(API_BASE + '/api/posts/me/notifications?limit=50', {
      headers: { Authorization: 'Bearer ' + token }
    });
    if (!r.ok) {
      var errBody = await r.text().catch(function(){ return ''; });
      console.error('notif fetch error', r.status, errBody);
      return null;
    }
    var j = await r.json();
    if (!j || !j.ok) return null;
    return j;
  } catch(e) {
    console.error('notif fetch exception', e);
    return null;
  }
}

function mergeByDate(likes, points, comments) {
  var all = [];
  if (likes) likes.forEach(function(l) {
    all.push({ type:'like', ico:'\u2665\ufe0f', by:l.by, postId:l.postId, postTitle:l.postTitle, ts:l.ts, detail:'' });
  });
  if (points) points.forEach(function(p) {
    all.push({ type:'point', ico:'\u2b50', by:p.by, postId:p.postId, postTitle:p.postTitle, ts:p.ts, detail:p.amount + ' point' + (p.amount > 1 ? 's' : '') });
  });
  if (comments) comments.forEach(function(c) {
    all.push({ type:'comment', ico:'\ud83d\udcac', by:c.by, postId:c.postId, postTitle:c.postTitle, ts:c.ts, detail:(c.body || '').slice(0,100) });
  });
  all.sort(function(a, b) { return new Date(b.ts || 0).getTime() - new Date(a.ts || 0).getTime(); });
  return all;
}

function renderNotifList({ stats, modPending }) {
  const body = document.getElementById("notifBody");
  if (!body) return;

  // Scroll al inicio cuando cambia de página
  body.scrollTop = 0;

  const addr = getDid();
  const isAuth = !!getJWT();

  if (!addr) {
    body.innerHTML = `<div class="small muted">Conecta tu wallet y verifica SIWE para ver notificaciones.</div>`;
    return;
  }
  if (!isAuth) {
    body.innerHTML = '<div class="small muted">Verifica SIWE para habilitar notificaciones.</div>';
    return;
  }

  var totalLikes = Number(stats && stats.received && stats.received.likesReceived || 0);
  var totalComments = Number(stats && stats.received && stats.received.commentsReceived || 0);
  var totalPoints = Number(stats && stats.received && stats.received.pointsReceived || 0);

  var totalPages = Math.ceil(__TIMELINE__.length / PER_PAGE) || 1;
  var start = __PAGE__ * PER_PAGE;
  var pageItems = __TIMELINE__.slice(start, start + PER_PAGE);

  var itemsHtml = '';
  if (pageItems.length > 0) {
    for (var i = 0; i < pageItems.length; i++) {
      var item = pageItems[i];
      var actionHtml = '';
      if (item.type === 'like') {
        actionHtml = ' le dio like a';
      } else if (item.type === 'point') {
        actionHtml = ' te dio <strong>' + esc(item.detail) + '</strong> en';
      } else {
        actionHtml = ' coment\u00f3 en';
      }
      var snippetHtml = '';
      if (item.type === 'comment') {
        snippetHtml = '<div class="notif-snippet">' + esc(item.detail) + '</div>';
      }
      itemsHtml += '<div class="notif-item clickable" data-post-id="' + esc(item.postId) + '">' +
        '<span class="ico">' + item.ico + '</span>' +
        '<span class="txt">' +
          '<a href="#" class="notif-author-link" data-profile-open="' + esc(item.by) + '" style="font-size:11px;font-weight:700;text-decoration:none;color:inherit;">' + esc(shortAddr(item.by)) + '</a>' +
          '<div style="font-size:9px;font-weight:500;opacity:.4;line-height:1;margin-bottom:2px;">ver perfil</div>' +
          '<span style="font-weight:400;">' + actionHtml + '</span>' +
          ' <em style="font-weight:600;">' + esc(item.postTitle || 'tu post') + '</em>' +
          snippetHtml +
          '<span class="notif-ts">' + fmtTs(item.ts) + '</span>' +
        '</span>' +
      '</div>';
    }
  } else {
    itemsHtml = '<div class="small muted">No hay interacciones recientes.</div>';
  }

  body.innerHTML =
    '<div class="notif-totals" style="display:flex;gap:16px;padding:8px 0;border-bottom:1px solid var(--ui-border);margin-bottom:8px;">' +
      '<span style="font-size:12px;">&#9829;&#65039; ' + totalLikes + '</span>' +
      '<span style="font-size:12px;">&#11088; ' + totalPoints + '</span>' +
      '<span style="font-size:12px;">&#128172; ' + totalComments + '</span>' +
    '</div>' +
    '<div class="notif-timeline">' + itemsHtml + '</div>';

  updatePagination(totalPages);

  var clickItems = body.querySelectorAll('[data-post-id]');
  for (var j = 0; j < clickItems.length; j++) {
    clickItems[j].addEventListener('click', function(e) {
      if (e.target.closest('.notif-author-link')) return;
      var pid = this.getAttribute('data-post-id');
      if (pid) {
        closeModal('notifModal');
        if (window.openPostModal) {
          setTimeout(function() { window.openPostModal(pid); }, 100);
        }
      }
    });
  }

  // Links a perfil dentro de las notificaciones
  body.querySelectorAll('.notif-author-link').forEach(function(el) {
    el.addEventListener('click', function(e) {
      e.preventDefault();
      e.stopPropagation();
      var addr = this.getAttribute('data-profile-open');
      if (addr) {
        closeModal('notifModal');
        setTimeout(function() {
          if (window.openProfileModal) { window.openProfileModal(addr); }
        }, 100);
      }
    });
  });
}

function updatePagination(totalPages) {
  var footer = document.getElementById('notifFooter');
  var prevBtn = document.getElementById('notifPrev');
  var nextBtn = document.getElementById('notifNext');
  var pageInfo = document.getElementById('notifPageInfo');
  if (!footer || !prevBtn || !nextBtn || !pageInfo) return;

  if (__TIMELINE__.length <= PER_PAGE) {
    footer.style.display = 'none';
    return;
  }
  footer.style.display = 'block';
  prevBtn.disabled = (__PAGE__ <= 0);
  nextBtn.disabled = (__PAGE__ >= totalPages - 1);
  pageInfo.textContent = 'P\u00e1gina ' + (__PAGE__ + 1) + ' de ' + totalPages;

  var newPrev = prevBtn.cloneNode(true);
  var newNext = nextBtn.cloneNode(true);
  prevBtn.parentNode.replaceChild(newPrev, prevBtn);
  nextBtn.parentNode.replaceChild(newNext, nextBtn);

  newPrev.addEventListener('click', function() {
    if (__PAGE__ > 0) { __PAGE__--; renderNotifList({ stats: __ME_STATS__ }); }
  });
  newNext.addEventListener('click', function() {
    if (__PAGE__ < totalPages - 1) { __PAGE__++; renderNotifList({ stats: __ME_STATS__ }); }
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
