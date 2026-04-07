# alemty.eth — DAO v0.03

**alemty.eth** es una **Organización Autónoma Descentralizada (DAO)** orientada a la **identidad digital**, la **experimentación Web3**, la **economía programable** y la **investigación en IA y sistemas complejos**.

Este repositorio contiene el **frontend público y auditable** de la DAO, diseñado para operar sobre **ENS + IPFS**, con autenticación **Sign‑In With Ethereum (SIWE)** y sin dependencias centralizadas permanentes.

---

## 🌐 Estado del proyecto

- **Versión:** `v0.03`
- **Estado:** Activo / En desarrollo
- **Arquitectura:** Frontend estático + ENS + IPFS + Workers
- **Modelo:** Open‑source, modular y evolutivo

> Esta versión consolida la identidad descentralizada (SIWE), el shell compartido, la navegación modular y el flujo de publicación continua a IPFS (Pinata).

---

## 🧭 Arquitectura general

La DAO está organizada como un **hub único**, servido desde **un solo CID IPFS**, con módulos accesibles por rutas absolutas.

```text
/
├─ index.html        → Identidad (ID)
├─ assets/           → Datos públicos, PDFs, medallas, POAPs
├─ shared/           → Shell, UI y lógica compartida
├─ dao/              → Módulo DAO
├─ dex/              → Módulo DEX
├─ ia/               → Módulo IA
├─ token/            → Tokenomics
└─ settings/         → Configuración visual
```

Todos los módulos comparten:

- topbar
- navbar
- drawer
- tema claro / oscuro
- identidad ENS / DID
- sesión SIWE por origen

---

## 🧩 Módulos

### 🪪 Identidad (ID) — `/`

- Identidad ENS
- Perfil público
- Credenciales (POAPs y acreditaciones)
- Documento base: **La Simulación del Dragón**

### 🏛️ DAO — `/dao/`

- Espacio de coordinación
- Interacciones sociales (likes / puntos locales)
- Base para gobernanza futura

### 🔁 DEX — `/dex/`

- Dashboard
- Swap
- Stake
- Vote
- Bribes

> La lógica on‑chain se integrará progresivamente.

### 🤖 IA — `/ia/`

- Agentes
- Simulaciones
- Automatización
- Investigación aplicada

### 🪙 Token — `/token/`

- Tokenomics
- Emisiones
- Economía interna

---

## 🔐 Identidad y autenticación (SIWE)

El proyecto implementa **Sign‑In With Ethereum (EIP‑4361)**.

### Flujo

1. El usuario firma un mensaje SIWE desde el frontend.
2. Un Worker stateless verifica dominio, chain ID, firma y nonce anti‑replay.
3. El frontend guarda el DID en `localStorage` por origen.

### Notas importantes

- La sesión vive en el navegador.
- No se comparte sesión entre dominios o subdominios.
- El backend no guarda estado ni llaves privadas.

---

## 🔗 ENS, IPFS y dominios

- Un solo CID IPFS
- Rutas absolutas (`/dao`, `/dex`, `/ia`)
- ENS resuelve al CID

---

## 📦 Publicación continua a IPFS (Pinata)

El repositorio incluye un workflow de GitHub Actions que:

- Se ejecuta en cada `git push` a `main`
- Publica el frontend completo en IPFS vía Pinata
- Genera un CID nuevo por build

---

## 📜 Licencia

MIT

---

**alemty.eth**  
Identidad · DAO · Economía · IA · Web3
