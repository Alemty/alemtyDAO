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

  const dharma = pointsReceived + likesReceived;
  const aura = dharma;

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
    },
    tokenomics: {
      dharma,
      aura,
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


