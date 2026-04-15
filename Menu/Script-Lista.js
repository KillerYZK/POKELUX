// Codigo de la paginación
let paginaActual = 1;

document.getElementById("boton-siguiente").addEventListener("click", () => {
  paginaActual++;
  document.getElementById("cartas-pokemon").innerHTML = "";
  obtenerPokemon();
});

document.getElementById("boton-anterior").addEventListener("click", () => {
  if (paginaActual > 1) {
    paginaActual--;
    document.getElementById("cartas-pokemon").innerHTML = "";
    obtenerPokemon();
  }
});

document.getElementById("boton-inicio").addEventListener("click", () => {
  paginaActual = 1;
  document.getElementById("cartas-pokemon").innerHTML = "";
  obtenerPokemon();
});

document.getElementById("boton-final").addEventListener("click", () => {
  paginaActual = 52;
  document.getElementById("cartas-pokemon").innerHTML = "";
  obtenerPokemon();
});

//Listado de pokemons
async function obtenerPokemon() {
  const listado = await fetch(
    `https://pokeapi.co/api/v2/pokemon?limit=20&offset=${(paginaActual - 1) * 20}`,
  );
  const listadojson = await listado.json();

  listadojson.results.forEach((pokemon) => {
    const cartapokemon = document.createElement("div");
    const idPokemon = pokemon.url.split("/")[6];
    if (idPokemon > 1025) return; // Le tengo que preguntar a Isaac si vamos a usar megaevoluciones, gmax, etc. En casi de que si, borrar esta linea
    cartapokemon.innerHTML = `
      <img
        class="imagen-pokemon"
        src="https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/${idPokemon}.png"
      />
      <p class="nombre-pokemon">${pokemon.name}</p>
      <p class="id-pokemon">ID: ${idPokemon}</p>
    `;
    document.getElementById("cartas-pokemon").appendChild(cartapokemon);
  });
}

obtenerPokemon();

// Codigo de la barra de busqueda (esto sigue en progreso, todo esto esta sujeto a cambios)
async function buscarPokemon() {
  const input = document.getElementById("input-busqueda");
  const botonBuscar = document.getElementById("boton-busqueda");

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
          .appendChild(createPokemonCard(pokemon));
      } else {
        obtenerPokemon();
        return;
      }
    }
  });
}

buscarPokemon();
