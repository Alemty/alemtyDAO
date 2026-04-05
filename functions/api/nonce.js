
export async function onRequestGet(context) {
  const NONCES = context.env.SIWE_NONCES;

  if (!NONCES) {
    return json({ ok: false, error: "KV binding missing: SIWE_NONCES" }, 500);
  }

  // ✅ SOLO alfanumérico (A-Z a-z 0-9) y >= 8 chars
  const nonce = makeAlphanumericNonce(24);

  const ttlSeconds = 10 * 60;
  await NONCES.put(`nonce:${nonce}`, "1", { expirationTtl: ttlSeconds });

  return json({ ok: true, nonce, ttlSeconds });
}

function makeAlphanumericNonce(length = 24) {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  const bytes = new Uint8Array(length);
  crypto.getRandomValues(bytes);

  let out = "";
  for (let i = 0; i < length; i++) out += chars[bytes[i] % chars.length];
  return out;
}

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
    },
  });
}
