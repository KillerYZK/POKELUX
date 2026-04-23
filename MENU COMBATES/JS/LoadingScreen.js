// ============================================
// LoadingScreen.js
// Uso:
//   import { mostrarLoading, ocultarLoading } from "./LoadingScreen.js";
//   mostrarLoading();
//   await hacerAlgo();
//   ocultarLoading();
// ============================================

const COLS           = 18;
const ROWS           = 11;
const DELAY_ENTRADA  = 55;  // ms por diagonal — entrada
const DELAY_SALIDA   = 30;  // ms por diagonal — salida (más rápida)

let overlay  = null;
let blocks   = [];

// ── Crear el overlay la primera vez ─────────────────────────
function crearOverlay() {
  if (overlay) return;

  // Estilos globales del overlay
  const style = document.createElement("style");
  style.textContent = `
    #pk-loading-overlay {
      position: fixed;
      inset: 0;
      z-index: 9999;
      display: grid;
      gap: 2px;
      padding: 2px;
      background: #0d1b4b;
      grid-template-columns: repeat(${COLS}, 1fr);
      grid-template-rows: repeat(${ROWS}, 1fr);
      pointer-events: all;
    }
    #pk-loading-overlay.oculto {
      pointer-events: none;
    }
    .pk-ls-block {
      background: rgba(255, 255, 255, 0.06);
      border: 1px solid rgba(255, 255, 255, 0.04);
      border-radius: 2px;
      transition: background 0.18s ease, border-color 0.18s ease;
    }
    .pk-ls-block.visible {
      background: #ff2d78;
      border-color: #c4005a;
    }
    #pk-loading-center {
      position: fixed;
      inset: 0;
      z-index: 10000;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      pointer-events: none;
      opacity: 0;
      transition: opacity 0.4s ease;
    }
    #pk-loading-center.visible {
      opacity: 1;
    }
    #pk-loading-logo {
      font-family: 'Bebas Neue', 'Arial Narrow', sans-serif;
      font-size: clamp(3rem, 8vw, 5rem);
      letter-spacing: 0.08em;
      color: #0d1b4b;
      text-shadow: 3px 3px 0 #c4005a;
      line-height: 1;
    }
    #pk-loading-logo span {
      color: #fff;
    }
    #pk-loading-sub {
      font-family: 'Bebas Neue', 'Arial Narrow', sans-serif;
      font-size: 0.85rem;
      letter-spacing: 0.22em;
      color: rgba(13, 27, 75, 0.65);
      margin-top: 6px;
    }
  `;
  document.head.appendChild(style);

  // Overlay de bloques
  overlay = document.createElement("div");
  overlay.id = "pk-loading-overlay";

  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      const b = document.createElement("div");
      b.className = "pk-ls-block";
      overlay.appendChild(b);
      blocks.push({ el: b, r, c });
    }
  }

  // Centro con logo
  const center = document.createElement("div");
  center.id = "pk-loading-center";
  center.innerHTML = `
    <div id="pk-loading-logo">POKE<span>LUX</span></div>
    <div id="pk-loading-sub">CARGANDO...</div>
  `;

  document.body.appendChild(overlay);
  document.body.appendChild(center);
}

// ── Diagonal desde esquina superior derecha ──────────────────
function getDiag(r, c) {
  return (COLS - 1 - c) + r;
}

// ── Mostrar loading (animación de entrada) ───────────────────
export function mostrarLoading() {
  crearOverlay();

  const center  = document.getElementById("pk-loading-center");
  const maxDiag = (COLS - 1) + (ROWS - 1);

  // Reset
  blocks.forEach(b => b.el.classList.remove("visible"));
  center.classList.remove("visible");
  overlay.classList.remove("oculto");

  return new Promise((resolve) => {
    for (let d = 0; d <= maxDiag; d++) {
      const diagBlocks = blocks.filter(b => getDiag(b.r, b.c) === d);
      setTimeout(() => {
        diagBlocks.forEach(b => b.el.classList.add("visible"));
        if (d === maxDiag) {
          setTimeout(() => {
            center.classList.add("visible");
            resolve();
          }, 300);
        }
      }, d * DELAY_ENTRADA);
    }
  });
}

// ── Ocultar loading (animación de salida inversa) ────────────
export function ocultarLoading() {
  const center  = document.getElementById("pk-loading-center");
  const maxDiag = (COLS - 1) + (ROWS - 1);

  if (!overlay) return Promise.resolve();

  center.classList.remove("visible");

  return new Promise((resolve) => {
    // Salida: bloques desaparecen desde esquina inferior izquierda → superior derecha
    for (let d = maxDiag; d >= 0; d--) {
      const diagBlocks = blocks.filter(b => getDiag(b.r, b.c) === d);
      const delay = (maxDiag - d) * DELAY_SALIDA;
      setTimeout(() => {
        diagBlocks.forEach(b => b.el.classList.remove("visible"));
        if (d === 0) {
          setTimeout(() => {
            overlay.classList.add("oculto");
            resolve();
          }, 200);
        }
      }, delay);
    }
  });
}
