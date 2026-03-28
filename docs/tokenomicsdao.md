
# Tokenomics de alemty — Documento Técnico

## 1. Alcance y objetivo

Este documento describe **la arquitectura económica formal del ecosistema alemty**, incluyendo:

- definición de activos
- reglas de emisión y distribución
- mecanismos de gobernanza
- diseño del DEX bajo modelo v3,3
- flujos de incentivos, bribes y composición de rendimiento

El objetivo es **describir el sistema de forma verificable**, evitando ambigüedades financieras y separando claramente **utility, gobernanza y especulación externa**.

---

## 2. Principios económicos del sistema

alemty se diseña bajo los siguientes principios:

1. **Primacía del uso sobre el capital**
2. **Separación entre reputación, utilidad y poder**
3. **Gobernanza basada en bloqueo temporal**
4. **Emisión controlada y dirigida**
5. **No dependencia de inflación continua**
6. **Incentivos alineados con actividad real**

El sistema **no garantiza retornos**, ni optimiza para precio de mercado, sino para **coordinación eficiente de recursos**.

---

## 3. Activos del ecosistema

### 3.1 Dharma (XP / reputación)

- Activo no transferible
- No on-chain tradable
- Se genera por eventos verificables:
  - actividad social
  - contribuciones técnicas
  - participación sostenida
- Función:
  - control de acceso
  - ranking
  - elegibilidad a roles

Dharma **no tiene conversión directa a valor económico**.

---

### 3.2 Aura (utility token interno)

- Token fungible de utilidad
- Emisión ligada a generación de Dharma
- Uso restringido al ecosistema
- No listado directamente en mercados externos

Funciones:
- acceso a servicios
- pago de acciones internas
- donaciones
- conversión controlada a ALEM

Aura actúa como **buffer económico**, desacoplando mérito de mercado.

---

### 3.3 Karma (pasivo del sistema)

- Representa deuda de comportamiento o fricción
- Se genera por:
  - abuso
  - reportes válidos
  - ruptura de compromisos (ej. des‑stake prematuro)
- Efecto:
  - bloqueo de progreso
  - reducción temporal de elegibilidad

Karma se amortiza automáticamente con Dharma futuro.

---

### 3.4 ALEM (token económico)

- Token fungible ERC‑20 (o equivalente)
- Transferible
- Utilizado para:
  - DEX
  - staking
  - provisión de liquidez
  - coordinación DAO

ALEM **no otorga gobernanza directa**.

---

### 3.5 veALEM (token de voto)

- ALEM bloqueado por tiempo
- No transferible
- Decae linealmente hasta desbloqueo
- Representa:
  - poder de voto
  - dirección de incentivos
  - control de parámetros económicos

---

## 4. Emisión de ALEM

### 4.1 Límite de emisión

- Supply máximo teórico: **1,000,000,000 ALEM**
- No existe emisión infinita

### 4.2 Política de emisión

- Emisión:
  - progresiva
  - programática
  - condicionada
- Fuentes de emisión:
  - incentivos de liquidez
  - recompensas por staking
  - asignaciones DAO

No existe:
- ICO
- preventa
- mint discrecional sin gobernanza

---

## 5. Distribución inicial (teórica)

| Segmento        | % Máx. | Función |
|-----------------|--------|--------|
| Comunidad       | 50%    | LP, staking, incentivos |
| Reserva         | 20%    | estabilidad / contingencia |
| Equipo          | 15%    | desarrollo continuo |
| DAO / Tesorería | 10%    | grants / operaciones |
| Growth          | 5%     | integraciones |

Todas las asignaciones:
- están sujetas a desbloqueo progresivo
- pueden ser ajustadas en ritmo (no en límites) por DAO

---

## 6. DEX alemty — Modelo v3,3

El DEX implementa un **modelo v3,3** basado en:

- vote‑escrow (veALEM)
- dirección de liquidez
- incentivos variables
- competencia entre pools

### 6.1 Actores del sistema

- Traders → generan fees
- LPs → aportan liquidez
- Stakers → bloquean ALEM
- veALEM holders → dirigen incentivos
- Pools → compiten por liquidez

---

## 7. Dirección de incentivos

- Las emisiones de ALEM **no se distribuyen de forma uniforme**
- Los holders de veALEM votan:
  - qué pools reciben incentivos
  - en qué proporción

Esto:
- elimina farming pasivo
- penaliza pools sin volumen
- incentiva liquidez eficiente

---

## 8. Bribes (incentivos de voto)

Los pools pueden ofrecer **bribes** a veALEM:

- bribes = incentivos adicionales
- se pagan por voto dirigido
- pueden consistir en:
  - ALEM
  - tokens externos
  - share de fees

Resultado:
- alineación LP ↔ traders ↔ votantes
- mercado de liquidez autorregulado

---

## 9. Staking y provisión de liquidez

### 9.1 Staking ALEM

- bloqueo voluntario
- generación de rewards
- generación de veALEM

### 9.2 LP

- ingresos por:
  - trading fees
  - incentivos dirigidos
- riesgo transparente (impermanent loss)

---

## 10. Interés compuesto

Los rewards generados por:
- staking
- LP
- bribes

pueden:
- reinvertirse
- aumentar exposición
- reforzar poder de voto

El interés compuesto **no depende de inflación artificial**, sino de:
- volumen real
- uso del DEX
- decisiones de gobernanza

---

## 11. Gobernanza económica

La gobernanza controla:

- parámetros de emisión
- pesos de incentivos
- reglas del DEX
- políticas de tesorería

Requisitos:
- bloqueo temporal
- compromiso de largo plazo

No existe gobernanza instantánea ni delegación sin stake.

---

## 12. Consideraciones regulatorias

- El sistema no promete retornos
- Los tokens no representan equity
- No existe obligación fiduciaria
- La DAO no es entidad legal
- El riesgo es asumido por el participante

El diseño prioriza **utility y coordinación**, no captación de capital.

---

## 13. Conclusión técnica

La tokenomics de alemty constituyen:

- un sistema de reputación desacoplado
- una economía de utilidad controlada
- un DEX de liquidez dirigida
- una gobernanza basada en tiempo y bloqueo

El modelo v3,3 permite que **el capital siga al uso**, y que la emisión esté subordinada a decisiones colectivas informadas.

alemty optimiza para **estabilidad sistémica**, no para ciclos especulativos.

