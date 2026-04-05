
import { verifyMessage } from "ethers";

/**
 * CORS: permitir SOLO tu frontend.
 */

const ALLOWED_ORIGINS = new Set([
  // ✅ Producción (Pages)
  "https://alemtydao.pages.dev",

  // ✅ ENS / gateways
  "https://alemty.eth",
  "https://alemty.eth.limo",

  // ✅ Desarrollo local
  "http://127.0.0.1:5500",
  "http://localhost:5500"
]);


function getCorsHeaders(origin, requestHeaders = "") {
  if (!origin) return {};
  if (ALLOWED_ORIGINS.has(origin)) {
    return {
      "Access-Control-Allow-Origin": origin,
      "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
      "Access-Control-Allow-Headers": requestHeaders || "Content-Type",
      "Access-Control-Max-Age": "86400",
      "Vary": "Origin",
    };
  }
  return {};
}

function json(data, status = 200, cors = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
      ...cors,
    },
  });
}

function makeAlphanumericNonce(length = 24) {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  const bytes = new Uint8Array(length);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => chars[b % chars.length]).join("");
}

/**
 * Parser mínimo SIWE (EIP-4361) sin dependencias ABNF.
 * Extrae domain, address, uri, version, chainId, nonce, issuedAt.
 */
function parseSiweMessage(message) {
  // Normaliza saltos
  const m = String(message).replace(/\r\n/g, "\n").trim();

  const lines = m.split("\n");

  // 0: "<domain> wants you to sign in with your Ethereum account:"
  const header = lines[0] || "";
  const headerMatch = header.match(/^(.+?) wants you to sign in with your Ethereum account:$/);
  if (!headerMatch) return null;
  const domain = headerMatch[1].trim();

  // 1: "<address>"
  const address = (lines[1] || "").trim();
  if (!/^0x[a-fA-F0-9]{40}$/.test(address)) return null;

  // Campos tipo "Key: value"
  const fields = {};
  for (const line of lines) {
    const idx = line.indexOf(":");
    if (idx > 0) {
      const key = line.slice(0, idx).trim();
      const value = line.slice(idx + 1).trim();
      if (key && value) fields[key] = value;
    }
  }

  const uri = fields["URI"];
  const version = fields["Version"];
  const chainIdStr = fields["Chain ID"];
  const nonce = fields["Nonce"];
  const issuedAt = fields["Issued At"];

  if (!uri || !version || !chainIdStr || !nonce || !issuedAt) return null;
  if (version !== "1") return null;

  const chainId = Number(chainIdStr);
  if (!Number.isFinite(chainId)) return null;

  // Nonce mínimo 8 alfanumérico (tu backend genera alfanumérico fuerte)
  if (!/^[A-Za-z0-9]{8,}$/.test(nonce)) return null;

  // issuedAt ISO-ish (validación ligera)
  if (!/^\d{4}-\d{2}-\d{2}T/.test(issuedAt)) return null;

  return { domain, address, uri, version, chainId, nonce, issuedAt, normalized: m };
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const origin = request.headers.get("Origin");
    const acrh = request.headers.get("Access-Control-Request-Headers") || "";
    const cors = getCorsHeaders(origin, acrh);

    // ✅ Preflight CORS
    if (request.method === "OPTIONS") {
      const allowed = cors["Access-Control-Allow-Origin"];
      return new Response(null, {
        status: allowed ? 204 : 403,
        headers: allowed ? cors : {},
      });
    }

    // ✅ NONCE
    if (url.pathname === "/nonce" && request.method === "GET") {
      if (!env.SIWE_NONCES) {
        return json({ ok: false, error: "KV binding missing: SIWE_NONCES" }, 500, cors);
      }

      const nonce = makeAlphanumericNonce(24);
      const ttlSeconds = 600;

      await env.SIWE_NONCES.put(`nonce:${nonce}`, "1", { expirationTtl: ttlSeconds });
      return json({ ok: true, nonce, ttlSeconds }, 200, cors);
    }

    // ✅ VERIFY
    if (url.pathname === "/verify" && request.method === "POST") {
      if (!env.SIWE_NONCES) {
        return json({ ok: false, error: "KV binding missing: SIWE_NONCES" }, 500, cors);
      }

      let body;
      try {
        body = await request.json();
      } catch {
        return json({ ok: false, error: "Invalid JSON body" }, 400, cors);
      }

      const { message, signature } = body || {};
      if (!message || !signature) {
        return json({ ok: false, error: "Missing message or signature" }, 400, cors);
      }

      const parsed = parseSiweMessage(message);
      if (!parsed) {
        return json({ ok: false, error: "Invalid SIWE message" }, 400, cors);
      }

      // ✅ Dominio esperado (como tu política actual)
      if (parsed.domain !== "alemty.eth") {
        return json({ ok: false, error: "Domain mismatch" }, 400, cors);
      }

      // ✅ Chain allowlist (tu misma política)
      if (![1, 8453].includes(parsed.chainId)) {
        return json({ ok: false, error: "Unsupported chain" }, 400, cors);
      }

      // ✅ Anti-replay nonce
      const key = `nonce:${parsed.nonce}`;
      const exists = await env.SIWE_NONCES.get(key);
      if (!exists) {
        return json({ ok: false, error: "Nonce not found or already used" }, 401, cors);
      }

      // ✅ Verificar firma sobre el MENSAJE EXACTO
      let recovered;
      try {
        recovered = verifyMessage(parsed.normalized, signature);
      } catch {
        return json({ ok: false, error: "Invalid signature" }, 401, cors);
      }

      if (recovered.toLowerCase() !== parsed.address.toLowerCase()) {
        return json({ ok: false, error: "Signature does not match address" }, 401, cors);
      }

      // ✅ Invalidar nonce (anti-replay)
      await env.SIWE_NONCES.delete(key);

      return json(
        { ok: true, address: parsed.address, chainId: parsed.chainId },
        200,
        cors
      );
    }

    return new Response("Not found", { status: 404, headers: cors });
  },
};

