// shared/js/moderation.js
// Moderación modal (solo mods/admins)
import { $, esc } from './core.js';
import { getJWT, API_BASE } from './api.js';
import { getDid } from './wallet.js';

const MOD_ONLY_ALLOW = new Set([
  "0x6a202f991c4c1df079449be9847b1dac3f51854f",
]);

export function isModOrAdminNow() {
  const a = (getDid() || "").toLowerCase();
  return MOD_ONLY_ALLOW.has(a);
}

export function buildModModal() {
  const el = document.createElement("div");
  el.className = "modal";
  el.id = "modModal";
  el.setAttribute("aria-hidden", "true");
  el.innerHTML = `
    <div class="modal-backdrop" id="modBackdrop"></div>
    <div class="modal-card mod-card">
      <div class="modal-headbar">
        <strong>Moderación</strong>
        <button class="icon-btn" id="modClose" type="button" aria-label="Cerrar">✕</button>
      </div>
      <div class="mod-body" id="modBody">
        <div class="small muted">Cargando…</div>
      </div>
    </div>`;
  return el;
}

export async function openModerationModal() {
  const { closeModal, openModal } = await import('./notifications.js');
  const modBody = document.getElementById("modBody");
  if (!modBody) return;

  closeModal("notifModal");

  if (!isModOrAdminNow()) {
    modBody.innerHTML = `<div class="small muted">No tienes permisos de moderación.</div>`;
    openModal("modModal");
    return;
  }

  const token = getJWT();
  if (!token) {
    modBody.innerHTML = `<div class="small muted">Necesitas SIWE para moderar.</div>`;
    openModal("modModal");
    return;
  }

  try {
    const r = await fetch(`${API_BASE}/api/mod/reports?status=pending`, {
      headers: { Authorization: `Bearer ${token}` }, cache: "no-store"
    });
    if (!r.ok) { modBody.innerHTML = `<div class="small muted">Sin endpoint aún (SOON). Status: ${r.status}</div>`; openModal("modModal"); return; }
    const ct = r.headers.get("content-type") || "";
    if (!ct.includes("application/json")) { modBody.innerHTML = `<div class="small muted">Respuesta no JSON (SOON).</div>`; openModal("modModal"); return; }
    const j = await r.json().catch(() => ({}));
    const items = Array.isArray(j?.reports) ? j.reports : [];

    if (!items.length) {
      modBody.innerHTML = `<div class="small muted">No hay reportes pendientes ✅</div>`;
      openModal("modModal");
      return;
    }

    modBody.innerHTML = `<div class="mod-list">${items.map(rep =>
      `<div class="mod-item"><div class="t">${esc(rep.targetType || 'item')} #${esc(rep.targetId || '')}</div><div class="m small muted">${esc(rep.reason || 'Sin motivo')}</div><div class="m small muted">by: ${esc(rep.reportedBy || '—')}</div></div>`
    ).join('')}</div><div class="small muted" style="margin-top:10px;">Acciones — siguiente fase.</div>`;
    openModal("modModal");
  } catch {
    modBody.innerHTML = `<div class="small muted">Error cargando reportes (SOON).</div>`;
    openModal("modModal");
  }
}
