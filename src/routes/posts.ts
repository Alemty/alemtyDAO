
import { Hono } from "hono";
import { auth } from "../middleware/auth";
import type { Bindings, Vars } from "../index";
import { isAdmin } from "../lib/permissions";
import { authOptional } from "../middleware/authOptional";



const posts = new Hono<{
  Bindings: Bindings;
  Variables: Vars;
}>();

// Devuelve la address del usuario si hay JWT, o null si es visitante
function getViewer(c: any): string | null {
  try {
    return c.get("address") ?? null;
  } catch {
    return null;
  }
}
/* =========================================================
   LISTAR POSTS
   GET /api/posts
========================================================= */

// Para GET: si hay JWT válido, setea address; si no, no bloquea.
posts.use("*", authOptional);

posts.get("/", async (c) => {
  const viewer = getViewer(c);
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

    /* Totales */
    (SELECT COUNT(*) FROM reactions r
      WHERE r.post_id = p.id AND r.type = 'like') AS likes,

    (SELECT COALESCE(SUM(r.amount), 0) FROM reactions r
      WHERE r.post_id = p.id AND r.type = 'point') AS points,

    (SELECT COUNT(*) FROM comments c2
      WHERE c2.post_id = p.id) AS commentsCount,

    /* Estado del usuario */
    ${viewer ? `
    EXISTS(
      SELECT 1 FROM reactions r2
      WHERE r2.post_id = p.id
        AND r2.address = ?
        AND r2.type = 'like'
    ) AS myLike,

    COALESCE(
      (SELECT SUM(r3.amount) FROM reactions r3
       WHERE r3.post_id = p.id
         AND r3.address = ?
         AND r3.type = 'point'),
      0
    ) AS myPoints
    ` : `
    0 AS myLike,
    0 AS myPoints
    `}
  FROM posts p
  ORDER BY p.created_at DESC
  LIMIT ?
  `
)
.bind(...(viewer ? [viewer, viewer] : []), limit)
.all();


  return c.json({ posts: result.results });
});

/* =========================================================
   OBTENER POST
   GET /api/posts/:id
========================================================= */
posts.get("/:id", async (c) => {
  const viewer = getViewer(c);
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

    (SELECT COUNT(*) FROM reactions r
      WHERE r.post_id = p.id AND r.type = 'like') AS likes,

    (SELECT COALESCE(SUM(r.amount), 0) FROM reactions r
      WHERE r.post_id = p.id AND r.type = 'point') AS points,

    (SELECT COUNT(*) FROM comments c2
      WHERE c2.post_id = p.id) AS commentsCount,

    ${viewer ? `
    EXISTS(
      SELECT 1 FROM reactions r2
      WHERE r2.post_id = p.id
        AND r2.address = ?
        AND r2.type = 'like'
    ) AS myLike,

    COALESCE(
      (SELECT SUM(r3.amount) FROM reactions r3
       WHERE r3.post_id = p.id
         AND r3.address = ?
         AND r3.type = 'point'),
      0
    ) AS myPoints
    ` : `
    0 AS myLike,
    0 AS myPoints
    `}
  FROM posts p
  WHERE p.id = ?
  `
)
.bind(...(viewer ? [viewer, viewer] : []), id)
.first();


  if (!post) return c.json({ error: "Not found" }, 404);
  return c.json({ post });
});


/* =========================================================
   LISTAR COMMENTS
   GET /api/posts/:id/comments
========================================================= */
posts.get("/:id/comments", async (c) => {
  const viewer = getViewer(c);
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

    /* Totales */
    COALESCE(
      (SELECT SUM(cr.amount) FROM comment_reactions cr
       WHERE cr.post_id = c.post_id
         AND cr.comment_id = c.id
         AND cr.reply_id = ''
         AND cr.type = 'like'),
      0
    ) AS likes,

    COALESCE(
      (SELECT SUM(cr.amount) FROM comment_reactions cr
       WHERE cr.post_id = c.post_id
         AND cr.comment_id = c.id
         AND cr.reply_id = ''
         AND cr.type = 'point'),
      0
    ) AS points,

    /* Estado del usuario */
    ${viewer ? `
    EXISTS(
      SELECT 1 FROM comment_reactions cr2
      WHERE cr2.post_id = c.post_id
        AND cr2.comment_id = c.id
        AND cr2.reply_id = ''
        AND cr2.address = ?
        AND cr2.type = 'like'
    ) AS myLike,

    COALESCE(
      (SELECT SUM(cr3.amount) FROM comment_reactions cr3
       WHERE cr3.post_id = c.post_id
         AND cr3.comment_id = c.id
         AND cr3.reply_id = ''
         AND cr3.address = ?
         AND cr3.type = 'point'),
      0
    ) AS myPoints
    ` : `
    0 AS myLike,
    0 AS myPoints
    `}
  FROM comments c
  WHERE c.post_id = ?
  ORDER BY c.created_at ASC
  `
)
.bind(...(viewer ? [viewer, viewer] : []), postId)
.all();


  return c.json({ comments: result.results });
});


/* =========================================================
   CREAR COMENTARIO
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

  if (body.length < 2) {
    return c.json({ error: "Comment too short" }, 400);
  }

  // Asegura usuario
  await c.env.DB.prepare(
    "INSERT OR IGNORE INTO users (address) VALUES (?)"
  ).bind(address).run();

  const res = await c.env.DB.prepare(`
    INSERT INTO comments (post_id, author, body)
    VALUES (?, ?, ?)
  `).bind(postId, address, body).run();

  return c.json({
    ok: true,
    comment: {
      id: (res.meta as any)?.last_row_id,
      post_id: postId,
      author: address,
      body,
      created_at: new Date().toISOString(),
    },
  }, 201);
});


/* =========================================================
   REACT A COMENTARIOS / RESPUESTAS
   POST /api/posts/:postId/comments/:commentId/react
   - like: idempotente
   - point: incremental
========================================================= */

posts.post("/:postId/comments/:commentId/react", auth, async (c) => {
  const address = c.get("address");
  const postId = Number(c.req.param("postId"));
  const commentId = Number(c.req.param("commentId"));

  if (!Number.isFinite(postId) || !Number.isFinite(commentId)) {
    return c.json({ error: "Invalid post/comment id" }, 400);
  }

  const payload = await c.req.json().catch(() => ({} as any));
  const rawType = String(payload.type || "").trim().toLowerCase();
  const type = rawType === "points" ? "point" : rawType;

  if (type !== "like" && type !== "point") {
    return c.json({ error: "Invalid reaction type" }, 400);
  }

  // asegura usuario
  await c.env.DB.prepare(
    "INSERT OR IGNORE INTO users (address) VALUES (?)"
  ).bind(address).run();

  if (type === "like") {
    await c.env.DB.prepare(`
      INSERT INTO comment_reactions
        (post_id, comment_id, reply_id, address, type, amount)
      VALUES
        (?, ?, '', ?, 'like', 1)
      ON CONFLICT(post_id, comment_id, reply_id, address, type)
        DO NOTHING
    `).bind(postId, commentId, address).run();
  } else {
    await c.env.DB.prepare(`
      INSERT INTO comment_reactions
        (post_id, comment_id, reply_id, address, type, amount)
      VALUES
        (?, ?, '', ?, 'point', 1)
      ON CONFLICT(post_id, comment_id, reply_id, address, type)
        DO UPDATE SET amount = comment_reactions.amount + 1
    `).bind(postId, commentId, address).run();
  }

  const row = await c.env.DB.prepare(`
    SELECT
      COALESCE(SUM(CASE WHEN type='like' THEN amount ELSE 0 END), 0) AS likes,
      COALESCE(SUM(CASE WHEN type='point' THEN amount ELSE 0 END), 0) AS points
    FROM comment_reactions
    WHERE post_id = ? AND comment_id = ? AND reply_id = ''
  `).bind(postId, commentId).first();

  return c.json({
    ok: true,
    counts: {
      likes: Number((row as any)?.likes ?? 0),
      points: Number((row as any)?.points ?? 0),
    },
  });
});



/* =========================================================
   REACT (like / point)
   POST /api/posts/:id/react
   - like: idempotente (1 por user)
   - point: incrementa amount
========================================================= */
posts.post("/:id/react", auth, async (c) => {
  const address = c.get("address");
  const postId = Number(c.req.param("id"));
  if (!Number.isFinite(postId)) {
    return c.json({ error: "Invalid post id" }, 400);
  }

  const payload = await c.req.json().catch(() => ({} as any));
  const rawType = String(payload.type || "").trim().toLowerCase();

  // Harden: acepta points/point
  const type = rawType === "points" ? "point" : rawType;

  if (type !== "like" && type !== "point") {
    return c.json({ error: "Invalid reaction type" }, 400);
  }

  // Asegura usuario en tabla users (consistencia)
  await c.env.DB.prepare(
    "INSERT OR IGNORE INTO users (address) VALUES (?)"
  ).bind(address).run();

  if (type === "like") {
    // Idempotente: si ya existe, no cambia
    await c.env.DB.prepare(`
      INSERT INTO reactions (post_id, address, type, amount)
      VALUES (?, ?, 'like', 1)
      ON CONFLICT(post_id, address, type) DO NOTHING
    `).bind(postId, address).run();
  } else {
    // point: incrementa amount (o crea)
    await c.env.DB.prepare(`
      INSERT INTO reactions (post_id, address, type, amount)
      VALUES (?, ?, 'point', 1)
      ON CONFLICT(post_id, address, type)
      DO UPDATE SET amount = reactions.amount + 1
    `).bind(postId, address).run();
  }

  // Devuelve counts actualizados (source of truth)
  const row = await c.env.DB.prepare(`
    SELECT
      COALESCE(SUM(CASE WHEN type='like' THEN amount ELSE 0 END), 0) AS likes,
      COALESCE(SUM(CASE WHEN type='point' THEN amount ELSE 0 END), 0) AS points
    FROM reactions
    WHERE post_id = ?
  `).bind(postId).first();

  return c.json({
    ok: true,
    counts: {
      likes: Number((row as any)?.likes ?? 0),
      points: Number((row as any)?.points ?? 0),
    },
  });
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

