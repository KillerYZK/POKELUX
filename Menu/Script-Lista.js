// Codigo de la paginación
let paginaActual = 1;
let input = document.getElementById("input-busqueda").value;

document.getElementById("boton-siguiente").addEventListener("click", () => {
  if (paginaActual != 68 && input == "") {
    paginaActual++;
    document.getElementById("cartas-pokemon").innerHTML = "";
    obtenerPokemon();
  }
});

document.getElementById("boton-anterior").addEventListener("click", () => {
  if (paginaActual > 1 && input == "") {
    paginaActual--;
    document.getElementById("cartas-pokemon").innerHTML = "";
    obtenerPokemon();
  }
});

document.getElementById("boton-inicio").addEventListener("click", () => {
  if (input == "") {
    paginaActual = 1;
    document.getElementById("cartas-pokemon").innerHTML = "";
    obtenerPokemon();
  }
});

document.getElementById("boton-final").addEventListener("click", () => {
  if (input == "") {
    paginaActual = 68;
    document.getElementById("cartas-pokemon").innerHTML = "";
    obtenerPokemon();
  }
});

//Listado de pokemons
async function obtenerPokemon() {
  const listado = await fetch(
    `https://pokeapi.co/api/v2/pokemon?limit=20&offset=${(paginaActual - 1) * 20}`,
  );
  const listadojson = await listado.json();

  listadojson.results.forEach((pokemon) => {
    const cartapokemon = crearCarta(pokemon);
    document.getElementById("cartas-pokemon").appendChild(cartapokemon);
  });
}

obtenerPokemon();

// Codigo de la barra de busqueda
async function buscarPokemon() {
  const input = document.getElementById("input-busqueda");
  const boton = document.getElementById("boton-busqueda");

  input.addEventListener("input", async () => {
    const valor = input.value.toLowerCase();
    if (valor !== "") {
      const busqueda = await fetch(
        `https://pokeapi.co/api/v2/pokemon/${valor}`,
      );
      if (busqueda.ok) {
        const pokemon = await busqueda.json();
        document.getElementById("cartas-pokemon").innerHTML = "";
        document
          .getElementById("cartas-pokemon")
          .appendChild(crearCarta(pokemon));
      } else {
        document.getElementById("cartas-pokemon").innerHTML = "";
        obtenerPokemon();
        return;
      }
    } else {
      obtenerPokemon();
    }
  });
}

buscarPokemon();

function crearCarta(pokemon) {
  const cartapokemon = document.createElement("div");
  const idPokemon = pokemon.url
    ? parseInt(pokemon.url.split("/")[6])
    : pokemon.id;
  cartapokemon.classList.add("carta-pokemon");
  cartapokemon.innerHTML = `
      <img
        class="imagen-pokemon"
        src="https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/${idPokemon}.png"
      />
      <p class="nombre-pokemon">${pokemon.name}</p>
      <p class="id-pokemon">ID: ${idPokemon}</p>
      <button class="boton-anadir">Añadir al equipo</button>
    `;

  //guardar pokemons en localStorage para poder añadirlos al equipo
  cartapokemon.querySelector(".boton-anadir").addEventListener("click", () => {
    const equipo = JSON.parse(localStorage.getItem("equipo")) || [];

    if (equipo.length >= 6) {
      alert("Tu equipo ya tiene 6 pokemons!");
      return;
    }

    equipo.push(idPokemon);
    localStorage.setItem("equipo", JSON.stringify(equipo));
    alert(`${pokemon.name} ha sido añadido a tu equipo! (${equipo.length}/6)`);
  });
  return cartapokemon;
}

//Codigo para los filtros por tipo

document.querySelectorAll("input[name='tipo']").forEach((checkbox) => {
  checkbox.addEventListener("change", () => {
    const tiposSeleccionados = Array.from(
      document.querySelectorAll("input[name='tipo']:checked"),
    ).map((checkbox) => checkbox.value);
    filtrarPorTipos(tiposSeleccionados);
    if (document.querySelectorAll("input[name='tipo']:checked").length === 0) {
      obtenerPokemon();
    }
  });

  async function filtrarPorTipos(tipos) {
    const contenedorCartasT = document.getElementById("cartas-pokemon");
    contenedorCartasT.innerHTML = "";

    for (const tipo of tipos) {
      const respuesta = await fetch(`https://pokeapi.co/api/v2/type/${tipo}`);
      const datos = await respuesta.json();
      const pokemonsDelTipo = datos.pokemon;
      pokemonsDelTipo.forEach((pokemon) => {
        const cartapokemon = crearCarta(pokemon.pokemon);
        contenedorCartasT.appendChild(cartapokemon);
      });
    }
  }
});

//Código para filtros por generación

document.querySelectorAll("input[name='generacion']").forEach((checkbox) => {
  checkbox.addEventListener("change", () => {
    const generacionesSeleccionadas = Array.from(
      document.querySelectorAll("input[name='generacion']:checked"),
    ).map((checkbox) => checkbox.value);
    filtrarPorGeneraciones(generacionesSeleccionadas);
    if (
      document.querySelectorAll("input[name='generacion']:checked").length === 0
    ) {
      obtenerPokemon();
    }
  });
});

async function filtrarPorGeneraciones(generaciones) {
  const contenedorCartasG = document.getElementById("cartas-pokemon");
  contenedorCartasG.innerHTML = "";
  const pokemonsDeGeneracion = [];
  for (const generacion of generaciones) {
    const respuesta = await fetch(
      `https://pokeapi.co/api/v2/generation/${generacion}`,
    );
    const datos = await respuesta.json();
    pokemonsDeGeneracion.push(...datos.pokemon_species);
  }
  pokemonsDeGeneracion.forEach((pokemon) => {
    const cartapokemon = crearCarta(pokemon);
    contenedorCartasG.appendChild(cartapokemon);
  });
}

//Exportar funciones
