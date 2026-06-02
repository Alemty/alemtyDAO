// shared/js/i18n.js
// Sistema de internacionalización ES ↔ EN con persistencia y banderas

const LS_KEY = 'alemty.lang';
const FALLBACK = 'es';

// ===== DICCIONARIO =====
const DICT = {
  es: {
    // Shell / topbar / drawer
    'topbar.theme': 'Tema',
    'topbar.lang': 'Idioma',
    'topbar.profile': 'Perfil',
    'topbar.notifications': 'Notificaciones',
    'topbar.menu': 'Menú',

    'drawer.title': 'Menú',
    'drawer.close': 'Cerrar',
    'drawer.identity': 'Identidad DID',
    'drawer.status': 'Estado',
    'drawer.connected': 'Conectado',
    'drawer.disconnected': 'Desconectado',
    'drawer.didSiwe': 'DID – SIWE',
    'drawer.login': '🦊 Iniciar Sesión',
    'drawer.register': '🦊 Registrarse',
    'drawer.signSiwe': '✅ Firma SIWE',
    'drawer.logout': '⛔ Cerrar Sesión',
    'drawer.tutorial': 'Tutorial de registro en MetaMask',
    'drawer.services': 'Servicios',
    'drawer.servicesDesc': 'Consultora Web3 descentralizada — 6 agentes inteligentes al servicio del ecosistema.',
    'drawer.servicesViewAll': '📋 Ver todos los servicios',
    'drawer.about': 'Acerca de',
    'drawer.aboutDesc1': 'Proyecto Web3 experimental. La DAO no es entidad legal; los tokens no son valores ni equity. Participación bajo propio riesgo.',
    'drawer.aboutDesc2': 'Derechos de autor / IP: salvo acuerdo explícito por escrito, la propiedad intelectual del proyecto pertenece al fundador.',
    'drawer.aboutDocs': '📚 Documentación oficial',

    // Web3 disclaimer
    'disclaimer': '© alemty.eth · ENS · IPFS · Identidad Digital Descentralizada',

    // Services modal
    'services.title': 'Servicios de la DAO',
    'services.close': 'Cerrar',
    'services.header': 'Consultora Web3 descentralizada · alemty.eth · Productos y servicios del ecosistema',

    // Notifications
    'notif.title': 'Notificaciones',
    'notif.close': 'Cerrar',
    'notif.empty': 'No tienes notificaciones.',
    'notif.loading': 'Cargando…',

    // Profile modal
    'profile.title': 'Perfil',
    'profile.close': 'Cerrar',
    'profile.tab.rewards': 'Recompensas',
    'profile.tab.activity': 'Actividad',
    'profile.tab.dm': 'DM',
    'profile.rewards.total': 'Recompensas totales',
    'profile.rewards.aura': 'AURA en cadena',
    'profile.rewards.pending': 'Pendiente de minteo',
    'profile.rewards.claimed': 'Reclamado',
    'profile.rewards.reclaim': 'Reclamar AURA',
    'profile.rewards.reclaiming': 'Reclamando…',
    'profile.rewards.reclaimed': '¡AURA reclamada con éxito!',
    'profile.dm.placeholder': 'Selecciona una conversación',
    'profile.dm.new': 'Nueva conversación',
    'profile.dm.search': 'Buscar…',
    'profile.dm.send': 'Enviar',
    'profile.dm.cancel': 'Cancelar',
    'profile.dm.inputPlaceholder': 'Escribe un mensaje…',
    'profile.dm.start': 'Iniciar conversación',

    // Moderation
    'mod.title': 'Moderación',
    'mod.close': 'Cerrar',

    // ID page
    'id.kicker': 'Escuela de Ciencia · Filosofía · Gnosis · Web3.0',
    'id.heading': 'Consultora Web Espacial',
    'id.subtitle': 'DID – DAO – DEFI – DEX – IA – AR',
    'id.copy': 'Copiar',
    'id.copied': '¡Copiado!',
    'id.credentials': '🏅 Credenciales',
    'id.creds.title': 'Mis Credenciales',
    'id.creds.close': 'Cerrar',
    'id.book.badge': 'NUEVO · Libro',
    'id.book.title': 'La Simulación del Dragón',
    'id.book.desc': 'Descarga gratuita directa desde IPFS.',
    'id.book.note': 'Comprar será una forma opcional de apoyar el trabajo.',
    'id.book.download': 'Descargar PDF',
    'id.book.buy': 'Comprar',
    'id.book.buySub': 'Amazon',
    'id.follow': 'Sígueme',

    // DAO page
    'dao.title': 'ORGANIZACIÓN AUTÓNOMA DESCENTRALIZADA',
    'dao.brand': 'dao.alemty.eth',
    'dao.proposals': 'Propuestas',
    'dao.proposal.new': 'Nueva propuesta',
    'dao.proposal.vote': 'Votar',
    'dao.proposal.closed': 'Cerrada',
    'dao.proposal.active': 'Activa',
    'dao.proposal.pending': 'Pendiente',
    'dao.forum': 'Foro descentralizado web3.0 · Inicia sesión SIWE con MetaMask para participar.',
    'dao.tab.relevant': 'Relevantes',
    'dao.tab.recent': 'Recientes',
    'dao.tab.week': 'Top Semana',
    'dao.tab.month': 'Top Mes',
    'dao.panel.relevantDesc': 'Últimos posts más relevantes',
    'dao.panel.recentDesc': 'Últimos posts del foro',
    'dao.panel.weekDesc': 'Los mejores posts de la semana',
    'dao.panel.monthDesc': 'Los mejores posts del mes',
    'dao.backrooms': 'Backrooms',
    'dao.topics': 'Temas',
    'dao.members': 'Miembros',
    'dao.treasury': 'Tesorería',
    'dao.governance': 'Gobernanza',

    // DEFI page
    'defi.title': 'TERMINAL DE TRADING',
    'defi.brand': 'defi.alemty.eth',
    'defi.chart': 'Gráfico',
    'defi.swap': 'Intercambiar',
    'defi.pool': 'Pool',
    'defi.balance': 'Balance',
    'defi.connect': 'Conectar wallet',

    // DEX page
    'dex.title': 'INTERCAMBIADOR DESCENTRALIZADO',
    'dex.brand': 'dex.alemty.eth',
    'dex.swap': 'Swap',
    'dex.swapDesc': 'Interno (Aura/ALEM) o Externo (ALEM/ETH en BASE).',
    'dex.swapMode': 'Modo Swap',
    'dex.internal': 'Interno',
    'dex.external': 'Externo',
    'dex.pool': 'Pool',
    'dex.liquidity': 'Liquidez',
    'dex.from': 'De',
    'dex.to': 'A',
    'dex.flip': 'Invertir',
    'dex.balance': 'Balance',
    'dex.connect': 'Conectar wallet',

    // IA page
    'ia.title': 'INTELIGENCIA ARTIFICIAL',
    'ia.brand': 'ia.alemty.eth',
    'ia.subtitle': '🤖 Centro de Control — Agentes, Automatizaciones, Foro, DEX, DEFI',
    'ia.agentsTitle': '🤖 Agentes Inteligentes',
    'ia.activity': '📋 Actividad Reciente',
    'ia.realtime': 'Tiempo real',
    'ia.agents': 'Agentes',
    'ia.console': 'Consola',
    'ia.chat': 'Chat',
    'ia.send': 'Enviar',
    'ia.input': 'Escribe un mensaje…',

    // AR page
    'ar.title': 'REALIDAD AUMENTADA',
    'ar.brand': 'ar.alemty.eth',
    'ar.desc': 'Módulo de Realidad Aumentada. Identidad, símbolos y capas espaciales.',
    'ar.spaces': 'Espacios',
    'ar.spacesDesc': 'Anclaje de identidades, símbolos y objetos AR en ubicaciones reales.',
    'ar.exploreSpaces': 'Explorar espacios',
    'ar.layers': 'Capas',
    'ar.layersDesc': 'Capas narrativas, rituales o informativas sobre el entorno.',
    'ar.exploreLayers': 'Explorar capas',
    'ar.statusTitle': 'Estado del módulo',
    'ar.statusDesc': 'El módulo AR se encuentra en fase conceptual. Integrará ENS, agentes IA y coordenadas espaciales.',
    'ar.footer': 'Módulo AR · alemty.eth',
    'ar.parcels': 'Parcelas',
    'ar.scenes': 'Escenas',
    'ar.quests': 'Misiones',
    'ar.explore': 'Explorar',

    // Common
    'common.loading': 'Cargando…',
    'common.error': 'Error',
    'common.save': 'Guardar',
    'common.cancel': 'Cancelar',
    'common.confirm': 'Confirmar',
    'common.close': 'Cerrar',
    'common.back': 'Volver',
    'common.more': 'Ver más',
    'common.retry': 'Reintentar',
    'common.noData': 'Sin datos',
  },

  en: {
    'topbar.theme': 'Theme',
    'topbar.lang': 'Language',
    'topbar.profile': 'Profile',
    'topbar.notifications': 'Notifications',
    'topbar.menu': 'Menu',

    'drawer.title': 'Menu',
    'drawer.close': 'Close',
    'drawer.identity': 'DID Identity',
    'drawer.status': 'Status',
    'drawer.connected': 'Connected',
    'drawer.disconnected': 'Disconnected',
    'drawer.didSiwe': 'DID – SIWE',
    'drawer.login': '🦊 Sign In',
    'drawer.register': '🦊 Register',
    'drawer.signSiwe': '✅ Sign SIWE',
    'drawer.logout': '⛔ Sign Out',
    'drawer.tutorial': 'MetaMask registration tutorial',
    'drawer.services': 'Services',
    'drawer.servicesDesc': 'Decentralized Web3 consultancy — 6 intelligent agents serving the ecosystem.',
    'drawer.servicesViewAll': '📋 View all services',
    'drawer.about': 'About',
    'drawer.aboutDesc1': 'Experimental Web3 project. The DAO is not a legal entity; tokens are not securities or equity. Participation at your own risk.',
    'drawer.aboutDesc2': 'Copyright / IP: unless otherwise agreed in writing, the intellectual property of the project belongs to the founder.',
    'drawer.aboutDocs': '📚 Official documentation',

    'disclaimer': '© alemty.eth · ENS · IPFS · Decentralized Digital Identity',

    'services.title': 'DAO Services',
    'services.close': 'Close',
    'services.header': 'Decentralized Web3 consultancy · alemty.eth · Ecosystem products & services',

    'notif.title': 'Notifications',
    'notif.close': 'Close',
    'notif.empty': 'You have no notifications.',
    'notif.loading': 'Loading…',

    'profile.title': 'Profile',
    'profile.close': 'Close',
    'profile.tab.rewards': 'Rewards',
    'profile.tab.activity': 'Activity',
    'profile.tab.dm': 'DM',
    'profile.rewards.total': 'Total rewards',
    'profile.rewards.aura': 'On-chain AURA',
    'profile.rewards.pending': 'Pending mint',
    'profile.rewards.claimed': 'Claimed',
    'profile.rewards.reclaim': 'Reclaim AURA',
    'profile.rewards.reclaiming': 'Reclaiming…',
    'profile.rewards.reclaimed': 'AURA reclaimed successfully!',
    'profile.dm.placeholder': 'Select a conversation',
    'profile.dm.new': 'New conversation',
    'profile.dm.search': 'Search…',
    'profile.dm.send': 'Send',
    'profile.dm.cancel': 'Cancel',
    'profile.dm.inputPlaceholder': 'Type a message…',
    'profile.dm.start': 'Start conversation',

    'mod.title': 'Moderation',
    'mod.close': 'Close',

    'id.kicker': 'School of Science · Philosophy · Gnosis · Web3.0',
    'id.heading': 'Space Web Consultancy',
    'id.subtitle': 'DID – DAO – DEFI – DEX – IA – AR',
    'id.copy': 'Copy',
    'id.copied': 'Copied!',
    'id.credentials': '🏅 Credentials',
    'id.creds.title': 'My Credentials',
    'id.creds.close': 'Close',
    'id.book.badge': 'NEW · Book',
    'id.book.title': 'The Dragon Simulation',
    'id.book.desc': 'Free download directly from IPFS.',
    'id.book.note': 'Buying is an optional way to support the work.',
    'id.book.download': 'Download PDF',
    'id.book.buy': 'Buy',
    'id.book.buySub': 'Amazon',
    'id.follow': 'Follow me',

    'dao.title': 'DECENTRALIZED AUTONOMOUS ORGANIZATION',
    'dao.brand': 'dao.alemty.eth',
    'dao.proposals': 'Proposals',
    'dao.proposal.new': 'New proposal',
    'dao.proposal.vote': 'Vote',
    'dao.proposal.closed': 'Closed',
    'dao.proposal.active': 'Active',
    'dao.proposal.pending': 'Pending',
    'dao.forum': 'Decentralized web3.0 forum · Sign in with SIWE & MetaMask to participate.',
    'dao.tab.relevant': 'Relevant',
    'dao.tab.recent': 'Recent',
    'dao.tab.week': 'Top Week',
    'dao.tab.month': 'Top Month',
    'dao.panel.relevantDesc': 'Latest relevant posts',
    'dao.panel.recentDesc': 'Latest forum posts',
    'dao.panel.weekDesc': 'Best posts of the week',
    'dao.panel.monthDesc': 'Best posts of the month',
    'dao.backrooms': 'Backrooms',
    'dao.topics': 'Topics',
    'dao.members': 'Members',
    'dao.treasury': 'Treasury',
    'dao.governance': 'Governance',

    'defi.title': 'TRADING TERMINAL',
    'defi.brand': 'defi.alemty.eth',
    'defi.chart': 'Chart',
    'defi.swap': 'Swap',
    'defi.pool': 'Pool',
    'defi.balance': 'Balance',
    'defi.connect': 'Connect wallet',

    'dex.title': 'DECENTRALIZED EXCHANGE',
    'dex.brand': 'dex.alemty.eth',
    'dex.swap': 'Swap',
    'dex.swapDesc': 'Internal (Aura/ALEM) or External (ALEM/ETH on BASE).',
    'dex.swapMode': 'Swap Mode',
    'dex.internal': 'Internal',
    'dex.external': 'External',
    'dex.pool': 'Pool',
    'dex.liquidity': 'Liquidity',
    'dex.from': 'From',
    'dex.to': 'To',
    'dex.flip': 'Invert',
    'dex.balance': 'Balance',
    'dex.connect': 'Connect wallet',

    'ia.title': 'ARTIFICIAL INTELLIGENCE',
    'ia.brand': 'ia.alemty.eth',
    'ia.subtitle': '🤖 Control Center — Agents, Automations, Forum, DEX, DEFI',
    'ia.agentsTitle': '🤖 Intelligent Agents',
    'ia.activity': '📋 Recent Activity',
    'ia.realtime': 'Real-time',
    'ia.agents': 'Agents',
    'ia.console': 'Console',
    'ia.chat': 'Chat',
    'ia.send': 'Send',
    'ia.input': 'Type a message…',

    'ar.title': 'AUGMENTED REALITY',
    'ar.brand': 'ar.alemty.eth',
    'ar.desc': 'Augmented Reality module. Identity, symbols and spatial layers.',
    'ar.spaces': 'Spaces',
    'ar.spacesDesc': 'Anchor identities, symbols and AR objects in real locations.',
    'ar.exploreSpaces': 'Explore spaces',
    'ar.layers': 'Layers',
    'ar.layersDesc': 'Narrative, ritual or informative layers over the environment.',
    'ar.exploreLayers': 'Explore layers',
    'ar.statusTitle': 'Module Status',
    'ar.statusDesc': 'The AR module is in conceptual phase. It will integrate ENS, AI agents and spatial coordinates.',
    'ar.footer': 'AR Module · alemty.eth',
    'ar.parcels': 'Parcels',
    'ar.scenes': 'Scenes',
    'ar.quests': 'Quests',
    'ar.explore': 'Explore',

    'common.loading': 'Loading…',
    'common.error': 'Error',
    'common.save': 'Save',
    'common.cancel': 'Cancel',
    'common.confirm': 'Confirm',
    'common.close': 'Close',
    'common.back': 'Back',
    'common.more': 'View more',
    'common.retry': 'Retry',
    'common.noData': 'No data',
  }
};

// ===== CURRENT LANG =====
let _current = null;

export function getLang() {
  if (!_current) {
    _current = localStorage.getItem(LS_KEY) || document.documentElement.lang || FALLBACK;
  }
  // Validate
  if (!DICT[_current]) _current = FALLBACK;
  return _current;
}

export function setLang(lang) {
  if (!DICT[lang]) return;
  _current = lang;
  localStorage.setItem(LS_KEY, lang);
  document.documentElement.lang = lang;
  document.title = getDocTitle(lang);
  emit('lang:changed', { lang });
  applyTranslations();
  updateLangBtnUI();
}

export function toggleLang() {
  const next = getLang() === 'es' ? 'en' : 'es';
  setLang(next);
  return next;
}

// ===== TRANSLATE =====
export function t(key, fallbackText) {
  const lang = getLang();
  return DICT[lang]?.[key] ?? fallbackText ?? key;
}

// ===== MASS TRANSLATE VIA data-i18n =====
export function applyTranslations(root = document) {
  // 1. Replace textContent for elements with data-i18n
  root.querySelectorAll('[data-i18n]').forEach(el => {
    const key = el.getAttribute('data-i18n');
    const text = t(key);
    if (text !== key) el.textContent = text;
  });

  // 2. Replace placeholder for elements with data-i18n-placeholder
  root.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
    const key = el.getAttribute('data-i18n-placeholder');
    el.placeholder = t(key);
  });

  // 3. Replace title for elements with data-i18n-title
  root.querySelectorAll('[data-i18n-title]').forEach(el => {
    const key = el.getAttribute('data-i18n-title');
    el.title = t(key);
  });

  // 4. Replace aria-label for elements with data-i18n-aria
  root.querySelectorAll('[data-i18n-aria]').forEach(el => {
    const key = el.getAttribute('data-i18n-aria');
    el.setAttribute('aria-label', t(key));
  });

  // 5. Replace value for input buttons
  root.querySelectorAll('[data-i18n-value]').forEach(el => {
    const key = el.getAttribute('data-i18n-value');
    el.value = t(key);
  });
}

// ===== DYNAMIC DOC TITLE =====
function getDocTitle(lang) {
  const path = location.pathname;
  if (path.startsWith('/dao/')) return t('dao.brand') || 'dao.alemty.eth';
  if (path.startsWith('/defi/')) return t('defi.brand') || 'defi.alemty.eth';
  if (path.startsWith('/dex/')) return t('dex.brand') || 'dex.alemty.eth';
  if (path.startsWith('/ia/')) return t('ia.brand') || 'ia.alemty.eth';
  if (path.startsWith('/ar/')) return t('ar.brand') || 'ar.alemty.eth';
  return 'alemty.eth';
}

// ===== FLAGS SVG (inline para evitar dependencia de emojis) =====
const FLAG_MX = `<svg viewBox="0 0 36 24" width="20" height="14" style="border-radius:2px;display:block;">
  <rect width="12" height="24" fill="#006847"/>
  <rect x="12" width="12" height="24" fill="#fff"/>
  <rect x="24" width="12" height="24" fill="#ce1126"/>
  <circle cx="18" cy="12" r="4" fill="#8b5e3c" opacity=".6"/>
</svg>`;

const FLAG_GB = `<svg viewBox="0 0 36 24" width="20" height="14" style="border-radius:2px;display:block;">
  <rect width="36" height="24" fill="#012169"/>
  <path d="M0 0l36 24M36 0L0 24" stroke="#fff" stroke-width="3"/>
  <path d="M0 0l36 24M36 0L0 24" stroke="#c8102e" stroke-width="1.5"/>
  <path d="M18 0v24M0 12h36" stroke="#fff" stroke-width="4"/>
  <path d="M18 0v24M0 12h36" stroke="#c8102e" stroke-width="2"/>
</svg>`;

// ===== SVG FLAG BUTTON =====
function flagSpan(lang) {
  const s = document.createElement('span');
  s.style.cssText = 'display:flex;align-items:center;justify-content:center;width:20px;height:14px;';
  s.innerHTML = lang === 'es' ? FLAG_MX : FLAG_GB;
  return s;
}

export function buildLangBtn() {
  const btn = document.createElement('button');
  btn.className = 'icon-btn lang-btn';
  btn.id = 'langBtn';
  btn.type = 'button';
  btn.setAttribute('aria-label', t('topbar.lang'));
  btn.title = getLang() === 'es' ? 'English' : 'Español';
  btn.appendChild(flagSpan(getLang()));
  btn.addEventListener('click', () => {
    toggleLang();
  });
  return btn;
}

function updateLangBtnUI() {
  const btn = document.getElementById('langBtn');
  if (!btn) return;
  const isEs = getLang() === 'es';
  btn.innerHTML = '';
  btn.appendChild(flagSpan(getLang()));
  btn.title = isEs ? 'English' : 'Español';
  btn.setAttribute('aria-label', t('topbar.lang'));
}

// ===== LISTEN FOR DOM CHANGES FOR DYNAMIC CONTENT =====
const _observer = new MutationObserver(mutations => {
  for (const m of mutations) {
    for (const node of m.addedNodes) {
      if (node.nodeType === 1 && node.querySelectorAll) {
        if (node.querySelector('[data-i18n], [data-i18n-placeholder], [data-i18n-title]')) {
          applyTranslations(node);
        }
      }
    }
  }
});

export function initI18n() {
  // Restore lang from localStorage or use the html lang attr
  const saved = localStorage.getItem(LS_KEY);
  const htmlLang = document.documentElement.lang || FALLBACK;
  _current = saved || htmlLang;
  if (!DICT[_current]) _current = FALLBACK;

  // Apply to document
  document.documentElement.lang = _current;
  document.title = getDocTitle(_current);
  applyTranslations();

  // Start observer for dynamic content
  _observer.observe(document.body, { childList: true, subtree: true });
}

// Need to import emit for the event
import { emit } from './events.js';
