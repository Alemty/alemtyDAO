
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
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (author) REFERENCES users(address)
);

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

-- =========================
-- REACTIONS (likes / points)
-- =========================
CREATE TABLE IF NOT EXISTS reactions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  post_id INTEGER NOT NULL,
  address TEXT NOT NULL,
  type TEXT NOT NULL, -- 'like' | 'points'
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (post_id) REFERENCES posts(id),
  FOREIGN KEY (address) REFERENCES users(address)
);

CREATE UNIQUE INDEX IF NOT EXISTS uniq_reaction
ON reactions (post_id, address, type);

-- =========================
-- PERFORMANCE INDEXES
-- =========================
CREATE INDEX IF NOT EXISTS idx_posts_created
ON posts(created_at);

CREATE INDEX IF NOT EXISTS idx_comments_post
ON comments(post_id);

CREATE INDEX IF NOT EXISTS idx_reactions_post
ON reactions(post_id);
