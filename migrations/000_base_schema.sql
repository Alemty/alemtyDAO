-- 000_base_schema.sql
-- Crea el esquema base requerido por migraciones posteriores (001+)
-- IMPORTANTE: reactions se crea SIN amount para que 003 la agregue.

PRAGMA foreign_keys = ON;

-- =========================
-- USERS
-- =========================
CREATE TABLE IF NOT EXISTS users (
  address TEXT PRIMARY KEY,
  ens TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- =========================
-- POSTS
-- =========================
CREATE TABLE IF NOT EXISTS posts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  author TEXT NOT NULL,
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  topic TEXT NOT NULL DEFAULT 'Sin tema',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (author) REFERENCES users(address)
);

CREATE INDEX IF NOT EXISTS idx_posts_created
ON posts(created_at);

-- =========================
-- COMMENTS
-- =========================
CREATE TABLE IF NOT EXISTS comments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  post_id INTEGER NOT NULL,
  author TEXT NOT NULL,
  body TEXT NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (post_id) REFERENCES posts(id),
  FOREIGN KEY (author) REFERENCES users(address)
);

CREATE INDEX IF NOT EXISTS idx_comments_post
ON comments(post_id);

-- =========================
-- REACTIONS (likes / points)
-- (sin amount; 003 lo agrega)
-- =========================
CREATE TABLE IF NOT EXISTS reactions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  post_id INTEGER NOT NULL,
  address TEXT NOT NULL,
  type TEXT NOT NULL, -- 'like' | 'point'
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (post_id) REFERENCES posts(id),
  FOREIGN KEY (address) REFERENCES users(address)
);

CREATE UNIQUE INDEX IF NOT EXISTS uniq_reaction
ON reactions (post_id, address, type);

CREATE INDEX IF NOT EXISTS idx_reactions_post
ON reactions(post_id);