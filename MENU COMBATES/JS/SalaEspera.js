import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import {
  getDatabase,
  ref,
  onValue,
  set,
  remove,
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

  if (!idPartida || !nombreJugadorLocal) {
    alert("Información de la partida incompleta.");
    window.location.href = "../MENU PRINCIPAL/MenuJuego-Interfaz.html";
    return;
  }

  cargarDatosPartida();
  escucharEstadoPartida();
  cargarChat();

  document
    .getElementById("btn-cargar-equipo")
    .addEventListener("click", async () => {
      const equipoIDs = JSON.parse(localStorage.getItem("equipo"));
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
  onValue(ref(db, `partidas/${idPartida}/estado`), async (snapshot) => {
    if (snapshot.val() === "en_progreso" && !redirigiendo) {
      redirigiendo = true;
      
      if (!esHostLocal) {
        await mostrarLoading();
      }
      
      window.location.href = `Juego-Combate.html?id=${idPartida}`;
    }
  });
}

// Cargar datos de la partida
function cargarDatosPartida() {
  const partidaRef = ref(db, `partidas/${idPartida}`);

  onValue(partidaRef, (snapshot) => {
    if (!snapshot.exists()) {
      alert("La partida fue eliminada.");
      window.location.href = "../MENU PRINCIPAL/MenuJuego-Interfaz.html";
      return;
    }

    datosPartidaActual = snapshot.val();

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
    await mostrarLoading();
    await set(ref(db, `partidas/${idPartida}/estado`), "en_progreso");
  } catch (error) {
    console.error("Error al iniciar partida:", error);
    alert("Error al iniciar la partida.");
    redirigiendo = false;
  }
}

// FUNCIÓN SALIR DE LA PARTIDA - CORREGIDA
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

    //  Ruta corregida
    window.location.href = "/MENU PRINCIPAL/Menu-Inicio.html";
  } catch (error) {
    console.error("Error al salir:", error);
    alert("Error al salir de la partida.");
  }
}

// Función de chat
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
      feedback.textContent = "";
    }, 2000);
  });
}

window.copiarID = copiarID;