// src/routes/rooms.ts
import { Hono } from "hono";
import type { Bindings, Vars } from "../index";
import { auth } from "../middleware/auth";
import { authOptional } from "../middleware/authOptional";

export const rooms = new Hono<{ Bindings: Bindings; Variables: Vars }>();

const VALID_TYPES = new Set(["backroom", "governance"]);

function normalizeType(raw: unknown) {
  const t = String(raw ?? "").trim().toLowerCase();
  return VALID_TYPES.has(t) ? t : "";
}

// ✅ GET /api/rooms?type=backroom|governance
// - No bloquea sin JWT: authOptional solo setea address si existe token válido.
rooms.use("*", authOptional);

rooms.get("/", async (c) => {
  const type = normalizeType(c.req.query("type"));
  if (!type) return c.json({ error: "Invalid room type" }, 400);

  // ✅ Lazy cleanup (solo backrooms expiradas)
  if (type === "backroom") {
    await c.env.DB.prepare(`
      DELETE FROM rooms
      WHERE type = 'backroom'
        AND expires_at IS NOT NULL
        AND expires_at <= CURRENT_TIMESTAMP
    `).run();
  }

  const res = await c.env.DB.prepare(`
    SELECT name
    FROM rooms
    WHERE type = ?
      AND (expires_at IS NULL OR expires_at > CURRENT_TIMESTAMP)
    ORDER BY created_at DESC
    LIMIT 200
  `)
    .bind(type)
    .all();

  const list = (res.results || []).map((r: any) => String(r.name));
  return c.json({ rooms: list });
});

// ✅ POST /api/rooms
// - Requiere JWT (tu UI ya lo exige)
rooms.post("/", auth, async (c) => {
  const address = String(c.get("address") || "").toLowerCase();
  const payload = await c.req.json().catch(() => ({} as any));

  const type = normalizeType(payload?.type);
  const name = String(payload?.name ?? "").trim();

  if (!type) return c.json({ error: "Invalid room type" }, 400);
  if (name.length < 3) return c.json({ error: "Name too short" }, 400);

  let durationDays = 0;
  if (type === "backroom") {
    const n = Number(payload?.durationDays ?? 1);
    durationDays = Number.isFinite(n) ? n : 1;
    durationDays = Math.max(1, Math.min(365, durationDays));
  }

  try {
    // ✅ 1) Asegura que el usuario exista (FIX FK created_by -> users.address)
    await c.env.DB.prepare(`
      INSERT OR IGNORE INTO users(address)
      VALUES (?)
    `)
      .bind(address)
      .run();

    // ✅ 2) Limpia expiradas ANTES de insertar (evita choque por UNIQUE con salas expiradas)
    if (type === "backroom") {
      await c.env.DB.prepare(`
        DELETE FROM rooms
        WHERE type = 'backroom'
          AND expires_at IS NOT NULL
          AND expires_at <= CURRENT_TIMESTAMP
      `).run();
    }

    // ✅ 3) Inserta room
    if (type === "backroom") {
      await c.env.DB.prepare(`
        INSERT INTO rooms (type, name, created_by, duration_days, expires_at)
        VALUES (?, ?, ?, ?, datetime(CURRENT_TIMESTAMP, '+' || ? || ' days'))
      `)
        .bind(type, name, address, durationDays, durationDays)
        .run();
    } else {
      await c.env.DB.prepare(`
        INSERT INTO rooms (type, name, created_by, duration_days, expires_at)
        VALUES (?, ?, ?, NULL, NULL)
      `)
        .bind(type, name, address)
        .run();
    }

    return c.json({ ok: true }, 201);
  } catch (err: any) {
    const msg = String(err?.message || err || "");

    // ✅ UNIQUE constraint (type,name) => ya existe
    if (msg.toLowerCase().includes("unique")) {
      return c.json({ error: "Room already exists" }, 409);
    }

    console.error("ROOM INSERT ERROR:", err);
    return c.json({ error: msg }, 500);
  }
});
