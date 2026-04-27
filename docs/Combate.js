import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import { mostrarLoading, ocultarLoading } from "./LoadingScreen.js";
import {
  getDatabase,
  ref,
  set,
  get,
  update,
  runTransaction,
  onValue,
  off,
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-database.js";

// ─────────────────────────────────────────────
//  CONFIGURACIÓN FIREBASE
// ─────────────────────────────────────────────
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

// ─────────────────────────────────────────────
//  CONTEXTO DE SESIÓN
// ─────────────────────────────────────────────
const params = new URLSearchParams(window.location.search);
const partidaId = params.get("id");
const miNombre = localStorage.getItem("nombreJugador");
const esHost = localStorage.getItem("esHost") === "true";

// ─────────────────────────────────────────────
//  TABLA DE EFECTIVIDAD DE TIPOS
// ─────────────────────────────────────────────
const TIPO_CHART = {
  normal: { rock: 0.5, steel: 0.5, ghost: 0 },
  fire: {
    fire: 0.5,
    water: 0.5,
    rock: 0.5,
    dragon: 0.5,
    grass: 2,
    ice: 2,
    bug: 2,
    steel: 2,
  },
  water: { water: 0.5, grass: 0.5, dragon: 0.5, fire: 2, ground: 2, rock: 2 },
  electric: {
    electric: 0.5,
    grass: 0.5,
    dragon: 0.5,
    ground: 0,
    water: 2,
    flying: 2,
  },
  grass: {
    fire: 0.5,
    grass: 0.5,
    poison: 0.5,
    flying: 0.5,
    bug: 0.5,
    dragon: 0.5,
    steel: 0.5,
    water: 2,
    ground: 2,
    rock: 2,
  },
  ice: {
    fire: 0.5,
    water: 0.5,
    ice: 0.5,
    steel: 0.5,
    grass: 2,
    ground: 2,
    flying: 2,
    dragon: 2,
  },
  fighting: {
    poison: 0.5,
    flying: 0.5,
    psychic: 0.5,
    bug: 0.5,
    fairy: 0.5,
    normal: 2,
    ice: 2,
    rock: 2,
    dark: 2,
    steel: 2,
  },
  poison: {
    poison: 0.5,
    ground: 0.5,
    rock: 0.5,
    ghost: 0.5,
    steel: 0,
    grass: 2,
    fairy: 2,
  },
  ground: {
    grass: 0.5,
    bug: 0.5,
    electric: 0,
    fire: 2,
    poison: 2,
    rock: 2,
    steel: 2,
  },
  flying: {
    electric: 0.5,
    rock: 0.5,
    steel: 0.5,
    grass: 2,
    fighting: 2,
    bug: 2,
  },
  psychic: { psychic: 0.5, steel: 0.5, dark: 0, fighting: 2, poison: 2 },
  bug: {
    fire: 0.5,
    fighting: 0.5,
    poison: 0.5,
    flying: 0.5,
    ghost: 0.5,
    steel: 0.5,
    fairy: 0.5,
    grass: 2,
    psychic: 2,
    dark: 2,
  },
  rock: {
    fighting: 0.5,
    ground: 0.5,
    steel: 0.5,
    fire: 2,
    ice: 2,
    flying: 2,
    bug: 2,
  },
  ghost: { normal: 0, dark: 0.5, psychic: 2, ghost: 2 },
  dragon: { steel: 0.5, fairy: 0, dragon: 2 },
  dark: {
    fighting: 0.5,
    dark: 0.5,
    fairy: 0.5,
    psychic: 2,
    ghost: 2,
    steel: 0.5,
  },
  steel: {
    fire: 0.5,
    water: 0.5,
    electric: 0.5,
    steel: 0.5,
    ice: 2,
    rock: 2,
    fairy: 2,
  },
  fairy: {
    fire: 0.5,
    poison: 0.5,
    steel: 0.5,
    fighting: 2,
    dragon: 2,
    dark: 2,
  },
};

const SPRITE_BASE = {
  front: "https://play.pokemonshowdown.com/sprites/ani/",
  back: "https://play.pokemonshowdown.com/sprites/ani-back/",
};

// ─────────────────────────────────────────────
//  ESTADO LOCAL (solo UI/caché, nunca fuente de verdad para daño)
// ─────────────────────────────────────────────
let estadoCombate = null; // snapshot más reciente de Firebase
let miEquipo = []; // datos estáticos del equipo propio (niveles, movimientos, tipos...)
let equipoRival = []; // ídem rival
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

// Referencias DOM (se asignan en iniciarCombate)
let logTxt, menuPrincipal, menuMovimientos, menuCambio, menuBolsa;
let btnLuchar, btnPokemon, btnBolsa, btnCerrarBolsa;

// ─────────────────────────────────────────────
//  HELPERS GENERALES
// ─────────────────────────────────────────────
function log(msg) {
  if (logTxt) logTxt.textContent = msg;
  console.log("[COMBATE]", msg);
}

function cachePokemon(key, value) {
  if (pokemonCache.size >= CACHE_MAX) {
    pokemonCache.delete(pokemonCache.keys().next().value);
  }
  pokemonCache.set(key, structuredClone(value));
}

function calcularEstadisticasReales(baseStats, nivel) {
  return {
    hp: Math.floor(((2 * baseStats.hp + 31) * nivel) / 100 + nivel + 10),
    atk: Math.floor(((2 * baseStats.atk + 31) * nivel) / 100 + 5),
    def: Math.floor(((2 * baseStats.def + 31) * nivel) / 100 + 5),
    spAtk: Math.floor(((2 * baseStats.spAtk + 31) * nivel) / 100 + 5),
    spDef: Math.floor(((2 * baseStats.spDef + 31) * nivel) / 100 + 5),
    spd: Math.floor(((2 * baseStats.spd + 31) * nivel) / 100 + 5),
  };
}

function crearMovimientoPorDefecto(nombre = "Ataque Rapido") {
  return {
    nombre: nombre.replace(/-/g, " "),
    tipo: "normal",
    poder: 40,
    pp: 30,
    ppMax: 30,
    clase: "physical",
    precision: 100,
    efecto: "",
    efectoEstado: null,
  };
}

function crearPokemonPorDefecto(nombre) {
  return {
    nombre: nombre || "Pokemon",
    nombreOriginal: (nombre || "pokemon").toLowerCase(),
    hpMax: 50,
    stats: { hp: 50, atk: 50, def: 50, spAtk: 50, spDef: 50, spd: 50 },
    nivel: 50,
    movimientos: Array(4)
      .fill(null)
      .map(() => crearMovimientoPorDefecto()),
    tipos: ["normal"],
    shiny: false,
    objeto: null,
    objetoUsado: false,
  };
}

function extraerEfectoEstado(moveData) {
  const efecto =
    moveData.effect_entries?.find((e) => e.language.name === "en")?.effect ||
    "";
  const map = {
    paralyze: "PARALIZIS",
    sleep: "DORMIDO",
    burn: "QUEMADO",
    freeze: "CONGELADO",
    "badly poison": "VENENO_GRAVE",
    poison: "VENENO",
  };
  // "badly poison" debe ir antes que "poison"
  for (const [key, value] of Object.entries(map)) {
    if (efecto.toLowerCase().includes(key)) return value;
  }
  return null;
}

// ─────────────────────────────────────────────
//  CARGA DE EQUIPOS
//  IMPORTANTE: esta función solo provee datos ESTÁTICOS
//  (stats base, movimientos, tipos). Los HP y PP en
//  combate viven ÚNICAMENTE en Firebase.
// ─────────────────────────────────────────────
async function cargarEquipo(listaEquipo, nombreJugador) {
  if (!listaEquipo || listaEquipo.length === 0) return [];

  return Promise.all(
    listaEquipo.map(async (entry) => {
      const nombreBase = String(
        entry.nombre || (typeof entry === "string" ? entry : entry.id) || "",
      ).trim();
      if (!nombreBase || nombreBase === "undefined")
        return crearPokemonPorDefecto("Unknown");

      // ── Obtener configuración guardada ──
      let cfg = {};
      if (nombreJugador === miNombre) {
        cfg =
          JSON.parse(localStorage.getItem(`configuracion-${nombreBase}`)) || {};
      } else {
        try {
          const snap = await get(
            ref(
              db,
              `partidas/${partidaId}/configuraciones/${nombreJugador}/${nombreBase}`,
            ),
          );
          cfg = snap.val() || {};
        } catch {
          /* silencioso */
        }
      }

      const nivel = parseInt(cfg.nivel) || 50;
      const apodo = cfg.apodo || nombreBase;
      const esShiny = cfg.shiny || false;
      const movimientosGuardados = cfg.movimientos || [];
      const objetoGuardado = cfg.objeto || null;
      const cacheKey = `${nombreBase}-${nivel}`;

      if (pokemonCache.has(cacheKey))
        return structuredClone(pokemonCache.get(cacheKey));

      // ── Fetch a PokeAPI ──
      try {
        const ctrl = new AbortController();
        const timeout = setTimeout(() => ctrl.abort(), 8000);
        const res = await fetch(
          `https://pokeapi.co/api/v2/pokemon/${nombreBase.toLowerCase()}`,
          { signal: ctrl.signal },
        );
        clearTimeout(timeout);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);

        const data = await res.json();

        const baseStats = {
          hp: data.stats.find((s) => s.stat.name === "hp")?.base_stat || 50,
          atk:
            data.stats.find((s) => s.stat.name === "attack")?.base_stat || 50,
          def:
            data.stats.find((s) => s.stat.name === "defense")?.base_stat || 50,
          spAtk:
            data.stats.find((s) => s.stat.name === "special-attack")
              ?.base_stat || 50,
          spDef:
            data.stats.find((s) => s.stat.name === "special-defense")
              ?.base_stat || 50,
          spd: data.stats.find((s) => s.stat.name === "speed")?.base_stat || 50,
        };
        const statsReales = calcularEstadisticasReales(baseStats, nivel);

        // ── Cargar movimientos ──
        let movimientos = [];
        const movNombres = movimientosGuardados.filter(Boolean).slice(0, 4);

        if (movNombres.length > 0) {
          // Movimientos configurados por el jugador
          movimientos = await Promise.all(
            movNombres.map(async (nombre) => {
              try {
                const r = await fetch(
                  `https://pokeapi.co/api/v2/move/${nombre.toLowerCase()}`,
                );
                if (!r.ok) throw new Error();
                const d = await r.json();
                return {
                  nombre: d.name.replace(/-/g, " "),
                  tipo: d.type?.name || "normal",
                  poder: d.power || 0,
                  pp: d.pp || 20,
                  ppMax: d.pp || 20,
                  clase: d.damage_class?.name || "physical",
                  precision: d.accuracy || 100,
                  efecto:
                    d.effect_entries?.find((e) => e.language.name === "en")
                      ?.effect || "",
                  efectoEstado: extraerEfectoEstado(d),
                };
              } catch {
                return crearMovimientoPorDefecto(nombre);
              }
            }),
          );
        } else {
          // Primeros 4 movimientos nativos del Pokémon
          const movUrls = (data.moves || []).slice(0, 4).map((m) => m.move.url);
          movimientos = await Promise.all(
            movUrls.map(async (url) => {
              try {
                const c2 = new AbortController();
                const t2 = setTimeout(() => c2.abort(), 4000);
                const r = await fetch(url, { signal: c2.signal });
                clearTimeout(t2);
                if (!r.ok) throw new Error();
                const d = await r.json();
                return {
                  nombre: d.name.replace(/-/g, " "),
                  tipo: d.type?.name || "normal",
                  poder: d.power || 0,
                  pp: d.pp || 20,
                  ppMax: d.pp || 20,
                  clase: d.damage_class?.name || "physical",
                  precision: d.accuracy || 100,
                  efecto:
                    d.effect_entries?.find((e) => e.language.name === "en")
                      ?.effect || "",
                  efectoEstado: extraerEfectoEstado(d),
                };
              } catch {
                return crearMovimientoPorDefecto();
              }
            }),
          );
        }

        // Rellenar hasta 4 movimientos
        while (movimientos.length < 4)
          movimientos.push(crearMovimientoPorDefecto());

        const pokemonData = {
          nombre: apodo,
          nombreOriginal: data.name,
          hpMax: statsReales.hp,
          stats: statsReales,
          nivel,
          movimientos: movimientos.slice(0, 4),
          tipos: data.types?.map((t) => t.type.name) || ["normal"],
          shiny: esShiny,
          objeto: objetoGuardado
            ? { id: objetoGuardado, nombre: objetoGuardado }
            : null,
          objetoUsado: false,
        };

        cachePokemon(cacheKey, pokemonData);
        return structuredClone(pokemonData);
      } catch (err) {
        console.error("[CARGAR EQUIPO]", nombreBase, err.message);
        return crearPokemonPorDefecto(apodo);
      }
    }),
  );
}

// ─────────────────────────────────────────────
//  INICIALIZAR COMBATE EN FIREBASE (solo host)
// ─────────────────────────────────────────────
function calcularQuienEmpieza() {
  const miVel = miEquipo[0]?.stats.spd || 0;
  const rivalVel = equipoRival[0]?.stats.spd || 0;
  if (miVel === rivalVel)
    return Math.random() < 0.5 ? miNombre : rivalNombreGlobal;
  return miVel > rivalVel ? miNombre : rivalNombreGlobal;
}

async function inicializarCombateEnFirebase() {
  const turnoInicial = calcularQuienEmpieza();

  // ── PP iniciales: se guardan en Firebase como fuente de verdad ──
  // Se usa ppMax de cada movimiento de AMBOS equipos
  const ppMios = miEquipo.map((p) => p.movimientos.map((m) => m.ppMax));
  const ppRivales = equipoRival.map((p) => p.movimientos.map((m) => m.ppMax));

  await set(ref(db, `partidas/${partidaId}/combate`), {
    turno: turnoInicial,
    fase: "elegir",
    indexActivo: { [miNombre]: 0, [rivalNombreGlobal]: 0 },
    hp: {
      [miNombre]: miEquipo.map((p) => p.hpMax),
      [rivalNombreGlobal]: equipoRival.map((p) => p.hpMax),
    },
    pp: {
      [miNombre]: ppMios,
      [rivalNombreGlobal]: ppRivales,
    },
    estados: {
      [miNombre]: miEquipo.map(() => ({
        nombre: null,
        turnosRestantes: 0,
        acumulador: 0,
      })),
      [rivalNombreGlobal]: equipoRival.map(() => ({
        nombre: null,
        turnosRestantes: 0,
        acumulador: 0,
      })),
    },
    estadisticas: {
      [miNombre]: miEquipo.map(() => ({
        atk: 0,
        def: 0,
        spAtk: 0,
        spDef: 0,
        spd: 0,
        evasion: 0,
        precision: 0,
      })),
      [rivalNombreGlobal]: equipoRival.map(() => ({
        atk: 0,
        def: 0,
        spAtk: 0,
        spDef: 0,
        spd: 0,
        evasion: 0,
        precision: 0,
      })),
    },
    // ── MOVIMIENTOS SERIALIZADOS EN FIREBASE ──
    // Así el host puede resolver correctamente sin depender de variables locales
    movimientos: {
      [miNombre]: miEquipo.map((p) => p.movimientos),
      [rivalNombreGlobal]: equipoRival.map((p) => p.movimientos),
    },
    // Datos necesarios para cálculo de daño (stats, tipos, hpMax)
    pokemonData: {
      [miNombre]: miEquipo.map((p) => ({
        nombre: p.nombre,
        nombreOriginal: p.nombreOriginal,
        hpMax: p.hpMax,
        stats: p.stats,
        tipos: p.tipos,
        nivel: p.nivel,
      })),
      [rivalNombreGlobal]: equipoRival.map((p) => ({
        nombre: p.nombre,
        nombreOriginal: p.nombreOriginal,
        hpMax: p.hpMax,
        stats: p.stats,
        tipos: p.tipos,
        nivel: p.nivel,
      })),
    },
    accion: null,
    log: "¡El combate ha comenzado!",
    clima: null,
    turnoClima: 0,
    campo: { reflejo: null, muroLuz: null, velocidad: null },
    objetosUsados: { [miNombre]: [], [rivalNombreGlobal]: [] },
  });
}

// ─────────────────────────────────────────────
//  INICIO
// ─────────────────────────────────────────────
async function iniciarCombate() {
  // Bind DOM
  logTxt = document.getElementById("log-texto");
  menuPrincipal = document.getElementById("menu-principal");
  menuMovimientos = document.getElementById("menu-movimientos");
  menuCambio = document.getElementById("menu-cambio");
  menuBolsa = document.getElementById("menu-bolsa");
  btnLuchar = document.getElementById("btn-luchar");
  btnPokemon = document.getElementById("btn-pokemon");
  btnBolsa = document.getElementById("btn-bolsa");
  btnCerrarBolsa = document.getElementById("btn-cerrar-bolsa");

  if (!menuPrincipal || !menuMovimientos) {
    console.error("[INIT] Faltan elementos DOM");
    return;
  }

  // Eventos de botones principales
  btnLuchar?.addEventListener("click", () => {
    if (!esMiTurno || esperandoCambio || animacionEnProceso) return;
    menuPrincipal.classList.add("oculto");
    menuMovimientos.classList.remove("oculto");
    const ppActuales = estadoCombate?.pp?.[miNombre]?.[miIndexActivo] || [];
    cargarMovimientos(miEquipo[miIndexActivo], ppActuales);
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
    log("Error: sesión inválida.");
    await ocultarLoading();
    return;
  }

  try {
    const snap = await get(ref(db, `partidas/${partidaId}`));
    const data = snap.val();
    if (!data?.jugadores) throw new Error("Partida no encontrada");

    const jugadores = Object.keys(data.jugadores);
    rivalNombreGlobal = jugadores.find((n) => n !== miNombre);
    if (!rivalNombreGlobal) throw new Error("Rival no encontrado");

    const equipoMiData = data.jugadores[miNombre]?.equipo;
    const equipoRivalData = data.jugadores[rivalNombreGlobal]?.equipo;
    if (!equipoMiData || !equipoRivalData)
      throw new Error("Equipos no encontrados");

    log("Cargando equipos...");
    [miEquipo, equipoRival] = await Promise.all([
      cargarEquipo(equipoMiData, miNombre),
      cargarEquipo(equipoRivalData, rivalNombreGlobal),
    ]);

    if (!miEquipo.length || !equipoRival.length)
      throw new Error("No se pudieron cargar los equipos");

    // ── Inicializar o esperar inicio ──
    const combateRef = ref(db, `partidas/${partidaId}/combate`);
    const combateSnap = await get(combateRef);

    if (!combateSnap.exists() && esHost) {
      log("Inicializando combate...");
      await inicializarCombateEnFirebase();
    }

    if (!combateSnap.exists() && !esHost) {
      log("Esperando al host...");
      let ok = false;
      for (let i = 0; i < 40 && !ok; i++) {
        await new Promise((r) => setTimeout(r, 500));
        const check = await get(combateRef);
        if (check.exists()) ok = true;
      }
      if (!ok) throw new Error("Timeout esperando al host");
    }

    // ── Listener principal ──
    if (combateListener) off(combateListener);
    combateListener = onValue(combateRef, (snapshot) => {
      const nuevoEstado = snapshot.val();
      if (nuevoEstado) {
        estadoCombate = nuevoEstado;
        renderEstado(nuevoEstado);
      }
    });

    await ocultarLoading();
  } catch (err) {
    console.error("[INIT ERROR]", err);
    log("Error: " + err.message);
    await ocultarLoading();
  }
}

// ─────────────────────────────────────────────
//  RENDER ESTADO
// ─────────────────────────────────────────────
function renderEstado(estado) {
  if (!estado?.indexActivo || !estado?.hp || !estado?.pp || !estado?.estados)
    return;

  esMiTurno = estado.turno === miNombre;
  miIndexActivo = estado.indexActivo[miNombre] ?? 0;
  rivalIndexActivo = estado.indexActivo[rivalNombreGlobal] ?? 0;

  const miPoke = miEquipo[miIndexActivo];
  const rivalPoke = equipoRival[rivalIndexActivo];
  if (!miPoke || !rivalPoke) return;

  const miHP = estado.hp[miNombre]?.[miIndexActivo];
  const rivalHP = estado.hp[rivalNombreGlobal]?.[rivalIndexActivo];
  if (miHP === undefined || rivalHP === undefined) return;

  const miEstadoPoke = estado.estados[miNombre]?.[miIndexActivo] || {
    nombre: null,
  };
  const rivalEstadoPoke = estado.estados[rivalNombreGlobal]?.[
    rivalIndexActivo
  ] || { nombre: null };

  // UI
  actualizarCampoPorTipo(miPoke.tipos);
  if (estado.clima) aplicarClima(estado.clima);

  actualizarSprite("jugador-sprite", miPoke, "back");
  actualizarSprite("enemigo-sprite", rivalPoke, "front");
  actualizarInfobar("jugador", miPoke, miHP, miEstadoPoke);
  actualizarInfobar("enemigo", rivalPoke, rivalHP, rivalEstadoPoke);

  // Marcar objetos usados
  const objetosUsados = estado.objetosUsados?.[miNombre] || [];
  miEquipo.forEach((p, i) => {
    p.objetoUsado = objetosUsados.includes(i);
  });

  actualizarPokeballs(
    "jugador",
    estado.hp[miNombre],
    miEquipo,
    estado.estados[miNombre],
    miIndexActivo,
  );
  actualizarPokeballs(
    "enemigo",
    estado.hp[rivalNombreGlobal],
    equipoRival,
    estado.estados[rivalNombreGlobal],
    rivalIndexActivo,
  );

  if (estado.log && estado.log !== ultimoLog) {
    log(estado.log);
    ultimoLog = estado.log;
  }

  // ── Flujo de fases ──
  if (estado.fase === "fin") {
    console.log(
      "Render estado: fase fin, llamando finalizarCombate con ganador:",
      estado.ganador,
    );
    finalizarCombate(estado.ganador);
    return;
  }

  if (estado.fase === "resolver" && esHost && !animacionEnProceso) {
    resolverAtaque(estado);
    return;
  }

  if (
    estado.fase === "cambio" &&
    estado.turno === miNombre &&
    !esperandoCambio
  ) {
    cambioForzado = true;
    mostrarSelectorPokemon();
    return;
  }

  if (esMiTurno && estado.fase === "elegir" && !esperandoCambio) {
    mostrarMenuPrincipal();
    const ppActuales = estado.pp?.[miNombre]?.[miIndexActivo] || [];
    cargarMovimientos(miPoke, ppActuales);
  } else {
    ocultarMenus();
    if (!esMiTurno && estado.fase === "elegir") log("Esperando al rival...");
  }
}

// ─────────────────────────────────────────────
//  ACTUALIZAR UI
// ─────────────────────────────────────────────
function actualizarCampoPorTipo(tipos) {
  const campo = document.querySelector(".combate-campo");
  if (!campo) return;
  const map = {
    fire: "fuego",
    water: "agua",
    grass: "planta",
    electric: "electrico",
    rock: "roca",
    ground: "tierra",
    ice: "hielo",
    psychic: "psiquico",
    ghost: "fantasma",
    dark: "siniestro",
    dragon: "dragon",
    fairy: "hada",
    steel: "acero",
    flying: "volador",
    poison: "veneno",
    bug: "bicho",
    fighting: "lucha",
    normal: "estandar",
  };
  campo.classList.remove(...Object.values(map));
  campo.classList.add(map[tipos[0]] || "estandar");
}

function aplicarClima(tipoClima) {
  const campo = document.querySelector(".combate-campo");
  if (!campo) return;
  campo.classList.remove("lluvia", "sol", "tormenta-arena", "granizo");
  if (tipoClima) campo.classList.add(tipoClima);
}

function actualizarSprite(id, pokemon, lado) {
  const img = document.getElementById(id);
  if (!img) return;
  const nombreSprite = (pokemon.nombreOriginal || pokemon.nombre)
    .toLowerCase()
    .replace(/\s/g, "-");
  img.src = `${SPRITE_BASE[lado]}${nombreSprite}.gif`;
  img.alt = pokemon.nombre;
  img.onerror = () => {
    img.src = `${SPRITE_BASE[lado]}placeholder.png`;
  };
}

function actualizarInfobar(lado, pokemon, hpActual, estadoPoke) {
  const pct = Math.max(0, Math.min(100, (hpActual / pokemon.hpMax) * 100));
  const fill = document.getElementById(`${lado}-hp-fill`);
  if (fill) {
    fill.style.width = pct + "%";
    fill.className =
      "combate-hpbar-fill" + (pct > 50 ? "" : pct > 20 ? " hp-mid" : " hp-low");
  }
  const nomEl = document.getElementById(`${lado}-nombre`);
  if (nomEl)
    nomEl.textContent =
      pokemon.nombre.toUpperCase() +
      (estadoPoke?.nombre ? ` [${estadoPoke.nombre}]` : "");
  const hpNum = document.getElementById(`${lado}-hp-actual`);
  const hpMax = document.getElementById(`${lado}-hp-max`);
  if (hpNum) hpNum.textContent = Math.max(0, hpActual);
  if (hpMax) hpMax.textContent = pokemon.hpMax;
}

function actualizarPokeballs(
  prefijo,
  hpArray,
  equipo,
  estadosArray,
  indexActivo,
) {
  equipo.forEach((_, i) => {
    const id = `${prefijo === "jugador" ? "jg" : "en"}-${i}`;
    const ball = document.getElementById(id);
    if (!ball) return;
    ball.classList.toggle("debil", (hpArray?.[i] ?? 0) <= 0);
    ball.classList.toggle("activo", i === indexActivo);
    ball.classList.toggle("estado", !!estadosArray?.[i]?.nombre);
    ball.title = estadosArray?.[i]?.nombre || "";
  });
}

// ─────────────────────────────────────────────
//  RESOLVER ATAQUE (solo host)
//
//  ⚠️  LÓGICA CLAVE:
//  Los datos de movimientos y pokémon se leen desde
//  el estado de Firebase (estado.movimientos / estado.pokemonData),
//  NO desde las variables locales miEquipo / equipoRival.
//  Esto garantiza que ambos clientes calculen exactamente
//  lo mismo con los mismos datos.
// ─────────────────────────────────────────────
async function resolverAtaque(estado) {
  if (animacionEnProceso) return;
  animacionEnProceso = true;

  const accion = estado.accion;
  if (!accion) {
    animacionEnProceso = false;
    return;
  }

  const atacante = accion.jugador;
  const defensor = atacante === miNombre ? rivalNombreGlobal : miNombre;
  const indexAtacante = estado.indexActivo[atacante];
  const indexDefensor = estado.indexActivo[defensor];

  // ── Leer datos de pokémon desde Firebase (fuente de verdad) ──
  const pokDataAtac = estado.pokemonData?.[atacante]?.[indexAtacante];
  const pokDataDef = estado.pokemonData?.[defensor]?.[indexDefensor];
  // Fallback a variables locales si no hay pokemonData (compatibilidad)
  const pokeAtacante =
    pokDataAtac ||
    (atacante === miNombre
      ? miEquipo[indexAtacante]
      : equipoRival[indexAtacante]);
  const pokeDefensor =
    pokDataDef ||
    (defensor === miNombre
      ? miEquipo[indexDefensor]
      : equipoRival[indexDefensor]);

  if (!pokeAtacante || !pokeDefensor) {
    console.error("[RESOLVER] No se encontraron datos de pokémon");
    animacionEnProceso = false;
    return;
  }

  // ── Leer movimiento desde Firebase ──
  const movimientosAtacante = estado.movimientos?.[atacante]?.[indexAtacante];
  const movimiento = movimientosAtacante?.[accion.movIndex];
  if (!movimiento) {
    console.error("[RESOLVER] Movimiento no encontrado en Firebase", accion);
    animacionEnProceso = false;
    return;
  }

  // ── Animación visual ──
  const spriteAtacanteEl = document.getElementById(
    atacante === miNombre ? "jugador-sprite" : "enemigo-sprite",
  )?.parentElement;
  const spriteDefensorEl = document.getElementById(
    atacante === miNombre ? "enemigo-sprite" : "jugador-sprite",
  )?.parentElement;

  try {
    await animaciones.reproducirAtaque(
      movimiento,
      movimiento.clase === "special",
    );
    await animaciones.sacudirPokemon(spriteAtacanteEl);

    const combateRef = ref(db, `partidas/${partidaId}/combate`);

    // ── Transacción: toda la lógica de daño ocurre aquí, con datos de Firebase ──
    const resultado = await runTransaction(combateRef, (est) => {
      if (!est) return est;
      if (est.fase !== "resolver") return est;
      if (!est.accion) return est;
      if (est.accion.jugador !== atacante) return est;

      // ── Leer datos frescos del estado transaccional ──
      const movFB =
        est.movimientos?.[atacante]?.[indexAtacante]?.[accion.movIndex];
      const pokAtacFB =
        est.pokemonData?.[atacante]?.[indexAtacante] || pokeAtacante;
      const pokDefFB =
        est.pokemonData?.[defensor]?.[indexDefensor] || pokeDefensor;

      if (!movFB) return est; // Movimiento inválido, abortar

      let nuevosHP = structuredClone(est.hp);
      let nuevosPP = structuredClone(est.pp);
      let nuevosEstados = structuredClone(est.estados);
      let nuevosStats = structuredClone(est.estadisticas);

      // ── Descontar PP ──
      const ppActual = nuevosPP[atacante]?.[indexAtacante]?.[accion.movIndex];
      if (ppActual !== undefined && ppActual > 0) {
        nuevosPP[atacante][indexAtacante][accion.movIndex] = ppActual - 1;
      }

      // ── Verificar si puede actuar (estados alterados) ──
      const { puedeActuar, nuevosEstadosPost } = verificarEstadoPreAccion(
        nuevosEstados,
        atacante,
        indexAtacante,
      );
      nuevosEstados = nuevosEstadosPost;

      if (!puedeActuar) {
        return {
          ...est,
          hp: nuevosHP,
          pp: nuevosPP,
          estados: nuevosEstados,
          estadisticas: nuevosStats,
          turno: defensor,
          fase: "elegir",
          log: `¡${pokAtacFB.nombre} no puede moverse!`,
          accion: null,
        };
      }

      // ── Verificar precisión ──
      const precMod = obtenerModificadorPrecision(
        nuevosStats,
        atacante,
        indexAtacante,
        defensor,
        indexDefensor,
      );
      if (movFB.precision !== null && movFB.precision !== undefined) {
        if (Math.random() * 100 >= movFB.precision * precMod) {
          return {
            ...est,
            hp: nuevosHP,
            pp: nuevosPP,
            estados: nuevosEstados,
            estadisticas: nuevosStats,
            turno: defensor,
            fase: "elegir",
            log: `¡${pokAtacFB.nombre} falló el ataque!`,
            accion: null,
          };
        }
      }

      let logMsg = "";
      let danoRealizado = 0;

      if (movFB.clase === "status") {
        // Movimiento de estado
        const r = aplicarMovimientoStatus(
          movFB,
          pokAtacFB,
          pokDefFB,
          nuevosEstados,
          defensor,
          indexDefensor,
        );
        logMsg = r.mensaje;
        nuevosEstados = r.nuevosEstados;
      } else {
        // Movimiento de daño
        const esCritico = Math.random() < 0.0625;
        const r = calcularDano(
          movFB,
          pokAtacFB,
          pokDefFB,
          nuevosStats,
          nuevosEstados,
          atacante,
          defensor,
          indexAtacante,
          indexDefensor,
          est.clima,
          nuevosHP,
          esCritico,
        );
        logMsg = r.logMsg;
        nuevosHP = r.nuevosHP;
        nuevosStats = r.nuevosStatsResult;
        danoRealizado = r.dano;

        // Efecto secundario de estado (30% de probabilidad)
        if (movFB.efectoEstado && danoRealizado > 0 && Math.random() < 0.3) {
          const sr = aplicarEstadoPorMovimiento(
            movFB.efectoEstado,
            pokDefFB,
            nuevosEstados,
            defensor,
            indexDefensor,
          );
          if (sr.mensaje) {
            logMsg += " " + sr.mensaje;
            nuevosEstados = sr.nuevosEstados;
          }
        }
      }

      // ── Daño post-acción (veneno, quemadura, etc.) ──
      const postR = aplicarDanoPostAccion(
        nuevosHP,
        nuevosEstados,
        atacante,
        defensor,
        indexAtacante,
        indexDefensor,
        pokAtacFB,
        pokDefFB,
      );
      nuevosHP = postR.nuevosHPPost;
      nuevosEstados = postR.nuevosEstadosPost2;
      if (postR.mensaje) logMsg += " " + postR.mensaje;

      // ── Verificar debilitados ──
      let nuevaFase = "elegir";
      let nuevoTurno = defensor;

      if (nuevosHP[defensor][indexDefensor] <= 0) {
        console.log(
          "Pokémon defensor debilitado, HP:",
          nuevosHP[defensor][indexDefensor],
          "siguiente:",
          encontrarSiguientePokemon(nuevosHP[defensor]),
        );
        nuevosHP[defensor][indexDefensor] = 0;
        logMsg += ` ¡${pokDefFB.nombre} se debilitó!`;
        if (encontrarSiguientePokemon(nuevosHP[defensor]) === -1) {
          console.log("Combate terminado, ganador:", atacante);
          return {
            ...est,
            hp: nuevosHP,
            pp: nuevosPP,
            estados: nuevosEstados,
            estadisticas: nuevosStats,
            turno: atacante,
            fase: "fin",
            ganador: atacante,
            log: `¡${atacante} ha ganado el combate!`,
            accion: null,
          };
        }
        nuevaFase = "cambio";
        nuevoTurno = defensor;
        logMsg += " Elige tu siguiente Pokémon.";
      }

      if (nuevosHP[atacante][indexAtacante] <= 0) {
        console.log(
          "Pokémon atacante debilitado, HP:",
          nuevosHP[atacante][indexAtacante],
          "siguiente:",
          encontrarSiguientePokemon(nuevosHP[atacante]),
        );
        nuevosHP[atacante][indexAtacante] = 0;
        logMsg += ` ¡${pokAtacFB.nombre} se debilitó!`;
        if (encontrarSiguientePokemon(nuevosHP[atacante]) === -1) {
          console.log("Combate terminado, ganador:", defensor);
          return {
            ...est,
            hp: nuevosHP,
            pp: nuevosPP,
            estados: nuevosEstados,
            estadisticas: nuevosStats,
            turno: defensor,
            fase: "fin",
            ganador: defensor,
            log: `¡${defensor} ha ganado el combate!`,
            accion: null,
          };
        }
        if (nuevaFase !== "cambio") {
          nuevaFase = "cambio";
          nuevoTurno = atacante;
        }
        logMsg += " Elige tu siguiente Pokémon.";
      }

      return {
        ...est,
        hp: nuevosHP,
        pp: nuevosPP,
        estados: nuevosEstados,
        estadisticas: nuevosStats,
        turno: nuevoTurno,
        fase: nuevaFase,
        log: logMsg,
        accion: null,
      };
    });

    // ── Animación de daño recibido ──
    if (resultado.committed) {
      const estadoAnterior = estado;
      const estadoFinal = resultado.snapshot.val();
      const danoFinal = calcularDanoDesdeEstados(
        estadoFinal,
        estadoAnterior,
        defensor,
        indexDefensor,
      );

      if (danoFinal > 0) {
        await animaciones.sacudirPokemon(spriteDefensorEl);
        await animaciones.flashDamage(spriteDefensorEl);
        const rect = spriteDefensorEl?.getBoundingClientRect();
        const posX = rect ? rect.left + rect.width / 2 : window.innerWidth / 2;
        const posY = rect ? rect.top + rect.height / 2 : window.innerHeight / 2;
        await animaciones.mostrarDano(danoFinal, false, posX, posY);
      }
    }
  } catch (err) {
    console.error("[RESOLVER ERROR]", err);
    log("Error al resolver el ataque. Intenta de nuevo.");
  } finally {
    animacionEnProceso = false;
  }
}

function calcularDanoDesdeEstados(estadoFinal, estadoAnterior, jugador, index) {
  const antes = estadoAnterior?.hp?.[jugador]?.[index] ?? 0;
  const despues = estadoFinal?.hp?.[jugador]?.[index] ?? 0;
  return Math.max(0, antes - despues);
}

// ─────────────────────────────────────────────
//  LÓGICA DE COMBATE PURA (usada dentro de runTransaction)
// ─────────────────────────────────────────────
function verificarEstadoPreAccion(estados, jugador, index) {
  const nuevo = structuredClone(estados);
  const e = nuevo[jugador]?.[index];
  if (!e?.nombre) return { puedeActuar: true, nuevosEstadosPost: nuevo };

  switch (e.nombre) {
    case "PARALIZIS":
      return { puedeActuar: Math.random() > 0.25, nuevosEstadosPost: nuevo };

    case "DORMIDO":
      if (e.turnosRestantes <= 0) {
        nuevo[jugador][index] = {
          nombre: null,
          turnosRestantes: 0,
          acumulador: 0,
        };
        return { puedeActuar: true, nuevosEstadosPost: nuevo };
      }
      nuevo[jugador][index].turnosRestantes--;
      return { puedeActuar: false, nuevosEstadosPost: nuevo };

    case "CONGELADO":
      if (Math.random() < 0.2) {
        nuevo[jugador][index] = {
          nombre: null,
          turnosRestantes: 0,
          acumulador: 0,
        };
        return { puedeActuar: true, nuevosEstadosPost: nuevo };
      }
      return { puedeActuar: false, nuevosEstadosPost: nuevo };

    default:
      return { puedeActuar: true, nuevosEstadosPost: nuevo };
  }
}

function obtenerModificadorPrecision(
  estadisticas,
  atacante,
  indexAtac,
  defensor,
  indexDef,
) {
  const sA = estadisticas?.[atacante]?.[indexAtac] || {};
  const sD = estadisticas?.[defensor]?.[indexDef] || {};
  const precMod = Math.max(-6, Math.min(6, sA.precision || 0));
  const evaMod = Math.max(-6, Math.min(6, sD.evasion || 0));
  const precFactor = precMod >= 0 ? (3 + precMod) / 3 : 3 / (3 - precMod);
  const evaFactor = evaMod >= 0 ? (3 + evaMod) / 3 : 3 / (3 - evaMod);
  return precFactor / evaFactor;
}

function calcularDano(
  mov,
  pokAtac,
  pokDef,
  estadisticas,
  estados,
  atacanteN,
  defensorN,
  idxAtac,
  idxDef,
  clima,
  hp,
  esCritico,
) {
  // Stats base
  let atk = mov.clase === "special" ? pokAtac.stats.spAtk : pokAtac.stats.atk;
  let def = mov.clase === "special" ? pokDef.stats.spDef : pokDef.stats.def;

  // Modificadores de estadísticas por etapas
  const sA = estadisticas?.[atacanteN]?.[idxAtac] || {};
  const sD = estadisticas?.[defensorN]?.[idxDef] || {};
  const atkK = mov.clase === "special" ? "spAtk" : "atk";
  const defK = mov.clase === "special" ? "spDef" : "def";
  const atkMod = Math.max(-6, Math.min(6, sA[atkK] || 0));
  const defMod = Math.max(-6, Math.min(6, sD[defK] || 0));

  atk *= atkMod >= 0 ? (2 + atkMod) / 2 : 2 / (2 - atkMod);
  def *= defMod >= 0 ? (2 + defMod) / 2 : 2 / (2 - defMod);

  // Quemadura reduce ataque físico
  if (
    estados?.[atacanteN]?.[idxAtac]?.nombre === "QUEMADO" &&
    mov.clase === "physical"
  )
    atk *= 0.5;

  // STAB
  const stab = pokAtac.tipos?.includes(mov.tipo) ? 1.5 : 1;

  // Efectividad de tipos
  let eff = 1;
  for (const tipo of pokDef.tipos || ["normal"])
    eff *= TIPO_CHART[mov.tipo]?.[tipo] ?? 1;

  // Clima
  let weatherMod = 1;
  if (clima === "lluvia") {
    if (mov.tipo === "water") weatherMod = 1.5;
    if (mov.tipo === "fire") weatherMod = 0.5;
  }
  if (clima === "sol") {
    if (mov.tipo === "fire") weatherMod = 1.5;
    if (mov.tipo === "water") weatherMod = 0.5;
  }

  const critMod = esCritico ? 1.5 : 1;
  const nivel = pokAtac.nivel || 50;
  const random = 0.85 + Math.random() * 0.15;

  let dano = Math.floor(
    ((((2 * nivel) / 5 + 2) * Math.max(1, mov.poder) * atk) /
      Math.max(1, def) /
      50 +
      2) *
      stab *
      eff *
      weatherMod *
      critMod *
      random,
  );

  let logMsg = `${pokAtac.nombre} usó ${mov.nombre}!`;
  if (esCritico) logMsg += " ¡Golpe crítico!";
  if (eff > 1) logMsg += " ¡Es muy eficaz!";
  if (eff < 1 && eff > 0) logMsg += " No es muy eficaz...";
  if (eff === 0) {
    logMsg += " ¡No le afecta!";
    dano = 0;
  }
  if (stab > 1) logMsg += " [STAB]";

  if (dano > 0) {
    logMsg += ` (-${dano} HP)`;
    hp[defensorN][idxDef] = Math.max(0, hp[defensorN][idxDef] - dano);
  }

  return { dano, logMsg, nuevosHP: hp, nuevosStatsResult: estadisticas };
}

function aplicarMovimientoStatus(
  mov,
  pokAtac,
  pokDef,
  estados,
  defensorN,
  idxDef,
) {
  const nuevo = structuredClone(estados);
  const e = nuevo[defensorN]?.[idxDef];
  if (!e) return { mensaje: "Error de estado", nuevosEstados: nuevo };

  if (mov.efectoEstado && !e.nombre) {
    let turnos = 0,
      acum = 0;
    if (mov.efectoEstado === "DORMIDO")
      turnos = Math.floor(Math.random() * 3) + 1;
    if (mov.efectoEstado === "VENENO_GRAVE") acum = 1;
    nuevo[defensorN][idxDef] = {
      nombre: mov.efectoEstado,
      turnosRestantes: turnos,
      acumulador: acum,
    };
    return {
      mensaje: `${pokDef.nombre} quedó ${mov.efectoEstado}!`,
      nuevosEstados: nuevo,
    };
  }
  return {
    mensaje: `${pokAtac.nombre} usó ${mov.nombre}, pero no tuvo efecto.`,
    nuevosEstados: nuevo,
  };
}

function aplicarEstadoPorMovimiento(estado, pokObj, estados, jugador, index) {
  const nuevo = structuredClone(estados);
  if (!nuevo[jugador]?.[index]?.nombre) {
    let turnos = 0,
      acum = 0;
    if (estado === "DORMIDO") turnos = Math.floor(Math.random() * 3) + 1;
    if (estado === "VENENO_GRAVE") acum = 1;
    nuevo[jugador][index] = {
      nombre: estado,
      turnosRestantes: turnos,
      acumulador: acum,
    };
    return {
      mensaje: `${pokObj.nombre} quedó ${estado}!`,
      nuevosEstados: nuevo,
    };
  }
  return { mensaje: "", nuevosEstados: nuevo };
}

function aplicarDanoPostAccion(
  hp,
  estados,
  atacante,
  defensor,
  idxAtac,
  idxDef,
  pokAtac,
  pokDef,
) {
  const nuevosHP = structuredClone(hp);
  const nuevosEstados = structuredClone(estados);
  const msgs = [];

  const eA = nuevosEstados[atacante]?.[idxAtac];
  if (eA?.nombre === "QUEMADO") {
    const d = Math.max(1, Math.floor(pokAtac.hpMax * 0.0625));
    nuevosHP[atacante][idxAtac] = Math.max(0, nuevosHP[atacante][idxAtac] - d);
    msgs.push(`${pokAtac.nombre} sufre quemadura (-${d} HP).`);
  } else if (eA?.nombre === "VENENO") {
    const d = Math.max(1, Math.floor(pokAtac.hpMax * 0.125));
    nuevosHP[atacante][idxAtac] = Math.max(0, nuevosHP[atacante][idxAtac] - d);
    msgs.push(`${pokAtac.nombre} sufre veneno (-${d} HP).`);
  } else if (eA?.nombre === "VENENO_GRAVE") {
    const acum = eA.acumulador || 1;
    const d = Math.max(1, Math.floor(pokAtac.hpMax * 0.0625 * acum));
    nuevosHP[atacante][idxAtac] = Math.max(0, nuevosHP[atacante][idxAtac] - d);
    nuevosEstados[atacante][idxAtac].acumulador = acum + 1;
    msgs.push(`${pokAtac.nombre} sufre veneno grave (-${d} HP).`);
  }

  return {
    mensaje: msgs.join(" "),
    nuevosHPPost: nuevosHP,
    nuevosEstadosPost2: nuevosEstados,
  };
}

function encontrarSiguientePokemon(hpArray) {
  return hpArray.findIndex((hp) => hp > 0);
}

// ─────────────────────────────────────────────
//  ELEGIR ATAQUE (cliente)
// ─────────────────────────────────────────────
async function elegirAtaque(mov, index) {
  if (!esMiTurno || animacionEnProceso || esperandoCambio) {
    log("No puedes atacar ahora.");
    return;
  }
  const ppActual = estadoCombate?.pp?.[miNombre]?.[miIndexActivo]?.[index];
  if (ppActual <= 0) {
    log(`¡No quedan PP para ${mov.nombre}!`);
    return;
  }

  ocultarMenus();

  try {
    const combateRef = ref(db, `partidas/${partidaId}/combate`);
    await runTransaction(combateRef, (est) => {
      if (!est) return est;
      if (est.turno !== miNombre) return est;
      if (est.fase !== "elegir") return est;
      const pp = est.pp?.[miNombre]?.[miIndexActivo]?.[index];
      if (pp !== undefined && pp <= 0) return est;
      return {
        ...est,
        accion: {
          jugador: miNombre,
          movIndex: index,
          movNombre: mov.nombre,
        },
        fase: "resolver",
      };
    });
  } catch (err) {
    console.error("[ELEGIR ATAQUE]", err);
    log("Error al enviar el ataque.");
    mostrarMenuPrincipal();
  }
}

// ─────────────────────────────────────────────
//  CAMBIO DE POKÉMON
// ─────────────────────────────────────────────
function mostrarSelectorPokemon() {
  if (!menuCambio) return;
  esperandoCambio = true;
  log(cambioForzado ? "¡Elige tu siguiente Pokémon!" : "Elige un Pokémon:");

  menuCambio.innerHTML = `<h3 style="color:#ffcb05;margin-bottom:12px;text-align:center">
    ${cambioForzado ? "SIGUIENTE POKÉMON" : "CAMBIO DE POKÉMON"}</h3>`;
  menuCambio.classList.remove("oculto");
  menuPrincipal?.classList.add("oculto");
  menuMovimientos?.classList.add("oculto");

  let hayDisponibles = false;
  miEquipo.forEach((poke, i) => {
    const hpActual = estadoCombate?.hp?.[miNombre]?.[i] ?? 0;
    const estadoPoke = estadoCombate?.estados?.[miNombre]?.[i] || {};
    if (hpActual <= 0 || i === miIndexActivo) return;
    hayDisponibles = true;

    const btn = document.createElement("button");
    btn.className = "combate-opcion cambio-pokemon-btn";
    btn.innerHTML = `
      <div class="poke-nombre">${poke.nombre.toUpperCase()}${estadoPoke.nombre ? ` [${estadoPoke.nombre}]` : ""}</div>
      <div class="poke-hp">❤️ ${hpActual} / ${poke.hpMax} HP</div>
      <div class="poke-tipos">${(poke.tipos || []).join(" · ")}</div>`;
    btn.onclick = () => confirmarCambio(i);
    menuCambio.appendChild(btn);
  });

  if (!hayDisponibles && cambioForzado) {
    const p = document.createElement("p");
    p.textContent = "No hay más Pokémon disponibles.";
    p.style.cssText = "color:#aaa;text-align:center;padding:12px";
    menuCambio.appendChild(p);
  }

  if (!cambioForzado) {
    const btnCancelar = document.createElement("button");
    btnCancelar.className = "combate-opcion";
    btnCancelar.textContent = "CANCELAR";
    btnCancelar.onclick = cancelarCambio;
    menuCambio.appendChild(btnCancelar);
  }
}

function cancelarCambio() {
  esperandoCambio = false;
  cambioForzado = false;
  menuCambio?.classList.add("oculto");
  mostrarMenuPrincipal();
}

async function confirmarCambio(nuevoIndex) {
  const hpSel = estadoCombate?.hp?.[miNombre]?.[nuevoIndex] ?? 0;
  if (hpSel <= 0) {
    log("Ese Pokémon está debilitado.");
    mostrarSelectorPokemon();
    return;
  }
  if (nuevoIndex === miIndexActivo && !cambioForzado) {
    log("Ese Pokémon ya está en combate.");
    mostrarSelectorPokemon();
    return;
  }

  esperandoCambio = false;
  const eraForzado = cambioForzado;
  cambioForzado = false;
  menuCambio?.classList.add("oculto");

  const nuevoPoke = miEquipo[nuevoIndex];

  try {
    const combateRef = ref(db, `partidas/${partidaId}/combate`);
    await runTransaction(combateRef, (est) => {
      if (!est) return est;
      if (est.fase !== "elegir" && est.fase !== "cambio") return est;
      if (est.turno !== miNombre) return est;
      if ((est.hp?.[miNombre]?.[nuevoIndex] ?? 0) <= 0) return est;

      return {
        ...est,
        indexActivo: { ...est.indexActivo, [miNombre]: nuevoIndex },
        turno: eraForzado ? rivalNombreGlobal : rivalNombreGlobal,
        fase: "elegir",
        log: `¡${miNombre} envió a ${nuevoPoke.nombre}!`,
      };
    });
  } catch (err) {
    console.error("[CAMBIO ERROR]", err);
    log("Error al cambiar de Pokémon.");
    mostrarMenuPrincipal();
  }
}

// ─────────────────────────────────────────────
//  BOLSA DE OBJETOS
// ─────────────────────────────────────────────
const EFECTOS_OBJETO = {
  potion: { tipo: "hp", cantidad: 20 },
  "super-potion": { tipo: "hp", cantidad: 50 },
  "hyper-potion": { tipo: "hp", cantidad: 200 },
  "max-potion": { tipo: "hp_full" },
  revive: { tipo: "revivir" },
  "max-revive": { tipo: "revivir_full" },
  "full-heal": { tipo: "estado" },
  antidote: { tipo: "estado_especifico", estado: "VENENO" },
  "burn-heal": { tipo: "estado_especifico", estado: "QUEMADO" },
  "ice-heal": { tipo: "estado_especifico", estado: "CONGELADO" },
  "paralyz-heal": { tipo: "estado_especifico", estado: "PARALIZIS" },
  awakening: { tipo: "estado_especifico", estado: "DORMIDO" },
  ether: { tipo: "pp", cantidad: 10 },
  "max-ether": { tipo: "pp_full" },
};

function mostrarBolsa() {
  const cont = document.getElementById("bolsa-contenido");
  if (!cont) return;

  cont.innerHTML = `<h3 style="color:#ffcb05;margin-bottom:12px;text-align:center">BOLSA</h3>`;
  const objetosUsados = estadoCombate?.objetosUsados?.[miNombre] || [];
  let hayObjetos = false;

  miEquipo.forEach((poke, i) => {
    const objeto = poke.objeto;
    const hpActual = estadoCombate?.hp?.[miNombre]?.[i] ?? 0;
    if (!objeto || objeto.id === "ninguno") return;
    if (objetosUsados.includes(i)) return;

    const efecto = EFECTOS_OBJETO[objeto.id];
    const disabled =
      !efecto ||
      (objeto.id !== "revive" && objeto.id !== "max-revive" && hpActual <= 0);
    hayObjetos = true;

    const btn = document.createElement("button");
    btn.className = "combate-opcion";
    btn.disabled = disabled;
    btn.innerHTML = `
      <strong>${objeto.nombre || objeto.id}</strong>
      <span style="color:#aaa;font-size:0.85em"> → ${poke.nombre.toUpperCase()}
        ${hpActual <= 0 ? "(debilitado)" : `❤️ ${hpActual}/${poke.hpMax}`}
      </span>`;
    if (!disabled) btn.onclick = () => usarObjeto(i, objeto, efecto);
    cont.appendChild(btn);
  });

  if (!hayObjetos) {
    const p = document.createElement("p");
    p.textContent = "No hay objetos disponibles.";
    p.style.cssText = "color:#aaa;text-align:center;padding:12px";
    cont.appendChild(p);
  }

  menuPrincipal?.classList.add("oculto");
  menuBolsa?.classList.remove("oculto");
}

async function usarObjeto(indexPoke, objeto, efecto) {
  const combateRef = ref(db, `partidas/${partidaId}/combate`);
  try {
    await runTransaction(combateRef, (est) => {
      if (!est) return est;
      if (est.turno !== miNombre) return est;

      const usados = est.objetosUsados?.[miNombre] || [];
      if (usados.includes(indexPoke)) return est;

      let nuevosHP = structuredClone(est.hp);
      let nuevosPP = structuredClone(est.pp);
      let nuevosEstados = structuredClone(est.estados);
      let logMsg = "";

      const hpAct = nuevosHP[miNombre][indexPoke];
      const hpMax = miEquipo[indexPoke].hpMax;

      switch (efecto.tipo) {
        case "hp":
          if (hpAct >= hpMax) return est;
          nuevosHP[miNombre][indexPoke] = Math.min(
            hpMax,
            hpAct + efecto.cantidad,
          );
          logMsg = `${miNombre} usó ${objeto.nombre} en ${miEquipo[indexPoke].nombre}! (+${efecto.cantidad} HP)`;
          break;
        case "hp_full":
          if (hpAct >= hpMax) return est;
          nuevosHP[miNombre][indexPoke] = hpMax;
          logMsg = `${miEquipo[indexPoke].nombre} recuperó toda su vida!`;
          break;
        case "revivir":
          if (hpAct > 0) return est;
          nuevosHP[miNombre][indexPoke] = Math.floor(hpMax * 0.5);
          logMsg = `${miEquipo[indexPoke].nombre} fue revivido con ${Math.floor(hpMax * 0.5)} HP!`;
          break;
        case "revivir_full":
          if (hpAct > 0) return est;
          nuevosHP[miNombre][indexPoke] = hpMax;
          logMsg = `${miEquipo[indexPoke].nombre} fue revivido con toda su vida!`;
          break;
        case "estado":
          if (!est.estados[miNombre][indexPoke].nombre) return est;
          nuevosEstados[miNombre][indexPoke] = {
            nombre: null,
            turnosRestantes: 0,
            acumulador: 0,
          };
          logMsg = `${miEquipo[indexPoke].nombre} fue curado de ${est.estados[miNombre][indexPoke].nombre}!`;
          break;
        case "estado_especifico":
          if (est.estados[miNombre][indexPoke].nombre !== efecto.estado)
            return est;
          nuevosEstados[miNombre][indexPoke] = {
            nombre: null,
            turnosRestantes: 0,
            acumulador: 0,
          };
          logMsg = `${miEquipo[indexPoke].nombre} fue curado de ${efecto.estado}!`;
          break;
        case "pp":
          nuevosPP[miNombre][indexPoke] = nuevosPP[miNombre][indexPoke].map(
            (pp, idx) =>
              Math.min(
                pp + efecto.cantidad,
                miEquipo[indexPoke].movimientos[idx].ppMax,
              ),
          );
          logMsg = `Se restauraron PP de ${miEquipo[indexPoke].nombre}!`;
          break;
        case "pp_full":
          nuevosPP[miNombre][indexPoke] = miEquipo[indexPoke].movimientos.map(
            (m) => m.ppMax,
          );
          logMsg = `Se restauraron todos los PP de ${miEquipo[indexPoke].nombre}!`;
          break;
        default:
          return est;
      }

      const nuevosUsados = [...usados, indexPoke];
      return {
        ...est,
        hp: nuevosHP,
        pp: nuevosPP,
        estados: nuevosEstados,
        objetosUsados: { ...est.objetosUsados, [miNombre]: nuevosUsados },
        turno: rivalNombreGlobal,
        fase: "elegir",
        log: logMsg,
        accion: null,
      };
    });
  } catch (err) {
    console.error("[BOLSA ERROR]", err);
    log("Error al usar el objeto.");
  }

  menuBolsa?.classList.add("oculto");
  mostrarMenuPrincipal();
}

// ─────────────────────────────────────────────
//  MOVIMIENTOS UI
// ─────────────────────────────────────────────
function cargarMovimientos(pokemon, ppActuales) {
  const grid = document.querySelector(".movimientos-grid");
  if (!grid) return;
  grid.innerHTML = "";

  pokemon.movimientos.forEach((mov, i) => {
    const pp = ppActuales[i] ?? mov.ppMax;
    const btn = document.createElement("button");
    btn.className = "combate-movimiento";
    btn.disabled = pp <= 0;
    btn.innerHTML = `
      <span class="mov-nombre">${mov.nombre.toUpperCase()}</span>
      <span class="mov-tipo tipo-${mov.tipo}">${mov.tipo.toUpperCase()}</span>
      <span class="mov-pp">PP: ${pp}/${mov.ppMax}</span>
      <span class="mov-poder">POD: ${mov.poder || "—"}</span>`;
    if (!btn.disabled) btn.onclick = () => elegirAtaque(mov, i);
    grid.appendChild(btn);
  });

  const btnV = document.createElement("button");
  btnV.className = "combate-opcion combate-volver";
  btnV.textContent = "VOLVER";
  btnV.onclick = mostrarMenuPrincipal;
  grid.appendChild(btnV);
}

function mostrarMenuPrincipal() {
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

// ─────────────────────────────────────────────
//  FIN DE COMBATE
// ─────────────────────────────────────────────
async function finalizarCombate(ganador) {
  console.log("Finalizando combate, ganador:", ganador);
  if (window.combateFinalizado) return;
  window.combateFinalizado = true;
  ocultarMenus();

  if (combateListener) {
    off(combateListener);
    combateListener = null;
  }

  const esVictoria = ganador === miNombre;
  mostrarPantallaFin(esVictoria, ganador);

  try {
    await update(ref(db, `partidas/${partidaId}`), {
      estado: "finalizado",
      ganador,
      perdedor: esVictoria ? rivalNombreGlobal : miNombre,
      fechaFin: Date.now(),
    });
    const statsRef = ref(db, `estadisticas/${miNombre}`);
    const statsSnap = await get(statsRef);
    const stats = statsSnap.val() || { victorias: 0, derrotas: 0, batallas: 0 };
    await set(statsRef, {
      victorias: stats.victorias + (esVictoria ? 1 : 0),
      derrotas: stats.derrotas + (esVictoria ? 0 : 1),
      batallas: (stats.batallas || 0) + 1,
      ultimaBatalla: Date.now(),
    });
  } catch (err) {
    console.error("[FIN] Error guardando resultado:", err);
  }
}

function mostrarPantallaFin(esVictoria, ganador) {
  console.log(
    "Mostrando pantalla de fin, victoria:",
    esVictoria,
    "ganador:",
    ganador,
  );
  let overlay = document.getElementById("fin-overlay");
  if (!overlay) {
    overlay = document.createElement("div");
    overlay.id = "fin-overlay";
    document.body.appendChild(overlay);
  }

  overlay.innerHTML = `
    <div class="fin-contenido">
      <h1 class="fin-titulo ${esVictoria ? "victoria" : "derrota"}">
        ${esVictoria ? "¡VICTORIA!" : "DERROTA"}
      </h1>
      <p class="fin-mensaje">
        ${
          esVictoria
            ? `¡Felicidades! Has derrotado a ${rivalNombreGlobal}`
            : `${ganador} te ha derrotado`
        }
      </p>
      <div class="fin-stats" id="fin-stats-contenido">
        <p>Cargando estadísticas...</p>
      </div>
      <div class="fin-botones">
        <button class="fin-boton" id="fin-volver-menu">VOLVER AL MENÚ</button>
        <button class="fin-boton secondary" id="fin-ver-estadisticas">VER ESTADÍSTICAS</button>
      </div>
    </div>`;

  overlay.style.display = "flex";

  document.getElementById("fin-volver-menu")?.addEventListener("click", () => {
    window.location.href = "Juego-Lobby.html?id=" + partidaId;
  });
  document
    .getElementById("fin-ver-estadisticas")
    ?.addEventListener("click", () => {
      window.location.href = "Estadisticas.html";
    });

  get(ref(db, `estadisticas/${miNombre}`))
    .then((snap) => {
      const s = snap.val() || { victorias: 0, derrotas: 0, batallas: 0 };
      const c = document.getElementById("fin-stats-contenido");
      if (c)
        c.innerHTML = `
      <p>Victorias: ${s.victorias}</p>
      <p>Derrotas: ${s.derrotas}</p>
      <p>Batallas: ${s.batallas}</p>`;
    })
    .catch(() => {
      const c = document.getElementById("fin-stats-contenido");
      if (c) c.innerHTML = "<p>No se pudieron cargar las estadísticas.</p>";
    });
}

// ─────────────────────────────────────────────
//  ANIMACIONES
// ─────────────────────────────────────────────
const ANIMACIONES_MOVIMIENTO = {
  physical: {
    normal: { tipo: "golpe", color: "#FFFFFF" },
    fighting: { tipo: "golpe", color: "#FF8000" },
    fire: { tipo: "fuego", color: "#F08030" },
    water: { tipo: "agua", color: "#6890F0" },
    electric: { tipo: "rayo", color: "#F8D030" },
    grass: { tipo: "planta", color: "#78C850" },
    ice: { tipo: "hielo", color: "#98D8D8" },
    psychic: { tipo: "psiquico", color: "#F85888" },
    dragon: { tipo: "dragon", color: "#7038F8" },
    ghost: { tipo: "fantasma", color: "#705898" },
    dark: { tipo: "siniestro", color: "#705848" },
    steel: { tipo: "acero", color: "#B8B8D0" },
    rock: { tipo: "roca", color: "#B8A038" },
    ground: { tipo: "tierra", color: "#E0C068" },
    poison: { tipo: "veneno", color: "#A040A0" },
    flying: { tipo: "volador", color: "#A890F0" },
    bug: { tipo: "bicho", color: "#A8B820" },
    fairy: { tipo: "hada", color: "#EE99AC" },
  },
  special: {
    fire: { tipo: "fuego_especial", color: "#F08030" },
    water: { tipo: "agua_especial", color: "#6890F0" },
    electric: { tipo: "rayo_especial", color: "#F8D030" },
    grass: { tipo: "planta_especial", color: "#78C850" },
    ice: { tipo: "hielo_especial", color: "#98D8D8" },
    psychic: { tipo: "psiquico_especial", color: "#F85888" },
    dragon: { tipo: "dragon_especial", color: "#7038F8" },
    ghost: { tipo: "fantasma_especial", color: "#705898" },
    dark: { tipo: "siniestro_especial", color: "#705848" },
    fairy: { tipo: "hada_especial", color: "#EE99AC" },
  },
};

class AnimacionBatalla {
  constructor() {
    this.overlay = null;
    this.efectoDiv = null;
    this.textoDiv = null;
    this.damagePopup = null;
    this.animando = false;
    this._init();
  }

  _init() {
    if (!document.getElementById("animacion-overlay")) {
      const el = document.createElement("div");
      el.id = "animacion-overlay";
      el.className = "oculto";
      el.innerHTML =
        '<div class="efecto-visual"></div><div class="texto-animacion"></div>';
      document.body.appendChild(el);
    }
    if (!document.getElementById("animacion-damage")) {
      const el = document.createElement("div");
      el.id = "animacion-damage";
      el.className = "oculto";
      el.innerHTML = '<div class="damage-number"></div>';
      document.body.appendChild(el);
    }
    this.overlay = document.getElementById("animacion-overlay");
    this.efectoDiv = document.querySelector(".efecto-visual");
    this.textoDiv = document.querySelector(".texto-animacion");
    this.damagePopup = document.getElementById("animacion-damage");
  }

  async reproducirAtaque(mov, esEspecial = false) {
    if (this.animando) return;
    this.animando = true;
    const tipo = mov.tipo || "normal";
    const clase = esEspecial ? "special" : "physical";
    const cfg =
      ANIMACIONES_MOVIMIENTO[clase]?.[tipo] ||
      ANIMACIONES_MOVIMIENTO.physical.normal;

    this.overlay?.classList.remove("oculto");
    if (this.efectoDiv) this.efectoDiv.className = `efecto-visual ${cfg.tipo}`;
    if (this.textoDiv) {
      this.textoDiv.textContent = mov.nombre.toUpperCase();
      this.textoDiv.style.color = cfg.color;
    }

    await new Promise((r) => setTimeout(r, 600));
    this.overlay?.classList.add("oculto");
    if (this.efectoDiv) this.efectoDiv.className = "efecto-visual";
    this.animando = false;
  }

  async mostrarDano(dano, esCritico = false, posX = 0, posY = 0) {
    if (!this.damagePopup) return;
    const span = this.damagePopup.querySelector(".damage-number");
    if (span) span.textContent = `-${dano}`;
    this.damagePopup.classList.remove("oculto");
    this.damagePopup.classList.toggle("critico", esCritico);
    this.damagePopup.style.left = `${posX}px`;
    this.damagePopup.style.top = `${posY}px`;
    await new Promise((r) => setTimeout(r, 900));
    this.damagePopup.classList.add("oculto");
  }

  async sacudirPokemon(el) {
    if (!el) return;
    el.classList.add("shaking");
    await new Promise((r) => setTimeout(r, 320));
    el.classList.remove("shaking");
  }

  async flashDamage(el) {
    if (!el) return;
    el.classList.add("flash-damage");
    await new Promise((r) => setTimeout(r, 220));
    el.classList.remove("flash-damage");
  }
}

const animaciones = new AnimacionBatalla();

// ─────────────────────────────────────────────
//  ARRANQUE
// ─────────────────────────────────────────────
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", iniciarCombate);
} else {
  iniciarCombate();
}
