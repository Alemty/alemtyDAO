
// src/routes/posts.ts
import { Hono } from "hono";
import { auth } from "../middleware/auth";
import type { Bindings, Vars } from "../index";

const posts = new Hono<{
  Bindings: Bindings;
  Variables: Vars;
}>();

/* =========================================================
   LISTAR POSTS (conteos reales)
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
   OBTENER POST (conteos reales)
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
   LISTAR COMMENTS DE UN POST (para modal)
   GET /api/posts/:id/comments
========================================================= */

/* =========================================================
   LISTAR COMMENTS DE UN POST (para modal) + conteos
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

      -- likes por comment (reply_id = '')
      (SELECT COUNT(*)
         FROM comment_reactions cr
        WHERE cr.post_id = c.post_id
          AND cr.comment_id = c.id
          AND cr.reply_id = ''
          AND cr.type = 'like') AS likes,

      -- points por comment (SUM(amount))
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
   POST /api/posts/:id/comments
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

posts.post("/:id/comments/:commentId/react", auth, async (c) => {
  const address = c.get("address");
  const postId = Number(c.req.param("id"));
  const commentId = Number(c.req.param("commentId"));

  if (!Number.isFinite(postId) || !Number.isFinite(commentId)) {
    return c.json({ ok: false, error: "Invalid ids" }, 400);
  }

  const payload = await c.req.json().catch(() => ({} as any));
  const raw = String(payload.type || "").trim().toLowerCase();

  const normalized =
    raw === "like" ? "like" :
    raw === "point" || raw === "points" ? "point" :
    null;

  if (!normalized) {
    return c.json({ ok: false, error: "Invalid react type" }, 400);
  }

  // like: 1 por usuario/comment
  if (normalized === "like") {
    await c.env.DB.prepare(
      `
      INSERT OR IGNORE INTO comment_reactions (post_id, comment_id, reply_id, address, type, amount)
      VALUES (?, ?, '', ?, 'like', 1)
      `
    ).bind(postId, commentId, address).run();
  }

  // point: hasta 10 por usuario/comment
  if (normalized === "point") {
    await c.env.DB.prepare(
      `
      INSERT INTO comment_reactions (post_id, comment_id, reply_id, address, type, amount)
      VALUES (?, ?, '', ?, 'point', 1)
      ON CONFLICT(post_id, comment_id, reply_id, address, type)
      DO UPDATE SET amount = MIN(amount + 1, 10)
      `
    ).bind(postId, commentId, address).run();
  }

  const counts = await c.env.DB.prepare(
    `
    SELECT
      (SELECT COUNT(*) FROM comment_reactions
        WHERE post_id = ? AND comment_id = ? AND reply_id = '' AND type = 'like') AS likes,
      (SELECT COALESCE(SUM(amount),0) FROM comment_reactions
        WHERE post_id = ? AND comment_id = ? AND reply_id = '' AND type = 'point') AS points
    `
  ).bind(postId, commentId, postId, commentId).first();

  return c.json({
    ok: true,
    counts: {
      likes: Number((counts as any)?.likes ?? 0),
      points: Number((counts as any)?.points ?? 0),
    },
  });
});

/* =========================================================
   REACCIONES: LIKE / POINT (hasta 10)
   POST /api/posts/:id/react
   - like: 1 por usuario/post
   - point: incrementa amount hasta 10 por usuario/post
   - devuelve counts reales
========================================================= */
posts.post("/:id/react", auth, async (c) => {
  const address = c.get("address");
  const postId = Number(c.req.param("id"));

  if (!Number.isFinite(postId)) {
    return c.json({ ok: false, error: "Invalid post id" }, 400);
  }

  const payload = await c.req.json().catch(() => ({} as any));
  const typeRaw = String(payload.type || "").trim().toLowerCase();

  const normalized =
    typeRaw === "like"
      ? "like"
      : typeRaw === "point" || typeRaw === "points"
      ? "point"
      : null;

  if (!normalized) {
    return c.json({ ok: false, error: "Invalid react type" }, 400);
  }

  // LIKE: 1 por usuario/post (si ya existe, se ignora)
  if (normalized === "like") {
    await c.env.DB.prepare(
      `
      INSERT OR IGNORE INTO reactions (post_id, address, type, amount)
      VALUES (?, ?, 'like', 1)
      `
    ).bind(postId, address).run();
  }

  // POINT: incrementa amount hasta 10 (una sola fila por usuario/post/tipo)
  if (normalized === "point") {
    await c.env.DB.prepare(
      `
      INSERT INTO reactions (post_id, address, type, amount)
      VALUES (?, ?, 'point', 1)
      ON CONFLICT(post_id, address, type)
      DO UPDATE SET amount = MIN(amount + 1, 10)
      `
    ).bind(postId, address).run();
  }

  // Conteos reales para sincronizar UI
  const counts = await c.env.DB.prepare(
    `
    SELECT
      (SELECT COUNT(*) FROM reactions WHERE post_id = ? AND type = 'like') AS likes,
      (SELECT COALESCE(SUM(amount),0) FROM reactions WHERE post_id = ? AND type = 'point') AS points
    `
  ).bind(postId, postId).first();

  return c.json({
    ok: true,
    postId,
    type: normalized,
    counts: {
      likes: Number((counts as any)?.likes ?? 0),
      points: Number((counts as any)?.points ?? 0),
    },
  });
});

export { posts };


