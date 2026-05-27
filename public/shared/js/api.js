// shared/js/api.js
// API base, JWT helpers, fetch utilities
// SINGLE SOURCE OF TRUTH para todos los subdominios

const isENS = location.hostname.endsWith(".eth.limo");
const isWorkers = location.hostname.endsWith(".workers.dev");
const isPages = location.hostname.endsWith(".pages.dev");
const isLocalDev =
  location.hostname === "localhost" &&
  (location.port === "8787" || location.port === "8788");
const isFileProtocol = location.protocol === "file:";

const API_WORKER_LOCAL = "http://127.0.0.1:8788";
const API_WORKER_REMOTE = "https://alemtydao.alejandrogtzz93.workers.dev";

// Regla:
// - Workers desplegados → rutas relativas (mismo dominio)
// - Wrangler dev (puerto 8787/8788) → API local
// - File protocol (localhost:3000, ENS, Pages) → API remota
export const API_BASE = isWorkers ? "" : (isLocalDev ? API_WORKER_LOCAL : API_WORKER_REMOTE);

// SIWE API
const SIWE_API_LOCAL = "http://127.0.0.1:8787";
const SIWE_API_REMOTE = "https://alemtydao-siwe.alejandrogtzz93.workers.dev";
export const SIWE_API = isLocalDev ? SIWE_API_LOCAL : SIWE_API_REMOTE;

export function getJWT() {
  return localStorage.getItem("alemty.jwt") || "";
}

export function authHeaders(extra = {}) {
  const jwt = getJWT();
  return {
    "content-type": "application/json",
    ...(jwt ? { Authorization: `Bearer ${jwt}` } : {}),
    ...extra,
  };
}

export function authHeadersGet(extra = {}) {
  const jwt = getJWT();
  return {
    ...(jwt ? { Authorization: `Bearer ${jwt}` } : {}),
    ...extra,
  };
}

export function getDid() {
  return (
    localStorage.getItem("alemty.did") ||
    localStorage.getItem("did") ||
    ""
  ).toLowerCase();
}

/**
 * Fetch de métricas personales desde /api/me/stats
 */
export async function fetchMeStats() {
  const token = getJWT();
  if (!token) return null;
  try {
    const r = await fetch(`${API_BASE}/api/me/stats`, {
      headers: { Authorization: `Bearer ${token}` },
      cache: "no-store",
    });
    if (!r.ok) { console.warn("fetchMeStats not ok:", r.status); return null; }
    const ct = r.headers.get("content-type") || "";
    if (!ct.includes("application/json")) { console.warn("fetchMeStats non-json"); return null; }
    return await r.json();
  } catch (err) {
    console.error("fetchMeStats error:", err);
    return null;
  }
}

/**
 * Validate current JWT against backend /api/me/verify
 * Returns the wallet address if valid, null otherwise.
 * Also cleans localStorage if invalid.
 */
export async function verifyJWT() {
  const token = getJWT();
  if (!token) {
    localStorage.removeItem("alemty.siwe");
    return null;
  }
  try {
    const r = await fetch(`${API_BASE}/api/me/verify`, {
      headers: authHeadersGet(),
      cache: "no-store",
    });
    if (!r.ok) {
      // 401 = token inválido o expirado
      localStorage.removeItem("alemty.jwt");
      localStorage.removeItem("alemty.siwe");
      return null;
    }
    const data = await r.json().catch(() => ({}));
    const addr = (data?.address || data?.did || "").toLowerCase();
    if (addr) {
      localStorage.setItem("alemty.siwe", "ok");
      localStorage.setItem("alemty.did", addr);
      localStorage.setItem("did", addr);
    }
    return addr || token;
  } catch (err) {
    // Si hay error de red, mantenemos el JWT local — no lo invalidamos
    console.warn("verifyJWT: network error, keeping cached JWT", err);
    const addr = getDid();
    return addr || token;
  }
}
export async function fetchFirstJson(urls) {
  for (const u of urls) {
    try {
      const r = await fetch(u, { cache: "no-store" });
      if (!r.ok) continue;
      return await r.json();
    } catch {}
  }
  return null;
}
