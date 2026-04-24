// ============================================
// LOADING SCREEN 
// ============================================

const COLS           = 18;
const ROWS           = 11;
const DELAY_ENTRADA  = 55;
const DELAY_SALIDA   = 55;

let overlay  = null;
let blocks   = [];
let animacionCompleta = false;
let bloquesVisibles = false;
let promesaMostrar = null;  // ← aquí, línea ~14

function crearOverlay() {
  console.log("🔧 [LOADING] crearOverlay() - Iniciando");
  if (overlay) {
    console.log("🔧 [LOADING] overlay ya existe, omitiendo creación");
    return;
  }

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
      font-family: 'Bebas Neue', sans-serif;
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
      font-family: 'Bebas Neue', sans-serif;
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
  console.log("🔧 [LOADING] Estilos agregados");

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
  console.log(`🔧 [LOADING] ${blocks.length} bloques creados`);

  const center = document.createElement("div");
  center.id = "pk-loading-center";
  center.innerHTML = `
    <div id="pk-loading-logo">POKE<span>LUX</span></div>
    <div id="pk-loading-sub">CARGANDO COMBATE...</div>
  `;

  document.body.appendChild(overlay);
  document.body.appendChild(center);
  console.log("🔧 [LOADING] Overlay y centro agregados al DOM");
}

function getDiag(r, c) {
  return (COLS - 1 - c) + r;
}

// Crear overlay y poner todos los bloques VISIBLES (para salida inmediata)
export async function asegurarOverlay() {
  console.log("🟡 [LOADING] asegurarOverlay() - Creando overlay con bloques visibles");
  crearOverlay();
  
  if (overlay) {
    overlay.classList.remove("oculto");
    overlay.style.display = "grid";
    
    // Poner todos los bloques visibles inmediatamente
    blocks.forEach(b => b.el.classList.add("visible"));
    bloquesVisibles = true;
    animacionCompleta = true;
    
    const center = document.getElementById("pk-loading-center");
    if (center) center.classList.add("visible");
    
    console.log("🟡 [LOADING] Todos los bloques visibles, listo para animación de salida");
  }
  return Promise.resolve();
}

export async function mostrarLoading() {
  console.log("🔴🔴🔴 [LOADING] mostrarLoading() LLAMADA 🔴🔴🔴");
  crearOverlay();

  const center = document.getElementById("pk-loading-center");
  const maxDiag = (COLS - 1) + (ROWS - 1);

  if (animacionCompleta) return;

  bloquesVisibles = false;
  blocks.forEach(b => b.el.classList.remove("visible"));
  center.classList.remove("visible");
  overlay.classList.remove("oculto");

  // ✅ Guardar la promise para que ocultarLoading pueda esperarla
  promesaMostrar = new Promise((resolve) => {
    console.log("🔴 [LOADING] Iniciando animación de entrada...");
    for (let d = 0; d <= maxDiag; d++) {
      const diagBlocks = blocks.filter(b => getDiag(b.r, b.c) === d);
      setTimeout(() => {
        diagBlocks.forEach(b => b.el.classList.add("visible"));
        if (d === maxDiag) {
          setTimeout(() => {
            center.classList.add("visible");
            animacionCompleta = true;
            bloquesVisibles = true;
            console.log("✅ [LOADING] Animación de entrada COMPLETADA");
            resolve();
          }, 300);
        }
      }, d * DELAY_ENTRADA);
    }
  });

  return promesaMostrar;
}

export async function ocultarLoading() {
  console.log("🔵🔵🔵 [LOADING] ocultarLoading() LLAMADA 🔵🔵🔵");

  // ✅ Esperar a que la animación de entrada termine primero
  if (promesaMostrar) await promesaMostrar;

  const center = document.getElementById("pk-loading-center");

  if (!animacionCompleta) {
    if (overlay) overlay.classList.add("oculto");
    return Promise.resolve();
  }

  const maxDiag = (COLS - 1) + (ROWS - 1);

  return new Promise((resolve) => {
    for (let d = maxDiag; d >= 0; d--) {
      const diagBlocks = blocks.filter(b => getDiag(b.r, b.c) === d);
      const delay = (maxDiag - d) * DELAY_SALIDA;
      setTimeout(() => {
        diagBlocks.forEach(b => b.el.classList.remove("visible"));
        if (d === 0) {
          setTimeout(() => {
            if (center) center.classList.remove("visible");
            if (overlay) overlay.classList.add("oculto");
            animacionCompleta = false;
            promesaMostrar = null;
            console.log("✅ [LOADING] Animación de salida COMPLETADA");
            resolve();
          }, 300);
        }
      }, delay);
    }
  });
}
