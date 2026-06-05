# DEPLOYMENT.md — Workers + D1 (v0.8 — ALEM Token Mining)

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

## API Endpoints

### ALEM Token
| Endpoint | Método | Auth | Descripción |
|----------|--------|------|-------------|
| `/api/alem/status` | GET | Bearer JWT | Estado completo: balance on-chain, reclamable, veSTAKE, lock info |
| `/api/alem/mint` | POST | Bearer JWT (minter) | Prepara tx mint() para mintear ALEM por evento calificado |
| `/api/alem/lock` | POST | Bearer JWT | Prepara tx createLock() para lockear ALEM y obtener veSTAKE |
| `/api/alem/withdraw` | POST | Bearer JWT | Prepara tx withdrawLock() para retirar ALEM lockeado |
| `/api/alem/swap` | POST | Bearer JWT | Prepara swap AURA↔ALEM (pool interno, ratio 1:100) |
| `/api/alem/pool-info` | GET | No | Información del pool: reservas, supply, rate |

## Secrets

Los dos workers deben compartir el **mismo** valor en `JWT_SECRET`.

## CORS

El API debe permitir orígenes de frontend (pages/ens/local) para `Authorization`.

## Migraciones D1

Las tablas canónicas: `users`, `posts`, `comments`, `reactions`.

Últimas migraciones:
- `013_alem_tracking.sql` — estado de ALEM por usuario (balance, reclamable, locked, ve), ledger, pool interno

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
- **Propósito:** Gobernanza DAO (con veSTAKE, locking, pool interno Aura↔ALEM)
- **Supply máximo:** 1,000,000,000 ALEM
- **Deploy:** Remix IDE — Solc 0.8.20, EVM London, Optimization 200 runs
- **Verificado:** Sí (Basescan)
- **Minter:** `0x6A202f991c4C1df079449BE9847b1DaC3F51854f` (wallet CDP)
- **Pool rate:** 1 ALEM = 100 AURA

## ALEM Token Ecosystem Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    ALEM Token (on-chain)                 │
│  0x1a00ca0c79AAdB6cAeadf81509d80f40cb7d9580            │
│  ERC-20 + veSTAKE + Locking                             │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  ┌──────────┐    ┌──────────┐    ┌──────────────────┐  │
│  │ Qualif.  │    │ Locking  │    │ Pool Aura↔ALEM   │  │
│  │ Events   │───→│ veSTAKE  │    │ (1:100 ratio)    │  │
│  │ (§7.1)   │    │ (§8)     │    └────────┬─────────┘  │
│  └──────────┘    └──────────┘             │              │
│                                           ▼              │
│                                 ┌──────────────────┐  │
│                                 │  AURA Token      │  │
│                                 │  0x74f685...     │  │
│                                 │  (utility pool)  │  │
│                                 └──────────────────┘  │
└─────────────────────────────────────────────────────────┘
```

Flujos:
- **Mint:** Eventos calificados → Backend minter → `mint()` on-chain
- **Lock:** Usuario → `approve()` + `createLock()` → veSTAKE (decae linealmente)
- **Swap_in (AURA→ALEM):** Usuario → `approve(AURA)` + `transfer()` → Pool → recibe ALEM
- **Swap_out (ALEM→AURA):** Usuario → `transfer(ALEM)` → Pool → recibe AURA × 100
