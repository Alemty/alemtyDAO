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
  // "AURA por reclamar" = (dharma + auraFarmed) - auraOnChain
  // NUNCA se suman off-chain + on-chain. Son conceptos separados.

  const farmRow: any = await c.env.DB.prepare(
    "SELECT COALESCE(SUM(amount), 0) AS total FROM farm_claims WHERE address = ?"
  ).bind(address).first();
  const auraFarmed = Number(farmRow?.total || 0);

  // AURA off-chain total generado por interacciones (dharma + farm)
  const auraAccumulado = dharma + auraFarmed;

  // AURA on-chain: balance real desde el contrato ERC-20
  // Se consulta via RPC y se cachea en user_stats.aura_balance (60s)
  let auraOnChain = 0;
  let auraBalance = '0';

  // auraClaimed: cuánto AURA se ha marcado como "reclamado" off-chain
  // (se actualiza cuando el usuario hace Reclaim y la tx se confirma)
  // Se usa para calcular auraReclamable = auraAccumulado - auraClaimed
  // Esto evita que el balance on-chain total (incluyendo mints iniciales)
  // afecte el cálculo del reclamable.
  const claimedRow: any = await c.env.DB.prepare(
    "SELECT aura_claimed FROM user_stats WHERE address = ?"
  ).bind(address).first();
  const auraClaimed = Number(claimedRow?.aura_claimed ?? 0);

  // Consultar balance on-chain via RPC con caché en D1
  const auraContract = c.env.AURA_CONTRACT;
  const cachedRow: any = await c.env.DB.prepare(
    "SELECT aura_balance, updated_at FROM user_stats WHERE address = ?"
  ).bind(address).first();
  const now = Math.floor(Date.now() / 1000);
  const cacheValid = cachedRow && (now - (cachedRow.updated_at || 0)) < 60;
  if (cacheValid && Number(cachedRow.aura_balance) > 0) {
    auraOnChain = Number(cachedRow.aura_balance);
    auraBalance = String(auraOnChain);
  }

  // Consultar RPC si no hay caché
  if (auraContract && !cacheValid) {
    const rpcUrls = [
      'https://base.drpc.org',
      'https://base-rpc.publicnode.com',
    ];
    const data = '0x70a08231' + address.slice(2).padStart(64, '0');
    for (const rpcUrl of rpcUrls) {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 2000);
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
            auraOnChain = Number(BigInt(json.result) / 10n ** 16n / 100n);
            auraBalance = String(auraOnChain);
            // Guardar en D1 el balance on-chain cachead0
            await c.env.DB.prepare(
              "INSERT OR REPLACE INTO user_stats (address, aura_balance, updated_at, points_received, likes_received, dharma_total, level, karma_debt) VALUES (?, ?, ?, COALESCE((SELECT points_received FROM user_stats WHERE address = ?), 0), COALESCE((SELECT likes_received FROM user_stats WHERE address = ?), 0), COALESCE((SELECT dharma_total FROM user_stats WHERE address = ?), 0), COALESCE((SELECT level FROM user_stats WHERE address = ?), 1), 0)"
            ).bind(address, auraOnChain, now, address, address, address, address).run();
            break;
          }
        }
      } catch (_) {}
    }
  }

  // aura = balance on-chain real (lo que el usuario puede gastar/swapear)
  const aura = auraOnChain;
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
      aura,           // balance on-chain real (o fallback off-chain)
      auraReclamable, // pendiente de reclamar (solo farm)
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
   AURA — Approve del agente (para permitir transferFrom)
   POST /api/aura/approve-agent
   Aprueba al contrato AURA para gastar tokens de la wallet agente (max uint256)
   ========================================================= */
app.post("/api/aura/approve-agent", async (c) => {
  const agentPk = c.env.AGENT_PRIVATE_KEY;
  if (!agentPk) {
    return c.json({ ok: false, error: "AGENT_PRIVATE_KEY no configurado" }, 500);
  }
  const agentAddr = '0x02756cb3a5413cd616d192c56dfdce80dd66706e';
  const auraContract = c.env.AURA_CONTRACT;
  if (!auraContract) {
    return c.json({ ok: false, error: "AURA_CONTRACT no configurado" }, 500);
  }
  const rpcUrl = 'https://base-rpc.publicnode.com';

  // approve(spender=contratoAURA, amount=type(uint256).max)
  const approveSelector = '0x095ea7b3';
  const spenderPadded = auraContract.slice(2).toLowerCase().padStart(64, '0');
  const maxUint = 'ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff';
  const data = approveSelector + spenderPadded + maxUint;

  try {
    const { signAndSendTransaction } = await import('./utils/signer');
    
    const txHash = await signAndSendTransaction(agentPk, {
      to: auraContract,
      data,
      from: agentAddr
    }, rpcUrl);
    
    return c.json({
      ok: true,
      txHash,
      message: 'Aprobación exitosa. El agente ahora permite transferencias desde el contrato AURA.',
      agentAddress: agentAddr
    });
  } catch (e: any) {
    console.error("❌ Error en approve:", e.message, e.stack);
    return c.json({ ok: false, error: `Error al aprobar: ${e.message}` }, 500);
  }
});

/* =========================================================
   AURA — Claim de recompensas (Rulebook §5.1)
   POST /api/aura/claim
   Body: { amount: string (wei) }
   Firma y envía una tx de transfer(address,uint256) desde la wallet agente hacia el usuario.
   El agente paga el gas (tiene ETH para eso). El usuario solo presiona "Reclaim" y recibe AURA.
   ========================================================= */
app.post("/api/aura/claim", auth, async (c) => {
  const caller = c.get("address");
  const payload = await c.req.json().catch(() => ({} as any));
  let amountWei = String(payload.amount || "0");
  const auraContract = c.env.AURA_CONTRACT;
  const rpcUrl = 'https://base-rpc.publicnode.com';

  if (!auraContract) {
    return c.json({ ok: false, error: "AURA_CONTRACT no configurado" }, 500);
  }

  const agentPk = c.env.AGENT_PRIVATE_KEY;
  if (!agentPk) {
    return c.json({ ok: false, error: "AGENT_PRIVATE_KEY no configurado. Configúralo como secreto en Cloudflare Workers." }, 500);
  }

  // Construir datos de la tx: transfer(address,uint256)
  // selector: 0xa9059cbb
  const transferSelector = '0xa9059cbb';
  const toPadded = caller.slice(2).toLowerCase().padStart(64, '0');
  const amountPadded = BigInt(amountWei).toString(16).padStart(64, '0');
  const data = transferSelector + toPadded + amountPadded;

  try {
    const { signAndSendTransaction } = await import('./utils/signer');
    console.log("🚀 Claim request:", { caller, amountWei, dataLen: data.length });
    
    const agentAddr = '0x02756cb3a5413cd616d192c56dfdce80dd66706e';
    const txHash = await signAndSendTransaction(agentPk, {
      to: auraContract,
      data,
      from: agentAddr
    }, rpcUrl);

    return c.json({
      ok: true,
      txHash,
      metadata: {
        from: c.env.AGENT_ADDRESS || '',
        to: caller,
        amountWei,
        amountReadable: (Number(amountWei) / 1e18).toFixed(4),
        auraContract
      }
    });
  } catch (e: any) {
    console.error("❌ Error en transfer:", e.message, e.stack);
    return c.json({ ok: false, error: `Error al transferir AURA: ${e.message}`, stack: e.stack }, 500);
  }
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


