// shared/js/shell.js
// SHELL ÚNICO: topbar, bottom-nav, drawer, theme, DID status, shortcuts
// Delegado a submódulos: profile, notifications, moderation, creds, siwe

import { loadTheme, toggleTheme, shortAddr } from "./core.js";
import { connectDid, clearDid, getDid, bindEthereumAccountsChanged } from "./wallet.js";
import { siweLogin, clearSiwe, verifyAndRestoreSession } from "./siwe.js";
import { syncProfile, buildProfileModal } from "./profile.js";
import { updateNotifUI, openNotifModal, closeModal, closeAllPanels, openModal, buildNotifModal } from "./notifications.js";
import { isModOrAdminNow, buildModModal } from "./moderation.js";
import { initI18n, buildLangBtn, toggleLang, getLang, t, applyTranslations } from "./i18n.js";

const ROUTES = [
  { key: "id",    label: "ID",    ico: "🪪", href: "/" },
  { key: "dao",   label: "DAO",   ico: "🏛️", href: "/dao/" },
  { key: "defi",  label: "DEFI",  ico: "🧩", href: "/defi/" },
  { key: "dex",   label: "DEX",   ico: "🔁", href: "/dex/" },
  { key: "ia",    label: "IA",    ico: "🤖", href: "/ia/" },
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
  initI18n();
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
  const brand = el("a", { class: "brand-link", href: "/", "aria-label": "alemty.eth" },
    `<span class="brand">alemty<span class="dot">.</span><span class="eth">eth</span></span>`);

  const icons = el("div", { class: "iconbar" });
  const themeBtn = el("button", { class: "icon-btn", id: "themeBtn", type: "button", "data-i18n-aria": "topbar.theme", "aria-label": t("topbar.theme") }, "🌘");
  const profileBtn = el("button", { class: "icon-btn", id: "profileBtn", type: "button", "data-i18n-aria": "topbar.profile", "aria-label": t("topbar.profile") }, "🧙🏻");
  const notifBtn = el("button", { class: "icon-btn", id: "notifBtn", type: "button", "data-i18n-aria": "topbar.notifications", "aria-label": t("topbar.notifications") },
    `🔔<span class="badge" id="notifBadge" hidden>0</span>`);
  const menuBtn = el("button", { class: "icon-btn", id: "menuBtn", type: "button", "data-i18n-aria": "topbar.menu", "aria-label": t("topbar.menu") }, "☰");

  const langBtn = buildLangBtn();
  icons.append(langBtn, themeBtn, profileBtn, notifBtn, menuBtn);
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
      <strong class="code" data-i18n="drawer.title">Menú</strong>
      <button class="icon-btn" id="drawerClose" type="button" data-i18n-aria="drawer.close" aria-label="Cerrar">✕</button>
    </div>
    <div class="drawer-body">

      <!-- Identidad DID -->
      <div class="acc open" data-acc="did">
        <button class="acc-h" type="button" data-open="did" aria-expanded="true">
          <span data-i18n="drawer.identity">Identidad DID</span><span class="chev">▾</span>
        </button>
        <div class="acc-p" id="accDid">
          <div class="did-mini">
            <div class="did-mini-row"><span class="k" data-i18n="drawer.status">Estado:</span><span class="v code" id="didStatus" data-i18n="drawer.disconnected">Desconectado</span></div>
            <div class="did-mini-row"><span class="k" data-i18n="drawer.didSiwe">DID – SIWE</span><span class="v code" id="siweStatus">⚠️ DID-SIWE</span></div>
            <span class="v code" id="didAddress" hidden>—</span>
          </div>
          <div class="did-actions grid2">
            <button class="drawer-link did-blue" id="connectBtn" type="button" data-i18n="drawer.login">🦊 Iniciar Sesión</button>
            <a class="drawer-link did-blue" id="registerBtn"
              href="https://chromewebstore.google.com/detail/metamask/nkbihfbeogaeaoehlefnkodbefgpgknn?hl=es"
              target="_blank" rel="noopener noreferrer" data-i18n="drawer.register">🦊 Registrarse</a>
            <button class="drawer-link did-blue" id="siweBtn" type="button" data-i18n="drawer.signSiwe">✅ Firma SIWE</button>
            <button class="drawer-link did-blue" id="disconnectBtn" type="button" data-i18n="drawer.logout">⛔ Cerrar Sesión</button>
          </div>
          <a class="drawer-link did-blue did-yt" id="tutorialLink" href="#" target="_blank" rel="noopener noreferrer" data-i18n="drawer.tutorial">
            <img class="yt-ico" src="/assets/icons/youtube.svg" alt="" aria-hidden="true">
            Tutorial de registro en Metamask
          </a>
        </div>
      </div>

      <!-- Servicios de la DAO -->
      <div class="acc" data-acc="services">
        <button class="acc-h" type="button" data-open="services" aria-expanded="false">
          <span data-i18n="drawer.services">Servicios</span><span class="chev">▾</span>
        </button>
        <div class="acc-p" id="accServices">
          <div class="small muted" style="margin:0 0 10px;" data-i18n="drawer.servicesDesc">Consultora Web3 descentralizada — 6 agentes inteligentes al servicio del ecosistema.</div>
          <button class="drawer-link did-blue" id="servicesModalBtn" type="button" data-i18n="drawer.servicesViewAll">📋 Ver todos los servicios</button>
        </div>
      </div>

      <!-- Acerca de -->
      <div class="acc" data-acc="about">
        <button class="acc-h" type="button" data-open="about" aria-expanded="false">
          <span data-i18n="drawer.about">Acerca de</span><span class="chev">▾</span>
        </button>
        <div class="acc-p" id="accAbout">
          <div class="small muted" style="margin:0 0 10px;" data-i18n="drawer.aboutDesc1">Proyecto Web3 experimental. La DAO no es entidad legal; los tokens no son valores ni equity. Participación bajo propio riesgo.</div>
          <div class="small muted" style="margin:0 0 12px;" data-i18n="drawer.aboutDesc2">Derechos de autor / IP: salvo acuerdo explícito por escrito, la propiedad intelectual del proyecto pertenece al fundador.</div>
          <a class="drawer-link did-blue about-doc" href="https://github.com/Alemty/alemtyDAO/tree/main/docs" target="_blank" rel="noopener noreferrer" data-i18n="drawer.aboutDocs">📚 Documentación oficial</a>
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
    const lang = getLang();
    const statusText = lang === 'en' ? 'Connected' : 'Conectado';
    const disconnectedText = lang === 'en' ? 'Disconnected' : 'Desconectado';
    didStatus.textContent = a ? `${statusText}: ${shortHex(a)}` : disconnectedText;
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
  window.addEventListener("lang:changed", () => {
    syncDid();
    applyTranslations();
    updateSiweStatus();
  });
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
    // Clic en botón propio → limpiar viewing y mostrar perfil propio
    localStorage.removeItem('alemty.profile.viewing');
    await syncProfile();
    openModal("profileModal");
  });

  // Exponer global para abrir perfil desde otros módulos (app.js, notifications.js)
  window.openProfileModal = async function openProfileModal(addr, tab) {
    // Guardar la dirección clickeada en localStorage temporal para syncProfile
    if (addr) {
      localStorage.setItem('alemty.profile.viewing', addr);
      // Guardar la dirección visitada para que DM la use
      localStorage.setItem('alemty.profile.viewingAddr', addr);
    }
    if (tab) localStorage.setItem('alemty.profile.defaultTab', tab);
    await syncProfile();
    openModal("profileModal");
  };

  // Al abrir perfil de otro usuario, activar pestaña DM automáticamente
  window.addEventListener('modal:opened', (e) => {
    if (e.detail?.modalId !== 'profileModal') return;
    const defaultTab = localStorage.getItem('alemty.profile.defaultTab') || '';
    localStorage.removeItem('alemty.profile.defaultTab');
    if (defaultTab) {
      setTimeout(() => {
        const btn = document.querySelector(`.tab-btn[data-tab="${defaultTab}"]`);
        if (btn) btn.click();
      }, 50);
    }
    // Limpiar la dirección visitada después de usarla
    setTimeout(() => localStorage.removeItem('alemty.profile.viewingAddr'), 100);
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

  // ========== SERVICES MODAL (HTML estático desde index.html) ==========
  const sm = document.getElementById("servicesModal");
  if (sm) {
    // Si el modal no está en el DOM, se crea vacío (fallback)
    if (!sm.parentNode) document.body.appendChild(sm);
  }

  document.getElementById("servicesModalBtn")?.addEventListener("click", () => {
    closeDrawer();
    openModal("servicesModal");
  });
  const sc = document.getElementById("servicesClose");
  if (sc) sc.addEventListener("click", () => closeModal("servicesModal"));
  const sb = document.getElementById("servicesBackdrop");
  if (sb) sb.addEventListener("click", () => closeModal("servicesModal"));

  // ========== INIT ==========
  syncProfile();
  void updateNotifUI();
}
