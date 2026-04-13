
// src/routes/posts.ts
import { Hono } from "hono";
import { auth } from "../middleware/auth";
import type { Bindings, Vars } from "../index";

const posts = new Hono<{
  Bindings: Bindings;
  Variables: Vars;
}>();

/* =========================================================
   LISTAR POSTS
========================================================= */
posts.get("/", async (c) => {
  const limit = Math.min(Number(c.req.query("limit") || 20), 50);

  const result = await c.env.DB.prepare(
    `
    SELECT id, author, title, body, created_at
    FROM posts
    ORDER BY created_at DESC
    LIMIT ?
    `
  ).bind(limit).all();

  return c.json({ posts: result.results });
});

/* =========================================================
   OBTENER POST
========================================================= */
posts.get("/:id", async (c) => {
  const id = Number(c.req.param("id"));
  if (!Number.isFinite(id)) {
    return c.json({ error: "Invalid post id" }, 400);
  }

  const post = await c.env.DB.prepare(
    `
    SELECT id, author, title, body, created_at
    FROM posts
    WHERE id = ?
    `
  ).bind(id).first();

  if (!post) return c.json({ error: "Not found" }, 404);
  return c.json({ post });
});

/* =========================================================
   CREAR POST
========================================================= */
posts.post("/", auth, async (c) => {
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
  ).bind(address).run();

  const insert = await c.env.DB.prepare(
    "INSERT INTO posts (author, title, body) VALUES (?, ?, ?)"
  ).bind(address, title, body).run();

  const id = (insert.meta as any)?.last_row_id;

  return c.json(
    { ok: true, post: { id, author: address, title, body } },
    201
  );
});

/* =========================================================
   COMENTAR POST
========================================================= */
posts.post("/:id/comments", auth, async (c) => {
  const address = c.get("address");
  const postId = Number(c.req.param("id"));

  if (!Number.isFinite(postId)) {
    return c.json({ error: "Invalid post id" }, 400);
  }

  const payload = await c.req.json().catch(() => ({} as any));
  const body = String(payload.body || "").trim();

  if (!body) {
    return c.json({ error: "Comment body is required" }, 400);
  }

  await c.env.DB.prepare(
    `
    INSERT INTO comments (post_id, author, body)
    VALUES (?, ?, ?)
    `
  ).bind(postId, address, body).run();

  return c.json({ ok: true });
});

/* =========================================================
   REACCIONES: LIKE / POINTS
========================================================= */
posts.post("/:id/react", auth, async (c) => {
  const address = c.get("address");
  const postId = Number(c.req.param("id"));

  if (!Number.isFinite(postId)) {
    return c.json({ error: "Invalid post id" }, 400);
  }

  const payload = await c.req.json().catch(() => ({} as any));
  const type = String(payload.type || "");

  
const normalized =
  type === "points" ? "point"
  : type === "point" ? "point"
  : type === "like" ? "like"
  : null;

if (!normalized) {
  return c.json({ error: "Invalid react type" }, 400);
}
  
await c.env.DB.prepare(
  `
  INSERT OR IGNORE INTO reactions (post_id, address, type)
  VALUES (?, ?, ?)
  `
).bind(postId, address, normalized).run();


  return c.json({ ok: true });
});

export { posts };
