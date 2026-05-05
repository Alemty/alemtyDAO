
# TOKENOMICS_RULEBOOK.md  
alemty.eth — Sistema Económico Canónico v1.2  
**Estado:** Definitivo · Auditable · Apto para deployment  
**Blockchain:** Base (L2 Ethereum)  
**Filosofía:** El mérito no se compra. El valor circula. El poder se bloquea.

---

## Changelog v1.2 (sobre v1.1)

- veSTAKE: lineal → curva √ + cap 500K (anti-plutocracia)
- Aura halving: + piso h_min=0.05 (anti-death del sistema)
- DC staking: + cap 2,000/mes + bloqueo de nivel >Diamante sin DS
- DC one-time: fijo 1,000 → tiered por monto de stake
- Quorum: definido en 4 niveles A/B/C/D
- DEX: especificado en 4 fases modulares desacopladas
- Treasury: 3 buckets con política de uso
- AuraSeed: condicionado a verificación anti-Sybil
- Karma Social: mecanismo de apelación en 2 niveles
- Aura: hard cap relativo al pool ALEM

---

## 0. Declaración de separación regulatoria

Este sistema no representa equity, instrumento financiero ni promesa de retorno. El diseño cumple los principios de no-security bajo el test de Howey:

| Componente | Tipo | Transferible | On-chain | Función única |
|---|---|---:|---:|---|
| Dharma | XP / Reputación | ❌ | ❌ | Progreso y niveles |
| Karma | Antitoken / Deuda | ❌ | ❌ | Fricción por ruptura |
| Aura | Utility token interno | ✅ interno | ❌ listed | Gas social |
| ALEM | Governance token | ✅ | ✅ Base | Gobernanza + DEX |

- Dharma / Karma: off-chain, no tokenizados, sin mercado. Imposible clasificar como security.
- Aura: utility cerrada, sin mercado externo. Comparable a créditos de plataforma.
- ALEM: governance. Sin dividendos, sin obligación de retorno. Coordinación, no inversión.

---

## 1. DHARMA — Reputación Social Off-Chain

### 1.1 Dos tipos de Dharma

| Tipo | Fuente | ¿Permanente? | ¿Genera Aura? |
|---|---|---:|---:|
| Dharma Social (DS) | Interacción del foro | ✅ siempre | ✅ siempre |
| Dharma Condicional (DC) | Staking ALEM/NFT | ⚠️ mientras activo | ❌ nunca |

**Regla inmutable:** Solo DS genera Aura. Solo DS paga Karma. DC es acelerador de nivel, no de reputación.

### 1.2 Fuentes de Dharma Social (DS) — Permanentes

| Acción | DS ganado | Límite anti-spam |
|---|---:|---|
| Like recibido (post o comentario) | +1 DS | 20 likes/día por emisor |
| Punto recibido (+1 a +10/post) | +1 DS por punto | 10 pts/post/emisor · 50 pts/día total |
| Post destacado orgánico (score ≥ 200) | +5 DS bono | 1 bono/post · 1/semana por DID |

**Límite anti-farm por par DID→DID (doble):**
- DS máximo recibible desde un mismo DID: 5 DS/día
- DS máximo emitible hacia un mismo DID: 5 DS/día
- Cualquier interacción posterior en el mismo día no genera DS (sí Aura al emisor sigue suspendida)

### 1.3 Fuentes de Dharma Condicional (DC) — Staking

Cap total por DID: 2,000 DC/mes (suma de todos los NFTs + ALEM en lock).
Si el total supera el cap, se distribuye proporcionalmente entre los locks activos.

| Fuente | DC ganado | Lock mínimo |
|---|---:|---:|
| NFT Common (asset/wearable) | +50 DC/mes | 30 días |
| NFT Rare | +100 DC/mes | 60 días |
| NFT Land (DCL/OVR/etc) | +200 DC/mes | 90 días |
| iNFT / AI Agent | +150 DC/mes | 60 días |
| ALEM stakeado (one-time, tiered) | ver tabla §1.4 | ver tabla §1.4 |

**Regla de nivel:** Los niveles Avanzado (12,000) en adelante requieren que al menos el 60% del Dharma total sea DS. Sin esta condición, el nivel queda bloqueado aunque el Dharma total supere el umbral.

\[
Condición_{avanzado} = (DS_{acumulado} / Dharma_{total}) \ge 0.60
\]

Esto significa que el staking puede llevar hasta Diamante (5,000) rápidamente, pero los niveles de maestría requieren participación real sostenida.

### 1.4 DC One-Time por stake de ALEM (tiered)

| ALEM stakeados (primer stake, one-time) | DC otorgado |
|---:|---:|
| < 100 ALEM | 0 DC (no elegible) |
| 100 – 999 ALEM | +200 DC |
| 1,000 – 9,999 ALEM | +500 DC |
| 10,000 – 99,999 ALEM | +1,000 DC |
| 100,000+ ALEM | +1,500 DC |

Este DC one-time es parte del pool de DC y cuenta para el cap mensual del mes en que se otorga.

### 1.5 Karma por ruptura de lock

NFT (salida anticipada):
Karma = DC_mensual_del_NFT × meses_restantes × 0.5

Ejemplo: unstakear Land (200 DC/mes), quedan 2 meses → Karma = 200 × 2 × 0.5 = 200

ALEM (unstake anticipado):
Karma = DC_one_time_recibido × (días_restantes / días_totales_lock)

Ejemplo: stake de 5,000 ALEM (+1,000 DC) a mitad del lock → Karma = 1,000 × 0.5 = 500

### 1.6 La Doble Barra del perfil

DHARMA   ████████████░░░░  57%  → 2,850 / 5,000 DS+DC  [Nivel: Diamante]
KARMA    ███░░░░░░░░░░░░░        Deuda: 320 pts
         ⛔ NIVEL BLOQUEADO — Cada DS ganado salda Karma 1:1

**Mecánica del bloqueo:**
- Karma > 0 → nivel congelado
- Cada DS ganado → primero resta Karma (1:1), luego acumula Dharma
- Aura sigue generándose aunque haya Karma (no castigo doble)
- Karma activo → SwapFactor reduce ratio Aura→ALEM (ver §4.4)

---

## 2. KARMA — El Antitoken

### 2.1 Fuentes de Karma

**Karma Económico (automático, smart contract):**
- Ruptura de lock NFT → fórmula §1.5
- Ruptura de lock ALEM → fórmula §1.5
- Venta de NFT de Nobleza durante mandato activo → +500 Karma fijo

**Karma Social (moderadores / agentes IA):**

| Infracción | Karma aplicado | Requiere |
|---|---:|---|
| Flood / spam confirmado | +10 a +50 | 1 mod |
| PK injustificado a usuario < Iniciado | +25 | 1 mod |
| Violación de reglas del foro | +10 a +100 | 1 mod |
| Contenido fraudulento validado | +100 | 2 mods |
| Ataque coordinado / Sybil confirmado | +200 a +500 | 3 mods o DAO Tipo A |

### 2.2 Cómo se paga

Solo con Dharma Social futuro — 1 DS ganado = 1 Karma saldado
❌ No con Aura · ❌ No con ALEM · ❌ No con dinero

### 2.3 Sistema de apelación (nuevo en v1.2)

**Nivel 1 — Peer Review (48 horas):**
- El usuario puede solicitar revisión si tiene nivel ≥ Iniciado
- 3 moderadores distintos al que aplicó deben confirmar la infracción
- Si 2/3 revocan: Karma revertido + anotación en KarmaLedger

**Nivel 2 — DAO Vote Tipo A:**
- Disponible si Nivel 1 fue denegado y el usuario tiene nivel ≥ Plata
- Se abre votación pública de 48h con quorum Tipo A (3% DIDs activos)
- Si se revoca: Karma revertido + el moderador recibe revisión de permisos

---

## 3. NIVELES — Sistema de Progresión

### 3.1 Tabla de niveles

| # | Nombre | Dharma mínimo | DS mínimo requerido | Tiempo estimado |
|---:|---|---:|---:|---|
| 1 | 🥚 Novato | 0 | 0% | Día 1 |
| 2 | 🌱 Iniciado | 100 | 0% | ~2 semanas |
| 3 | 🥈 Plata | 500 | 0% | ~2 meses |
| 4 | 🥇 Oro | 1,500 | 0% | ~6 meses |
| 5 | 💎 Diamante | 5,000 | 0% | ~18 meses |
| 6 | ⚡ Avanzado | 12,000 | 60% | ~3 años |
| 7 | 🔮 Refinado | 30,000 | 60% | ~6 años |
| 8 | ✨ Único | 75,000 | 70% | top 1% |
| 9 | 🏆 Élite | 150,000 | 75% | top 0.1% |
| 10 | 👁️ Superior | 300,000 | 80% | leyenda |
| 11 | 🐉 Amasterdamo | 600,000 | 90% | fundadores |

### 3.2 NFT de Nivel (Medal NFT — soulbound)

- ERC-5114 no transferible
- Se mintea al alcanzar cada nivel
- Visible en perfil, avatar MMORPG y como badge verificable on-chain
- Vender: genera Karma = +10 × número_de_nivel (el comprador no hereda nada)

### 3.3 Permisos por nivel

| Nivel | Posts/día | Crear sala | Crear tema | Votos simbólicos | Backroom |
|---|---:|---:|---:|---:|---:|
| Novato | 1 | ❌ | ❌ | 0 | ❌ |
| Iniciado | 2 | ❌ | ❌ | 1 | ❌ |
| Plata | 3 | ❌ | ✅ | 2 | ❌ |
| Oro | 5 | ✅ | ✅ | 3 | ✅ |
| Diamante+ | 10+ | ✅ | ✅ | 4 | ✅ |
| Avanzado+ | ilimitado | ✅ | ✅ | 5 | ✅ |

---

## 4. AURA — Token de Utilidad

### 4.1 Emisión por epoch (decay con piso)

Aura se genera solo desde DS. La cantidad por evento decae conforme la plataforma crece, pero nunca llega a cero:

\[
AuraPerEvent(e) = Aura₀ × m(Nₑ) × h(e)
\]

Donde:
- Aura₀ = 1.0 Aura (valor base)
- e = número de epoch (semanal)
- m(Nₑ) = 1 / (1 + α × ln(1 + Nₑ)), α = 0.001
- h(e) = max(h_min, 2^(-e/H)), H = 26 epochs (≈ 6 meses por halving), h_min = 0.05

**Eventos que generan Aura:**
- Like recibido → +AuraPerEvent(e) al receptor
- Punto recibido → +AuraPerEvent(e) por punto al receptor
- AuraSeed (one-time, condicionado) → +5 Aura fijo

### 4.2 AuraSeed — anti-Sybil

El AuraSeed de +5 Aura solo se otorga si el DID cumple una de estas condiciones:
- ENS ≥ 30 días
- Referral por DID ≥ Iniciado
- Wallet con historial on-chain ≥ 90 días (cualquier EVM)

Sin verificación: el DID puede participar (comentar, recibir Aura orgánica), pero no recibe el seed.

### 4.3 Hard cap de Aura circulante

Para preservar el ratio Aura/ALEM y la salud del pool:
\[
Aura_{max\_circulante} = ALEM_{en\_pool\_interno} × ratio_{actual} × 2
\]

Ejemplo: 100,000 ALEM en pool, ratio=1,000 → cap = 200,000,000 Aura

El cap es dinámico: crece con el pool. Cuando el circulante alcanza el cap, la emisión de Aura se detiene temporalmente hasta que el pool crece (por más ALEM lockeado o aportado).

### 4.4 Costos en Aura (Gas Social)

| Acción | Costo | Destino del Aura gastado |
|---|---:|---|
| Publicar post | 3 Aura | 50% quema · 50% treasury |
| Dar 1 punto a un post | 1 Aura/pt | 100% al autor |
| Crear tema en foro | 8 Aura | 50% quema · 50% treasury |
| Crear sala (backroom) | 10 Aura | 50% quema · 50% treasury |
| Acceso contenido premium | 5 Aura | 80% autor · 20% treasury |
| Post boost (48h) | 20 Aura | 50% quema · 50% treasury |

**Nota sobre puntos:** Dar puntos transfiere Aura existente del emisor al receptor (redistribución), y además el receptor mintea Aura nueva por DS generado según §4.1. El emisor no gana DS ni Aura por dar puntos.

### 4.5 Pool interno Aura ↔ ALEM (AMM)

**Configuración inicial:**
- Precio: 1,000 Aura = 1 ALEM
- Mecanismo: producto constante (x × y = k)

**SwapFactor por Karma (nuevo en v1.2):**
Si el DID tiene Karma activo, la conversión Aura→ALEM se reduce:
\[
SwapFactor(K) = 1 / (1 + 0.002 × K)
\]

Ejemplos:
- Karma = 0   → Factor = 1.00 (sin fricción)
- Karma = 100 → Factor = 0.83 (pierde 17% del ALEM esperado)
- Karma = 500 → Factor = 0.50 (50% menos eficiente)

El Aura gastado en el swap sí se procesa completo — solo el ALEM recibido es menor. La diferencia va a treasury.

**Circuit breaker diario:**
\[
ALEM_{out\_max\_día} = β × ALEM_{en\_pool}
\]
β = 1% (ajustable por gobernanza Tipo A)

**Fee dinámico por presión:**
\[
fee = fee₀ + γ × (ΔAura / Aura_{pool})
\]
fee₀ = 0.3% · γ = 2.0

---

## 5. ALEM — Token de Gobernanza

### 5.1 Supply y distribución (inmutable)

Supply máximo: 1,000,000,000 ALEM

| Segmento | % | Tokens | Vesting |
|---|---:|---:|---|
| Comunidad (LP, staking, incentivos) | 50% | 500,000,000 | Emisión programática DEX |
| Reserva estratégica | 20% | 200,000,000 | DAO Tipo C · timelock 12 meses |
| Equipo fundador | 15% | 150,000,000 | 12m cliff + 48m linear |
| DAO / Tesorería | 10% | 100,000,000 | Propuestas con quorum |
| Growth / Grants | 5% | 50,000,000 | Multisig 3/5 · por etapas |

❌ Sin ICO · ❌ Sin preventa · ❌ Sin mint discrecional sin gobernanza

### 5.2 Emisión determinista (decay por adopción)

ALEM no se emite por likes ni puntos. Solo por eventos de alta señal y baja frecuencia:

**Eventos calificados ALEM:**
- Post destacado orgánico con score ≥ 200 y anti-sybil pasado
- Participación sostenida semanal (misiones verificadas)
- Voto en propuesta de gobernanza activa
- Proveer liquidez al pool ALEM (Fase DEX 1+)
- Lock veSTAKE (primer lock, one-time por DID)
- Contribución verificada (dev, moderación, grant)

Cap por DID: 1–3 eventos calificados por semana

Fórmula de emisión:
\[
ALEM_{por\_evento} = base\_rate × m(N)
\]
\[
m(N) = clamp(m_{min}, 1.0, (N_{ref} / max(N, N_{ref}))^k)
\]

Donde:
- base_rate = 1 ALEM
- N = DIDs activos este mes
- N_ref = 1,000
- k = 0.65
- m_min = 0.02

---

## 5.3 veSTAKE — Vote Escrow (anti-plutocracia v1.2)

\[
veSTAKE = min(√(ALEM_{locked}) × (días_{lock} / 30), 500,000)
\]

Decae linealmente hasta 0 al final del lock. Para mantener poder político hay que hacer relock.

---

## 6. GOBERNANZA — Quorum y Propuestas

| Tipo | Ejemplos | Quorum | Aprobación | Timelock |
|---|---|---:|---:|---:|
| A Operativo | costos Aura, límites cooldown, β del circuit breaker | 3% DIDs activos | >50% | 24h |
| B Económico | decay k, cap DC, h_min, fee₀ del AMM | 5% DIDs activos | 60% | 72h |
| C Estructural | nueva capa, nueva fase DEX, nuevo tipo NFT | 10% DIDs activos | 67% | 7 días |
| D Canónico | modificar reglas inmutables de este documento | 15% DIDs activos | 80% | 14 días

