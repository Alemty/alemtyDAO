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
            <button class="tab-btn" data-tab="dex">DEX</button>
            <button class="tab-btn" data-tab="tienda">🛒</button>
          </div>
          <div class="profile-fixed">
            <div class="barbox">
              <div class="bar-top"><strong>Dharma</strong><span class="small muted" id="pfXpText">0</span></div>
              <div class="bar-track"><div class="bar-fill dharma" id="pfXpBar" style="width:0%"></div></div>
            </div>
            <div class="barbox">
              <div class="bar-top"><strong>Karma</strong><span class="small muted" id="pfKarmaText">0</span></div>
              <div class="bar-track"><div class="bar-fill karma" id="pfKarmaBar" style="width:0%"></div></div>
            </div>
            <div class="pf-balances" id="pfBalances">
              <div class="token token-dharma"><span class="ico">🟢</span><span class="lbl">Dharma</span><span class="val" id="pfDharma">—</span></div>
              <div class="token token-aura"><span class="ico">🔵</span><span class="lbl">Aura</span><span class="val" id="pfAura">—</span></div>
              <div class="token token-karma" id="pfKarmaToken"><span class="ico">🔴</span><span class="lbl">Karma</span><span class="val" id="pfKarmaVal">—</span></div>
              <div class="token token-alem"><span class="ico">🟡</span><span class="lbl">$ALEM</span><span class="val" id="pfAlem">—</span></div>
              <div class="token token-vealem"><span class="ico">🟠</span><span class="lbl">veALEM</span><span class="val" id="pfVeAlem">—</span></div>
              <div class="small muted hint vealem"></div>
            </div>
          </div>
          <div class="profile-content" id="pfContent"></div>
        </section>
      </div>
    </div>`;
  return el;
}

export async function syncProfile() {
  const addr = getDid();
  const modal = document.getElementById("profileModal");
  if (!modal) return;

  const addrEl = modal.querySelector("#pfAddr");
  const lvlEl = modal.querySelector("#pfLevel");
  const titleEl = modal.querySelector("#pfTitle");
  const avatarBox = modal.querySelector("#pfAvatarBox");
  const avatarImg = modal.querySelector("#pfAvatar");

  addrEl.textContent = addr ? `${shortAddr(addr)} · alemty.eth` : "Conecta tu wallet (☰)";

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
  modal.querySelector("#pfAura").textContent = addr ? String(aura) : "—";
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
  if (tab === "dm") { c.innerHTML = `<div class="pf-box"><div class="h2">DM</div><p class="muted">SOON</p></div>`; return; }
  if (tab === "dex") {
    c.innerHTML = `<div class="pf-box"><div class="h2">DEX</div><div class="dex-grid">${["Swap","LP Pools","Staking","Vote","Reclaim Rewards","Reclaim Bribes"].map(t => `<button class="tab-btn" disabled>${t}</button>`).join('')}</div></div>`;
    return;
  }
  if (tab === "tienda") { c.innerHTML = `<div class="pf-box"><div class="h2">Tienda</div><p class="muted">SOON</p></div>`; return; }
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
    c.innerHTML = `<div class="pf-box"><div class="h2">Estado</div><p class="muted">Panel MMORPG.</p><div class="post-tags" style="margin-top:10px"><span class="pill">⏱️ Conectado: <span class="count">${connectedFor}</span></span><span class="pill">🧙‍♂️ DID: <span class="count">${shortAddr(addr)}</span></span></div></div>`;
    return;
  }

  const pointsReceived = s?.received?.pointsReceived ?? 0;
  const likesReceived = s?.received?.likesReceived ?? 0;
  const commentsReceived = s?.received?.commentsReceived ?? 0;
  const dharma = s?.tokenomics?.dharma ?? 0;
  const aura = s?.tokenomics?.aura ?? 0;

  c.innerHTML = `<div class="pf-box"><div class="h2">Estado</div><p class="muted">Panel MMORPG.</p><div class="post-tags" style="margin-top:10px">${[
    `⏱️ Conectado: <span class="count">${connectedFor}</span>`,
    `🧙‍♂️ DID: <span class="count">${shortAddr(addr)}</span>`
  ].map(t => `<span class="pill">${t}</span>`).join('')}</div><div class="post-tags" style="margin-top:10px">${[
    `⭐ Points recibidos: <span class="count">${fmtInt(pointsReceived)}</span>`,
    `♥️ Likes recibidos: <span class="count">${fmtInt(likesReceived)}</span>`,
    `💬 Comentarios recibidos: <span class="count">${fmtInt(commentsReceived)}</span>`
  ].map(t => `<span class="pill ${t.includes('♥️')?'like':t.includes('⭐')?'points':'comment'}">${t}</span>`).join('')}</div><div class="post-tags" style="margin-top:10px"><span class="pill">🟢 Dharma: <span class="count">${fmtInt(dharma)}</span></span><span class="pill">🔵 Aura: <span class="count">${fmtInt(aura)}</span></span></div><p class="small muted" style="margin-top:10px">Aura se podrá swapear a futuro por ALEM de gobernanza.</p></div>`;
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
  const lastPost = s?.last?.post || null;
  const lastComment = s?.last?.comment || null;

  c.innerHTML = `<div class="pf-box"><div class="h2">Actividad</div><p class="muted">Resumen tipo foro.</p><div class="post-tags" style="margin-top:10px">${[
    `🧵 Posts: <span class="count">${fmtInt(posts)}</span>`,
    `✍️ Comentarios: <span class="count">${fmtInt(comments)}</span>`,
    `♥️ Likes dados: <span class="count">${fmtInt(likesGiven)}</span>`,
    `⭐ Points dados: <span class="count">${fmtInt(pointsGiven)}</span>`
  ].map(t => `<span class="pill">${t}</span>`).join('')}</div><div style="margin-top:12px"><div class="h2">Último post</div><div class="small muted">${lastPost ? lastPost.created_at : "SOON"}</div><div style="margin-top:6px">${lastPost ? lastPost.title : "Aquí irá tu último post."}</div></div><div style="margin-top:12px"><div class="h2">Último comentario</div><div class="small muted">${lastComment ? lastComment.created_at : "SOON"}</div><div style="margin-top:6px">${lastComment ? lastComment.body : "Aquí irá tu último comentario."}</div></div></div>`;
}
