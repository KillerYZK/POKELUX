let paginaActual = 1;

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

let datosMeowscarada, datosStarmie;

async function pelea() {
  const resultadoMeowscarada = await fetch(
    `https://pokeapi.co/api/v2/pokemon/908`,
  );
  datosMeowscarada = await resultadoMeowscarada.json();

  const resultadoStarmie = await fetch(`https://pokeapi.co/api/v2/pokemon/121`);
  datosStarmie = await resultadoStarmie.json();

  Meowscarada = document.createElement("div");
  Meowscarada.innerHTML = `
    <img class="imagen-pokemon" src="https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/908.png" />
    <p class="nombre-pokemon">Meowscarada</p>
    <p>HP: ${datosMeowscarada.stats[0].base_stat}</p>
  `;
  document.getElementById("cartas-pokemon").appendChild(Meowscarada);

  Starmie = document.createElement("div");
  Starmie.innerHTML = `
    <img class="imagen-pokemon" src="https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/121.png" />
    <p class="nombre-pokemon">Starmie</p>
    <p>HP: ${datosStarmie.stats[0].base_stat}</p>
  `;
  document.getElementById("cartas-pokemon").appendChild(Starmie);
}

pelea();
/*
function calcularDaño(atacante, defensor, poder, especial) {
  const ataque = especial
    ? atacante.stats[3].base_stat // Ataque especial
    : atacante.stats[2].base_stat; // Ataque físico o normal

  const defensa = especial
    ? defensor.stats[3].base_stat // Defensa especial
    : defensor.stats[2].base_stat; // Defensa física o normal

  const nivel = 50; // Nivel hardcodeado para hacer pruebas

  const random = (Math.floor(Math.random() * 16) + 85) / 100; // Número aleatorio entre 85 y 100 (parte de la formula de daño)

  const daño = Math.floor(
    ((((2 * nivel) / 5 + 2) * poder * (ataque / defensa)) / 50 + 2) * random,
  );

  const efectividad = calcularEfectividad("grass", datosStarmie); // Aquí se puede cambiar el tipo del movimiento
  console.log(`Efectividad del movimiento: ${efectividad}`);

  return daño;
}
*/

//Boton de atacar
document.getElementById("Atacar").addEventListener("click", async () => {
  console.log(datosMeowscarada.types.map((type) => type.type.name)); // Imprime los tipos de Meowscarada
  console.log(datosStarmie.types.map((type) => type.type.name)); // Imprime los tipos de Starmie
  const daño = await calcularDaño(
    datosMeowscarada,
    datosStarmie,
    80,
    "grass",
    true,
  );
  console.log(`Daño: ${daño}`);
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
