import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import { getDatabase, ref, get, set, remove } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-database.js";

const firebaseConfig = {
  apiKey: "AIzaSyBq13g3hXl4a3T0VLeHPBnPDZB7BgxW1xY",
  authDomain: "pokelux.firebaseapp.com",
  databaseURL: "https://pokelux-default-rtdb.firebaseio.com",
  projectId: "pokelux",
  storageBucket: "pokelux.firebasestorage.app",
  messagingSenderId: "225576483117",
  appId: "1:225576483117:web:956cb52677c146a852fba4"
};

const app = initializeApp(firebaseConfig);
const db = getDatabase(app);

const nombreJugador = localStorage.getItem("nombreJugador");

// Elementos del DOM
const batallasTotalesEl = document.getElementById("batallas-totales");
const victoriasEl = document.getElementById("victorias");
const derrotasEl = document.getElementById("derrotas");
const porcentajeEl = document.getElementById("porcentaje");
const victoriasPorcentajeEl = document.getElementById("victorias-porcentaje");
const derrotasPorcentajeEl = document.getElementById("derrotas-porcentaje");
const victoriasBarEl = document.getElementById("victorias-bar");
const derrotasBarEl = document.getElementById("derrotas-bar");
const historialListaEl = document.getElementById("historial-lista");

// Cargar estadísticas
async function cargarEstadisticas() {
  if (!nombreJugador) {
    mostrarSinUsuario();
    return;
  }

  try {
    const statsRef = ref(db, `estadisticas/${nombreJugador}`);
    const snapshot = await get(statsRef);
    const stats = snapshot.val();

    if (stats) {
      const batallas = stats.batallas || 0;
      const victorias = stats.victorias || 0;
      const derrotas = stats.derrotas || 0;
      const porcentaje = batallas > 0 ? Math.round((victorias / batallas) * 100) : 0;

      batallasTotalesEl.textContent = batallas;
      victoriasEl.textContent = victorias;
      derrotasEl.textContent = derrotas;
      porcentajeEl.textContent = `${porcentaje}%`;

      // Barras de progreso
      const victoriasPorc = batallas > 0 ? (victorias / batallas) * 100 : 0;
      const derrotasPorc = batallas > 0 ? (derrotas / batallas) * 100 : 0;

      victoriasPorcentajeEl.textContent = `${Math.round(victoriasPorc)}%`;
      derrotasPorcentajeEl.textContent = `${Math.round(derrotasPorc)}%`;
      victoriasBarEl.style.width = `${victoriasPorc}%`;
      derrotasBarEl.style.width = `${derrotasPorc}%`;
    } else {
      resetearEstadisticas();
    }

    // Cargar historial
    await cargarHistorial();

  } catch (error) {
    console.error("Error cargando estadísticas:", error);
    mostrarError();
  }
}

// Cargar historial de batallas
async function cargarHistorial() {
  if (!nombreJugador) return;

  try {
    const historialRef = ref(db, `historial/${nombreJugador}`);
    const snapshot = await get(historialRef);
    const historial = snapshot.val();

    if (historial) {
      const batallasArray = Object.entries(historial)
        .map(([id, data]) => ({
          id,
          ...data
        }))
        .sort((a, b) => b.fecha - a.fecha)
        .slice(0, 20);

      if (batallasArray.length === 0) {
        mostrarHistorialVacio();
        return;
      }

      historialListaEl.innerHTML = "";
      batallasArray.forEach(batalla => {
        const item = document.createElement("div");
        item.className = "historial-item";
        const fecha = new Date(batalla.fecha).toLocaleDateString();
        const esVictoria = batalla.resultado === "victoria";
        
        item.innerHTML = `
          <div>
            <div class="historial-resultado ${esVictoria ? 'victoria' : 'derrota'}">
              ${esVictoria ? '🏆 VICTORIA' : '💔 DERROTA'}
            </div>
            <div class="historial-rival">vs ${batalla.rival || 'Desconocido'}</div>
          </div>
          <div class="historial-fecha">${fecha}</div>
        `;
        historialListaEl.appendChild(item);
      });
    } else {
      mostrarHistorialVacio();
    }
  } catch (error) {
    console.error("Error cargando historial:", error);
    mostrarHistorialVacio();
  }
}

// Mostrar mensaje de historial vacío
function mostrarHistorialVacio() {
  historialListaEl.innerHTML = `
    <div class="historial-vacio">
      <p>📭 No hay batallas registradas</p>
      <p>Participa en combates para ver tu historial</p>
    </div>
  `;
}

// Mostrar sin usuario
function mostrarSinUsuario() {
  document.querySelector(".stats-grid-principal").innerHTML = `
    <div class="stat-box" style="grid-column: span 4;">
      <div class="stat-icon">⚠️</div>
      <div class="stat-value">Sin datos</div>
      <div class="stat-label">Inicia sesión para ver tus estadísticas</div>
    </div>
  `;
  mostrarHistorialVacio();
}

// Resetear estadísticas a cero
function resetearEstadisticas() {
  batallasTotalesEl.textContent = "0";
  victoriasEl.textContent = "0";
  derrotasEl.textContent = "0";
  porcentajeEl.textContent = "0%";
  victoriasPorcentajeEl.textContent = "0%";
  derrotasPorcentajeEl.textContent = "0%";
  victoriasBarEl.style.width = "0%";
  derrotasBarEl.style.width = "0%";
}

// Mostrar error
function mostrarError() {
  batallasTotalesEl.textContent = "Error";
  victoriasEl.textContent = "-";
  derrotasEl.textContent = "-";
  porcentajeEl.textContent = "-";
}

// Limpiar historial
async function limpiarHistorial() {
  if (!nombreJugador) return;
  
  const confirmar = confirm("¿Estás seguro de que quieres limpiar todo tu historial de batallas?");
  if (!confirmar) return;

  try {
    const historialRef = ref(db, `historial/${nombreJugador}`);
    await remove(historialRef);
    alert("✅ Historial limpiado correctamente");
    await cargarHistorial();
  } catch (error) {
    console.error("Error limpiando historial:", error);
    alert("❌ Error al limpiar el historial");
  }
}

// Refrescar estadísticas
async function refrescarEstadisticas() {
  const btn = document.getElementById("btn-refrescar");
  const textoOriginal = btn.textContent;
  btn.textContent = "⟳ ACTUALIZANDO...";
  btn.disabled = true;
  
  await cargarEstadisticas();
  
  btn.textContent = textoOriginal;
  btn.disabled = false;
  alert("✅ Estadísticas actualizadas");
}

// Eventos
document.getElementById("btn-refrescar")?.addEventListener("click", refrescarEstadisticas);
document.getElementById("btn-limpiar")?.addEventListener("click", limpiarHistorial);

// Inicializar
cargarEstadisticas(); 