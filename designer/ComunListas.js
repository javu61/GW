// comunListas — el puente de datos entre las dos etapas del sistema.
// ====================================================================================================
// El sistema tiene DOS etapas deliberadamente inconexas (decisión
// de diseño): la AUTORÍA (ficheros Base*, Fase 1: extraer,
// editar, guardar el GWI) y el JUEGO (ficheros Juego*, Fase 2:
// estados y presentación). No se conocen: la única comunicación
// es que baseDirector llama al juegoDirector (el Start). Pero
// ambas necesitan LOS MISMOS DATOS del cartucho una vez cargado:
// las listas de sprites y segmentos en memoria y la imagen de
// fondo. Ese pequeño común vive AQUÍ, en un fichero propio que
// no pertenece a ninguna de las dos etapas.
//
//   - La autoría ESCRIBE (al cargar un GWI deja las listas y el
//     fondo; al extraerlos cuelga la imagen de cada sprite de su
//     propio segmento, seg.imagen).
//   - El juego LEE (el motor de estados escribe las banderas
//     visible/cambiar en los objetos de la lista; el motor
//     gráfico lee fondo, posiciones e imágenes para componer).
//   - La MÁQUINA ESCRIBE y el juego CONSUME: las pulsaciones de
//     los botones (físicos o teclado) entran por aquí y el motor
//     de estados las vacía al empezar cada tick (F3-I2).
//
// Sin cartucho cargado: listas vacías y fondo null. El contrato
// «la lista ES el estado» sigue siendo de los motores; este
// módulo solo guarda referencias y datos en tránsito, no
// interpreta nada.
//
// Script clásico (sin módulos, compatible file://). Carga el
// PRIMERO de todos los scripts del proyecto.
// ====================================================================================================

var comunListas = (function () {
  'use strict';

  /** Sprites únicos del GWI (img_NNN) en memoria. */
  var sprites = [];

  /** Segmentos del GWI (seg_NNN) en memoria, por REFERENCIA. */
  var segmentos = [];

  /** Imagen de fondo del cartucho (img_f), para la presentación. */
  var fondo = null;

  /**
   * Configuración de reglas del juego (hoy: { combinar: bool }).
   * La autoría la escribe al cargar el cartucho; el motor la lee.
   */
  var reglas = null;

  /**
   * Mecanismo de FIN de partida del cartucho cargado (F3-I11,
   * v12.5): { mecanismo, contador } o null. PROPIEDAD del
   * cartucho (campo «fin» del GWI), no un segmento: la escribe la
   * carga del cartucho (fijarFin) y la lee el motor al iniciar.
   */
  var finCartucho = null;
  /**
   * SECUENCIA del cartucho (duodécima iteración): animación
   * periódica del cartucho, PROPIEDAD del mismo nivel que «fin» —
   * viaja en el campo «secuencia» del GWI. Formato:
   * { ticks: N, segmentos: [ids] } (hasta 5, lanzados en orden,
   * uno por tick). La escribe la carga del cartucho (fijarSecuencia)
   * y la lee el motor al iniciar.
   */
  var secuenciaCartucho = null;

  /**
   * PAUSAS del cartucho (F4-I2): las velocidades de reloj por
   * plataforma, { simulador: ms, externo: ms }. PROPIEDAD del
   * cartucho (campo «pausas» del GWI): la escribe la carga
   * (fijarPausas) y la lee el Director al arrancar y en cada
   * programación de tick. Ausente o sin pausa: 500 ms (el
   * comportamiento histórico).
   */
  var pausasCartucho = null;
  /**
   * ACELERACIÓN del cartucho (F4-I2): { cada: ticks, resta: ms,
   * minimo: ms } — cada «cada» ticks de partida la pausa vigente
   * baja «resta» ms sin pasar de «minimo». Un solo conjunto para
   * ambas plataformas (se aplica sobre la pausa inicial de cada
   * una). Ausente: pausa fija durante toda la partida.
   */
  var aceleracionCartucho = null;
  /**
   * RUTAS del cartucho (F4-I2): { aumentarCada: N } — cada N
   * rutas LANZADAS (el total nunca baja) el máximo de rutas
   * simultáneas sube en 1. Ausente: el máximo queda en 1 (la
   * regla histórica: nace una cuando no queda ninguna viva).
   */
  var rutasCartucho = null;
  /**
   * Cola FIFO de pulsaciones pendientes (números físicos de
   * botón). La llena la máquina (vía juegoDirector), la vacía el
   * motor de estados al empezar cada tick. Con tapa: más de TAPA
   * pulsaciones sin consumir es un martilleo, no un jugador.
   * @constant {number}
   * @since 3.2
   */
  var TAPA = 8;
  var pulsaciones = [];

  /**
   * Encola una pulsación de botón (número físico). Si la cola
   * está llena, la descarta y devuelve false: quien llama puede
   * avisar (diagnóstico GW_DEBUG del que llama, no de aquí).
   * @param {string} numero - Número físico del botón pulsado.
   * @returns {boolean} true si se encoló, false si se descartó.
   * @since 3.2
   */
  function encolar(numero) {
    if (pulsaciones.length >= TAPA) return false;
    pulsaciones.push(numero);
    return true;
  }

  /**
   * Deja en memoria las listas de un GWI (lo llama la carga del
   * cartucho). Los fantasmas de unión (tipo 99) no van a
   * memoria: son solo informativos en el JSON.
   * @param {Array<Object>} sp - Lista de sprites del GWI.
   * @param {Array<Object>} segs - Lista de segmentos del GWI.
   * @returns {void}
   * @since 2.7
   */
  function cargar(sp, segs) {
    sprites = sp || [];
    segmentos = (segs || []).filter(function (s) {
      return !s.fusionadoPor && s.tipo !== 99;
    });
  }

  /**
   * Fuera las listas de un cartucho anterior (recarga). También
   * fuera las reglas y las pulsaciones sin consumir: nada del
   * cartucho anterior contamina la siguiente partida.
   * @returns {void}
   * @since 2.7 (reglas y pulsaciones: 3.2)
   */
  function limpiar() {
    sprites = [];
    segmentos = [];
    fondo = null;
    reglas = null;
    finCartucho = null;
    secuenciaCartucho = null;
    pausasCartucho = null;
    aceleracionCartucho = null;
    rutasCartucho = null;
    pulsaciones = [];
  }

  /**
   * Guarda la configuración de reglas del cartucho cargado (hoy:
   * si combina dos teclas, { combinar: bool }). El motor de
   * estados la consulta en cada tick.
   * @param {?Object} cfg - Reglas del juego (o null).
   * @returns {void}
   * @since 3.2
   */
  function fijarReglas(cfg) {
    reglas = cfg || null;
  }

  /**
   * Guarda el MECANISMO DE FIN de partida del cartucho cargado
   * (F3-I11, v12.5): es una PROPIEDAD del cartucho — viaja en el
   * campo «fin» del GWI, no como segmento — y el motor de estados
   * la lee al iniciar. Formato: { mecanismo: 'vida'|'muerte'|
   * 'contador', contador: 1-4 } (contador solo con mecanismo
   * 'contador'); null = sin definir.
   * @param {?Object} cfg - Fin de partida del cartucho (o null).
   * @returns {void}
   * @since 12.5
   */
  function fijarFin(cfg) {
    finCartucho = cfg || null;
  }

  /**
   * El mecanismo de fin del cartucho cargado ({ mecanismo,
   * contador } o null). Lo lee el motor al iniciar la partida.
   * @returns {?Object} Configuración de fin, o null.
   * @since 12.5
   */
  function finDeCartucho() {
    return finCartucho;
  }

  /**
   * La cola de pulsaciones pendientes, por REFERENCIA. El motor
   * la vacía al empezar el tick (quien consume es el dueño del
   * ritmo: la lee y la deja a cero).
   * @returns {Array<string>} Cola viva de números de botón.
   * @since 3.2
   */

  /**
   * Guarda la SECUENCIA del cartucho cargado (animación periódica):
   * { ticks: periodo en ticks, segmentos: [hasta 5 ids] } o null.
   * @param {?Object} cfg - Secuencia del cartucho (o null).
   * @returns {void}
   * @since 12.8
   */
  function fijarSecuencia(cfg) {
    secuenciaCartucho = cfg || null;
  }

  /**
   * La secuencia del cartucho cargado ({ ticks, segmentos } o
   * null). La lee el motor al iniciar la partida.
   * @returns {?Object} Configuración de secuencia, o null.
   * @since 12.8
   */
  function secuenciaDeCartucho() {
    return secuenciaCartucho;
  }
  /**
   * Guarda las PAUSAS del cartucho cargado (F4-I2):
   * { simulador: ms, externo: ms } o null.
   * @param {?Object} cfg - Pausas del cartucho (o null).
   * @returns {void}
   * @since 4.2
   */
  function fijarPausas(cfg) {
    pausasCartucho = cfg || null;
  }

  /**
   * Las pausas del cartucho cargado ({ simulador, externo } o
   * null). Las lee el Director al arrancar y al programar ticks.
   * @returns {?Object} Configuración de pausas, o null.
   * @since 4.2
   */
  function pausasDeCartucho() {
    return pausasCartucho;
  }

  /**
   * Guarda la ACELERACIÓN del cartucho cargado (F4-I2):
   * { cada, resta, minimo } o null.
   * @param {?Object} cfg - Aceleración del cartucho (o null).
   * @returns {void}
   * @since 4.2
   */
  function fijarAceleracion(cfg) {
    aceleracionCartucho = cfg || null;
  }

  /**
   * La aceleración del cartucho cargado ({ cada, resta, minimo }
   * o null). La lee el Director en cada tick de partida.
   * @returns {?Object} Configuración de aceleración, o null.
   * @since 4.2
   */
  function aceleracionDeCartucho() {
    return aceleracionCartucho;
  }

  /**
   * Guarda la política de RUTAS del cartucho cargado (F4-I2):
   * { aumentarCada: N } o null.
   * @param {?Object} cfg - Rutas del cartucho (o null).
   * @returns {void}
   * @since 4.2
   */
  function fijarRutas(cfg) {
    rutasCartucho = cfg || null;
  }

  /**
   * La política de rutas del cartucho cargado ({ aumentarCada }
   * o null). La lee el Director al contar lanzamientos.
   * @returns {?Object} Configuración de rutas, o null.
   * @since 4.2
   */
  function rutasDeCartucho() {
    return rutasCartucho;
  }

  function colaPulsaciones() {
    return pulsaciones;
  }

  /**
   * Guarda la imagen de fondo (img_f) del cartucho cargado.
   * @param {HTMLImageElement} img - Imagen de fondo (o null).
   * @returns {void}
   * @since 2.7
   */
  function fijarFondo(img) {
    fondo = img;
  }

  /**
   * ENUMERACIÓN DE TIPOS (F3-I11): el tipo de un segmento viaja en
   * el GWI como número, pero las comparaciones del código se hacen
   * contra estos NOMBRES (seg.tipo === tipos.jugador) — los números
   * nunca cambian, pero el nombre legible gana a un dígito mágico.
   * Vive en el PUENTE porque lo usan las DOS etapas: la autoría
   * (nº GWI al guardar) y el motor (comparaciones al barrer).
   * 'digito' es el nombre sin acento del tipo «dígito» (5).
   */
  var tipos = {
    jugador: 0, juego: 1, inicio: 2, vida: 3, muerte: 4,
    digito: 5, contador: 6, cartucho: 7,
    adicional: 8, inicioAdicional: 9
  };

  /**
   * ENUMERACIÓN DEL MECANISMO DE FIN (F3-I11): lo que el segmento
   * de cartucho declara en finJuego. Los valores viajan tal cual
   * en el GWI (texto autoexplicativo); ninguno = null (la
   * verificación lo exige puesto).
   */
  var fin = {
    ninguno: null, vida: 'vida', muerte: 'muerte',
    contador: 'contador'
  };

  return {
    cargar: cargar,
    limpiar: limpiar,
    fijarFondo: fijarFondo,
    fijarReglas: fijarReglas,
    fijarFin: fijarFin,
    finDeCartucho: finDeCartucho,
    fijarSecuencia: fijarSecuencia,
    secuenciaDeCartucho: secuenciaDeCartucho,
    fijarPausas: fijarPausas,
    pausasDeCartucho: pausasDeCartucho,
    fijarAceleracion: fijarAceleracion,
    aceleracionDeCartucho: aceleracionDeCartucho,
    fijarRutas: fijarRutas,
    rutasDeCartucho: rutasDeCartucho,
    encolar: encolar,
    colaPulsaciones: colaPulsaciones,
    segmentos: function () { return segmentos; },
    sprites: function () { return sprites; },
    fondo: function () { return fondo; },
    reglas: function () { return reglas; },
    tipos: tipos,
    fin: fin,
    TAPA: TAPA
  };
})();