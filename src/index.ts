// src/index.ts
import { Hono } from "hono";
import { auth } from "./middleware/auth";
import { signJwt } from "./lib/jwt";

// ✅ Importamos tu router legacy para no romper nada
import { router } from "./router";

type Bindings = {
  DB: D1Database;
  SESSION_SECRET: string; // viene de Secret (remote) o .dev.vars (local)
};

type Vars = {
  address: string;
};

const app = new Hono<{ Bindings: Bindings; Variables: Vars }>();

/**
 * Health check (sin auth)
 * Mantiene el endpoint que ya tenías: /api/health
 */
app.get("/api/health", (c) =>
  c.json({
    status: "ok",
    service: "alemtyDAO",
    uptime: "alive",
  })
);

/**
 * DEBUG token generator (solo para dev)
 * Luego lo reemplazamos por tu SIWE real.
 */
app.get("/api/dev/token/:address", async (c) => {
  const address = c.req.param("address").toLowerCase();
  const now = Math.floor(Date.now() / 1000);
  const exp = now + 60 * 60; // 1h

  const token = await signJwt(
    {
      iss: "alemtydao-siwe",
      aud: "alemtydao-api",
      sub: address,
      iat: now,
      exp,
    },
    c.env.SESSION_SECRET
  );

  return c.json({ token, address, expiresAt: exp });
});

/**
 * Endpoint protegido para probar:
 * - middleware auth
 * - binding env.DB
 * - upsert en users
 */
app.get("/api/me", auth, async (c) => {
  const address = c.get("address");

  await c.env.DB.prepare("INSERT OR IGNORE INTO users(address) VALUES (?)")
    .bind(address)
    .run();

  const user = await c.env.DB.prepare(
    "SELECT address, ens, created_at FROM users WHERE address = ?"
  )
    .bind(address)
    .first();

  return c.json({ user });
});

/**
 * ✅ Fallback: si Hono no matchea ruta, intenta router legacy.
 * Si router devuelve null, respondemos 404.
 */
app.all("*", (c) => {
  const legacy = router(c.req.raw);
  if (legacy) return legacy;
  return c.text("Not Found", 404);
});

export default app;

