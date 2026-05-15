
import { initVelodrome } from "./velodrome.js";
import { initInternalAmm } from "./alem-amm.js";

console.log("[DEX] listo");

/**
 * Compensa la altura real de la topbar (aunque sea position:fixed).
 * Evita que la primera card quede tapada.
 */
function syncTopbarOffset() {
  const tb = document.getElementById("topbar");
  const h = tb ? tb.offsetHeight : 0;
  // default de seguridad si aún no se pinta
  const safe = h > 0 ? h : 72;
  document.documentElement.style.setProperty("--app-topbar-h", `${safe}px`);
}

/**
 * Reintentos cortos (porque mountShell pinta DOM async)
 */
function bootTopbarOffset() {
  syncTopbarOffset();

  // ráfaga de reintentos en los primeros ms
  const delays = [25, 60, 120, 250, 500, 900];
  delays.forEach((ms) => setTimeout(syncTopbarOffset, ms));

  // y un raf loop corto por si el navegador recalcula layout
  let tries = 0;
  const tick = () => {
    syncTopbarOffset();
    tries += 1;
    if (tries < 10) requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
}

window.addEventListener("load", bootTopbarOffset);

window.addEventListener("resize", () => {
  requestAnimationFrame(syncTopbarOffset);
});

// Inicialización por fases:
initInternalAmm();   // Aura/ALEM interno (stub)
initVelodrome();     // Velodrome externo ALEM/ETH (stub)

