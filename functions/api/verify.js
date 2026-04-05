
import { SiweMessage } from 'siwe';

export async function onRequestPost(context) {
  const { request, env } = context;
  const NONCES = env.SIWE_NONCES;

  if (!NONCES) {
    return json({ ok: false, error: 'KV binding missing: SIWE_NONCES' }, 500);
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return json({ ok: false, error: 'Invalid JSON body' }, 400);
  }

  const { message, signature } = body || {};
  if (!message || !signature) {
    return json({ ok: false, error: 'Missing message or signature' }, 400);
  }

  let siwe;
  try {
    siwe = new SiweMessage(message);
  } catch {
    return json({ ok: false, error: 'Invalid SIWE message' }, 400);
  }

  // 1️⃣ Verificar nonce
  const key = `nonce:${siwe.nonce}`;
  const exists = await NONCES.get(key);
  if (!exists) {
    return json({ ok: false, error: 'Nonce not found or already used' }, 401);
  }

  // 2️⃣ Verificar firma
  try {
    
await siwe.verify({
  signature,
  domain: 'alemty.eth',
  nonce: siwe.nonce,
});

if (![1, 8453].includes(siwe.chainId)) {
  return json({ ok:false, error:'Unsupported chain' }, 400);
}

  } catch (err) {
    return json({ ok: false, error: 'Invalid signature' }, 401);
  }

  // 3️⃣ Invalidar nonce (anti‑replay)
  await NONCES.delete(key);

  return json({
    ok: true,
    address: siwe.address,
    chainId: siwe.chainId,
  });
}

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'no-store',
    },
  });
}
