import { Hono } from "hono";
import type { Bindings, Vars } from "../index";
import { auth } from "../middleware/auth";

export const rooms = new Hono<{ Bindings: Bindings; Variables: Vars }>();

const VALID_TYPES = new Set(["backroom", "governance"]);
const VALID_VIS = new Set(["public", "private", "password"]);
const FOUNDER = "0x6a202f991c4c1df079449be9847b1dac3f51854f";

function normalizeType(raw: unknown) {
  const t = String(raw ?? "").trim().toLowerCase();
  return VALID_TYPES.has(t) ? t : "";
}

function normalizeVis(raw: unknown) {
  const v = String(raw ?? "private").trim().toLowerCase();
  return VALID_VIS.has(v) ? v : "private";
}

function asLower(x: unknown) {
  return String(x ?? "").toLowerCase();
}

// sqlite/d1 now
const SQL_NOW = "datetime('now')";
const SQL_NOT_EXPIRED = `(expires_at IS NULL OR datetime(expires_at) > ${SQL_NOW})`;
const SQL_EXPIRED = `(expires_at IS NOT NULL AND datetime(expires_at) <= ${SQL_NOW})`;

async function cleanupExpiredBackrooms(db: D1Database) {
  // 1) Elimina miembros de rooms expirados (evita FK constraint)
  await db.prepare(`
    DELETE FROM room_members
    WHERE room_id IN (
      SELECT id
      FROM rooms
      WHERE type='backroom' AND ${SQL_EXPIRED}
    )
  `).run();

  // 2) Ahora sí elimina rooms expirados
  await db.prepare(`
    DELETE FROM rooms
    WHERE type='backroom' AND ${SQL_EXPIRED}
  `).run();
}

/* =========================================================
   ✅ GET /api/rooms?type=backroom|governance
   - Público (no requiere JWT)
   - Dev: agrega &debug=1 para ver detail si falla
========================================================= */
rooms.get("/", async (c) => {
  const debug = c.req.query("debug") === "1";

  try {
    const type = normalizeType(c.req.query("type"));
    if (!type) return c.json({ error: "Invalid room type" }, 400);

    if (type === "backroom") {
      await cleanupExpiredBackrooms(c.env.DB);
    }

    // ✅ metadata completa
    const res = await c.env.DB.prepare(`
      SELECT id, name, type, visibility, created_by, created_at, expires_at
      FROM rooms
      WHERE type = ?
        AND ${SQL_NOT_EXPIRED}
      ORDER BY created_at DESC, id DESC
      LIMIT 200
    `).bind(type).all();

    const roomsOut = (res.results || [])
      .map((r: any) => ({
        id: r.id ?? null,
        name: String(r.name ?? "").trim(),
        type: String(r.type ?? type),
        visibility: String(r.visibility ?? "private"),
        created_by: r.created_by ? String(r.created_by) : null,
        created_at: r.created_at ? String(r.created_at) : null,
        expires_at: r.expires_at ? String(r.expires_at) : null,
      }))
      .filter((x: any) => x.name.length > 0);

    // ✅ compat legacy (por si tu frontend aún espera strings)
    const names = roomsOut.map((x: any) => x.name);

    return c.json({ rooms: roomsOut, names });

  } catch (err: any) {
    console.error("❌ rooms GET error:", err);
    return c.json(
      {
        error: "rooms fetch failed",
        ...(debug ? { detail: String(err?.message || err) } : {}),
      },
      500
    );
  }
});

/* =========================================================
   ✅ POST /api/rooms
   Body: { type, name, durationDays?, visibility?, password? }
========================================================= */
rooms.post("/", auth, async (c) => {
  const address = asLower(c.get("address"));
  const p = await c.req.json().catch(() => ({} as any));

  const type = normalizeType(p?.type);
  const name = String(p?.name ?? "").trim();
  const visibility = normalizeVis(p?.visibility);
  const password = String(p?.password ?? "").trim();

  if (!type) return c.json({ error: "Invalid type" }, 400);
  if (name.length < 3) return c.json({ error: "Name too short" }, 400);
  if (visibility === "password" && password.length < 1) {
    return c.json({ error: "Password required" }, 400);
  }

  let durationDays = 1;
  if (type === "backroom") {
    const n = Number(p?.durationDays ?? 1);
    durationDays = Number.isFinite(n) ? Math.max(1, Math.min(365, n)) : 1;
  }

  try {
    await c.env.DB.prepare(`INSERT OR IGNORE INTO users(address) VALUES (?)`)
      .bind(address)
      .run();

    if (type === "backroom") {
      await cleanupExpiredBackrooms(c.env.DB);

      // backroom: expira
      await c.env.DB.prepare(`
        INSERT INTO rooms (
          type, name, created_by, duration_days, expires_at, visibility, password_hash
        )
        VALUES (
          ?, ?, ?, ?, datetime('now','+' || CAST(? AS TEXT) || ' days'), ?, ?
        )
      `).bind(
        type,
        name,
        address,
        durationDays,
        durationDays,
        visibility,
        visibility === "password" ? password : null
      ).run();

    } else {
      // governance: no expira
      await c.env.DB.prepare(`
        INSERT INTO rooms (
          type, name, created_by, duration_days, expires_at, visibility, password_hash
        )
        VALUES (?, ?, ?, NULL, NULL, ?, ?)
      `).bind(
        type,
        name,
        address,
        visibility,
        visibility === "password" ? password : null
      ).run();
    }

    const room: any = await c.env.DB.prepare(
      `SELECT id FROM rooms WHERE name=? AND type=? LIMIT 1`
    ).bind(name, type).first();

    if (room?.id) {
      await c.env.DB.prepare(`
        INSERT OR IGNORE INTO room_members(room_id,address,role)
        VALUES (?, ?, 'owner')
      `).bind(room.id, address).run();
    }

    return c.json({ ok: true }, 201);

  } catch (err: any) {
    console.error("❌ rooms POST error:", err);
    const msg = String(err?.message || err);
    if (msg.toLowerCase().includes("unique")) {
      return c.json({ error: "Room already exists" }, 409);
    }
    return c.json({ error: "server error", detail: msg }, 500);
  }
});

/* =========================================================
   ✅ GET /api/rooms/:name/access?type=...
========================================================= */
rooms.get("/:name/access", auth, async (c) => {
  const address = asLower(c.get("address"));
  const name = c.req.param("name");
  const type = normalizeType(c.req.query("type"));

  if (!type) return c.json({ error: "Invalid room type" }, 400);

  try {
    const room: any = await c.env.DB.prepare(`
      SELECT id, visibility, created_by
      FROM rooms
      WHERE name=? AND type=?
        AND ${SQL_NOT_EXPIRED}
      LIMIT 1
    `).bind(name, type).first();

    if (!room) return c.json({ error: "Room not found" }, 404);

    if (address === FOUNDER) {
      return c.json({ access: true, role: "founder", visibility: room.visibility });
    }

    if (String(room.visibility || "").toLowerCase() === "public") {
      return c.json({ access: true, role: "public", visibility: room.visibility });
    }

    const m: any = await c.env.DB.prepare(`
      SELECT role FROM room_members WHERE room_id=? AND address=? LIMIT 1
    `).bind(room.id, address).first();

    if (m?.role) {
      return c.json({ access: true, role: String(m.role), visibility: room.visibility });
    }

    return c.json({ access: false, visibility: room.visibility }, 403);
  } catch (err: any) {
    console.error("❌ rooms ACCESS error:", err);
    return c.json({ error: "server error" }, 500);
  }
});

/* =========================================================
   ✅ POST /api/rooms/:name/join?type=...  (password)
========================================================= */
rooms.post("/:name/join", auth, async (c) => {
  const address = asLower(c.get("address"));
  const name = c.req.param("name");
  const type = normalizeType(c.req.query("type"));
  if (!type) return c.json({ error: "Invalid room type" }, 400);

  const body = await c.req.json().catch(() => ({} as any));
  const password = String(body?.password || "");

  try {
    const room: any = await c.env.DB.prepare(`
      SELECT id, visibility, password_hash
      FROM rooms
      WHERE name=? AND type=?
        AND ${SQL_NOT_EXPIRED}
      LIMIT 1
    `).bind(name, type).first();

    if (!room) return c.json({ error: "not found" }, 404);
    if (String(room.visibility) !== "password") return c.json({ error: "not password room" }, 400);
    if (password !== String(room.password_hash || "")) return c.json({ error: "wrong password" }, 403);

    await c.env.DB.prepare(`
      INSERT OR IGNORE INTO room_members(room_id,address,role)
      VALUES (?, ?, 'member')
    `).bind(room.id, address).run();

    return c.json({ ok: true });
  } catch (err: any) {
    console.error("❌ rooms JOIN error:", err);
    return c.json({ error: "server error" }, 500);
  }
});

/* =========================================================
   ✅ PATCH /api/rooms/:name/settings?type=...
========================================================= */
rooms.patch("/:name/settings", auth, async (c) => {
  const address = asLower(c.get("address"));
  const name = c.req.param("name");
  const type = normalizeType(c.req.query("type"));
  if (!type) return c.json({ error: "Invalid room type" }, 400);

  const body = await c.req.json().catch(() => ({} as any));
  const visibility = normalizeVis(body?.visibility);
  const password = String(body?.password || "").trim();

  try {
    const room: any = await c.env.DB.prepare(`
      SELECT id, created_by FROM rooms WHERE name=? AND type=? LIMIT 1
    `).bind(name, type).first();

    if (!room) return c.json({ error: "not found" }, 404);

    const isFounder = address === FOUNDER;
    const isOwner = asLower(room.created_by) === address;

    if (!isFounder && !isOwner) return c.json({ error: "forbidden" }, 403);

    if (visibility === "password" && !password) {
      return c.json({ error: "password required" }, 400);
    }

    await c.env.DB.prepare(`
      UPDATE rooms SET visibility=?, password_hash=? WHERE id=?
    `).bind(
      visibility,
      visibility === "password" ? password : null,
      room.id
    ).run();

    return c.json({ ok: true, visibility });
  } catch (err: any) {
    console.error("❌ rooms SETTINGS error:", err);
    return c.json({ error: "server error" }, 500);
  }
});

/* =========================================================
   ✅ DELETE /api/rooms/:name?type=...
   Solo el creador o el founder pueden eliminar
========================================================= */
rooms.delete("/:name", auth, async (c) => {
  const address = asLower(c.get("address"));
  const name = c.req.param("name");
  const type = normalizeType(c.req.query("type"));
  if (!type) return c.json({ error: "Invalid room type" }, 400);

  try {
    const room: any = await c.env.DB.prepare(`
      SELECT id, created_by FROM rooms WHERE name=? AND type=? LIMIT 1
    `).bind(name, type).first();

    if (!room) return c.json({ error: "not found" }, 404);

    const isFounder = address === FOUNDER;
    const isOwner = asLower(room.created_by) === address;

    if (!isFounder && !isOwner) return c.json({ error: "forbidden" }, 403);

    // Eliminar miembros primero (FK)
    await c.env.DB.prepare(`DELETE FROM room_members WHERE room_id=?`).bind(room.id).run();
    await c.env.DB.prepare(`DELETE FROM rooms WHERE id=?`).bind(room.id).run();

    return c.json({ ok: true });
  } catch (err: any) {
    console.error("❌ rooms DELETE error:", err);
    return c.json({ error: "server error" }, 500);
  }
});