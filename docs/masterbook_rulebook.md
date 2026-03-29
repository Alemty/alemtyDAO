
# MASTER_RULEBOOK.md
## Ecosistema alemty.eth — Reglas Canónicas de la DAO
**Versión:** v0.03 (Economía Final)  
**Estado:** Canónico · Público · No financiero

---

## 0. Declaración de intención

El ecosistema **alemty.eth** es una plataforma de **identidad, coordinación social y gobernanza descentralizada**.

Este sistema:
- ❌ NO representa una inversión
- ❌ NO promete retornos financieros
- ❌ NO ofrece rendimientos económicos
- ❌ NO vende poder ni reputación
- ✅ Coordina participación, mérito y compromiso

---

## 1. Principios fundamentales (inmutables)

1. **Identidad soberana**
   - Cada usuario es un DID (wallet).
   - No existen cuentas Web2, correos ni contraseñas.

2. **Separación de funciones**
   - Mérito ≠ Dinero ≠ Poder ≠ Ejecución
   - Cada capa tiene un rol único.

3. **Meritocracia estricta**
   - El progreso no se compra.
   - El poder no se vende.
   - El compromiso no se transfiere.

---

## 2. Arquitectura económica (visión general)

El sistema utiliza **3 tokens funcionales** y **1 antitoken**:

| Componente | Tipo | Transferible | Función |
|----------|------|--------------|--------|
| **Dharma** | XP / Mérito | ❌ | Progreso y Niveles |
| **Aura** | Utility | ✅ | Consumo y gas social |
| **ALEM** | Gobernanza | ✅ | Decisión colectiva |
| **Karma** | Antitoken | ❌ | Fricción por salida |

Cada uno cumple una función **no intercambiable**.

---

## 3. Dharma (XP) — Mérito y Progreso

### 3.1 Qué es Dharma
- Dharma representa **experiencia acumulada (XP)**.
- ❌ No se compra
- ❌ No se transfiere
- ❌ No se dona
- ✅ Solo se gana por reconocimiento social

### 3.2 Cómo se obtiene Dharma
- Like recibido (post o comentario): `+1 Dharma`
- Puntos recibidos (+1..+10): `+1..+10 Dharma`  
  *(con límites diarios por DID emisor)*

---

## 4. Nivel (antes “Rango”)

- **Nivel** es el estado de progreso del usuario.
- El Nivel sube cuando la **barra de Dharma** se llena.
- El Nivel **no puede bajar**.

### 4.1 NFT de Nivel
- Cada subida de Nivel **mintea automáticamente un NFT de Nivel** al DID del usuario.
- El NFT de Nivel:
  - representa historial verificable,
  - puede ser soulbound o no transferible (recomendado).

---

## 5. Aura — Utility y Gas Social

### 5.1 Emisión
- Por cada **1 Dharma generado**, se genera **1 Aura** al receptor.
- Aura **no define** Nivel ni reputación.

### 5.2 Acciones gratuitas (onboarding)
- ✅ Comentar: **0 Aura**
- ✅ Dar like: **0 Aura**

Esto permite que nuevos usuarios comiencen a participar y ganar Aura **solo si reciben reconocimiento**.

### 5.3 Acciones que consumen Aura
Aura se consume para acciones que usan recursos del sistema:

| Acción | Costo sugerido |
|-----|---------------|
| Publicar post | 3 Aura |
| Consumir contenido premium | 5 Aura |
| Crear sala | 10 Aura |
| Crear tema | 8 Aura |
| Otorgar puntos | 1 Aura por punto |

### 5.4 Destino del Aura gastado
- 50% se **quema**
- 50% va a **tesorería interna**

Aura:
- ❌ No se lista en exchanges
- ❌ No se usa como inversión

---

## 6. AuraSeed — Crédito inicial (no económico)

Para evitar bloqueo de entrada:

- Cada DID nuevo recibe **AuraSeed (una sola vez)**.
- AuraSeed permite:
  - publicar **1 post**, o
  - consumir **1 contenido premium**.

AuraSeed:
- ❌ No es Aura real
- ❌ No se transfiere
- ❌ No se dona
- ❌ No se intercambia

---

## 7. ALEM — Gobernanza y Tesorería

### 7.1 Supply
- Supply máximo: `1,000,000,000 ALEM`
- Comunidad: `50%` (500M)
- Sin ICO, preventa ni promesas económicas.

### 7.2 Emisión por adopción (no por tiempo)

ALEM **NO se emite de forma fija**.

Se emite a la tesorería **por interacción social**, con un **factor decreciente por adopción**:

ALEM_event = 1 * m(N)
m(N) = clamp(m_min, 1, (N_ref / max(N, N_ref))^k)

Donde:
- `N` = DIDs activos/verificados
- `N_ref = 100`
- `k ≈ 0.6 – 0.7`
- `m_min = 0.02`

✅ Early adopters reciben más peso  
✅ La economía escala sin agotarse  

---

## 8. Karma — Fricción por salida

Karma representa **deuda con el sistema**.

### 8.1 Cuándo se genera Karma
- ✅ **Solo** cuando el usuario rompe un compromiso económico:
  - venta de tokens,
  - ruptura de locks,
  - salida anticipada de sistemas de staking.

### 8.2 Efectos del Karma
- El Nivel alcanzado **se conserva**.
- El usuario **no puede subir de Nivel** mientras tenga Karma.
- Karma se paga automáticamente con Dharma futuro.

Karma:
- ❌ No se paga con Aura
- ❌ No se paga con ALEM

---

## 9. veStakeNFT & veALEM (Staking de NFTs)

### 9.1 Staking de NFTs externos
El ecosistema permite stakear NFTs externos (ERC‑721 / ERC‑1155):

Ejemplos:
- Decentraland LAND
- OVRLand
- Wearables
- CharactersGPT
- Agents / Assets

### 9.2 Regla de custodia (estricta)
- El NFT **se transfiere a un contrato de staking**.
- **NO aparece en la wallet del usuario durante el lock**.
- **NO puede retirarse antes de completar el lock**, bajo ninguna circunstancia.

### 9.3 veALEM
- veALEM es **no transferible**.
- veALEM es **no vendible**.
- veALEM **NO representa valor económico**.
- veALEM **solo existe mientras el NFT esté stakeado**.

Ejemplo de veALEM mensual:

| NFT | veALEM / mes |
|---|---|
| DCL LAND | 200 |
| OVR LAND | 200 |
| Wearables / Assets | 50 |
| CharactersGPT | 100 |
| Agent / iNFT | 150 |

### 9.4 Final del lock
- Al completar el lock:
  - el NFT vuelve a la wallet,
  - veALEM se quema automáticamente.
- No existe retiro anticipado.

---

## 10. Prohibición de mercados secundarios

- ❌ veALEM NO puede venderse
- ❌ veNFTs NO pueden listarse
- ❌ NO se permiten mercados secundarios

> El compromiso no se compra.  
> El poder no se vende.

Esta decisión diferencia a alemty.eth de DAOs especulativas.

---

## 11. Gobernanza

- El peso de voto se calcula con:
  - ALEM (gobernanza base)
  - veALEM (compromiso activo)
- Las decisiones afectan:
  - parámetros económicos,
  - costos de Aura,
  - límites,
  - nuevas integraciones.

---

## 12. Principio final

> El Dharma se gana.  
> El Aura se usa.  
> El ALEM gobierna.  
> El veALEM compromete.  
> El Karma recuerda.

**alemty.eth es una DAO de consciencia, no de especulación.**

---
