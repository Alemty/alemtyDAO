# alemty.eth — DAO v0.4

**alemty.eth** es una **DAO social y económica** sobre **Base (L2 Ethereum)** que separa **mérito (Dharma)**, **utilidad (Aura)**, **deuda (Karma)** y **gobernanza (ALEM/veSTAKE)**.Este repositorio contiene el **frontend estático (ENS/IPFS)** y el **backend persistente (Workers + D1)** para estado compartido del foro.

> **Estado:** v0.4 (backend integrado) · **Fecha:** 2026-04-12 · **No financiero**

---

## ✨ ¿Qué incluye v0.4?

### ✅ Frontend (estático)
- Hub único servido desde un CID IPFS, rutas absolutas (/dao, /dex, /ia, /token).
- Shell compartido (topbar, drawer, theme).
- SIWE desde navegador.

### ✅ Backend (estado compartido)
- **Worker SIWE** (stateless): nonce KV + verificación firma + emite JWT.
- **Worker API** (persistente): Hono + D1 para posts, comments, reactions, stats.

---

## 🔐 Autenticación (SIWE → JWT)

1) El usuario firma mensaje SIWE (EIP‑4361) en el frontend.
2) **SIWE Worker** valida: domain/chain/nonce/firma.
3) Emite **JWT** y el frontend lo guarda en `localStorage`.
4) El frontend envía `Authorization: Bearer <JWT>` a la **API**.

**Secrets:** se usa `JWT_SECRET` en ambos workers (SIWE firma, API verifica).

---

## 🗄️ Backend API (Hono + D1)

### Endpoints principales
- `GET /api/health`
- `GET /api/posts`
- `GET /api/posts/:id`
- `POST /api/posts` (auth)
- `POST /api/posts/:id/react` (auth) — `like|point` (acepta `points` como alias)
- `POST /api/posts/:id/comments` (auth)
- `GET /api/me/stats` (auth)
- `GET /api/stats`
- `GET /api/ranking/week` · `GET /api/ranking/month`

### D1 (tablas)
- `users`, `posts`, `comments`, `reactions` (+ unique index por post/address/type).

---

## 🧩 Estructura del repo

- `/` ID & shell
- `/shared/` UI y lógica compartida
- `/dao/` foro
- `/dex/` DEX (fases)
- `/token/` tokenomics
- `/workers/siwe/` worker SIWE (nonce + verify)
- `/src/` API worker (Hono)
- `/docs/` documentación canónica

---

## 🚀 Deploy

### Worker SIWE
- `workers/siwe/wrangler.toml` (KV: SIWE_NONCES)
- secret: `JWT_SECRET`

### Worker API
- `wrangler.toml` (D1: DB)
- secret: `JWT_SECRET`

---

## 📚 Documentación

- `docs/TOKENOMICS_RULEBOOK.md` (canónico)
- `docs/BACKEND.md` (API + D1)
- `docs/ARCHITECTURE.md` (capas)
- `docs/OPERATIONS.md`, `docs/ROADMAP.md`

---

## 📜 Licencia
MIT

**alemty.eth** · Identidad · DAO · Economía · IA · Web3
