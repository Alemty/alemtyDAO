# Wallets del Ecosistema AURA

## Contrato AURA Token (Base Mainnet)

| Campo | Valor |
|---|---|
| **Dirección** | `0x74F685dA4D39e53e7Df6E0970b84224Ea0d00634` |
| **Red** | Base Mainnet (chainId: 8453) |
| **Estándar** | ERC-20 |
| **Hard Cap** | 5,000,000 AURA |
| **Supply actual** | 100 AURA |
| **Funciones clave** | `mint(address, uint256)`, `burn(address, uint256)`, `transfer`, `approve` |

## Wallets

### 1. Wallet Minter / Owner

| Campo | Valor |
|---|---|
| **Dirección** | `0x6A202f991c4C1df079449BE9847b1DaC3F51854f` |
| **Rol** | Owner del contrato AURA + Minter autorizado |
| **¿Qué puede hacer?** | Llamar `mint(address, uint256)` para acuñar nuevos AURA, `burn()` para quemar, `setMinter()` para cambiar el minter, `transferOwnership()` |
| **ETH (gas)** | ~$2 USD — suficiente para algunos mints |
| **Privada** | Guardada en CDP (Coinbase Developer Platform) |
| **Origen** | Creada por alemty durante setup inicial |

### 2. Wallet Distribuidora (por crear)

| Campo | Valor |
|---|---|
| **Dirección** | *(pendiente)* |
| **Rol** | Recibe AURA via mint desde la wallet minter y los distribuye a usuarios que reclaman |
| **¿Para qué?** | Centraliza el AURA antes de distribuirlo a usuarios finales |
| **Estado** | ❌ No creada aún |

## Flujo de Distribución

```
              ┌──────────────────┐
              │  Wallet Minter   │  ← Owner + Minter del contrato
              │  0x6A202f...54f  │
              └────────┬─────────┘
                       │ mint(AURA)
                       ▼
              ┌──────────────────┐
              │ Wallet Distrib.  │  ← Recibe todo el AURA minteado
              │  (por crear)     │
              └────────┬─────────┘
                       │ transfer(AURA)
                       ▼
              ┌──────────────────┐
              │  Usuarios finales│  ← Reclaman desde la UI (DEX → Reclaim)
              └──────────────────┘
```

## Estados del Token AURA

### Off-chain (contador en DB D1 — actual)
- **Dharma**: contador de interacciones (likes/points recibidos)
- **AURA mostrado en perfil**: `dharma + auraFarmed` (total generado off-chain)
- **auraReclamable**: farm claims pendientes de mintear
- Se usa mientras el contrato on-chain no tiene supply distribuido

### On-chain (contrato ERC-20 — futuro)
- **AURA mostrado en perfil**: balance real del contrato (`balanceOf`)
- El reclaim (botón en perfil → DEX) mintea los `auraReclamable` on-chain
- Después del mint, se limpian los `farm_claims` via `POST /api/farm/reclaim-complete`

## Endpoints Relacionados

| Endpoint | Método | Auth | Descripción |
|---|---|---|---|
| `/api/me/stats` | GET | Bearer JWT | Devuelve dharma, aura, auraReclamable, auraBalance |
| `/api/aura/claim` | POST | Bearer JWT | Prepara tx de mint para firmar con MetaMask |
| `/api/farm/reclaim-complete` | POST | Bearer JWT | Limpia farm_claims después de mintear on-chain |
| `/api/farm/claim` | POST | Bearer JWT | Registra claim diario de farm |
| `/api/farm/status` | GET | Bearer JWT | Estado del farm (streak, canClaim, etc.) |

## Seguridad

- La wallet minter/owner **nunca debe exponer su private key**
- El contrato AURA tiene hard cap de 5,000,000 AURA — no se puede exceder
- Solo `mint` desde la wallet minter autorizada
- `POST /api/farm/reclaim-complete` solo borra `farm_claims` del usuario autenticado (JWT)
