const idPokemon = localStorage.getItem("pokemonConfigurar");

async function cargarPokemon() {
  const resultado = await fetch(
    `https://pokeapi.co/api/v2/pokemon/${idPokemon}`,
  );
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
  };

  localStorage.setItem(
    `configuracion-${idPokemon}`,
    JSON.stringify(configuracion),
  );
  window.location.href = "Equipo.html";
});
