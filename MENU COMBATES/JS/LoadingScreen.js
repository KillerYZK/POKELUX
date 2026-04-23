// ============================================
// YA PORFAVOR
// ============================================

const COLS           = 18;
const ROWS           = 11;
const DELAY_ENTRADA  = 100;  // Más lenta
const DELAY_SALIDA   = 100;  // Más lenta

let overlay  = null;
let blocks   = [];
let animacionEnCurso = false;

function crearOverlay() {
  if (overlay) return;

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
      display: none;
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
      box-shadow: 0 0 5px rgba(255, 45, 120, 0.5);
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
      transition: opacity 0.6s ease;
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
      animation: pulse 1.5s infinite;
    }
    #pk-loading-logo span {
      color: #fff;
    }
    #pk-loading-sub {
      font-family: 'Bebas Neue', 'Arial Narrow', sans-serif;
      font-size: 0.85rem;
      letter-spacing: 0.22em;
      color: rgba(255, 255, 255, 0.8);
      margin-top: 6px;
    }
    @keyframes pulse {
      0%, 100% { transform: scale(1); }
      50% { transform: scale(1.05); text-shadow: 3px 3px 0 #ff2d78; }
    }
  `;
  document.head.appendChild(style);

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

  const center = document.createElement("div");
  center.id = "pk-loading-center";
  center.innerHTML = `
    <div id="pk-loading-logo">POKE<span>LUX</span></div>
    <div id="pk-loading-sub">CARGANDO COMBATE...</div>
  `;

  document.body.appendChild(overlay);
  document.body.appendChild(center);
}

function getDiag(r, c) {
  return (COLS - 1 - c) + r;
}

export async function mostrarLoading() {
  crearOverlay();
  animacionEnCurso = true;

  const center = document.getElementById("pk-loading-center");
  const maxDiag = (COLS - 1) + (ROWS - 1);

  blocks.forEach(b => b.el.classList.remove("visible"));
  center.classList.remove("visible");
  overlay.classList.remove("oculto");
  overlay.style.display = "grid";

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

export async function ocultarLoading() {
  if (!overlay) return;
  if (!animacionEnCurso) {
    overlay.classList.add("oculto");
    overlay.style.display = "none";
    return;
  }

  const center = document.getElementById("pk-loading-center");
  const maxDiag = (COLS - 1) + (ROWS - 1);

  return new Promise((resolve) => {
    for (let d = maxDiag; d >= 0; d--) {
      const diagBlocks = blocks.filter(b => getDiag(b.r, b.c) === d);
      const delay = (maxDiag - d) * DELAY_SALIDA;
      setTimeout(() => {
        diagBlocks.forEach(b => b.el.classList.remove("visible"));
        if (d === 0) {
          setTimeout(() => {
            center.classList.remove("visible");
            overlay.classList.add("oculto");
            overlay.style.display = "none";
            animacionEnCurso = false;
            resolve();
          }, 300);
        }
      }, delay);
    }
  });
}