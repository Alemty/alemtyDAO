
Este repositorio utiliza un workflow de GitHub Actions para desplegar automáticamente el frontend estático en IPFS usando Pinata. El deploy se ejecuta en cada push a la rama `main` (y también puede lanzarse manualmente) y sube **exclusivamente el contenido de la carpeta `public/`**. Ningún archivo fuera de `public/` es incluido en IPFS.

Durante el workflow se valida el contenido y tamaño de `public/`, luego se autentica contra Pinata usando un `PINATA_JWT` configurado como secret del repositorio, y finalmente se suben todos los archivos manteniendo la estructura de carpetas. El resultado del deploy es un **CID de IPFS**, junto con un enlace a un gateway público. Ese CID es el que debe usarse para actualizar el `contenthash` del ENS (por ejemplo `alemty.eth`) y apuntar el frontend a la nueva versión.

El flujo sigue una filosofía IPFS‑first: el frontend público vive en `public/`, cada deploy es inmutable, y ENS se usa como el puntero vivo entre versiones. Cloudflare u otros servicios pueden usarse como preview, pero la fuente de verdad es IPFS.
