# RELEASE v0.7 — AURA On-Chain Integration

**Fecha:** 2026-05-29
**Estado:** ✅ Estable
**Branch:** `fix/clean-fix-20260528`
**Commit base:** `3f68e21`

---

## Resumen

Integración completa del token AURA ERC-20 (Base Mainnet) con la aplicación web.
El perfil ahora muestra el balance on-chain real desde el contrato AURA en Base,
con separación clara entre AURA on-chain (balance real) y AURA pendiente de reclamar (off-chain).

---

## Arquitectura de Distribución AURA

```
                    ┌──────────────────────┐
                    │  Wallet Minter (CDP)  │  ← 0x6A202f...54f
                    │  Owner del contrato   │  ← Solo mintea AURA al distribuidor
                    └──────────┬───────────┘
                               │ POST /api/aura/mint
                               │ mint(address,uint256)
                               ▼
           ┌──────────────────────────────────────┐
           │   Wallet Distribuidora (Agente)       │  ← 0x8ed91b...c9ac
           │   Recibe AURA vía mint desde minter   │  ← Firma transfers automáticamente
           │   Tiene AGENT_PRIVATE_KEY en Workers  │
           └──────────┬───────────────────────────┘
                      │ POST /api/aura/claim → eth_sendTransaction
                      │ transfer(address,uint256) firmado por MetaMask
                      ▼
           ┌──────────────────────┐
           │   Usuario final      │  ← Recibe AURA on-chain en su wallet
           └──────────────────────┘
```

### Wallets del Sistema

| Wallet | Dirección | Rol | Private Key |
|--------|-----------|-----|-------------|
| Minter | `0x6A202f991c4C1df079449BE9847b1DaC3F51854f` | Owner + minter del contrato AURA | Guardada en CDP |
| Distribuidora | `0x8ed91bc2777577f9e9694a60dff515da8d13c9ac` | Distribuye AURA a usuarios | Guardada como secreto en Cloudflare Workers |

### Contrato AURA

| Propiedad | Valor |
|-----------|-------|
| **Dirección** | `0x74F685dA4D39e53e7Df6E0970b84224Ea0d00634` |
| **Red** | Base Mainnet (chainId: 8453) |
| **Estándar** | ERC-20 |
| **Decimales** | 18 |
| **Hard Cap** | 5,000,000 AURA |
| **Supply actual** | 100 AURA |
| **Verificado** | Sí (Basescan) |

---

## Endpoints de la API

### Tokenomics / Perfil

| Endpoint | Método | Auth | Descripción |
|----------|--------|------|-------------|
| `/api/me/stats` | GET | Bearer JWT | Devuelve: dharma, aura (on-chain), auraReclamable (off-chain), auraBalance |

### Distribución AURA

| Endpoint | Método | Auth | Descripción |
|----------|--------|------|-------------|
| `/api/aura/approve-agent` | POST | No | Prepara tx approve(maxUint256) para firmar con MetaMask |
| `/api/aura/claim` | POST | Bearer JWT | Prepara tx transfer(al usuario, amountWei) desde wallet distribuidora |
| `/api/aura/mint` | POST | Bearer JWT (minter) | Prepara tx mint(al distribuidor, amountWei) desde wallet minter |
| `/api/aura/distributor-balance` | GET | No | Consulta balance de AURA y ETH de la wallet distribuidora |

### Farm (generación off-chain)

| Endpoint | Método | Auth | Descripción |
|----------|--------|------|-------------|
| `/api/farm/status` | GET | Bearer JWT | Estado del farm, streak, historial |
| `/api/farm/claim` | POST | Bearer JWT | Reclamo diario (0-100 AURA, 1 vez/24h) |
| `/api/farm/reclaim-complete` | POST | Bearer JWT | Mueve farm acumulado a aura_claimed on-chain |

---

## Flujo de Reclamo (Usuario Final)

1. El usuario interactúa en la plataforma (likes, points, farm diario)
2. El sistema acumula AURA off-chain en `auraReclamable`
3. El perfil muestra dos valores:
   - **AURA on-chain** (azul): balance real del contrato ERC-20 en la wallet del usuario
   - **AURA por reclamar** (morado, 6to token): pendiente de recibir on-chain
4. En la pestaña DEX, el usuario hace clic en "Reclaim Rewards"
5. El backend prepara una tx `transfer(address,uint256)` desde la wallet distribuidora
6. MetaMask se abre para que el usuario firme la transacción
7. Una vez confirmada, el backend limpia los `farm_claims` y actualiza `aura_claimed`
8. El balance on-chain del usuario se incrementa

---

## Variables de Entorno (Secrets)

Las siguientes variables deben configurarse como secrets en Cloudflare Workers:

| Variable | Descripción |
|----------|-------------|
| `AURA_CONTRACT` | Dirección del contrato AURA (var pública en wrangler.toml) |
| `AURA_RPC_URL` | URL del RPC de Base Mainnet |
| `AGENT_PRIVATE_KEY` | Private key de la wallet distribuidora **(NUNCA en código)** |
| `MINTER_ADDRESS` | Dirección de la wallet minter |
| `DISTRIBUTOR_ADDRESS` | Dirección de la wallet distribuidora |

> ⚠️ **Seguridad:** `AGENT_PRIVATE_KEY` debe configurarse via `wrangler secret put AGENT_PRIVATE_KEY`.
> No debe estar en ningún archivo de código, `.env` ni `wrangler.toml`.

---

## Consulta RPC (balance on-chain)

El balance on-chain se consulta mediante `eth_call` al contrato AURA en Base Mainnet.
Usa 2 RPCs de fallback en este orden (RPCs que funcionan desde Cloudflare Workers):

1. `https://base-rpc.publicnode.com` (rápido, sin rate limit)
2. `https://1rpc.io/base` (fallback)

**Timeout:** 8 segundos por RPC via `AbortController` manual.
**Parseo de respuesta:** `rpcRes.text()` + `JSON.parse()` (en vez de `rpcRes.json()` directo, para evitar errores de parseo).
**Parseo BigInt:** `BigInt(result) / 10n ** 16n / 100n` = división por 10^18.
**Caché:** El balance se cachea en D1 (`user_stats.aura_balance`). Se actualiza con `UPDATE` parcial (no `INSERT OR REPLACE` destructivo). Si RPC responde con `0x` (balance cero), se guarda 0. Si RPC falla, se conserva el último valor conocido.

### Caché inteligente
- **Siempre leer caché primero** (rápido, sin RPC)
- Solo consultar RPC si caché expiró (>60s) o nunca se consultó
- `UPDATE` parcial (solo `aura_balance` y `updated_at`)
- Si RPC da 0 y ya había balance positivo, se conserva el valor anterior

**Timeout:** 5 segundos por RPC via `AbortController` manual (`AbortSignal.timeout()` no está soportado en Cloudflare Workers).

**Parseo:** `BigInt(result) / 10n ** 16n / 100n` = división por 10^18 (18 decimales ERC-20).

**Caché:** El balance se cachea en D1 (`user_stats.aura_balance`) como fallback persistente.

---

## Verificación

- [x] Balance on-chain se muestra correctamente en el perfil
- [x] Parseo de 18 decimales: `BigInt / 10^16 / 100`
- [x] 3 RPCs de fallback con timeout 5s
- [x] `AbortController` manual (compatible con Workers)
- [x] Caché en D1 como fallback persistente
- [x] Wallet distribuidora documentada y sincronizada con código
- [x] Endpoint POST /api/aura/mint funcional
- [x] Endpoint GET /api/aura/distributor-balance funcional
- [x] Git ignore para secretos (`.env`, `.dev.vars`)

---

## Archivos Modificados

| Archivo | Cambio |
|---------|--------|
| `src/index.ts` | agentAddr corregido, RPC con 3 fallbacks, parseo 18 decimals, nuevos endpoints mint y distributor-balance, nuevos Bindings |
| `public/shared/js/profile.js` | Token AURA ahora dice "AURA on-chain", DEX tab con flujo claro, tooltips actualizados |
| `public/shared/css/profile.css` | CSS de `.token-aura-reclaim` añadido |
| `wrangler.toml` | Nuevos vars MINTER_ADDRESS y DISTRIBUTOR_ADDRESS |
| `.gitignore` | `.env`, `.env.*`, `.dev.vars` añadidos |
| `docs/RELEASE_v0.7.md` | Este documento |

---

## Commits en esta versión

```
a1f167b feat: conectar tokenomics AURA con la aplicación
4d6f60b fix: reparar consulta RPC de balance on-chain (parseo 18 decimals)
3f68e21 fix: restaurar parseo RPC al método que funcionaba (AbortController manual)
```

---

*"El Dharma se gana. El Aura fluye. El Karma se honra. El nivel se respeta. El poder se bloquea."*
