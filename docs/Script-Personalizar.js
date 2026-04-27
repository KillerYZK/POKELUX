const idPokemon = localStorage.getItem("pokemonConfigurar");

document.getElementById("Equipo").addEventListener("click", () => {
  window.location.href = "Equipo.html";
});

const OBJETOS = [
  { id: "ninguno", nombre: "Sin objeto", api: null },
  { id: "potion", nombre: "Pocion", api: "potion" },
  { id: "super-potion", nombre: "Super Pocion", api: "super-potion" },
  { id: "hyper-potion", nombre: "Hiper Pocion", api: "hyper-potion" },
  { id: "revive", nombre: "Revivir", api: "revive" },
  { id: "full-heal", nombre: "Cura Total", api: "full-heal" },
  { id: "ether", nombre: "Eter", api: "ether" },
];

let objetoSeleccionado = "ninguno";

async function cargarSpritesObjetos() {
  const contenedor = document.getElementById("objeto-opciones");
  contenedor.innerHTML = "";

  for (const obj of OBJETOS) {
    let spriteUrl = "";

    if (obj.api) {
      try {
        const res = await fetch(`https://pokeapi.co/api/v2/item/${obj.api}`);
        const data = await res.json();
        spriteUrl = data.sprites?.default || "";
      } catch {
        spriteUrl = "";
      }
    }

    const btn = document.createElement("button");
    btn.className = "objeto-btn";
    btn.dataset.id = obj.id;
    btn.type = "button";
    btn.innerHTML = `
      ${spriteUrl ? `<img src="${spriteUrl}" alt="${obj.nombre}" />` : ""}
      <span>${obj.nombre}</span>
    `;

    btn.addEventListener("click", () => {
      document.querySelectorAll(".objeto-btn").forEach(b => b.classList.remove("seleccionado"));
      btn.classList.add("seleccionado");
      objetoSeleccionado = obj.id;
    });

    contenedor.appendChild(btn);
  }

  // Restaurar seleccion guardada
  const configGuardada = JSON.parse(localStorage.getItem(`configuracion-${idPokemon}`)) || {};
  if (configGuardada.objeto) {
    objetoSeleccionado = configGuardada.objeto;
    const btnGuardado = contenedor.querySelector(`[data-id="${configGuardada.objeto}"]`);
    if (btnGuardado) btnGuardado.classList.add("seleccionado");
  } else {
    const btnNinguno = contenedor.querySelector(`[data-id="ninguno"]`);
    if (btnNinguno) btnNinguno.classList.add("seleccionado");
  }
}

async function cargarPokemon() {
  const resultado = await fetch(`https://pokeapi.co/api/v2/pokemon/${idPokemon}`);
  const datos = await resultado.json();

  document.getElementById("nombre-pokemon").textContent = datos.name;
  document.getElementById("imagen-pokemon").src =
    `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/${idPokemon}.png`;

  const contenedorStats = document.getElementById("stats");
  contenedorStats.innerHTML = `
    <p>HP: ${datos.stats[0].base_stat}</p>
    <p>ATQ: ${datos.stats[1].base_stat}</p>
    <p>DEF: ${datos.stats[2].base_stat}</p>
    <p>Sp ATQ: ${datos.stats[3].base_stat}</p>
    <p>Sp DEF: ${datos.stats[4].base_stat}</p>
    <p>SPD: ${datos.stats[5].base_stat}</p>
  `;

  const movimientos = datos.moves.map((movimiento) => movimiento.move.name);
  const selects = document.querySelectorAll("[id^='movimiento-']");
  selects.forEach((select, index) => {
    select.innerHTML = `<option value="">Movimiento ${index + 1}</option>`;
    movimientos.forEach((mov) => {
      select.innerHTML += `<option value="${mov}">${mov}</option>`;
    });
  });

  // Restaurar configuracion guardada
  const configGuardada = JSON.parse(localStorage.getItem(`configuracion-${idPokemon}`)) || {};
  if (configGuardada.apodo) document.getElementById("apodo").value = configGuardada.apodo;
  if (configGuardada.nivel) document.getElementById("nivel").value = configGuardada.nivel;
  if (configGuardada.genero) document.getElementById("genero").value = configGuardada.genero;
  if (configGuardada.shiny) document.getElementById("shiny").checked = configGuardada.shiny;
  if (configGuardada.movimientos) {
    configGuardada.movimientos.forEach((mov, i) => {
      const sel = document.getElementById(`movimiento-${i + 1}`);
      if (sel) sel.value = mov;
    });
  }

  await cargarSpritesObjetos();
}

cargarPokemon();

document.getElementById("guardar").addEventListener("click", () => {
  const esShiny = document.getElementById("shiny").checked;

  const configuracion = {
    apodo: document.getElementById("apodo").value,
    nivel: document.getElementById("nivel").value,
    genero: document.getElementById("genero").value,
    shiny: esShiny,
    sprite: esShiny
      ? `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/shiny/${idPokemon}.png`
      : `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/${idPokemon}.png`,
    movimientos: [
      document.getElementById("movimiento-1").value,
      document.getElementById("movimiento-2").value,
      document.getElementById("movimiento-3").value,
      document.getElementById("movimiento-4").value,
    ],
    objeto: objetoSeleccionado,
  };

  localStorage.setItem(`configuracion-${idPokemon}`, JSON.stringify(configuracion));
  window.location.href = "Equipo.html";
});

// Función para guardar configuración en Firebase
async function guardarConfiguracionEnFirebase(partidaId, pokemonId, configuracion) {
  const db = getDatabase(app); // Asegurate de tener importada la DB
  await set(ref(db, `partidas/${partidaId}/configuraciones/${pokemonId}`), configuracion);
}
