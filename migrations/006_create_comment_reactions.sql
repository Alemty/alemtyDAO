
-- 006_create_comment_reactions.sql
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
