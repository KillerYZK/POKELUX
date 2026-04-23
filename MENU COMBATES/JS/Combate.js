import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import { mostrarLoading, ocultarLoading } from "./LoadingScreen.js";
import {
  getDatabase, ref, set, get, update, onValue
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-database.js";

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

const TIPO_CHART = {
  normal: { fighting: 2, ghost: 0 },
  fire: { water: 2, rock: 2, grass: 0.5, ice: 0.5, bug: 0.5, steel: 0.5 },
  water: { electric: 2, grass: 2, fire: 0.5, water: 0.5, ice: 0.5, steel: 0.5 },
  electric: { ground: 2, electric: 0.5, flying: 0.5, steel: 0.5 },
  grass: { fire: 2, ice: 2, poison: 2, flying: 2, bug: 2, water: 0.5, electric: 0.5, grass: 0.5, ground: 0.5 },
  ice: { fire: 2, fighting: 2, rock: 2, steel: 2, ice: 0.5 },
  fighting: { flying: 2, psychic: 2, fairy: 2, normal: 0.5, ice: 0.5, rock: 0.5, dark: 0.5, steel: 0.5 },
  poison: { ground: 2, psychic: 2, grass: 0.5, fighting: 0.5, poison: 0.5, bug: 0.5, fairy: 0.5 },
  ground: { water: 2, grass: 2, ice: 2, poison: 0.5, rock: 0.5, electric: 0 },
  flying: { electric: 2, ice: 2, rock: 2, grass: 0.5, fighting: 0.5, bug: 0.5 },
  psychic: { bug: 2, dark: 2, fighting: 0.5, psychic: 0.5 },
  bug: { fire: 2, flying: 2, rock: 2, grass: 0.5, fighting: 0.5, ground: 0.5 },
  rock: { water: 2, grass: 2, fighting: 2, ground: 2, steel: 2, normal: 0.5, fire: 0.5, poison: 0.5, flying: 0.5 },
  ghost: { ghost: 2, dark: 2, normal: 0, fighting: 0, poison: 0.5, bug: 0.5 },
  dragon: { ice: 2, dragon: 2, fairy: 2, fire: 0.5, water: 0.5, electric: 0.5, grass: 0.5 },
  dark: { fighting: 2, bug: 2, fairy: 2, ghost: 0.5, dark: 0.5, psychic: 0 },
  steel: { fire: 2, fighting: 2, ground: 2, normal: 0.5, grass: 0.5, ice: 0.5, flying: 0.5, psychic: 0.5, bug: 0.5, rock: 0.5, dragon: 0.5, steel: 0.5, fairy: 0.5 },
  fairy: { poison: 2, steel: 2, fighting: 0.5, bug: 0.5, dark: 0.5, dragon: 0 }
};

const SPRITE_BASE = {
  front: "https://play.pokemonshowdown.com/sprites/ani/",
  back: "https://play.pokemonshowdown.com/sprites/ani-back/"
};

// ── CAMPOS DE BATALLA ────────────────────────────────────────
function actualizarCampoPorTipo(tipos) {
  const campo = document.querySelector('.combate-campo');
  if (!campo) return;
  
  const tipoAClase = {
    fire: 'fuego', water: 'agua', grass: 'planta', electric: 'electrico',
    rock: 'roca', ground: 'tierra', ice: 'hielo', psychic: 'psiquico',
    ghost: 'fantasma', dark: 'siniestro', dragon: 'dragon', fairy: 'hada',
    steel: 'acero', flying: 'volador', poison: 'veneno', bug: 'bicho',
    fighting: 'lucha', normal: 'estandar'
  };
  
  const clasesCampo = ['fuego','agua','planta','electrico','roca','tierra','hielo',
    'psiquico','fantasma','siniestro','dragon','hada','acero','volador',
    'veneno','bicho','lucha','estandar'];
  
  campo.classList.remove(...clasesCampo);
  const nuevaClase = tipoAClase[tipos[0]] || 'estandar';
  campo.classList.add(nuevaClase);
}

function aplicarClima(tipoClima) {
  const campo = document.querySelector('.combate-campo');
  if (!campo) return;
  const climas = ['lluvia','sol','tormenta-arena','granizo'];
  campo.classList.remove(...climas);
  if (tipoClima) campo.classList.add(tipoClima);
}

// ── ESTADO LOCAL ─────────────────────────────────────────────
let estadoCombate = null;
let miEquipo = [];
let equipoRival = [];
let rivalNombreGlobal = null;
let miIndexActivo = 0;
let rivalIndexActivo = 0;
let esMiTurno = false;
let esperandoCambio = false;
let cambisForzado = false;
let animacionEnProceso = false;
let ultimoLog = "";
let listenerActivo = false;

const pokemonCache = new Map();

// ── DOM ──────────────────────────────────────────────────────
const logTxt = document.getElementById("log-texto");
const menuPrincipal = document.getElementById("menu-principal");
const menuMovimientos = document.getElementById("menu-movimientos");
const menuCambio = document.getElementById("menu-cambio");
const btnLuchar = document.getElementById("btn-luchar");
const btnVolver = document.getElementById("btn-volver");
const btnPokemon = document.getElementById("btn-pokemon");

// ── FUNCIÓN PARA REINICIAR ESTADOS ───────────────────────────
function reiniciarEstadosLocales() {
  animacionEnProceso = false;
  esperandoCambio = false;
  cambisForzado = false;
}

// ── INICIALIZAR ──────────────────────────────────────────────
async function iniciarCombate() {
  if (!partidaId || !miNombre) {
    log("Error: no se encontró la partida.");
    await ocultarLoading();
    return;
  }

  try {
    const snap = await get(ref(db, `partidas/${partidaId}`));
    const data = snap.val();

    if (!data?.jugadores) {
      log("Error: partida no encontrada.");
      await ocultarLoading();
      return;
    }

    const jugadores = Object.keys(data.jugadores);
    rivalNombreGlobal = jugadores.find(n => n !== miNombre);

    if (!rivalNombreGlobal) {
      log("Error: rival no encontrado.");
      await ocultarLoading();
      return;
    }

    log("Cargando equipos...");

    const equipoMiData = data.jugadores[miNombre]?.equipo;
    const equipoRivalData = data.jugadores[rivalNombreGlobal]?.equipo;

    if (!equipoMiData || !equipoRivalData) {
      log("Error: equipos no encontrados.");
      await ocultarLoading();
      return;
    }

    [miEquipo, equipoRival] = await Promise.all([
      cargarEquipo(equipoMiData),
      cargarEquipo(equipoRivalData)
    ]);

    if (miEquipo.length === 0 || equipoRival.length === 0) {
      log("Error: no se pudieron cargar los equipos.");
      await ocultarLoading();
      return;
    }

    const combateRef = ref(db, `partidas/${partidaId}/combate`);
    
    // ✅ LISTENER - SOLO UNO, SIEMPRE ACTIVO
    if (!listenerActivo) {
      listenerActivo = true;
      onValue(combateRef, (snapshot) => {
        const nuevoEstado = snapshot.val();
        if (nuevoEstado) {
          console.log("🔔 [LISTENER] Estado actualizado");
          estadoCombate = nuevoEstado;
          // ✅ Reiniciar animación antes de renderizar
          reiniciarEstadosLocales();
          renderEstado(estadoCombate);
        }
      });
    }

    const combateSnap = await get(combateRef);

    if (!combateSnap.exists()) {
      if (esHost) {
        await inicializarCombateEnFirebase();
      } else {
        let espera = true;
        for (let i = 0; i < 30 && espera; i++) {
          await new Promise(resolve => setTimeout(resolve, 500));
          const check = await get(combateRef);
          if (check.exists()) espera = false;
        }
        if (espera) {
          log("Error: timeout esperando al host.");
          await ocultarLoading();
          return;
        }
      }
    }

    const estadoInicial = await get(combateRef);
    if (estadoInicial.exists()) {
      estadoCombate = estadoInicial.val();
      renderEstado(estadoCombate);
    }

    log("¡Combate listo!");
    await ocultarLoading();

  } catch (err) {
    console.error("[INIT]", err);
    log("Error al conectar con Firebase: " + err.message);
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
    log: "¡El combate comienza!",
    clima: null,
    turnoClima: 0,
    campo: { reflejo: null, muroLuz: null, velocidad: null }
  });
}

function calcularQuienEmpieza() {
  const miVel = miEquipo[0].stats.spd;
  const rivalVel = equipoRival[0].stats.spd;
  if (miVel === rivalVel) return Math.random() < 0.5 ? miNombre : rivalNombreGlobal;
  return miVel > rivalVel ? miNombre : rivalNombreGlobal;
}

// ── CARGAR EQUIPO ────────────────────────────────────────────
async function cargarEquipo(listaEquipo) {
  if (!listaEquipo || listaEquipo.length === 0) return [];

  try {
    return await Promise.all(listaEquipo.map(async (entry) => {
      const nombre = String(typeof entry === "string" ? entry : entry.id);
      if (!nombre || nombre === "undefined") return crearPokemonPorDefecto("Unknown");
      if (pokemonCache.has(nombre)) return structuredClone(pokemonCache.get(nombre));

      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 8000);
        const res = await fetch(`https://pokeapi.co/api/v2/pokemon/${nombre.toLowerCase()}`, { signal: controller.signal });
        clearTimeout(timeoutId);
        if (!res.ok) return crearPokemonPorDefecto(nombre);

        const data = await res.json();
        const stats = {
          hp: data.stats.find(s => s.stat.name === "hp")?.base_stat || 50,
          atk: data.stats.find(s => s.stat.name === "attack")?.base_stat || 50,
          def: data.stats.find(s => s.stat.name === "defense")?.base_stat || 50,
          spAtk: data.stats.find(s => s.stat.name === "special-attack")?.base_stat || 50,
          spDef: data.stats.find(s => s.stat.name === "special-defense")?.base_stat || 50,
          spd: data.stats.find(s => s.stat.name === "speed")?.base_stat || 50
        };

        const movimientos = await Promise.all(
          (data.moves || []).slice(0, 4).map(async (m) => {
            try {
              const c2 = new AbortController();
              const t2 = setTimeout(() => c2.abort(), 4000);
              const mRes = await fetch(m.move.url, { signal: c2.signal });
              clearTimeout(t2);
              if (!mRes.ok) throw new Error("failed");
              const mData = await mRes.json();
              return {
                nombre: mData.name.replace(/-/g, " "),
                tipo: mData.type?.name || "normal",
                poder: mData.power || 0,
                pp: mData.pp || 20,
                ppMax: mData.pp || 20,
                clase: mData.damage_class?.name || "physical",
                precision: mData.accuracy || 100,
                efecto: mData.effect_entries?.find(e => e.language.name === "en")?.effect || ""
              };
            } catch {
              return { nombre: m.move.name.replace(/-/g, " "), tipo: "normal", poder: 40, pp: 20, ppMax: 20, clase: "physical", precision: 100, efecto: "" };
            }
          })
        );

        const pokemonData = {
          nombre: data.name || nombre,
          hpMax: stats.hp,
          stats,
          movimientos: movimientos.length > 0 ? movimientos : [
            { nombre: "Ataque Rápido", tipo: "normal", poder: 40, pp: 30, ppMax: 30, clase: "physical", precision: 100, efecto: "" }
          ],
          tipos: data.types?.map(t => t.type.name) || ["normal"]
        };

        pokemonCache.set(nombre, structuredClone(pokemonData));
        return pokemonData;

      } catch (err) {
        console.error(`[EQUIPO] Error cargando ${nombre}:`, err.message);
        return crearPokemonPorDefecto(nombre);
      }
    }));
  } catch (err) {
    console.error("[EQUIPO] Error:", err.message);
    return [crearPokemonPorDefecto("Fallback1"), crearPokemonPorDefecto("Fallback2")];
  }
}

function crearPokemonPorDefecto(nombre) {
  return {
    nombre: nombre || "Pokemon",
    hpMax: 50,
    stats: { hp: 50, atk: 50, def: 50, spAtk: 50, spDef: 50, spd: 50 },
    movimientos: [{ nombre: "Ataque Rápido", tipo: "normal", poder: 40, pp: 30, ppMax: 30, clase: "physical", precision: 100, efecto: "" }],
    tipos: ["normal"]
  };
}

// ── RENDERIZAR ───────────────────────────────────────────────
function renderEstado(estado) {
  // ✅ Eliminamos el bloqueo por animacionEnProceso
  if (!estado || !estado.indexActivo || !estado.hp || !estado.pp || !estado.estados) return;

  const rivalNombre = rivalNombreGlobal;
  if (!rivalNombre) return;
  if (estado.indexActivo[miNombre] === undefined || estado.indexActivo[rivalNombre] === undefined) return;

  esMiTurno = estado.turno === miNombre;
  miIndexActivo = estado.indexActivo[miNombre];
  rivalIndexActivo = estado.indexActivo[rivalNombre];

  if (!miEquipo[miIndexActivo] || !equipoRival[rivalIndexActivo]) return;

  const miPoke = miEquipo[miIndexActivo];
  const rivalPoke = equipoRival[rivalIndexActivo];
  const miHPActual = estado.hp[miNombre]?.[miIndexActivo];
  const rivalHPActual = estado.hp[rivalNombre]?.[rivalIndexActivo];
  if (miHPActual === undefined || rivalHPActual === undefined) return;

  const miEstado = estado.estados[miNombre]?.[miIndexActivo] || { nombre: null, turnosRestantes: 0, acumulador: 0 };
  const rivalEstado = estado.estados[rivalNombre]?.[rivalIndexActivo] || { nombre: null, turnosRestantes: 0, acumulador: 0 };

  actualizarCampoPorTipo(miPoke.tipos);
  if (estado.clima) aplicarClima(estado.clima);

  actualizarSprite("jugador-sprite", miPoke.nombre, "back");
  actualizarSprite("enemigo-sprite", rivalPoke.nombre, "front");
  actualizarInfobar("jugador", miPoke, miHPActual, miEstado);
  actualizarInfobar("enemigo", rivalPoke, rivalHPActual, rivalEstado);

  if (estado.hp[miNombre] && estado.estados[miNombre]) {
    actualizarPokeballs("equipo-jugador", estado.hp[miNombre], miEquipo, "jg", estado.estados[miNombre], miIndexActivo);
  }
  if (estado.hp[rivalNombre] && estado.estados[rivalNombre]) {
    actualizarPokeballs("equipo-enemigo", estado.hp[rivalNombre], equipoRival, "en", estado.estados[rivalNombre], rivalIndexActivo);
  }

  if (estado.log && estado.log !== ultimoLog) {
    log(estado.log);
    ultimoLog = estado.log;
  }

 if (estado.fase === "fin") { 
  finalizarCombate(estado.ganador); 
  return; 
}
  
  //  Ambos jugadores pueden ver la resolución, pero solo el host la ejecuta
  if (estado.fase === "resolver" && esHost && !animacionEnProceso) { 
    resolverAtaque(estado); 
    return; 
  }
  
  if (estado.fase === "cambio" && estado.turno === miNombre && !esperandoCambio) {
    cambisForzado = true;
    mostrarSelectorPokemon();
    return;
  }

  if (esMiTurno && estado.fase === "elegir" && !esperandoCambio) {
    mostrarMenuPrincipal();
    if (estado.pp[miNombre]?.[miIndexActivo]) cargarMovimientos(miPoke, estado.pp[miNombre][miIndexActivo]);
  } else {
    ocultarMenus();
    if (!esMiTurno && estado.fase === "elegir") log("Esperando al rival...");
  }
}

// ── RESOLVER ATAQUE ──────────────────────────────────────────
async function resolverAtaque(estado) {
  if (animacionEnProceso) return;
  
  try {
    const accion = estado.accion;
    if (!accion) return;

    animacionEnProceso = true;

    const rivalNombre = rivalNombreGlobal;
    const atacante = accion.jugador;
    const defensor = atacante === miNombre ? rivalNombre : miNombre;
    const equipoAtacante = atacante === miNombre ? miEquipo : equipoRival;
    const equipoDefensor = atacante === miNombre ? equipoRival : miEquipo;
    const indexAtacante = estado.indexActivo[atacante];
    const indexDefensor = estado.indexActivo[defensor];
    const pokeAtacante = equipoAtacante[indexAtacante];
    const pokeDefensor = equipoDefensor[indexDefensor];
    const movimiento = pokeAtacante.movimientos[accion.movIndex];

    let nuevosHP = structuredClone(estado.hp);
    let nuevosPP = structuredClone(estado.pp);
    let nuevosEstados = structuredClone(estado.estados);
    let nuevosStats = structuredClone(estado.estadisticas);

    nuevosPP[atacante][indexAtacante][accion.movIndex] = Math.max(0,
      nuevosPP[atacante][indexAtacante][accion.movIndex] - 1
    );

    const { puedeActuar, nuevosEstadosPost } = verificarEstadoPreAccion(nuevosEstados, atacante, indexAtacante);
    nuevosEstados = nuevosEstadosPost;

    if (!puedeActuar) {
      await commitTurno({ hp: nuevosHP, pp: nuevosPP, estados: nuevosEstados, estadisticas: nuevosStats,
        turno: defensor, fase: "elegir", log: `¡${pokeAtacante.nombre} no puede moverse!`, accion: null });
      animacionEnProceso = false;
      return;
    }

    const precisionMod = obtenerModificadorPrecision(nuevosStats, atacante, indexAtacante);
    if (Math.random() * 100 >= movimiento.precision * precisionMod) {
      await commitTurno({ hp: nuevosHP, pp: nuevosPP, estados: nuevosEstados, estadisticas: nuevosStats,
        turno: defensor, fase: "elegir", log: `¡${pokeAtacante.nombre} falló!`, accion: null });
      animacionEnProceso = false;
      return;
    }

    let logMsg = "";

    if (movimiento.clase === "status") {
      const result = aplicarMovimientoStatus(movimiento, pokeAtacante, pokeDefensor, nuevosEstados, defensor, indexDefensor);
      logMsg = result.mensaje;
      nuevosEstados = result.nuevosEstadosResult;
    } else {
      const result = calcularDano(movimiento, pokeAtacante, pokeDefensor, nuevosStats, nuevosEstados,
        atacante, defensor, indexAtacante, indexDefensor, estado.clima, nuevosHP);
      logMsg = result.logMsg;
      nuevosHP = result.nuevosHP;
      nuevosStats = result.nuevosStatsResult;

      if (movimiento.efecto && result.dano > 0 && Math.random() < 0.3) {
        const secResult = aplicarEfectoSecundario(movimiento, pokeDefensor, nuevosStats, defensor, indexDefensor);
        if (secResult.mensaje) logMsg += " " + secResult.mensaje;
        nuevosStats = secResult.nuevosStatsResult;
      }
    }

    const postResult = aplicarDañoPostAccion(nuevosHP, nuevosEstados, atacante, defensor, indexAtacante, indexDefensor, pokeAtacante, pokeDefensor);
    nuevosHP = postResult.nuevosHPPost;
    nuevosEstados = postResult.nuevosEstadosPost2;
    if (postResult.mensaje) logMsg += " " + postResult.mensaje;

    let nuevaFase = "elegir";
    let nuevoTurno = defensor;

    if (nuevosHP[defensor][indexDefensor] <= 0) {
      nuevosHP[defensor][indexDefensor] = 0;
      logMsg += ` ¡${pokeDefensor.nombre} se debilitó!`;
      if (encontrarSiguientePokemon(nuevosHP[defensor]) === -1) {
        await commitTurno({ hp: nuevosHP, pp: nuevosPP, estados: nuevosEstados, estadisticas: nuevosStats,
          turno: atacante, fase: "fin", ganador: atacante, log: `¡${atacante} ha ganado el combate!`, accion: null });
        animacionEnProceso = false;
        return;
      }
      nuevaFase = "cambio";
      nuevoTurno = defensor;
      logMsg += " Elige tu siguiente Pokémon.";
    }

    if (nuevosHP[atacante][indexAtacante] <= 0) {
      nuevosHP[atacante][indexAtacante] = 0;
      logMsg += ` ¡${pokeAtacante.nombre} se debilitó!`;
      if (encontrarSiguientePokemon(nuevosHP[atacante]) === -1) {
        await commitTurno({ hp: nuevosHP, pp: nuevosPP, estados: nuevosEstados, estadisticas: nuevosStats,
          turno: defensor, fase: "fin", ganador: defensor, log: `¡${defensor} ha ganado el combate!`, accion: null });
        animacionEnProceso = false;
        return;
      }
      nuevaFase = "cambio";
      nuevoTurno = atacante;
      logMsg += " Elige tu siguiente Pokémon.";
    }

    await commitTurno({ hp: nuevosHP, pp: nuevosPP, estados: nuevosEstados, estadisticas: nuevosStats,
      turno: nuevoTurno, fase: nuevaFase, log: logMsg, accion: null });

  } catch (err) {
    console.error("[RESOLVER]", err);
  } finally {
    animacionEnProceso = false;
  }
}

function calcularDano(movimiento, atacante, defensor, estadisticas, estados,
  atacanteNombre, defensorNombre, indexAtacante, indexDefensor, clima, nuevosHP) {

  let attackStat = movimiento.clase === "special" ? atacante.stats.spAtk : atacante.stats.atk;
  let defenseStat = movimiento.clase === "special" ? defensor.stats.spDef : defensor.stats.def;

  const sA = estadisticas[atacanteNombre][indexAtacante];
  const sD = estadisticas[defensorNombre][indexDefensor];
  const atkMod = Math.max(-6, Math.min(6, sA[movimiento.clase === "special" ? "spAtk" : "atk"]));
  const defMod = Math.max(-6, Math.min(6, sD[movimiento.clase === "special" ? "spDef" : "def"]));

  attackStat *= atkMod >= 0 ? (2 + atkMod) / 2 : 2 / (2 - atkMod);
  defenseStat *= defMod >= 0 ? (2 + defMod) / 2 : 2 / (2 - defMod);

  if (estados[atacanteNombre][indexAtacante].nombre === "QUEMADO" && movimiento.clase === "physical") attackStat *= 0.5;

  const stab = atacante.tipos.includes(movimiento.tipo) ? 1.5 : 1;
  let effectiveness = 1;
  for (const tipo of defensor.tipos) effectiveness *= TIPO_CHART[movimiento.tipo]?.[tipo] ?? 1;

  let weatherMod = 1;
  if (clima === "lluvia") { if (movimiento.tipo === "water") weatherMod = 1.5; if (movimiento.tipo === "fire") weatherMod = 0.5; }
  if (clima === "sol") { if (movimiento.tipo === "fire") weatherMod = 1.5; if (movimiento.tipo === "water") weatherMod = 0.5; }

  const level = 50;
  let damage = Math.floor((((2 * level / 5 + 2) * movimiento.poder * attackStat / defenseStat) / 50) + 2);
  damage = Math.floor(damage * stab * effectiveness * weatherMod * (0.85 + Math.random() * 0.15));

  let logMsg = `${atacante.nombre} usó ${movimiento.nombre}!`;
  if (stab > 1) logMsg += " ¡STAB!";
  if (effectiveness > 1) logMsg += " ¡Es muy eficaz!";
  if (effectiveness < 1 && effectiveness > 0) logMsg += " No es muy eficaz...";
  if (effectiveness === 0) { logMsg += " ¡No afecta!"; damage = 0; }
  if (damage > 0) {
    logMsg += ` (-${damage} HP)`;
    nuevosHP[defensorNombre][indexDefensor] = Math.max(0, nuevosHP[defensorNombre][indexDefensor] - damage);
  }

  return { dano: damage, logMsg, nuevosHP, nuevosStatsResult: estadisticas };
}

function obtenerModificadorPrecision(estadisticas, jugador, index) {
  const s = estadisticas[jugador][index];
  return (1 + Math.max(-6, Math.min(6, s.precision)) * 0.1) / (1 + Math.max(-6, Math.min(6, s.evasion)) * 0.1);
}

function verificarEstadoPreAccion(estados, jugador, index) {
  const nuevosEstados = structuredClone(estados);
  const estadoPoke = nuevosEstados[jugador][index];
  if (!estadoPoke.nombre) return { puedeActuar: true, nuevosEstadosPost: nuevosEstados };
  switch (estadoPoke.nombre) {
    case "PARALIZIS": return { puedeActuar: Math.random() > 0.25, nuevosEstadosPost: nuevosEstados };
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
    default: return { puedeActuar: true, nuevosEstadosPost: nuevosEstados };
  }
}

function aplicarDañoPostAccion(hp, estados, atacante, defensor, indexAtacante, indexDefensor, pokeAtacante, pokeDefensor) {
  const nuevosHP = structuredClone(hp);
  const nuevosEstados = structuredClone(estados);
  const mensajes = [];
  const eAtacante = nuevosEstados[atacante][indexAtacante];

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
    const d = Math.max(1, Math.floor(pokeAtacante.hpMax * 0.0625 * acum));
    nuevosHP[atacante][indexAtacante] = Math.max(0, nuevosHP[atacante][indexAtacante] - d);
    nuevosEstados[atacante][indexAtacante].acumulador = acum + 1;
    mensajes.push(`${pokeAtacante.nombre} sufrió daño por veneno grave (-${d} HP)`);
  }

  return { mensaje: mensajes.join(" "), nuevosHPPost: nuevosHP, nuevosEstadosPost2: nuevosEstados };
}

function aplicarMovimientoStatus(movimiento, atacante, defensor, estados, defensorNombre, indexDefensor) {
  const nuevosEstados = structuredClone(estados);
  const efecto = movimiento.efecto.toLowerCase();
  const estadoMap = { "badly poison": "VENENO_GRAVE", "paralyze": "PARALIZIS", "sleep": "DORMIDO", "burn": "QUEMADO", "freeze": "CONGELADO", "poison": "VENENO" };
  let estadoAplicar = null;
  for (const [key, value] of Object.entries(estadoMap)) { if (efecto.includes(key)) { estadoAplicar = value; break; } }
  if (estadoAplicar && !nuevosEstados[defensorNombre][indexDefensor].nombre) {
    nuevosEstados[defensorNombre][indexDefensor] = {
      nombre: estadoAplicar,
      turnosRestantes: estadoAplicar === "DORMIDO" ? Math.floor(Math.random() * 3) + 1 : 0,
      acumulador: estadoAplicar === "VENENO_GRAVE" ? 1 : 0
    };
    return { mensaje: `${defensor.nombre} quedó ${estadoAplicar}!`, nuevosEstadosResult: nuevosEstados };
  }
  return { mensaje: `${atacante.nombre} usó ${movimiento.nombre}, pero no tuvo efecto.`, nuevosEstadosResult: nuevosEstados };
}

function aplicarEfectoSecundario(movimiento, objetivo, estadisticas, jugador, index) {
  const nuevosStats = structuredClone(estadisticas);
  const efecto = movimiento.efecto.toLowerCase();
  const statMap = { "special attack": "spAtk", "special defense": "spDef", "attack": "atk", "defense": "def", "speed": "spd" };
  let stat = null;
  for (const [key, value] of Object.entries(statMap)) { if (efecto.includes(key)) { stat = value; break; } }
  if (stat) {
    if (efecto.includes("lower")) { nuevosStats[jugador][index][stat] = Math.max(-6, nuevosStats[jugador][index][stat] - 1); return { mensaje: `¡El ${stat} de ${objetivo.nombre} bajó!`, nuevosStatsResult: nuevosStats }; }
    if (efecto.includes("raise")) { nuevosStats[jugador][index][stat] = Math.min(6, nuevosStats[jugador][index][stat] + 1); return { mensaje: `¡El ${stat} de ${objetivo.nombre} subió!`, nuevosStatsResult: nuevosStats }; }
  }
  return { mensaje: "", nuevosStatsResult: nuevosStats };
}

function encontrarSiguientePokemon(hpArray) {
  return hpArray.findIndex(hp => hp > 0);
}

async function commitTurno(payload) {
  await update(ref(db, `partidas/${partidaId}/combate`), payload);
  animacionEnProceso = false;
}

// ── ACCIONES DEL JUGADOR ─────────────────────────────────────
async function elegirAtaque(mov, index) {
  console.log("⚔️ [ATAQUE] Elegido:", mov.nombre);
  
  if (!esMiTurno || animacionEnProceso || esperandoCambio) {
    console.log("❌ [ATAQUE] No se puede atacar - no es tu turno o hay animación");
    return;
  }

  const ppActual = estadoCombate.pp[miNombre][miIndexActivo][index];
  if (ppActual <= 0) { 
    log(`¡No quedan PP para ${mov.nombre}!`); 
    return; 
  }
  
  animacionEnProceso = true;
  ocultarMenus();
  
  await update(ref(db, `partidas/${partidaId}/combate`), {
    accion: { jugador: miNombre, movIndex: index, movNombre: mov.nombre, movPoder: mov.poder, movTipo: mov.tipo, movClase: mov.clase, movPrecision: mov.precision },
    fase: "resolver"
  });
  
  console.log("✅ [ATAQUE] Acción enviada a Firebase");
}

function mostrarSelectorPokemon() {
  esperandoCambio = true;
  log(cambisForzado ? "¡Elige tu siguiente Pokémon!" : "Elige un Pokémon:");
  if (!menuCambio) return;
  menuCambio.innerHTML = "<h3 style='color:#ffcb05;margin-bottom:12px;text-align:center'>ELIGE POKÉMON</h3>";
  menuCambio.classList.remove("oculto");
  menuPrincipal?.classList.add("oculto");
  menuMovimientos?.classList.add("oculto");
  miEquipo.forEach((poke, i) => {
    const hpActual = estadoCombate.hp[miNombre][i];
    const estadoPoke = estadoCombate.estados[miNombre][i];
    if (hpActual <= 0 || i === miIndexActivo) return;
    const btn = document.createElement("button");
    btn.className = "combate-opcion cambio-pokemon-btn";
    btn.innerHTML = `<div class="poke-nombre">${poke.nombre.toUpperCase()}${estadoPoke.nombre ? ` [${estadoPoke.nombre}]` : ""}</div><div class="poke-hp">❤️ ${hpActual}/${poke.hpMax} HP</div>`;
    btn.onclick = () => confirmarCambio(i);
    menuCambio.appendChild(btn);
  });
  if (!cambisForzado) {
    const btnCancelar = document.createElement("button");
    btnCancelar.className = "combate-opcion";
    btnCancelar.textContent = "CANCELAR";
    btnCancelar.onclick = cancelarCambio;
    menuCambio.appendChild(btnCancelar);
  }
}

function cancelarCambio() {
  esperandoCambio = false;
  cambisForzado = false;
  mostrarMenuPrincipal();
  menuCambio?.classList.add("oculto");
}

async function confirmarCambio(nuevoIndex) {
  esperandoCambio = false;
  cambisForzado = false;
  
  const nuevoPoke = miEquipo[nuevoIndex];
  
  await update(ref(db, `partidas/${partidaId}/combate`), {
    [`indexActivo/${miNombre}`]: nuevoIndex,
    turno: rivalNombreGlobal,
    fase: "elegir",
    log: `¡${miNombre} envió a ${nuevoPoke.nombre}!`
  });
  
  menuCambio?.classList.add("oculto");
  mostrarMenuPrincipal();
}

// ── UI ───────────────────────────────────────────────────────
function actualizarSprite(id, nombre, lado) {
  const img = document.getElementById(id);
  if (!img) return;
  img.src = `${SPRITE_BASE[lado]}${nombre.toLowerCase()}.gif`;
  img.alt = nombre;
}

function actualizarInfobar(lado, pokemon, hpActual, estado) {
  const pct = Math.max(0, (hpActual / pokemon.hpMax) * 100);
  const fill = document.getElementById(`${lado}-hp-fill`);
  if (fill) { 
    fill.style.width = `${pct}%`; 
    fill.className = `combate-hpbar-fill${pct > 50 ? "" : pct > 20 ? " hp-mid" : " hp-low"}`; 
  }
  const nomEl = document.getElementById(`${lado}-nombre`);
  if (nomEl) nomEl.textContent = pokemon.nombre.toUpperCase() + (estado?.nombre ? ` [${estado.nombre}]` : "");
  if (lado === "jugador") {
    const hpNum = document.getElementById("jugador-hp-actual");
    const hpMax = document.getElementById("jugador-hp-max");
    if (hpNum) hpNum.textContent = hpActual;
    if (hpMax) hpMax.textContent = pokemon.hpMax;
  }
  if (lado === "enemigo") {
    const hpNum = document.getElementById("enemigo-hp-actual");
    const hpMax = document.getElementById("enemigo-hp-max");
    if (hpNum) hpNum.textContent = hpActual;
    if (hpMax) hpMax.textContent = pokemon.hpMax;
  }
}

function actualizarPokeballs(containerId, hpArray, equipo, prefijo, estadosArray, indexActivo) {
  for (let i = 0; i < equipo.length; i++) {
    const ball = document.getElementById(`${prefijo}-${i}`);
    if (!ball) continue;
    ball.classList.toggle("debil", hpArray[i] <= 0);
    ball.classList.toggle("activo", i === indexActivo);
    ball.classList.toggle("estado", !!estadosArray?.[i]?.nombre);
    ball.title = estadosArray?.[i]?.nombre || "";
  }
}

function cargarMovimientos(pokemon, ppActuales) {
  const contenedor = document.querySelector(".movimientos-grid");
  if (!contenedor) return;
  contenedor.innerHTML = "";
  pokemon.movimientos.forEach((mov, i) => {
    const btn = document.createElement("button");
    btn.className = "combate-movimiento";
    btn.disabled = ppActuales[i] <= 0;
    btn.innerHTML = `<span class="mov-nombre">${mov.nombre.toUpperCase()}</span><span class="mov-tipo tipo-${mov.tipo}">${mov.tipo.toUpperCase()}</span><span class="mov-pp">PP: ${ppActuales[i]}/${mov.ppMax}</span><span class="mov-poder">POD: ${mov.poder || "--"}</span>`;
    if (!btn.disabled) btn.onclick = () => elegirAtaque(mov, i);
    contenedor.appendChild(btn);
  });
  const btnV = document.createElement("button");
  btnV.className = "combate-opcion combate-volver";
  btnV.textContent = "VOLVER";
  btnV.onclick = mostrarMenuPrincipal;
  contenedor.appendChild(btnV);
}

function mostrarMenuPrincipal() {
  menuPrincipal?.classList.remove("oculto");
  menuMovimientos?.classList.add("oculto");
  menuCambio?.classList.add("oculto");
}

function ocultarMenus() {
  menuPrincipal?.classList.add("oculto");
  menuMovimientos?.classList.add("oculto");
  menuCambio?.classList.add("oculto");
}

function mostrarFinCombate(ganador) {
  ocultarMenus();
  log(ganador === miNombre ? "¡VICTORIA!" : "¡DERROTA!");
}

function log(msg) {
  if (logTxt) logTxt.textContent = msg;
  console.log("[COMBATE]", msg);
}

// ── EVENTOS ──────────────────────────────────────────────────
btnLuchar?.addEventListener("click", () => {
  if (!esMiTurno || esperandoCambio || animacionEnProceso) return;
  menuPrincipal?.classList.add("oculto");
  menuMovimientos?.classList.remove("oculto");
});

btnVolver?.addEventListener("click", mostrarMenuPrincipal);

btnPokemon?.addEventListener("click", () => {
  if (!esMiTurno || esperandoCambio || animacionEnProceso) return;
  cambisForzado = false;
  mostrarSelectorPokemon();
});

// ── FIN DEL COMBATE ─────────────────────────────────────────
async function finalizarCombate(ganador) {
  // Evitar múltiples llamadas
  if (window.combateFinalizado) return;
  window.combateFinalizado = true;
  
  ocultarMenus();
  
  const esVictoria = ganador === miNombre;
  const perdedor = esVictoria ? rivalNombreGlobal : miNombre;
  
  // 1. Mostrar pantalla de fin de combate
  mostrarPantallaFin(esVictoria, ganador);
  
  // 2. Guardar resultado en Firebase
  try {
    await update(ref(db, `partidas/${partidaId}`), {
      estado: "finalizado",
      ganador: ganador,
      perdedor: perdedor,
      fechaFin: Date.now()
    });
    
    // 3. Guardar estadísticas del jugador (opcional)
    const statsRef = ref(db, `estadisticas/${miNombre}`);
    const statsSnap = await get(statsRef);
    const statsActuales = statsSnap.val() || { victorias: 0, derrotas: 0, batallas: 0 };
    
    await set(statsRef, {
      victorias: statsActuales.victorias + (esVictoria ? 1 : 0),
      derrotas: statsActuales.derrotas + (esVictoria ? 0 : 1),
      batallas: (statsActuales.batallas || 0) + 1,
      ultimaBatalla: Date.now()
    });
    
  } catch (err) {
    console.error("[FIN] Error guardando resultado:", err);
  }
  
  // 4. Reproducir sonido de victoria/derrota (opcional)
  // reproducirSonido(esVictoria ? "victoria.mp3" : "derrota.mp3");
}

function mostrarPantallaFin(esVictoria, ganador) {
  // Crear overlay si no existe
  let overlay = document.getElementById("fin-overlay");
  if (!overlay) {
    overlay = document.createElement("div");
    overlay.id = "fin-overlay";
    document.body.appendChild(overlay);
    
    // Estilos del overlay
    const style = document.createElement("style");
    style.textContent = `
      #fin-overlay {
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: rgba(13, 27, 75, 0.95);
        z-index: 10000;
        display: flex;
        justify-content: center;
        align-items: center;
        backdrop-filter: blur(8px);
        animation: finAparecer 0.5s ease;
      }
      
      @keyframes finAparecer {
        from { opacity: 0; transform: scale(0.9); }
        to { opacity: 1; transform: scale(1); }
      }
      
      .fin-contenido {
        text-align: center;
        background: linear-gradient(135deg, #1a3080, #0d1b4b);
        padding: 40px 60px;
        border-radius: 20px;
        border: 3px solid var(--magenta, #ff2d78);
        box-shadow: 0 0 50px rgba(255, 45, 120, 0.35);
      }
      
      .fin-titulo {
        font-family: "Bebas Neue", sans-serif;
        font-size: 3rem;
        letter-spacing: 0.1em;
        margin-bottom: 20px;
      }
      
      .fin-titulo.victoria {
        color: #55197e;
        text-shadow: 0 0 20px #20a4d8;
      }
      
      .fin-titulo.derrota {
        color: #c02a93;
        text-shadow: 0 0 20px #ce03ce;
      }
      
      .fin-mensaje {
        font-size: 1.2rem;
        margin-bottom: 20px;
        color: #f0f4ff;
      }
      
      .fin-stats {
        background: rgba(0, 0, 0, 0.5);
        border-radius: 10px;
        padding: 15px;
        margin: 20px 0;
        font-size: 0.9rem;
      }
      
      .fin-stats p {
        margin: 5px 0;
      }
      
      .fin-boton {
        font-family: "Bebas Neue", sans-serif;
        font-size: 1.2rem;
        letter-spacing: 0.08em;
        color: #0d1b4b;
        background: #ff2d78;
        border: none;
        border-radius: 8px;
        padding: 10px 30px;
        margin: 0 10px;
        cursor: pointer;
        transition: all 0.2s ease;
      }
      
      .fin-boton:hover {
        transform: scale(1.05);
        background: #ff4d8d;
      }
      
      .fin-boton.secondary {
        background: #4fc3f7;
        color: #0d1b4b;
      }
      
      .fin-boton.secondary:hover {
        background: #74d4f9;
      }
    `;
    document.head.appendChild(style);
  }
  
  // Obtener estadísticas
  const statsRef = ref(db, `estadisticas/${miNombre}`);
  get(statsRef).then((snap) => {
    const stats = snap.val() || { victorias: 0, derrotas: 0, batallas: 0 };
    const statsHtml = `
      <div class="fin-stats">
        <p> Victorias: ${stats.victorias || 0}</p>
        <p> Derrotas: ${stats.derrotas || 0}</p>
        <p> Batallas totales: ${stats.batallas || 0}</p>
      </div>
    `;
    
    overlay.innerHTML = `
      <div class="fin-contenido">
        <h1 class="fin-titulo ${esVictoria ? 'victoria' : 'derrota'}">
          ${esVictoria ? '¡VICTORIA!' : '¡DERROTA!'}
        </h1>
        <p class="fin-mensaje">
          ${esVictoria 
            ? `¡Felicidades! Has derrotado a ${rivalNombreGlobal}` 
            : `${ganador} te ha derrotado`}
        </p>
        ${statsHtml}
        <div>
          <button class="fin-boton" id="fin-volver-menu">VOLVER AL MENÚ</button>
          <button class="fin-boton secondary" id="fin-ver-estadisticas">VER ESTADÍSTICAS</button>
        </div>
      </div>
    `;
    
    document.getElementById("fin-volver-menu")?.addEventListener("click", () => {
    window.location.href = `../HTML/Juego-Lobby.html?id=${partidaId}`;
  });
    
    document.getElementById("fin-ver-estadisticas")?.addEventListener("click", () => {
      window.location.href = "Estadisticas.html";
    });
  });
}

// ── ARRANCAR ─────────────────────────────────────────────────
iniciarCombate();