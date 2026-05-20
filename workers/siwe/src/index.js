import { verifyMessage } from "ethers";

/* =========================
   ✅ DOMINIOS SIWE (IMPORTANTE)
========================= */
const SIWE_ALLOWED_DOMAINS = new Set([
  "localhost",
  "127.0.0.1",
  "alemty.eth",
  "alemty.eth.limo",
]);

/* =========================
   ✅ CORS
========================= */
const CORS_ALLOWLIST = new Set([
  "https://alemtydao.alejandrogtzz93.workers.dev",
  "https://alemtydao.pages.dev",
  "https://alemty.eth.limo",
]);

function isAllowedOrigin(origin) {
  if (!origin) return false;

  if (CORS_ALLOWLIST.has(origin)) return true;

  try {
    const u = new URL(origin);

    if (u.hostname === "localhost" || u.hostname === "127.0.0.1") return true;
    if (u.hostname.endsWith(".alemtydao.pages.dev")) return true;
  } catch {}

  return false;
}

function getCorsHeaders(origin, requestHeaders = "") {
  if (!origin || !isAllowedOrigin(origin)) return {};

  const requested = String(requestHeaders || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

  const base = ["Content-Type", "Authorization"];
  const allowHeaders = Array.from(new Set([...base, ...requested])).join(", ");

  return {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
    "Access-Control-Allow-Headers": allowHeaders,
    "Access-Control-Allow-Credentials": "true",
    "Access-Control-Max-Age": "86400",
    "Vary": "Origin",
  };
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

/* =========================
   ✅ NONCE
========================= */
function makeAlphanumericNonce(length = 24) {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  const bytes = new Uint8Array(length);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => chars[b % chars.length]).join("");
}

/* =========================
   ✅ PARSER SIWE (FIX REAL)
========================= */
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

  return {
    domain,
    address,
    chainId,
    nonce,
    issuedAt,
    normalized: m,
  };
}

/* =========================
   ✅ JWT
========================= */
function b64urlEncode(input) {
  const bytes =
    typeof input === "string" ? new TextEncoder().encode(input) : input;

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
  const sigBuf = await crypto.subtle.sign(
    "HMAC",
    key,
    new TextEncoder().encode(data)
  );
  const sig = b64urlEncode(new Uint8Array(sigBuf));

  return `${data}.${sig}`;
}

/* =========================================================
   🚀 MAIN
========================================================= */
export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const origin = request.headers.get("Origin");
    const acrh = request.headers.get("Access-Control-Request-Headers") || "";
    const cors = getCorsHeaders(origin, acrh);

    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: cors });
    }

    if (url.pathname === "/nonce" && request.method === "GET") {
      const nonce = makeAlphanumericNonce(24);
      await env.SIWE_NONCES.put(`nonce:${nonce}`, "1", { expirationTtl: 600 });
      return json({ ok: true, nonce }, 200, cors);
    }

    if (url.pathname === "/verify" && request.method === "POST") {
      try {
        const { message, signature } = await request.json();

        const parsed = parseSiweMessage(message);
        if (!parsed || !SIWE_ALLOWED_DOMAINS.has(parsed.domain)) {
          return json({ ok: false, error: "Invalid SIWE message" }, 400, cors);
        }

        const key = `nonce:${parsed.nonce}`;
        if (!(await env.SIWE_NONCES.get(key))) {
          return json({ ok: false, error: "Invalid nonce" }, 401, cors);
        }

        const recovered = verifyMessage(parsed.normalized, signature);
        if (recovered.toLowerCase() !== parsed.address.toLowerCase()) {
          return json({ ok: false, error: "Signature mismatch" }, 401, cors);
        }

        await env.SIWE_NONCES.delete(key);

        const now = Math.floor(Date.now() / 1000);
        
const token = await signJwt(
  {
    iss: "alemtydao-siwe",
    aud: "alemtydao-api",   // 🔥 ESTA LÍNEA ES EL FIX
    sub: parsed.address.toLowerCase(),
    iat: now,
    exp: now + 3600,
  },
  env.JWT_SECRET
);


        return json({ ok: true, address: parsed.address, token }, 200, cors);
      } catch (err) {
        console.error("VERIFY ERROR:", err);
        return json({ ok: false, error: "internal error" }, 500, cors);
      }
    }

    return new Response("Not found", { status: 404, headers: cors });
  },
};
