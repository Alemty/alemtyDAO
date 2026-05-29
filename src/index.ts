// src/index.ts
import { Hono } from "hono";
import { cors } from "hono/cors";

import { auth } from "./middleware/auth";

// ✅ Router legacy (no tocar)
import { router } from "./router";

// ✅ Posts router
import { posts } from "./routes/posts";

// ✅ Rooms router
import { rooms } from "./routes/rooms";

// Helper
function shortAddr(addr: string): string {
  if (!addr || addr.length < 10) return addr || '';
  return addr.slice(0, 6) + '…' + addr.slice(-4);
}

/* =========================
   Tipos
========================= */
export type Bindings = {
  DB: D1Database;
  SESSION_SECRET: string;
  JWT_SECRET: string;
  ASSETS: Fetcher;
  AURA_CONTRACT: string;
  AURA_PRIVATE_KEY: string;
  AURA_RPC_URL: string;
  MINTER_ADDRESS: string;
  DISTRIBUTOR_ADDRESS: string;
};

export type Vars = {
  address?: string;
};

/* =========================
   App
========================= */
const app = new Hono<{ Bindings: Bindings; Variables: Vars }>();

/* =========================
   ✅ CORS GLOBAL (DEV + PROD + Pages Preview + Local ANY PORT)
========================= */
const CORS_ALLOWLIST = new Set([
  "https://alemtydao.pages.dev",
  "https://alemtydao.alejandrogtzz93.workers.dev",
  "https://alemty.eth.limo",
]);

function corsOrigin(origin: string | undefined): string | null {
  if (!origin) return null;

  // ✅ allow exact matches
  if (CORS_ALLOWLIST.has(origin)) return origin;

  try {
    const u = new URL(origin);

    // ✅ allow Pages preview deploys
    if (u.hostname.endsWith(".alemtydao.pages.dev")) return origin;

    // ✅ allow any localhost/127.0.0.1 port
    if (u.hostname === "localhost" || u.hostname === "127.0.0.1") return origin;
  } catch {
    // ignore invalid origin
  }

  return null;
}


app.use(
  "/*",
  cors({
    origin: (origin) => corsOrigin(origin ?? undefined),
    allowMethods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"], // ✅ PATCH agregado
    allowHeaders: ["Authorization", "Content-Type"],
    exposeHeaders: ["Content-Type"],
    maxAge: 86400,
    credentials: true,
  })
);

// ✅ Preflight explícito (evita fallos de PATCH en algunos navegadores)
app.options("/api/*", (c) => c.body(null, 204));


/* =========================
   Health check
========================= */
app.get("/api/health", (c) =>
  c.json({
    status: "ok",
    service: "alemtyDAO",
    uptime: "alive",
  })
);

/* =========================
   DEBUG (DEV): confirmar que JWT_SECRET existe (sin exponerlo)
   Úsalo para diagnosticar "Invalid token"
========================= */
app.get("/api/debug/env", (c) => {
  const jwt = String(c.env.JWT_SECRET || "");
  const sess = String(c.env.SESSION_SECRET || "");
  return c.json({
    ok: true,
    hasJWTSecret: jwt.length > 0,
    jwtSecretLen: jwt.length,        // NO imprime el secret
    hasSessionSecret: sess.length > 0,
    sessionSecretLen: sess.length,   // NO imprime el secret
  });
});

/* =========================================================
   PERFIL / STATS
========================================================= */
app.get("/api/me/stats", auth, async (c) => {
  const address = c.get("address");

  const postsRow = await c.env.DB.prepare(
    "SELECT COUNT(*) AS n FROM posts WHERE author = ?"
  )
    .bind(address)
    .first();

  const commentsRow = await c.env.DB.prepare(
    "SELECT COUNT(*) AS n FROM comments WHERE author = ?"
  )
    .bind(address)
    .first();

  // ✅ Reacciones recibidas (SUM(amount) para point, COUNT para like)
  const pointsReceivedRow = await c.env.DB.prepare(
    `
    SELECT COALESCE(SUM(r.amount),0) AS n
    FROM reactions r
    JOIN posts p ON p.id = r.post_id
    WHERE p.author = ? AND r.type = 'point'
    `
  )
    .bind(address)
    .first();

  const likesReceivedRow = await c.env.DB.prepare(
    `
    SELECT COUNT(*) AS n
    FROM reactions r
    JOIN posts p ON p.id = r.post_id
    WHERE p.author = ? AND r.type = 'like'
    `
  )
    .bind(address)
    .first();

  const pointsReceived = Number((pointsReceivedRow as any)?.n ?? 0);
  const likesReceived = Number((likesReceivedRow as any)?.n ?? 0);

  // Comentarios recibidos en posts del usuario
  const commentsReceivedRow = await c.env.DB.prepare(
    "SELECT COUNT(*) AS n FROM comments c JOIN posts p ON p.id = c.post_id WHERE p.author = ?"
  ).bind(address).first();
  const commentsReceived = Number((commentsReceivedRow as any)?.n ?? 0);

  // ✅ Reacciones DADAS por el usuario
  const likesGivenRow = await c.env.DB.prepare(
    "SELECT COUNT(*) AS n FROM reactions WHERE address = ? AND type = 'like'"
  ).bind(address).first();
  const pointsGivenRow = await c.env.DB.prepare(
    "SELECT COUNT(*) AS n FROM reactions WHERE address = ? AND type = 'point'"
  ).bind(address).first();
  const likesGiven = Number((likesGivenRow as any)?.n ?? 0);
  const pointsGiven = Number((pointsGivenRow as any)?.n ?? 0);

  const dharma = pointsReceived + likesReceived;

  // AURA off-chain: dharma genera 1 AURA por cada punto, farm genera AURA extra
  // AURA on-chain: balance real del contrato ERC-20 en Base
  // "AURA por reclamar" = (dharma + auraFarmed) - auraClaimed
  // NUNCA se suman off-chain + on-chain. Son conceptos separados.

  const farmRow: any = await c.env.DB.prepare(
    "SELECT COALESCE(SUM(amount), 0) AS total FROM farm_claims WHERE address = ?"
  ).bind(address).first();
  const auraFarmed = Number(farmRow?.total || 0);

  // AURA off-chain total generado por interacciones (dharma + farm)
  const auraAccumulado = dharma + auraFarmed;

  // AURA on-chain: balance real desde el contrato ERC-20
  let aura = 0;
  let auraBalance = '0';

  // auraClaimed: cuánto AURA se ha marcado como "reclamado" off-chain
  const claimedRow: any = await c.env.DB.prepare(
    "SELECT aura_claimed FROM user_stats WHERE address = ?"
  ).bind(address).first();
  const auraClaimed = Number(claimedRow?.aura_claimed ?? 0);

  // Consultar balance on-chain via RPC con múltiples RPCs fallback
  const auraContract = c.env.AURA_CONTRACT;
  if (auraContract) {
    const rpcUrls = [
      c.env.AURA_RPC_URL || 'https://mainnet.base.org',
      'https://1rpc.io/base',
      'https://base-rpc.publicnode.com',
    ].filter(Boolean);
    const data = '0x70a08231' + address.slice(2).padStart(64, '0');
    for (const rpcUrl of rpcUrls) {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 5000);
        const rpcRes = await fetch(rpcUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            jsonrpc: '2.0', id: 1, method: 'eth_call',
            params: [{ to: auraContract, data }, 'latest']
          }),
          signal: controller.signal
        });
        clearTimeout(timeoutId);
        if (rpcRes.ok) {
          const json: any = await rpcRes.json();
          if (json?.result && json.result !== '0x') {
            // División correcta: BigInt / 10^16 / 100 = BigInt / 10^18
            aura = Number(BigInt(json.result) / 10n ** 16n / 100n);
            auraBalance = String(aura);
            // Guardar en D1 el balance on-chain cachead0
            await c.env.DB.prepare(
              "INSERT OR REPLACE INTO user_stats (address, aura_balance, updated_at, points_received, likes_received, dharma_total, level, karma_debt) VALUES (?, ?, ?, COALESCE((SELECT points_received FROM user_stats WHERE address = ?), 0), COALESCE((SELECT likes_received FROM user_stats WHERE address = ?), 0), COALESCE((SELECT dharma_total FROM user_stats WHERE address = ?), 0), COALESCE((SELECT level FROM user_stats WHERE address = ?), 1), 0)"
            ).bind(address, aura, Math.floor(Date.now() / 1000), address, address, address, address).run();
            break;
          }
        }
      } catch (_) { /* intentar siguiente RPC */ }
    }
    // Fallback a caché persistente si RPC falló
    if (aura === 0) {
      try {
        const cachedRow: any = await c.env.DB.prepare(
          "SELECT aura_balance FROM user_stats WHERE address = ? AND aura_balance > 0"
        ).bind(address).first();
        if (cachedRow && Number(cachedRow.aura_balance) > 0) {
          aura = Number(cachedRow.aura_balance);
          auraBalance = String(aura);
        }
      } catch (_) {}
    }
  }

  // auraReclamable = acumulado off-chain - lo ya reclamado (nunca resta balance on-chain)
  const auraReclamable = Math.max(0, auraAccumulado - auraClaimed);

  return c.json({
    ok: true,
    address,
    activity: {
      posts: Number((postsRow as any)?.n ?? 0),
      comments: Number((commentsRow as any)?.n ?? 0),
    },
    given: {
      likesGiven,
      pointsGiven,
    },
    received: {
      pointsReceived,
      likesReceived,
      commentsReceived,
    },
    tokenomics: {
      dharma,
      aura,           // balance on-chain real (AURA en tu wallet)
      auraReclamable, // pendiente de reclamar off-chain
      auraBalance,    // balance on-chain real (formateado)
    },
  });
});
// ✅ Perfil básico (requerido por getGovernanceAccess en frontend)
app.get("/api/me", auth, async (c) => {
  const address = c.get("address");

  const user: any = await c.env.DB.prepare(
    "SELECT address FROM users WHERE address = ? LIMIT 1"
  ).bind(address).first();

  return c.json({
    ok: true,
    address,
    ens: null,
    roles: [],      // TODO: cuando tengas tabla roles
    nobleRank: "",  // TODO: nobleza cuando exista en BD
    veAlem: 0,      // TODO: staking cuando exista
    userExists: !!user,
  });
});

// ✅ Verificar JWT (usado por el frontend en verifyAndRestoreSession)
app.get("/api/me/verify", auth, async (c) => {
  const address = c.get("address");
  return c.json({ ok: true, address });
});

/* =========================================================
   AURA — Approve del agente (para permitir transferFrom)
   POST /api/aura/approve-agent
   Aprueba al contrato AURA para gastar tokens de la wallet agente (max uint256)
   ========================================================= */
app.post("/api/aura/approve-agent", async (c) => {
  const agentAddr = '0x8ed91bc2777577f9e9694a60dff515da8d13c9ac'; // Wallet Distribuidora (documentada en WALLETS.md)
  const auraContract = c.env.AURA_CONTRACT;
  if (!auraContract) {
    return c.json({ ok: false, error: "AURA_CONTRACT no configurado" }, 500);
  }
  const rpcUrl = 'https://1rpc.io/base';

  // approve(spender=contratoAURA, amount=type(uint256).max)
  const approveSelector = '0x095ea7b3';
  const spenderPadded = auraContract.slice(2).toLowerCase().padStart(64, '0');
  const maxUint = 'ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff';
  const data = approveSelector + spenderPadded + maxUint;

  // Consultar nonce y gas del RPC (requests secuenciales, no paralelas para evitar rate limit)
  const ac = new AbortController();
  const timer = setTimeout(() => ac.abort(), 15000);
  try {
    const nonceRes = await fetch(rpcUrl, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'eth_getTransactionCount', params: [agentAddr, 'latest'] }), signal: ac.signal });
    const nonceData: any = await nonceRes.json();
    if (!nonceData?.result) return c.json({ ok: false, error: 'No se pudo obtener nonce del RPC' }, 500);

    const gasPriceRes = await fetch(rpcUrl, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ jsonrpc: '2.0', id: 2, method: 'eth_gasPrice', params: [] }), signal: ac.signal });
    const gasPriceData: any = await gasPriceRes.json();
    if (!gasPriceData?.result) return c.json({ ok: false, error: 'No se pudo obtener gasPrice del RPC' }, 500);

    const chainIdRes = await fetch(rpcUrl, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ jsonrpc: '2.0', id: 3, method: 'eth_chainId', params: [] }), signal: ac.signal });
    const chainIdData: any = await chainIdRes.json();
    if (!chainIdData?.result) return c.json({ ok: false, error: 'No se pudo obtener chainId del RPC' }, 500);

    clearTimeout(timer);
    
    return c.json({
      ok: true,
      method: 'eth_sendTransaction',
      params: [{
        from: agentAddr,
        to: auraContract,
        data: data,
        nonce: nonceData.result,
        gasPrice: gasPriceData.result,
        chainId: chainIdData.result
      }],
      message: 'Copia estos params a MetaMask o llama a eth_sendTransaction desde el frontend con window.ethereum.request({ method: "eth_sendTransaction", params: [...] })'
    });
  } catch (e: any) {
    console.error("❌ Error en approve:", e.message);
    return c.json({ ok: false, error: `Error: ${e.message}` }, 500);
  }
});

/* =========================================================
   AURA — Claim de recompensas (Rulebook §5.1)
   POST /api/aura/claim
   Body: { amount: string (wei) }
   Prepara una tx de transfer(address,uint256) para firmar desde MetaMask.
   Devuelve los parámetros para eth_sendTransaction.
   ========================================================= */
app.post("/api/aura/claim", auth, async (c) => {
  const caller = c.get("address");
  const payload = await c.req.json().catch(() => ({} as any));
  let amountWei = String(payload.amount || "0");
  const auraContract = c.env.AURA_CONTRACT;
  const rpcUrl = 'https://1rpc.io/base';
  const agentAddr = '0x8ed91bc2777577f9e9694a60dff515da8d13c9ac'; // Wallet Distribuidora (documentada en WALLETS.md)

  if (!auraContract) {
    return c.json({ ok: false, error: "AURA_CONTRACT no configurado" }, 500);
  }

  // Construir datos de la tx: transfer(address,uint256)
  const transferSelector = '0xa9059cbb';
  const toPadded = caller.slice(2).toLowerCase().padStart(64, '0');
  const amountPadded = BigInt(amountWei).toString(16).padStart(64, '0');
  const data = transferSelector + toPadded + amountPadded;

  const ac = new AbortController();
  const timer = setTimeout(() => ac.abort(), 15000);
  try {
    const nonceRes = await fetch(rpcUrl, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'eth_getTransactionCount', params: [agentAddr, 'latest'] }), signal: ac.signal });
    const nonceData: any = await nonceRes.json();
    if (!nonceData?.result) return c.json({ ok: false, error: 'No se pudo obtener nonce del RPC' }, 500);

    const gasPriceRes = await fetch(rpcUrl, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ jsonrpc: '2.0', id: 2, method: 'eth_gasPrice', params: [] }), signal: ac.signal });
    const gasPriceData: any = await gasPriceRes.json();
    if (!gasPriceData?.result) return c.json({ ok: false, error: 'No se pudo obtener gasPrice del RPC' }, 500);

    const chainIdRes = await fetch(rpcUrl, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ jsonrpc: '2.0', id: 3, method: 'eth_chainId', params: [] }), signal: ac.signal });
    const chainIdData: any = await chainIdRes.json();
    if (!chainIdData?.result) return c.json({ ok: false, error: 'No se pudo obtener chainId del RPC' }, 500);

    clearTimeout(timer);
    
    return c.json({
      ok: true,
      method: 'eth_sendTransaction',
      params: [{
        from: agentAddr,
        to: auraContract,
        data: data,
        value: '0x0',
        nonce: nonceData.result,
        gasPrice: gasPriceData.result,
        chainId: chainIdData.result
      }],
      metadata: {
        from: agentAddr,
        to: caller,
        amountWei,
        amountReadable: (Number(amountWei) / 1e18).toFixed(4),
        auraContract
      },
      message: 'Usa window.ethereum.request({ method: "eth_sendTransaction", params: [...] }) desde el frontend para firmar con MetaMask'
    });
  } catch (e: any) {
    console.error("❌ Error en claim:", e.message);
    return c.json({ ok: false, error: `Error al preparar claim: ${e.message}` }, 500);
  }
});

/* =========================================================
   AURA — Mint del minter a la wallet distribuidora (via CDP)
   POST /api/aura/mint
   Solo accesible desde la wallet minter autenticada.
   Mintea AURA desde el contrato a la wallet distribuidora para que
   el agente pueda distribuirlos a los usuarios que reclaman.
   ========================================================= */
app.post("/api/aura/mint", auth, async (c) => {
  const caller = c.get("address");
  const minterAddress = c.env.MINTER_ADDRESS || '0x6A202f991c4C1df079449BE9847b1DaC3F51854f';
  const distributorAddress = c.env.DISTRIBUTOR_ADDRESS || '0x8ed91bc2777577f9e9694a60dff515da8d13c9ac';
  const auraContract = c.env.AURA_CONTRACT;
  const rpcUrl = 'https://1rpc.io/base';

  // Solo la wallet minter puede llamar este endpoint
  if (caller.toLowerCase() !== minterAddress.toLowerCase()) {
    return c.json({ ok: false, error: "Solo la wallet minter puede acuñar AURA" }, 403);
  }

  const payload = await c.req.json().catch(() => ({} as any));
  const amountWei = String(payload.amount || "0");
  if (!amountWei || amountWei === "0") {
    return c.json({ ok: false, error: "Se requiere amount (en wei)" }, 400);
  }

  if (!auraContract) {
    return c.json({ ok: false, error: "AURA_CONTRACT no configurado" }, 500);
  }

  // Llamar mint(address,uint256) en el contrato AURA
  const mintSelector = '0x40c10f19';
  const toPadded = distributorAddress.slice(2).toLowerCase().padStart(64, '0');
  const amountPadded = BigInt(amountWei).toString(16).padStart(64, '0');
  const data = mintSelector + toPadded + amountPadded;

  const ac = new AbortController();
  const timer = setTimeout(() => ac.abort(), 15000);
  try {
    const nonceRes = await fetch(rpcUrl, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'eth_getTransactionCount', params: [minterAddress, 'latest'] }), signal: ac.signal });
    const nonceData: any = await nonceRes.json();
    if (!nonceData?.result) return c.json({ ok: false, error: 'No se pudo obtener nonce del RPC' }, 500);

    const gasPriceRes = await fetch(rpcUrl, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ jsonrpc: '2.0', id: 2, method: 'eth_gasPrice', params: [] }), signal: ac.signal });
    const gasPriceData: any = await gasPriceRes.json();
    if (!gasPriceData?.result) return c.json({ ok: false, error: 'No se pudo obtener gasPrice del RPC' }, 500);

    const chainIdRes = await fetch(rpcUrl, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ jsonrpc: '2.0', id: 3, method: 'eth_chainId', params: [] }), signal: ac.signal });
    const chainIdData: any = await chainIdRes.json();
    if (!chainIdData?.result) return c.json({ ok: false, error: 'No se pudo obtener chainId del RPC' }, 500);

    clearTimeout(timer);

    return c.json({
      ok: true,
      method: 'eth_sendTransaction',
      params: [{
        from: minterAddress,
        to: auraContract,
        data: data,
        value: '0x0',
        nonce: nonceData.result,
        gasPrice: gasPriceData.result,
        chainId: chainIdData.result
      }],
      metadata: {
        to: distributorAddress,
        amountWei,
        amountReadable: (Number(amountWei) / 1e18).toFixed(4),
        auraContract
      },
      message: 'Firma esta tx desde la wallet minter para acuñar AURA a la wallet distribuidora.'
    });
  } catch (e: any) {
    console.error("❌ Error en mint:", e.message);
    return c.json({ ok: false, error: `Error: ${e.message}` }, 500);
  }
});

/* =========================================================
   AURA — Verificar saldo del agente distribuidor
   GET /api/aura/distributor-balance
   Devuelve el balance de AURA y ETH de la wallet distribuidora.
   El worker usa esto para decidir si necesita recargar.
   ========================================================= */
app.get("/api/aura/distributor-balance", async (c) => {
  const distributorAddress = c.env.DISTRIBUTOR_ADDRESS || '0x8ed91bc2777577f9e9694a60dff515da8d13c9ac';
  const auraContract = c.env.AURA_CONTRACT;
  const rpcUrl = 'https://1rpc.io/base';

  if (!auraContract) {
    return c.json({ ok: false, error: "AURA_CONTRACT no configurado" }, 500);
  }

  try {
    // Balance de AURA del distribuidor
    const balanceData = '0x70a08231' + distributorAddress.slice(2).toLowerCase().padStart(64, '0');
    const ac = new AbortController();
    const timer = setTimeout(() => ac.abort(), 10000);

    const res = await fetch(rpcUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0', id: 1, method: 'eth_call',
        params: [{ to: auraContract, data: balanceData }, 'latest']
      }),
      signal: ac.signal
    });
    clearTimeout(timer);

    const json: any = await res.json();
    let auraBalance = '0';
    if (json?.result && json.result !== '0x') {
      auraBalance = String(Number(BigInt(json.result) / 10n ** 16n / 100n));
    }

    // Balance de ETH del distribuidor
    const ethRes = await fetch(rpcUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0', id: 2, method: 'eth_getBalance',
        params: [distributorAddress, 'latest']
      })
    });
    const ethJson: any = await ethRes.json();
    let ethBalance = '0';
    if (ethJson?.result && ethJson.result !== '0x') {
      ethBalance = String(Number(BigInt(ethJson.result) / 10n ** 15n / 1000n));
    }

    return c.json({
      ok: true,
      distributorAddress,
      auraBalance,
      ethBalance,
      auraContract
    });
  } catch (e: any) {
    return c.json({ ok: false, error: `Error: ${e.message}` }, 500);
  }
});

/* =========================================================
   FARM — Reclamo diario de AURA (mini-game)
   POST /api/farm/claim + GET /api/farm/status
   IMPORTANTE: debe ir ANTES de app.all("/api/*") legacy router
========================================================= */

app.get("/api/farm/status", auth, async (c) => {
  const address = c.get("address");
  const today = new Date().toISOString().slice(0, 10);

  const claimToday = await c.env.DB.prepare(
    "SELECT amount, streak FROM farm_claims WHERE address = ? AND claim_date = ?"
  ).bind(address, today).first();

  // Último claim para calcular streak
  const lastClaim: any = await c.env.DB.prepare(
    "SELECT claim_date, streak FROM farm_claims WHERE address = ? ORDER BY created_at DESC LIMIT 1"
  ).bind(address).first();

  // Total acumulado farmeado
  const totalRow: any = await c.env.DB.prepare(
    "SELECT COALESCE(SUM(amount), 0) AS total FROM farm_claims WHERE address = ?"
  ).bind(address).first();

  // Historial reciente (últimos 10)
  const history: any[] = await c.env.DB.prepare(
    "SELECT claim_date, amount, streak FROM farm_claims WHERE address = ? ORDER BY created_at DESC LIMIT 10"
  ).bind(address).all();

  return c.json({
    ok: true,
    canClaim: !claimToday,
    claimedToday: !!claimToday,
    todayAmount: claimToday ? Number(claimToday.amount) : 0,
    streak: lastClaim ? Number(lastClaim.streak) : 0,
    totalFarmed: Number(totalRow?.total || 0),
    history: (history.results || []).map(h => ({
      date: h.claim_date,
      amount: Number(h.amount),
      streak: Number(h.streak)
    }))
  });
});

app.post("/api/farm/claim", auth, async (c) => {
  const address = c.get("address");
  const payload = await c.req.json().catch(() => ({} as any));
  const amount = Number(payload.amount) || 0;
  const streak = Number(payload.streak) || 1;

  // Validar límites
  if (amount <= 0 || amount > 100) {
    return c.json({ ok: false, error: "Cantidad inválida (0-100 AURA)" }, 400);
  }

  // Validar que no haya reclamado hoy
  const today = new Date().toISOString().slice(0, 10);
  const existing = await c.env.DB.prepare(
    "SELECT id FROM farm_claims WHERE address = ? AND claim_date = ?"
  ).bind(address, today).first();

  if (existing) {
    return c.json({ ok: false, error: "Ya reclamaste hoy. Vuelve mañana." }, 429);
  }

  // Insertar claim
  // NOTA: No escribimos en aura_ledger ni user_stats aquí porque
  // /api/me/stats ya suma farm_claims.SUM(amount) → auraFarmed → auraReclamable.
  // Así evitamos problemas de overflow con BigInt/Number para cantidades en wei.
  await c.env.DB.prepare(
    "INSERT INTO farm_claims (address, claim_date, amount, streak) VALUES (?, ?, ?, ?)"
  ).bind(address, today, String(amount), streak).run();

  return c.json({
    ok: true,
    amount,
    streak,
    today,
    message: `🎣 Has pescado ${amount} AURA!`
  });
});

app.post("/api/farm/reclaim-complete", auth, async (c) => {
  const address = c.get("address");

  // Sumar farm claims al aura_claimed antes de limpiar
  const farmRow: any = await c.env.DB.prepare(
    "SELECT COALESCE(SUM(amount), 0) AS total FROM farm_claims WHERE address = ?"
  ).bind(address).first();
  const totalFarm = Number(farmRow?.total || 0);

  // Incrementar aura_claimed en user_stats
  await c.env.DB.prepare(
    "INSERT INTO user_stats (address, aura_claimed, updated_at) VALUES (?, ?, unixepoch()) ON CONFLICT(address) DO UPDATE SET aura_claimed = aura_claimed + ?, updated_at = unixepoch()"
  ).bind(address, totalFarm).run();

  // Limpiar farm_claims del usuario
  await c.env.DB.prepare("DELETE FROM farm_claims WHERE address = ?").bind(address).run();

  return c.json({ ok: true, message: "Farm claims reclamados y aura_claimed actualizado." });
});

/* =========================================================
   ROUTERS (montar ANTES del legacy)
========================================================= */
app.route("/api/posts", posts);
app.route("/api/rooms", rooms);

// Endpoint debug para verificar env vars (ruta única que no captura legacy)
app.get("/___debug", async (c) => {
  const contract = c.env.AURA_CONTRACT || '(no configurado)';
  return c.json({
    AURA_CONTRACT: contract,
    AURA_RPC_URL: c.env.AURA_RPC_URL || '(no configurado)',
    contractLength: contract.length,
  });
});

/* =========================================================
   LEGACY ROUTER (API EXTRA – NO TOCAR)
========================================================= */
app.all("/api/*", (c) => {
  const legacy = router(c.req.raw);
  if (legacy) return legacy;
  return c.json({ error: "API route not found" }, 404);
});

/* =========================================================
   FRONTEND SPA FALLBACK
========================================================= */
app.all("*", async (c) => {
  return c.env.ASSETS.fetch(c.req.raw);
});

/* =========================================================
   DM (Direct Messages) — Chat tipo MSN
========================================================= */

// GET /api/dm/conversations — Lista de conversaciones del usuario
app.get("/api/dm/conversations", auth, async (c) => {
  const address = c.get("address");

  const rows = await c.env.DB.prepare(`
    SELECT DISTINCT
      CASE WHEN sender = ? THEN recipient ELSE sender END AS peer,
      (SELECT body FROM dms WHERE (sender = ? AND recipient = peer) OR (sender = peer AND recipient = ?) ORDER BY created_at DESC LIMIT 1) AS last_msg,
      (SELECT created_at FROM dms WHERE (sender = ? AND recipient = peer) OR (sender = peer AND recipient = ?) ORDER BY created_at DESC LIMIT 1) AS last_at,
      (SELECT COUNT(*) FROM dms WHERE recipient = ? AND sender = peer AND read = 0) AS unread
    FROM dms
    WHERE sender = ? OR recipient = ?
    ORDER BY last_at DESC
  `).bind(address, address, address, address, address, address, address, address).all();

  // Obtener ENS/display name de cada peer
  const conversations = [];
  for (const row of (rows.results || [])) {
    const peer: any = row;
    const userRow: any = await c.env.DB.prepare("SELECT ens FROM users WHERE address = ? LIMIT 1").bind(peer.peer).first();
    conversations.push({
      peer: peer.peer,
      displayName: userRow?.ens || shortAddr(peer.peer),
      lastMsg: peer.last_msg || '',
      lastAt: peer.last_at || '',
      unread: peer.unread || 0
    });
  }

  return c.json({ ok: true, conversations });
});

// GET /api/dm/:peer — Mensajes con un usuario específico
app.get("/api/dm/:peer", auth, async (c) => {
  const address = c.get("address");
  const peer = c.req.param('peer').toLowerCase();
  const before = c.req.query('before'); // paginación: timestamp ISO

  let query = `
    SELECT id, sender, recipient, body, read, created_at
    FROM dms
    WHERE (sender = ? AND recipient = ?) OR (sender = ? AND recipient = ?)
  `;
  const params: any[] = [address, peer, peer, address];

  if (before) {
    query += ` AND created_at < ?`;
    params.push(before);
  }

  query += ` ORDER BY created_at DESC LIMIT 50`;

  const rows = await c.env.DB.prepare(query).bind(...params).all();

  // Marcar como leídos los mensajes del peer hacia el usuario
  await c.env.DB.prepare("UPDATE dms SET read = 1 WHERE sender = ? AND recipient = ? AND read = 0")
    .bind(peer, address).run();

  return c.json({
    ok: true,
    messages: (rows.results || []).reverse(),
    peer
  });
});

// POST /api/dm/send — Enviar mensaje a un usuario
app.post("/api/dm/send", auth, async (c) => {
  const address = c.get("address");
  const { to, body } = await c.req.json();

  if (!to || !body || typeof body !== 'string' || body.trim().length === 0) {
    return c.json({ ok: false, error: "Faltan campos: to (address) y body (texto)" }, 400);
  }
  if (body.length > 2000) {
    return c.json({ ok: false, error: "Mensaje demasiado largo (máx 2000 caracteres)" }, 400);
  }

  const peer = to.toLowerCase();
  if (peer === address.toLowerCase()) {
    return c.json({ ok: false, error: "No puedes enviarte mensajes a ti mismo" }, 400);
  }

  const result = await c.env.DB.prepare(
    "INSERT INTO dms (sender, recipient, body) VALUES (?, ?, ?)"
  ).bind(address, peer, body.trim()).run();

  return c.json({
    ok: true,
    message: {
      id: result.meta.last_row_id,
      sender: address,
      recipient: peer,
      body: body.trim(),
      read: 0,
      created_at: new Date().toISOString()
    }
  });
});

// POST /api/dm/read/:peer — Marcar conversación como leída
app.post("/api/dm/read/:peer", auth, async (c) => {
  const address = c.get("address");
  const peer = c.req.param('peer').toLowerCase();

  await c.env.DB.prepare("UPDATE dms SET read = 1 WHERE sender = ? AND recipient = ? AND read = 0")
    .bind(peer, address).run();

  return c.json({ ok: true });
});

// GET /api/dm/unread — Total de mensajes no leídos
app.get("/api/dm/unread", auth, async (c) => {
  const address = c.get("address");
  const row: any = await c.env.DB.prepare(
    "SELECT COUNT(*) AS n FROM dms WHERE recipient = ? AND read = 0"
  ).bind(address).first();

  return c.json({ ok: true, unread: Number(row?.n ?? 0) });
});

/* =========================
   🛒 MARKETPLACE P2P (NFTs por AURA)
========================= */

// Listar items en venta
app.get("/api/market/items", async (c) => {
  const rows: any[] = await c.env.DB.prepare(
    `SELECT m.id, m.seller, m.nft_name, m.nft_image, m.nft_contract, m.nft_token_id,
            m.price_aura, m.created_at,
            COALESCE(u.display_name, '') AS seller_name
     FROM marketplace m
     LEFT JOIN user_profiles u ON u.address = m.seller
     WHERE m.sold = 0
     ORDER BY m.created_at DESC
     LIMIT 50`
  ).all();
  return c.json({ ok: true, items: rows.results ?? [] });
});

// Listar items propios (vendidos + activos)
app.get("/api/market/my", auth, async (c) => {
  const address = c.get("address");
  const rows: any[] = await c.env.DB.prepare(
    `SELECT * FROM marketplace WHERE seller = ? ORDER BY created_at DESC`
  ).bind(address).all();
  return c.json({ ok: true, items: rows.results ?? [] });
});

// Publicar item en venta
app.post("/api/market/list", auth, async (c) => {
  const address = c.get("address");
  const body: any = await c.req.json();
  const { nftName, nftImage, nftContract, nftTokenId, priceAura } = body;

  if (!nftName || !priceAura || priceAura <= 0) {
    return c.json({ ok: false, error: "Faltan campos obligatorios (nftName, priceAura)" }, 400);
  }

  await c.env.DB.prepare(
    `INSERT INTO marketplace (seller, nft_name, nft_image, nft_contract, nft_token_id, price_aura)
     VALUES (?, ?, ?, ?, ?, ?)`
  ).bind(address, nftName.trim(), nftImage ?? '', nftContract ?? '', nftTokenId ?? '', priceAura).run();

  return c.json({ ok: true });
});

// Comprar item (transferir AURA + marcar vendido)
app.post("/api/market/buy/:id", auth, async (c) => {
  const buyer = c.get("address");
  const id = Number(c.req.param("id"));
  if (!Number.isFinite(id)) return c.json({ ok: false, error: "ID inválido" }, 400);

  const item: any = await c.env.DB.prepare(
    "SELECT * FROM marketplace WHERE id = ? AND sold = 0"
  ).bind(id).first();

  if (!item) return c.json({ ok: false, error: "Item no disponible o ya vendido" }, 404);
  if (item.seller === buyer) return c.json({ ok: false, error: "No puedes comprarte tu propio item" }, 400);

  // Devolvemos los datos para que el frontend prepare la tx de AURA
  return c.json({
    ok: true,
    item: {
      id: item.id,
      seller: item.seller,
      nftName: item.nft_name,
      priceAura: item.price_aura,
    },
    buyer,
    // El frontend debe llamar claim-like para transferir AURA del buyer al seller
    // luego marcar como vendido via POST /api/market/sold/:id
  });
});

// Confirmar venta (marcar como vendido después de la tx en cadena)
app.post("/api/market/sold/:id", auth, async (c) => {
  const address = c.get("address");
  const id = Number(c.req.param("id"));
  if (!Number.isFinite(id)) return c.json({ ok: false, error: "ID inválido" }, 400);

  const item: any = await c.env.DB.prepare(
    "SELECT * FROM marketplace WHERE id = ? AND sold = 0"
  ).bind(id).first();

  if (!item) return c.json({ ok: false, error: "Item no encontrado" }, 404);
  if (item.seller !== address) return c.json({ ok: false, error: "Solo el vendedor puede confirmar" }, 403);

  await c.env.DB.prepare("UPDATE marketplace SET sold = 1 WHERE id = ?").bind(id).run();
  return c.json({ ok: true });
});

export default app;


