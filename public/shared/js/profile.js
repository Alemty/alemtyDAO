// shared/js/profile.js
// Modal de perfil completo: syncProfile, render tabs, niveles, barras, slots

import { $, esc, shortAddr } from './core.js';
import { getDid } from './wallet.js';
import { fetchMeStats, getJWT } from './api.js';
import { API_BASE } from './api.js';

// Niveles por Dharma
const LEVELS = [
  { name: "Novato", need: 0 },
  { name: "Iniciado", need: 10 },
  { name: "Plata", need: 25 },
  { name: "Oro", need: 50 },
  { name: "Diamante", need: 100 },
  { name: "Avanzado", need: 200 },
  { name: "Refinado", need: 400 },
  { name: "Unico", need: 800 },
  { name: "Élite", need: 1600 },
  { name: "Superior", need: 3200 },
  { name: "Amasterdamo", need: 6400 },
];

function getLevelByDharma(d) {
  let current = LEVELS[0];
  let next = LEVELS[1] || LEVELS[0];
  for (let i = 0; i < LEVELS.length; i++) {
    if (d >= LEVELS[i].need) { current = LEVELS[i]; next = LEVELS[i + 1] || LEVELS[i]; }
    else break;
  }
  return { current, next };
}

function fmtInt(n) { const x = Number(n || 0); return Number.isFinite(x) ? String(x) : "0"; }
function nowMs() { return Date.now(); }

function getSessionStartMs(addr) {
  if (!addr) return 0;
  const key = `alemty.session.startedAt.${addr.toLowerCase()}`;
  const raw = localStorage.getItem(key);
  const n = Number(raw || 0);
  if (Number.isFinite(n) && n > 0) return n;
  const t = nowMs();
  localStorage.setItem(key, String(t));
  return t;
}

/* =========================================================
   DM TAB — Chat directo tipo MSN
========================================================= */
let dmState = { conversations: [], peer: null, messages: [], interval: null };

async function renderDmTab(modal) {
  const c = modal.querySelector("#pfContent");
  if (!c) return;
  const addr = getDid();

  if (!addr) {
    c.innerHTML = `<div class="pf-box"><div class="h2">DM</div><p class="muted">Conecta tu wallet para chatear.</p></div>`;
    return;
  }

  // Limpiar interval anterior
  if (dmState.interval) { clearInterval(dmState.interval); dmState.interval = null; }

  // Detectar si estamos viendo perfil ajeno (visitante → dueño)
  const viewingAddr = localStorage.getItem('alemty.profile.viewing') || '';
  const viewingAddrTarget = localStorage.getItem('alemty.profile.viewingAddr') || '';
  const isViewingOther = viewingAddr && viewingAddr.toLowerCase() !== addr.toLowerCase();
  const isOtherProfile = viewingAddrTarget && viewingAddrTarget.toLowerCase() !== addr.toLowerCase();

  // Si abrimos perfil de otro usuario desde su dirección: chat directo
  if (isViewingOther) {
    // Modo visitante: abre DM directo con el dueño del perfil
    const peer = viewingAddr.toLowerCase();
    c.innerHTML = `
      <div class="pf-box dm-container">
        <div class="dm-layout" style="position:relative;">
          <div class="dm-main" id="dmMain" style="flex:1;">
            ${renderChatHTML(peer, peer.slice(0,6)+'…'+peer.slice(-4), [], 'Regresar')}
          </div>
        </div>
      </div>
    `;

    dmState.peer = peer;
    await loadMessages(peer);

    // Reemplazar el handler de back para modo visitante
    const backBtn = c.querySelector('#dmBack');
    if (backBtn) {
      const oldBack = backBtn.onclick;
      backBtn.onclick = null;
      backBtn.addEventListener('click', () => {
        localStorage.removeItem('alemty.profile.viewing');
        closeModal('profileModal');
        window.openProfileModal?.(addr);
      });
    }

    // Polling
    dmState.interval = setInterval(() => {
      if (dmState.peer) loadMessages(dmState.peer, true);
    }, 5000);
    return;
  }

  // Modo normal: sidebar de conversaciones
  c.innerHTML = `
    <div class="pf-box dm-container">
      <div class="dm-layout">
        <div class="dm-sidebar" id="dmSidebar">
          <div class="dm-sidebar-head">
            <div class="h2" style="font-size:15px;">Chats</div>
            <input class="dm-search" id="dmSearch" placeholder="Buscar dirección..." />
          </div>
          <div class="dm-conversations" id="dmConversations">
            <div class="dm-loading">Cargando conversaciones...</div>
          </div>
          <div class="dm-new-btn" id="dmNewBtn">✏️ Nueva conversación</div>
        </div>
        <div class="dm-main" id="dmMain">
          <div class="dm-placeholder">
            <div style="font-size:32px;margin-bottom:8px;">💬</div>
            <div>Selecciona un chat para empezar</div>
          </div>
        </div>
      </div>
    </div>
  `;

  // Cargar conversaciones
  await loadConversations();

  // Event listeners
  c.querySelector('#dmSearch')?.addEventListener('input', (e) => filterConversations(e.target.value));
  c.querySelector('#dmNewBtn')?.addEventListener('click', () => showNewConversation(c));

  // Si abrimos perfil propio desde clic en dirección de otro usuario,
  // auto-colocar la dirección en el formulario de nueva conversación
  if (isOtherProfile && viewingAddrTarget) {
    setTimeout(() => showNewConversation(c, viewingAddrTarget), 100);
  }

  // Polling cada 5 segundos
  dmState.interval = setInterval(() => {
    if (dmState.peer) loadMessages(dmState.peer, true);
    loadConversations(true);
  }, 5000);
}

async function loadConversations(silent) {
  const c = document.querySelector('#pfContent');
  if (!c) return;
  const sidebar = c.querySelector('#dmConversations');
  if (!sidebar) return;

  try {
    const token = getJWT();
    if (!token) return;
    const res = await fetch(API_BASE + '/api/dm/conversations', { headers: { 'Authorization': `Bearer ${token}` } });
    if (!res.ok) return;
    const data = await res.json();
    if (!data.ok) return;
    dmState.conversations = data.conversations || [];

    sidebar.innerHTML = dmState.conversations.map(conv => `
      <div class="dm-conv ${dmState.peer === conv.peer ? 'active' : ''}" data-peer="${esc(conv.peer)}">
        <div class="dm-conv-avatar">${conv.displayName[0]?.toUpperCase() || '?'}</div>
        <div class="dm-conv-info">
          <div class="dm-conv-name">${esc(conv.displayName)}</div>
          <div class="dm-conv-preview">${esc(conv.lastMsg?.slice(0, 40) || '')}</div>
        </div>
        ${conv.unread > 0 ? `<div class="dm-badge">${conv.unread}</div>` : ''}
      </div>
    `).join('') || '<div class="dm-loading">Sin conversaciones aún</div>';

    sidebar.querySelectorAll('.dm-conv').forEach(el => {
      el.addEventListener('click', () => loadMessages(el.dataset.peer));
    });
  } catch {
    if (!silent) console.warn('DM: error cargando conversaciones');
  }
}

// Helper para renderizar el contenido de un chat (historial + input)
function renderChatHTML(peer, displayName, messages, backLabel) {
  const msgHtml = messages.length
    ? messages.map(m => `
        <div class="dm-msg ${m.sender === getDid() ? 'out' : 'in'}">
          <div class="dm-bubble">${esc(m.body)}</div>
          <div class="dm-time">${formatMsgTime(m.created_at)}</div>
        </div>
      `).join('')
    : '<div class="dm-empty">Sin mensajes. Envía el primero!</div>';

  const addrShort = peer.slice(0, 6) + '…' + peer.slice(-4);

  return `
    <div class="dm-chat-layout">
      <div class="dm-chat-header">
        <button class="dm-back" id="dmBack" style="display:inline;">← ${esc(backLabel || '')}</button>
        <div class="dm-header-info">
          <div class="dm-header-name">${esc(displayName)}</div>
          <div class="dm-header-addr">${esc(peer)}</div>
        </div>
      </div>
      <div class="dm-messages" id="dmMessages">
        ${msgHtml}
      </div>
      <div class="dm-chat-input">
        <textarea class="dm-input" id="dmInput" rows="1" placeholder="Escribe un mensaje..." maxlength="2000"></textarea>
        <button class="dm-send" id="dmSendBtn">Enviar</button>
      </div>
    </div>
  `;
}

function setupChatEvents(peer, onBack) {
  const c = document.querySelector('#pfContent');
  if (!c) return;

  // Auto scroll al último
  const msgContainer = c.querySelector('#dmMessages');
  if (msgContainer) msgContainer.scrollTop = msgContainer.scrollHeight;

  // Input autoresize
  const input = c.querySelector('#dmInput');
  input?.addEventListener('input', () => {
    input.style.height = 'auto';
    input.style.height = Math.min(input.scrollHeight, 120) + 'px';
  });
  input?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(peer); }
  });

  // Send
  c.querySelector('#dmSendBtn')?.addEventListener('click', () => sendMessage(peer));

  // Back
  c.querySelector('#dmBack')?.addEventListener('click', onBack || (() => {
    dmState.peer = null;
    const c2 = document.querySelector('#pfContent');
    if (c2) {
      const sidebar = c2.querySelector('#dmSidebar');
      const main2 = c2.querySelector('#dmMain');
      if (sidebar) sidebar.style.display = '';
      if (main2) main2.innerHTML = `<div class="dm-placeholder"><div style="font-size:32px;margin-bottom:8px;">💬</div><div>Selecciona un chat para empezar</div></div>`;
      loadConversations();
    }
  }));
}

async function loadMessages(peer, silent) {
  const c = document.querySelector('#pfContent');
  if (!c) return;
  const main = c.querySelector('#dmMain');
  if (!main) return;

  dmState.peer = peer;

  try {
    const token = getJWT();
    if (!token) return;
    const res = await fetch(API_BASE + '/api/dm/' + peer, { headers: { 'Authorization': `Bearer ${token}` } });
    if (!res.ok) return;
    const data = await res.json();
    if (!data.ok) return;
    dmState.messages = data.messages || [];

    // Obtener display name del peer
    const conv = dmState.conversations.find(c => c.peer === peer);
    const displayName = conv?.displayName || peer.slice(0, 6) + '…' + peer.slice(-4);

    main.innerHTML = renderChatHTML(peer, displayName, data.messages, '');
    setupChatEvents(peer);

    // Actualizar sidebar (quitar badge)
    loadConversations(true);

  } catch {
    if (!silent) console.warn('DM: error cargando mensajes');
  }
}

async function sendMessage(peer) {
  const c = document.querySelector('#pfContent');
  if (!c) return;
  const input = c.querySelector('#dmInput');
  if (!input) return;
  const body = input.value.trim();
  if (!body) return;

  input.value = '';
  input.style.height = 'auto';

  try {
    const token = getJWT();
    if (!token) return;
    const res = await fetch(API_BASE + '/api/dm/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
      body: JSON.stringify({ to: peer, body })
    });
    if (!res.ok) return;
    // Recargar mensajes
    loadMessages(peer, true);
  } catch {
    console.warn('DM: error enviando mensaje');
  }
}

function showNewConversation(c, prefilledAddress) {
  const main = c.querySelector('#dmMain');
  if (!main) return;

  // Ocultar sidebar en mobile
  const sidebar = c.querySelector('#dmSidebar');
  if (sidebar) sidebar.style.display = 'none';

  const backToSidebar = () => {
    if (sidebar) sidebar.style.display = '';
    dmState.peer = null;
    main.innerHTML = `<div class="dm-placeholder"><div style="font-size:32px;margin-bottom:8px;">💬</div><div>Selecciona un chat para empezar</div></div>`;
    loadConversations();
  };

  const hasPrefilled = !!prefilledAddress;
  const peer = hasPrefilled ? prefilledAddress : '';

  // Usar el mismo renderChatHTML pero con mensajes vacíos y placeholder en input
  main.innerHTML = renderChatHTML(
    peer || 'nuevo',
    hasPrefilled ? 'Enviar mensaje' : 'Nueva conversación',
    [],
    'Regresar'
  );

  // Reemplazar el input area por el formulario de nueva conversación
  const chatInput = main.querySelector('.dm-chat-input');
  if (hasPrefilled) {
    // Modo con dirección pre-colocada: input normal + status
    chatInput.innerHTML = `
      <textarea class="dm-input" id="dmNewBody" rows="1" placeholder="Escribe tu mensaje..." maxlength="2000" style="flex:1;"></textarea>
      <button class="dm-send" id="dmNewSendBtn">Enviar</button>
      <button class="dm-cancel" id="dmNewCancelBtn" style="font-size:11px;padding:6px 10px;">Cancelar</button>
      <div id="dmNewStatus" class="small muted" style="position:absolute;bottom:calc(100% + 4px);left:8px;font-size:10px;"></div>
    `;
    chatInput.style.position = 'relative';
  } else {
    // Modo sin dirección: mostrar campo "Para:" + textarea + botones
    chatInput.innerHTML = `
      <div style="display:flex;flex-direction:column;gap:4px;width:100%;">
        <div style="display:flex;align-items:center;gap:4px;">
          <span class="small muted" style="font-size:10px;white-space:nowrap;opacity:0.5;">Para:</span>
          <input class="dm-new-addr" id="dmNewAddress" placeholder="0x..." style="flex:1;max-width:none;" />
        </div>
        <div style="display:flex;align-items:flex-end;gap:6px;">
          <textarea class="dm-input" id="dmNewBody" rows="1" placeholder="Escribe tu primer mensaje..." maxlength="2000" style="flex:1;"></textarea>
          <button class="dm-send" id="dmNewSendBtn">Enviar</button>
          <button class="dm-cancel" id="dmNewCancelBtn" style="font-size:11px;padding:6px 10px;">Cancelar</button>
        </div>
      </div>
      <div id="dmNewStatus" class="small muted" style="margin-top:4px;font-size:10px;"></div>
    `;
  }

  // Eventos del textarea
  const bodyInput = c.querySelector('#dmNewBody');
  bodyInput?.addEventListener('input', () => {
    bodyInput.style.height = 'auto';
    bodyInput.style.height = Math.min(bodyInput.scrollHeight, 100) + 'px';
  });
  bodyInput?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendNewMessage(hasPrefilled ? prefilledAddress : null); }
  });

  // Auto-foco
  if (hasPrefilled) { bodyInput?.focus(); }
  else { c.querySelector('#dmNewAddress')?.focus(); }

  c.querySelector('#dmBack')?.addEventListener('click', backToSidebar);
  c.querySelector('#dmNewCancelBtn')?.addEventListener('click', backToSidebar);
  c.querySelector('#dmNewSendBtn')?.addEventListener('click', () => sendNewMessage(hasPrefilled ? prefilledAddress : null));
}

function sendNewMessage(prefilledAddress) {
  const c = document.querySelector('#pfContent');
  if (!c) return;
  const bodyInput = c.querySelector('#dmNewBody');
  const body = bodyInput?.value?.trim();
  if (!body) { showNewStatus('❌ Escribe un mensaje'); return; }

  const addr = prefilledAddress || c.querySelector('#dmNewAddress')?.value?.trim();
  if (!addr) { showNewStatus('❌ Dirección requerida'); return; }
  if (!addr.startsWith('0x') || addr.length !== 42) { showNewStatus('❌ Dirección inválida'); return; }

  showNewStatus('Enviando...');
  fetch(API_BASE + '/api/dm/send', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${getJWT()}` },
    body: JSON.stringify({ to: addr, body })
  })
  .then(r => r.json())
  .then(data => {
    if (data.ok) {
      const sidebar = c.querySelector('#dmSidebar');
      if (sidebar) sidebar.style.display = '';
      loadMessages(addr.toLowerCase());
    } else {
      showNewStatus('❌ ' + (data.error || 'Error al enviar'));
    }
  })
  .catch(() => showNewStatus('❌ Error de conexión'));
}

function showNewStatus(msg) {
  const el = document.querySelector('#dmNewStatus');
  if (el) el.textContent = msg;
}

function filterConversations(q) {
  const c = document.querySelector('#pfContent');
  if (!c) return;
  const items = c.querySelectorAll('.dm-conv');
  q = (q || '').toLowerCase();
  items.forEach(el => {
    const name = el.querySelector('.dm-conv-name')?.textContent?.toLowerCase() || '';
    const peer = el.dataset.peer?.toLowerCase() || '';
    el.style.display = (!q || name.includes(q) || peer.includes(q)) ? '' : 'none';
  });
}

function formatMsgTime(iso) {
  if (!iso) return '';
  try {
    const d = new Date(iso + (iso.includes('T') ? '' : 'T00:00:00'));
    const now = new Date();
    const diff = now - d;
    if (diff < 60000) return 'ahora';
    if (diff < 3600000) return Math.floor(diff / 60000) + 'm';
    if (diff < 86400000) return Math.floor(diff / 3600000) + 'h';
    return d.toLocaleDateString('es', { day: 'numeric', month: 'short' });
  } catch { return ''; }
}

function formatDuration(ms) {
  const s = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m ${sec}s`;
  return `${sec}s`;
}

function getEquipped(addr, slot) {
  if (!addr) return "—";
  const key = `alemty.equip.${addr.toLowerCase()}.${slot}`;
  return localStorage.getItem(key) || "—";
}

function getHighestNft(addr) {
  if (!addr) return "—";
  const key = `alemty.nft.highest.${addr.toLowerCase()}`;
  return localStorage.getItem(key) || "—";
}

let __ME_STATS__ = null;

// ==================== BUILD PROFILE MODAL HTML ====================
export function buildProfileModal() {
  const el = document.createElement("div");
  el.className = "modal";
  el.id = "profileModal";
  el.setAttribute("aria-hidden", "true");
  el.innerHTML = `
    <div class="modal-backdrop" id="profileBackdrop"></div>
    <div class="modal-card profile-card">
      <div class="modal-headbar">
        <strong>Perfil</strong>
        <button class="icon-btn" id="profileClose" type="button" aria-label="Cerrar">✕</button>
      </div>
      <div class="profile-grid">
        <aside class="profile-left">
          <div class="profile-avatar empty" id="pfAvatarBox">
            <img id="pfAvatar" alt="Avatar"/>
          </div>
          <div class="profile-level">
            <div class="lvl" id="pfLevel">Nivel —</div>
            <div class="rank" id="pfTitle">—</div>
          </div>
          <div class="profile-addr" id="pfAddr">—</div>
          <div class="profile-bars-left">
            <div class="barbox">
              <div class="bar-top"><strong>Dharma</strong><span class="small muted" id="pfXpText">0</span></div>
              <div class="bar-track"><div class="bar-fill dharma" id="pfXpBar" style="width:0%"></div></div>
            </div>
            <div class="barbox">
              <div class="bar-top"><strong>Karma</strong><span class="small muted" id="pfKarmaText">0</span></div>
              <div class="bar-track"><div class="bar-fill karma" id="pfKarmaBar" style="width:0%"></div></div>
            </div>
          </div>
          <div class="profile-slots">
            <div class="slot" id="slotNivelBox">
              <div class="slot-k">Item (Nivel)</div>
              <div class="slot-v" id="slotNivel">—</div>
            </div>
            <div class="slot"><div class="slot-k">Rol</div><div class="slot-v" id="slotRol">—</div></div>
            <div class="slot"><div class="slot-k">veNFT</div><div class="slot-v" id="slotVeNFT">—</div></div>
            <div class="slot"><div class="slot-k">Assets</div><div class="slot-v" id="slotAssets">—</div></div>
            <div class="slot"><div class="slot-k">Agent</div><div class="slot-v" id="slotAgent">—</div></div>
            <div class="slot"><div class="slot-k">Lands</div><div class="slot-v" id="slotLands">—</div></div>
          </div>
        </aside>
        <section class="profile-right">
          <div class="profile-tabs" id="pfTabs">
            <button class="tab-btn active" data-tab="estado">ESTADO</button>
            <button class="tab-btn" data-tab="actividad">User</button>
            <button class="tab-btn" data-tab="dm">DM</button>
            <button class="tab-btn" data-tab="farm">🎣 FARM</button>
            <button class="tab-btn" data-tab="dex">DEX</button>
            <button class="tab-btn" data-tab="tienda">🛒</button>
          </div>
          <div class="profile-fixed">
            <div class="pf-balances" id="pfBalances">
              <div class="token token-dharma"><span class="lbl">Dharma</span><span class="val" id="pfDharma">—</span></div>
              <div class="token token-aura" title="Aura generado por interacciones (likes/points). Reclama el saldo pendiente en la pestaña DEX para mintear on-chain."><span class="lbl">Aura</span><span class="val" id="pfAura">—</span></div>
              <div class="token token-karma" id="pfKarmaToken"><span class="lbl">Karma</span><span class="val" id="pfKarmaVal">—</span></div>
              <div class="token token-alem"><span class="lbl">$ALEM</span><span class="val" id="pfAlem">—</span></div>
              <div class="token token-vealem"><span class="lbl">veALEM</span><span class="val" id="pfVeAlem">—</span></div>
              <div class="small muted hint vealem" id="pfAuraHint"></div>
            </div>
          </div>
          <div class="profile-content" id="pfContent"></div>
        </section>
      </div>
    </div>`;
  return el;
}

export async function syncProfile() {
  // Soporte para ver perfil de otro usuario (click en dirección)
  const viewingAddr = localStorage.getItem('alemty.profile.viewing') || '';
  const addr = viewingAddr || getDid();

  const modal = document.getElementById("profileModal");
  if (!modal) return;

  const addrEl = modal.querySelector("#pfAddr");
  const lvlEl = modal.querySelector("#pfLevel");
  const titleEl = modal.querySelector("#pfTitle");
  const avatarBox = modal.querySelector("#pfAvatarBox");
  const avatarImg = modal.querySelector("#pfAvatar");

  addrEl.textContent = addr ? `${addr.toLowerCase()} · alemty.eth` : "Conecta tu wallet (☰)";

  const url = addr ? (localStorage.getItem(`level.nft.avatar.${addr.toLowerCase()}`) || "") : "";
  if (!url.trim()) {
    avatarBox.classList.add("empty");
    avatarImg.removeAttribute("src");
  } else {
    avatarBox.classList.remove("empty");
    avatarImg.src = url;
    avatarImg.onerror = () => { avatarBox.classList.add("empty"); avatarImg.removeAttribute("src"); };
  }

  __ME_STATS__ = addr ? await fetchMeStats() : null;

  const dharma = __ME_STATS__?.tokenomics?.dharma ?? 0;
  const aura = __ME_STATS__?.tokenomics?.aura ?? 0;
  const auraReclamable = __ME_STATS__?.tokenomics?.auraReclamable ?? 0;
  const auraBalance = __ME_STATS__?.tokenomics?.auraBalance ?? '0';
  const pointsReceived = __ME_STATS__?.received?.pointsReceived ?? 0;
  const karmaValue = 0;

  const { current, next } = getLevelByDharma(dharma);
  lvlEl.textContent = addr ? `${current.name} (${dharma} Dharma)` : "Nivel —";
  titleEl.textContent = addr ? current.name : "—";

  const progressDen = Math.max(1, next.need - current.need);
  const progressNum = Math.min(progressDen, Math.max(0, dharma - current.need));
  const pct = next.need === current.need ? 100 : Math.round((progressNum / progressDen) * 100);

  modal.querySelector("#pfXpText").textContent = addr
    ? `${fmtInt(dharma)} Dharma · +${fmtInt(pointsReceived)} points recibidos` : "0";
  modal.querySelector("#pfXpBar").style.width = addr ? `${pct}%` : "0%";
  modal.querySelector("#pfKarmaText").textContent = String(karmaValue);
  modal.querySelector("#pfKarmaBar").style.width = karmaValue > 0 ? "30%" : "0%";

  modal.querySelector("#pfDharma").textContent = addr ? String(dharma) : "—";
  const auraLabel = addr
    ? (auraReclamable > 0 ? `${String(aura)} (${String(auraReclamable)} por reclamar)` : String(aura))
    : "—";
  modal.querySelector("#pfAura").textContent = auraLabel;
  const auraHint = modal.querySelector("#pfAuraHint");
  if (auraHint) {
    if (addr && auraReclamable > 0) {
      auraHint.textContent = `${String(auraReclamable)} AURA por reclamar · Ve a la pestaña DEX para mintear on-chain`;
      auraHint.classList.add('pf-aura-reclaimable');
    } else if (addr && auraBalance !== '0') {
      auraHint.textContent = `${auraBalance} AURA on-chain disponibles`;
      auraHint.classList.remove('pf-aura-reclaimable');
    } else {
      auraHint.textContent = '';
      auraHint.classList.remove('pf-aura-reclaimable');
    }
  }
  modal.querySelector("#pfAlem").textContent = addr ? "0" : "—";
  modal.querySelector("#pfVeAlem").textContent = addr ? "0" : "—";

  const karmaValEl = modal.querySelector("#pfKarmaVal");
  const karmaToken = modal.querySelector("#pfKarmaToken");
  if (!addr) { karmaValEl.textContent = "—"; karmaToken.classList.remove("negative"); }
  else { karmaValEl.textContent = String(karmaValue); karmaToken.classList.toggle("negative", karmaValue < 0); }

  const highest = getHighestNft(addr);
  modal.querySelector("#slotNivel").textContent = highest !== "—" ? highest : "—";
  modal.querySelector("#slotRol").textContent = getEquipped(addr, "role");
  modal.querySelector("#slotVeNFT").textContent = getEquipped(addr, "venft");
  modal.querySelector("#slotAssets").textContent = getEquipped(addr, "assets");
  modal.querySelector("#slotAgent").textContent = getEquipped(addr, "agent");
  modal.querySelector("#slotLands").textContent = getEquipped(addr, "lands");

  const activeBtn = modal.querySelector("#pfTabs .tab-btn.active");
  const activeTab = activeBtn?.getAttribute("data-tab") || "estado";
  renderTab(activeTab, modal);
}

function renderTab(tab, modal) {
  const c = modal.querySelector("#pfContent");
  if (!c) return;
  if (tab === "estado") return renderEstadoTab(modal);
  if (tab === "actividad") return renderActividadTab(modal);
  if (tab === "dm") { renderDmTab(modal); return; }
  if (tab === "dex") {
    return renderDexTab(modal);
  }
  if (tab === "farm") { renderFarmTab(modal); return; }
  if (tab === "tienda") { renderTiendaTab(modal); return; }
}

function renderEstadoTab(modal) {
  const c = modal.querySelector("#pfContent");
  if (!c) return;
  const addr = getDid();
  const s = __ME_STATS__;

  if (!addr) {
    c.innerHTML = `<div class="pf-box"><div class="h2">Estado</div><p class="muted">Panel MMORPG. Conecta tu wallet desde ☰ para ver tu progreso.</p></div>`;
    return;
  }

  const startedAt = getSessionStartMs(addr);
  const connectedFor = formatDuration(nowMs() - startedAt);

  if (!s) {
    c.innerHTML = `<div class="pf-box"><div class="h2">Estado</div><p class="muted">Panel MMORPG.</p><div class="post-tags" style="margin-top:10px"><span class="pill">⏱️ Conectado: <span class="count">${connectedFor}</span></span><span class="pill">🧙‍♂️ DID: <span class="count">${addr.toLowerCase()}</span></span></div></div>`;
    return;
  }

  const pointsReceived = s?.received?.pointsReceived ?? 0;
  const likesReceived = s?.received?.likesReceived ?? 0;
  const commentsReceived = s?.received?.commentsReceived ?? 0;
  const dharma = s?.tokenomics?.dharma ?? 0;
  const aura = s?.tokenomics?.aura ?? 0;

  c.innerHTML = `<div class="pf-box"><div class="h2">Estado</div><div class="pf-stats-grid">${[
    `<div class="pf-stat-item"><span class="pf-stat-label">⏱️ Conectado</span><span class="pf-stat-value">${connectedFor}</span></div>`,
    `<div class="pf-stat-item"><span class="pf-stat-label">🧙‍♂️ DID</span><span class="pf-stat-value" style="font-size:11px;font-family:var(--mono);word-break:break-word">${addr.toLowerCase()}</span></div>`
  ].join('')}</div><div class="pf-stats-grid" style="margin-top:8px">${[
    `<div class="pf-stat-item"><span class="pf-stat-label">⭐ Points recibidos</span><span class="pf-stat-value">${fmtInt(pointsReceived)}</span></div>`,
    `<div class="pf-stat-item"><span class="pf-stat-label">♥️ Likes recibidos</span><span class="pf-stat-value">${fmtInt(likesReceived)}</span></div>`,
    `<div class="pf-stat-item"><span class="pf-stat-label">💬 Comentarios recibidos</span><span class="pf-stat-value">${fmtInt(commentsReceived)}</span></div>`
  ].join('')}</div><div class="pf-stats-grid" style="margin-top:8px"><div class="pf-stat-item dharma"><span class="pf-stat-label">🟢 Dharma</span><span class="pf-stat-value">${fmtInt(dharma)}</span></div><div class="pf-stat-item aura"><span class="pf-stat-label">🔵 Aura</span><span class="pf-stat-value">${fmtInt(aura)}</span></div></div></div>`;
}

function renderActividadTab(modal) {
  const c = modal.querySelector("#pfContent");
  if (!c) return;
  const addr = getDid();
  const s = __ME_STATS__;

  if (!addr) {
    c.innerHTML = `<div class="pf-box"><div class="h2">Actividad</div><p class="muted">Conecta tu wallet para ver tu última actividad.</p></div>`;
    return;
  }
  if (!s) {
    c.innerHTML = `<div class="pf-box"><div class="h2">Actividad</div><p class="muted">SOON</p></div>`;
    return;
  }

  const posts = s?.activity?.posts ?? 0;
  const comments = s?.activity?.comments ?? 0;
  const likesGiven = s?.given?.likesGiven ?? 0;
  const pointsGiven = s?.given?.pointsGiven ?? 0;

  // Render inicial con datos de stats
  c.innerHTML = `<div class="pf-box"><div class="h2">Actividad</div><div class="pf-stats-grid">${[
    `<div class="pf-stat-item"><span class="pf-stat-label">🧵 Posts</span><span class="pf-stat-value">${fmtInt(posts)}</span></div>`,
    `<div class="pf-stat-item"><span class="pf-stat-label">✍️ Comentarios</span><span class="pf-stat-value">${fmtInt(comments)}</span></div>`,
    `<div class="pf-stat-item"><span class="pf-stat-label">♥️ Likes dados</span><span class="pf-stat-value">${fmtInt(likesGiven)}</span></div>`,
    `<div class="pf-stat-item"><span class="pf-stat-label">⭐ Points dados</span><span class="pf-stat-value">${fmtInt(pointsGiven)}</span></div>`
  ].join('')}</div>
    <div class="pf-activity-last">
      <div class="pf-activity-section">
        <div class="pf-activity-label">Último post</div>
        <div id="pfLastPost" class="small muted">Cargando...</div>
      </div>
      <div class="pf-activity-section">
        <div class="pf-activity-label">Último comentario</div>
        <div id="pfLastComment" class="small muted">Cargando...</div>
      </div>
    </div>
  </div>`;

  // Cargar últimos posts y comentarios desde API
  const lastPostEl = c.querySelector('#pfLastPost');
  const lastCommentEl = c.querySelector('#pfLastComment');

  fetch(API_BASE + '/api/posts/me/notifications?limit=3', {
    headers: { 'Authorization': `Bearer ${getJWT()}` }
  })
  .then(r => r.json())
  .then(data => {
    if (!data.ok) return;

    if (lastPostEl) {
      const myPosts = data.myPosts || [];
      if (myPosts.length) {
        const p = myPosts[0];
        lastPostEl.innerHTML = `
          <div class="pf-activity-time">${esc(formatActDate(p.created_at))}</div>
          <div class="pf-activity-body"><a href="javascript:;" class="pf-activity-link" data-pf-post="${esc(p.id)}">${esc(p.title)}</a></div>
        `;
        lastPostEl.querySelector('[data-pf-post]')?.addEventListener('click', (e) => {
          e.preventDefault();
          openPostInline(e.target.dataset.pfPost);
        });
      } else {
        lastPostEl.innerHTML = `<span class="dim">Sin posts aún</span>`;
      }
    }

    if (lastCommentEl) {
      const myComments = data.myComments || [];
      if (myComments.length) {
        const c = myComments[0];
        const preview = c.body.length > 120 ? c.body.slice(0, 120) + '…' : c.body;
        lastCommentEl.innerHTML = `
          <div class="pf-activity-time">${esc(formatActDate(c.created_at))}</div>
          <div class="pf-activity-body"><a href="javascript:;" class="pf-activity-link" data-pf-post="${esc(c.postId)}">${esc(c.postTitle || 'post #' + c.postId)}</a></div>
          <div class="pf-activity-text">${esc(preview)}</div>
        `;
        lastCommentEl.querySelector('[data-pf-post]')?.addEventListener('click', (e) => {
          e.preventDefault();
          openPostInline(e.target.dataset.pfPost);
        });
      } else {
        lastCommentEl.innerHTML = `<span class="dim">Sin comentarios aún</span>`;
      }
    }
  })
  .catch(() => {
    if (lastPostEl) lastPostEl.innerHTML = `<span class="dim">No disponible</span>`;
    if (lastCommentEl) lastCommentEl.innerHTML = `<span class="dim">No disponible</span>`;
  });
}

function formatActDate(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  const now = new Date();
  const diff = now - d;
  if (diff < 60000) return 'Ahora';
  if (diff < 3600000) return Math.floor(diff / 60000) + 'm';
  if (diff < 86400000) return Math.floor(diff / 3600000) + 'h';
  if (diff < 604800000) return Math.floor(diff / 86400000) + 'd';
  return d.toLocaleDateString('es', { day: 'numeric', month: 'short' });
}

// Abre un post inline dentro del modal de perfil
async function openPostInline(postId) {
  const modal = document.getElementById('profileModal');
  const c = modal?.querySelector('#pfContent');
  if (!c) return;

  const token = getJWT();
  const noAuth = !token;

  // Cargar post desde la API
  c.innerHTML = `<div class="pf-box"><div class="h2">Cargando post…</div></div>`;

  try {
    const res = await fetch(API_BASE + '/api/posts/' + postId, {
      headers: token ? { 'Authorization': `Bearer ${token}` } : {}
    });
    const data = await res.json();
    if (!data || data.error) throw new Error(data.error || 'Post no encontrado');
    const p = data.post || data;

    const ts = p.created_at || p.ts || '';
    const timeLabel = ts ? formatActDate(ts) : '';
    const likesCount = Number(p.likes ?? p.likesCount ?? 0);
    const pointsCount = Number(p.points ?? p.pointsCount ?? 0);
    const commentsCount = Number(p.comments ?? p.commentsCount ?? 0);

    c.innerHTML = `
      <div class="pf-box">
        <div style="display:flex;align-items:flex-start;gap:10px;margin-bottom:8px;">
          <button class="btn" type="button" id="pfBackFromPost" style="flex-shrink:0;font-size:11px;">← Volver</button>
          <div style="flex:1;min-width:0;">
            <div class="h2" style="font-size:15px;">${esc(p.title)}</div>
            <div class="small muted">${esc(p.author?.slice(0,6)+'…'+p.author?.slice(-4) || 'desconocido')}${timeLabel ? ' · '+timeLabel : ''}</div>
          </div>
        </div>
        <div class="small" style="white-space:pre-wrap;margin-top:6px;">${esc(p.body || '')}</div>
        <div style="margin-top:12px;display:flex;gap:10px;flex-wrap:wrap;">
          <span class="pill like" data-pf-like="${esc(p.id)}">♥️ <span class="count">${likesCount}</span></span>
          <span class="pill points" data-pf-point="${esc(p.id)}">⭐ <span class="count">${pointsCount}</span></span>
          <span class="pill comment">💬 <span class="count">${commentsCount}</span></span>
        </div>
        ${noAuth ? '<div class="small muted" style="margin-top:8px;">Conecta tu wallet para like/point.</div>' : ''}
      </div>
    `;

    // Volver a actividad
    c.querySelector('#pfBackFromPost')?.addEventListener('click', () => {
      renderActividadTab(modal);
    });

    // Like
    c.querySelector('[data-pf-like]')?.addEventListener('click', async (e) => {
      e.preventDefault();
      if (!token) return;
      const el = e.currentTarget;
      const id = el.dataset.pfLike;
      const countEl = el.querySelector('.count');
      try {
        const r = await fetch(API_BASE + '/api/posts/' + id + '/react', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
          body: JSON.stringify({ type: 'like' })
        });
        const res = await r.json();
        if (res.ok && res.counts) {
          if (countEl) countEl.textContent = String(res.counts.likes);
        }
      } catch {}
    });

    // Point
    c.querySelector('[data-pf-point]')?.addEventListener('click', async (e) => {
      e.preventDefault();
      if (!token) return;
      const el = e.currentTarget;
      const id = el.dataset.pfPoint;
      const countEl = el.querySelector('.count');
      try {
        const r = await fetch(API_BASE + '/api/posts/' + id + '/react', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
          body: JSON.stringify({ type: 'point' })
        });
        const res = await r.json();
        if (res.ok && res.counts) {
          if (countEl) countEl.textContent = String(res.counts.points);
        }
      } catch {}
    });

  } catch (err) {
    c.innerHTML = `<div class="pf-box"><div class="h2">Error</div><p class="muted">No se pudo cargar el post.</p><button class="btn" type="button" id="pfBackErr">← Volver</button></div>`;
    c.querySelector('#pfBackErr')?.addEventListener('click', () => renderActividadTab(modal));
  }
}

/* ===============================
   DEX TAB — Rewards + Claim
=============================== */
function renderDexTab(modal) {
  const c = modal.querySelector("#pfContent");
  if (!c) return;
  const addr = getDid();
  const s = __ME_STATS__;
  const auraTotal = s?.tokenomics?.aura ?? 0;
  const auraReclamable = s?.tokenomics?.auraReclamable ?? 0;
  const auraBalance = s?.tokenomics?.auraBalance ?? '0';

  // Rewards simulados (TODO: conectar a datos reales on-chain cuando existan)
  const rewards = {
    aura: { label: '🔵 AURA por reclamar', value: String(auraReclamable), tooltip: 'AURA acumulado por interacciones (likes/points) pendiente de mintear on-chain' },
    alem: { label: '🟡 $ALEM', value: '0', tooltip: 'Rewards de pool LP AURA/ALEM' },
    bribes: { label: '💎 Bribes', value: '0', tooltip: 'Incentivos de voto en gauge' },
    fees: { label: '💧 Fees LP', value: '0', tooltip: 'Comisiones acumuladas por proveer liquidez' },
  };

  const totalRewards = Object.values(rewards).reduce((sum, r) => sum + Number(r.value), 0);

  c.innerHTML = `
    <div class="pf-box">
      <div class="h2">DEX · Recompensas</div>
      <p class="small muted">Tus recompensas acumuladas. Reclama todo en una sola transacción cuando quieras.</p>

      <div class="pf-rewards-summary">
        <div class="pf-stat-card">
          <div class="small muted">Total recompensas</div>
          <div class="h1" style="font-size:22px;margin:4px 0;">${totalRewards}</div>
        </div>
        <div class="pf-stat-card">
          <div class="small muted">AURA on-chain</div>
          <div class="h1" style="font-size:22px;margin:4px 0;">${auraBalance}</div>
        </div>
      </div>

      <div class="pf-rewards-list">
        ${Object.values(rewards).map(r => `
          <div class="pf-reward-row" title="${esc(r.tooltip)}">
            <span class="reward-label">${r.label}</span>
            <span class="reward-value">${r.value}</span>
          </div>
        `).join('')}
      </div>

      <button class="tab-btn" id="claimRewardsBtn" style="width:100%;margin-top:8px;padding:10px;font-weight:700;background:var(--accent,#00ffd5);color:#000;border:none;border-radius:8px;cursor:pointer;" ${totalRewards === 0 ? 'disabled' : ''}>
        ${totalRewards === 0 ? '✨ No hay recompensas pendientes' : '⚡ Reclaim Rewards (todo)'}
      </button>
      <div id="claimStatus" class="small muted" style="margin-top:8px;text-align:center;"></div>
    </div>
  `;

  const claimBtn = c.querySelector('#claimRewardsBtn');
  if (claimBtn && totalRewards > 0) {
    claimBtn.addEventListener('click', async () => {
      claimBtn.disabled = true;
      claimBtn.textContent = '⏳ Preparando tx...';
      const statusEl = c.querySelector('#claimStatus');
      statusEl.textContent = 'Obteniendo datos on-chain...';

      try {
        const token = getJWT();
        if (!token) {
          statusEl.textContent = '❌ Debes conectar tu wallet primero.';
          claimBtn.disabled = false;
          claimBtn.textContent = '⚡ Reclaim Rewards (todo)';
          return;
        }

        // Verificar que MetaMask está disponible
        if (!window.ethereum) {
          statusEl.textContent = '❌ MetaMask no detectado. Instala MetaMask para firmar la tx.';
          claimBtn.disabled = false;
          claimBtn.textContent = '⚡ Reclaim Rewards (todo)';
          return;
        }

        // 1. Pedir al backend que prepare la tx
        const claimRes = await fetch(API_BASE + '/api/aura/claim', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token },
          body: JSON.stringify({
            to: getDid(),
            amount: String(auraReclamable * 1e18) // convertir a wei
          })
        });
        const claimData = await claimRes.json();

        if (!claimData.ok || !claimData.tx) {
          statusEl.textContent = '❌ ' + (claimData.error || 'Error al preparar tx');
          claimBtn.disabled = false;
          claimBtn.textContent = '⚡ Reclaim Rewards (todo)';
          return;
        }

        // 2. Pedir al usuario que cambie a Base Mainnet en MetaMask
        const BASE_CHAIN_ID = '0x2105'; // 8453
        let currentChainId = await window.ethereum.request({ method: 'eth_chainId' });
        if (currentChainId !== BASE_CHAIN_ID) {
          try {
            await window.ethereum.request({
              method: 'wallet_switchEthereumChain',
              params: [{ chainId: BASE_CHAIN_ID }]
            });
          } catch (switchError) {
            if (switchError.code === 4902) {
              await window.ethereum.request({
                method: 'wallet_addEthereumChain',
                params: [{
                  chainId: BASE_CHAIN_ID,
                  chainName: 'Base Mainnet',
                  nativeCurrency: { name: 'ETH', symbol: 'ETH', decimals: 18 },
                  rpcUrls: ['https://mainnet.base.org'],
                  blockExplorerUrls: ['https://basescan.org']
                }]
              });
            } else {
              throw switchError;
            }
          }
        }

        // 3. Enviar la tx a MetaMask para que el usuario la firme
        statusEl.textContent = '✍️ Firma la transacción en MetaMask...';
        const txHash = await window.ethereum.request({
          method: 'eth_sendTransaction',
          params: [claimData.tx]
        });

        // 4. Tx enviada, esperar confirmación (opcional)
        statusEl.textContent = `✅ Tx enviada: ${txHash.slice(0, 10)}... Esperando confirmación...`;

        // Esperar 1 confirmación
        await new Promise(resolve => {
          const checkTx = setInterval(async () => {
            try {
              const receipt = await window.ethereum.request({
                method: 'eth_getTransactionReceipt',
                params: [txHash]
              });
              if (receipt && receipt.blockNumber) {
                clearInterval(checkTx);
                resolve(undefined);
              }
            } catch (_) {}
          }, 2000);
          // Timeout después de 60s
          setTimeout(() => { clearInterval(checkTx); resolve(undefined); }, 60000);
        });

        statusEl.textContent = `✅ Tx confirmada: ${txHash.slice(0, 10)}...`;
        claimBtn.textContent = '✅ Reclamado';

        // 5. Recargar stats
        __ME_STATS__ = await fetchMeStats();
        syncProfile();
      } catch (e) {
        const msg = e?.message || e?.code || 'desconocido';
        if (msg.includes('4001') || msg.includes('denied') || msg.includes('rejected')) {
          statusEl.textContent = '⛔ Transacción rechazada por el usuario.';
        } else {
          statusEl.textContent = '❌ Error: ' + msg;
        }
        claimBtn.disabled = false;
        claimBtn.textContent = '⚡ Reclaim Rewards (todo)';
      }
    });
  } else if (claimBtn) {
    claimBtn.style.opacity = '0.5';
    claimBtn.style.cursor = 'default';
  }
}

/* =========================================================
   🛒 TIENDA — Marketplace P2P NFTs por AURA
========================================================= */

async function renderTiendaTab(modal) {
  const c = modal.querySelector("#pfContent");
  if (!c) return;
  const addr = getDid();

  if (!addr) {
    c.innerHTML = `<div class="pf-box"><div class="h2">🛒 Tienda</div><p class="muted">Conecta tu wallet para comprar y vender NFTs.</p></div>`;
    return;
  }

  c.innerHTML = `<div class="pf-box"><div class="h2">🛒 Tienda P2P</div>
    <div style="display:flex;gap:8px;margin-bottom:10px">
      <button class="tab-btn active" id="mkBrowseBtn">Explorar</button>
      <button class="tab-btn" id="mkMineBtn">Mis ventas</button>
      <button class="tab-btn" id="mkSellBtn">+ Vender</button>
    </div>
    <div id="mkContent"></div>
  </div>`;

  document.getElementById("mkBrowseBtn").onclick = () => loadMarketItems();
  document.getElementById("mkMineBtn").onclick = () => loadMyListings();
  document.getElementById("mkSellBtn").onclick = () => showSellForm();

  loadMarketItems();
}

async function loadMarketItems() {
  const container = document.getElementById("mkContent");
  if (!container) return;
  container.innerHTML = `<p class="muted">Cargando...</p>`;

  try {
    const res = await fetch(`${API_BASE}/api/market/items`);
    const data = await res.json();
    if (!data.ok) throw new Error(data.error || 'Error');

    const items = data.items || [];
    if (items.length === 0) {
      container.innerHTML = `<p class="muted">No hay NFTs a la venta. ¡Sé el primero en vender!</p>`;
      return;
    }

    container.innerHTML = `<div class="mk-grid">${items.map((item, i) => `
      <div class="mk-card">
        <div class="mk-img-wrap">
          ${item.nft_image
            ? `<img src="${esc(item.nft_image)}" alt="${esc(item.nft_name)}" loading="lazy" onerror="this.style.display='none'"/>`
            : `<div class="mk-img-fallback">🖼️</div>`}
        </div>
        <div class="mk-info">
          <div class="mk-name">${esc(item.nft_name)}</div>
          <div class="mk-seller">por ${esc(item.seller_name || shortAddr(item.seller))}</div>
          <div class="mk-price">🔵 ${item.price_aura} AURA</div>
          <button class="mk-buy-btn" data-id="${item.id}" data-seller="${esc(item.seller)}" data-price="${item.price_aura}">Comprar</button>
        </div>
      </div>
    `).join('')}</div>`;

    container.querySelectorAll(".mk-buy-btn").forEach(btn => {
      btn.onclick = async () => {
        const id = btn.dataset.id;
        const seller = btn.dataset.seller;
        const price = Number(btn.dataset.price);
        await buyItem(id, seller, price);
      };
    });
  } catch (e) {
    container.innerHTML = `<p class="muted">❌ Error al cargar: ${e.message}</p>`;
  }
}

async function loadMyListings() {
  const container = document.getElementById("mkContent");
  if (!container) return;
  container.innerHTML = `<p class="muted">Cargando...</p>`;

  try {
    const jwt = getJWT();
    const res = await fetch(`${API_BASE}/api/market/my`, { headers: jwt ? { Authorization: `Bearer ${jwt}` } : {} });
    const data = await res.json();
    if (!data.ok) throw new Error(data.error || 'Error');

    const items = data.items || [];
    if (items.length === 0) {
      container.innerHTML = `<p class="muted">No tienes items en venta.</p>`;
      return;
    }

    container.innerHTML = `<div class="mk-grid">${items.map(item => `
      <div class="mk-card ${item.sold ? 'mk-sold' : ''}">
        <div class="mk-img-wrap">
          ${item.nft_image
            ? `<img src="${esc(item.nft_image)}" alt="${esc(item.nft_name)}" loading="lazy" onerror="this.style.display='none'"/>`
            : `<div class="mk-img-fallback">🖼️</div>`}
        </div>
        <div class="mk-info">
          <div class="mk-name">${esc(item.nft_name)}</div>
          <div class="mk-price">🔵 ${item.price_aura} AURA</div>
          <div class="mk-status">${item.sold ? '✅ Vendido' : '📦 Activo'}</div>
        </div>
      </div>
    `).join('')}</div>`;
  } catch (e) {
    container.innerHTML = `<p class="muted">❌ Error: ${e.message}</p>`;
  }
}

function showSellForm() {
  const container = document.getElementById("mkContent");
  if (!container) return;
  container.innerHTML = `
    <div class="mk-form">
      <label class="mk-label">Nombre del NFT</label>
      <input class="mk-input" id="mkNftName" placeholder="Ej: Cool Cat #42" />
      <label class="mk-label">URL de imagen (opcional)</label>
      <input class="mk-input" id="mkNftImage" placeholder="https://..." />
      <label class="mk-label">Dirección del contrato (opcional)</label>
      <input class="mk-input mono" id="mkNftContract" placeholder="0x..." />
      <label class="mk-label">Token ID (opcional)</label>
      <input class="mk-input" id="mkNftTokenId" placeholder="123" />
      <label class="mk-label">Precio en AURA</label>
      <input class="mk-input" id="mkPrice" type="number" min="1" step="1" placeholder="10" />
      <button class="mk-submit" id="mkSubmitBtn">📢 Publicar venta</button>
      <p class="small muted" id="mkFormStatus"></p>
    </div>`;

  document.getElementById("mkSubmitBtn").onclick = submitListing;
}

async function submitListing() {
  const statusEl = document.getElementById("mkFormStatus");
  const nftName = document.getElementById("mkNftName")?.value.trim();
  const nftImage = document.getElementById("mkNftImage")?.value.trim();
  const nftContract = document.getElementById("mkNftContract")?.value.trim();
  const nftTokenId = document.getElementById("mkNftTokenId")?.value.trim();
  const priceAura = Number(document.getElementById("mkPrice")?.value);

  if (!nftName) { statusEl.textContent = '❌ El nombre del NFT es obligatorio'; return; }
  if (!priceAura || priceAura < 1) { statusEl.textContent = '❌ Precio mínimo: 1 AURA'; return; }

  try {
    const jwt = getJWT();
    const res = await fetch(`${API_BASE}/api/market/list`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...(jwt ? { Authorization: `Bearer ${jwt}` } : {}) },
      body: JSON.stringify({ nftName, nftImage, nftContract, nftTokenId, priceAura })
    });
    const data = await res.json();
    if (!data.ok) throw new Error(data.error || 'Error');

    statusEl.textContent = '✅ Publicado!';
    setTimeout(() => { document.getElementById("mkBrowseBtn")?.click(); }, 1000);
  } catch (e) {
    statusEl.textContent = '❌ ' + e.message;
  }
}

async function buyItem(id, seller, price) {
  if (typeof window.ethereum === 'undefined') {
    alert('Conecta MetaMask primero');
    return;
  }

  const addr = getDid();
  if (!addr) { alert('Conecta tu wallet primero'); return; }
  if (addr.toLowerCase() === seller.toLowerCase()) { alert('No puedes comprarte tu propio item'); return; }

  const confirmMsg = `¿Comprar este NFT por ${price} AURA?\n\nEsto transferirá ${price} AURA de tu wallet a ${shortAddr(seller)}.`;
  if (!confirm(confirmMsg)) return;

  try {
    // 1. Obtener nonce y estimar gas desde backend (reusamos lógica de claim)
    const jwt = getJWT();
    const prepRes = await fetch(`${API_BASE}/api/aura/claim`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...(jwt ? { Authorization: `Bearer ${jwt}` } : {}) }
    });
    const prep = await prepRes.json();
    if (!prep.ok) throw new Error(prep.error || 'Error preparando tx');

    // 2. Cambiar a Base Mainnet
    try {
      await window.ethereum.request({ method: 'wallet_switchEthereumChain', params: [{ chainId: '0x2105' }] });
    } catch (e) { /* ya está en base */ }

    // 3. Construir tx de transferencia de AURA (del comprador al vendedor)
    const contractAddr = prep.contractAddress;
    const amountWei = BigInt(Math.floor(price)) * BigInt(10) ** BigInt(18);
    const transferData = '0xa9059cbb' + seller.slice(2).padStart(64, '0') + amountWei.toString(16).padStart(64, '0');

    const tx = {
      from: addr,
      to: contractAddr,
      data: transferData,
      gas: prep.gas || '0x52080',
      gasPrice: prep.gasPrice,
      nonce: prep.nonce,
      chainId: '0x2105',
    };

    // 4. Firmar con MetaMask
    const txHash = await window.ethereum.request({ method: 'eth_sendTransaction', params: [tx] });

    // 5. Esperar confirmación
    const statusEl = document.getElementById("mkContent")?.querySelector(".muted");
    if (statusEl) statusEl.textContent = '⏳ Esperando confirmación...';

    let receipt = null;
    for (let i = 0; i < 60; i++) {
      await new Promise(r => setTimeout(r, 3000));
      const rc = await window.ethereum.request({ method: 'eth_getTransactionReceipt', params: [txHash] });
      if (rc && rc.blockNumber) { receipt = rc; break; }
    }

    if (!receipt) throw new Error('Timeout esperando confirmación');

    // 6. Marcar como vendido
    await fetch(`${API_BASE}/api/market/sold/${id}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...(jwt ? { Authorization: `Bearer ${jwt}` } : {}) }
    });

    alert(`✅ Compra exitosa!\nHash: ${txHash}\n\nEl vendedor recibirá ${price} AURA. Contacta con ${shortAddr(seller)} para coordinar la entrega del NFT.`);

    // Recargar
    document.getElementById("mkBrowseBtn")?.click();
  } catch (e) {
    alert('❌ Error: ' + e.message);
  }
}

/* =========================================================
   FARM TAB — Reclamo diario de AURA con mini-game pixel art
   Endpoints: POST /api/farm/claim + GET /api/farm/status
   ========================================================= */

let _farmCache = null;

async function loadFarmStatus() {
  try {
    const { getJWT, API_BASE } = await import('./api.js');
    const token = getJWT();
    if (!token) return null;
    const res = await fetch(`${API_BASE}/api/farm/status`, { headers: { Authorization: `Bearer ${token}` } });
    if (!res.ok) return null;
    const data = await res.json();
    if (data.ok) { _farmCache = data; return data; }
  } catch {}
  return null;
}

async function submitFarmClaim(amount, streak) {
  try {
    const { getJWT, API_BASE } = await import('./api.js');
    const token = getJWT();
    if (!token) return null;
    const res = await fetch(`${API_BASE}/api/farm/claim`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ amount, streak })
    });
    return await res.json();
  } catch {}
  return null;
}

function renderFarmTab(modal) {
  const c = modal.querySelector("#pfContent");
  if (!c) return;
  const addr = getDid();
  if (!addr) {
    c.innerHTML = `<div class="pf-box"><div class="h2">🎣 FARM</div><p class="muted">Conecta tu wallet para pescar AURA.</p></div>`;
    return;
  }

  c.innerHTML = `<div class="pf-box farm-container"><div style="padding:20px;text-align:center;opacity:.5;">🎣 Cargando...</div></div>`;

  loadFarmStatus().then(status => {
    const canClaim = status?.canClaim !== false;
    const streak = status?.streak || 0;
    const totalFarmed = status?.totalFarmed || 0;
    const history = status?.history || [];
    const claimedToday = status?.claimedToday || false;
    let localStreak = streak;

    c.innerHTML = `
      <div class="pf-box farm-container">
        <div class="h2" style="font-size:15px;display:flex;align-items:center;gap:8px;">
          ⛏️ Farmeando AURA
          <span class="farm-streak" id="farmStreak" style="font-size:11px;font-weight:400;opacity:.6;">Racha: ${streak} día${streak !== 1 ? 's' : ''}</span>
        </div>
        <div style="font-size:11px;opacity:.6;text-align:center;margin-bottom:2px;">Total acumulado: <strong style="color:var(--primary,#00ffd5);">${totalFarmed} AURA</strong></div>

        <div style="position:relative;width:360px;margin:6px auto;border-radius:14px;overflow:hidden;background:var(--bg-card,#0d1520);border:1px solid rgba(255,255,255,.08);">
          <canvas id="farmCanvas" width="360" height="260" style="display:block;width:100%;height:auto;image-rendering:pixelated;"></canvas>

          <div id="farmOverlay" style="display:none;position:absolute;inset:0;background:rgba(0,0,0,.72);z-index:5;flex-direction:column;align-items:center;justify-content:center;color:#fff;text-align:center;padding:20px;">
            <div id="farmResultIcon" style="font-size:48px;margin-bottom:6px;">🎁</div>
            <div id="farmResultTitle" style="font-size:18px;font-weight:700;"></div>
            <div id="farmResultSub" style="font-size:13px;opacity:.7;margin-top:4px;"></div>
            <button id="farmCloseResult" class="tab-btn" style="margin-top:14px;font-size:12px;padding:6px 18px;">Cerrar</button>
          </div>
        </div>

        <button id="farmBtn" class="tab-btn" style="width:100%;margin-top:6px;font-size:14px;padding:10px;${!canClaim?'opacity:.4;cursor:not-allowed;':''}" ${!canClaim?'disabled':''}>
          ${canClaim ? '🎣 Lanzar caña!' : '⏳ Ya pescaste hoy'}
        </button>
        <div id="farmTimer" style="font-size:11px;opacity:.5;text-align:center;margin-top:4px;"></div>

        <div class="farm-history" id="farmHistory" style="margin-top:10px;font-size:12px;opacity:.7;">
          ${history.length === 0 ? 'Aún no has pescado nada.' : ''}
        </div>
      </div>
    `;

    drawFarmScene();

    const btn = c.querySelector('#farmBtn');
    if (btn && canClaim) {
      btn.addEventListener('click', () => {
        btn.disabled = true; btn.style.opacity = '.4'; btn.textContent = '🎣 Pesca en curso...';
        startFarming(addr, c, localStreak);
      });
    }

    renderFarmHistory(c, history);

    c.querySelector('#farmCloseResult')?.addEventListener('click', () => {
      const ov = c.querySelector('#farmOverlay');
      if (ov) ov.style.display = 'none';
      syncProfile();
    });

    if (!canClaim && claimedToday) updateFarmCountdown(c);
  });
}

/* ===== CANVAS ===== */
function drawFarmScene() {
  const canvas = document.getElementById('farmCanvas');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  const W = 360, H = 260;

  for (let y = 0; y < 50; y++) { const t = y/50; ctx.fillStyle = `rgb(${8+t*18},${12+t*22},${30+t*25})`; ctx.fillRect(0, y, W, 2); }
  for (let i = 0; i < 10; i++) { ctx.fillStyle = `rgb(${190+i*6},${190+i*6},215)`; ctx.fillRect((i*31+7)%W, (i*23+5)%42, 2, 2); }

  for (let x = 0; x < W; x += 4) {
    const h = Math.sin(x*0.025)*10+10;
    for (let dy = 0; dy < h; dy += 2) { ctx.fillStyle = (Math.floor(x/4)+Math.floor(dy/2))%2===0?'#1a3a2a':'#1e4230'; ctx.fillRect(x, 42+dy, 4, 2); }
  }

  const mx = 48, my = 120;
  ctx.fillStyle='rgba(0,0,0,0.2)';ctx.fillRect(mx-18,my+70,56,6);
  ctx.fillStyle='#2a1a0a';ctx.fillRect(mx-16,my+58,52,14);
  [{w:48,x:0,c:'#3a2a1a'},{w:44,x:2,c:'#4a3a2a'},{w:40,x:4,c:'#5a4a3a'},{w:38,x:5,c:'#4a3a2a'},{w:34,x:7,c:'#5a4a3a'},{w:30,x:9,c:'#6a5a4a'},{w:26,x:11,c:'#5a4a3a'},{w:22,x:13,c:'#6a5a4a'},{w:18,x:15,c:'#4a3a2a'},{w:14,x:17,c:'#5a4a3a'},{w:12,x:18,c:'#6a5a4a'},{w:10,x:19,c:'#5a4a3a'},{w:8,x:20,c:'#7a6a5a'},{w:6,x:21,c:'#6a5a4a'}].forEach((l,i)=>ctx.fillRect(mx-12+l.x,my+i*5,l.w,5)||(ctx.fillStyle=l.c));
  ctx.fillStyle='#3a2a1a';ctx.fillRect(mx+4,my-18,10,18);ctx.fillStyle='#5a4a3a';ctx.fillRect(mx+5,my-14,8,12);ctx.fillStyle='#7a6a5a';ctx.fillRect(mx+6,my-8,6,6);
  ctx.fillStyle='rgba(0,0,0,0.1)';[[2,6,2,10],[8,14,2,8],[14,4,2,6],[20,10,2,8],[6,22,2,6],[18,28,2,5],[10,36,3,4],[4,44,2,6],[22,42,2,5]].forEach(([gx,gy,gw,gh])=>ctx.fillRect(mx+gx,my+gy,gw,gh));
  ctx.fillStyle='rgba(30,60,30,0.3)';ctx.fillRect(mx-10,my+60,44,4);ctx.fillRect(mx-6,my+56,34,3);

  const pondX=170,pondY=168,prx=98,pry=38;
  ctx.fillStyle='#1a3a4a';ctx.beginPath();ctx.ellipse(pondX+2,pondY+3,prx+2,pry+2,0,0,Math.PI*2);ctx.fill();
  ['#1a4a6a','#1e5070','#22587a','#266084','#2a688e'].forEach((c,i)=>{const t=i/4,yoff=Math.round(-pry+i*(pry*2/5)),hw=Math.round(Math.sqrt(Math.max(0,1-(yoff/pry)**2))*prx);ctx.fillStyle=c;ctx.fillRect(pondX-hw,pondY+yoff,hw*2,Math.ceil(pry*2/5)+1);});
  for(let i=0;i<5;i++){const wy=pondY-10+i*7,w=Math.sin(Date.now()*.001+i)*3;for(let wx=pondX-75;wx<pondX+75;wx+=4)ctx.fillRect(wx,wy+Math.sin(wx*0.08+i*1.5+w)*2,4,1);}

  for(let y=192;y<H;y+=3)for(let x=0;x<W;x+=4){const d=(Math.floor(x/4)+Math.floor(y/3))%3;ctx.fillStyle=d===0?'#5a4a3a':(d===1?'#635444':'#4a3a2a');ctx.fillRect(x,y,4,3);}
  for(let i=0;i<20;i++){ctx.fillStyle=i%2===0?'#3a6a3a':'#2a5a2a';ctx.fillRect((i*19+5)%W,191,3,3);}

  [[310,200],[340,206]].forEach(([tx,ty])=>{ctx.fillStyle='#5a3a1a';ctx.fillRect(tx-1,ty-14,3,18);ctx.fillStyle='#1a4a1a';ctx.fillRect(tx-8,ty-22,16,10);ctx.fillRect(tx-5,ty-26,10,8);ctx.fillStyle='#2a6a2a';ctx.fillRect(tx-6,ty-20,12,6);ctx.fillRect(tx-3,ty-24,6,4);});

  const px=mx+6,py=my-14;
  ctx.fillStyle='rgba(0,0,0,0.3)';ctx.fillRect(px-4,py+18,14,4);
  ctx.fillStyle='#3a5a8a';ctx.fillRect(px-1,py-2,4,8);ctx.fillStyle='#d4a56a';ctx.fillRect(px-2,py+4,3,4);
  ['#2a4a7a','#3a5a8a','#3a5a8a','#4a6a9a','#3a5a8a','#2a4a7a'].forEach((c,i)=>{ctx.fillStyle=c;ctx.fillRect(px-2,py-4+i*3,8,3);});
  ctx.fillStyle='#6a4a2a';ctx.fillRect(px-2,py+8,8,2);ctx.fillStyle='#c47a2a';ctx.fillRect(px+4,py+8,2,2);
  ctx.fillStyle='#1a2a4a';ctx.fillRect(px-2,py+14,4,8);ctx.fillRect(px+3,py+14,4,8);
  ctx.fillStyle='#3a2a1a';ctx.fillRect(px-2,py+20,4,3);ctx.fillRect(px+3,py+20,4,3);
  ctx.fillStyle='#d4a56a';ctx.fillRect(px,py-12,7,10);ctx.fillStyle='#c89a5e';ctx.fillRect(px+7,py-8,3,3);ctx.fillRect(px+9,py-7,2,1);
  ctx.fillStyle='#fff';ctx.fillRect(px+3,py-9,3,2);ctx.fillStyle='#222';ctx.fillRect(px+5,py-8,1,1);ctx.fillStyle='#d4a56a';ctx.fillRect(px-2,py-9,2,3);
  ['#7a4a1a','#8a5a2a','#9a6a3a'].forEach((c,i)=>{ctx.fillStyle=c;ctx.fillRect(px-1+i,py-16,2,5);});
  ctx.fillStyle='#6a3a0a';ctx.fillRect(px-3,py-17,3,3);ctx.fillRect(px-4,py-18,2,2);
  ctx.fillStyle='rgba(42,74,122,0.35)';ctx.fillRect(px-6,py,6,14);ctx.fillRect(px-8,py+6,4,8);

  ctx.fillStyle='rgba(0,0,0,0.65)';ctx.fillRect(4,4,W-8,20);
  ctx.fillStyle='#ffe0a0';ctx.font='bold 9px monospace';ctx.fillText('⛏️  RECLAMO DIARIO — FARMEANDO AURA',14,16);
  ctx.fillStyle='rgba(255,224,160,0.3)';ctx.fillRect(10,21,120,1);ctx.fillRect(W-130,21,120,1);
}

/* ===== ANIMACIÓN ===== */
function startFarming(addr, container, currentStreak) {
  const canvas = document.getElementById('farmCanvas');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  const mx=48,my=120,px=mx+6,py=my-14,pondX=170-30,pondY=168-8;
  let frame = 0;
  const totalFrames = 30;

  function drawRod(angle) {
    ctx.save();ctx.translate(px+12, py-4);ctx.rotate(angle);
    ctx.strokeStyle='#6a4a2a';ctx.lineWidth=4;ctx.beginPath();ctx.moveTo(0,0);ctx.lineTo(20,-18);ctx.stroke();
    ctx.strokeStyle='#8a6a3a';ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(2,-1);ctx.lineTo(18,-16);ctx.stroke();
    ctx.strokeStyle='#5a3a1a';ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(20,-18);ctx.lineTo(28,-24);ctx.stroke();
    ctx.fillStyle='#aaa';ctx.fillRect(27,-25,3,3);ctx.restore();
  }

  function lineToPond(angle, extend) {
    const tipX=px+12+Math.cos(-angle)*28, tipY=py-4+Math.sin(-angle)*24;
    const endX=tipX+(pondX-tipX)*extend, endY=tipY+(pondY-tipY)*extend;
    ctx.strokeStyle='rgba(200,200,200,0.4)';ctx.lineWidth=1;
    ctx.beginPath();ctx.moveTo(tipX,tipY);ctx.quadraticCurveTo(tipX+(pondX-tipX)*0.5+10,tipY+(pondY-tipY)*0.4,endX,endY);ctx.stroke();
    ctx.fillStyle='#ff4444';ctx.beginPath();ctx.arc(endX,endY+Math.sin(frame*0.5)*2,3,0,Math.PI*2);ctx.fill();
    ctx.fillStyle='#ff8888';ctx.beginPath();ctx.arc(endX-1,endY-1+Math.sin(frame*0.5)*2,1.5,0,Math.PI*2);ctx.fill();
  }

  function animateCast() {
    const p = frame/totalFrames, angle = -0.4+Math.sin(p*Math.PI)*0.5;
    drawFarmScene(); drawRod(angle); lineToPond(angle, Math.min(p*1.2,1));
    frame++; if(frame<=totalFrames) requestAnimationFrame(animateCast); else setTimeout(()=>animateReelIn(), 800);
  }

  function animateReelIn() {
    let f2=0; const total2=30, reward=getRandomFarmReward(currentStreak);
    function step() {
      const p=f2/total2, invP=1-p, angle=-0.2+p*0.15;
      drawFarmScene(); drawRod(angle);
      const tipX=px+12+Math.cos(0.2)*28, tipY=py-4+Math.sin(0.2)*24;
      const curX=tipX+(pondX-tipX)*invP, curY=tipY+(pondY-tipY)*invP;
      ctx.strokeStyle='rgba(200,200,200,0.4)';ctx.lineWidth=1;
      ctx.beginPath();ctx.moveTo(tipX,tipY);ctx.quadraticCurveTo(tipX+(pondX-tipX)*0.5*invP+10,tipY+(pondY-tipY)*0.4*invP,curX,curY);ctx.stroke();
      const chestX=pondX+Math.sin(p*6)*3, chestY=pondY+12-p*28;
      ctx.fillStyle='rgba(100,200,240,0.3)';
      for(let i=0;i<6;i++)ctx.fillRect(chestX+(i-2.5)*6+Math.sin(p*8+i*1.3)*5-2,chestY+10+Math.random()*8-2,4,4);
      if(p>0.35) drawChest(ctx, chestX, chestY, Math.floor(18+p*8));
      f2++; if(f2<=total2) requestAnimationFrame(step); else showFarmResult(addr, container, reward, ctx, currentStreak);
    }
    step();
  }

  animateCast();
}

function getRandomFarmReward(streak) {
  streak=streak||0; const roll=Math.random(), diff=Math.min(streak*0.05,0.5);
  let reward;
  if(roll<0.35-diff*0.2) reward=0.1; else if(roll<0.60-diff*0.15) reward=0.5;
  else if(roll<0.78-diff*0.1) reward=1; else if(roll<0.90-diff*0.05) reward=5;
  else if(roll<0.97) reward=10; else if(roll<0.995) reward=50; else reward=100;
  return Math.min(Math.round(reward*(1+Math.floor(streak/7)*0.5)*10)/10,100);
}

function drawChest(ctx, cx, cy, size) {
  const s=size||24, hs=s>>1, qs=Math.floor(s*0.3);
  ctx.fillStyle='rgba(0,0,0,0.25)';ctx.fillRect(cx-hs-1,cy+qs+1,s+2,5);
  ['#6a3a1a','#7a4a2a','#6a3a1a','#8a5a3a','#6a3a1a'].forEach((c,i)=>{ctx.fillStyle=c;ctx.fillRect(cx-hs,cy-qs+i*Math.ceil(s*0.12),s,Math.ceil(s*0.12)+1);});
  ['#8a5a3a','#9a6a4a','#8a5a3a','#a07a5a'].forEach((c,i)=>{ctx.fillStyle=c;ctx.fillRect(cx-hs-1,cy-qs-5+i*3,s+2,3);});
  ctx.fillStyle='#c49840';ctx.fillRect(cx-hs-1,cy-qs-6,s+2,2);ctx.fillRect(cx-hs-1,cy-qs+5,s+2,2);
  ctx.fillStyle='#333';ctx.fillRect(cx-2,cy-2,4,5);ctx.fillStyle='#ffd700';ctx.fillRect(cx-1,cy-1,2,3);ctx.fillStyle='#fff8dc';ctx.fillRect(cx-1,cy-1,1,1);
  [[cx-hs+3,cy-qs+2],[cx+hs-4,cy-qs+2],[cx-hs+3,cy+qs-2],[cx+hs-4,cy+qs-2]].forEach(([rx,ry])=>{ctx.fillStyle='#c49840';ctx.fillRect(rx,ry,3,3);ctx.fillStyle='#ffd700';ctx.fillRect(rx,ry,2,2);ctx.fillStyle='#fff8dc';ctx.fillRect(rx,ry,1,1);});
  ctx.fillStyle='rgba(255,220,160,0.2)';ctx.fillRect(cx-hs+4,cy-qs-3,s-8,3);
}

/* ===== RESULTADO ===== */
function showFarmResult(addr, container, reward, ctx, currentStreak) {
  const newStreak=(currentStreak||0)+1, mx=48,my=120,px=mx+6,py=my-14,cx=px+22,cy=py+6;

  drawFarmScene();
  ctx.fillStyle='rgba(0,0,0,0.2)';ctx.fillRect(cx-12,cy+8,24,5);
  ['#6a3a1a','#7a4a2a','#6a3a1a','#8a5a3a','#7a4a2a'].forEach((c,i)=>{ctx.fillStyle=c;ctx.fillRect(cx-10,cy+i*3,20,3);});
  ctx.fillStyle='#8a5a3a';ctx.fillRect(cx-11,cy-10,22,4);ctx.fillStyle='#9a6a4a';ctx.fillRect(cx-10,cy-9,20,2);
  ctx.fillStyle='#666';ctx.fillRect(cx-4,cy-10,3,3);ctx.fillRect(cx+1,cy-10,3,3);
  ctx.fillStyle='#ffd700';ctx.fillRect(cx-6,cy+2,5,3);ctx.fillRect(cx+2,cy+3,4,2);ctx.fillRect(cx-2,cy+1,3,4);
  ctx.fillStyle='#ffec80';ctx.fillRect(cx-5,cy+3,2,1);ctx.fillRect(cx+3,cy+4,2,1);
  for(let i=0;i<10;i++){ctx.fillStyle=['#ffd700','#fff','#ffec80','#ff8800'][i%4];ctx.fillRect(cx-10+Math.random()*22,cy-12-Math.random()*12,Math.random()>.5?2:1,Math.random()>.5?2:1);}

  const overlay=container.querySelector('#farmOverlay'), icon=container.querySelector('#farmResultIcon'), title=container.querySelector('#farmResultTitle'), sub=container.querySelector('#farmResultSub'), btn=container.querySelector('#farmBtn'), d=reward<1?reward.toFixed(1):reward;
  if(overlay&&title&&sub&&icon) overlay.style.display='flex';

  if(reward>=100){icon.textContent='👑';title.textContent=`👑 ¡${d} AURA — JACKPOT!`;sub.textContent='¡Cofre legendario!';}
  else if(reward>=50){icon.textContent='💎';title.textContent=`💎 ¡${d} AURA — Legendario!`;sub.textContent='¡Tesoro increíble!';}
  else if(reward>=10){icon.textContent='🌟';title.textContent=`🌟 ¡${d} AURA — Cofre valioso!`;sub.textContent='Brillo especial en el cofre.';}
  else if(reward>=5){icon.textContent='🎁';title.textContent=`🎁 ¡${d} AURA!`;sub.textContent='Buena pesca.';}
  else if(reward>=1){icon.textContent='📦';title.textContent=`📦 ¡${d} AURA!`;sub.textContent='Cofre modesto pero bienvenido.';}
  else{icon.textContent='🪙';title.textContent=`🪙 ¡${d} AURA!`;sub.textContent='Pequeñito pero es AURA.';}

  submitFarmClaim(reward, newStreak).then(resp => {
    if(resp?.ok){
      setTimeout(()=>syncProfile(),300);
      if(btn){btn.disabled=true;btn.style.opacity='.4';btn.textContent='⏳ Vuelve mañana';}
      const se=container.querySelector('#farmStreak');if(se)se.textContent=`Racha: ${newStreak} día${newStreak!==1?'s':''}`;
      updateFarmCountdown(container);
    } else {
      if(title)title.textContent='❌ Error en servidor';
      if(sub)sub.textContent=resp?.error||'Intenta de nuevo.';
      if(btn){btn.disabled=false;btn.style.opacity='1';btn.textContent='🎣 Reintentar';}
    }
  }).catch(()=>{
    if(title)title.textContent='❌ Error de conexión';
    if(sub)sub.textContent='Revisa tu conexión.';
    if(btn){btn.disabled=false;btn.style.opacity='1';btn.textContent='🎣 Reintentar';}
  });
}

/* ===== COUNTDOWN ===== */
function updateFarmCountdown(container) {
  const timer=container.querySelector('#farmTimer'); if(!timer) return;
  function tick(){const n=new Date(),m=new Date(n);m.setDate(m.getDate()+1);m.setHours(0,0,0,0);const d=m.getTime()-n.getTime();if(d<=0){timer.textContent='🎣 ¡Ya puedes pescar!';return;}timer.textContent=`⏳ ${Math.floor(d/3600000)}h ${Math.floor((d%3600000)/60000)}m ${Math.floor((d%60000)/1000)}s`;setTimeout(tick,1000);}
  tick();
}

/* ===== HISTORIAL ===== */
function renderFarmHistory(container, history) {
  const el=container.querySelector('#farmHistory'); if(!el) return;
  if(!history||!history.length){el.textContent='Aún no has pescado nada.';return;}
  el.innerHTML='<div style="display:flex;flex-wrap:wrap;">Últimas capturas: '+history.slice(0,10).map(h=>{
    const d=new Date(h.date+'T00:00:00'); let icon='🪙';
    if(h.amount>=100)icon='👑';else if(h.amount>=50)icon='💎';else if(h.amount>=10)icon='🌟';else if(h.amount>=5)icon='🎁';else if(h.amount>=1)icon='📦';
    return `<span style="display:inline-flex;align-items:center;gap:4px;margin-right:12px;white-space:nowrap;">${icon} ${d.getDate()}/${d.getMonth()+1}: <strong>${h.amount} AURA</strong></span>`;
  }).join('')+'</div>';
}
