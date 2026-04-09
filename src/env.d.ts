
cat > src/env.d.ts <<'EOF'
/// <reference types="@cloudflare/workers-types" />

interface Env {
  DB: D1Database;
}
EOF
