let paginaActual = 1;

document.getElementById("AgregarPokemon").addEventListener("click", () => {
  window.location.href = "Lista.html";
});

//Funciones importadas

//pokemons peleando

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

  return daño;
}

document.getElementById("Atacar").addEventListener("click", () => {
  const dañoMeowscarada = calcularDaño(
    datosMeowscarada,
    datosStarmie,
    90,
    false,
  );
  console.log(
    `Meowscarada ataca a Starmie y causa ${dañoMeowscarada} de daño.`,
  );

  console.log(datosMeowscarada.types.map((type) => type.type.name)); // Imprime los tipos de Meowscarada
  console.log(datosStarmie.types.map((type) => type.type.name)); // Imprime los tipos de Starmie
});

function calcularSTAB(atacante, tipoMovimiento) {
  // STAB es Same Type Attack Bonus
  const tiposAtacante = atacante.types.map((type) => type.type.name);
  return tiposAtacante.includes(tipoMovimiento) ? 1.5 : 1;
}

async function STAB() {
  const res = await fetch(`https://pokeapi.co/api/v2/type/grass`); // Meowscarada
  const datos = await res.json();
  console.log(datos.damage_relations);
  console.log(datos.damage_relations.double_damage_to.map((type) => type.name)); // Tipos que hacen el doble de daño a Meowscarada
  console.log(datos.damage_relations.half_damage_to.map((type) => type.name)); // Tipos que hacen la mitad de daño a Meowscarada
}

STAB();
