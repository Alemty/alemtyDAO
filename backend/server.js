
import express from 'express';

const app = express();
app.use(express.json());

/**
 * DB en memoria (v0)
 * Más adelante esto se reemplaza por Postgres / SQLite
 */
let POSTS = [];

/**
 * GET /api/posts
 * Devuelve lista completa
 */
app.get('/api/posts', (req, res) => {
  res.json(POSTS);
});

/**
 * POST /api/posts
 * Crea un post (demo, sin auth)
 */
app.post('/api/posts', (req, res) => {
  const { title, body, topic } = req.body || {};

  if (!title || !body) {
    return res.status(400).json({ ok: false, error: 'Missing title/body' });
  }

  const post = {
    id: crypto.randomUUID(),
    title,
    body,
    topic: topic || 'Sin tema',
    ts: Date.now(),
    likes: 0,
    points: 0,
    comments: []
  };

  POSTS.unshift(post);
  res.json({ ok: true, post });
});

/**
 * POST /api/posts/:id/react
 * type: "like" | "points"
 */
app.post('/api/posts/:id/react', (req, res) => {
  const { id } = req.params;
  const { type } = req.body || {};

  const post = POSTS.find(p => p.id === id);
  if (!post) {
    return res.status(404).json({ ok: false, error: 'Post not found' });
  }

  if (type === 'like') post.likes += 1;
  if (type === 'points') post.points += 1;

  res.json({ ok: true });
});

const PORT = 3000;
app.listen(PORT, () => {
  console.log(`✅ API running on http://localhost:${PORT}`);
});
