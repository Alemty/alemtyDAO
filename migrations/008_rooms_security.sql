-- 008_rooms_security.sql

ALTER TABLE rooms ADD COLUMN visibility TEXT DEFAULT 'private';
ALTER TABLE rooms ADD COLUMN password_hash TEXT; -- aún no lo usamos


CREATE TABLE IF NOT EXISTS room_members (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  room_id INTEGER NOT NULL,
  address TEXT NOT NULL,
  role TEXT DEFAULT 'member',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,

  FOREIGN KEY (room_id) REFERENCES rooms(id),
  FOREIGN KEY (address) REFERENCES users(address)
);
