// shared/js/shell.js
// SHELL ÚNICO: topbar, bottom-nav, drawer, theme, DID status, shortcuts
// Delegado a submódulos: profile, notifications, moderation, creds, siwe

import { loadTheme, toggleTheme, shortAddr } from "./core.js";
import { connectDid, clearDid, getDid, bindEthereumAccountsChanged } from "./wallet.js";
import { siweLogin, clearSiwe, verifyAndRestoreSession } from "./siwe.js";
import { syncProfile, buildProfileModal } from "./profile.js";
import { updateNotifUI, openNotifModal, closeModal, closeAllPanels, openModal, buildNotifModal } from "./notifications.js";
import { isModOrAdminNow, buildModModal } from "./moderation.js";

const ROUTES = [
  { key: "id",    label: "ID",    ico: "🪪", href: "/" },
  { key: "dao",   label: "DAO",   ico: "🏛️", href: "/dao/" },
  { key: "defi",  label: "DEFI",  ico: "🧩", href: "/defi/" },
  { key: "dex",   label: "DEX",   ico: "🔁", href: "/dex/" },
  { key: "ia",    label: "IA",    ico: "🤖", href: "#" },
  { key: "ar",    label: "AR",    ico: "🕶️", href: "#" }
];

function currentFolder() {
  const p = location.pathname.split("/").filter(Boolean);
  return p[0] || "id";
}

function el(t, a = {}, h = "") {
  const n = document.createElement(t);
  for (const [k, v] of Object.entries(a)) k === "class" ? n.className = v : n.setAttribute(k, v);
  if (h) n.innerHTML = h;
  return n;
}

function syncShellHeights() {
  const tb = document.getElementById("topbar");
  const nb = document.getElementById("bottomNav");
  const tbH = tb && tb.offsetHeight > 0 ? tb.offsetHeight : 72;
  const nbH = nb && nb.offsetHeight > 0 ? nb.offsetHeight : 78;
  document.documentElement.style.setProperty("--app-topbar-h", tbH + "px");
  document.documentElement.style.setProperty("--app-bottomnav-h", nbH + "px");
  document.documentElement.style.setProperty("--topbar-h", tbH + "px");
}

export function mountShell() {
  if (window.__alemtyShellMounted) return;
  window.__alemtyShellMounted = true;

  loadTheme();
  requestAnimationFrame(() => document.documentElement.classList.add("theme-ready"));
  bindEthereumAccountsChanged();

  const hostKey = currentFolder();
  const topbar = document.getElementById("topbar");
  const navbar = document.getElementById("navbar");
  if (!topbar || !navbar) return;

  topbar.classList.add("topbar");
  navbar.classList.add("navbar");

  // ========== TOPBAR ==========
  const topInner = el("div", { class: "topbar-inner" });
  const brand = el("a", { class: "brand-link", href: "/", "aria-label": "Ir a ID" },
    `<span class="brand">alemty<span class="dot">.</span><span class="eth">eth</span></span>`);

  const icons = el("div", { class: "iconbar" });
  const themeBtn = el("button", { class: "icon-btn", id: "themeBtn", type: "button", "aria-label": "Tema" }, "🌘");
  const profileBtn = el("button", { class: "icon-btn", id: "profileBtn", type: "button", "aria-label": "Perfil" }, "🧙🏻");
  const notifBtn = el("button", { class: "icon-btn", id: "notifBtn", type: "button", "aria-label": "Notificaciones" },
    `🔔<span class="badge" id="notifBadge" hidden>0</span>`);
  const menuBtn = el("button", { class: "icon-btn", id: "menuBtn", type: "button", "aria-label": "Menú" }, "☰");

  icons.append(themeBtn, profileBtn, notifBtn, menuBtn);
  topInner.append(brand, icons);
  topbar.innerHTML = "";
  topbar.append(topInner);
  navbar.innerHTML = "";

  // ========== BOTTOM NAV ==========
  const bottomNav = el("nav", { class: "bottom-nav", id: "bottomNav" });
  const bottomInner = el("div", { class: "bottom-nav-inner" });
  ROUTES.forEach(r => {
    const a = el("a", { class: "bottom-btn", href: r.href, "data-key": r.key, "aria-label": r.key },
      `<span class="ico">${r.ico}</span><span class="lbl">${r.label}</span>`);
    if (r.key === hostKey) a.classList.add("active");
    bottomInner.appendChild(a);
  });
  bottomNav.appendChild(bottomInner);
  document.getElementById("bottomNav")?.remove();
  document.body.appendChild(bottomNav);

  // ========== SYNC HEIGHTS ==========
  [0, 50, 120, 300].forEach(ms => setTimeout(syncShellHeights, ms));
  window.addEventListener("resize", syncShellHeights);

  // ========== DRAWER ==========
  const drawerBackdrop = el("div", { class: "drawer-backdrop", id: "drawerBackdrop" });
  const drawer = el("aside", { class: "drawer", id: "drawer", "aria-hidden": "true" });

  drawer.innerHTML = `
    <div class="drawer-head">
      <strong class="code">Menú</strong>
      <button class="icon-btn" id="drawerClose" type="button" aria-label="Cerrar">✕</button>
    </div>
    <div class="drawer-body">

      <!-- Identidad DID -->
      <div class="acc open" data-acc="did">
        <button class="acc-h" type="button" data-open="did" aria-expanded="true">
          <span>Identidad DID</span><span class="chev">▾</span>
        </button>
        <div class="acc-p" id="accDid">
          <div class="did-mini">
            <div class="did-mini-row"><span class="k">Estado:</span><span class="v code" id="didStatus">Desconectado</span></div>
            <div class="did-mini-row"><span class="k">DID - SIWE:</span><span class="v code" id="siweStatus">⚠️ DID-SIWE</span></div>
            <span class="v code" id="didAddress" hidden>—</span>
          </div>
          <div class="did-actions grid2">
            <button class="drawer-link did-blue" id="connectBtn" type="button">🦊 Iniciar Sesión</button>
            <a class="drawer-link did-blue" id="registerBtn"
              href="https://chromewebstore.google.com/detail/metamask/nkbihfbeogaeaoehlefnkodbefgpgknn?hl=es"
              target="_blank" rel="noopener noreferrer">🦊 Registrarse</a>
            <button class="drawer-link did-blue" id="siweBtn" type="button">✅ Firma SIWE</button>
            <button class="drawer-link did-blue" id="disconnectBtn" type="button">⛔ Cerrar Sesión</button>
          </div>
          <a class="drawer-link did-blue did-yt" id="tutorialLink" href="#" target="_blank" rel="noopener noreferrer">
            <img class="yt-ico" src="/assets/icons/youtube.svg" alt="" aria-hidden="true">
            Tutorial de registro en Metamask
          </a>
        </div>
      </div>

      <!-- Acerca de -->
      <div class="acc" data-acc="about">
        <button class="acc-h" type="button" data-open="about" aria-expanded="false">
          <span>Acerca de</span><span class="chev">▾</span>
        </button>
        <div class="acc-p" id="accAbout">
          <div class="small muted" style="margin:0 0 10px;">Proyecto Web3 experimental. La DAO no es entidad legal; los tokens no son valores ni equity. Participación bajo propio riesgo.</div>
          <div class="small muted" style="margin:0 0 12px;">Derechos de autor / IP: salvo acuerdo explícito por escrito, la propiedad intelectual del proyecto pertenece al fundador.</div>
          <a class="drawer-link did-blue about-doc" href="https://github.com/Alemty/alemtyDAO/tree/main/docs" target="_blank" rel="noopener noreferrer">📚 Documentación oficial</a>
        </div>
      </div>
    </div>`;

  document.body.append(drawerBackdrop, drawer);

  // ========== DRAWER LOGIC ==========
  function openDrawer() { drawer.classList.add("open"); drawer.setAttribute("aria-hidden", "false"); drawerBackdrop.classList.add("show"); }
  function closeDrawer() { drawer.classList.remove("open"); drawer.setAttribute("aria-hidden", "true"); drawerBackdrop.classList.remove("show"); }

  function openAcc(which) {
    drawer.querySelectorAll(".acc").forEach(s => {
      const id = s.getAttribute("data-acc");
      const open = id === which;
      s.classList.toggle("open", open);
      const h = s.querySelector(".acc-h");
      h && h.setAttribute("aria-expanded", open ? "true" : "false");
    });
  }

  drawer.querySelectorAll(".acc-h").forEach(btn => btn.addEventListener("click", () => openAcc(btn.getAttribute("data-open"))));

  themeBtn.addEventListener("click", toggleTheme);
  menuBtn.addEventListener("click", () => {
    const d = document.getElementById("drawer");
    const wasOpen = !!d && d.classList.contains("open");
    closeAllPanels();
    if (wasOpen) return;
    openDrawer();
  });

  drawer.querySelector("#drawerClose")?.addEventListener("click", closeDrawer);
  drawerBackdrop.addEventListener("click", closeDrawer);
  document.addEventListener("keydown", e => {
    if (e.key !== "Escape") return;
    drawer.classList.contains("open") && closeDrawer();
    ["profileModal", "notifModal", "modModal"].forEach(id => {
      const m = document.getElementById(id);
      m && m.classList.contains("open") && closeModal(id);
    });
  });

  // ========== DID STATUS SYNC ==========
  const didStatus = drawer.querySelector("#didStatus");
  const didAddress = drawer.querySelector("#didAddress");

  function shortHex(addr, start = 6, end = 4) {
    if (!addr || typeof addr !== 'string') return '—';
    if (addr.length <= start + end) return addr;
    return `${addr.slice(0, start)}…${addr.slice(-end)}`;
  }

  function syncDid() {
    const a = getDid();
    didStatus.textContent = a ? `Conectado: ${shortHex(a)}` : 'Desconectado';
    const didAddressEl = drawer.querySelector("#didAddress");
    if (didAddressEl) {
      if (a) { didAddressEl.textContent = a; didAddressEl.title = a; }
      else { didAddressEl.textContent = "—"; didAddressEl.removeAttribute("title"); }
    }
    updateSiweStatus();
  }

  function updateSiweStatus() {
    const el = document.getElementById("siweStatus");
    if (!el) return;
    const did = (getDid() || "").toLowerCase();
    const siweOk = localStorage.getItem("alemty.siwe") === "ok";
    const ok = !!did && siweOk;
    el.textContent = ok ? "✅ DID-SIWE" : "⚠️ DID-SIWE";
    el.classList.toggle("ok", ok);
    el.classList.toggle("warn", !ok);
  }

  drawer.querySelector("#connectBtn")?.addEventListener("click", async () => { try { await connectDid(); } catch {} syncDid(); });
  drawer.querySelector("#disconnectBtn")?.addEventListener("click", () => { clearDid(); clearSiwe(); syncDid(); });
  drawer.querySelector("#siweBtn")?.addEventListener("click", async () => { await siweLogin(); syncDid(); });

  window.addEventListener("did:changed", syncDid);
  window.addEventListener("did:changed", async () => { await updateNotifUI(); });
  syncDid();

  // ========== RESTORE SESSION FROM BACKEND ==========
  verifyAndRestoreSession().then(() => {
    syncDid();
    syncProfile();
    void updateNotifUI();
  });

  // ========== PROFILE MODAL ==========
  document.getElementById("profileModal")?.remove();
  const profileModal = buildProfileModal();
  document.body.appendChild(profileModal);

  profileModal.querySelector("#profileClose")?.addEventListener("click", () => closeModal("profileModal"));
  profileModal.querySelector("#profileBackdrop")?.addEventListener("click", () => closeModal("profileModal"));

  profileModal.querySelectorAll("#pfTabs .tab-btn").forEach(b =>
    b.addEventListener("click", async () => {
      profileModal.querySelectorAll("#pfTabs .tab-btn").forEach(x => x.classList.remove("active"));
      b.classList.add("active");
      await syncProfile();
    })
  );

  profileBtn.addEventListener("click", async () => {
    const pm = document.getElementById("profileModal");
    const wasOpen = !!pm && pm.classList.contains("open");
    closeAllPanels();
    if (wasOpen) return;
    await syncProfile();
    openModal("profileModal");
  });

  window.addEventListener("did:changed", async () => { await syncProfile(); void updateNotifUI(); });

  // ========== NOTIFICATIONS MODAL ==========
  document.getElementById("notifModal")?.remove();
  const notifModal = buildNotifModal();
  document.body.appendChild(notifModal);
  notifModal.querySelector("#notifClose")?.addEventListener("click", () => closeModal("notifModal"));
  notifModal.querySelector("#notifBackdrop")?.addEventListener("click", () => closeModal("notifModal"));

  notifBtn.addEventListener("click", async () => {
    const nm = document.getElementById("notifModal");
    const wasOpen = !!nm && nm.classList.contains("open");
    closeAllPanels();
    if (wasOpen) return;
    await openNotifModal();
  });

  // ========== MODERATION MODAL ==========
  document.getElementById("modModal")?.remove();
  const modModal = buildModModal();
  document.body.appendChild(modModal);
  modModal.querySelector("#modClose")?.addEventListener("click", () => closeModal("modModal"));
  modModal.querySelector("#modBackdrop")?.addEventListener("click", () => closeModal("modModal"));

  // ========== INIT ==========
  syncProfile();
  void updateNotifUI();
}
