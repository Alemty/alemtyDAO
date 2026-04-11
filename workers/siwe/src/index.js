
import { verifyMessage } from "ethers";

/**
 * ✅ ORÍGENES PERMITIDOS (CORS)
 */
const ALLOWED_ORIGINS = new Set([
  "https://alemtydao.pages.dev",
  "https://c45b9928.alemtydao.pages.dev",
  "https://alemty.eth.limo",
  "http://127.0.0.1:5500",
  "http://localhost:5500",
]);

/**
 * ✅ Dominios permitidos dentro del MENSAJE SIWE
 */
const SIWE_ALLOWED_DOMAINS = new Set([
  "alemty.eth",
  "alemty.eth.limo",
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
 * ✅ Parser mínimo SIWE (EIP‑4361)
 */
function parseSiweMessage(message) {
  const m = String(message).replace(/\r\n/g, "\n").trim();
  const lines = m.split("\n");

  const header = lines[0] || "";
  const headerMatch = header.match(
    /^(.+?) wants you to sign in with your Ethereum account:$/
  );
  if (!headerMatch) return null;
  const domain = headerMatch[1].trim();

  const address = (lines[1] || "").trim();
  if (!/^0x[a-fA-F0-9]{40}$/.test(address)) return null;

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

  if (!/^[A-Za-z0-9]{8,}$/.test(nonce)) return null;
  if (!/^\d{4}-\d{2}-\d{2}T/.test(issuedAt)) return null;

  return {
    domain,
    address,
    chainId,
    nonce,
    issuedAt,
    normalized: m,
  };
}

/* =========================================================
   ✅ JWT (HS256) — para devolver token en /verify
   (sin dependencias, compatible con Workers)
========================================================= */

function b64urlEncode(input) {
  const bytes = typeof input === "string" ? new TextEncoder().encode(input) : input;
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");
}

async function hmacKey(secret) {
  return crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
}

async function signJwt(payload, secret) {
  const header = { alg: "HS256", typ: "JWT" };
  const h = b64urlEncode(JSON.stringify(header));
  const p = b64urlEncode(JSON.stringify(payload));
  const data = `${h}.${p}`;

  const key = await hmacKey(secret);
  const sigBuf = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(data));
  const sig = b64urlEncode(new Uint8Array(sigBuf));
  return `${data}.${sig}`;
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const origin = request.headers.get("Origin");
    const acrh = request.headers.get("Access-Control-Request-Headers") || "";
    const cors = getCorsHeaders(origin, acrh);

    /* =========================
       ✅ CORS preflight
       ========================= */
    if (request.method === "OPTIONS") {
      const allowed = cors["Access-Control-Allow-Origin"];
      return new Response(null, {
        status: allowed ? 204 : 403,
        headers: allowed ? cors : {},
      });
    }

    /* =========================
       ✅ NONCE
       ========================= */
    if (url.pathname === "/nonce" && request.method === "GET") {
      if (!env.SIWE_NONCES) {
        return json(
          { ok: false, error: "KV binding missing: SIWE_NONCES" },
          500,
          cors
        );
      }

      const nonce = makeAlphanumericNonce(24);
      const ttlSeconds = 600;

      await env.SIWE_NONCES.put(`nonce:${nonce}`, "1", {
        expirationTtl: ttlSeconds,
      });

      return json({ ok: true, nonce, ttlSeconds }, 200, cors);
    }

    /* =========================
       ✅ VERIFY SIWE + EMIT JWT
       ========================= */
    if (url.pathname === "/verify" && request.method === "POST") {
      if (!env.SIWE_NONCES) {
        return json(
          { ok: false, error: "KV binding missing: SIWE_NONCES" },
          500,
          cors
        );
      }

      // ✅ Necesitamos el secret para firmar token
      if (!env.SESSION_SECRET) {
        return json(
          { ok: false, error: "Missing env var: SESSION_SECRET" },
          500,
          cors
        );
      }

      let body;
      try {
        body = await request.json();
      } catch {
        return json({ ok: false, error: "Invalid JSON body" }, 400, cors);
      }

      const { message, signature } = body || {};
      if (!message || !signature) {
        return json(
          { ok: false, error: "Missing message or signature" },
          400,
          cors
        );
      }

      const parsed = parseSiweMessage(message);
      if (!parsed) {
        return json({ ok: false, error: "Invalid SIWE message" }, 400, cors);
      }

      /* ✅ Dominio SIWE permitido */
      if (!SIWE_ALLOWED_DOMAINS.has(parsed.domain)) {
        return json({ ok: false, error: "SIWE domain not allowed" }, 400, cors);
      }

      /* ✅ Chain allowlist */
      if (![1, 8453].includes(parsed.chainId)) {
        return json({ ok: false, error: "Unsupported chain" }, 400, cors);
      }

      /* ✅ Nonce anti‑replay */
      const key = `nonce:${parsed.nonce}`;
      const exists = await env.SIWE_NONCES.get(key);
      if (!exists) {
        return json(
          { ok: false, error: "Nonce not found or already used" },
          401,
          cors
        );
      }

      let recovered;
      try {
        recovered = verifyMessage(parsed.normalized, signature);
      } catch {
        return json({ ok: false, error: "Invalid signature" }, 401, cors);
      }

      if (recovered.toLowerCase() !== parsed.address.toLowerCase()) {
        return json({ ok: false, error: "Signature mismatch" }, 401, cors);
      }

      /* ✅ Invalidate nonce */
      await env.SIWE_NONCES.delete(key);

      // ✅ Emitir JWT para tu API (aud debe ser "alemtydao-api" como en tu auth.ts)
      const address = parsed.address.toLowerCase();
      const now = Math.floor(Date.now() / 1000);
      const exp = now + 60 * 60; // 1 hora (ajusta si quieres)

      const token = await signJwt(
        {
          iss: "alemtydao-siwe",
          aud: "alemtydao-api",
          sub: address,
          iat: now,
          exp,
        },
        env.SESSION_SECRET
      );

      return json(
        {
          ok: true,
          address,
          chainId: parsed.chainId,
          token, // ✅ AQUÍ ya viene el JWT
        },
        200,
        cors
      );
    }

    return new Response("Not found", {
      status: 404,
      headers: cors,
    });
  },
};

