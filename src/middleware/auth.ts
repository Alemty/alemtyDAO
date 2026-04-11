
// src/middleware/auth.ts
import { createMiddleware } from "hono/factory";
import { verifyJwt } from "../lib/jwt";

type Env = { SESSION_SECRET: string };

export const auth = createMiddleware<{ Bindings: Env; Variables: { address: string } }>(
  async (c, next) => {
    const authHeader = c.req.header("Authorization") || "";
    const match = authHeader.match(/^Bearer\s+(.+)$/i);
    if (!match) return c.json({ error: "Missing Bearer token" }, 401);

    try {
      const payload = await verifyJwt(match[1], c.env.SESSION_SECRET);
      if (!payload || payload.aud !== "alemtydao-api" || !payload.sub) {
        return c.json({ error: "Invalid token" }, 401);
      }

      c.set("address", String(payload.sub).toLowerCase());
      await next();
    } catch {
      return c.json({ error: "Invalid token" }, 401);
    }
  }
);

