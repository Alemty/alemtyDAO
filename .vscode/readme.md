
Esta configuración define el entorno de desarrollo local usando **Live Server** en VS Code. El frontend se sirve en el puerto `5500`, con **auto‑save habilitado** para acelerar iteraciones durante el desarrollo.

Se configura además un **proxy HTTP local** que intercepta todas las solicitudes realizadas a `/api` desde el navegador y las redirige automáticamente a `http://localhost:3000/api`. Esto permite que el frontend estático consuma un backend local como si estuviera en producción, evitando problemas de CORS y manteniendo desacopladas las capas de frontend y backend durante el desarrollo.
