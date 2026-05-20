
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
-- COMMENT REACTIONS (likes / points)
-- =========================
CREATE TABLE IF NOT EXISTS comment_reactions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  post_id INTEGER NOT NULL,
  comment_id INTEGER NOT NULL,
  address TEXT NOT NULL,
  type TEXT NOT NULL, -- 'like' | 'point'
  amount INTEGER NOT NULL DEFAULT 1,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (post_id) REFERENCES posts(id),
  FOREIGN KEY (comment_id) REFERENCES comments(id),
  FOREIGN KEY (address) REFERENCES users(address),
  UNIQUE(post_id, comment_id, address, type)
);

CREATE INDEX IF NOT EXISTS idx_comment_reactions_comment
ON comment_reactions(post_id, comment_id);


-- =========================
-- REACTIONS (likes / points)
-- =========================

CREATE TABLE IF NOT EXISTS reactions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  post_id INTEGER NOT NULL,
  address TEXT NOT NULL,
  type TEXT NOT NULL, -- 'like' | 'point'
  amount INTEGER NOT NULL DEFAULT 1,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (post_id) REFERENCES posts(id),
  FOREIGN KEY (address) REFERENCES users(address)
);

CREATE UNIQUE INDEX IF NOT EXISTS uniq_reaction
ON reactions (post_id, address, type);

CREATE INDEX IF NOT EXISTS idx_reactions_post
ON reactions(post_id);


-- =========================
-- PERFORMANCE INDEXES
-- =========================
CREATE INDEX IF NOT EXISTS idx_posts_created
ON posts(created_at);

CREATE INDEX IF NOT EXISTS idx_comments_post
ON comments(post_id);

-- =========================
-- ROOMS (Backrooms / Governance)
-- =========================
CREATE TABLE IF NOT EXISTS rooms (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  type TEXT NOT NULL,
  name TEXT NOT NULL,
  created_by TEXT NOT NULL,
  duration_days INTEGER,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  expires_at DATETIME,
  status TEXT DEFAULT 'active',
  FOREIGN KEY (created_by) REFERENCES users(address)
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_rooms_type_name
ON rooms(type, name);

CREATE INDEX IF NOT EXISTS idx_rooms_type_expires
ON rooms(type, expires_at);
