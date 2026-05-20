-- 007_rooms.sql
-- Salas dinámicas: backrooms (con expiración) + governance (sin expiración por default)

CREATE TABLE IF NOT EXISTS rooms (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  type TEXT NOT NULL,               -- 'backroom' | 'governance'
  name TEXT NOT NULL,
  created_by TEXT NOT NULL,          -- address del creador
  duration_days INTEGER,             -- para backrooms
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  expires_at DATETIME,               -- para backrooms: created_at + duration_days
  status TEXT DEFAULT 'active',      -- futuro: active/archived
  FOREIGN KEY (created_by) REFERENCES users(address)
);

-- Evita duplicados por tipo + nombre
CREATE UNIQUE INDEX IF NOT EXISTS idx_rooms_type_name
ON rooms(type, name);

-- Acelera consultas por expiración
CREATE INDEX IF NOT EXISTS idx_rooms_type_expires
ON rooms(type, expires_at);