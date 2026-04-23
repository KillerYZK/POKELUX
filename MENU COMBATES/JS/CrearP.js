import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import { getDatabase, ref, set, get } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-database.js";
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

function generarId6Digitos() {
    return Math.floor(100000 + Math.random() * 900000).toString();
}

async function verificarIdUnico(id) {
    const partidaRef = ref(db, `partidas/${id}`);
    const snapshot = await get(partidaRef);
    return !snapshot.exists();
}

async function generarIdUnico6Digitos() {
    let id;
    let esUnico = false;
    let intentos = 0;
    const maxIntentos = 10;

    while (!esUnico && intentos < maxIntentos) {
        id = generarId6Digitos();
        esUnico = await verificarIdUnico(id);
        intentos++;
    }

    if (!esUnico) throw new Error("No se pudo generar un ID único. Intenta de nuevo.");
    return id;
}

document.addEventListener("DOMContentLoaded", () => {

    const btnCrear = document.getElementById("btn-crear");
    if (btnCrear) {
        btnCrear.addEventListener("click", async () => {
            const nombre = document.getElementById("input-nombre").value.trim();
            const descripcion = document.getElementById("input-descripcion").value.trim();
            const contrasena = document.getElementById("input-contrasena").value.trim();
            const hostName = document.getElementById("input-host").value.trim();

            if (!nombre || !hostName) {
                alert("El nombre de la partida y tu nombre son obligatorios.");
                return;
            }

            // Deshabilitar botón
            btnCrear.disabled = true;
            btnCrear.textContent = "CREANDO...";

            try {
                console.log("Autenticando...");
                const userCredential = await signInAnonymously(auth);
                console.log("Autenticado:", userCredential.user.uid);

                const idPartida = await generarIdUnico6Digitos();
                console.log("ID generado:", idPartida);

                const partidaRef = ref(db, `partidas/${idPartida}`);
                
                // Crear partida con la estructura correcta
                await set(partidaRef, {
                    id: idPartida,
                    nombre: nombre,
                    descripcion: descripcion || "",
                    contrasena: contrasena || null,
                    estado: "esperando",
                    host: hostName,
                    creadorId: userCredential.user.uid,
                    jugadores: {
                        [hostName]: {
                            equipo: [],
                            listo: false,
                            esHost: true,
                            uid: userCredential.user.uid,
                            nombre: hostName
                        }
                    },
                    chat: {},
                    fechaCreacion: Date.now()
                });

                console.log("Partida creada con ID:", idPartida);

                // Esperar a que Firebase termine de guardar
                await new Promise(resolve => setTimeout(resolve, 1500));

                // Verificar que la partida existe
                const verifySnap = await get(partidaRef);
                if (!verifySnap.exists()) {
                    throw new Error("La partida no se guardó correctamente");
                }

                console.log("✅ Partida verificada en Firebase");
                console.log("Datos guardados:", verifySnap.val());

                // Guardar en localStorage
                localStorage.setItem("nombreJugador", hostName);
                localStorage.setItem("esHost", "true");
                localStorage.setItem("idPartida", idPartida);

                // Redirigir a la sala de espera
                window.location.href = "../HTML/Juego-Lobby.html?id=" + idPartida;

            } catch (error) {
                console.error("Error:", error);
                alert(`Error: ${error.message}`);
                btnCrear.disabled = false;
                btnCrear.textContent = "CREAR PARTIDA";
            }
        });
    }

    // Navegación
    const btnEquipo = document.getElementById("Equipo");
    if (btnEquipo) btnEquipo.addEventListener("click", () => {
        window.location.href = "../../MENU PRINCIPAL/Equipo.html";
    });

    const btnInicio = document.getElementById("Inicio");
    if (btnInicio) btnInicio.addEventListener("click", () => {
        window.location.href = "../../MENU PRINCIPAL/Menu-Inicio.html";
    });

    const btnAtras = document.getElementById("atras");
    if (btnAtras) btnAtras.addEventListener("click", () => {
        window.location.href = "../../MENU PRINCIPAL/MenuJuego-Interfaz.html";
    });
});