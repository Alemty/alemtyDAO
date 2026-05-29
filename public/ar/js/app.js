// =========================================================
// ar.alemty.eth — Mapamundi OVRLands interactivo
// Fase 6: Realidad Aumentada Descentralizada
// =========================================================

import { loadTheme, shortAddr } from "/shared/js/core.js";
import { connectDid, clearDid, getDid, bindEthereumAccountsChanged } from "/shared/js/wallet.js";
import { siweLogin, clearSiwe, verifyAndRestoreSession } from "/shared/js/siwe.js";
import { mountShell } from "/shared/js/shell.js";

/* ===== CONSTANTES ===== */
const OVR_CONTRACT = "0x93c46aa4ddfd0413d95d0ef3c478982997ce9861";
const LEAFLET_CSS = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css";
const LEAFLET_JS = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.js";

/* ===== ESTADO ===== */
let map = null;
let markersLayer = null;
let allLands = [];

/* ===== CARGA LEAFLET ===== */
function loadLeaflet(cb) {
  if (window.L) { cb(); return; }
  const link = document.createElement("link");
  link.rel = "stylesheet"; link.href = LEAFLET_CSS;
  document.head.appendChild(link);
  const s = document.createElement("script");
  s.src = LEAFLET_JS; s.onload = cb;
  document.body.appendChild(s);
}

/* ===== INICIALIZAR MAPA ===== */
function initMap(data) {
  const container = document.getElementById("arMap");
  if (!container || map) return;

  allLands = data.lands || [];
  const center = data.center || { lat: 25.6866, lng: -100.3161 };

  map = L.map("arMap", {
    center: [center.lat, center.lng],
    zoom: 15,
    zoomControl: false,
    attributionControl: false,
  });

  L.control.zoom({ position: "bottomright" }).addTo(map);
  L.control.attribution({ position: "bottomleft", prefix: false }).addTo(map);

  const osm = L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    maxZoom: 19, attribution: "© OpenStreetMap"
  });

  const dark = L.tileLayer("https://tiles.stadiamaps.com/tiles/alidade_smooth_dark/{z}/{x}/{y}{r}.png", {
    maxZoom: 20, attribution: "© Stadia Maps, © OpenMapTiles, © OpenStreetMap"
  });

  const satellite = L.tileLayer("https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}", {
    maxZoom: 19, attribution: "© Esri, Maxar, Earthstar Geographics"
  });

  const isDark = !document.documentElement.classList.contains("light");
  if (isDark) dark.addTo(map); else osm.addTo(map);

  L.control.layers({ "🌙 Dark": dark, "🌍 Street": osm, "🛰️ Satellite": satellite }, null, { position: "topleft" }).addTo(map);

  markersLayer = L.layerGroup().addTo(map);
  addMarkers(allLands);

  // Fit bounds
  if (allLands.length > 1) {
    const bounds = allLands.map(l => [l.lat, l.lng]);
    map.fitBounds(bounds, { padding: [30, 30] });
  }

  setTimeout(() => map.invalidateSize(), 200);
  setTimeout(() => map.invalidateSize(), 600);
}

/* ===== AÑADIR MARKERS ===== */
function addMarkers(lands) {
  markersLayer.clearLayers();
  document.getElementById("landCountBadge").textContent = lands.length;

  lands.forEach(land => {
    const color = getColor(land.id);
    // Hexágonos pequeños (radio 4px ~ 30m a zoom 15)
    const marker = L.circleMarker([land.lat, land.lng], {
      radius: 4,
      color: color,
      fillColor: color,
      fillOpacity: 0.85,
      weight: 1.5,
      opacity: 0.9,
    });

    marker.bindTooltip(`OVR #${land.id.slice(-6)}`, {
      direction: "top", offset: [0, -6],
      className: "ar-tooltip"
    });

    marker.bindPopup(`
      <div class="ar-popup">
        <div class="ar-popup-head">
          <span class="ar-popup-icon">🕶️</span>
          <strong>OVR Land</strong>
        </div>
        <div class="ar-popup-body">
          <div class="ar-popup-row"><span class="k">Token ID</span><span class="v code">${land.id}</span></div>
          <div class="ar-popup-row"><span class="k">Latitud</span><span class="v">${land.lat}°</span></div>
          <div class="ar-popup-row"><span class="k">Longitud</span><span class="v">${land.lng}°</span></div>
        </div>
        <div class="ar-popup-actions">
          <a class="btn btn-sm" href="https://ovr.ai/land/${land.id}" target="_blank" rel="noopener">🌐 OVR</a>
          <a class="btn btn-sm" href="https://basescan.org/token/${OVR_CONTRACT}?a=${land.id}" target="_blank" rel="noopener">🔍 Basescan</a>
        </div>
      </div>
    `);

    markersLayer.addLayer(marker);
  });
}

/* ===== COLOR DETERMINISTA ===== */
function getColor(id) {
  let h = 0;
  for (const c of id) h = ((h << 5) - h) + c.charCodeAt(0);
  return `hsl(${Math.abs(h) % 360}, 80%, 52%)`;
}

/* ===== CARGAR DATOS ===== */
async function loadLands() {
  const container = document.getElementById("arMap");
  try {
    const res = await fetch("/ar/assets/ovr-lands.json");
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    loadLeaflet(() => initMap(data));
  } catch (err) {
    console.error("Error cargando OVRLands:", err);
    if (container) container.innerHTML = `
      <div style="text-align:center;padding:40px;color:var(--muted);">
        <div style="font-size:28px;">⚠️</div>
        <p>No se pudieron cargar los datos</p>
        <p class="small muted">${err.message}</p>
      </div>
    `;
  }
}

/* ===== MODAL ===== */
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
          <p>198 OVRLands anclados al espacio físico en la zona metropolitana de Monterrey, NL.</p>
          <p class="small muted" style="margin-top:8px;">
            Cada punto en el mapa representa un OVRLand — un hexágono de ~30m de diámetro
            que pertenece a alemtyDAO. Estos espacios pueden alojar experiencias AR persistentes.
          </p>
          <div style="margin-top:12px;">
            <div><span class="k">Total Lands</span><br><span class="v big">${allLands.length}</span></div>
            <div style="margin-top:6px;"><span class="k">Contrato</span><br><span class="v code small">${shortAddr(OVR_CONTRACT)}</span></div>
          </div>
          <div style="margin-top:12px;">
            <a class="btn" href="https://ovr.ai" target="_blank">🌐 OVR Platform</a>
            <a class="btn" href="https://basescan.org/address/${OVR_CONTRACT}" target="_blank" style="margin-left:8px;">📜 Contrato</a>
          </div>
        </div>
      `
    },
    layers: {
      title: "🧅 Capas AR",
      html: `
        <div class="card" style="padding:16px;">
          <p>Las capas AR son superposiciones narrativas sobre el espacio físico.</p>
          <div class="grid2" style="margin-top:12px;">
            <div class="card" style="padding:12px;text-align:center;"><div style="font-size:28px;">🧙🏻</div><div class="small">Identidad</div></div>
            <div class="card" style="padding:12px;text-align:center;"><div style="font-size:28px;">📜</div><div class="small">Historia</div></div>
            <div class="card" style="padding:12px;text-align:center;"><div style="font-size:28px;">🤖</div><div class="small">IA</div></div>
            <div class="card" style="padding:12px;text-align:center;"><div style="font-size:28px;">🎮</div><div class="small">Juego</div></div>
          </div>
          <p class="small muted" style="margin-top:12px;">⏳ Próximamente disponible.</p>
        </div>
      `
    },
    status: {
      title: "📡 Estado del Módulo",
      html: `
        <div class="card" style="padding:16px;">
          <div class="h3">Fase 6 — ar.alemty.eth</div>
          <div style="margin-top:8px;">
            <div>✅ Subdominio <strong>ar.alemty.eth</strong></div>
            <div>✅ Mapa interactivo — ${allLands.length} OVRLands</div>
            <div>⏳ Capas AR dinámicas</div>
            <div>⏳ Agentes IA geolocalizados</div>
            <div>⏳ Integración DID + SIWE</div>
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
  }
}

function closeModal() {
  const modal = document.getElementById("arModal");
  if (modal) {
    modal.setAttribute("aria-hidden", "true");
    modal.classList.remove("open");
  }
}

/* ===== MOUNT ===== */
export function mountAR() {
  if (window.__alemtyArMounted) return;
  window.__alemtyArMounted = true;

  mountShell();
  loadLands();

  // Click handlers
  document.querySelectorAll("[data-open]").forEach(el => {
    el.addEventListener("click", () => openSection(el.dataset.open));
  });

  document.querySelectorAll("[data-close='arModal']").forEach(el => {
    el.addEventListener("click", closeModal);
  });

  document.querySelector(".modal-backdrop")?.addEventListener("click", closeModal);
  document.addEventListener("keydown", e => { if (e.key === "Escape") closeModal(); });
}
