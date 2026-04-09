
cat > src/router.ts <<'EOF'
import { healthRoute } from "./routes/health";

export function router(request: Request): Response | null {
  const url = new URL(request.url);
  const { pathname } = url;

  // Health check
  if (request.method === "GET" && pathname === "/api/health") {
    return healthRoute();
  }

  return null;
}
EOF
