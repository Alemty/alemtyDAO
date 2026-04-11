
// src/index.ts
import { Hono } from "hono";
import { auth } from "./middleware/auth";
import { signJwt } from "./lib/jwt";

// ✅ Importamos tu router legacy para no romper nada
import { router } from "./router";

type Bindings = {
  DB: D1Database;
  SESSION_SECRET: string; // Secret (prod) o .dev.vars (local)
};

type Vars = {
  address: string;
};

const app = new Hono<{ Bindings: Bindings; Variables: Vars }>();

/**
 * Health check (sin auth)
 */
app.get("/api/health", (c) =>
  c.json({
    status: "ok",
    service: "alemtyDAO",
    uptime: "alive",
  })
);

/**
 * DEBUG token generator (solo para dev)
 * ⚠️ Después lo reemplazamos por SIWE real.
 */
app.get("/api/dev/token/:address", async (c) => {
  const address = c.req.param("address").toLowerCase();
  const now = Math.floor(Date.now() / 1000);
  const exp = now + 60 * 60; // 1h

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

/**
 * Endpoint protegido para probar:
 * - middleware auth
 * - binding env.DB
 * - upsert en users
 */
app.get("/api/me", auth, async (c) => {
  const address = c.get("address");

  await c.env.DB.prepare("INSERT OR IGNORE INTO users(address) VALUES (?)")
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
   POSTS (persistentes en D1)
========================================================= */

/**
 * GET /api/posts (público)
 * Query: ?limit=20 (max 50)
 */
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

/**
 * GET /api/posts/:id (público)
 */
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

/**
 * POST /api/posts (protegido)
 * Body: { title: string, body: string }
 */
app.post("/api/posts", auth, async (c) => {
  const address = c.get("address");
  const payload = await c.req.json().catch(() => ({} as any));

  const title = String(payload.title || "").trim();
  const body = String(payload.body || "").trim();

  if (!title || title.length < 3) {
    return c.json({ error: "Title is required (min 3 chars)" }, 400);
  }
  if (!body) {
    return c.json({ error: "Body is required" }, 400);
  }

  // Asegura que el user exista (idempotente)
  await c.env.DB.prepare("INSERT OR IGNORE INTO users(address) VALUES (?)")
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
   LEGACY ROUTER FALLBACK
========================================================= */

/**
 * ✅ Fallback: si Hono no matchea ruta, intenta router legacy.
 * Si router devuelve null, respondemos 404.
 */
app.all("*", (c) => {
  const legacy = router(c.req.raw);
  if (legacy) return legacy;
  return c.text("Not Found", 404);
});

export default app;

