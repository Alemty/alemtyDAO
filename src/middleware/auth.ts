
// src/middleware/auth.ts
import { createMiddleware } from "hono/factory";
import { verifyJwt } from "../lib/jwt";


type Env = {
  JWT_SECRET: string;
};


export const auth = createMiddleware<{ Bindings: Env; Variables: { address: string } }>(
  async (c, next) => {
    const authHeader = c.req.header("Authorization") || "";
    const match = authHeader.match(/^Bearer\s+(.+)$/i);
    if (!match) return c.json({ error: "Missing Bearer token" }, 401);

    const token = match[1].trim();
    if (!token) return c.json({ error: "Missing Bearer token" }, 401);

    try {
      const payload = await verifyJwt(token, c.env.JWT_SECRET);

      // Opcional debug (descomenta si necesitas inspección rápida)
      // console.log("JWT payload:", payload);

      // ✅ Validaciones mínimas
      if (!payload) return c.json({ error: "Invalid token" }, 401);

      // ✅ Alineado con tu SIWE Worker (iss/aud/sub)
      if (payload.iss !== "alemtydao-siwe") {
        return c.json({ error: "Invalid token" }, 401);
      }
      if (payload.aud !== "alemtydao-api") {
        return c.json({ error: "Invalid token" }, 401);
      }
      if (!payload.sub) {
        return c.json({ error: "Invalid token" }, 401);
      }

      c.set("address", String(payload.sub).toLowerCase());
      await next();
    } catch (err) {
      // Opcional debug:
      // console.error("JWT verify error:", err);
      return c.json({ error: "Invalid token" }, 401);
    }
  }
);

