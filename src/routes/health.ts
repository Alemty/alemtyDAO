
mkdir -p src/routes
cat > src/routes/health.ts <<'EOF'
export function healthRoute(): Response {
  return new Response(
    JSON.stringify({
      status: "ok",
      service: "alemtyDAO",
      uptime: "alive"
    }),
    {
      headers: {
        "content-type": "application/json; charset=utf-8"
      }
    }
  );
}
EOF
