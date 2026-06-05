# DEPLOYMENT.md — Workers + D1 (v0.8)

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

## Contracts on Base Mainnet

### AURA Token
- **Dirección:** `0x74f685da4d39e53e7df6e0970b84224ea0d00634`
- **Estándar:** ERC-20 (18 decimals)
- **Propósito:** Utility interno / gas social
- **Deploy:** Remix IDE — Solc 0.8.20, EVM London, Optimization 200 runs
- **Verificado:** Sí (Basescan)
- **Minter:** `0x6A202f991c4C1df079449BE9847b1DaC3F51854f` (wallet CDP)

### ALEM Token
- **Dirección:** `0x1a00ca0c79AAdB6cAeadf81509d80f40cb7d9580`
- **Estándar:** ERC-20 (18 decimals)
- **Propósito:** Gobernanza DAO (con veSTAKE, locking)
- **Supply máximo:** 1,000,000,000 ALEM
- **Deploy:** Remix IDE — Solc 0.8.20, EVM London, Optimization 200 runs
- **Verificado:** Pendiente (verificar en Basescan)
- **Minter:** `0x6A202f991c4C1df079449BE9847b1DaC3F51854f` (wallet CDP)
