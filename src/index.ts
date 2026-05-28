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

  const dharma = pointsReceived + likesReceived;

  // AURA se genera 1:1 con Dharma (cada like/point = +1 AURA acumulado).
  // El minteo on-chain ocurre por epoch (semanal) — Rulebook §5.1 — para evitar
  // gas por cada interacción. El usuario reclama su AURA acumulado en 1 tx semanal.
  // El perfil muestra: auraGenerado (total acumulado off-chain) y auraReclamable
  // (lo generado en el epoch actual que aún no se minteó).
  // El balance on-chain (auraBalance) es lo que el usuario tiene disponible para gastar/swapear.

  // TODO: almacenar en D1 el último epoch reclamado por usuario para calcular auraReclamable
  const aura = dharma; // total generado off-chain (visual)
  let auraReclamable = 0; // generado en epoch actual, pendiente de mintear
  let auraBalance = '0';
  const auraContract = c.env.AURA_CONTRACT;
  if (auraContract) {
    try {
      const rpcUrl = c.env.AURA_RPC_URL || 'https://mainnet.base.org';
      const data = '0x70a08231' + address.slice(2).padStart(64, '0');
      const rpcRes = await fetch(rpcUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jsonrpc: '2.0',
          id: 1,
          method: 'eth_call',
          params: [{ to: auraContract, data }, 'latest']
        })
      });
      if (rpcRes.ok) {
        const json: any = await rpcRes.json();
        if (json?.result && json.result !== '0x') {
          auraBalance = String(BigInt(json.result) / 10n ** 16n / 100n);
        }
      }
    } catch (e) {
      console.warn('⚠️ AURA RPC error:', e);
    }
  }

  return c.json({
    ok: true,
    address,
    activity: {
      posts: Number((postsRow as any)?.n ?? 0),
      comments: Number((commentsRow as any)?.n ?? 0),
    },
    received: {
      pointsReceived,
      likesReceived,
      commentsReceived,
    },
    tokenomics: {
      dharma,
      aura,           // total generado off-chain (visual, coincide con dharma)
      auraReclamable, // pendiente de mintear on-chain este epoch
      auraBalance,    // balance on-chain real (después de gastos/swaps)
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
   AURA — Claim de recompensas (Rulebook §5.1)
   POST /api/aura/claim
   Body: { to: string, amount: string (wei) }
   Devuelve: tx preparada lista para firmar con MetaMask
   El usuario firma desde el frontend (sin private key en el Worker)
========================================================= */
app.post("/api/aura/claim", auth, async (c) => {
  const caller = c.get("address");
  const payload = await c.req.json().catch(() => ({} as any));
  const to = String(payload.to || caller).toLowerCase();
  const amountWei = String(payload.amount || "0");
  const auraContract = c.env.AURA_CONTRACT;
  const rpcUrl = c.env.AURA_RPC_URL || 'https://mainnet.base.org';

  if (!auraContract) {
    return c.json({ ok: false, error: "AURA_CONTRACT no configurado" }, 500);
  }

  // 1. Validar hard cap on-chain
  try {
    const supplyData = '0x18160ddd'; // totalSupply()
    const capData = '0xfb86a404';    // hardCap()
    const [supplyRes, capRes] = await Promise.all([
      fetch(rpcUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'eth_call', params: [{ to: auraContract, data: supplyData }, 'latest'] })
      }),
      fetch(rpcUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jsonrpc: '2.0', id: 2, method: 'eth_call', params: [{ to: auraContract, data: capData }, 'latest'] })
      })
    ]);
    const supplyJson: any = await supplyRes.json();
    const capJson: any = await capRes.json();
    if (supplyJson?.result && capJson?.result) {
      const currentSupply = BigInt(supplyJson.result);
      const hardCap = BigInt(capJson.result);
      const amount = BigInt(amountWei);
      if (currentSupply + amount > hardCap) {
        return c.json({ ok: false, error: 'ExceedsHardCap', currentSupply: currentSupply.toString(), hardCap: hardCap.toString() }, 400);
      }
    }
  } catch (e: any) {
    console.warn('⚠️ Error validando hard cap:', e.message);
  }

  // 2. Obtener nonce del minter (0x6A202f...) para construir la tx
  let nonce = '0x0';
  try {
    const nonceRes = await fetch(rpcUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 3,
        method: 'eth_getTransactionCount',
        params: ['0x6A202f991c4C1df079449BE9847b1DaC3F51854f', 'latest']
      })
    });
    const nonceJson: any = await nonceRes.json();
    if (nonceJson?.result) nonce = nonceJson.result;
  } catch (e: any) {
    console.warn('⚠️ Error obteniendo nonce:', e.message);
  }

  // 3. Construir datos de la tx (mint(address,uint256) = 0x40c10f19)
  const mintSelector = '0x40c10f19';
  const toPadded = to.slice(2).padStart(64, '0');
  const amountPadded = BigInt(amountWei).toString(16).padStart(64, '0');
  const data = mintSelector + toPadded + amountPadded;

  // 4. Estimar gas
  let gasEstimate = '0x52080'; // 336k default
  try {
    const gasRes = await fetch(rpcUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 4,
        method: 'eth_estimateGas',
        params: [{
          from: '0x6A202f991c4C1df079449BE9847b1DaC3F51854f',
          to: auraContract,
          data
        }]
      })
    });
    const gasJson: any = await gasRes.json();
    if (gasJson?.result) gasEstimate = gasJson.result;
  } catch (e: any) {
    console.warn('⚠️ Error estimando gas:', e.message);
  }

  // 5. Obtener gas price
  let gasPrice = '0x59682f00'; // 1.5 gwei default
  try {
    const gasPriceRes = await fetch(rpcUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ jsonrpc: '2.0', id: 5, method: 'eth_gasPrice', params: [] })
    });
    const gpJson: any = await gasPriceRes.json();
    if (gpJson?.result) gasPrice = gpJson.result;
  } catch (e: any) {
    console.warn('⚠️ Error obteniendo gas price:', e.message);
  }

  // 6. Devolver tx preparada para que el frontend la firme con eth_sendTransaction
  // El from es la wallet minter (0x6A202f...) — el usuario debe tenerla en MetaMask
  return c.json({
    ok: true,
    tx: {
      from: '0x6A202f991c4C1df079449BE9847b1DaC3F51854f',
      to: auraContract,
      data,
      nonce,
      gas: gasEstimate,
      gasPrice,
      value: '0x0',
      chainId: '0x2105' // 8453 Base Mainnet
    },
    metadata: {
      to,
      amountWei,
      amountReadable: (Number(amountWei) / 1e18).toFixed(4),
      auraContract
    }
  });
});

// Endpoint legacy para compatibilidad (instrucciones manuales)
app.post("/api/aura/mint", auth, async (c) => {
  return c.json({
    ok: false,
    error: "Usa POST /api/aura/claim en su lugar. Este endpoint prepara la tx para firmar con MetaMask.",
    instructions: "Haz POST a /api/aura/claim con { amount: 'string en wei' } y firma la tx devuelta con eth_sendTransaction desde el frontend."
  }, 400);
});

/* =========================================================
   ROUTERS (montar ANTES del legacy)
========================================================= */
app.route("/api/posts", posts);
app.route("/api/rooms", rooms);

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

export default app;


