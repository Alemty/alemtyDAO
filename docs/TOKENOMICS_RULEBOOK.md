# TOKENOMICS_RULEBOOK.md

**alemty.eth — Sistema Económico Canónico v1.3**  
**Estado:** Definitivo · Auditable · Apto para deployment  
**Blockchain:** Base (L2 Ethereum)  
**Filosofía:** El mérito no se compra. El valor circula. El poder se bloquea.

> **No financiero.** Ningún componente representa equity ni promesa de retorno.

---

## 0) Separación regulatoria (canónica)

| Componente | Tipo | Transferible | On-chain | Función única |
|---|---|---:|---:|---|
| **Dharma** | XP / Reputación | ❌ | ❌ | Progreso y niveles |
| **Karma** | Antitoken / Deuda | ❌ | ❌ | Fricción por ruptura y conducta |
| **Aura** | Utility interno | ✅ (interno) | ❌ listed | Gas social + consumo + buffer |
| **ALEM** | Governance token | ✅ | ✅ Base | Gobernanza + DEX |

**Reglas canónicas:**
- Dharma y Karma son off-chain y no transferibles.
- Aura es utility cerrada; no hay listing externo directo.
- ALEM es coordinación/gobernanza; no promete retornos.

---

## 1) DHARMA — Reputación Social Off‑Chain

### 1.1 Dos tipos de Dharma

| Tipo | Fuente | ¿Permanente? | ¿Genera Aura? |
|---|---|---:|---:|
| **Dharma Social (DS)** | Interacción del foro | ✅ siempre | ✅ siempre |
| **Dharma Condicional (DC)** | Staking ALEM/NFT | ⚠️ mientras activo | ❌ nunca |

**Inmutable:** Solo DS genera Aura. Solo DS paga Karma. DC es acelerador de nivel.

### 1.2 Fuentes de Dharma Social (DS)

| Acción | DS ganado | Anti-spam |
|---|---:|---|
| Like recibido (post o comentario) | +1 DS | 20 likes/día por emisor |
| Punto recibido (+1..+10/post) | +1 DS por punto | 10 pts/post/emisor · 50 pts/día total |
| Post destacado orgánico (score ≥ 200) | +5 DS bono | 1 bono/post · 1/semana por DID |

**Anti-farm por par DID→DID (doble cap):**
- DS máximo recibible desde un mismo DID: **5 DS/día**
- DS máximo emitible hacia un mismo DID: **5 DS/día**

---

## 2) DHARMA CONDICIONAL (DC) — Staking con límites

### 2.1 Cap mensual de DC
- **Cap total por DID:** **2,000 DC/mes** (suma de locks). Si excede, prorrateo.

### 2.2 DC por NFT (mensual)
- Common: +50 DC/mes (30 días)
- Rare: +100 DC/mes (60 días)
- Land: +200 DC/mes (90 días)
- iNFT/Agent: +150 DC/mes (60 días)

### 2.3 DC one-time por stake ALEM (tiered)
| ALEM stakeado (primer stake) | DC one-time |
|---:|---:|
| < 100 | 0 |
| 100–999 | 200 |
| 1,000–9,999 | 500 |
| 10,000–99,999 | 1,000 |
| ≥ 100,000 | 1,500 |

### 2.4 Niveles altos requieren DS real
Para Avanzado (12,000) en adelante:
\[ DS / (DS + DC\_activo) \ge 0.60 \]
Y sube por nivel (ver tabla de niveles).

---

## 3) KARMA — Antitoken / deuda

### 3.1 Pago
- **Solo con DS futuro:** 1 DS = 1 Karma amortizado.
- No se paga con Aura ni con ALEM.

### 3.2 Bloqueo
- Karma > 0 → nivel congelado.
- DS nuevo primero resta Karma (1:1).
- Aura sigue generándose (no castigo doble).

### 3.3 Apelación (2 niveles)
- Peer review 48h (3 mods)
- DAO vote Tipo A si aplica.

---

## 4) NIVELES — Tabla (DS% mínimo)

| # | Nivel | Dharma mínimo | DS% mínimo |
|---:|---|---:|---:|
| 1 | Novato | 0 | 0% |
| 2 | Iniciado | 100 | 0% |
| 3 | Plata | 500 | 0% |
| 4 | Oro | 1,500 | 0% |
| 5 | Diamante | 5,000 | 0% |
| 6 | Avanzado | 12,000 | 60% |
| 7 | Refinado | 30,000 | 60% |
| 8 | Único | 75,000 | 70% |
| 9 | Élite | 150,000 | 75% |
| 10 | Superior | 300,000 | 80% |
| 11 | Amasterdamo | 600,000 | 90% |

---

## 5) AURA — Utility interno

### 5.1 Emisión por epoch (decay + piso)
**Epoch:** semanal.
\[ AuraPerEvent(e) = Aura_0 \cdot m(N_e) \cdot h(e) \]
- Aura₀ = 1.0
- \( m(N_e)=1/(1+lpha\ln(1+N_e)) \), α=0.001
- \( h(e)=\max(h_{min}, 2^{-e/H}) \), H=26 epochs, h_min=0.05

**Eventos:**
- Like recibido → +AuraPerEvent al receptor
- Punto recibido → +AuraPerEvent por punto al receptor
- AuraSeed → +5 Aura (one-time condicionado)

### 5.2 AuraSeed anti-sybil
Se otorga si cumple 1:
- ENS ≥ 30 días
- referral por DID ≥ Iniciado
- historial on-chain ≥ 90 días

### 5.3 Costos (gas social)
- Post: 3 Aura (50% burn, 50% treasury)
- Punto dado: 1 Aura/pt (100% al autor)
- Tema: 8 Aura (50/50)
- Sala: 10 Aura (50/50)
- Premium: 5 Aura (80% autor, 20% treasury)
- Boost: 20 Aura (50/50)

### 5.4 Hard cap dinámico de Aura
\[ Aura_{max} = 2 \cdot ALEM_{pool} \cdot Price_{Aura/ALEM} \]
Si se alcanza el cap, la emisión se pausa hasta que el cap suba o el circulante baje.

---

## 6) Pool interno Aura ↔ ALEM (AMM)

- **Precio inicial:** 1,000 Aura = 1 ALEM (starting price)
- AMM producto constante (x·y=k)
- **Circuit breaker:** ALEM_out_día ≤ β · ALEM_pool, β=1% (DAO Tipo A)
- **SwapFactor(K):** 1/(1+0.002K). La diferencia va a treasury.

---

## 7) ALEM — Token de gobernanza

- Supply máximo: 1,000,000,000 ALEM.
- Sin ICO / preventa.

### 7.1 Emisión: NO por likes/puntos
Eventos calificados (alta señal, baja frecuencia):
- Post destacado orgánico (score ≥ 200) + anti-sybil
- Misiones semanales verificadas
- Voto en gobernanza
- Proveer liquidez / lock veSTAKE
- Contribución verificada

Cap por DID: 1–3 eventos/semana.

Emisión:
\[ ALEM_{evento} = base\_rate \cdot m(N) \]
con clamp (m_min=0.02) y k=0.65.

---

## 8) veSTAKE (anti-plutocracia)
\[ veSTAKE = \min(\sqrt{ALEM_{locked}}\cdot (days/30), 500,000) \]
Decae linealmente hasta 0.

---

## 9) Gobernanza (quórums A/B/C/D)
- Tipo A: 3% · >50% · timelock 24h
- Tipo B: 5% · 60% · timelock 72h
- Tipo C: 10% · 67% · timelock 7d
- Tipo D: 15% · 80% · timelock 14d

---

## 10) Ledger auditable (obligatorio)
AuraLedger: mint|spend|transfer|swap_out|swap_in|burn
KarmaLedger: lock_break|moderation|appeal|repayment

---

**El Dharma se gana. El Aura fluye. El Karma se honra. El nivel se respeta. El poder se bloquea.**
