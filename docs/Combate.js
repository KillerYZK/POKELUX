import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import { mostrarLoading, ocultarLoading } from "./LoadingScreen.js";
import {
  getDatabase, ref, set, get, update, onValue
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-database.js"

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
  ghost:    { normal: 0, dark: 0.5, psychic: 2, ghost: 2 },
  dragon:   { steel: 0.5, fairy: 0, dragon: 2 },
  dark:     { fighting: 0.5, dark: 0.5, fairy: 0.5, psychic: 2, ghost: 2 },
  steel:    { fire: 0.5, water: 0.5, electric: 0.5, steel: 0.5, ice: 2, rock: 2, fairy: 2 },
  fairy:    { fire: 0.5, poison: 0.5, steel: 0.5, fighting: 2, dragon: 2, dark: 2 }
};

const SPRITE_BASE = {
  front: "https://play.pokemonshowdown.com/sprites/ani/",
  back: "https://play.pokemonshowdown.com/sprites/ani-back/"
};

// CAMPOS DE BATALLA
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

// ESTADO LOCAL
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
const btnBolsa = document.getElementById("btn-bolsa");

// DOM
const logTxt = document.getElementById("log-texto");
const menuPrincipal = document.getElementById("menu-principal");
const menuMovimientos = document.getElementById("menu-movimientos");
const menuCambio = document.getElementById("menu-cambio");
const menuBolsa = document.getElementById("menu-bolsa");
const btnLuchar = document.getElementById("btn-luchar");

const btnPokemon = document.getElementById("btn-pokemon");
const btnCerrarBolsa = document.getElementById("btn-cerrar-bolsa");

// FUNCION PARA CALCULAR ESTADISTICAS REALES CON NIVEL
function calcularEstadisticasReales(baseStats, nivel) {
  const ivs = { hp: 31, atk: 31, def: 31, spAtk: 31, spDef: 31, spd: 31 };
  const evs = { hp: 0, atk: 0, def: 0, spAtk: 0, spDef: 0, spd: 0 };
  
  const stats = {};
  
  stats.hp = Math.floor(((2 * baseStats.hp + ivs.hp + evs.hp/4) * nivel / 100) + nivel + 10);
  stats.atk = Math.floor(((2 * baseStats.atk + ivs.atk + evs.atk/4) * nivel / 100) + 5);
  stats.def = Math.floor(((2 * baseStats.def + ivs.def + evs.def/4) * nivel / 100) + 5);
  stats.spAtk = Math.floor(((2 * baseStats.spAtk + ivs.spAtk + evs.spAtk/4) * nivel / 100) + 5);
  stats.spDef = Math.floor(((2 * baseStats.spDef + ivs.spDef + evs.spDef/4) * nivel / 100) + 5);
  stats.spd = Math.floor(((2 * baseStats.spd + ivs.spd + evs.spd/4) * nivel / 100) + 5);
  
  return stats;
}

// REINICIAR ESTADOS
function reiniciarEstadosLocales() {
  if (!animacionEnProceso) {
    esperandoCambio = false;
    cambisForzado = false;
  }
}

// INICIALIZAR COMBATE
async function iniciarCombate() {
  console.log("[COMBATE] iniciarCombate() llamado");

  await mostrarLoading();

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
      cargarEquipo(equipoMiData, miNombre),
      cargarEquipo(equipoRivalData, rivalNombreGlobal)
    ]);

    if (miEquipo.length === 0 || equipoRival.length === 0) {
      log("Error: no se pudieron cargar los equipos.");
      await ocultarLoading();
      return;
    }

    const combateRef = ref(db, `partidas/${partidaId}/combate`);
    
    if (!listenerActivo) {
      listenerActivo = true;
      onValue(combateRef, (snapshot) => {
        const nuevoEstado = snapshot.val();
        if (nuevoEstado) {
          estadoCombate = nuevoEstado;
          reiniciarEstadosLocales();
          renderEstado(estadoCombate);
        }
      });
    }

    const combateSnap = await get(combateRef);

    if (!combateSnap.exists()) {
      if (esHost) {
        await inicializarCombateEnFirebase();
        await new Promise(resolve => setTimeout(resolve, 500));
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

    log("Combate listo");
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
    log: "El combate comienza",
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

// CARGAR EQUIPO
async function cargarEquipo(listaEquipo, nombreJugador) {
  if (!listaEquipo || listaEquipo.length === 0) return [];

  try {
    return await Promise.all(listaEquipo.map(async (entry) => {
      const nombreBase = String(typeof entry === "string" ? entry : entry.id);
      if (!nombreBase || nombreBase === "undefined") return crearPokemonPorDefecto("Unknown");
      
      let configGuardada = {};
      
      if (nombreJugador === miNombre) {
      const configLocal = JSON.parse(localStorage.getItem(`configuracion-${nombreBase}`)) || {};
      configGuardada = configLocal;
    } else {
      try {
        // Intentar cargar configuración del rival desde Firebase
        const configSnap = await get(ref(db, `partidas/${partidaId}/configuraciones/${nombreJugador}/${nombreBase}`));
        configGuardada = configSnap.val() || {};
      } catch(e) {
        console.warn("No se pudo cargar config del rival:", e);
      }
}
      
      const nivel = parseInt(configGuardada.nivel) || 50;
      const apodo = configGuardada.apodo || nombreBase;
      const esShiny = configGuardada.shiny || false;
      const movimientosGuardados = configGuardada.movimientos || [];
      const objetoGuardado = configGuardada.objeto || null;
      
      const cacheKey = `${nombreBase}-${nivel}-${esShiny}-${nombreJugador}`;
      if (pokemonCache.has(cacheKey)) return structuredClone(pokemonCache.get(cacheKey));

      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 8000);
        const res = await fetch(`https://pokeapi.co/api/v2/pokemon/${nombreBase.toLowerCase()}`, { signal: controller.signal });
        clearTimeout(timeoutId);
        if (!res.ok) return crearPokemonPorDefecto(apodo);

        const data = await res.json();
        const baseStats = {
          hp: data.stats.find(s => s.stat.name === "hp")?.base_stat || 50,
          atk: data.stats.find(s => s.stat.name === "attack")?.base_stat || 50,
          def: data.stats.find(s => s.stat.name === "defense")?.base_stat || 50,
          spAtk: data.stats.find(s => s.stat.name === "special-attack")?.base_stat || 50,
          spDef: data.stats.find(s => s.stat.name === "special-defense")?.base_stat || 50,
          spd: data.stats.find(s => s.stat.name === "speed")?.base_stat || 50
        };

        const statsReales = calcularEstadisticasReales(baseStats, nivel);

        let movimientos = [];
        
        if (movimientosGuardados.length > 0 && movimientosGuardados.some(m => m && m !== "")) {
          for (const moveName of movimientosGuardados) {
            if (!moveName || moveName === "") {
              movimientos.push({
                nombre: "Ataque Rapido",
                tipo: "normal",
                poder: 40,
                pp: 30,
                ppMax: 30,
                clase: "physical",
                precision: 100,
                efecto: ""
              });
              continue;
            }
            
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
                  efecto: moveData.effect_entries?.find(e => e.language.name === "en")?.effect || ""
                });
              } else {
                throw new Error("Move not found");
              }
            } catch {
              movimientos.push({
                nombre: moveName.replace(/-/g, " "),
                tipo: "normal",
                poder: 40,
                pp: 20,
                ppMax: 20,
                clase: "physical",
                precision: 100,
                efecto: ""
              });
            }
          }
        } else {
          movimientos = await Promise.all(
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
        }

        while (movimientos.length < 4) {
          movimientos.push({
            nombre: "Ataque Rapido",
            tipo: "normal",
            poder: 40,
            pp: 30,
            ppMax: 30,
            clase: "physical",
            precision: 100,
            efecto: ""
          });
        }

        const pokemonData = {
          nombre: apodo,
          nombreOriginal: data.name,
          hpMax: statsReales.hp,
          stats: statsReales,
          nivel: nivel,
          movimientos: movimientos.slice(0, 4),
          tipos: data.types?.map(t => t.type.name) || ["normal"],
          shiny: esShiny,
          objeto: objetoGuardado ? { id: objetoGuardado, nombre: objetoGuardado, sprite: "" } : null,
          objetoUsado: false
        };

        pokemonCache.set(cacheKey, structuredClone(pokemonData));
        return pokemonData;

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

function crearPokemonPorDefecto(nombre) {
  return {
    nombre: nombre || "Pokemon",
    nombreOriginal: nombre || "pokemon",
    hpMax: 50,
    stats: { hp: 50, atk: 50, def: 50, spAtk: 50, spDef: 50, spd: 50 },
    nivel: 50,
    movimientos: [{ nombre: "Ataque Rapido", tipo: "normal", poder: 40, pp: 30, ppMax: 30, clase: "physical", precision: 100, efecto: "" }],
    tipos: ["normal"],
    shiny: false,
    objeto: null,
    objetoUsado: false
  };
}

// RENDERIZAR
function renderEstado(estado) {
  if (!estado) return;
  if (!estado.indexActivo || !estado.hp || !estado.pp || !estado.estados) return;
  
  const rivalNombre = rivalNombreGlobal;
  if (!rivalNombre) return;
  
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

  actualizarSprite("jugador-sprite", miPoke, "back");
  actualizarSprite("enemigo-sprite", rivalPoke, "front");
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

// RESOLVER ATAQUE
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
    
    const esEspecial = movimiento.clase === "special";
    await animaciones.reproducirAtaque(movimiento, esEspecial);
    
    const spriteAtacante = atacante === miNombre ? 
      document.getElementById('jugador-sprite')?.parentElement : 
      document.getElementById('enemigo-sprite')?.parentElement;
    const spriteDefensor = atacante === miNombre ? 
      document.getElementById('enemigo-sprite')?.parentElement : 
      document.getElementById('jugador-sprite')?.parentElement;
    
    await animaciones.sacudirPokemon(spriteAtacante);
    await animaciones.sacudirPokemon(spriteDefensor);
    
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
      await animaciones.animarTextoEmergente("No puede moverse", "#ff6666");
      await commitTurno({ hp: nuevosHP, pp: nuevosPP, estados: nuevosEstados, estadisticas: nuevosStats,
        turno: defensor, fase: "elegir", log: "¡" + pokeAtacante.nombre + " no puede moverse!", accion: null });
      animacionEnProceso = false;
      return;
    }

    const precisionMod = obtenerModificadorPrecision(nuevosStats, atacante, indexAtacante);
    if (Math.random() * 100 >= movimiento.precision * precisionMod) {
      await animaciones.animarTextoEmergente("Fallo", "#aaaaaa");
      await commitTurno({ hp: nuevosHP, pp: nuevosPP, estados: nuevosEstados, estadisticas: nuevosStats,
        turno: defensor, fase: "elegir", log: "¡" + pokeAtacante.nombre + " fallo!", accion: null });
      animacionEnProceso = false;
      return;
    }

    let logMsg = "";
    let danoRealizado = 0;

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
      danoRealizado = result.dano;
      
      if (danoRealizado > 0) {
        const rect = spriteDefensor?.getBoundingClientRect();
        const posX = rect ? rect.left + rect.width/2 : window.innerWidth/2;
        const posY = rect ? rect.top + rect.height/2 : window.innerHeight/2;
        await animaciones.mostrarDano(danoRealizado, false, posX, posY);
        await animaciones.flashDamage(spriteDefensor);
      }

      if (movimiento.efecto && danoRealizado > 0 && Math.random() < 0.3) {
        const secResult = aplicarEfectoSecundario(movimiento, pokeDefensor, nuevosStats, defensor, indexDefensor);
        if (secResult.mensaje) {
          logMsg += " " + secResult.mensaje;
          await animaciones.animarTextoEmergente(secResult.mensaje, "#ffcc00", 800);
        }
        nuevosStats = secResult.nuevosStatsResult;
      }
    }

    const postResult = aplicarDanoPostAccion(nuevosHP, nuevosEstados, atacante, defensor, indexAtacante, indexDefensor, pokeAtacante, pokeDefensor);
    nuevosHP = postResult.nuevosHPPost;
    nuevosEstados = postResult.nuevosEstadosPost2;
    if (postResult.mensaje) {
      logMsg += " " + postResult.mensaje;
      await animaciones.animarTextoEmergente(postResult.mensaje, "#ff8888", 1000);
    }

    let nuevaFase = "elegir";
    let nuevoTurno = defensor;

    if (nuevosHP[defensor][indexDefensor] <= 0) {
      nuevosHP[defensor][indexDefensor] = 0;
      logMsg += " ¡" + pokeDefensor.nombre + " se debilito!";
      await animaciones.animarTextoEmergente(pokeDefensor.nombre + " se debilito", "#ff4444", 1200);
      
      if (encontrarSiguientePokemon(nuevosHP[defensor]) === -1) {
        await commitTurno({ hp: nuevosHP, pp: nuevosPP, estados: nuevosEstados, estadisticas: nuevosStats,
          turno: atacante, fase: "fin", ganador: atacante, log: "¡" + atacante + " ha ganado el combate!", accion: null });
        animacionEnProceso = false;
        return;
      }
      nuevaFase = "cambio";
      nuevoTurno = defensor;
      logMsg += " Elige tu siguiente Pokemon.";
    }

    if (nuevosHP[atacante][indexAtacante] <= 0) {
      nuevosHP[atacante][indexAtacante] = 0;
      logMsg += " ¡" + pokeAtacante.nombre + " se debilito!";
      await animaciones.animarTextoEmergente(pokeAtacante.nombre + " se debilito", "#ff4444", 1200);
      
      if (encontrarSiguientePokemon(nuevosHP[atacante]) === -1) {
        await commitTurno({ hp: nuevosHP, pp: nuevosPP, estados: nuevosEstados, estadisticas: nuevosStats,
          turno: defensor, fase: "fin", ganador: defensor, log: "¡" + defensor + " ha ganado el combate!", accion: null });
        animacionEnProceso = false;
        return;
      }
      nuevaFase = "cambio";
      nuevoTurno = atacante;
      logMsg += " Elige tu siguiente Pokemon.";
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

  const nivel = atacante.nivel || 50;
  let damage = Math.floor((((2 * nivel / 5 + 2) * movimiento.poder * attackStat / defenseStat) / 50) + 2);
  damage = Math.floor(damage * stab * effectiveness * weatherMod * (0.85 + Math.random() * 0.15));

  let logMsg = atacante.nombre + " uso " + movimiento.nombre + "!";
  if (stab > 1) logMsg += " STAB";
  if (effectiveness > 1) logMsg += " Es muy eficaz";
  if (effectiveness < 1 && effectiveness > 0) logMsg += " No es muy eficaz";
  if (effectiveness === 0) { logMsg += " No afecta"; damage = 0; }
  if (damage > 0) {
    logMsg += " (-" + damage + " HP)";
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

function aplicarDanoPostAccion(hp, estados, atacante, defensor, indexAtacante, indexDefensor, pokeAtacante, pokeDefensor) {
  const nuevosHP = structuredClone(hp);
  const nuevosEstados = structuredClone(estados);
  const mensajes = [];
  const eAtacante = nuevosEstados[atacante][indexAtacante];

  if (eAtacante.nombre === "QUEMADO") {
    const d = Math.max(1, Math.floor(pokeAtacante.hpMax * 0.0625));
    nuevosHP[atacante][indexAtacante] = Math.max(0, nuevosHP[atacante][indexAtacante] - d);
    mensajes.push(pokeAtacante.nombre + " sufrio daño por quemadura (-" + d + " HP)");
  } else if (eAtacante.nombre === "VENENO") {
    const d = Math.max(1, Math.floor(pokeAtacante.hpMax * 0.125));
    nuevosHP[atacante][indexAtacante] = Math.max(0, nuevosHP[atacante][indexAtacante] - d);
    mensajes.push(pokeAtacante.nombre + " sufrio daño por veneno (-" + d + " HP)");
  } else if (eAtacante.nombre === "VENENO_GRAVE") {
    const acum = eAtacante.acumulador || 1;
    const d = Math.max(1, Math.floor(pokeAtacante.hpMax * 0.0625 * acum));
    nuevosHP[atacante][indexAtacante] = Math.max(0, nuevosHP[atacante][indexAtacante] - d);
    nuevosEstados[atacante][indexAtacante].acumulador = acum + 1;
    mensajes.push(pokeAtacante.nombre + " sufrio daño por veneno grave (-" + d + " HP)");
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
    return { mensaje: defensor.nombre + " quedo " + estadoAplicar + "!", nuevosEstadosResult: nuevosEstados };
  }
  return { mensaje: atacante.nombre + " uso " + movimiento.nombre + ", pero no tuvo efecto.", nuevosEstadosResult: nuevosEstados };
}

function aplicarEfectoSecundario(movimiento, objetivo, estadisticas, jugador, index) {
  const nuevosStats = structuredClone(estadisticas);
  const efecto = movimiento.efecto.toLowerCase();
  const statMap = { "special attack": "spAtk", "special defense": "spDef", "attack": "atk", "defense": "def", "speed": "spd" };
  let stat = null;
  for (const [key, value] of Object.entries(statMap)) { if (efecto.includes(key)) { stat = value; break; } }
  if (stat) {
    if (efecto.includes("lower")) { nuevosStats[jugador][index][stat] = Math.max(-6, nuevosStats[jugador][index][stat] - 1); return { mensaje: "¡El " + stat + " de " + objetivo.nombre + " bajo!", nuevosStatsResult: nuevosStats }; }
    if (efecto.includes("raise")) { nuevosStats[jugador][index][stat] = Math.min(6, nuevosStats[jugador][index][stat] + 1); return { mensaje: "¡El " + stat + " de " + objetivo.nombre + " subio!", nuevosStatsResult: nuevosStats }; }
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

// ACCIONES DEL JUGADOR
async function elegirAtaque(mov, index) {
  console.log("[ATAQUE] Elegido:", mov.nombre);
  
  if (!esMiTurno || animacionEnProceso || esperandoCambio) {
    console.log("[ATAQUE] No se puede atacar - no es tu turno o hay animacion");
    return;
  }

  const ppActual = estadoCombate.pp[miNombre][miIndexActivo][index];
  if (ppActual <= 0) { 
    log("¡No quedan PP para " + mov.nombre + "!"); 
    return; 
  }
  
  animacionEnProceso = true;
  ocultarMenus();
  
  await update(ref(db, `partidas/${partidaId}/combate`), {
    accion: { jugador: miNombre, movIndex: index, movNombre: mov.nombre, movPoder: mov.poder, movTipo: mov.tipo, movClase: mov.clase, movPrecision: mov.precision },
    fase: "resolver"
  });
  
  console.log("[ATAQUE] Accion enviada a Firebase");
}

function mostrarSelectorPokemon() {
  esperandoCambio = true;
  log(cambisForzado ? "Elige tu siguiente Pokemon!" : "Elige un Pokemon:");
  if (!menuCambio) return;
  menuCambio.innerHTML = "<h3 style='color:#ffcb05;margin-bottom:12px;text-align:center'>ELIGE POKEMON</h3>";
  menuCambio.classList.remove("oculto");
  menuPrincipal?.classList.add("oculto");
  menuMovimientos?.classList.add("oculto");
  miEquipo.forEach((poke, i) => {
    const hpActual = estadoCombate.hp[miNombre][i];
    const estadoPoke = estadoCombate.estados[miNombre][i];
    if (hpActual <= 0 || i === miIndexActivo) return;
    const btn = document.createElement("button");
    btn.className = "combate-opcion cambio-pokemon-btn";
    btn.innerHTML = "<div class='poke-nombre'>" + poke.nombre.toUpperCase() + (estadoPoke.nombre ? " [" + estadoPoke.nombre + "]" : "") + "</div><div class='poke-hp'>❤️ " + hpActual + "/" + poke.hpMax + " HP</div>";
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
    log: "¡" + miNombre + " envio a " + nuevoPoke.nombre + "!"
  });
  
  menuCambio?.classList.add("oculto");
  mostrarMenuPrincipal();
}

// UI
function actualizarSprite(id, pokemon, lado) {
  const img = document.getElementById(id);
  if (!img) return;
  const nombrePokemon = pokemon.nombreOriginal || pokemon.nombre;
  img.src = `${SPRITE_BASE[lado]}${nombrePokemon.toLowerCase()}.gif`;
  img.alt = pokemon.nombre;
}

function actualizarInfobar(lado, pokemon, hpActual, estado) {
  const pct = Math.max(0, (hpActual / pokemon.hpMax) * 100);
  const fill = document.getElementById(lado + "-hp-fill");
  if (fill) { 
    fill.style.width = pct + "%"; 
    fill.className = "combate-hpbar-fill" + (pct > 50 ? "" : pct > 20 ? " hp-mid" : " hp-low"); 
  }
  const nomEl = document.getElementById(lado + "-nombre");
  if (nomEl) nomEl.textContent = pokemon.nombre.toUpperCase() + (estado?.nombre ? " [" + estado.nombre + "]" : "");
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
    const ball = document.getElementById(prefijo + "-" + i);
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
    btn.innerHTML = "<span class='mov-nombre'>" + mov.nombre.toUpperCase() + "</span><span class='mov-tipo tipo-" + mov.tipo + "'>" + mov.tipo.toUpperCase() + "</span><span class='mov-pp'>PP: " + ppActuales[i] + "/" + mov.ppMax + "</span><span class='mov-poder'>POD: " + (mov.poder || "--") + "</span>";
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
  menuBolsa?.classList.add("oculto");
}

function ocultarMenus() {
  menuPrincipal?.classList.add("oculto");
  menuMovimientos?.classList.add("oculto");
  menuCambio?.classList.add("oculto");
  menuBolsa?.classList.add("oculto");
}

function log(msg) {
  if (logTxt) logTxt.textContent = msg;
  console.log("[COMBATE]", msg);
}

// BOLSA
const EFECTOS_OBJETO = {
  "ninguno": null,
  "potion": { tipo: "hp", cantidad: 20 },
  "super-potion": { tipo: "hp", cantidad: 50 },
  "hyper-potion": { tipo: "hp", cantidad: 200 },
  "revive": { tipo: "revivir" },
  "full-heal": { tipo: "estado" },
  "ether": { tipo: "pp", cantidad: 10 },
};

function mostrarBolsa() {
  const contenedor = document.getElementById("bolsa-contenido");
  if (!contenedor) return;
  
  contenedor.innerHTML = "<h3 style='color:#ffcb05;margin-bottom:12px;text-align:center'>BOLSA</h3>";
  
  miEquipo.forEach((poke, i) => {
    const hpActual = estadoCombate.hp[miNombre][i];
    const objeto = poke.objeto;
    if (!objeto || objeto === "ninguno") return;
    if (poke.objetoUsado) return;

    const btn = document.createElement("button");
    btn.className = "combate-opcion";
    btn.innerHTML = objeto.nombre + " — " + poke.nombre.toUpperCase() + (hpActual <= 0 && objeto.id !== "revive" ? " (debilitado)" : "");
    
    const efecto = EFECTOS_OBJETO[objeto.id];
    if (!efecto) { btn.disabled = true; return; }
    if (objeto.id !== "revive" && hpActual <= 0) { btn.disabled = true; }

    btn.onclick = () => usarObjeto(i, objeto, efecto);
    contenedor.appendChild(btn);
  });

  menuPrincipal?.classList.add("oculto");
  menuBolsa?.classList.remove("oculto");
}

async function usarObjeto(indexPoke, objeto, efecto) {
  const hpActual = estadoCombate.hp[miNombre][indexPoke];
  const hpMax = miEquipo[indexPoke].hpMax;
  let nuevosHP = structuredClone(estadoCombate.hp);
  let nuevosPP = structuredClone(estadoCombate.pp);
  let nuevosEstados = structuredClone(estadoCombate.estados);
  let logMsg = "";
  let requiereCambio = false;

  switch (efecto.tipo) {
    case "hp":
      if (hpActual >= hpMax) { log("El Pokemon ya tiene HP lleno."); return; }
      nuevosHP[miNombre][indexPoke] = Math.min(hpMax, hpActual + efecto.cantidad);
      logMsg = miNombre + " uso " + objeto.nombre + " en " + miEquipo[indexPoke].nombre + "! (+" + efecto.cantidad + " HP)";
      break;
    case "revivir":
      if (hpActual > 0) { log("El Pokemon no esta debilitado."); return; }
      nuevosHP[miNombre][indexPoke] = Math.floor(hpMax * 0.5);
      logMsg = miEquipo[indexPoke].nombre + " fue revivido con " + Math.floor(hpMax * 0.5) + " HP!";
      break;
    case "estado":
      if (!estadoCombate.estados[miNombre][indexPoke].nombre) { log("El Pokemon no tiene ningun estado alterado."); return; }
      nuevosEstados[miNombre][indexPoke] = { nombre: null, turnosRestantes: 0, acumulador: 0 };
      logMsg = miEquipo[indexPoke].nombre + " fue curado de " + estadoCombate.estados[miNombre][indexPoke].nombre + "!";
      break;
    case "pp":
      nuevosPP[miNombre][indexPoke] = nuevosPP[miNombre][indexPoke].map(pp => pp + efecto.cantidad);
      logMsg = "Se restauraron PP de " + miEquipo[indexPoke].nombre + "!";
      break;
  }

  miEquipo[indexPoke].objetoUsado = true;
  menuBolsa?.classList.add("oculto");

  // Verificar si el Pokemon activo esta debilitado
  const hpActivoActual = nuevosHP[miNombre][miIndexActivo];
  let nuevaFase = "elegir";
  let nuevoTurno = rivalNombreGlobal;

  if (hpActivoActual <= 0) {
    nuevaFase = "cambio";
    nuevoTurno = miNombre; // El jugador debe elegir otro Pokemon
    logMsg += " Tu Pokemon se debilito. Elige otro.";
  }

  await update(ref(db, `partidas/${partidaId}/combate`), {
    hp: nuevosHP,
    pp: nuevosPP,
    estados: nuevosEstados,
    turno: nuevoTurno,
    fase: nuevaFase,
    log: logMsg,
    accion: null
  });
}

// CONFIGURACION DE ANIMACIONES
const ANIMACIONES_MOVIMIENTO = {
  physical: {
    normal: { tipo: 'golpe', sonido: 'punch', color: '#FFFFFF' },
    fighting: { tipo: 'golpe', sonido: 'punch', color: '#FF8000' },
    fire: { tipo: 'fuego', sonido: 'fire', color: '#F08030' },
    water: { tipo: 'agua', sonido: 'water', color: '#6890F0' },
    electric: { tipo: 'rayo', sonido: 'electric', color: '#F8D030' },
    grass: { tipo: 'planta', sonido: 'grass', color: '#78C850' },
    ice: { tipo: 'hielo', sonido: 'ice', color: '#98D8D8' },
    psychic: { tipo: 'psiquico', sonido: 'psychic', color: '#F85888' },
    dragon: { tipo: 'dragon', sonido: 'dragon', color: '#7038F8' },
  },
  special: {
    fire: { tipo: 'fuego_especial', sonido: 'fireball', color: '#F08030' },
    water: { tipo: 'agua_especial', sonido: 'watergun', color: '#6890F0' },
    electric: { tipo: 'rayo_especial', sonido: 'thunder', color: '#F8D030' },
    grass: { tipo: 'planta_especial', sonido: 'leaf', color: '#78C850' },
    ice: { tipo: 'hielo_especial', sonido: 'icebeam', color: '#98D8D8' },
    psychic: { tipo: 'psiquico_especial', sonido: 'psychic', color: '#F85888' },
    dragon: { tipo: 'dragon_especial', sonido: 'dragonbreath', color: '#7038F8' }
  }
};

class AnimacionBatalla {
  constructor() {
    this.overlay = null;
    this.efectoDiv = null;
    this.textoDiv = null;
    this.damagePopup = null;
    this.animando = false;
    this.crearElementos();
  }
  
  crearElementos() {
    if (!document.getElementById('animacion-overlay')) {
      const overlay = document.createElement('div');
      overlay.id = 'animacion-overlay';
      overlay.className = 'oculto';
      overlay.innerHTML = '<div class="efecto-visual"></div><div class="texto-animacion"></div>';
      document.body.appendChild(overlay);
    }
    
    if (!document.getElementById('animacion-damage')) {
      const damageDiv = document.createElement('div');
      damageDiv.id = 'animacion-damage';
      damageDiv.className = 'oculto';
      damageDiv.innerHTML = '<div class="damage-number"></div>';
      document.body.appendChild(damageDiv);
    }
    
    this.overlay = document.getElementById('animacion-overlay');
    this.efectoDiv = document.querySelector('.efecto-visual');
    this.textoDiv = document.querySelector('.texto-animacion');
    this.damagePopup = document.getElementById('animacion-damage');
  }
  
  async reproducirAtaque(movimiento, esEspecial = false) {
    if (this.animando) return;
    this.animando = true;
    
    const animConfig = this.getAnimacionConfig(movimiento, esEspecial);
    
    if (this.overlay) {
      this.overlay.classList.remove('oculto');
      if (this.efectoDiv) {
        this.efectoDiv.className = 'efecto-visual ' + animConfig.tipo;
      }
      if (this.textoDiv) {
        this.textoDiv.textContent = movimiento.nombre.toUpperCase();
        this.textoDiv.style.color = animConfig.color;
      }
    }
    
    await new Promise(resolve => setTimeout(resolve, 600));
    
    if (this.overlay) this.overlay.classList.add('oculto');
    this.animando = false;
  }
  
getAnimacionConfig(movimiento, esEspecial) {
  const tipo = movimiento.tipo;
  const clase = esEspecial ? 'special' : 'physical';
  // Crear copia del objeto para no mutar el original
  const config = { ...(ANIMACIONES_MOVIMIENTO[clase]?.[tipo] || ANIMACIONES_MOVIMIENTO.physical.normal) };
  config.tx = esEspecial ? '150px' : '-150px';
  config.ty = '0px';
  return config;
}
  
  async mostrarDano(damage, esCritico = false, posX, posY) {
    if (!this.damagePopup) return;
    
    const damageSpan = this.damagePopup.querySelector('.damage-number');
    if (damageSpan) {
      damageSpan.textContent = '-' + damage;
    }
    
    this.damagePopup.classList.remove('oculto');
    
    if (esCritico) {
      this.damagePopup.classList.add('critico');
    } else {
      this.damagePopup.classList.remove('critico');
    }
    
    this.damagePopup.style.left = posX + 'px';
    this.damagePopup.style.top = posY + 'px';
    
    await new Promise(resolve => setTimeout(resolve, 800));
    this.damagePopup.classList.add('oculto');
  }
  
  async sacudirPokemon(elemento) {
    if (!elemento) return;
    elemento.classList.add('shaking');
    await new Promise(resolve => setTimeout(resolve, 300));
    elemento.classList.remove('shaking');
  }
  
  async flashDamage(elemento) {
    if (!elemento) return;
    elemento.classList.add('flash-damage');
    await new Promise(resolve => setTimeout(resolve, 200));
    elemento.classList.remove('flash-damage');
  }
  
  async animarTextoEmergente(texto, color = '#FFFFFF', duracion = 1000) {
    const textoAnim = document.createElement('div');
    textoAnim.textContent = texto;
    textoAnim.style.cssText = 'position: fixed; left: 50%; top: 50%; transform: translate(-50%, -50%); color: ' + color + '; font-size: 1.5rem; font-weight: bold; text-shadow: 2px 2px 4px black; z-index: 2002; animation: flotarTexto ' + (duracion/1000) + 's ease-out forwards; pointer-events: none;';
    document.body.appendChild(textoAnim);
    await new Promise(resolve => setTimeout(resolve, duracion));
    textoAnim.remove();
  }
  
  async animarEstado(pokemonElement, estado) {
    await this.animarTextoEmergente(estado, '#ffcc00', 1000);
  }
}

const animaciones = new AnimacionBatalla();

// EVENTOS
btnLuchar?.addEventListener("click", () => {
  if (!esMiTurno || esperandoCambio || animacionEnProceso) return;
  menuPrincipal?.classList.add("oculto");
  menuMovimientos?.classList.remove("oculto");
});

btnPokemon?.addEventListener("click", () => {
  if (!esMiTurno || esperandoCambio || animacionEnProceso) return;
  cambisForzado = false;
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

// FIN DEL COMBATE
async function finalizarCombate(ganador) {
  if (window.combateFinalizado) return;
  window.combateFinalizado = true;
  
  ocultarMenus();
  
  const esVictoria = ganador === miNombre;
  const perdedor = esVictoria ? rivalNombreGlobal : miNombre;
  
  mostrarPantallaFin(esVictoria, ganador);
  
  try {
    await update(ref(db, `partidas/${partidaId}`), {
      estado: "finalizado",
      ganador: ganador,
      perdedor: perdedor,
      fechaFin: Date.now()
    });
    
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
}

function mostrarPantallaFin(esVictoria, ganador) {
  let overlay = document.getElementById("fin-overlay");
  if (!overlay) {
    overlay = document.createElement("div");
    overlay.id = "fin-overlay";
    document.body.appendChild(overlay);
  }
  
  const statsRef = ref(db, `estadisticas/${miNombre}`);
  get(statsRef).then((snap) => {
    const stats = snap.val() || { victorias: 0, derrotas: 0, batallas: 0 };
    overlay.innerHTML = `
      <div class="fin-contenido">
        <h1 class="fin-titulo ${esVictoria ? 'victoria' : 'derrota'}">
          ${esVictoria ? 'VICTORIA' : 'DERROTA'}
        </h1>
        <p class="fin-mensaje">${esVictoria ? 'Felicidades! Has derrotado a ' + rivalNombreGlobal : ganador + ' te ha derrotado'}</p>
        <div class="fin-stats">
          <p>Victorias: ${stats.victorias}</p>
          <p>Derrotas: ${stats.derrotas}</p>
          <p>Batallas totales: ${stats.batallas}</p>
        </div>
        <div>
          <button class="fin-boton" id="fin-volver-menu">VOLVER AL MENU</button>
          <button class="fin-boton secondary" id="fin-ver-estadisticas">VER ESTADISTICAS</button>
        </div>
      </div>
    `;
    
    document.getElementById("fin-volver-menu")?.addEventListener("click", () => {
      window.location.href = "Juego-Lobby.html?id=" + partidaId;
    });
    
    document.getElementById("fin-ver-estadisticas")?.addEventListener("click", () => {
      window.location.href = "Estadisticas.html";
    });
  });
}

// INICIAR
iniciarCombate();