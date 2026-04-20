
import { Hono } from "hono";
import { auth } from "../middleware/auth";
import type { Bindings, Vars } from "../index";
import { isAdmin } from "../lib/permissions";

const posts = new Hono<{
  Bindings: Bindings;
  Variables: Vars;
}>();

/* =========================================================
   LISTAR POSTS
   GET /api/posts
========================================================= */
posts.get("/", async (c) => {
  const limit = Math.min(Number(c.req.query("limit") || 20), 50);

  const result = await c.env.DB.prepare(
    `
    SELECT
      p.id,
      p.author,
      p.title,
      p.body,
      p.topic,
      p.created_at,

      (SELECT COUNT(*)
         FROM reactions r
        WHERE r.post_id = p.id AND r.type = 'like') AS likes,

      (SELECT COALESCE(SUM(r.amount), 0)
         FROM reactions r
        WHERE r.post_id = p.id AND r.type = 'point') AS points,

      (SELECT COUNT(*)
         FROM comments c2
        WHERE c2.post_id = p.id) AS commentsCount

    FROM posts p
    ORDER BY p.created_at DESC
    LIMIT ?
    `
  ).bind(limit).all();

  return c.json({ posts: result.results });
});

/* =========================================================
   OBTENER POST
   GET /api/posts/:id
========================================================= */
posts.get("/:id", async (c) => {
  const id = Number(c.req.param("id"));
  if (!Number.isFinite(id)) {
    return c.json({ error: "Invalid post id" }, 400);
  }

  const post = await c.env.DB.prepare(
    `
    SELECT
      p.id,
      p.author,
      p.title,
      p.body,
      p.topic,
      p.created_at,

      (SELECT COUNT(*)
         FROM reactions r
        WHERE r.post_id = p.id AND r.type = 'like') AS likes,

      (SELECT COALESCE(SUM(r.amount), 0)
         FROM reactions r
        WHERE r.post_id = p.id AND r.type = 'point') AS points,

      (SELECT COUNT(*)
         FROM comments c2
        WHERE c2.post_id = p.id) AS commentsCount

    FROM posts p
    WHERE p.id = ?
    `
  ).bind(id).first();

  if (!post) return c.json({ error: "Not found" }, 404);
  return c.json({ post });
});

/* =========================================================
   LISTAR COMMENTS
   GET /api/posts/:id/comments
========================================================= */
posts.get("/:id/comments", async (c) => {
  const postId = Number(c.req.param("id"));
  if (!Number.isFinite(postId)) {
    return c.json({ error: "Invalid post id" }, 400);
  }

  const result = await c.env.DB.prepare(
    `
    SELECT
      c.id,
      c.author,
      c.body,
      c.created_at,

      (SELECT COUNT(*)
         FROM comment_reactions cr
        WHERE cr.post_id = c.post_id
          AND cr.comment_id = c.id
          AND cr.reply_id = ''
          AND cr.type = 'like') AS likes,

      (SELECT COALESCE(SUM(cr.amount),0)
         FROM comment_reactions cr
        WHERE cr.post_id = c.post_id
          AND cr.comment_id = c.id
          AND cr.reply_id = ''
          AND cr.type = 'point') AS points

    FROM comments c
    WHERE c.post_id = ?
    ORDER BY c.created_at ASC
    `
  ).bind(postId).all();

  return c.json({ comments: result.results });
});

/* =========================================================
   CREAR POST
   POST /api/posts
========================================================= */
posts.post("/", auth, async (c) => {
  const address = c.get("address");
  const payload = await c.req.json().catch(() => ({} as any));

  const title = String(payload.title || "").trim();
  const body  = String(payload.body || "").trim();
  const topic = String(payload.topic || "").trim() || "Sin tema";

  if (title.length < 3) {
    return c.json({ error: "Title is required (min 3 chars)" }, 400);
  }
  if (!body) {
    return c.json({ error: "Body is required" }, 400);
  }

  await c.env.DB.prepare(
    "INSERT OR IGNORE INTO users (address) VALUES (?)"
  ).bind(address).run();

  const insert = await c.env.DB.prepare(
    "INSERT INTO posts (author, title, body, topic) VALUES (?, ?, ?, ?)"
  ).bind(address, title, body, topic).run();

  return c.json(
    {
      ok: true,
      post: {
        id: (insert.meta as any)?.last_row_id,
        author: address,
        title,
        body,
        topic
      }
    },
    201
  );
});

/* =========================================================
   EDITAR POST
   PUT /api/posts/:id
========================================================= */
posts.put("/:id", auth, async (c) => {
  const address = c.get("address");
  const id = Number(c.req.param("id"));

  const payload = await c.req.json().catch(() => ({} as any));
  const title = String(payload.title || "").trim();
  const body  = String(payload.body || "").trim();
  const topic = String(payload.topic || "").trim() || "Sin tema";

  const post = await c.env.DB.prepare(
    "SELECT author FROM posts WHERE id = ?"
  ).bind(id).first();

  if (!post) return c.json({ error: "Not found" }, 404);
  if ((post as any).author !== address) {
    return c.json({ error: "Forbidden" }, 403);
  }

  await c.env.DB.prepare(
    "UPDATE posts SET title = ?, body = ?, topic = ? WHERE id = ?"
  ).bind(title, body, topic, id).run();

  return c.json({ ok: true });
});

/* =========================================================
   ELIMINAR POST
   DELETE /api/posts/:id
========================================================= */
posts.delete("/:id", auth, async (c) => {
  const address = c.get("address");
  const id = Number(c.req.param("id"));

  const post = await c.env.DB.prepare(
    "SELECT author FROM posts WHERE id = ?"
  ).bind(id).first();

  if (!post) return c.json({ error: "Not found" }, 404);

  const isOwner = (post as any).author === address;
  if (!isOwner && !isAdmin(address)) {
    return c.json({ error: "Forbidden" }, 403);
  }

  await c.env.DB.prepare("DELETE FROM posts WHERE id = ?")
    .bind(id)
    .run();

  return c.json({ ok: true });
});

/* =========================================================
   REPORTAR POST
   POST /api/posts/:id/report
========================================================= */
posts.post("/:id/report", auth, async (c) => {
  const address = c.get("address");
  const id = Number(c.req.param("id"));
  const payload = await c.req.json().catch(() => ({} as any));
  const reason = String(payload.reason || "").trim();

  await c.env.DB.prepare(
    "INSERT INTO reports (post_id, reporter, reason) VALUES (?, ?, ?)"
  ).bind(id, address, reason).run();

  return c.json({ ok: true });
});

export { posts };

