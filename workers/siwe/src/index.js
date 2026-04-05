
import { SiweMessage } from "siwe";

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
    },
  });
}

function makeAlphanumericNonce(length = 24) {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  const bytes = new Uint8Array(length);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, b => chars[b % chars.length]).join("");
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    // ✅ NONCE
    if (url.pathname === "/nonce") {
      const nonce = makeAlphanumericNonce(24);
      await env.SIWE_NONCES.put(`nonce:${nonce}`, "1", { expirationTtl: 600 });
      return json({ ok: true, nonce, ttlSeconds: 600 });
    }

    // ✅ VERIFY
    if (url.pathname === "/verify" && request.method === "POST") {
      const body = await request.json();
      const { message, signature } = body || {};

      if (!message || !signature) {
        return json({ ok: false, error: "Missing message or signature" }, 400);
      }

      let siwe;
      try {
        siwe = new SiweMessage(message);
      } catch {
        return json({ ok: false, error: "Invalid SIWE message" }, 400);
      }

      const key = `nonce:${siwe.nonce}`;
      const exists = await env.SIWE_NONCES.get(key);
      if (!exists) {
        return json({ ok: false, error: "Nonce not found or used" }, 401);
      }

      try {
        await siwe.verify({
          signature,
          domain: "alemty.eth",
          nonce: siwe.nonce,
        });
      } catch {
        return json({ ok: false, error: "Invalid signature" }, 401);
      }

      if (![1, 8453].includes(siwe.chainId)) {
        return json({ ok: false, error: "Unsupported chain" }, 400);
      }

      await env.SIWE_NONCES.delete(key);

      return json({
        ok: true,
        address: siwe.address,
        chainId: siwe.chainId,
      });
    }

    return new Response("Not found", { status: 404 });
  }
};

