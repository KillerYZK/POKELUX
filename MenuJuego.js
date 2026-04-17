// Esperar a que el DOM esté completamente cargado
document.addEventListener('DOMContentLoaded', function() {
    // Obtener referencias a los botones
    const btnCrearPartida = document.getElementById('btnCrearPartida');
    const btnUnirse = document.getElementById('btnUnirse');

    // Agregar evento click al botón "Crear Partida"
    if (btnCrearPartida) {
        btnCrearPartida.addEventListener('click', function() {
            window.location.href = 'Juego-CrearP.html';
        });
    }

    // Agregar evento click al botón "Unirse"
    if (btnUnirse) {
        btnUnirse.addEventListener('click', function() {
            window.location.href = 'Juego-Unirse.html';
        });
    }
});