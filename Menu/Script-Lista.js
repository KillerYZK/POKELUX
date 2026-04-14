async function obtenerPokemon() {
  const test1 = await fetch(
    "https://pokeapi.co/api/v2/pokemon?limit=20&offset=0",
  );
  const testjson = await test1.json();

  testjson.results.forEach((pokemon) => {
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
