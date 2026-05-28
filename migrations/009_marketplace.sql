-- 009_marketplace.sql
-- Tabla P2P para intercambio de NFTs por AURA

CREATE TABLE IF NOT EXISTS marketplace (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  seller TEXT NOT NULL,
  nft_name TEXT NOT NULL,
  nft_image TEXT DEFAULT '',
  nft_contract TEXT DEFAULT '',
  nft_token_id TEXT DEFAULT '',
  price_aura REAL NOT NULL,
  sold INTEGER DEFAULT 0,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_marketplace_seller ON marketplace(seller);
CREATE INDEX IF NOT EXISTS idx_marketplace_sold ON marketplace(sold);
