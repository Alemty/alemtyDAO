-- =========================================================
-- farm_claims: reclamos diarios de AURA desde el mini-game FARM
-- Cada usuario puede reclamar 1 vez por día calendario
-- El AURA farmeado se suma a aura_ledger para minteo on-chain
-- =========================================================
CREATE TABLE IF NOT EXISTS farm_claims (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  address TEXT NOT NULL,
  claim_date TEXT NOT NULL,           -- YYYY-MM-DD (día calendario)
  amount REAL NOT NULL,               -- AURA farmeado (ej: 0.5, 10, 100)
  streak INTEGER NOT NULL DEFAULT 1,  -- racha consecutiva de días
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  FOREIGN KEY(address) REFERENCES users(address)
);

-- Un claim por usuario por día
CREATE UNIQUE INDEX IF NOT EXISTS uniq_farm_claim_day
  ON farm_claims(address, claim_date);

CREATE INDEX IF NOT EXISTS idx_farm_claims_addr
  ON farm_claims(address, created_at);
