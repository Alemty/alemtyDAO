
import { createMiddleware } from "hono/factory";
import { verifyJwt } from "../lib/jwt";

type Env = {
  JWT_SECRET: string;
};

export const authOptional = createMiddleware<{
  Bindings: Env;
  Variables: { address?: string };
}>(async (c, next) => {
  const authHeader = c.req.header("Authorization") || "";
  const match = authHeader.match(/^Bearer\s+(.+)$/i);

  if (!match) {
    await next();
    return;
  }

  const token = match[1]?.trim();
  if (!token) {
    await next();
    return;
  }

  try {
    const payload = await verifyJwt(token, c.env.JWT_SECRET);

    // mismas validaciones que auth fuerte (compat SIWE)
    if (
      payload?.iss === "alemtydao-siwe" &&
      payload?.aud === "alemtydao-api" &&
      payload?.sub
    ) {
      c.set("address", String(payload.sub).toLowerCase());
    }
  } catch {
    // token inválido = no bloqueamos (solo ignoramos)
  }

  await next();
});
