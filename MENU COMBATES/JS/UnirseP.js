import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import { getDatabase, ref, set, get, remove, onValue } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-database.js";
import { getAuth, signInAnonymously } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";

const firebaseConfig = {
    apiKey: "AIzaSyBq13g3hXl4a3T0VLeHPBnPDZB7BgxW1xY",
    authDomain: "pokelux.firebaseapp.com",
    projectId: "pokelux",
    storageBucket: "pokelux.firebasestorage.app",
    messagingSenderId: "225576483117",
    appId: "1:225576483117:web:956cb52677c146a852fba4"
};

const app = initializeApp(firebaseConfig);
const db = getDatabase(app);
const auth = getAuth(app);

let partidaSeleccionada = null;

function validarId6Digitos(id) {
    return /^\d{6}$/.test(id);
}

// ============================================
// LIMPIAR PARTIDAS HUÉRFANAS
// ============================================
async function limpiarPartidasHuerfanas() {
    console.log("🧹 Iniciando limpieza de partidas huérfanas...");
    let eliminadas = 0;
    
    try {
        const snapshot = await get(ref(db, "partidas"));
        const partidas = snapshot.val();
        
        if (!partidas) {
            console.log("📭 No hay partidas en la base de datos");
            return 0;
        }
        
        for (const [id, data] of Object.entries(partidas)) {
            let deberiaEliminar = false;
            let razon = "";
            
            // Verificar si la partida tiene jugadores
            const jugadores = data.jugadores || {};
            const numJugadores = Object.keys(jugadores).length;
            
            // Verificar si los jugadores son objetos válidos (no strings)
            let tieneJugadorValido = false;
            let jugadoresInvalidos = 0;
            
            for (const [nombre, jugador] of Object.entries(jugadores)) {
                if (typeof jugador === 'object' && jugador !== null) {
                    tieneJugadorValido = true;
                } else {
                    jugadoresInvalidos++;
                }
            }
            
            // Caso 1: Partida en estado "esperando" sin jugadores válidos
            if (data.estado === "esperando" && !tieneJugadorValido) {
                deberiaEliminar = true;
                razon = "Sin jugadores válidos";
            }
            
            // Caso 2: Partida con jugadores inválidos (strings en lugar de objetos)
            else if (jugadoresInvalidos > 0 && numJugadores === jugadoresInvalidos) {
                deberiaEliminar = true;
                razon = "Jugadores mal formateados (strings)";
            }
            
            // Caso 3: Partida antigua (más de 24 horas) sin actividad
            const fechaCreacion = data.fechaCreacion || 0;
            const horasTranscurridas = (Date.now() - fechaCreacion) / (1000 * 60 * 60);
            if (data.estado === "esperando" && horasTranscurridas > 24 && numJugadores < 2) {
                deberiaEliminar = true;
                razon = `Partida inactiva por ${Math.floor(horasTranscurridas)} horas`;
            }
            
            // Eliminar si cumple alguna condición
            if (deberiaEliminar) {
                console.log(`🗑️ Eliminando partida ${id}: ${razon}`);
                await remove(ref(db, `partidas/${id}`));
                eliminadas++;
            }
        }
        
        console.log(`✅ Limpieza completada. Se eliminaron ${eliminadas} partidas huérfanas.`);
        return eliminadas;
        
    } catch (error) {
        console.error("❌ Error durante la limpieza:", error);
        return 0;
    }
}

// ============================================
// CARGAR PARTIDAS ACTIVAS (con filtro mejorado)
// ============================================
async function cargarPartidasActivas() {
    const listaContainer = document.getElementById("partidas-lista");
    listaContainer.innerHTML = '<div class="loading-partidas"><div class="spinner-small"></div><p>Cargando partidas...</p></div>';
    
    try {
        // Primero limpiar partidas huérfanas
        await limpiarPartidasHuerfanas();
        
        const snapshot = await get(ref(db, "partidas"));
        const partidas = snapshot.val();
        const partidasActivas = [];
        
        if (partidas) {
            for (const [id, data] of Object.entries(partidas)) {
                // Solo mostrar partidas en estado "esperando"
                if (data.estado === "esperando") {
                    const jugadores = data.jugadores || {};
                    const numJugadores = Object.keys(jugadores).length;
                    
                    // Verificar que tenga al menos un jugador válido (objeto)
                    let tieneJugadorValido = false;
                    let hostNombre = data.host || "Anónimo";
                    
                    for (const [nombre, jugador] of Object.entries(jugadores)) {
                        if (typeof jugador === 'object' && jugador !== null) {
                            tieneJugadorValido = true;
                            if (jugador.esHost) {
                                hostNombre = nombre;
                            }
                        }
                    }
                    
                    // Solo mostrar partidas con al menos un jugador válido
                    if (tieneJugadorValido && numJugadores < 2) {
                        partidasActivas.push({
                            id: id,
                            host: hostNombre,
                            jugadores: numJugadores,
                            tieneContrasena: !!data.contrasena,
                            nombre: data.nombre || "Sin nombre"
                        });
                    }
                }
            }
        }
        
        // Ordenar por ID (más recientes primero)
        partidasActivas.sort((a, b) => parseInt(b.id) - parseInt(a.id));
        
        if (partidasActivas.length === 0) {
            listaContainer.innerHTML = `
                <div class="loading-partidas">
                    <p>📭 No hay partidas activas</p>
                    <p style="font-size:0.7rem; margin-top:0.5rem;">Crea una partida para comenzar</p>
                </div>`;
            return;
        }
        
        listaContainer.innerHTML = "";
        partidasActivas.forEach(partida => {
            const item = document.createElement("div");
            item.className = "partida-item";
            item.innerHTML = `
                <div class="partida-info">
                    <span class="partida-id">🎮 ${partida.id}</span>
                    <span class="partida-host">👤 Host: ${partida.host}</span>
                    <span class="partida-jugadores">👥 Jugadores: ${partida.jugadores}/2</span>
                    <span class="partida-nombre">📌 ${partida.nombre}</span>
                </div>
                <div>
                    ${partida.tieneContrasena ? '<span class="partida-contrasena">🔒 CONTRASEÑA</span>' : '<span class="partida-sin-contrasena">🔓 SIN CONTRASEÑA</span>'}
                </div>
            `;
            item.onclick = () => seleccionarPartida(partida);
            listaContainer.appendChild(item);
        });
        
    } catch (error) {
        console.error("Error cargando partidas:", error);
        listaContainer.innerHTML = '<div class="loading-partidas"><p>❌ Error al cargar partidas</p></div>';
    }
}

// Seleccionar partida de la lista
function seleccionarPartida(partida) {
    partidaSeleccionada = partida;
    
    const inputId = document.getElementById("input-id-partida");
    if (inputId) inputId.value = partida.id;
    
    const contrasenaContainer = document.getElementById("contrasena-container");
    if (partida.tieneContrasena) {
        contrasenaContainer.classList.remove("oculto");
    } else {
        contrasenaContainer.classList.add("oculto");
        document.getElementById("input-contrasena-partida").value = "";
    }
    
    // Resaltar visualmente la partida seleccionada
    document.querySelectorAll(".partida-item").forEach(item => {
        item.style.borderColor = "rgba(79, 195, 247, 0.1)";
    });
    if (event && event.target) {
        const clickedItem = event.target.closest?.(".partida-item");
        if (clickedItem) {
            clickedItem.style.borderColor = "#ff2d78";
        }
    }
}

// Unirse a partida
async function unirsePartida(idPartida, nombreJugador, contrasena) {
    if (!idPartida || !nombreJugador) {
        alert("El ID de la partida y tu nombre son obligatorios.");
        return false;
    }
    
    if (!validarId6Digitos(idPartida)) {
        alert("El ID debe ser un número de 6 dígitos (Ej: 123456)");
        return false;
    }
    
    try {
        console.log("Autenticando...");
        const userCredential = await signInAnonymously(auth);
        
        const partidaRef = ref(db, `partidas/${idPartida}`);
        const snapshot = await get(partidaRef);
        
        if (!snapshot.exists()) {
            alert("No existe ninguna partida con ese ID.");
            return false;
        }
        
        const datosPartida = snapshot.val();
        
        if (datosPartida.estado !== "esperando") {
            alert("Esta partida ya está en progreso o ha finalizado.");
            return false;
        }
        
        const numJugadores = Object.keys(datosPartida.jugadores || {}).length;
        if (numJugadores >= 2) {
            alert("La partida ya está llena (máximo 2 jugadores).");
            return false;
        }
        
        if (datosPartida.contrasena && datosPartida.contrasena !== contrasena) {
            alert("Contraseña incorrecta.");
            return false;
        }
        
        if (datosPartida.jugadores && datosPartida.jugadores[nombreJugador]) {
            alert("Ya eres miembro de esta partida.");
            return false;
        }
        
        const nombresExistentes = Object.keys(datosPartida.jugadores || {});
        if (nombresExistentes.includes(nombreJugador)) {
            alert("Ese nombre de jugador ya está en uso. Elige otro nombre.");
            return false;
        }
        
        const nuevoJugadorRef = ref(db, `partidas/${idPartida}/jugadores/${nombreJugador}`);
        await set(nuevoJugadorRef, {
            equipo: [],
            listo: false,
            esHost: false,
            uid: userCredential.user.uid,
            nombre: nombreJugador
        });
        
        localStorage.setItem("nombreJugador", nombreJugador);
        localStorage.setItem("esHost", "false");
        localStorage.setItem("idPartida", idPartida);
        
        return true;
        
    } catch (error) {
        console.error("Error:", error);
        alert(`Error al unirse: ${error.message}`);
        return false;
    }
}

// Eventos
document.addEventListener("DOMContentLoaded", () => {
    const btnUnirse = document.getElementById("btn-unirse");
    const btnRefrescar = document.getElementById("btn-refrescar");
    const inputId = document.getElementById("input-id-partida");
    
    // Cargar partidas activas
    cargarPartidasActivas();
    
    // Refrescar lista
    if (btnRefrescar) {
        btnRefrescar.addEventListener("click", () => {
            cargarPartidasActivas();
        });
    }
    
    // Unirse manualmente
    if (btnUnirse) {
        btnUnirse.addEventListener("click", async () => {
            const idPartida = document.getElementById("input-id-partida").value.trim();
            const nombreJugador = document.getElementById("input-nombre-jugador").value.trim();
            const contrasena = document.getElementById("input-contrasena-partida").value.trim();
            
            const exito = await unirsePartida(idPartida, nombreJugador, contrasena);
            if (exito) {
                window.location.href = "../../MENU COMBATES/HTML/Juego-Lobby.html?id=" + idPartida;
            }
        });
    }
    
    // Si se escribe manualmente, resetear selección
    if (inputId) {
        inputId.addEventListener("input", () => {
            partidaSeleccionada = null;
            const contrasenaContainer = document.getElementById("contrasena-container");
            contrasenaContainer.classList.add("oculto");
            document.querySelectorAll(".partida-item").forEach(item => {
                item.style.borderColor = "rgba(79, 195, 247, 0.1)";
            });
        });
    }
});