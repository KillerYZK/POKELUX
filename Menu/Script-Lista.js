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

async function obtenerPokemon() {
  const listado = await fetch(
    `https://pokeapi.co/api/v2/pokemon?limit=20&offset=${(paginaActual - 1) * 20}`,
  );
  const listadojson = await listado.json();

  listadojson.results.forEach((pokemon) => {
    const cartapokemon = document.createElement("div");
    const idPokemon = pokemon.url.split("/")[6];
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
