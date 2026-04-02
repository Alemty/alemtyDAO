
# alemty.eth — DAO v0.02

**alemty.eth** es una **Organización Autónoma Descentralizada (DAO)** orientada a la **identidad digital**, la **experimentación Web3**, la **economía programable** y la **investigación en IA y sistemas complejos**.

Este repositorio contiene el **frontend público y auditable** de la DAO, diseñado para funcionar sobre **ENS + IPFS**, sin dependencias centralizadas.

---

## 🌐 Estado del proyecto

- **Versión:** `v0.02`
- **Estado:** Activo / En desarrollo
- **Arquitectura:** Frontend estático + ENS + IPFS
- **Modelo:** Open‑source, modular y evolutivo

> Esta versión consolida la arquitectura base: identidad, shell compartido, navegación, credenciales y módulos independientes (DAO, DEX, IA).

---

## 🧭 Estructura general

La DAO está organizada como un **hub único**, servido desde un solo CID IPFS, con módulos accesibles por rutas.

``
/
├─ index.html        → Identidad (ID)
├─ assets/           → Datos públicos, PDFs, medallas, POAPs
├─ shared/           → Shell, UI y lógica compartida
├─ dao/              → Módulo DAO
├─ dex/              → Módulo DEX
├─ ia/               → Módulo IA
├─ token/            → Tokenomics
└─ settings/         → Configuración visual

Todos los módulos comparten:
- `topbar`
- `navbar`
- `drawer`
- tema claro/oscuro
- identidad ENS/DID

---

## 🧩 Módulos

### 🪪 Identidad (ID)
- Página principal (`/`)
- Identidad ENS
- Perfil público
- Credenciales (POAPs y Acreditaciones)
- Documento base: **La Simulación del Dragón**

### 🏛️ DAO (`/dao/`)
- Gobernanza (en progreso)
- Espacio de coordinación
- Decisiones y propuestas (futuro)

### 🔁 DEX (`/dex/`)
- Dashboard
- Swap
- Stake
- Vote (pools y emisiones)
- Bribes  
> *La lógica on‑chain se integrará progresivamente.*

### 🤖 IA (`/ia/`)
- Agentes
- Simulaciones
- Automatización
- Investigación aplicada

### 🪙 Token (`/token/`)
- Tokenomics
- Emisiones
- Economía interna

---

## 🔗 ENS, IPFS y subdominios

Actualmente el proyecto funciona con:
- **Un solo CID IPFS**
- **Rutas absolutas** (`/dao/`, `/dex/`, etc.)

Los subdominios ENS (`dao.alemty.eth`, `dex.alemty.eth`, etc.) **aún no están minteados**, pero la arquitectura ya está preparada para que, cuando existan, entren directamente a su módulo correspondiente **sin rehacer el frontend**.

---

## 📁 Assets y datos

Todo el contenido público vive en:

/assets/
├─ data/
│  ├─ certifications.json
│  └─ documentos (PDF)
├─ poap/
└─ img/


Ejemplo:
- Libro / manifiesto
- Medallas de acreditación
- Datos declarativos

---

## 🔓 Open‑source y gobernanza

Este repositorio es **open‑source por diseño**.

### ✅ Qué es público
- Frontend
- UI
- Lógica de navegación
- Datos declarativos

### ❌ Qué NO vive aquí
- Llaves privadas
- Seeds
- Credenciales sensibles
- Lógica on‑chain crítica

> Todo lo que define reglas visibles debe ser auditable.  
> Todo lo que da poder real vive fuera del repo.

---

## 🛠️ Desarrollo local

Este proyecto es **100% frontend estático**.

Puedes servirlo con cualquier servidor local:

```bash
npx serve .
# o
python -m http.server

No requiere build, node_modules ni backend.

📜 Licencia
Este proyecto se publica bajo licencia MIT
(sujeta a cambios si la DAO lo decide en gobernanza futura).

📚 Filosofía

ENS define identidad.
IPFS define disponibilidad.
El frontend define la experiencia.

alemty.eth no es un producto cerrado,
es un sistema vivo.

🚧 Roadmap (alto nivel)

v0.02 — Arquitectura base ✅
v0.03 — Integración on‑chain inicial
v0.04 — Gobernanza activa
v0.05 — Agentes IA operativos


🤝 Contribuir
Las contribuciones son bienvenidas:

UI / UX
Documentación
Modularización
Investigación

Antes de proponer cambios estructurales, revisa el README y la filosofía del proyecto.

alemty.eth
Identidad · DAO · Economía · IA · Web3
