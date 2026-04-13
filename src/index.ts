
// src/index.ts
import { Hono } from "hono";
import { cors } from "hono/cors";

import { auth } from "./middleware/auth";
import { signJwt } from "./lib/jwt";

// ✅ Router legacy (no tocar)
import { router } from "./router";

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
   API: PERFIL / STATS
========================================================= */
app.get("/api/me/stats", auth, async (c) => {
  const address = c.get("address");

  const posts = await c.env.DB.prepare(
    "SELECT COUNT(*) AS n FROM posts WHERE author = ?"
  ).bind(address).first();

  const comments = await c.env.DB.prepare(
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

  const lastPost = await c.env.DB.prepare(
    `
    SELECT id, title, created_at
    FROM posts
    WHERE author = ?
    ORDER BY created_at DESC
    LIMIT 1
    `
  ).bind(address).first();

  const lastComment = await c.env.DB.prepare(
    `
    SELECT post_id, body, created_at
    FROM comments
    WHERE author = ?
    ORDER BY created_at DESC
    LIMIT 1
    `
  ).bind(address).first();

  const dharma = Number((pointsReceived as any)?.n ?? 0);
  const aura = dharma; // por ahora 1:1, luego se liga al ledger

  return c.json({
    ok: true,
    address,
    activity: {
      posts: Number((posts as any)?.n ?? 0),
      comments: Number((comments as any)?.n ?? 0),
    },
    received: {
      pointsReceived: dharma,
      likesReceived: Number((likesReceived as any)?.n ?? 0),
    },
    tokenomics: {
      dharma,
      aura,
    },
    last: {
      post: lastPost ?? null,
      comment: lastComment ?? null,
    },
  });
});

/* =========================
   DEBUG TOKEN (solo dev)
========================= */
app.get("/api/dev/token/:address", async (c) => {
  const address = c.req.param("address").toLowerCase();
  const now = Math.floor(Date.now() / 1000);
  const exp = now + 60 * 60;

  const token = await signJwt(
    {
      iss: "alemtydao-siwe",
      aud: "alemtydao-api",
      sub: address,
      iat: now,
      exp,
    },
    c.env.SESSION_SECRET
  );

  return c.json({ token, address, expiresAt: exp });
});

/* =========================
   Auth test
========================= */
app.get("/api/me", auth, async (c) => {
  const address = c.get("address");

  await c.env.DB.prepare(
    "INSERT OR IGNORE INTO users(address) VALUES (?)"
  )
    .bind(address)
    .run();

  const user = await c.env.DB.prepare(
    "SELECT address, ens, created_at FROM users WHERE address = ?"
  )
    .bind(address)
    .first();

  return c.json({ user });
});

/* =========================================================
   POSTS
========================================================= */
app.get("/api/posts", async (c) => {
  const limit = Math.min(Number(c.req.query("limit") || 20), 50);

  const result = await c.env.DB.prepare(
    `SELECT id, author, title, body, created_at
     FROM posts
     ORDER BY created_at DESC
     LIMIT ?`
  )
    .bind(limit)
    .all();

  return c.json({ posts: result.results });
});

app.get("/api/posts/:id", async (c) => {
  const id = Number(c.req.param("id"));
  if (!Number.isFinite(id)) return c.json({ error: "Invalid id" }, 400);

  const post = await c.env.DB.prepare(
    `SELECT id, author, title, body, created_at
     FROM posts
     WHERE id = ?`
  )
    .bind(id)
    .first();

  if (!post) return c.json({ error: "Not found" }, 404);
  return c.json({ post });
});

app.post("/api/posts", auth, async (c) => {
  const address = c.get("address");
  const payload = await c.req.json().catch(() => ({} as any));

  const title = String(payload.title || "").trim();
  const body = String(payload.body || "").trim();

  if (title.length < 3) {
    return c.json({ error: "Title is required (min 3 chars)" }, 400);
  }
  if (!body) {
    return c.json({ error: "Body is required" }, 400);
  }

  await c.env.DB.prepare(
    "INSERT OR IGNORE INTO users(address) VALUES (?)"
  )
    .bind(address)
    .run();

  const insert = await c.env.DB.prepare(
    "INSERT INTO posts (author, title, body) VALUES (?, ?, ?)"
  )
    .bind(address, title, body)
    .run();

  const id = (insert.meta as any)?.last_row_id;

  return c.json(
    {
      ok: true,
      post: { id, author: address, title, body },
    },
    201
  );
});

/* =========================================================
   LEGACY ROUTER (API extra)
========================================================= */
app.all("/api/*", (c) => {
  const legacy = router(c.req.raw);
  if (legacy) return legacy;
  return c.json({ error: "API route not found" }, 404);
});

/* =========================================================
   FRONTEND SPA FALLBACK (REEMPLAZO DE PAGES)
========================================================= */
app.all("*", async (c) => {
  return c.env.ASSETS.fetch(c.req.raw);
});

export default app;

