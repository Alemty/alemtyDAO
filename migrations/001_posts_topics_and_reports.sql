
-- ======================================
-- MIGRATION 001
-- Add topics + reports (safe migration)
-- ======================================

-- =========================
-- REPORTS: denuncias de posts
-- =========================
CREATE TABLE IF NOT EXISTS reports (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  post_id INTEGER NOT NULL,
  reporter TEXT NOT NULL,
  reason TEXT,
  status TEXT DEFAULT 'open', -- open | reviewed | closed
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (post_id) REFERENCES posts(id),
  FOREIGN KEY (reporter) REFERENCES users(address)
);

CREATE INDEX IF NOT EXISTS idx_reports_post
ON reports(post_id);

CREATE INDEX IF NOT EXISTS idx_reports_status
ON reports(status);

-- =========================
-- USER ROLES (opcional, futuro)
-- =========================
CREATE TABLE IF NOT EXISTS user_roles (
  address TEXT PRIMARY KEY,
  role TEXT NOT NULL, -- 'admin' | 'founder'
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (address) REFERENCES users(address)
);
