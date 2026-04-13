
-- 004_comment_reactions.sql
-- Reacciones para comentarios (y opcionalmente replies)
CREATE TABLE IF NOT EXISTS comment_reactions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  post_id INTEGER NOT NULL,
  comment_id INTEGER NOT NULL,
  reply_id TEXT NOT NULL DEFAULT '',
  address TEXT NOT NULL,
  type TEXT NOT NULL,              -- 'like' | 'point'
  amount INTEGER NOT NULL DEFAULT 1,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 1 reacción por usuario/target/tipo
CREATE UNIQUE INDEX IF NOT EXISTS uniq_comment_reaction
ON comment_reactions (post_id, comment_id, reply_id, address, type);

CREATE INDEX IF NOT EXISTS idx_comment_reactions_post
ON comment_reactions (post_id, comment_id);
