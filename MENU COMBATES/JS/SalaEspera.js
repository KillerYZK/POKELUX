import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import {
  getDatabase,
  ref,
  onValue,
  set,
  remove,
  get,
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-database.js";
import { mostrarLoading, ocultarLoading } from "./LoadingScreen.js";

const firebaseConfig = {
  apiKey: "AIzaSyBq13g3hXl4a3T0VLeHPBnPDZB7BgxW1xY",
  authDomain: "pokelux.firebaseapp.com",
  databaseURL: "https://pokelux-default-rtdb.firebaseio.com",
  projectId: "pokelux",
  storageBucket: "pokelux.firebasestorage.app",
  messagingSenderId: "225576483117",
  appId: "1:225576483117:web:956cb52677c146a852fba4",
};

const app = initializeApp(firebaseConfig);
const db = getDatabase(app);

// ==================== VARIABLES GLOBALES ====================
let idPartida = null;
let nombreJugadorLocal = null;
let esHostLocal = null;
let datosPartidaActual = null;
let chatListenerActivo = false;
let redirigiendo = false;

// ==================== INICIALIZACIÓN ====================
document.addEventListener("DOMContentLoaded", () => {
  const params = new URLSearchParams(window.location.search);
  idPartida = params.get("id");
  nombreJugadorLocal = localStorage.getItem("nombreJugador");
  esHostLocal = localStorage.getItem("esHost") === "true";

  console.log("=== DEBUG SALA ===");
  console.log("idPartida:", idPartida);
  console.log("nombreJugadorLocal:", nombreJugadorLocal);
  console.log("esHostLocal:", esHostLocal);
  console.log("==================");

  if (!idPartida || !nombreJugadorLocal) {
    alert("Información de la partida incompleta.");
    window.location.href = "../../MENU PRINCIPAL/MenuJuego-Interfaz.html";
    return;
  }

  // Mostrar loading en la interfaz mientras se cargan los datos
  const nombreHostEl = document.getElementById("nombre-host");
  if (nombreHostEl) nombreHostEl.textContent = "Cargando...";
  const nombreGuestEl = document.getElementById("nombre-guest");
  if (nombreGuestEl) nombreGuestEl.textContent = "Cargando...";

  cargarDatosPartida();
  escucharEstadoPartida();
  cargarChat();

  document
    .getElementById("btn-cargar-equipo")
    .addEventListener("click", async () => {
      const equipoIDs = JSON.parse(localStorage.getItem("equipo"));
      if (!equipoIDs || equipoIDs.length === 0) {
        alert("No tienes Pokémon en tu equipo. Ve a la sección de equipo primero.");
        return;
      }
      
      const equipoCompleto = [];

      for (const id of equipoIDs) {
        const configuracion =
          JSON.parse(localStorage.getItem(`configuracion-${id}`)) || {};
        equipoCompleto.push({ id, configuracion });
      }

      await set(
        ref(db, `partidas/${idPartida}/jugadores/${nombreJugadorLocal}/equipo`),
        equipoCompleto,
      );

      await set(
        ref(db, `partidas/${idPartida}/jugadores/${nombreJugadorLocal}/listo`),
        true,
      );

      alert("Equipo cargado en la partida.");
    });

  document
    .getElementById("btn-iniciar")
    .addEventListener("click", iniciarPartida);
  document
    .getElementById("btn-salir")
    .addEventListener("click", salirDelaPartida);
  document
    .getElementById("btn-enviar-chat")
    .addEventListener("click", enviarMensaje);

  document.getElementById("chat-input").addEventListener("keypress", (e) => {
    if (e.key === "Enter") {
      enviarMensaje();
    }
  });

  if (!esHostLocal) {
    document.getElementById("btn-iniciar").style.display = "none";
  }
});

// Escuchar estado de la partida
function escucharEstadoPartida() {
  const estadoRef = ref(db, `partidas/${idPartida}/estado`);
  
  onValue(estadoRef, async (snapshot) => {
    const nuevoEstado = snapshot.val();
    console.log("📢 [ESTADO] Cambio detectado:", nuevoEstado);
    
    if (nuevoEstado === "en_progreso" && !redirigiendo) {
      console.log("🚀 [REDIRECCIÓN] Redirigiendo al combate...");
      redirigiendo = true;
      
      if (!esHostLocal) {
        await mostrarLoading();
      }
      
      // Redirigir al combate
      window.location.href = `../HTML/Juego-Combate.html?id=${idPartida}`;
    }
  });
}

// Cargar datos de la partida
function cargarDatosPartida() {
  const partidaRef = ref(db, `partidas/${idPartida}`);

  onValue(partidaRef, (snapshot) => {
    if (!snapshot.exists()) {
      alert("La partida fue eliminada.");
      window.location.href = "../../MENU PRINCIPAL/MenuJuego-Interfaz.html";
      return;
    }

    datosPartidaActual = snapshot.val();
    
    console.log("✅ Datos de partida cargados:", datosPartidaActual);
    
    // Verificar que el jugador existe en la partida
    if (!datosPartidaActual.jugadores || !datosPartidaActual.jugadores[nombreJugadorLocal]) {
      console.error("Jugador no encontrado en la partida");
      console.log("Jugadores disponibles:", Object.keys(datosPartidaActual.jugadores || {}));
      alert("Error: No se encontró tu información en la partida.");
      window.location.href = "../../MENU PRINCIPAL/MenuJuego-Interfaz.html";
      return;
    }

    document.getElementById("partida-nombre").textContent =
      datosPartidaActual.nombre;
    document.getElementById("partida-descripcion").textContent =
      datosPartidaActual.descripcion || "Sin descripción";
    document.getElementById("partida-contrasena").textContent =
      datosPartidaActual.contrasena ? "Sí" : "No";
    document.getElementById("partida-id").textContent = idPartida;
    document.getElementById("partida-estado").textContent =
      datosPartidaActual.estado === "esperando"
        ? "Esperando jugadores..."
        : "En progreso";

    actualizarJugadores();

    if (esHostLocal) {
      verificarJugadoresListo();
    }
  });
}

// Actualizar jugadores
function actualizarJugadores() {
  const jugadores = datosPartidaActual.jugadores;
  if (!jugadores) return;

  for (const [nombre, data] of Object.entries(jugadores)) {
    const lado = data.esHost === true ? "host" : "guest";

    const nomEl = document.getElementById(`nombre-${lado}`);
    if (nomEl) nomEl.textContent = nombre;

    const estadoSpan = document.getElementById(`estado-${lado}`);
    if (estadoSpan) {
      estadoSpan.className = `sala-jugador-estado ${data.listo ? "listo" : "esperando"}`;
      estadoSpan.textContent = data.listo
        ? "● Listo"
        : "● Preparando equipo";
    }

    const slotsLado = document.querySelectorAll(`#equipo-${lado} .sala-slot`);
    const equipoLado = data.equipo || [];

    for (let i = 0; i < slotsLado.length; i++) {
      const slot = slotsLado[i];
      const pokemon = equipoLado[i];

      if (pokemon && pokemon.id) {
        slot.classList.remove("vacio");
        const img = slot.querySelector("img");
        const nombreSpan = slot.querySelector("span");

        let spriteURL = "";
        if (pokemon.configuracion?.shiny) {
          spriteURL = `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/shiny/${pokemon.id}.png`;
        } else {
          spriteURL =
            pokemon.configuracion?.sprite ||
            `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/${pokemon.id}.png`;
        }

        img.src = spriteURL;
        img.alt = pokemon.id;

        nombreSpan.textContent =
          pokemon.configuracion?.apodo ||
          (pokemon.nombre ? pokemon.nombre : `#${pokemon.id}`);
      } else {
        slot.classList.add("vacio");
        slot.querySelector("img").src = "";
        slot.querySelector("span").textContent = "---";
      }
    }
  }
}

// Verificar si ambos jugadores están listos
function verificarJugadoresListo() {
  const jugadores = Object.values(datosPartidaActual.jugadores);
  const todosListos = jugadores.length === 2 && jugadores.every((j) => j.listo);

  const btnIniciar = document.getElementById("btn-iniciar");
  btnIniciar.disabled = !todosListos;
  btnIniciar.textContent = todosListos
    ? "Iniciar Partida"
    : "Esperando a que todos estén listos...";
}

// Iniciar partida
async function iniciarPartida() {
  if (redirigiendo) return;
  redirigiendo = true;
  
  try {
    // 1. Mostrar pantalla de carga
    await mostrarLoading();
    
    // 2. ESPERAR 1.5 SEGUNDOS PARA QUE SE VEA LA ANIMACIÓN
    await new Promise(resolve => setTimeout(resolve, 1500));
    
    // 3. Cambiar estado
    await set(ref(db, `partidas/${idPartida}/estado`), "en_progreso");
    
    // 4. Redirigir
    window.location.href = `../HTML/Juego-Combate.html?id=${idPartida}`;
    
  } catch (error) {
    console.error("Error al iniciar partida:", error);
    redirigiendo = false;
  }
}

// Salir de la partida
async function salirDelaPartida() {
  try {
    const jugadorRef = ref(
      db,
      `partidas/${idPartida}/jugadores/${nombreJugadorLocal}`,
    );
    await remove(jugadorRef);

    if (esHostLocal) {
      const partidaRef = ref(db, `partidas/${idPartida}`);
      await remove(partidaRef);
    }

    window.location.href = "../../MENU PRINCIPAL/Combate.html";
  } catch (error) {
    console.error("Error al salir:", error);
    alert("Error al salir de la partida.");
  }
}

// Chat
function cargarChat() {
  const chatRef = ref(db, `partidas/${idPartida}/chat`);

  onValue(chatRef, (snapshot) => {
    const chatContainer = document.getElementById("chat-mensajes");
    chatContainer.innerHTML = "";

    if (snapshot.exists()) {
      const mensajes = snapshot.val();
      for (const [key, mensaje] of Object.entries(mensajes)) {
        agregarMensajeAlChat(mensaje.jugador, mensaje.texto);
      }
    }

    chatContainer.scrollTop = chatContainer.scrollHeight;
  });
}

function agregarMensajeAlChat(jugador, texto) {
  const chatContainer = document.getElementById("chat-mensajes");
  const mensajeDiv = document.createElement("div");
  mensajeDiv.className = "sala-chat-mensaje";
  mensajeDiv.innerHTML = `<strong>${jugador}:</strong> ${texto}`;
  chatContainer.appendChild(mensajeDiv);
}

async function enviarMensaje() {
  const inputChat = document.getElementById("chat-input");
  const texto = inputChat.value.trim();

  if (!texto) return;

  try {
    const nuevoMensajeRef = ref(db, `partidas/${idPartida}/chat/${Date.now()}`);

    await set(nuevoMensajeRef, {
      jugador: nombreJugadorLocal,
      texto: texto,
      timestamp: Date.now(),
    });

    inputChat.value = "";
  } catch (error) {
    console.error("Error al enviar mensaje:", error);
  }
}

function copiarID() {
  const idPartida = document.getElementById("partida-id").textContent;
  navigator.clipboard.writeText(idPartida).then(() => {
    const feedback = document.getElementById("copiar-feedback");
    feedback.textContent = "¡Copiado!";
    setTimeout(() => {
      feedback.content = "";
    }, 2000);
  });
}

window.copiarID = copiarID;