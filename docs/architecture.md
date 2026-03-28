# Arquitectura del Ecosistema **alemty.eth** (v0.02)

> Documento pensado para **VS Code / GitHub**.  
> Enfocado en **arquitectura modular por subdominios**, flujos de identidad (DID/SIWE), capas sociales (DAO) y capas económicas (TOKEN/DEX), con extensiones para Web Espacial IA y AR.

---

## 1) Principios de diseño

### 1.1 Modularidad por capas
El ecosistema se construye de forma incremental y modular: **identidad → comunidad → economía → infraestructura DeFi → IA → AR**. Este orden evita “infraestructura sin producto” y permite escalar sin colapsar el sistema.

### 1.2 Seguridad y privacidad
- Participación mediante **wallet** (DID), sin almacenar información personal.
- Autenticación basada en **firma** (SIWE / firma tipo login) y uso de **nonce** para evitar replay.

### 1.3 Tokenomics como utilidad social
El token se plantea como coordinación de comportamiento, acceso, reputación y gobernanza; **no como inversión / equity / promesa de retorno**. Supply máximo teórico 1B y distribución 50/20/15/10/5.

---

## 2) Mapa de subdominios (Single Responsibility)

> Cada subdominio tiene una **responsabilidad única**. Esto reduce superficie de ataque y facilita auditoría.

```

alemty.eth
│
├── alemty.eth
│   ├── ID (identidad pública)
│   ├── DID (identidad on-chain)
│   └── SIWE / Firma (autenticación)
│
├── dao.alemty.eth
│   ├── Foro
│   │   ├── Posts
│   │   ├── Comentarios
│   │   └── Temas
│   │
│   ├── Backrooms
│   │   ├── Salas privadas
│   │   └── Grupos de trabajo
│   │
│   └── Infraestructura de sesión
│       ├── Nonce (anti-replay)
│       └── Cloudflare / backend de soporte
│
├── token.alemty.eth
│   ├── Dashboard Tokenomics
│   │   └── Estado económico del usuario
│   │
│   ├── Dharma
│   │   └── XP / mérito no transferible
│   │
│   ├── Aura
│   │   └── Token de utilidad interna
│   │
│   ├── Karma
│   │   └── Deuda / fricción de sistema
│   │
│   ├── ALEM
│   │   └── Token de gobernanza
│   │
│   └── Sala de Gobernanza
│       ├── Propuestas
│       ├── Votaciones
│       └── Consenso
│
├── dex.alemty.eth
│   ├── Swap
│   ├── Dashboard Rewards
│   ├── Stake
│   │   ├── Lock ALEM
│   │   ├── Lock NFTs externos
│   │   └── Lock NFTs → veNFT
│   │
│   ├── LP
│   │   ├── Pools
│   │   └── Proveer liquidez
│   │
│   ├── Vote
│   └── Incentives / Bribes
│
├── ia.alemty.eth          (FASE 1 — IA OPERATIVA)
│   │
│   ├── Onboarding Inteligente
│   │   ├── Autenticación DID / SIWE
│   │   ├── Perfil de cliente
│   │   │   ├── Datos on-chain
│   │   │   └── Datos off-chain
│   │   └── Scope del proyecto
│   │       └── Briefing asistido por IA
│   │
│   ├── Dashboard de Proyectos
│   │   ├── Estado del proyecto
│   │   ├── Métricas clave
│   │   ├── Simulaciones
│   │   │   ├── Económicas
│   │   │   └── Sociales
│   │   └── Historial auditable
│   │
│   ├── Agentes IA Especializados
│   │   ├── Agente Económico
│   │   │   └── Tokenomics / incentives
│   │   │
│   │   ├── Agente Social
│   │   │   └── DAO / comunidad
│   │   │
│   │   ├── Agente Técnico
│   │   │   └── Arquitectura / smart contracts
│   │   │
│   │   └── Agente Creativo
│   │       └── UX / AR / narrativa
│   │
│   └── Reporting Inteligente
│       ├── Reportes off-chain
│       │   ├── PDF
│       │   └── Dashboards
│       │
│       ├── Snapshots on-chain
│       │   └── Hash / prueba verificable
│       │
│       └── Recomendaciones accionables
│
└── ar.alemty.eth          (FASE 2 — WEB ESPACIAL / AR)
    │
    ├── Introducción a la Web Espacial
    │   ├── Qué es
    │   ├── Qué NO es
    │   ├── Casos de uso reales
    │   └── Relación con la consultora
    │
    ├── Acceso Espacial
    │   ├── Autenticación por DID / NFT
    │   ├── Espacios
    │   │   └── Lands funcionales
    │   │
    │   ├── Assets
    │   │   └── Objetos interactivos
    │   │
    │   └── Avatares
    │       └── Credenciales y roles
    │
    ├── Promotoría AR + IA
    │   ├── Agentes IA visibles en el espacio
    │   ├── Simulaciones en tiempo real
    │   ├── Workshops inmersivos
    │   └── Presentaciones a clientes
    │
    └── Reporting Espacial
        ├── Visualización on-chain
        ├── Dashboards 3D / AR
        ├── Exportación off-chain
        └── Evidencia auditable



```

**Responsabilidades:**
- **alemty.eth**: identidad + login + perfil base.
- **dao.alemty.eth**: interacción social (foro) y organización comunitaria.
- **token.alemty.eth**: **estado económico** y **gobernanza** (lectura/decisión).
- **dex.alemty.eth**: **ejecución económica** (acciones que mueven valor).
- **ia.ar**: capas futuras (automatización y experiencia).

---

## 3) Componentes de identidad (ID / DID / SIWE)

### 3.1 DID
- DID = dirección wallet (ej. Ethereum) + rol/resolución.
- El DID se usa como **identidad única** para: publicar, comentar, votar, stakear.

### 3.2 SIWE / Firma
- Flujo: usuario firma un mensaje → servidor valida firma y nonce → se emite sesión/token.
- Objetivo: evitar “login con usuario/contraseña” y asegurar propiedad de wallet.

### 3.3 Nonce (anti replay)
- El backend (ej. Cloudflare/Nounce) emite nonces de un solo uso.
- Cada firma consume el nonce.

---

## 4) Capa social: DAO (dao.alemty.eth)

### 4.1 Foro
- Posts, comentarios, likes, shares.
- Topics jerárquicos (Tema → Subtemas).

### 4.2 Backrooms
- Salas privadas/grupos.
- En fase actual: UI lista; backend se integra después.

### 4.3 Eventos (event sourcing)
La capa DAO produce eventos que alimentan métricas del sistema:
- `like_received`
- `comment_received`
- `share_received`
- `report_valid`
- `post_points_awarded`

Estos eventos se consumen por la capa TOKEN (para Dharma/Aura/Karma).

---

## 5) Sistema interno: Dharma / Aura / Karma

> Este apartado describe la **semántica**. La implementación concreta vive en `token.alemty.eth`.

### 5.1 Dharma (XP, no transferible)
- Token interno de XP.
- Sirve para subir de rango.
- No es transferible.

**Reglas base (social):**
- Like recibido: `+1` XP
- Comentario recibido en post propio: `+1` XP
- Puntos recibidos por post: `+1..+10` XP (cap por DID)
- Share recibido de post propio: `+1` XP
- Nuevo rango: `+10` XP

**Boosts por staking/DID (condicionales):**
- Rol NFT: `+100` XP
- veNFT (lock): `+100` XP
- iNFT / agente IA: `+100` XP
- Lands: `+200` XP por land
- Assets: `+50` XP por asset

### 5.2 Aura (utility interna)
- Token de utilidad interna.
- Transferible dentro del ecosistema.
- Usos: donaciones a creadores, acceso premium, posts con costo.
- **No se lista** en exchanges.

**Regla base:** por cada `+1 XP` social, se genera `+1 Aura` social.

**Importante (anti-exploit):** Aura por NFTs se genera por **staking y tiempo bloqueado**, no por “hold libre”.

### 5.3 Karma (antitoken / deuda)
- Karma es deuda de sistema.
- Se genera por reportes válidos y por pérdida de condiciones (ej. des-stake/vender NFTs que aportaban XP).

**Pago de Karma:**
- Karma se paga automáticamente con Dharma futuro.
- Mientras exista Karma pendiente, el usuario conserva el rango alcanzado, pero **no puede progresar** al siguiente.

---

## 6) Token externo: ALEM (gobernanza)

### 6.1 Supply y distribución
- Supply máximo teórico: **1B**.
- Distribución: **Comunidad 50%**, **Reserva 20%**, **Equipo 15%**, **DAO 10%**, **Eventos 5%**.

### 6.2 Emisión
- Sin ICO / sin preventa / sin emisión masiva inicial.
- Emisión gradual, basada en actividad.

---

## 7) Pools internos y separación TOKEN vs DEX

### 7.1 Pool interno Aura ↔ ALEM
- Par interno objetivo: `1 Aura = 1 ALEM`.
- Función: permitir que Aura se convierta a ALEM sin listar Aura.

### 7.2 Separación de responsabilidades
- `token.alemty.eth`: **dashboard / estado / gobernanza** (no swaps).
- `dex.alemty.eth`: **swaps / staking / LP / vote / incentives**.

---

## 8) Staking (tokens + NFTs) y veNFT

### 8.1 Staking tokens (ALEM)
- Lock por tiempo.
- Genera rewards.

### 8.2 Staking NFTs
- iNFT/lands/assets se bloquean en el sistema.
- Mientras están stakeados:
  - habilitan boosts condicionales de Dharma
  - generan Aura por periodos (ej. mensual)

### 8.3 Penalización por salida temprana
- Des-stake o venta → se pierde boost y se genera Karma equivalente (deuda).

---

## 9) Gobernanza (token.alemty.eth + dex.alemty.eth)

### 9.1 Gobernanza social vs económica
- **Social**: reglas comunitarias, moderación, roadmap social (vive en token/dao según fase).
- **Económica**: parámetros del DEX, incentives, bribes (vive en DEX).

### 9.2 Propuestas
- Propuestas versionadas.
- Ciclo: draft → discussion → vote → execute.

---

## 10) IA (ia.alemty.eth) — SOON

- Agentes IA operativos dentro de reglas de gobernanza.
- Uso: moderación asistida, resumen de debates, ejecución automatizada de tareas, consultoría.

---

## 11) AR (ar.alemty.eth) — SOON

- Sede virtual AR.
- Acceso por DID/NFT.
- Visualización de reputación, roles, y economía.

---

## 12) Observabilidad (métricas recomendadas)

- Actividad: posts/día, comentarios/día, likes/día, shares/día.
- Economía interna: Aura emitida/gastada, Aura swap a ALEM.
- Salud: Karma promedio, ratio de reportes válidos.
- DEX: TVL, volumen, fees, rewards emitidos.

---

## 13) Estructura sugerida de repositorio (GitHub)

```
/ (repo)
  /apps
    /web-id           # alemty.eth
    /web-dao          # dao.alemty.eth
    /web-token        # token.alemty.eth
    /web-dex          # dex.alemty.eth
    /web-ia           # ia.alemty.eth
    /web-ar           # ar.alemty.eth
  /packages
    /ui               # componentes compartidos
    /did              # utilidades DID/SIWE
    /tokenomics       # fórmulas y eventos
    /storage          # persistencia (local/DB)
  /docs
    ARCHITECTURE.md   # este documento
    TOKENOMICS.md
    SECURITY.md
    ROADMAP.md
```

---

## 14) Glosario
- **DID**: identidad por wallet.
- **SIWE**: login por firma.
- **Dharma**: XP interno no transferible.
- **Aura**: token de utilidad interna.
- **ALEM**: token de gobernanza.
- **Karma**: deuda que bloquea progreso.
- **veNFT**: NFT/posición bloqueada que representa stake/lock.

---

## 15) Notas de implementación
- El documento describe la arquitectura y responsabilidades. La implementación concreta puede variar.
- Recomendación: mantener **TOKEN** (estado) separado de **DEX** (acciones), por seguridad y claridad.
