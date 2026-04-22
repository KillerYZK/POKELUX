import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import {
  getDatabase,
  ref,
  onValue,
  set,
  remove,
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-database.js";

const firebaseConfig = {
  apiKey: "AIzaSyBq13g3hXl4a3T0VLeHPBnPDZB7BgxW1xY",
  authDomain: "pokelux.firebaseapp.com",
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

// ==================== INICIALIZACIÓN ====================
document.addEventListener("DOMContentLoaded", () => {
  // Obtener ID de la partida de la URL
  const params = new URLSearchParams(window.location.search);
  idPartida = params.get("id");
  nombreJugadorLocal = localStorage.getItem("nombreJugador");
  esHostLocal = localStorage.getItem("esHost") === "true";

  if (!idPartida || !nombreJugadorLocal) {
    alert("Información de la partida incompleta.");
    window.location.href = "../MENU PRINCIPAL/Menu-Inicio.html";
    return;
  }

  // Cargar datos de la partida en tiempo real
  cargarDatosPartida();

  // Configurar botones
  document
    .getElementById("btn-iniciar")
    .addEventListener("click", iniciarPartida);
  document
    .getElementById("btn-salir")
    .addEventListener("click", salirDelaPartida);
  document
    .getElementById("btn-enviar-chat")
    .addEventListener("click", enviarMensaje);

  // Permitir enviar mensaje con Enter
  document.getElementById("chat-input").addEventListener("keypress", (e) => {
    if (e.key === "Enter") {
      enviarMensaje();
    }
  });

  // Mostrar botón iniciar solo si es host
  if (!esHostLocal) {
    document.getElementById("btn-iniciar").style.display = "none";
  }
});

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

// Cargar datos de la partida en tiempo real
function cargarDatosPartida() {
  const partidaRef = ref(db, `partidas/${idPartida}`);

  onValue(partidaRef, (snapshot) => {
    if (!snapshot.exists()) {
      alert("La partida fue eliminada.");
      window.location.href = "MenuJuego-Interfaz.html";
      return;
    }

    datosPartidaActual = snapshot.val();

    // Actualizar información de la partida
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

    // Actualizar jugadores
    actualizarJugadores();

    // Cargar chat
    cargarChat();

    // Verificar si ambos jugadores están listos para habilitar el botón iniciar
    if (esHostLocal) {
      verificarJugadoresListo();
    }
  });
}

// Actualizar la sección de jugadores en la sala de espera
function actualizarJugadores() {
  const jugadores = datosPartidaActual.jugadores;

  let hostData = null;
  let guestData = null;

  for (const [nombre, data] of Object.entries(jugadores)) {
    if (data.esHostLocal) {
      hostData = { nombre, ...data };
    } else {
      guestData = { nombre, ...data };
    }
  }

  /* DATOS HOST */

  if (hostData) {
    document.getElementById("nombre-host").textContent = hostData.nombre;
    const estadoHostSpan = document.getElementById("estado-host");
    estadoHostSpan.className = `sala-jugador-estado ${hostData.listo ? "listo" : "esperando"}`;
    estadoHostSpan.textContent = hostData.listo
      ? "● Listo"
      : "● Preparando equipo";

    const slotsHost = document.querySelectorAll("#equipo-host .sala-slot");
    const equipoHost = hostData.equipo || [];

    for (let i = 0; i < slotsHost.length; i++) {
      const slot = slotsHost[i];
      const pokemon = equipoHost[i];

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

  /* DATOS GUEST */

  if (guestData) {
    document.getElementById("nombre-guest").textContent = guestData.nombre;
    const estadoGuestSpan = document.getElementById("estado-guest");
    estadoGuestSpan.className = `sala-jugador-estado ${guestData.listo ? "listo" : "esperando"}`;
    estadoGuestSpan.textContent = guestData.listo
      ? "● Listo"
      : "● Preparando equipo";

    const slotsGuest = document.querySelectorAll("#equipo-guest .sala-slot");
    const equipoGuest = guestData.equipo || [];

    for (let i = 0; i < slotsGuest.length; i++) {
      const slot = slotsGuest[i];
      const pokemon = equipoGuest[i];

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

// Verificar si ambos jugadores están listos para habilitar el botón iniciar
function verificarJugadoresListo() {
  const jugadores = Object.values(datosPartidaActual.jugadores);
  const todosListos = jugadores.length === 2 && jugadores.every((j) => j.listo);

  const btnIniciar = document.getElementById("btn-iniciar");
  btnIniciar.disabled = !todosListos;
  btnIniciar.textContent = todosListos
    ? "Iniciar Partida"
    : "Esperando a que todos estén listos...";
}

// funcion para iniciar la partida
async function iniciarPartida() {
  try {
    const estadoRef = ref(db, `partidas/${idPartida}/estado`);
    await set(estadoRef, "en_progreso");

    // Redirigir a la pantalla de combate
    window.location.href = `Juego-Combate.html?id=${idPartida}`;
  } catch (error) {
    console.error("Error al iniciar partida:", error);
    alert("Error al iniciar la partida.");
  }
}

//funcion para salir de la partida
async function salirDelaPartida() {
  try {
    const jugadorRef = ref(
      db,
      `partidas/${idPartida}/jugadores/${nombreJugadorLocal}`,
    );
    await remove(jugadorRef);

    // Si es el host, eliminar toda la partida
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

//Funcion de chat
function cargarChat() {
  const chatRef = ref(db, `partidas/${idPartida}/chat`);

  onValue(chatRef, (snapshot) => {
    const chatContainer = document.getElementById("chat-mensajes");
    chatContainer.innerHTML = ""; // Limpiar mensajes anteriores

    if (snapshot.exists()) {
      const mensajes = snapshot.val();
      for (const [key, mensaje] of Object.entries(mensajes)) {
        agregarMensajeAlChat(mensaje.jugador, mensaje.texto);
      }
    }

    // Scroll al último mensaje
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
    const chatRef = ref(db, `partidas/${idPartida}/chat`);
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

// Hacer copiarID disponible globalmente
window.copiarID = copiarID;
