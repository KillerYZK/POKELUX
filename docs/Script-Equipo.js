document.getElementById("AgregarPokemon").addEventListener("click", () => {
  window.location.href = "Lista.html";
});

//Funciones importadas

//pokemons pelea test

async function obtenerPokemon() {
  const listado = await fetch(`https://pokeapi.co/api/v2/pokemon`);
  const listadojson = await listado.json();

  listadojson.results.forEach((pokemon) => {
    const cartapokemon = crearCarta(pokemon);
    document.getElementById("cartas-pokemon").appendChild(cartapokemon);
  });
}

obtenerPokemon();

//Versión hardcodeada (en caso de que algo se rompa 😭)
/*async function pelea() {
  const resultadoMeowscarada = await fetch(
    `https://pokeapi.co/api/v2/pokemon/908`,
  );
  datosMeowscarada = await resultadoMeowscarada.json();

  const resultadoStarmie = await fetch(`https://pokeapi.co/api/v2/pokemon/121`);
  datosStarmie = await resultadoStarmie.json();

  // Inicializar HP y turno

  hpMeowscarada = datosMeowscarada.stats[0].base_stat;
  hpStarmie = datosStarmie.stats[0].base_stat;
  turno = "Meowscarada";

  Meowscarada = document.createElement("div");
  Meowscarada.innerHTML = `
    <img class="imagen-pokemon" src="https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/908.png" />
    <p class="nombre-pokemon">Meowscarada</p>
    <p id="hp-meowscarada">HP: ${hpMeowscarada}</p>
  `;
  document.getElementById("cartas-pokemon").appendChild(Meowscarada);

  Starmie = document.createElement("div");
  Starmie.innerHTML = `
    <img class="imagen-pokemon" src="https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/121.png" />
    <p class="nombre-pokemon">Starmie</p>
    <p id="hp-starmie">HP: ${hpStarmie}</p>
  `;
  document.getElementById("cartas-pokemon").appendChild(Starmie);
}

pelea();
*/

async function equipos() {
  const equipo = JSON.parse(localStorage.getItem("equipo"));

  if (!equipo || equipo.length === 0) {
    alert("No tienes Pokémon en tu equipo!");
    return;
  }

  for (const id of equipo) {
    const resultado = await fetch(`https://pokeapi.co/api/v2/pokemon/${id}`);
    const datos = await resultado.json();

    const carta = document.createElement("div");
    carta.innerHTML = `
      <img class="imagen-pokemon" src="https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/${id}.png" />
      <p class="nombre-pokemon">${datos.name}</p>
    `;
    document.getElementById("cartas-pokemon").appendChild(carta);
  }
}

equipos();

async function getDetallesEquipo() {
  const equipo = JSON.parse(localStorage.getItem("equipo"));
  const contenedor = document.getElementById("detalles-equipo");

  if (!equipo || equipo.length === 0) return;

  for (const id of equipo) {
    const resultado = await fetch(`https://pokeapi.co/api/v2/pokemon/${id}`);
    const datos = await resultado.json();

    const configuracion =
      JSON.parse(localStorage.getItem(`configuracion-${id}`)) || {};

    const tarjeta = document.createElement("div");
    tarjeta.classList.add("tarjeta-detalle");
    tarjeta.innerHTML = `
    <img src="${configuracion.sprite || `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/${id}.png`}" />
      <div>
        <p>${datos.name}</p>
        <p>${configuracion.apodo || "Sin apodo"}</p>
        <p>${datos.types.map((t) => t.type.name).join(", ")}</p>
        <p>Nivel: ${configuracion.nivel || "1"}</p>
        <p>Género: ${configuracion.genero || "Desconocido"}</p>
        <p>Shiny: ${configuracion.shiny ? "Sí" : "No"}</p>
      </div>
      <div>
        <p>${configuracion.movimientos?.[0] || "Movimiento 1"}</p>
        <p>${configuracion.movimientos?.[1] || "Movimiento 2"}</p>
        <p>${configuracion.movimientos?.[2] || "Movimiento 3"}</p>
        <p>${configuracion.movimientos?.[3] || "Movimiento 4"}</p>
      </div>
      <button class="boton-personalizar">+</button>
    `;

    tarjeta
      .querySelector(".boton-personalizar")
      .addEventListener("click", () => {
        localStorage.setItem("pokemonConfigurar", id);
        window.location.href = "Personalizar.html";
      });

    contenedor.appendChild(tarjeta);
  }
}

getDetallesEquipo();

document.getElementById("BorrarEquipo").addEventListener("click", () => {
  const equipo = JSON.parse(localStorage.getItem("equipo")) || [];
  equipo.forEach((idPokemon) => {
    localStorage.removeItem(`configuracion-${idPokemon}`);
  });
  localStorage.removeItem("equipo");
  location.reload();
});

document.getElementById("Inicio").addEventListener("click", () => {
  window.location.href = "Menu-Inicio.html";
});