// =========================================================
// AR — Módulo de Realidad Aumentada · alemty.eth
// Mapamundi interactivo con OVRLands geolocalizados
// Fase 6: subdominio ar.alemty.eth + integración OVR
// =========================================================

import { loadTheme, shortAddr } from "/shared/js/core.js";
import { connectDid, clearDid, getDid, bindEthereumAccountsChanged } from "/shared/js/wallet.js";
import { siweLogin, clearSiwe, verifyAndRestoreSession } from "/shared/js/siwe.js";
import { mountShell } from "/shared/js/shell.js";

/* ===== CONSTANTES ===== */
const OVR_CONTRACT = "0x93c46aa4ddfd0413d95d0ef3c478982997ce9861";
const MONTERREY = { lat: 25.6866, lng: -100.3161, zoom: 14 };
const LEAFLET_CSS = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css";
const LEAFLET_JS = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.js";

/* ===== ESTADO GLOBAL ===== */
let map = null;
let markersLayer = null;
let heatLayer = null;
let allLands = [];
let currentFilter = "all";
let is3D = false;

/* ===== CARGA DE LEAFLET ===== */
function loadLeaflet(callback) {
  if (window.L) { callback(); return; }

  const link = document.createElement("link");
  link.rel = "stylesheet";
  link.href = LEAFLET_CSS;
  document.head.appendChild(link);

  const script = document.createElement("script");
  script.src = LEAFLET_JS;
  script.onload = callback;
  document.body.appendChild(script);
}

/* ===== INICIALIZAR MAPA ===== */
function initMap(landsData) {
  const mapContainer = document.getElementById("arMap");
  if (!mapContainer || map) return;

  allLands = landsData.lands || [];
  const center = landsData.center || MONTERREY;

  map = L.map("arMap", {
    center: [center.lat, center.lng],
    zoom: center.zoom || 14,
    zoomControl: false,
    attributionControl: false,
  });

  L.control.zoom({ position: "bottomright" }).addTo(map);
  L.control.attribution({ position: "bottomleft", prefix: false }).addTo(map);

  // Tile layers
  const osm = L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    maxZoom: 19,
    attribution: "© OpenStreetMap"
  }).addTo(map);

  const dark = L.tileLayer("https://tiles.stadiamaps.com/tiles/alidade_smooth_dark/{z}/{x}/{y}{r}.png", {
    maxZoom: 20,
    attribution: "© Stadia Maps, © OpenMapTiles, © OpenStreetMap"
  });

  const satellite = L.tileLayer("https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}", {
    maxZoom: 19,
    attribution: "© Esri, Maxar, Earthstar Geographics"
  });

  // Layer control
  const baseMaps = {
    "🌙 Dark": dark,
    "🌍 Street": osm,
    "🛰️ Satellite": satellite
  };

  // Use dark if theme is dark
  const isDark = document.documentElement.classList.contains("light") === false;
  if (isDark) map.removeLayer(osm);
  if (isDark) dark.addTo(map);

  L.control.layers(baseMaps, null, { position: "topleft" }).addTo(map);

  // Markers layer
  markersLayer = L.layerGroup().addTo(map);

  // Add lands
  addLandsToMap(allLands);

  // Fit bounds
  if (allLands.length > 0) {
    const bounds = allLands.map(l => [l.lat, l.lng]);
    if (bounds.length > 1) map.fitBounds(bounds, { padding: [30, 30] });
  }

  // Listen for filter changes
  document.querySelectorAll("[data-filter]").forEach(btn => {
    btn.addEventListener("click", () => {
      document.querySelectorAll("[data-filter]").forEach(b => b.classList.remove("active"));
      btn.classList.add("active");
      currentFilter = btn.dataset.filter;
      filterLands();
    });
  });

  // Update map size on shell height changes
  setTimeout(() => map.invalidateSize(), 200);
  setTimeout(() => map.invalidateSize(), 600);
}

/* ===== AÑADIR LANDS AL MAPA ===== */
function addLandsToMap(lands) {
  markersLayer.clearLayers();

  lands.forEach(land => {
    const color = getLandColor(land);
    const size = getLandSize(land);

    const marker = L.circleMarker([land.lat, land.lng], {
      radius: size,
      color: color,
      fillColor: color,
      fillOpacity: 0.7,
      weight: 2,
      opacity: 0.9,
    });

    // Pulse animation class
    const el = marker.getElement();
    if (el) {
      el.classList.add("ovr-pulse");
      el.style.setProperty("--pulse-color", color);
    }

    marker.bindTooltip(land.label || `OVR Land #${land.id.slice(-6)}`, {
      direction: "top",
      offset: [0, -size - 2],
      className: "ovr-tooltip"
    });

    marker.bindPopup(`
      <div class="ovr-popup">
        <div class="ovr-popup-head">
          <span class="ovr-popup-icon">🕶️</span>
          <strong>${land.label || `OVR Land #${land.id.slice(-6)}`}</strong>
        </div>
        <div class="ovr-popup-body">
          <div class="ovr-popup-row"><span class="k">Token ID</span><span class="v code">${land.id}</span></div>
          <div class="ovr-popup-row"><span class="k">Latitud</span><span class="v">${land.lat}°</span></div>
          <div class="ovr-popup-row"><span class="k">Longitud</span><span class="v">${land.lng}°</span></div>
          <div class="ovr-popup-row"><span class="k">Contrato</span><span class="v code">${shortAddr(OVR_CONTRACT)}</span></div>
        </div>
        <div class="ovr-popup-actions">
          <a class="btn btn-sm" href="https://ovr.ai/land/${land.id}" target="_blank" rel="noopener">🌐 Ver en OVR</a>
          <a class="btn btn-sm" href="https://basescan.org/token/${OVR_CONTRACT}?a=${land.id}" target="_blank" rel="noopener">🔍 Basescan</a>
        </div>
      </div>
    `);

    markersLayer.addLayer(marker);
  });

  updateStats(lands);
}

/* ===== COLOR Y TAMAÑO DE LOS LANDS ===== */
function getLandColor(land) {
  // Deterministic color based on token ID
  const h = [...land.id].reduce((a, c) => ((a << 5) - a) + c.charCodeAt(0), 0);
  const hue = Math.abs(h) % 360;
  return `hsl(${hue}, 85%, 55%)`;
}

function getLandSize(land) {
  // Size varies between 5-12 based on token ID
  const h = [...land.id].reduce((a, c) => ((a << 5) - a) + c.charCodeAt(0), 0);
  return 5 + (Math.abs(h) % 8);
}

/* ===== FILTRAR LANDS ===== */
function filterLands() {
  let filtered = allLands;
  if (currentFilter === "all") {
    // show all
  } else if (currentFilter === "cluster") {
    // Group by proximity: show as heatmap-style clusters
  }
  addLandsToMap(filtered);
}

/* ===== ESTADÍSTICAS ===== */
function updateStats(lands) {
  document.getElementById("landCount").textContent = lands.length;
  const lats = lands.map(l => l.lat);
  const lngs = lands.map(l => l.lng);
  const minLat = Math.min(...lats).toFixed(4);
  const maxLat = Math.max(...lats).toFixed(4);
  const minLng = Math.min(...lngs).toFixed(4);
  const maxLng = Math.max(...lngs).toFixed(4);
  const area = ((maxLat - minLat) * 111).toFixed(1) + "×" + ((maxLng - minLng) * 96).toFixed(1) + " km²";
  document.getElementById("landArea").textContent = area;
  document.getElementById("landBounds").textContent = `${minLat}°–${maxLat}°, ${minLng}°–${maxLng}°`;
}

/* ===== CARGAR DATOS ===== */
async function loadLands() {
  try {
    const res = await fetch("/ar/assets/ovr-lands.json");
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    loadLeaflet(() => initMap(data));
  } catch (err) {
    console.error("❌ Error cargando OVRLands:", err);
    document.getElementById("arMap").innerHTML = `
      <div class="card" style="text-align:center;padding:40px;">
        <div class="h2">⚠️ No se pudieron cargar los datos</div>
        <p class="muted">${err.message}</p>
        <button class="btn" onclick="location.reload()">Reintentar</button>
      </div>
    `;
  }
}

/* ===== UI HELPERS ===== */
function openSection(section) {
  const modal = document.getElementById("arModal");
  const title = document.getElementById("arModalTitle");
  const body = document.getElementById("arModalBody");
  if (!modal || !title || !body) return;

  const sections = {
    spaces: {
      title: "🌍 Espacios AR",
      html: `
        <div class="card" style="padding:16px;">
          <p>Los <strong>OVRLands</strong> son parcelas de realidad aumentada ancladas a coordenadas geográficas reales.</p>
          <p class="small muted" style="margin-top:8px;">
            Cada punto en el mapa representa un OVRLand que pertenece a alemtyDAO.
            Los lands están ubicados en la zona metropolitana de Monterrey, NL.
          </p>
          <p class="small muted">
            Estos espacios pueden alojar experiencias AR persistentes: NFTs espaciales,
            símbolos de identidad, agentes IA geolocalizados y capas narrativas.
          </p>
        </div>
        <div class="card" style="padding:16px;margin-top:12px;">
          <div class="h3">Estadísticas</div>
          <div class="grid2" style="margin-top:8px;">
            <div><span class="k">Total Lands</span><br><span class="v big" id="landCount">—</span></div>
            <div><span class="k">Área aproximada</span><br><span class="v" id="landArea">—</span></div>
            <div><span class="k">Extensión</span><br><span class="v small" id="landBounds">—</span></div>
            <div><span class="k">Contrato</span><br><span class="v code small">${shortAddr(OVR_CONTRACT)}</span></div>
          </div>
        </div>
        <div class="card" style="padding:16px;margin-top:12px;">
          <div class="h3">Acciones</div>
          <div class="grid2" style="margin-top:8px;">
            <a class="btn" href="https://ovr.ai" target="_blank">🌐 OVR Platform</a>
            <a class="btn" href="https://basescan.org/address/${OVR_CONTRACT}" target="_blank">📜 Contrato</a>
          </div>
        </div>
      `
    },
    layers: {
      title: "🧅 Capas AR",
      html: `
        <div class="card" style="padding:16px;">
          <p>Las <strong>capas AR</strong> son superposiciones narrativas sobre el espacio físico.</p>
          <p class="small muted" style="margin-top:8px;">
            Próximamente: integración con agentes IA para crear capas dinámicas
            que reaccionan a la identidad del visitante, su DID y su historial en la DAO.
          </p>
          <div class="grid2" style="margin-top:12px;">
            <div class="card" style="padding:12px;text-align:center;">
              <div style="font-size:28px;">🧙🏻</div>
              <div class="small">Capas de Identidad</div>
            </div>
            <div class="card" style="padding:12px;text-align:center;">
              <div style="font-size:28px;">📜</div>
              <div class="small">Capas de Historia</div>
            </div>
            <div class="card" style="padding:12px;text-align:center;">
              <div style="font-size:28px;">🤖</div>
              <div class="small">Capas IA</div>
            </div>
            <div class="card" style="padding:12px;text-align:center;">
              <div style="font-size:28px;">🎮</div>
              <div class="small">Capas de Juego</div>
            </div>
          </div>
        </div>
        <div class="card" style="padding:16px;margin-top:12px;">
          <p class="small muted">⚡ Las capas AR estarán disponibles en una actualización posterior.</p>
        </div>
      `
    },
    status: {
      title: "📡 Estado del Módulo",
      html: `
        <div class="card" style="padding:16px;">
          <div class="h3">Fase 6 — AR · alemy.eth</div>
          <div class="grid2" style="margin-top:8px;">
            <div><span class="k">Subdominio</span><br><span class="v">ar.alemty.eth ✅</span></div>
            <div><span class="k">OVRLands</span><br><span class="v" id="landCount2">—</span></div>
            <div><span class="k">Mapa interactivo</span><br><span class="v">Leaflet 🗺️</span></div>
            <div><span class="k">Capas AR</span><br><span class="v muted">En desarrollo ⏳</span></div>
          </div>
          <div style="margin-top:12px;">
            <p class="small muted">
              Este módulo integra los 198 OVRLands de alemtyDAO en un mapa global.
              Los lands están geolocalizados en la zona metropolitana de Monterrey, NL.
            </p>
          </div>
        </div>
        <div class="card" style="padding:16px;margin-top:12px;">
          <div class="h3">Roadmap</div>
          <div style="margin-top:8px;">
            <div>✅ Fase 6.1 — Subdominio ar.alemty.eth</div>
            <div>✅ Fase 6.2 — Mapa interactivo con OVRLands</div>
            <div>⏳ Fase 6.3 — Capas AR dinámicas</div>
            <div>⏳ Fase 6.4 — Agentes IA geolocalizados</div>
            <div>⏳ Fase 6.5 — Integración DID + SIWE</div>
          </div>
        </div>
      `
    }
  };

  const s = sections[section];
  if (s) {
    title.textContent = s.title;
    body.innerHTML = s.html;
    modal.setAttribute("aria-hidden", "false");
    modal.classList.add("open");

    // Update stats if modal opened for spaces or status
    if (section === "spaces" || section === "status") {
      document.getElementById("landCount") && (document.getElementById("landCount").textContent = allLands.length || "—");
      document.getElementById("landCount2") && (document.getElementById("landCount2").textContent = allLands.length || "—");
    }
  }
}

function closeModal() {
  const modal = document.getElementById("arModal");
  if (modal) {
    modal.setAttribute("aria-hidden", "true");
    modal.classList.remove("open");
  }
}

/* ===== WALLET / DID STATUS ===== */
function updateWalletUI(address) {
  const statusEl = document.getElementById("arDidStatus");
  if (!statusEl) return;
  if (address) {
    statusEl.textContent = `✅ ${shortAddr(address)}`;
    statusEl.className = "v code connected";
  } else {
    statusEl.textContent = "🔴 Desconectado";
    statusEl.className = "v code";
  }
}

/* ===== INIT ===== */
document.addEventListener("DOMContentLoaded", () => {
  // Cargar shell
  mountShell();

  // Inicializar módulo AR
  loadLands();

  // Click handlers for cards
  document.querySelectorAll(".card.clickable").forEach(card => {
    card.addEventListener("click", () => {
      const section = card.dataset.open;
      if (section) openSection(section);
    });
  });

  // Modal close handlers
  document.querySelectorAll("[data-close='arModal']").forEach(el => {
    el.addEventListener("click", closeModal);
  });

  // Close on backdrop click
  document.querySelector(".modal-backdrop")?.addEventListener("click", closeModal);

  // ESC key
  document.addEventListener("keydown", e => {
    if (e.key === "Escape") closeModal();
  });
});
