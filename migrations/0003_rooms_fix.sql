-- 0003_rooms_fix.sql
-- Rooms: columnas faltantes + tabla room_members

-- 1) rooms: visibility (default private)
ALTER TABLE rooms ADD COLUMN visibility TEXT NOT NULL DEFAULT 'private';

-- 2) rooms: password_hash
ALTER TABLE rooms ADD COLUMN password_hash TEXT;

-- 3) room_members: membership/roles
CREATE TABLE IF NOT EXISTS room_members (
  id        INTEGER PRIMARY KEY AUTOINCREMENT,
  room_id   INTEGER NOT NULL,
  address   TEXT    NOT NULL,
  role      TEXT    NOT NULL DEFAULT 'member',  -- owner | member | mod
  joined_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (room_id) REFERENCES rooms(id) ON DELETE CASCADE,
  FOREIGN KEY (address) REFERENCES users(address),
  UNIQUE(room_id, address)
);

CREATE INDEX IF NOT EXISTS idx_room_members_room ON room_members(room_id);
CREATE INDEX IF NOT EXISTS idx_room_members_address ON room_members(address);