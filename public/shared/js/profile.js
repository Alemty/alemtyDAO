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
              <div class="token token-aura" title="Aura generado por interacciones (likes/points). Reclama el saldo pendiente en la pestaña DEX para mintear on-chain."><span class="ico">🔵</span><span class="lbl">Aura</span><span class="val" id="pfAura">—</span></div>
              <div class="token token-karma" id="pfKarmaToken"><span class="ico">🔴</span><span class="lbl">Karma</span><span class="val" id="pfKarmaVal">—</span></div>
              <div class="token token-alem"><span class="ico">🟡</span><span class="lbl">$ALEM</span><span class="val" id="pfAlem">—</span></div>
              <div class="token token-vealem"><span class="ico">🟠</span><span class="lbl">veALEM</span><span class="val" id="pfVeAlem">—</span></div>
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
      auraHint.textContent = `🔵 ${String(auraReclamable)} AURA por reclamar · Ve a la pestaña DEX para mintear on-chain`;
    } else if (addr && auraBalance !== '0') {
      auraHint.textContent = `🔵 ${auraBalance} AURA on-chain disponibles`;
    } else {
      auraHint.textContent = '';
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
  if (tab === "dm") { c.innerHTML = `<div class="pf-box"><div class="h2">DM</div><p class="muted">SOON</p></div>`; return; }
  if (tab === "dex") {
    return renderDexTab(modal);
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
    c.innerHTML = `<div class="pf-box"><div class="h2">Estado</div><p class="muted">Panel MMORPG.</p><div class="post-tags" style="margin-top:10px"><span class="pill">⏱️ Conectado: <span class="count">${connectedFor}</span></span><span class="pill">🧙‍♂️ DID: <span class="count">${addr.toLowerCase()}</span></span></div></div>`;
    return;
  }

  const pointsReceived = s?.received?.pointsReceived ?? 0;
  const likesReceived = s?.received?.likesReceived ?? 0;
  const commentsReceived = s?.received?.commentsReceived ?? 0;
  const dharma = s?.tokenomics?.dharma ?? 0;
  const aura = s?.tokenomics?.aura ?? 0;

  c.innerHTML = `<div class="pf-box"><div class="h2">Estado</div><p class="muted">Panel MMORPG.</p><div class="post-tags" style="margin-top:10px">${[
    `⏱️ Conectado: <span class="count">${connectedFor}</span>`,
    `🧙‍♂️ DID: <span class="count">${addr.toLowerCase()}</span>`
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

      <div class="rewards-summary" style="display:flex;gap:12px;margin:12px 0;flex-wrap:wrap;">
        <div class="stat-card" style="flex:1;min-width:120px;background:var(--surface1,#0d1117);border:1px solid var(--border,#30363d);border-radius:8px;padding:10px;text-align:center;">
          <div class="small muted">Total recompensas</div>
          <div class="h1" style="font-size:22px;margin:4px 0;">${totalRewards}</div>
        </div>
        <div class="stat-card" style="flex:1;min-width:120px;background:var(--surface1,#0d1117);border:1px solid var(--border,#30363d);border-radius:8px;padding:10px;text-align:center;">
          <div class="small muted">AURA on-chain</div>
          <div class="h1" style="font-size:22px;margin:4px 0;">${auraBalance}</div>
        </div>
      </div>

      <div class="rewards-list" style="display:flex;flex-direction:column;gap:6px;margin:12px 0;">
        ${Object.values(rewards).map(r => `
          <div class="reward-row" style="display:flex;justify-content:space-between;align-items:center;padding:8px 10px;background:var(--surface1,#0d1117);border:1px solid var(--border,#30363d);border-radius:6px;" title="${esc(r.tooltip)}">
            <span style="font-size:13px;">${r.label}</span>
            <span style="font-weight:700;font-size:14px;">${r.value}</span>
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
