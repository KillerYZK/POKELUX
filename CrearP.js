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
    
    if (!esUnico) {
        throw new Error("No se pudo generar un ID único. Intenta de nuevo.");
    }
    
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
            
            try {
                // Autenticar anónimamente primero
                console.log("Autenticando...");
                const userCredential = await signInAnonymously(auth);
                console.log("Autenticado:", userCredential.user.uid);
                
                console.log("Generando ID de 6 dígitos...");
                const idPartida = await generarIdUnico6Digitos();
                console.log("ID generado:", idPartida);
                
                const partidaRef = ref(db, `partidas/${idPartida}`);
                
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
                            uid: userCredential.user.uid
                        }
                    },
                    chat: {},
                    fechaCreacion: Date.now()
                });
                
                console.log("Partida creada con ID:", idPartida);
                
                localStorage.setItem("pk-nombreJugador", hostName);
                localStorage.setItem("pk-esHost", "true");
                localStorage.setItem("pk-idPartida", idPartida);
                
                window.location.href = `Juego-Lobby.html?id=${idPartida}`;
                
            } catch (error) {
                console.error("Error:", error);
                alert(`Error: ${error.message}\n\nAsegúrate de que las reglas de Firebase permitan escritura.`);
            }
        });
    }
});