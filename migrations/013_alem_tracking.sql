-- =========================================================
-- 013: alem_tracking — estado de ALEM de cada usuario
-- Tracking off-chain de ALEM generado, reclamado, lockeado
-- y pool Aura↔ALEM (ratio 1:100)
-- =========================================================

-- Estado on-chain de ALEM (caché para consultas rápidas)
ALTER TABLE user_stats ADD COLUMN alem_balance INTEGER NOT NULL DEFAULT 0;
ALTER TABLE user_stats ADD COLUMN alem_reclamable INTEGER NOT NULL DEFAULT 0;
ALTER TABLE user_stats ADD COLUMN alem_claimed INTEGER NOT NULL DEFAULT 0;
ALTER TABLE user_stats ADD COLUMN alem_locked INTEGER NOT NULL DEFAULT 0;
ALTER TABLE user_stats ADD COLUMN alem_ve INTEGER NOT NULL DEFAULT 0;
ALTER TABLE user_stats ADD COLUMN alem_lock_until INTEGER NOT NULL DEFAULT 0;

-- Ledger de ALEM (mint | claim | lock | unlock | swap_in | swap_out | burn)
CREATE TABLE IF NOT EXISTS alem_ledger (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  address TEXT NOT NULL,
  kind TEXT NOT NULL,             -- mint | claim | lock | unlock | swap_in | swap_out | burn
  amount INTEGER NOT NULL,        -- en wei (18 decimals)
  tx_hash TEXT DEFAULT '',        -- hash de la tx on-chain (si aplica)
  metadata TEXT NOT NULL DEFAULT '',
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  FOREIGN KEY(address) REFERENCES user_stats(address)
);

CREATE INDEX IF NOT EXISTS idx_alem_ledger_addr
  ON alem_ledger(address, created_at);

-- Pool interno Aura↔ALEM (ratio 1 ALEM = 100 AURA = 1e18 / 100)
-- Cada swap_out quema AURA y mintea ALEM
-- Cada swap_in quema ALEM y mintea AURA
CREATE TABLE IF NOT EXISTS alem_pool (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_address TEXT NOT NULL,
  kind TEXT NOT NULL,             -- swap_in (AURA→ALEM) | swap_out (ALEM→AURA)
  aura_amount INTEGER NOT NULL,   -- en wei
  alem_amount INTEGER NOT NULL,   -- en wei
  rate INTEGER NOT NULL,          -- rate used (100 = 1 ALEM = 100 AURA)
  tx_hash TEXT DEFAULT '',
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  FOREIGN KEY(user_address) REFERENCES user_stats(address)
);

CREATE INDEX IF NOT EXISTS idx_alem_pool_user
  ON alem_pool(user_address, created_at);

-- Actualizar ratio Aura/ALEM de 1000 a 100 (1 ALEM = 100 AURA)
UPDATE token_config SET value = '100' WHERE key = 'aura_per_alem';

-- Habilitar ALEM
UPDATE token_config SET value = '1' WHERE key = 'alem_enabled';
INSERT OR IGNORE INTO token_config(key, value) VALUES ('alem_enabled', '1');

-- Parámetros del pool interno
INSERT OR IGNORE INTO token_config(key, value) VALUES ('pool_reserve_aura', '0');
INSERT OR IGNORE INTO token_config(key, value) VALUES ('pool_reserve_alem', '0');
INSERT OR IGNORE INTO token_config(key, value) VALUES ('pool_swap_fee', '2'); -- 0.2% fee en centésimas
