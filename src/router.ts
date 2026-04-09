
import { healthRoute } from "./routes/health";

export function router(request: Request) {
  const url = new URL(request.url);

  if (request.method === "GET" && url.pathname === "/api/health") {
    return healthRoute();
  }

  return null;
}
