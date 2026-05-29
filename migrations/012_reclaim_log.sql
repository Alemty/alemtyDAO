-- =========================================================
-- 012: reclaim_log — auditoría de reclamos de AURA
-- Cada reclaim registra: address, aura quemado off-chain,
-- tx_hash on-chain, status (pending/confirmed/failed)
-- =========================================================

CREATE TABLE IF NOT EXISTS reclaim_log (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  address     TEXT    NOT NULL,
  aura_burned INTEGER NOT NULL,
  tx_hash     TEXT,
  status      TEXT    NOT NULL DEFAULT 'pending',
  created_at  INTEGER NOT NULL DEFAULT (unixepoch())
);

CREATE INDEX IF NOT EXISTS idx_reclaim_log_address ON reclaim_log(address);
CREATE INDEX IF NOT EXISTS idx_reclaim_log_status ON reclaim_log(status);
