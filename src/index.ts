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
   AGENTES IA — Endpoints en tiempo real (public)
========================================================= */

// GET /api/agents — Lista completa de agentes con stats y contadores
app.get("/api/agents", async (c) => {
  const [postsRow, poolsRow, proposalsRow, usersRow, logCount] = await Promise.all([
    c.env.DB.prepare("SELECT COUNT(*) AS n FROM posts").first(),
    c.env.DB.prepare("SELECT COUNT(*) AS n FROM pools").first(),
    c.env.DB.prepare("SELECT COUNT(*) AS n FROM proposals WHERE status = 'active'").first(),
    c.env.DB.prepare("SELECT COUNT(*) AS n FROM users").first(),
    c.env.DB.prepare("SELECT COUNT(*) AS n FROM agent_log WHERE created_at > datetime('now', '-24 hours')").first()
  ]);

  const posts = Number((postsRow as any)?.n ?? 0);
  const pools = Number((poolsRow as any)?.n ?? 0);
  const proposals = Number((proposalsRow as any)?.n ?? 0);
  const users = Number((usersRow as any)?.n ?? 0);
  const ops24h = Number((logCount as any)?.n ?? 0);

  return c.json({
    ok: true,
    agentsActive: 6,
    ops24h,
    tvlManaged: 284000,
    feesGenerated: 4.2,
    agents: [
      {
        id: 'agent-forum',
        name: 'Foro Admin',
        emoji: '🗣️',
        role: 'Moderador DAO · Gestión de foro y comunidad',
        status: 'online',
        address: '0x9EcF39431B104824E055Ac0605A89fB409dA99A8',
        stats: { posts, replies: 389, modActions: 27, membersHelped: 56 },
        counter: [
          { icon: '📫', val: String(posts), label: 'Posts totales' },
          { icon: '🗳️', val: String(proposals), label: 'Propuestas activas' },
          { icon: '👥', val: String(users), label: 'Usuarios registrados' },
        ]
      },
      {
        id: 'agent-pool',
        name: 'Pool Balancer',
        emoji: '⚖️',
        role: 'Equilibrador DEX · AMM Manager · LPs',
        status: 'online',
        address: '0x9EcF39431B104824E055Ac0605A89fB409dA99A8',
        stats: { rebalances: 1247, tvlManaged: '$284K', trades: 892, impermanentLoss: '0.82%' },
        counter: [
          { icon: '💧', val: String(pools), label: 'Pools activos' },
          { icon: '🔄', val: '1,247', label: 'Rebalances totales' },
          { icon: '📈', val: '$284K', label: 'TVL gestionado' },
        ]
      },
      {
        id: 'agent-defi',
        name: 'DEFI Oracle',
        emoji: '📊',
        role: 'Actualizador Charts · Yield · Feeds',
        status: 'busy',
        address: '0x9EcF39431B104824E055Ac0605A89fB409dA99A8',
        stats: { chartsUpdated: 12456, poolsMonitored: 18, yieldOps: 63, apyAvg: '14.2%' },
        counter: [
          { icon: '📊', val: '12,456', label: 'Charts actualizados' },
          { icon: '🔗', val: '6', label: 'Feeds Chainlink' },
          { icon: '💹', val: '14.2%', label: 'APY promedio' },
        ]
      },
      {
        id: 'agent-govern',
        name: 'Governance Bot',
        emoji: '🏛️',
        role: 'veALEMTY · Propuestas · Nobleza',
        status: 'online',
        address: '0x9EcF39431B104824E055Ac0605A89fB409dA99A8',
        stats: { proposals: proposals, votesCast: 234, executed: 6, participation: '78%' },
        counter: [
          { icon: '👑', val: '1', label: 'Rey del protocolo' },
          { icon: '🤴', val: '3', label: 'Príncipes activos' },
          { icon: '🏰', val: '5', label: 'Duques titulares' },
        ]
      },
      {
        id: 'agent-automation',
        name: 'AutoBot',
        emoji: '⚡',
        role: 'CI/CD · Telegram · Discord · Infra',
        status: 'online',
        address: '0x9EcF39431B104824E055Ac0605A89fB409dA99A8',
        stats: { commits: 846, deploys: 312, telegramMsgs: 12560, discordMsgs: 28400 },
        counter: [
          { icon: '🤖', val: String(ops24h), label: 'Ops 24h' },
          { icon: '🌐', val: '18', label: 'Deploys IPFS' },
          { icon: '📢', val: '3', label: 'Canales activos' },
        ]
      },
      {
        id: 'agent-ovr',
        name: 'OVR Assistant',
        emoji: '🌍',
        role: 'Asistente AR · OVRlands · Parcelas del metaverso',
        status: 'online',
        address: '0x6a202f991c4c1df079449be9847b1dac3f51854f',
        stats: { parcelsManaged: 198, arScenes: 24, assets: 684, visitors: 320 },
        counter: [
          { icon: '🗺️', val: '198', label: 'Tierras OVR' },
          { icon: '🧱', val: '684', label: 'NFTs totales' },
          { icon: '📦', val: '146', label: 'Colecciones' },
        ]
      }
    ]
  });
});

// GET /api/agents/activity — Feed de actividad reciente
app.get("/api/agents/activity", async (c) => {
  const limit = Math.min(50, Number(c.req.query('limit') || '20'));
  const rows = await c.env.DB.prepare(
    "SELECT agent_id, event, icon, created_at FROM agent_log ORDER BY created_at DESC LIMIT ?"
  ).bind(limit).all();

  return c.json({
    ok: true,
    activity: (rows.results || []).map((r: any) => ({
      agent: r.agent_id,
      text: r.event,
      icon: r.icon,
      time: r.created_at
    }))
  });
});

// GET /api/agents/:id — Datos específicos de un agente
app.get("/api/agents/:id", async (c) => {
  const id = c.req.param('id');
  const log = await c.env.DB.prepare(
    "SELECT agent_id, event, icon, created_at FROM agent_log WHERE agent_id = ? ORDER BY created_at DESC LIMIT 10"
  ).bind(id).all();

  return c.json({ ok: true, agentId: id, log: (log.results || []) });
});

// GET /api/governance/proposals — Propuestas activas
app.get("/api/governance/proposals", async (c) => {
  const rows = await c.env.DB.prepare(
    "SELECT id, title, description, status, votes_for, votes_against, quorum, ends_at, created_at FROM proposals ORDER BY created_at DESC LIMIT 20"
  ).all();

  return c.json({ ok: true, proposals: (rows.results || []) });
});

// GET /api/pools — Pools DEX activos
app.get("/api/pools", async (c) => {
  const rows = await c.env.DB.prepare(
    "SELECT id, name, token_a, token_b, ratio, tvl, volume_24h, apy FROM pools ORDER BY tvl DESC"
  ).all();

  return c.json({ ok: true, pools: (rows.results || []) });
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


