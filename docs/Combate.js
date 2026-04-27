import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import { mostrarLoading, ocultarLoading } from "./LoadingScreen.js";
import {
  getDatabase, ref, set, get, update, runTransaction, onValue, off
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-database.js";

// ---------- CONFIGURACIÓN FIREBASE ----------
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

const params = new URLSearchParams(window.location.search);
const partidaId = params.get("id");
const miNombre = localStorage.getItem("nombreJugador");
const esHost = localStorage.getItem("esHost") === "true";

// ---------- TABLA DE EFECTIVIDAD (Gen 6+) ----------
const TIPO_CHART = {
  normal:   { rock: 0.5, steel: 0.5, ghost: 0 },
  fire:     { fire: 0.5, water: 0.5, rock: 0.5, dragon: 0.5, grass: 2, ice: 2, bug: 2, steel: 2 },
  water:    { water: 0.5, grass: 0.5, dragon: 0.5, fire: 2, ground: 2, rock: 2 },
  electric: { electric: 0.5, grass: 0.5, dragon: 0.5, ground: 0, water: 2, flying: 2 },
  grass:    { fire: 0.5, grass: 0.5, poison: 0.5, flying: 0.5, bug: 0.5, dragon: 0.5, steel: 0.5, water: 2, ground: 2, rock: 2 },
  ice:      { fire: 0.5, water: 0.5, ice: 0.5, steel: 0.5, grass: 2, ground: 2, flying: 2, dragon: 2 },
  fighting: { poison: 0.5, flying: 0.5, psychic: 0.5, bug: 0.5, fairy: 0.5, normal: 2, ice: 2, rock: 2, dark: 2, steel: 2 },
  poison:   { poison: 0.5, ground: 0.5, rock: 0.5, ghost: 0.5, steel: 0, grass: 2, fairy: 2 },
  ground:   { grass: 0.5, bug: 0.5, electric: 0, fire: 2, poison: 2, rock: 2, steel: 2 },
  flying:   { electric: 0.5, rock: 0.5, steel: 0.5, grass: 2, fighting: 2, bug: 2 },
  psychic:  { psychic: 0.5, steel: 0.5, dark: 0, fighting: 2, poison: 2 },
  bug:      { fire: 0.5, fighting: 0.5, poison: 0.5, flying: 0.5, ghost: 0.5, steel: 0.5, fairy: 0.5, grass: 2, psychic: 2, dark: 2 },
  rock:     { fighting: 0.5, ground: 0.5, steel: 0.5, fire: 2, ice: 2, flying: 2, bug: 2 },
  ghost:    { normal: 0, dark: 0.5, psychic: 2, ghost: 1 },
  dragon:   { steel: 0.5, fairy: 0, dragon: 2 },
  dark:     { fighting: 0.5, dark: 0.5, fairy: 0.5, psychic: 2, ghost: 2, steel: 0.5 },
  steel:    { fire: 0.5, water: 0.5, electric: 0.5, steel: 0.5, ice: 2, rock: 2, fairy: 2 },
  fairy:    { fire: 0.5, poison: 0.5, steel: 0.5, fighting: 2, dragon: 2, dark: 2 }
};

const SPRITE_BASE = {
  front: "https://play.pokemonshowdown.com/sprites/ani/",
  back: "https://play.pokemonshowdown.com/sprites/ani-back/"
};

// ---------- VARIABLES GLOBALES ----------
let estadoCombate = null;
let miEquipo = [];
let equipoRival = [];
let rivalNombreGlobal = null;
let miIndexActivo = 0;
let rivalIndexActivo = 0;
let esMiTurno = false;
let esperandoCambio = false;
let cambioForzado = false;
let animacionEnProceso = false;
let ultimoLog = "";
let combateListener = null;

const pokemonCache = new Map();
const CACHE_MAX = 100;

// DOM refs — se asignan en iniciarCombate() tras DOMContentLoaded
let logTxt = null;
let menuPrincipal = null;
let menuMovimientos = null;
let menuCambio = null;
let menuBolsa = null;
let btnLuchar = null;
let btnPokemon = null;
let btnBolsa = null;
let btnCerrarBolsa = null;
let contenedorMovimientos = null;

// ---------- UTILIDADES ----------
function log(msg) {
  if (logTxt) logTxt.textContent = msg;
  console.log("[COMBATE]", msg);
}

function cachePokemon(key, value) {
  if (pokemonCache.size >= CACHE_MAX) {
    const firstKey = pokemonCache.keys().next().value;
    pokemonCache.delete(firstKey);
  }
  pokemonCache.set(key, structuredClone(value));
}

function calcularEstadisticasReales(baseStats, nivel) {
  return {
    hp:    Math.floor(((2 * baseStats.hp    + 31) * nivel / 100) + nivel + 10),
    atk:   Math.floor(((2 * baseStats.atk   + 31) * nivel / 100) + 5),
    def:   Math.floor(((2 * baseStats.def   + 31) * nivel / 100) + 5),
    spAtk: Math.floor(((2 * baseStats.spAtk + 31) * nivel / 100) + 5),
    spDef: Math.floor(((2 * baseStats.spDef + 31) * nivel / 100) + 5),
    spd:   Math.floor(((2 * baseStats.spd   + 31) * nivel / 100) + 5)
  };
}

// ---------- CARGA DE EQUIPOS ----------
async function cargarEquipo(listaEquipo, nombreJugador) {
  if (!listaEquipo || listaEquipo.length === 0) return [];
  try {
    return await Promise.all(listaEquipo.map(async (entry) => {
      const nombreBase = String(entry.nombre || (typeof entry === "string" ? entry : entry.id));
      if (!nombreBase || nombreBase === "undefined") return crearPokemonPorDefecto("Unknown");

      let configGuardada = {};
      if (nombreJugador === miNombre) {
        configGuardada = JSON.parse(localStorage.getItem(`configuracion-${nombreBase}`)) || {};
      } else {
        try {
          const configSnap = await get(ref(db, `partidas/${partidaId}/configuraciones/${nombreJugador}/${nombreBase}`));
          configGuardada = configSnap.val() || {};
        } catch (e) { console.warn("No se pudo cargar config del rival:", e); }
      }

      const nivel = parseInt(configGuardada.nivel) || 50;
      const apodo = configGuardada.apodo || nombreBase;
      const esShiny = configGuardada.shiny || false;
      const movimientosGuardados = configGuardada.movimientos || [];
      const objetoGuardado = configGuardada.objeto || null;

      const cacheKey = `${nombreBase}-${nivel}-${esShiny}`;
      if (pokemonCache.has(cacheKey)) return structuredClone(pokemonCache.get(cacheKey));

      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 8000);
        const res = await fetch(`https://pokeapi.co/api/v2/pokemon/${nombreBase.toLowerCase()}`, { signal: controller.signal });
        clearTimeout(timeoutId);
        if (!res.ok) return crearPokemonPorDefecto(apodo);

        const data = await res.json();
        const baseStats = {
          hp:    data.stats.find(s => s.stat.name === "hp")?.base_stat || 50,
          atk:   data.stats.find(s => s.stat.name === "attack")?.base_stat || 50,
          def:   data.stats.find(s => s.stat.name === "defense")?.base_stat || 50,
          spAtk: data.stats.find(s => s.stat.name === "special-attack")?.base_stat || 50,
          spDef: data.stats.find(s => s.stat.name === "special-defense")?.base_stat || 50,
          spd:   data.stats.find(s => s.stat.name === "speed")?.base_stat || 50
        };
        const statsReales = calcularEstadisticasReales(baseStats, nivel);

        let movimientos = [];
        if (movimientosGuardados.length > 0 && movimientosGuardados.some(m => m && m !== "")) {
          for (const moveName of movimientosGuardados) {
            if (!moveName || moveName === "") { movimientos.push(crearMovimientoPorDefecto()); continue; }
            try {
              const moveRes = await fetch(`https://pokeapi.co/api/v2/move/${moveName.toLowerCase()}`);
              if (moveRes.ok) {
                const moveData = await moveRes.json();
                movimientos.push({
                  nombre: moveData.name.replace(/-/g, " "),
                  tipo: moveData.type?.name || "normal",
                  poder: moveData.power || 40,
                  pp: moveData.pp || 20,
                  ppMax: moveData.pp || 20,
                  clase: moveData.damage_class?.name || "physical",
                  precision: moveData.accuracy || 100,
                  efecto: moveData.effect_entries?.find(e => e.language.name === "en")?.effect || "",
                  efectoEstado: extraerEfectoEstado(moveData)
                });
              } else {
                movimientos.push(crearMovimientoPorDefecto(moveName));
              }
            } catch { movimientos.push(crearMovimientoPorDefecto(moveName)); }
          }
        } else {
          movimientos = await Promise.all(
            (data.moves || []).slice(0, 4).map(async (m) => {
              try {
                const c2 = new AbortController();
                const t2 = setTimeout(() => c2.abort(), 4000);
                const mRes = await fetch(m.move.url, { signal: c2.signal });
                clearTimeout(t2);
                if (!mRes.ok) throw new Error();
                const mData = await mRes.json();
                return {
                  nombre: mData.name.replace(/-/g, " "),
                  tipo: mData.type?.name || "normal",
                  poder: mData.power || 0,
                  pp: mData.pp || 20,
                  ppMax: mData.pp || 20,
                  clase: mData.damage_class?.name || "physical",
                  precision: mData.accuracy || 100,
                  efecto: mData.effect_entries?.find(e => e.language.name === "en")?.effect || "",
                  efectoEstado: extraerEfectoEstado(mData)
                };
              } catch { return crearMovimientoPorDefecto(m.move.name); }
            })
          );
        }

        while (movimientos.length < 4) movimientos.push(crearMovimientoPorDefecto());

        const pokemonData = {
          nombre: apodo,
          nombreOriginal: data.name,
          hpMax: statsReales.hp,
          stats: statsReales,
          nivel,
          movimientos: movimientos.slice(0, 4),
          tipos: data.types?.map(t => t.type.name) || ["normal"],
          shiny: esShiny,
          objeto: objetoGuardado ? { id: objetoGuardado, nombre: objetoGuardado, sprite: "" } : null,
          objetoUsado: false
        };
        cachePokemon(cacheKey, pokemonData);
        return structuredClone(pokemonData);
      } catch (err) {
        console.error("[EQUIPO] Error cargando " + nombreBase + ":", err.message);
        return crearPokemonPorDefecto(apodo);
      }
    }));
  } catch (err) {
    console.error("[EQUIPO] Error:", err.message);
    return [crearPokemonPorDefecto("Fallback1"), crearPokemonPorDefecto("Fallback2")];
  }
}

function extraerEfectoEstado(moveData) {
  const efecto = moveData.effect_entries?.find(e => e.language.name === "en")?.effect || "";
  const estadoMap = {
    "paralyze": "PARALIZIS",
    "sleep": "DORMIDO",
    "burn": "QUEMADO",
    "freeze": "CONGELADO",
    "poison": "VENENO",
    "badly poison": "VENENO_GRAVE"
  };
  for (const [key, value] of Object.entries(estadoMap)) {
    if (efecto.toLowerCase().includes(key)) return value;
  }
  return null;
}

function crearMovimientoPorDefecto(nombre = "Ataque Rapido") {
  return { nombre: nombre.replace(/-/g, " "), tipo: "normal", poder: 40, pp: 30, ppMax: 30, clase: "physical", precision: 100, efecto: "", efectoEstado: null };
}

function crearPokemonPorDefecto(nombre) {
  return {
    nombre: nombre || "Pokemon",
    nombreOriginal: (nombre || "pokemon").toLowerCase(),
    hpMax: 50,
    stats: { hp: 50, atk: 50, def: 50, spAtk: 50, spDef: 50, spd: 50 },
    nivel: 50,
    movimientos: [crearMovimientoPorDefecto()],
    tipos: ["normal"],
    shiny: false,
    objeto: null,
    objetoUsado: false
  };
}

// ---------- INICIALIZAR COMBATE ----------
async function iniciarCombate() {
  // FIX: Asignar referencias DOM aquí, después de DOMContentLoaded
  logTxt         = document.getElementById("log-texto");
  menuPrincipal  = document.getElementById("menu-principal");
  menuMovimientos= document.getElementById("menu-movimientos");
  menuCambio     = document.getElementById("menu-cambio");
  menuBolsa      = document.getElementById("menu-bolsa");
  btnLuchar      = document.getElementById("btn-luchar");
  btnPokemon     = document.getElementById("btn-pokemon");
  btnBolsa       = document.getElementById("btn-bolsa");        // FIX: antes se leía a nivel módulo (null)
  btnCerrarBolsa = document.getElementById("btn-cerrar-bolsa");

  if (!menuPrincipal || !menuMovimientos) {
    console.error("Faltan elementos del DOM necesarios");
    return;
  }

  // FIX: Registrar event listeners aquí, donde los botones ya existen
  btnLuchar?.addEventListener("click", () => {
    if (!esMiTurno || esperandoCambio || animacionEnProceso) return;
    menuPrincipal?.classList.add("oculto");
    menuMovimientos?.classList.remove("oculto");
  });
  btnPokemon?.addEventListener("click", () => {
    if (!esMiTurno || esperandoCambio || animacionEnProceso) return;
    cambioForzado = false;
    mostrarSelectorPokemon();
  });
  btnBolsa?.addEventListener("click", () => {
    if (!esMiTurno || esperandoCambio || animacionEnProceso) return;
    mostrarBolsa();
  });
  btnCerrarBolsa?.addEventListener("click", () => {
    menuBolsa?.classList.add("oculto");
    mostrarMenuPrincipal();
  });

  await mostrarLoading();

  if (!partidaId || !miNombre) {
    log("Error: no se encontró la partida.");
    await ocultarLoading();
    return;
  }

  try {
    const snap = await get(ref(db, `partidas/${partidaId}`));
    const data = snap.val();
    if (!data?.jugadores) throw new Error("Partida no encontrada");

    const jugadores = Object.keys(data.jugadores);
    rivalNombreGlobal = jugadores.find(n => n !== miNombre);
    if (!rivalNombreGlobal) throw new Error("Rival no encontrado");

    const equipoMiData    = data.jugadores[miNombre]?.equipo;
    const equipoRivalData = data.jugadores[rivalNombreGlobal]?.equipo;
    if (!equipoMiData || !equipoRivalData) throw new Error("Equipos no encontrados");

    [miEquipo, equipoRival] = await Promise.all([
      cargarEquipo(equipoMiData, miNombre),
      cargarEquipo(equipoRivalData, rivalNombreGlobal)
    ]);

    if (miEquipo.length === 0 || equipoRival.length === 0) throw new Error("No se pudieron cargar los equipos");

    const combateRef = ref(db, `partidas/${partidaId}/combate`);
    const combateSnap = await get(combateRef);

      // FIX: si el combate quedó colgado en "resolver", el host lo resetea a "elegir"
      if (combateSnap.exists() && esHost) {
        const estadoGuardado = combateSnap.val();
        if (estadoGuardado.fase === "resolver" || estadoGuardado.fase === "cambio") {
          await update(combateRef, {
            fase: "elegir",
            accion: null,
            turno: estadoGuardado.turno  // mantiene a quién le tocaba
          });
          console.log("[INIT] Estado colgado detectado, reseteado a elegir");
        }
      }

      if (!combateSnap.exists() && esHost) {
        await inicializarCombateEnFirebase();
      }
    if (!combateSnap.exists() && !esHost) {
      log("Esperando al host...");
      let encontrado = false;
      for (let i = 0; i < 30 && !encontrado; i++) {
        await new Promise(r => setTimeout(r, 500));
        const check = await get(combateRef);
        if (check.exists()) encontrado = true;
      }
      if (!encontrado) throw new Error("Timeout esperando al host");
    }

    if (combateListener) off(combateListener);
    combateListener = onValue(combateRef, (snapshot) => {
      const nuevoEstado = snapshot.val();
      if (nuevoEstado) { estadoCombate = nuevoEstado; renderEstado(estadoCombate); }
    });

    await ocultarLoading();
  } catch (err) {
    console.error("[INIT]", err);
    log("Error: " + err.message);
    await ocultarLoading();
  }
}

async function inicializarCombateEnFirebase() {
  const turnoInicial = calcularQuienEmpieza();
  await set(ref(db, `partidas/${partidaId}/combate`), {
    turno: turnoInicial,
    fase: "elegir",
    indexActivo: { [miNombre]: 0, [rivalNombreGlobal]: 0 },
    hp: {
      [miNombre]: miEquipo.map(p => p.hpMax),
      [rivalNombreGlobal]: equipoRival.map(p => p.hpMax)
    },
    pp: {
      [miNombre]: miEquipo.map(p => p.movimientos.map(m => m.ppMax)),
      [rivalNombreGlobal]: equipoRival.map(p => p.movimientos.map(m => m.ppMax))
    },
    estados: {
      [miNombre]: miEquipo.map(() => ({ nombre: null, turnosRestantes: 0, acumulador: 0 })),
      [rivalNombreGlobal]: equipoRival.map(() => ({ nombre: null, turnosRestantes: 0, acumulador: 0 }))
    },
    estadisticas: {
      [miNombre]: miEquipo.map(() => ({ atk: 0, def: 0, spAtk: 0, spDef: 0, spd: 0, evasion: 0, precision: 0 })),
      [rivalNombreGlobal]: equipoRival.map(() => ({ atk: 0, def: 0, spAtk: 0, spDef: 0, spd: 0, evasion: 0, precision: 0 }))
    },
    accion: null,
    log: "El combate comienza",
    clima: null,
    turnoClima: 0,
    campo: { reflejo: null, muroLuz: null, velocidad: null },
    objetosUsados: { [miNombre]: [], [rivalNombreGlobal]: [] }
  });
}

function calcularQuienEmpieza() {
  const miVel    = miEquipo[0]?.stats.spd || 0;
  const rivalVel = equipoRival[0]?.stats.spd || 0;
  if (miVel === rivalVel) return Math.random() < 0.5 ? miNombre : rivalNombreGlobal;
  return miVel > rivalVel ? miNombre : rivalNombreGlobal;
}

// ---------- RENDERIZADO ----------
function renderEstado(estado) {
  if (!estado) { log("Esperando inicio del combate..."); return; }
  if (!estado.indexActivo || !estado.hp || !estado.pp || !estado.estados) return;

  esMiTurno       = estado.turno === miNombre;
  console.log("turno:", estado.turno, "| yo:", miNombre, "| esMiTurno:", esMiTurno, "| fase:", estado.fase);
  miIndexActivo   = estado.indexActivo[miNombre];
  rivalIndexActivo= estado.indexActivo[rivalNombreGlobal];


  if (!miEquipo[miIndexActivo] || !equipoRival[rivalIndexActivo]) return;

  const miPoke       = miEquipo[miIndexActivo];
  const rivalPoke    = equipoRival[rivalIndexActivo];
  const miHPActual   = estado.hp[miNombre]?.[miIndexActivo];
  const rivalHPActual= estado.hp[rivalNombreGlobal]?.[rivalIndexActivo];
  if (miHPActual === undefined || rivalHPActual === undefined) return;

  const miEstado    = estado.estados[miNombre]?.[miIndexActivo]    || { nombre: null };
  const rivalEstado = estado.estados[rivalNombreGlobal]?.[rivalIndexActivo] || { nombre: null };

  actualizarCampoPorTipo(miPoke.tipos);
  if (estado.clima) aplicarClima(estado.clima);

  actualizarSprite("jugador-sprite", miPoke, "back");
  actualizarSprite("enemigo-sprite", rivalPoke, "front");
  actualizarInfobar("jugador", miPoke, miHPActual, miEstado);
  actualizarInfobar("enemigo", rivalPoke, rivalHPActual, rivalEstado);

  // Sync objetoUsado desde Firebase
  const objetosUsados = estado.objetosUsados?.[miNombre] || [];
  miEquipo.forEach((poke, idx) => { poke.objetoUsado = objetosUsados.includes(idx); });

  actualizarPokeballs("equipo-jugador", estado.hp[miNombre], miEquipo, "jugador", estado.estados[miNombre], miIndexActivo);
  actualizarPokeballs("equipo-enemigo", estado.hp[rivalNombreGlobal], equipoRival, "enemigo", estado.estados[rivalNombreGlobal], rivalIndexActivo);

  if (estado.log && estado.log !== ultimoLog) { log(estado.log); ultimoLog = estado.log; }

  if (estado.fase === "fin") { finalizarCombate(estado.ganador); return; }

  if (estado.fase === "resolver" && esHost && !animacionEnProceso) {
    resolverAtaque(estado);
    return;
  }

  if (estado.fase === "cambio" && estado.turno === miNombre && !esperandoCambio) {
    cambioForzado = true;
    mostrarSelectorPokemon();
    return;
  }

  if (esMiTurno && estado.fase === "elegir" && !esperandoCambio) {
    mostrarMenuPrincipal();
    // FIX: refrescar contenedorMovimientos cada vez (el Pokémon activo puede haber cambiado)
    contenedorMovimientos = document.querySelector(".movimientos-grid");
    if (estado.pp[miNombre]?.[miIndexActivo]) cargarMovimientos(miPoke, estado.pp[miNombre][miIndexActivo]);
  } else {
    ocultarMenus();
    if (!esMiTurno && estado.fase === "elegir") log("Esperando al rival...");
  }
}

function actualizarCampoPorTipo(tipos) {
  const campo = document.querySelector(".combate-campo");
  if (!campo) return;
  const tipoAClase = {
    fire:"fuego", water:"agua", grass:"planta", electric:"electrico",
    rock:"roca", ground:"tierra", ice:"hielo", psychic:"psiquico",
    ghost:"fantasma", dark:"siniestro", dragon:"dragon", fairy:"hada",
    steel:"acero", flying:"volador", poison:"veneno", bug:"bicho",
    fighting:"lucha", normal:"estandar"
  };
  const clasesCampo = Object.values(tipoAClase);
  campo.classList.remove(...clasesCampo);
  campo.classList.add(tipoAClase[tipos[0]] || "estandar");
}

function aplicarClima(tipoClima) {
  const campo = document.querySelector(".combate-campo");
  if (!campo) return;
  const climas = ["lluvia","sol","tormenta-arena","granizo"];
  campo.classList.remove(...climas);
  if (tipoClima) campo.classList.add(tipoClima);
}

function actualizarSprite(id, pokemon, lado) {
  const img = document.getElementById(id);
  if (!img) return;
  img.src = `${SPRITE_BASE[lado]}${(pokemon.nombreOriginal || pokemon.nombre).toLowerCase()}.gif`;
  img.alt = pokemon.nombre;
}

function actualizarInfobar(lado, pokemon, hpActual, estado) {
  const pct  = Math.max(0, (hpActual / pokemon.hpMax) * 100);
  const fill = document.getElementById(lado + "-hp-fill");
  if (fill) {
    fill.style.width = pct + "%";
    fill.className   = "combate-hpbar-fill" + (pct > 50 ? "" : pct > 20 ? " hp-mid" : " hp-low");
  }
  const nomEl = document.getElementById(lado + "-nombre");
  if (nomEl) nomEl.textContent = pokemon.nombre.toUpperCase() + (estado?.nombre ? " [" + estado.nombre + "]" : "");

  // Mostrar HP numérico para ambos lados (útil tenerlo también para el enemigo)
  const hpNum = document.getElementById(lado + "-hp-actual");
  const hpMax = document.getElementById(lado + "-hp-max");
  if (hpNum) hpNum.textContent = hpActual;
  if (hpMax) hpMax.textContent = pokemon.hpMax;
}

// FIX: prefijo ahora es "jugador" / "enemigo" para que coincida con IDs reales del HTML
function actualizarPokeballs(containerId, hpArray, equipo, prefijo, estadosArray, indexActivo) {
  for (let i = 0; i < equipo.length; i++) {
    const ball = document.getElementById(`${prefijo}-ball-${i}`);
    if (!ball) continue;
    ball.classList.toggle("debil",  hpArray[i] <= 0);
    ball.classList.toggle("activo", i === indexActivo);
    ball.classList.toggle("estado", !!estadosArray?.[i]?.nombre);
    ball.title = estadosArray?.[i]?.nombre || "";
  }
}

// ---------- RESOLVER ATAQUE ----------
async function resolverAtaque(estado) {
  console.log("resolverAtaque llamado, accion:", JSON.stringify(estado.accion));
  if (animacionEnProceso) return;
  animacionEnProceso = true;

  // FIX: capturar referencias de sprites ANTES de la transacción (valores del estado actual)
  const accion = estado.accion;
  if (!accion) { animacionEnProceso = false; return; }

  const atacante      = accion.jugador;
  const defensor      = atacante === miNombre ? rivalNombreGlobal : miNombre;
  const equipoAtac    = atacante === miNombre ? miEquipo : equipoRival;
  const equipoDef     = atacante === miNombre ? equipoRival : miEquipo;
  const indexAtacante = estado.indexActivo[atacante];
  const indexDefensor = estado.indexActivo[defensor];
  const pokeAtacante  = equipoAtac[indexAtacante];
  const pokeDefensor  = equipoDef[indexDefensor];

  if (!pokeAtacante || !pokeDefensor) { animacionEnProceso = false; return; }

  const movimiento    = pokeAtacante.movimientos[accion.movIndex];

  // Sprite containers para animaciones
  const spriteAtacanteEl = atacante === miNombre
    ? document.getElementById("jugador-sprite")?.parentElement
    : document.getElementById("enemigo-sprite")?.parentElement;
  const spriteDefensorEl = atacante === miNombre
    ? document.getElementById("enemigo-sprite")?.parentElement
    : document.getElementById("jugador-sprite")?.parentElement;

  try {
    // Animación de ataque ANTES de la transacción
    await animaciones.reproducirAtaque(movimiento, movimiento.clase === "special");
    await animaciones.sacudirPokemon(spriteAtacanteEl);

    const combateRef = ref(db, `partidas/${partidaId}/combate`);
    const resultado  = await runTransaction(combateRef, (estadoActual) => {
      // FIX: guards devuelven estadoActual (no undefined) para no abortar la transacción
      if (!estadoActual)                            return estadoActual;
      if (estadoActual.fase !== "resolver")         return estadoActual;
      if (!estadoActual.accion)                     return estadoActual;
      if (estadoActual.accion.jugador !== atacante) return estadoActual;

      let nuevosHP     = structuredClone(estadoActual.hp);
      let nuevosPP     = structuredClone(estadoActual.pp);
      let nuevosEstados= structuredClone(estadoActual.estados);
      let nuevosStats  = structuredClone(estadoActual.estadisticas);

      // Descontar PP
      nuevosPP[atacante][indexAtacante][accion.movIndex] =
        Math.max(0, nuevosPP[atacante][indexAtacante][accion.movIndex] - 1);

      // Verificar estado pre-acción (parálisis, sueño, congelado)
      const { puedeActuar, nuevosEstadosPost } = verificarEstadoPreAccion(nuevosEstados, atacante, indexAtacante);
      nuevosEstados = nuevosEstadosPost;

      if (!puedeActuar) {
        return { ...estadoActual, hp: nuevosHP, pp: nuevosPP, estados: nuevosEstados,
          estadisticas: nuevosStats, turno: defensor, fase: "elegir",
          log: `¡${pokeAtacante.nombre} no puede moverse!`, accion: null };
      }

      // Verificar precisión
      const precisionMod = obtenerModificadorPrecision(nuevosStats, atacante, indexAtacante);
      if (movimiento.precision !== null && Math.random() * 100 >= movimiento.precision * precisionMod) {
        return { ...estadoActual, hp: nuevosHP, pp: nuevosPP, estados: nuevosEstados,
          estadisticas: nuevosStats, turno: defensor, fase: "elegir",
          log: `¡${pokeAtacante.nombre} falló!`, accion: null };
      }

      let logMsg       = "";
      let danoRealizado= 0;

      if (movimiento.clase === "status") {
        // FIX: propiedad de retorno corregida de nuevosEstadosResult → nuevosEstados
        const result = aplicarMovimientoStatus(movimiento, pokeAtacante, pokeDefensor, nuevosEstados, defensor, indexDefensor);
        logMsg        = result.mensaje;
        nuevosEstados = result.nuevosEstados;   // ← nombre corregido
      } else {
        // FIX: crítico integrado DENTRO de calcularDano, no después
        const esCritico = Math.random() < 0.0625;
        const result = calcularDano(
          movimiento, pokeAtacante, pokeDefensor,
          nuevosStats, nuevosEstados,
          atacante, defensor, indexAtacante, indexDefensor,
          estadoActual.clima, nuevosHP, esCritico
        );
        logMsg       = result.logMsg;
        nuevosHP     = result.nuevosHP;
        nuevosStats  = result.nuevosStatsResult;
        danoRealizado= result.dano;

        // Efecto de estado secundario (30% de probabilidad)
        if (movimiento.efectoEstado && danoRealizado > 0 && Math.random() < 0.3) {
          const secResult = aplicarEstadoPorMovimiento(
            movimiento.efectoEstado, pokeDefensor, nuevosEstados, defensor, indexDefensor
          );
          if (secResult.mensaje) { logMsg += " " + secResult.mensaje; nuevosEstados = secResult.nuevosEstados; }
        }
      }

      // Daño post-acción (quemadura, veneno, etc.)
      const postResult = aplicarDanoPostAccion(nuevosHP, nuevosEstados, atacante, defensor, indexAtacante, indexDefensor, pokeAtacante, pokeDefensor);
      nuevosHP      = postResult.nuevosHPPost;
      nuevosEstados = postResult.nuevosEstadosPost2;
      if (postResult.mensaje) logMsg += " " + postResult.mensaje;

      let nuevaFase  = "elegir";
      let nuevoTurno = defensor;

      // Chequear KO del defensor
      if (nuevosHP[defensor][indexDefensor] <= 0) {
        nuevosHP[defensor][indexDefensor] = 0;
        logMsg += ` ¡${pokeDefensor.nombre} se debilitó!`;
        if (encontrarSiguientePokemon(nuevosHP[defensor]) === -1) {
          return { ...estadoActual, hp: nuevosHP, pp: nuevosPP, estados: nuevosEstados,
            estadisticas: nuevosStats, turno: atacante, fase: "fin", ganador: atacante,
            log: `¡${atacante} ha ganado el combate!`, accion: null };
        }
        nuevaFase  = "cambio";
        nuevoTurno = defensor;
        logMsg    += " Elige tu siguiente Pokémon.";
      }

      // Chequear KO del atacante (por daño de estado post-acción)
      if (nuevosHP[atacante][indexAtacante] <= 0) {
        nuevosHP[atacante][indexAtacante] = 0;
        logMsg += ` ¡${pokeAtacante.nombre} se debilitó!`;
        if (encontrarSiguientePokemon(nuevosHP[atacante]) === -1) {
          return { ...estadoActual, hp: nuevosHP, pp: nuevosPP, estados: nuevosEstados,
            estadisticas: nuevosStats, turno: defensor, fase: "fin", ganador: defensor,
            log: `¡${defensor} ha ganado el combate!`, accion: null };
        }
        // Si ambos necesitan cambio, el atacante tiene prioridad para elegir primero
        if (nuevaFase !== "cambio") {
          nuevaFase  = "cambio";
          nuevoTurno = atacante;
        }
        logMsg += " Elige tu siguiente Pokémon.";
      }

      return { ...estadoActual, hp: nuevosHP, pp: nuevosPP, estados: nuevosEstados,
        estadisticas: nuevosStats, turno: nuevoTurno, fase: nuevaFase, log: logMsg, accion: null };
    });

    // Animaciones post-transacción
    if (resultado.committed) {
      const estadoFinal = resultado.snapshot.val();
      // FIX: usar el daño real del resultado en vez de parsear el log con regex inestable
      const danoFinal = calcularUltimoDanoDesdeEstado(estadoFinal, defensor, indexDefensor, estado);
      if (danoFinal > 0) {
        await animaciones.sacudirPokemon(spriteDefensorEl);
        await animaciones.flashDamage(spriteDefensorEl);
        const rect = spriteDefensorEl?.getBoundingClientRect();
        const posX = rect ? rect.left + rect.width  / 2 : window.innerWidth  / 2;
        const posY = rect ? rect.top  + rect.height / 2 : window.innerHeight / 2;
        await animaciones.mostrarDano(danoFinal, false, posX, posY);
      }
    }
  } catch (err) {
    console.error("[RESOLVER ERROR]", err);
    log("Error al resolver el ataque");
  } finally {
    animacionEnProceso = false;
  }
}

// FIX: calcular daño real comparando HP antes/después en vez de parsear el log
function calcularUltimoDanoDesdeEstado(estadoFinal, defensorNombre, indexDefensor, estadoAnterior) {
  const hpAntes  = estadoAnterior.hp?.[defensorNombre]?.[indexDefensor] ?? 0;
  const hpDespues= estadoFinal.hp?.[defensorNombre]?.[indexDefensor]    ?? 0;
  return Math.max(0, hpAntes - hpDespues);
}

// ---------- FUNCIONES AUXILIARES DE COMBATE ----------
function verificarEstadoPreAccion(estados, jugador, index) {
  const nuevosEstados = structuredClone(estados);
  const estadoPoke    = nuevosEstados[jugador][index];
  if (!estadoPoke.nombre) return { puedeActuar: true, nuevosEstadosPost: nuevosEstados };

  switch (estadoPoke.nombre) {
    case "PARALIZIS":
      return { puedeActuar: Math.random() > 0.25, nuevosEstadosPost: nuevosEstados };
    case "DORMIDO":
      if (estadoPoke.turnosRestantes <= 0) {
        nuevosEstados[jugador][index] = { nombre: null, turnosRestantes: 0, acumulador: 0 };
        return { puedeActuar: true, nuevosEstadosPost: nuevosEstados };
      }
      nuevosEstados[jugador][index].turnosRestantes--;
      return { puedeActuar: false, nuevosEstadosPost: nuevosEstados };
    case "CONGELADO":
      if (Math.random() < 0.2) {
        nuevosEstados[jugador][index] = { nombre: null, turnosRestantes: 0, acumulador: 0 };
        return { puedeActuar: true, nuevosEstadosPost: nuevosEstados };
      }
      return { puedeActuar: false, nuevosEstadosPost: nuevosEstados };
    default:
      return { puedeActuar: true, nuevosEstadosPost: nuevosEstados };
  }
}

function obtenerModificadorPrecision(estadisticas, jugador, index) {
  const s = estadisticas[jugador][index];
  const atkMod = Math.max(-6, Math.min(6, s.precision));
  const evaMod = Math.max(-6, Math.min(6, s.evasion));
  return (atkMod >= 0 ? (3 + atkMod) / 3 : 3 / (3 - atkMod)) /
         (evaMod >= 0 ? (3 + evaMod) / 3 : 3 / (3 - evaMod));
}

// FIX: esCritico ahora es parámetro (calculado antes de llamar), evitando doble daño
function calcularDano(movimiento, pokeAtacante, pokeDefensor, estadisticas, estados,
    atacanteNombre, defensorNombre, indexAtacante, indexDefensor, clima, nuevosHP, esCritico = false) {

  let attackStat  = movimiento.clase === "special" ? pokeAtacante.stats.spAtk : pokeAtacante.stats.atk;
  let defenseStat = movimiento.clase === "special" ? pokeDefensor.stats.spDef : pokeDefensor.stats.def;

  const sA     = estadisticas[atacanteNombre][indexAtacante];
  const sD     = estadisticas[defensorNombre][indexDefensor];
  const atkKey = movimiento.clase === "special" ? "spAtk" : "atk";
  const defKey = movimiento.clase === "special" ? "spDef" : "def";
  const atkMod = Math.max(-6, Math.min(6, sA[atkKey]));
  const defMod = Math.max(-6, Math.min(6, sD[defKey]));

  attackStat  *= atkMod >= 0 ? (2 + atkMod) / 2 : 2 / (2 - atkMod);
  defenseStat *= defMod >= 0 ? (2 + defMod) / 2 : 2 / (2 - defMod);

  // Quemadura reduce ataque físico
  if (estados[atacanteNombre][indexAtacante].nombre === "QUEMADO" && movimiento.clase === "physical") attackStat *= 0.5;

  const stab = pokeAtacante.tipos.includes(movimiento.tipo) ? 1.5 : 1;
  let effectiveness = 1;
  for (const tipo of pokeDefensor.tipos) effectiveness *= TIPO_CHART[movimiento.tipo]?.[tipo] ?? 1;

  let weatherMod = 1;
  if (clima === "lluvia") { if (movimiento.tipo === "water") weatherMod = 1.5; if (movimiento.tipo === "fire") weatherMod = 0.5; }
  if (clima === "sol")    { if (movimiento.tipo === "fire")  weatherMod = 1.5; if (movimiento.tipo === "water") weatherMod = 0.5; }

  const critMod = esCritico ? 1.5 : 1;
  const nivel   = pokeAtacante.nivel || 50;
  let damage    = Math.floor(
    (((2 * nivel / 5 + 2) * movimiento.poder * attackStat / defenseStat) / 50) + 2
  );
  damage = Math.floor(damage * stab * effectiveness * weatherMod * critMod * (0.85 + Math.random() * 0.15));

  let logMsg = `${pokeAtacante.nombre} usó ${movimiento.nombre}!`;
  if (esCritico)           logMsg += " ¡Golpe crítico!";
  if (stab > 1)            logMsg += " STAB";
  if (effectiveness > 1)   logMsg += " ¡Es muy eficaz!";
  if (effectiveness < 1 && effectiveness > 0) logMsg += " No es muy eficaz";
  if (effectiveness === 0) { logMsg += " No afecta"; damage = 0; }
  if (damage > 0) {
    logMsg += ` (-${damage} HP)`;
    nuevosHP[defensorNombre][indexDefensor] = Math.max(0, nuevosHP[defensorNombre][indexDefensor] - damage);
  }

  return { dano: damage, logMsg, nuevosHP, nuevosStatsResult: estadisticas };
}

// FIX: propiedad de retorno renombrada a "nuevosEstados" (coherente con quien la consume)
function aplicarMovimientoStatus(movimiento, pokeAtacante, pokeDefensor, estados, defensorNombre, indexDefensor) {
  const nuevosEstados = structuredClone(estados);
  const estadoAplicar = movimiento.efectoEstado;
  if (estadoAplicar && !nuevosEstados[defensorNombre][indexDefensor].nombre) {
    let turnos = 0, acum = 0;
    if (estadoAplicar === "DORMIDO")      turnos = Math.floor(Math.random() * 3) + 1;
    if (estadoAplicar === "VENENO_GRAVE") acum   = 1;
    nuevosEstados[defensorNombre][indexDefensor] = { nombre: estadoAplicar, turnosRestantes: turnos, acumulador: acum };
    return { mensaje: `${pokeDefensor.nombre} quedó ${estadoAplicar}!`, nuevosEstados };
  }
  return { mensaje: `${pokeAtacante.nombre} usó ${movimiento.nombre}, pero no tuvo efecto.`, nuevosEstados };
}

function aplicarEstadoPorMovimiento(estado, objetivo, estados, jugador, index) {
  const nuevosEstados = structuredClone(estados);
  if (!nuevosEstados[jugador][index].nombre) {
    let turnos = 0, acum = 0;
    if (estado === "DORMIDO")      turnos = Math.floor(Math.random() * 3) + 1;
    if (estado === "VENENO_GRAVE") acum   = 1;
    nuevosEstados[jugador][index] = { nombre: estado, turnosRestantes: turnos, acumulador: acum };
    return { mensaje: `${objetivo.nombre} quedó ${estado}!`, nuevosEstados };
  }
  return { mensaje: "", nuevosEstados };
}

function aplicarDanoPostAccion(hp, estados, atacante, defensor, indexAtacante, indexDefensor, pokeAtacante, pokeDefensor) {
  const nuevosHP      = structuredClone(hp);
  const nuevosEstados = structuredClone(estados);
  const mensajes      = [];
  const eAtacante     = nuevosEstados[atacante][indexAtacante];

  if (eAtacante.nombre === "QUEMADO") {
    const d = Math.max(1, Math.floor(pokeAtacante.hpMax * 0.0625));
    nuevosHP[atacante][indexAtacante] = Math.max(0, nuevosHP[atacante][indexAtacante] - d);
    mensajes.push(`${pokeAtacante.nombre} sufrió daño por quemadura (-${d} HP)`);
  } else if (eAtacante.nombre === "VENENO") {
    const d = Math.max(1, Math.floor(pokeAtacante.hpMax * 0.125));
    nuevosHP[atacante][indexAtacante] = Math.max(0, nuevosHP[atacante][indexAtacante] - d);
    mensajes.push(`${pokeAtacante.nombre} sufrió daño por veneno (-${d} HP)`);
  } else if (eAtacante.nombre === "VENENO_GRAVE") {
    const acum = eAtacante.acumulador || 1;
    const d    = Math.max(1, Math.floor(pokeAtacante.hpMax * 0.0625 * acum));
    nuevosHP[atacante][indexAtacante] = Math.max(0, nuevosHP[atacante][indexAtacante] - d);
    nuevosEstados[atacante][indexAtacante].acumulador = acum + 1;
    mensajes.push(`${pokeAtacante.nombre} sufrió daño por veneno grave (-${d} HP)`);
  }

  return { mensaje: mensajes.join(" "), nuevosHPPost: nuevosHP, nuevosEstadosPost2: nuevosEstados };
}

function encontrarSiguientePokemon(hpArray) {
  return hpArray.findIndex(hp => hp > 0);
}

// ---------- ACCIONES DEL JUGADOR ----------
async function elegirAtaque(mov, index) {
  if (!esMiTurno || animacionEnProceso || esperandoCambio) { log("No puedes atacar ahora"); return; }
  const ppActual = estadoCombate?.pp[miNombre]?.[miIndexActivo]?.[index];
  if (ppActual <= 0) { log("¡No quedan PP para " + mov.nombre + "!"); return; }

  animacionEnProceso = true;
  ocultarMenus();

  try {
    const combateRef = ref(db, `partidas/${partidaId}/combate`);
    await runTransaction(combateRef, (estadoActual) => {
      // FIX: guard devuelve estadoActual para no abortar
      if (!estadoActual)                               return estadoActual;
      if (estadoActual.turno !== miNombre)             return estadoActual;
      if (estadoActual.fase !== "elegir")              return estadoActual;
      if (estadoActual.pp[miNombre][miIndexActivo][index] <= 0) return estadoActual;
      return { ...estadoActual, accion: { jugador: miNombre, movIndex: index, movNombre: mov.nombre }, fase: "resolver" };
    });
  } catch (err) {
    console.error("[ATAQUE ERROR]", err);
    log("Error al enviar el ataque");
  } finally {
    animacionEnProceso = false;
  }
}

function mostrarSelectorPokemon() {
  esperandoCambio = true;
  log(cambioForzado ? "¡Elige tu siguiente Pokémon!" : "Elige un Pokémon:");
  if (!menuCambio) return;
  menuCambio.innerHTML = "<h3 style='color:#ffcb05;margin-bottom:12px;text-align:center'>ELIGE POKÉMON</h3>";
  menuCambio.classList.remove("oculto");
  menuPrincipal?.classList.add("oculto");
  menuMovimientos?.classList.add("oculto");

  miEquipo.forEach((poke, i) => {
    const hpActual  = estadoCombate.hp[miNombre][i];
    const estadoPoke= estadoCombate.estados[miNombre][i];
    if (hpActual <= 0 || i === miIndexActivo) return;
    const btn = document.createElement("button");
    btn.className = "combate-opcion cambio-pokemon-btn";
    btn.innerHTML = `<div class='poke-nombre'>${poke.nombre.toUpperCase()}${estadoPoke.nombre ? ` [${estadoPoke.nombre}]` : ""}</div><div class='poke-hp'>❤️ ${hpActual}/${poke.hpMax} HP</div>`;
    btn.onclick = () => confirmarCambio(i);
    menuCambio.appendChild(btn);
  });

  if (!cambioForzado) {
    const btnCancelar   = document.createElement("button");
    btnCancelar.className= "combate-opcion";
    btnCancelar.textContent = "CANCELAR";
    btnCancelar.onclick = cancelarCambio;
    menuCambio.appendChild(btnCancelar);
  }
}

function cancelarCambio() {
  esperandoCambio = false;
  cambioForzado   = false;
  mostrarMenuPrincipal();
  menuCambio?.classList.add("oculto");
}

async function confirmarCambio(nuevoIndex) {
  esperandoCambio = false;
  cambioForzado   = false;
  const nuevoPoke = miEquipo[nuevoIndex];

  const combateRef = ref(db, `partidas/${partidaId}/combate`);
  await runTransaction(combateRef, (estadoActual) => {
    // FIX: guard devuelve estadoActual
    if (!estadoActual)                   return estadoActual;
    if (estadoActual.fase !== "cambio")  return estadoActual;
    if (estadoActual.turno !== miNombre) return estadoActual;
    return {
      ...estadoActual,
      indexActivo: { ...estadoActual.indexActivo, [miNombre]: nuevoIndex },
      turno: rivalNombreGlobal,
      fase: "elegir",
      log: `¡${miNombre} envió a ${nuevoPoke.nombre}!`
    };
  });
  menuCambio?.classList.add("oculto");
  mostrarMenuPrincipal();
}

// ---------- BOLSA ----------
const EFECTOS_OBJETO = {
  "potion":       { tipo: "hp", cantidad: 20 },
  "super-potion": { tipo: "hp", cantidad: 50 },
  "hyper-potion": { tipo: "hp", cantidad: 200 },
  "revive":       { tipo: "revivir" },
  "full-heal":    { tipo: "estado" },
  "ether":        { tipo: "pp", cantidad: 10 }
};

function mostrarBolsa() {
  const contenedor = document.getElementById("bolsa-contenido");
  if (!contenedor) return;
  contenedor.innerHTML = "<h3 style='color:#ffcb05;margin-bottom:12px;text-align:center'>BOLSA</h3>";

  const objetosUsados = estadoCombate?.objetosUsados?.[miNombre] || [];
  let hayObjetos = false;

  miEquipo.forEach((poke, i) => {
    const hpActual = estadoCombate.hp[miNombre][i];
    const objeto   = poke.objeto;
    if (!objeto || objeto === "ninguno") return;
    if (objetosUsados.includes(i)) return;
    hayObjetos = true;

    const btn   = document.createElement("button");
    btn.className = "combate-opcion";
    const efecto  = EFECTOS_OBJETO[objeto.id];
    const disabled= !efecto || (objeto.id !== "revive" && hpActual <= 0);
    btn.disabled  = disabled;
    btn.innerHTML = `${objeto.nombre} — ${poke.nombre.toUpperCase()}${hpActual <= 0 && objeto.id !== "revive" ? " (debilitado)" : ""}`;
    if (!disabled) btn.onclick = () => usarObjeto(i, objeto, efecto);
    contenedor.appendChild(btn);
  });

  if (!hayObjetos) {
    const p = document.createElement("p");
    p.textContent = "No hay objetos disponibles.";
    p.style.color = "#aaa";
    p.style.textAlign = "center";
    contenedor.appendChild(p);
  }

  menuPrincipal?.classList.add("oculto");
  menuBolsa?.classList.remove("oculto");
}

async function usarObjeto(indexPoke, objeto, efecto) {
  const combateRef = ref(db, `partidas/${partidaId}/combate`);
  await runTransaction(combateRef, (estadoActual) => {
    // FIX: guards devuelven estadoActual
    if (!estadoActual)                 return estadoActual;
    if (estadoActual.turno !== miNombre) return estadoActual;

    const objetosUsados = estadoActual.objetosUsados?.[miNombre] || [];
    if (objetosUsados.includes(indexPoke)) return estadoActual;

    let nuevosHP     = structuredClone(estadoActual.hp);
    let nuevosPP     = structuredClone(estadoActual.pp);
    let nuevosEstados= structuredClone(estadoActual.estados);
    let logMsg       = "";

    const hpActual = nuevosHP[miNombre][indexPoke];
    const hpMax    = miEquipo[indexPoke].hpMax;

    switch (efecto.tipo) {
      case "hp":
        if (hpActual >= hpMax) return estadoActual;
        nuevosHP[miNombre][indexPoke] = Math.min(hpMax, hpActual + efecto.cantidad);
        logMsg = `${miNombre} usó ${objeto.nombre} en ${miEquipo[indexPoke].nombre}! (+${efecto.cantidad} HP)`;
        break;
      case "revivir":
        if (hpActual > 0) return estadoActual;
        nuevosHP[miNombre][indexPoke] = Math.floor(hpMax * 0.5);
        logMsg = `${miEquipo[indexPoke].nombre} fue revivido con ${Math.floor(hpMax * 0.5)} HP!`;
        break;
      case "estado":
        if (!estadoActual.estados[miNombre][indexPoke].nombre) return estadoActual;
        nuevosEstados[miNombre][indexPoke] = { nombre: null, turnosRestantes: 0, acumulador: 0 };
        logMsg = `${miEquipo[indexPoke].nombre} fue curado de ${estadoActual.estados[miNombre][indexPoke].nombre}!`;
        break;
      case "pp":
        nuevosPP[miNombre][indexPoke] = nuevosPP[miNombre][indexPoke].map(
          (pp, idx) => Math.min(pp + efecto.cantidad, miEquipo[indexPoke].movimientos[idx].ppMax)
        );
        logMsg = `Se restauraron PP de ${miEquipo[indexPoke].nombre}!`;
        break;
      default: return estadoActual;
    }

    const nuevosUsados = [...objetosUsados, indexPoke];
    let nuevaFase  = estadoActual.fase;
    let nuevoTurno = rivalNombreGlobal;

    if (nuevosHP[miNombre][miIndexActivo] <= 0) {
      nuevaFase  = "cambio";
      nuevoTurno = miNombre;
      logMsg    += " Tu Pokémon se debilitó. Elige otro.";
    }

    return {
      ...estadoActual,
      hp: nuevosHP, pp: nuevosPP, estados: nuevosEstados,
      objetosUsados: { ...estadoActual.objetosUsados, [miNombre]: nuevosUsados },
      turno: nuevoTurno, fase: nuevaFase, log: logMsg, accion: null
    };
  });

  menuBolsa?.classList.add("oculto");
  mostrarMenuPrincipal();
}

// ---------- MENÚS ----------
function cargarMovimientos(pokemon, ppActuales) {
  // FIX: siempre releer el nodo del DOM (puede haber cambiado el Pokémon activo)
  contenedorMovimientos = document.querySelector(".movimientos-grid");
  if (!contenedorMovimientos) return;
  contenedorMovimientos.innerHTML = "";

  pokemon.movimientos.forEach((mov, i) => {
    const btn = document.createElement("button");
    btn.className = "combate-movimiento";
    btn.disabled  = ppActuales[i] <= 0;
    btn.innerHTML = `
      <span class='mov-nombre'>${mov.nombre.toUpperCase()}</span>
      <span class='mov-tipo tipo-${mov.tipo}'>${mov.tipo.toUpperCase()}</span>
      <span class='mov-pp'>PP: ${ppActuales[i]}/${mov.ppMax}</span>
      <span class='mov-poder'>POD: ${mov.poder || "--"}</span>`;
    if (!btn.disabled) btn.onclick = () => elegirAtaque(mov, i);
    contenedorMovimientos.appendChild(btn);
  });

  const btnV = document.createElement("button");
  btnV.className   = "combate-opcion combate-volver";
  btnV.textContent = "VOLVER";
  btnV.onclick     = mostrarMenuPrincipal;
  contenedorMovimientos.appendChild(btnV);
}

function mostrarMenuPrincipal() {
  console.log("mostrarMenuPrincipal() llamado", { menuPrincipal, menuMovimientos });
  menuPrincipal?.classList.remove("oculto");
  menuMovimientos?.classList.add("oculto");
  menuCambio?.classList.add("oculto");
  menuBolsa?.classList.add("oculto");
}

function ocultarMenus() {
  menuPrincipal?.classList.add("oculto");
  menuMovimientos?.classList.add("oculto");
  menuCambio?.classList.add("oculto");
  menuBolsa?.classList.add("oculto");
}

// ---------- FIN DE COMBATE ----------
async function finalizarCombate(ganador) {
  if (window.combateFinalizado) return;
  window.combateFinalizado = true;
  ocultarMenus();

  if (combateListener) { off(combateListener); combateListener = null; }

  const esVictoria = ganador === miNombre;
  const perdedor   = esVictoria ? rivalNombreGlobal : miNombre;
  mostrarPantallaFin(esVictoria, ganador);

  try {
    await update(ref(db, `partidas/${partidaId}`), {
      estado: "finalizado", ganador, perdedor, fechaFin: Date.now()
    });
    const statsRef  = ref(db, `estadisticas/${miNombre}`);
    const statsSnap = await get(statsRef);
    const stats     = statsSnap.val() || { victorias: 0, derrotas: 0, batallas: 0 };
    await set(statsRef, {
      victorias:     stats.victorias + (esVictoria ? 1 : 0),
      derrotas:      stats.derrotas  + (esVictoria ? 0 : 1),
      batallas:      (stats.batallas || 0) + 1,
      ultimaBatalla: Date.now()
    });
  } catch (err) { console.error("[FIN] Error guardando resultado:", err); }
}

function mostrarPantallaFin(esVictoria, ganador) {
  let overlay = document.getElementById("fin-overlay");
  if (!overlay) { overlay = document.createElement("div"); overlay.id = "fin-overlay"; document.body.appendChild(overlay); }

  overlay.innerHTML = `
    <div class="fin-contenido">
      <h1 class="fin-titulo ${esVictoria ? "victoria" : "derrota"}">${esVictoria ? "VICTORIA" : "DERROTA"}</h1>
      <p class="fin-mensaje">${esVictoria ? "¡Felicidades! Has derrotado a " + rivalNombreGlobal : ganador + " te ha derrotado"}</p>
      <div class="fin-stats" id="fin-stats-contenido"><p>Cargando estadísticas...</p></div>
      <div>
        <button class="fin-boton" id="fin-volver-menu">VOLVER AL MENÚ</button>
        <button class="fin-boton secondary" id="fin-ver-estadisticas">VER ESTADÍSTICAS</button>
      </div>
    </div>`;

  document.getElementById("fin-volver-menu")?.addEventListener("click", () => {
    window.location.href = "Juego-Lobby.html?id=" + partidaId;
  });
  document.getElementById("fin-ver-estadisticas")?.addEventListener("click", () => {
    window.location.href = "Estadisticas.html";
  });

  get(ref(db, `estadisticas/${miNombre}`)).then((snap) => {
    const s = snap.val() || { victorias: 0, derrotas: 0, batallas: 0 };
    const c = document.getElementById("fin-stats-contenido");
    if (c) c.innerHTML = `<p>Victorias: ${s.victorias}</p><p>Derrotas: ${s.derrotas}</p><p>Batallas totales: ${s.batallas}</p>`;
  }).catch(() => {
    const c = document.getElementById("fin-stats-contenido");
    if (c) c.innerHTML = "<p>No se pudieron cargar las estadísticas.</p>";
  });
}

// ---------- ANIMACIONES ----------
const ANIMACIONES_MOVIMIENTO = {
  physical: {
    normal:   { tipo: "golpe",           color: "#FFFFFF" },
    fighting: { tipo: "golpe",           color: "#FF8000" },
    fire:     { tipo: "fuego",           color: "#F08030" },
    water:    { tipo: "agua",            color: "#6890F0" },
    electric: { tipo: "rayo",            color: "#F8D030" },
    grass:    { tipo: "planta",          color: "#78C850" },
    ice:      { tipo: "hielo",           color: "#98D8D8" },
    psychic:  { tipo: "psiquico",        color: "#F85888" },
    dragon:   { tipo: "dragon",          color: "#7038F8" }
  },
  special: {
    fire:     { tipo: "fuego_especial",  color: "#F08030" },
    water:    { tipo: "agua_especial",   color: "#6890F0" },
    electric: { tipo: "rayo_especial",   color: "#F8D030" },
    grass:    { tipo: "planta_especial", color: "#78C850" },
    ice:      { tipo: "hielo_especial",  color: "#98D8D8" },
    psychic:  { tipo: "psiquico_especial",color: "#F85888" },
    dragon:   { tipo: "dragon_especial", color: "#7038F8" }
  }
};

class AnimacionBatalla {
  constructor() {
    this.overlay     = null;
    this.efectoDiv   = null;
    this.textoDiv    = null;
    this.damagePopup = null;
    this.animando    = false;
    this.crearElementos();
  }

  crearElementos() {
    if (!document.getElementById("animacion-overlay")) {
      const overlay   = document.createElement("div");
      overlay.id      = "animacion-overlay";
      overlay.className = "oculto";
      overlay.innerHTML = '<div class="efecto-visual"></div><div class="texto-animacion"></div>';
      document.body.appendChild(overlay);
    }
    if (!document.getElementById("animacion-damage")) {
      const damageDiv   = document.createElement("div");
      damageDiv.id      = "animacion-damage";
      damageDiv.className = "oculto";
      damageDiv.innerHTML = '<div class="damage-number"></div>';
      document.body.appendChild(damageDiv);
    }
    this.overlay     = document.getElementById("animacion-overlay");
    this.efectoDiv   = document.querySelector(".efecto-visual");
    this.textoDiv    = document.querySelector(".texto-animacion");
    this.damagePopup = document.getElementById("animacion-damage");
  }

  async reproducirAtaque(movimiento, esEspecial = false) {
    if (this.animando) return;
    this.animando = true;
    const tipo      = movimiento.tipo;
    const clase     = esEspecial ? "special" : "physical";
    const animConfig= ANIMACIONES_MOVIMIENTO[clase]?.[tipo] || ANIMACIONES_MOVIMIENTO.physical.normal;

    this.overlay?.classList.remove("oculto");
    if (this.efectoDiv) this.efectoDiv.className = "efecto-visual " + animConfig.tipo;
    if (this.textoDiv)  { this.textoDiv.textContent = movimiento.nombre.toUpperCase(); this.textoDiv.style.color = animConfig.color; }

    await new Promise(r => setTimeout(r, 600));
    this.overlay?.classList.add("oculto");
    this.animando = false;
  }

  async mostrarDano(damage, esCritico = false, posX, posY) {
    if (!this.damagePopup) return;
    const span = this.damagePopup.querySelector(".damage-number");
    if (span) span.textContent = "-" + damage;
    this.damagePopup.classList.remove("oculto");
    this.damagePopup.classList.toggle("critico", esCritico);
    this.damagePopup.style.left = posX + "px";
    this.damagePopup.style.top  = posY + "px";
    await new Promise(r => setTimeout(r, 800));
    this.damagePopup.classList.add("oculto");
  }

  async sacudirPokemon(elemento) {
    if (!elemento) return;
    elemento.classList.add("shaking");
    await new Promise(r => setTimeout(r, 300));
    elemento.classList.remove("shaking");
  }

  async flashDamage(elemento) {
    if (!elemento) return;
    elemento.classList.add("flash-damage");
    await new Promise(r => setTimeout(r, 200));
    elemento.classList.remove("flash-damage");
  }
}

const animaciones = new AnimacionBatalla();

// ---------- INICIO ----------
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", iniciarCombate);
} else {
  iniciarCombate();
}