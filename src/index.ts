
// src/index.ts
import { Hono } from "hono";
import { cors } from "hono/cors";

import { auth } from "./middleware/auth";

// import { signJwt } from "./lib/jwt"; // usado solo en endpoints dev
import { signJwt } from "./lib/jwt";

// ✅ Router legacy (no tocar)
import { router } from "./router";

// ✅ Posts router (comments + react + posts)
import { posts } from "./routes/posts";

/* =========================
   Tipos
========================= */
export type Bindings = {
  DB: D1Database;
  SESSION_SECRET: string;
  ASSETS: Fetcher;
};

export type Vars = {
  address: string;
};

/* =========================
   App
========================= */
const app = new Hono<{ Bindings: Bindings; Variables: Vars }>();

/* =========================
   ✅ CORS GLOBAL (DEV + PROD + Pages Preview + Local ANY PORT)
   - Permite Authorization (JWT)
   - Permite previews: https://<hash>.alemtydao.pages.dev
   - Permite localhost / 127.0.0.1 con CUALQUIER puerto (ej. 51023)
========================= */

const CORS_ALLOWLIST = new Set([
  // PROD
  "https://alemtydao.pages.dev",
  "https://alemtydao.alejandrogtzz93.workers.dev",
  "https://alemty.eth.limo",
]);

function corsOrigin(origin: string | undefined): string | null {
  if (!origin) return null;

  // ✅ Allow exact matches (prod)
  if (CORS_ALLOWLIST.has(origin)) return origin;

  try {
    const u = new URL(origin);

    // ✅ Allow Pages preview deploys
    if (u.hostname.endsWith(".alemtydao.pages.dev")) return origin;

    // ✅ Allow any localhost/127.0.0.1 port (serve elige puertos dinámicos)
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
    allowMethods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowHeaders: ["Authorization", "Content-Type"],
    exposeHeaders: ["Content-Type"],
    maxAge: 86400,
    credentials: true,
  })
);

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

/* =========================================================
   PERFIL / STATS
========================================================= */

app.get("/api/me/stats", auth, async (c) => {
  const address = c.get("address");

  // Conteos personales
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

  // ✅ Dharma: por acuerdo: “punto + like recibido”
  const dharma = pointsReceived + likesReceived;
  const aura = dharma; // 1:1 por ahora

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

/* =========================================================
   POSTS ROUTER (✅ AQUÍ SE MONTA posts.ts)
========================================================= */
app.route("/api/posts", posts);

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




