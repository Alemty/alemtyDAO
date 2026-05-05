
-- =========================================================
-- user_stats: estado social y económico derivado
-- =========================================================
CREATE TABLE IF NOT EXISTS user_stats (
  address TEXT PRIMARY KEY,
  points_received INTEGER NOT NULL DEFAULT 0,
  likes_received  INTEGER NOT NULL DEFAULT 0,
  dharma_total    INTEGER NOT NULL DEFAULT 0,
  level           INTEGER NOT NULL DEFAULT 1,
  aura_balance    INTEGER NOT NULL DEFAULT 0,
  karma_debt      INTEGER NOT NULL DEFAULT 0,
  updated_at      INTEGER NOT NULL DEFAULT (unixepoch())
);

CREATE INDEX IF NOT EXISTS idx_user_stats_updated
  ON user_stats(updated_at);

-- =========================================================
-- aura_ledger: ledger auditable de Aura
-- =========================================================
CREATE TABLE IF NOT EXISTS aura_ledger (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  address TEXT NOT NULL,
  kind TEXT NOT NULL,             -- mint | spend | transfer | burn | claim
  amount INTEGER NOT NULL,
  event_key TEXT NOT NULL,        -- idempotencia (ej: react:<reaction_id>)
  ref_type TEXT NOT NULL DEFAULT '',
  ref_id TEXT NOT NULL DEFAULT '',
  metadata TEXT NOT NULL DEFAULT '',
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  FOREIGN KEY(address) REFERENCES user_stats(address)
);

-- evita double mint por reintentos
CREATE UNIQUE INDEX IF NOT EXISTS uniq_aura_ledger_event
  ON aura_ledger(event_key);

CREATE INDEX IF NOT EXISTS idx_aura_ledger_addr_time
  ON aura_ledger(address, created_at);

-- =========================================================
-- token_config: parámetros económicos internos
-- =========================================================
CREATE TABLE IF NOT EXISTS token_config (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

-- emisión de Aura (utility)
INSERT OR IGNORE INTO token_config(key, value) VALUES ('aura_per_like',  '1');
INSERT OR IGNORE INTO token_config(key, value) VALUES ('aura_per_point', '1');

-- relación interna Aura / ALEM (NO precio fiat)
INSERT OR IGNORE INTO token_config(key, value) VALUES ('aura_per_alem', '1000');

-- flags de control futuros
INSERT OR IGNORE INTO token_config(key, value) VALUES ('alem_enabled', '0');
INSERT OR IGNORE INTO token_config(key, value) VALUES ('amm_enabled',  '0');
