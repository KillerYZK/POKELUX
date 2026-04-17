import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import { getDatabase, ref, set, get } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-database.js";

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

// Función para validar ID de 6 dígitos
function validarId6Digitos(id) {
    return /^\d{6}$/.test(id);
}

// Esperar a que el DOM esté listo
document.addEventListener("DOMContentLoaded", () => {
    console.log("DOM cargado, buscando botón...");
    const btnUnirse = document.getElementById("btn-unirse");
    console.log("Botón encontrado:", btnUnirse);
    
    if (btnUnirse) {
        btnUnirse.addEventListener("click", async () => {
            console.log("Click en unirse a partida");
            
            const idPartida = document.getElementById("input-id-partida").value.trim();
            const nombreJugador = document.getElementById("input-nombre-jugador").value.trim();
            const contrasena = document.getElementById("input-contrasena-partida").value.trim();
            
            // Validación básica
            if (!idPartida || !nombreJugador) {
                alert("El ID de la partida y tu nombre son obligatorios.");
                return;
            }
            
            // Validar formato de ID (6 dígitos)
            if (!validarId6Digitos(idPartida)) {
                alert("El ID debe ser un número de 6 dígitos (Ej: 123456)");
                return;
            }
            
            try {
                console.log("Buscando partida con ID:", idPartida);
                
                // Obtener referencia a la partida
                const partidaRef = ref(db, `partidas/${idPartida}`);
                const snapshot = await get(partidaRef);
                
                // Verificar si la partida existe
                if (!snapshot.exists()) {
                    alert("No existe ninguna partida con ese ID. Verifica el ID e intenta de nuevo.");
                    return;
                }
                
                const datosPartida = snapshot.val();
                console.log("Partida encontrada:", datosPartida);
                
                // Verificar estado de la partida
                if (datosPartida.estado !== "esperando") {
                    alert("Esta partida ya está en progreso o ha finalizado. No puedes unirte.");
                    return;
                }
                
                // Verificar si la partida ya está llena (máximo 2 jugadores)
                const numJugadores = Object.keys(datosPartida.jugadores || {}).length;
                if (numJugadores >= 2) {
                    alert("La partida ya está llena (máximo 2 jugadores).");
                    return;
                }
                
                // Verificar contraseña si la partida la tiene
                if (datosPartida.contrasena && datosPartida.contrasena !== contrasena) {
                    alert("Contraseña incorrecta.");
                    return;
                }
                
                // Verificar si el jugador ya está en la partida
                if (datosPartida.jugadores && datosPartida.jugadores[nombreJugador]) {
                    alert("Ya eres miembro de esta partida.");
                    return;
                }
                
                // Verificar si el nombre ya está en uso
                const nombresExistentes = Object.keys(datosPartida.jugadores || {});
                if (nombresExistentes.includes(nombreJugador)) {
                    alert("Ese nombre de jugador ya está en uso en esta partida. Elige otro nombre.");
                    return;
                }
                
                console.log("Agregando jugador a la partida...");
                
                // Agregar jugador a la partida
                const nuevoJugadorRef = ref(db, `partidas/${idPartida}/jugadores/${nombreJugador}`);
                await set(nuevoJugadorRef, {
                    equipo: [],
                    listo: false,
                    esHost: false
                });
                
                console.log("✅ Jugador agregado exitosamente");
                
                // Guardar información local
                localStorage.setItem("pk-nombreJugador", nombreJugador);
                localStorage.setItem("pk-esHost", "false");
                localStorage.setItem("pk-idPartida", idPartida);
                
                // Redirigir a la sala de espera
                console.log("Redirigiendo a:", `Juego-Lobby.html?id=${idPartida}`);
                window.location.href = `Juego-Lobby.html?id=${idPartida}`;
                
            } catch (error) {
                console.error("ERROR DETALLADO:", error);
                console.error("Mensaje:", error.message);
                console.error("Stack:", error.stack);
                alert(`Error al unirse a la partida: ${error.message}\n\nRevisa la consola (F12) para más detalles.`);
            }
        });
    } else {
        console.error("No se encontró el botón btn-unirse");
    }
});