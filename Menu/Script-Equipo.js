let peleaActiva = true;
let datosMeowscarada, datosStarmie, hpMeowscarada, hpStarmie, turno;

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

async function pelea() {
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
      <p id="hp-${id}">HP: ${datos.stats[0].base_stat}</p>
    `;
    document.getElementById("cartas-pokemon").appendChild(carta);
  }
}

pelea();

//Boton de atacar
document.getElementById("Atacar").addEventListener("click", async () => {
  if (peleaActiva === false) return;
  if (turno === "Meowscarada") {
    const daño = await calcularDaño(
      datosMeowscarada,
      datosStarmie,
      80,
      "grass",
      true,
    );
    hpStarmie = Math.max(0, hpStarmie - daño);
    document.getElementById("hp-starmie").textContent = `HP: ${hpStarmie}`;
    turno = "Starmie";
  } else {
    const daño = await calcularDaño(
      datosStarmie,
      datosMeowscarada,
      90,
      "water",
      true,
    );
    hpMeowscarada = Math.max(0, hpMeowscarada - daño);
    document.getElementById("hp-meowscarada").textContent =
      `HP: ${hpMeowscarada}`;
    turno = "Meowscarada";
  }

  if (hpMeowscarada === 0) {
    peleaActiva = false;
    console.log("Starmie gana la pelea!");
  }
  if (hpStarmie === 0) {
    peleaActiva = false;
    console.log("Meowscarada gana la pelea!");
  }
});

function calcularSTAB(atacante, tipoMovimiento) {
  // STAB es Same Type Attack Bonus
  const tiposAtacante = atacante.types.map((type) => type.type.name);
  return tiposAtacante.includes(tipoMovimiento) ? 1.5 : 1;
}

async function calcularEfectividad(tipoMovimiento, defensor) {
  const resultado = await fetch(
    `https://pokeapi.co/api/v2/type/${tipoMovimiento}`,
  );
  const datosTipo = await resultado.json();
  const relaciones = datosTipo.damage_relations;

  const tiposDefensor = defensor.types.map((type) => type.type.name);

  let multiplicador = 1;

  tiposDefensor.forEach((tipo) => {
    if (relaciones.double_damage_to.some((t) => t.name === tipo)) {
      multiplicador *= 2;
    } else if (relaciones.half_damage_to.some((t) => t.name === tipo)) {
      multiplicador *= 0.5;
    } else if (relaciones.no_damage_to.some((t) => t.name === tipo)) {
      multiplicador *= 0;
    }
  });

  return multiplicador;
}

async function calcularDaño(
  atacante,
  defensor,
  poder,
  tipoMovimiento,
  especial,
) {
  const ataque = especial
    ? atacante.stats[3].base_stat // Ataque especial
    : atacante.stats[1].base_stat; // Ataque físico o normal
  const defensa = especial
    ? defensor.stats[4].base_stat // Defensa especial
    : defensor.stats[2].base_stat;

  const nivel = 50;
  const random = (Math.floor(Math.random() * 16) + 85) / 100;
  const stab = calcularSTAB(atacante, tipoMovimiento);
  const efectividad = await calcularEfectividad(tipoMovimiento, defensor);

  return Math.floor(
    ((((2 * nivel) / 5 + 2) * poder * (ataque / defensa)) / 50 + 2) *
      random *
      stab *
      efectividad,
  );
}
