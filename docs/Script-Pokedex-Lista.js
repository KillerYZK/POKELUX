// ── POKEDEX COMPLETA CON SCROLL INFINITO ─────────────────────────

let paginaActual = 1;
let totalPaginas = 68;
let busquedaActiva = false;
let cargandoMas = false;
let filtrosActivos = { tipos: [], generaciones: [] };
let pokemonsCargados = [];

// DOM Elements
const cartasContainer = document.getElementById("cartas-pokemon");
const loadingOverlay = document.getElementById("loading-overlay");
const inputBusqueda = document.getElementById("input-busqueda");
const botonBusqueda = document.getElementById("boton-busqueda");
const vistaLista = document.getElementById("vista-lista");
const vistaDetalle = document.getElementById("vista-detalle");
const detalleContenido = document.getElementById("detalle-contenido");

// Mostrar/Ocultar loading
function showLoading() {
  loadingOverlay.style.display = "flex";
}

function hideLoading() {
  loadingOverlay.style.display = "none";
}

// Mostrar loading infinito al final
function showInfiniteLoading() {
  const infiniteLoader = document.createElement("div");
  infiniteLoader.id = "infinite-loader";
  infiniteLoader.className = "infinite-loader";
  infiniteLoader.innerHTML = `
    <div class="loading-spinner-small"></div>
    <p>Cargando más Pokémon...</p>
  `;
  cartasContainer.appendChild(infiniteLoader);
}

function hideInfiniteLoading() {
  const loader = document.getElementById("infinite-loader");
  if (loader) loader.remove();
}

// Mostrar vista de lista
function mostrarLista() {
  vistaLista.style.display = "block";
  vistaDetalle.style.display = "none";
}

// Mostrar vista de detalle
function mostrarDetalle() {
  vistaLista.style.display = "none";
  vistaDetalle.style.display = "block";
}

// Verificar si el usuario llegó al final
function checkScroll() {
  if (busquedaActiva || cargandoMas) return;
  if (filtrosActivos.tipos.length > 0 || filtrosActivos.generaciones.length > 0) return;
  
  const scrollY = window.scrollY;
  const windowHeight = window.innerHeight;
  const documentHeight = document.documentElement.scrollHeight;
  
  if (scrollY + windowHeight >= documentHeight - 300) {
    cargarMasPokemon();
  }
}

// Cargar más Pokémon (scroll infinito)
async function cargarMasPokemon() {
  if (cargandoMas || paginaActual >= totalPaginas || busquedaActiva) return;
  
  cargandoMas = true;
  paginaActual++;
  showInfiniteLoading();
  
  try {
    const offset = (paginaActual - 1) * 20;
    const response = await fetch(`https://pokeapi.co/api/v2/pokemon?limit=20&offset=${offset}`);
    const data = await response.json();
    
    for (const pokemon of data.results) {
      const carta = await crearCarta(pokemon);
      cartasContainer.appendChild(carta);
      pokemonsCargados.push(pokemon.name);
    }
    
    document.getElementById("page-info").textContent = `Página ${paginaActual} / ${totalPaginas}`;
  } catch (error) {
    console.error("Error cargando más Pokémon:", error);
  }
  
  hideInfiniteLoading();
  cargandoMas = false;
}

// Obtener Pokémon por página (inicial)
async function obtenerPokemon() {
  if (busquedaActiva) return;
  
  showLoading();
  cartasContainer.innerHTML = "";
  pokemonsCargados = [];
  paginaActual = 1;
  
  try {
    const offset = (paginaActual - 1) * 20;
    const response = await fetch(`https://pokeapi.co/api/v2/pokemon?limit=20&offset=${offset}`);
    const data = await response.json();
    
    for (const pokemon of data.results) {
      const carta = await crearCarta(pokemon);
      cartasContainer.appendChild(carta);
      pokemonsCargados.push(pokemon.name);
    }
    
    document.getElementById("page-info").textContent = `Página ${paginaActual} / ${totalPaginas}`;
  } catch (error) {
    console.error("Error al cargar Pokémon:", error);
  }
  
  hideLoading();
}

// Crear carta de Pokémon
async function crearCarta(pokemon) {
  const idPokemon = pokemon.url ? parseInt(pokemon.url.split("/")[6]) : pokemon.id;
  
  let tipos = [];
  try {
    const res = await fetch(`https://pokeapi.co/api/v2/pokemon/${idPokemon}`);
    const data = await res.json();
    tipos = data.types.map(t => t.type.name);
  } catch (e) {
    console.error("Error obteniendo tipos:", e);
  }
  
  const carta = document.createElement("div");
  carta.className = "carta-pokemon";
  
  carta.innerHTML = `
    <img class="imagen-pokemon" src="https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/${idPokemon}.png" alt="${pokemon.name}">
    <p class="nombre-pokemon">${pokemon.name}</p>
    <p class="id-pokemon">#${String(idPokemon).padStart(3, "0")}</p>
    <div class="pokemon-types">
      ${tipos.map(t => `<span class="type-badge type-${t}">${t.toUpperCase()}</span>`).join("")}
    </div>
  `;
  
  carta.addEventListener("click", () => {
    cargarDetallePokemon(idPokemon, pokemon.name);
  });
  
  return carta;
}

// Cargar detalle completo del Pokémon
async function cargarDetallePokemon(id, nombre) {
  showLoading();
  mostrarDetalle();
  
  try {
    const [pokeRes, speciesRes] = await Promise.all([
      fetch(`https://pokeapi.co/api/v2/pokemon/${id}`),
      fetch(`https://pokeapi.co/api/v2/pokemon-species/${id}`)
    ]);
    
    const pokemon = await pokeRes.json();
    const species = await speciesRes.json();
    
    const tipos = pokemon.types.map(t => t.type.name);
    const stats = {
      hp: pokemon.stats.find(s => s.stat.name === "hp")?.base_stat || 0,
      attack: pokemon.stats.find(s => s.stat.name === "attack")?.base_stat || 0,
      defense: pokemon.stats.find(s => s.stat.name === "defense")?.base_stat || 0,
      spAttack: pokemon.stats.find(s => s.stat.name === "special-attack")?.base_stat || 0,
      spDefense: pokemon.stats.find(s => s.stat.name === "special-defense")?.base_stat || 0,
      speed: pokemon.stats.find(s => s.stat.name === "speed")?.base_stat || 0
    };
    
    const maxStat = 255;
    const statPercent = {
      hp: (stats.hp / maxStat) * 100,
      attack: (stats.attack / maxStat) * 100,
      defense: (stats.defense / maxStat) * 100,
      spAttack: (stats.spAttack / maxStat) * 100,
      spDefense: (stats.spDefense / maxStat) * 100,
      speed: (stats.speed / maxStat) * 100
    };
    
    const flavor = species.flavor_text_entries.find(e => e.language.name === "es") 
      || species.flavor_text_entries.find(e => e.language.name === "en");
    
    let evolutionHtml = '<div class="evolution-chain-detalle">';
    if (species.evolution_chain) {
      const evoRes = await fetch(species.evolution_chain.url);
      const evoData = await evoRes.json();
      const chain = [];
      
      function walkChain(node) {
        chain.push(node.species.name);
        if (node.evolves_to.length) walkChain(node.evolves_to[0]);
      }
      walkChain(evoData.chain);
      
      for (let i = 0; i < chain.length; i++) {
        if (i > 0) evolutionHtml += '<span style="color:var(--magenta); font-size:1.2rem;">→</span>';
        const evoId = await getPokemonId(chain[i]);
        evolutionHtml += `
          <div class="evo-item-detalle" onclick="cargarDetallePokemon(${evoId}, '${chain[i]}')">
            <img src="https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/${evoId}.png" alt="${chain[i]}">
            <span>${chain[i]}</span>
          </div>
        `;
      }
    }
    evolutionHtml += '</div>';
    
    detalleContenido.innerHTML = `
      <div class="pokemon-detalle-campo">
        <div class="detalle-top">
          <div class="detalle-sprite">
            <img src="https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/${id}.png" alt="${nombre}">
            <div class="detalle-types">
              ${tipos.map(t => `<span class="type-badge type-${t}">${t.toUpperCase()}</span>`).join("")}
            </div>
          </div>
          <div class="detalle-info">
            <div>
              <span class="detalle-number">#${String(id).padStart(3, "0")}</span>
              <h2 class="detalle-nombre">${nombre}</h2>
            </div>
            <div class="detalle-stats">
              <h3>ESTADÍSTICAS BASE</h3>
              <div class="stats-detalle">
                <div class="stat-detalle">
                  <span class="stat-name-detalle">HP</span>
                  <span class="stat-value-detalle">${stats.hp}</span>
                  <div class="stat-bar-detalle"><div class="stat-fill-detalle" style="width: ${statPercent.hp}%"></div></div>
                </div>
                <div class="stat-detalle">
                  <span class="stat-name-detalle">ATAQUE</span>
                  <span class="stat-value-detalle">${stats.attack}</span>
                  <div class="stat-bar-detalle"><div class="stat-fill-detalle" style="width: ${statPercent.attack}%"></div></div>
                </div>
                <div class="stat-detalle">
                  <span class="stat-name-detalle">DEFENSA</span>
                  <span class="stat-value-detalle">${stats.defense}</span>
                  <div class="stat-bar-detalle"><div class="stat-fill-detalle" style="width: ${statPercent.defense}%"></div></div>
                </div>
                <div class="stat-detalle">
                  <span class="stat-name-detalle">ATAQUE ESP.</span>
                  <span class="stat-value-detalle">${stats.spAttack}</span>
                  <div class="stat-bar-detalle"><div class="stat-fill-detalle" style="width: ${statPercent.spAttack}%"></div></div>
                </div>
                <div class="stat-detalle">
                  <span class="stat-name-detalle">DEFENSA ESP.</span>
                  <span class="stat-value-detalle">${stats.spDefense}</span>
                  <div class="stat-bar-detalle"><div class="stat-fill-detalle" style="width: ${statPercent.spDefense}%"></div></div>
                </div>
                <div class="stat-detalle">
                  <span class="stat-name-detalle">VELOCIDAD</span>
                  <span class="stat-value-detalle">${stats.speed}</span>
                  <div class="stat-bar-detalle"><div class="stat-fill-detalle" style="width: ${statPercent.speed}%"></div></div>
                </div>
              </div>
            </div>
          </div>
        </div>
        
        <div class="detalle-abilities">
          <h3>HABILIDADES</h3>
          <div class="abilities-detalle">
            ${pokemon.abilities.map(a => `<span class="ability-detalle ${a.is_hidden ? 'hidden' : ''}">${a.ability.name}${a.is_hidden ? ' (Oculta)' : ''}</span>`).join("")}
          </div>
        </div>
        
        <div class="detalle-flavor">
          <p>"${flavor?.flavor_text.replace(/\f|\n/g, " ") || "Sin descripción disponible"}"</p>
        </div>
        
        <div class="detalle-evolution">
          <h3>CADENA EVOLUTIVA</h3>
          ${evolutionHtml}
        </div>
      </div>
    `;
    
  } catch (error) {
    console.error("Error cargando detalle:", error);
    detalleContenido.innerHTML = `<div class="no-results">❌ Error al cargar los detalles de ${nombre}</div>`;
  }
  
  hideLoading();
}

// Obtener ID de Pokémon por nombre
async function getPokemonId(name) {
  try {
    const res = await fetch(`https://pokeapi.co/api/v2/pokemon/${name}`);
    const data = await res.json();
    return data.id;
  } catch {
    return 0;
  }
}

// Búsqueda de Pokémon
async function buscarPokemon() {
  const valor = inputBusqueda.value.trim().toLowerCase();
  
  if (valor === "") {
    busquedaActiva = false;
    filtrosActivos = { tipos: [], generaciones: [] };
    await obtenerPokemon();
    return;
  }
  
  busquedaActiva = true;
  showLoading();
  cartasContainer.innerHTML = "";
  
  try {
    const response = await fetch(`https://pokeapi.co/api/v2/pokemon/${valor}`);
    if (response.ok) {
      const pokemon = await response.json();
      const carta = await crearCarta({
        name: pokemon.name,
        url: `https://pokeapi.co/api/v2/pokemon/${pokemon.id}/`
      });
      cartasContainer.appendChild(carta);
    } else {
      cartasContainer.innerHTML = `<div class="no-results">❌ No se encontró el Pokémon "${valor}"</div>`;
    }
  } catch (error) {
    cartasContainer.innerHTML = `<div class="no-results">❌ Error al buscar "${valor}"</div>`;
  }
  
  hideLoading();
}

// Filtro por tipos
async function filtrarPorTipos(tiposSeleccionados) {
  filtrosActivos.tipos = tiposSeleccionados;
  filtrosActivos.generaciones = [];
  
  if (tiposSeleccionados.length === 0 && filtrosActivos.generaciones.length === 0) {
    busquedaActiva = false;
    await obtenerPokemon();
    return;
  }
  
  busquedaActiva = true;
  showLoading();
  cartasContainer.innerHTML = "";
  
  const pokemonsMap = new Map();
  
  for (const tipo of tiposSeleccionados) {
    const response = await fetch(`https://pokeapi.co/api/v2/type/${tipo}`);
    const data = await response.json();
    
    for (const p of data.pokemon) {
      if (!pokemonsMap.has(p.pokemon.name)) {
        pokemonsMap.set(p.pokemon.name, p.pokemon);
      }
    }
  }
  
  const pokemonsUnicos = Array.from(pokemonsMap.values()).slice(0, 50);
  
  for (const pokemon of pokemonsUnicos) {
    const carta = await crearCarta(pokemon);
    cartasContainer.appendChild(carta);
  }
  
  hideLoading();
}

// Filtro por generaciones
async function filtrarPorGeneraciones(generacionesSeleccionadas) {
  filtrosActivos.generaciones = generacionesSeleccionadas;
  filtrosActivos.tipos = [];
  
  if (generacionesSeleccionadas.length === 0 && filtrosActivos.tipos.length === 0) {
    busquedaActiva = false;
    await obtenerPokemon();
    return;
  }
  
  busquedaActiva = true;
  showLoading();
  cartasContainer.innerHTML = "";
  
  const pokemonsMap = new Map();
  
  for (const gen of generacionesSeleccionadas) {
    const response = await fetch(`https://pokeapi.co/api/v2/generation/${gen}`);
    const data = await response.json();
    
    for (const p of data.pokemon_species) {
      if (!pokemonsMap.has(p.name)) {
        pokemonsMap.set(p.name, { name: p.name, url: `https://pokeapi.co/api/v2/pokemon/${p.name}/` });
      }
    }
  }
  
  const pokemonsUnicos = Array.from(pokemonsMap.values()).slice(0, 50);
  
  for (const pokemon of pokemonsUnicos) {
    const carta = await crearCarta(pokemon);
    cartasContainer.appendChild(carta);
  }
  
  hideLoading();
}

// Pokémon aleatorio
async function randomPokemon() {
  const randomId = Math.floor(Math.random() * 1025) + 1;
  inputBusqueda.value = randomId;
  await buscarPokemon();
}

// Resetear filtros
function resetFilters() {
  document.querySelectorAll("input[name='tipo']").forEach(cb => cb.checked = false);
  document.querySelectorAll("input[name='generacion']").forEach(cb => cb.checked = false);
  filtrosActivos = { tipos: [], generaciones: [] };
  busquedaActiva = false;
  inputBusqueda.value = "";
  obtenerPokemon();
}

// Configurar eventos de paginación (botones tradicionales)
function setupPagination() {
  document.getElementById("boton-siguiente").addEventListener("click", () => {
    if (!busquedaActiva && filtrosActivos.tipos.length === 0 && filtrosActivos.generaciones.length === 0) {
      if (paginaActual < totalPaginas) {
        paginaActual++;
        obtenerPokemon();
      }
    }
  });
  
  document.getElementById("boton-anterior").addEventListener("click", () => {
    if (!busquedaActiva && filtrosActivos.tipos.length === 0 && filtrosActivos.generaciones.length === 0) {
      if (paginaActual > 1) {
        paginaActual--;
        obtenerPokemon();
      }
    }
  });
  
  document.getElementById("boton-inicio").addEventListener("click", () => {
    if (!busquedaActiva && filtrosActivos.tipos.length === 0 && filtrosActivos.generaciones.length === 0) {
      paginaActual = 1;
      obtenerPokemon();
    }
  });
  
  document.getElementById("boton-final").addEventListener("click", () => {
    if (!busquedaActiva && filtrosActivos.tipos.length === 0 && filtrosActivos.generaciones.length === 0) {
      paginaActual = totalPaginas;
      obtenerPokemon();
    }
  });
}

// Configurar filtros
function setupFilters() {
  const checkboxesTipo = document.querySelectorAll("input[name='tipo']");
  const checkboxesGen = document.querySelectorAll("input[name='generacion']");
  
  checkboxesTipo.forEach(checkbox => {
    checkbox.addEventListener("change", () => {
      const tiposSeleccionados = Array.from(checkboxesTipo)
        .filter(cb => cb.checked)
        .map(cb => cb.value);
      
      checkboxesGen.forEach(cb => cb.checked = false);
      filtrarPorTipos(tiposSeleccionados);
    });
  });
  
  checkboxesGen.forEach(checkbox => {
    checkbox.addEventListener("change", () => {
      const generacionesSeleccionadas = Array.from(checkboxesGen)
        .filter(cb => cb.checked)
        .map(cb => parseInt(cb.value));
      
      checkboxesTipo.forEach(cb => cb.checked = false);
      filtrarPorGeneraciones(generacionesSeleccionadas);
    });
  });
}

// Eventos
document.getElementById("btn-volver-lista").addEventListener("click", () => {
  mostrarLista();
  resetFilters();
});

botonBusqueda.addEventListener("click", buscarPokemon);
inputBusqueda.addEventListener("keypress", (e) => {
  if (e.key === "Enter") buscarPokemon();
});
document.getElementById("randomBtn").addEventListener("click", randomPokemon);

// Scroll infinito
window.addEventListener("scroll", checkScroll);

// Exponer función global para evoluciones
window.cargarDetallePokemon = cargarDetallePokemon;

// Inicializar
setupPagination();
setupFilters();
obtenerPokemon();