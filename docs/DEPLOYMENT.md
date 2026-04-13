# DEPLOYMENT.md — Workers + D1 (v0.4)

Este documento describe el despliegue del backend (SIWE + API) y los bindings requeridos.

## Workers

### 1) Worker SIWE (alemtydao-siwe)
- Config: `workers/siwe/wrangler.toml`
- Bindings:
  - `SIWE_NONCES` (KV)
  - `JWT_SECRET` (secret)
- Endpoints:
  - `GET /nonce`
  - `POST /verify` → devuelve `{ ok, address, chainId, token }`

### 2) Worker API (alemtydao)
- Config: `wrangler.toml`
- Bindings:
  - `DB` (D1)
  - `JWT_SECRET` (secret)
- Endpoints: `/api/*`

## Secrets

Los dos workers deben compartir el **mismo** valor en `JWT_SECRET`.

## CORS

El API debe permitir orígenes de frontend (pages/ens/local) para `Authorization`.

## Migraciones D1

Las tablas canónicas: `users`, `posts`, `comments`, `reactions`.
