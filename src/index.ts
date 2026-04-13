
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
   ✅ CORS GLOBAL (DEV + PROD)
========================= */
app.use(
  "/*",
  cors({
    origin: [
      "http://127.0.0.1:5500",
      "http://localhost:5500",
      "https://alemtydao.pages.dev",
      "https://alemtydao.alejandrogtzz93.workers.dev",
      "https://alemty.eth.limo",
    ],
    allowMethods: ["GET", "POST", "OPTIONS"],
    allowHeaders: ["Authorization", "Content-Type"],
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

  const postsCount = await c.env.DB.prepare(
    "SELECT COUNT(*) AS n FROM posts WHERE author = ?"
  ).bind(address).first();

  const commentsCount = await c.env.DB.prepare(
    "SELECT COUNT(*) AS n FROM comments WHERE author = ?"
  ).bind(address).first();

  const pointsReceived = await c.env.DB.prepare(
    `
    SELECT COUNT(*) AS n
    FROM reactions r
    JOIN posts p ON p.id = r.post_id
    WHERE p.author = ? AND r.type = 'point'
    `
  ).bind(address).first();

  const likesReceived = await c.env.DB.prepare(
    `
    SELECT COUNT(*) AS n
    FROM reactions r
    JOIN posts p ON p.id = r.post_id
    WHERE p.author = ? AND r.type = 'like'
    `
  ).bind(address).first();

  return c.json({
    ok: true,
    address,
    activity: {
      posts: Number((postsCount as any)?.n ?? 0),
      comments: Number((commentsCount as any)?.n ?? 0),
    },
    received: {
      pointsReceived: Number((pointsReceived as any)?.n ?? 0),
      likesReceived: Number((likesReceived as any)?.n ?? 0),
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



