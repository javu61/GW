// juegoMotorEstados — el que decide qué segmentos están encendidos y dónde.
// ====================================================================================================
// Motor de juego (Fase 3): el estado del juego VIVE EN LA LISTA DE
// SEGMENTOS del puente comunListas (la que la carga del GWI deja
// en memoria). El tick hace, en este orden:
//   0. Apaga las banderas de cambiado (todo segmento con cambiar
//      =true pasa a false: el estado anterior ya fue presentado).
//      F5-I15: la limpieza va ANTES de la entrada (como el
//      análisis F2 fija): las marcas del propio tick han de
//      sobrevivir a él.
//   1. ENTRADA: vacía la cola de pulsaciones pendientes (la llena
//      la máquina vía juegoDirector; vive en el puente) y mueve al
//      JUGADOR según la tabla MOVER. El jugador NO es un segmento
//      que se desplaza por coordenadas: es un segmento ACTIVO que
//      CAMBIA por los enlaces izquierda/derecha/arriba/abajo que
//      la autoría dibujó entre segmentos (como el bote del
//      Parachute: cada posición del bote es un segmento, moverse es
//      apagar uno y encender el vecino). Con la regla "combinar"
//      del cartucho activa, todo el buffer se REDUCE A EJES y cada
//      eje resultante da UN paso (dos pulsaciones de la misma
//      dirección en la misma ventana son UN paso; opuestas se
//      anulan); sin ella, cada pulsación es un paso en orden.
//   2. RUTAS (F3-I5): los elementos de ruta son los segmentos de
//      tipo juego (1) e inicio (2) que están VISIBLES. Se toma
//      una FOTO de los visibles antes de tocar nada y el barrido
//      va EN DOS FASES (F5-I15): primero todos dejan su casilla y
//      después cada uno AVANZA por su enlace "siguiente" (se
//      enciende el siguiente), de modo que el resultado no depende
//      del orden de la lista (actúan antes los que deciden una
//      colisión: si congelan el juego, el resto de rutas esperan);
//      el contador de rutas vivas se recalcula mirando la pantalla
//      (_contarRutasVivas); si no tiene "siguiente" (el final de la
//      cadena, sin colisión), la ruta MUERE: el elemento se
//      apaga y desaparece. Después, si no queda NINGÚN elemento
//      de ruta visible, el motor pide un número de ruta al PRNG
//      del director, localiza el segmento inicio de esa ruta y
//      lo enciende: nace una nueva. Las rutas van encadenadas
//      (una nueva un tick tras morir la anterior), pero el
//      mecanismo no sabe cuántas hay: si hubiera dos vivas (el
//      futuro Game B), ambas avanzarían en el mismo tick. El
//      jugador (tipo 0) no es elemento de ruta. Los segmentos
//      de vida/muerte (3/4) tampoco cuentan como RUTA para la
//      política de lanzamiento, pero el BARRIDO los ATRAVIESA si
//      forman parte de una cadena (F3-I8: los tiburones enlazados
//      de la secuencia de muerte avanzan enlace a enlace).
//      La SECUENCIA de prueba de las iteraciones anteriores se
//      despide: lo que se enciende ahora sale del cartucho.
//      COLISIONES (F3-I8): un elemento de ruta visible que
//      declara "colision" NO avanza — DECIDE en ese mismo tick:
//      lee la bandera visible del segmento jugador señalado
//      (positiva → cadena salvado, negativa → cadena muerte; sin
//      cadena el elemento desaparece, regla por defecto) y ajusta
//      una sola vez el contador interno marcado
//      (salvadoContador/muerteContador: '1'..'4'). La
//      cadena de desenlace es una ruta más: avanza y muere igual;
//      un segmento de vida/muerte encendido se activa al
//      hacerse visible, sin control adicional del motor.
// El jugador activo vive en una variable con su ÍNDICE en la
// lista; si es null, al iniciar se BUSCA al primero que se
// encuentre: hoy manda la MARCA de primer jugador que el
// diseñador pone en el segmento (campo "primero" del GWI,
// F3-I3); sin marca, el primer segmento de tipo jugador, luego
// el primero con algún enlace de dirección y, en último
// extremo, el primero de la lista (con aviso). Al iniciar, el
// jugador encontrado se ENCIENDE (visible=true): la referencia
// visual de que la entrada funciona.
//
// Nota de banderas: la limpieza del tick anterior va ANTES de la
// entrada (F5-I15): la entrada escribe cambiar=true en el jugador
// apagado y en el encendido, y esas marcas SOBREVIVEN al fin del
// tick — las lee el repintado selectivo del ESP32 (vías de
// hardware; la Memoria F2 lo fija así). El motor gráfico del
// navegador sigue leyendo visible (repinta todos los encendidos):
// sin cambio de comportamiento en el editor.
//
// Contrato (análisis F2-I1): este módulo es el ÚNICO escritor de
// las banderas; habla SOLO EN ESTADOS (nunca en órdenes de
// dibujo). La lista ES el estado: quien quiera conocer el juego,
// lee la lista.
//
// F3-I4 (generador de aleatorios): el azar es un SERVICIO del
// juegoDirector (LCG con semilla; misma semilla = misma partida);
// este motor sigue PURO y determinista y solo PIDE números
// (juegoDirector.aleatorio). Para las pruebas de esta iteración
// existe pruebaAleatorios(): pide 10 números seguidos y los
// devuelve; el director la llama dos veces con la semilla
// reiniciada entre ambas y verifica que las dos pasadas son
// idénticas. Tras las pruebas el director ya no la llama (la
// llamada queda comentada allí); la función se queda aquí para
// poder repetir la verificación cuando se toque el generador.
//
// Diagnóstico con llave: los mensajes de consola solo aparecen si
// la variable global GW_DEBUG (definida en index.html) está
// activa; con ella apagada el motor corre en silencio.
//
// Script clásico (sin módulos, compatible file://). Carga tras
// baseDirector.js y antes de juegoMotorGrafico.js.
// ====================================================================================================

var juegoMotorEstados = (function () {
  'use strict';

  /**
   * Tabla número de botón → NOMBRE del enlace que el jugador
   * sigue al pulsarlo (los enlaces izquierda/derecha/arriba/abajo
   * de los segmentos jugador del GWI: cada enlace ES el botón).
   * Escrita en el código, como las demás constantes de prueba:
   * esta es del juego de
   * prueba (estilo 2: 0 a la izquierda, 4 a la derecha; arriba y
   * abajo serían 'arriba'/'abajo'). Los números que no están
   * aquí no mueven al jugador (sus pulsaciones se consumen y no
   * hacen nada). El día que las reglas vengan del cartucho, esta
   * tabla viaja en el GWC.
   * @constant {Object<string, string>}
   * @since 3.3
   */
  var MOVER = {
    '0': 'izquierda',
    '4': 'derecha'
  };

  /**
   * Vector de cada dirección, para reducir el buffer de
   * pulsaciones a ejes cuando el cartucho combina (un paso por
   * eje y tick, «lo más parecido a 1 posible, como en la máquina
   * real»).
   * @constant {Object<string, number[]>}
   * @since 3.3
   */
  var EJES = {
    izquierda: [-1, 0],
    derecha: [1, 0],
    arriba: [0, -1],
    abajo: [0, 1]
  };

  /**
   * ¿Es este segmento un ELEMENTO DE RUTA? Los de tipo juego (1)
   * e inicio (2): los que cuentan para la POLÍTICA de lanzamiento
   * (si no queda ninguna viva, nace otra). El jugador (tipo 0)
   * jamás participa.
   * @param {Object} seg - Un segmento de la lista.
   * @returns {boolean} true si es ruta de juego.
   * @since 3.5
   */
  function _esDeRuta(seg) {
    if (seg.tipo !== tiposEnum.juego && seg.tipo !== tiposEnum.inicio) {
      return false;
    }
    // Las BARRAS de un dígito son tipo juego pero NO son rutas: solo
    // aportan su gráfico al contador (las enciende su presentación).
    // Sin esto, un valor inicial ≠ 0 dejaba barras encendidas que la
    // política de lanzamiento contaba como «ruta viva» y NUNCA
    // nacía ninguna (bug cazado por la simulación de F3-I11).
    if (idsBarras[seg.id]) return false;
    // F5-I15 (A1): el SECUNDARIO de un «mostrar junto a» no es una
    // ruta: lo sincroniza su principal. Contado como ruta, el barrido
    // lo apagaba como fin de cadena y restaba una viva de más.
    if (idsSecundarios[seg.id]) return false;
    return true;
  }

  /**
   * ¿Participa este segmento en el BARRIDO de cadenas? TODO lo que
   * no es jugador (F3-I8): además de las rutas de juego (1/2), la
   * cadena de un desenlace puede ATRAVESAR segmentos de tipo vida
   * o muerte (3/4) — p. ej. los tiburones enlazados 28 → 27 → 26:
   * cada uno se enciende, se presenta y AVANZA por su siguiente
   * como cualquier elemento de cadena; el barrido se para solo al
   * final (sin siguiente). Sin esto, la cadena moría al pisar el
   * primer segmento de tipo 4.
   * @param {Object} seg - Un segmento de la lista.
   * @returns {boolean} true si el barrido lo avanza.
   * @since 3.6
   */
  function _esCadena(seg) {
    // Fuera del barrido: el jugador, los dígitos, los contadores y
    // el SEGMENTO DE CARTUCHO (F3-I11: la ficha de configuración,
    // nunca es arte). Las barras quedan fuera por idsBarras.
    if (seg.tipo === tiposEnum.jugador || seg.tipo === tiposEnum.digito ||
      seg.tipo === tiposEnum.contador || seg.tipo === tiposEnum.cartucho) {
      return false;
    }
    // FIN POR ICONOS (corrección del 21-10-2026): los segmentos de
    // las familias de vida/muerte son PRESENTACIÓN de sus
    // contadores, SIEMPRE (sea cual sea el mecanismo de fin): los
    // enciende y los apaga la SINCRONIZACIÓN con el contador interno,
    // nunca el barrido — el barrido los recorrería como una cadena
    // más (encendía el PRIMERO y ahí se quedaba congelado) y un
    // icono no "muere": se enciende acumulativo desde el último
    // (muerte) o se apaga desde el último (vida). Una cadena de
    // desenlace que LLEGA a la familia aterriza: cuenta el
    // desenlace una vez (contarAterrizaje) y termina ahí.
    if (seg.tipo === tiposEnum.vida || seg.tipo === tiposEnum.muerte) {
      return false;
    }
    // ADICIONALES (duodécima iteración): los elementos fuera del
    // juego (helicóptero fijo, aspas) NUNCA los avanza el barrido —
    // viven en su PROPIO bucle (avanzarAdicionales) o en la
    // Secuencia del cartucho (marca animados).
    if (seg.tipo === tiposEnum.adicional ||
      seg.tipo === tiposEnum.inicioAdicional) {
      return false;
    }
    if (idsBarras[seg.id]) return false;   // barra de un dígito: la enciende el contador
    if (idsSecundarios[seg.id]) return false;   // F5-I15 (A1): lo sincroniza su principal
    return true;
  }

  /**
   * CONTADORES INTERNOS GENÉRICOS (F4-I9): CUATRO contadores por
   * partida, independientes de los segmentos de tipo vida/muerte
   (esos son la presentación por iconos, un sistema distinto que
   convive con este). Cada segmento de tipo contador (6) del
   cartucho declara CUÁL usa (contadorInterno 1-4), su valor
   inicial, si la cuenta es ascendente o descendente y cuántos
   dígitos presenta; la DECISIÓN de una colisión los ajusta (una
   sola vez) según salvadoContador/muerteContador del punto de
   colisión ('1'..'4'; los GWI antiguos con 'vida'/'muerte' se
   mapean a 1/2 con aviso). Los descendentes no bajan de cero.
   Los dos primeros se exponen como vidas/muertes en
   contadores() para la barra de estado (compatibilidad).
   * @type {number[]}
   * @since 3.7
   */
  var contadoresInternos = [0, 0, 0, 0];

  /**
   * Segmentos que son BARRAS de un dígito (F4-I9), por id: el barrido
   * de cadenas no los toca (solo aporta su gráfico; los enciende la
   * presentación del contador). Se llena al preparar los contadores.
   * @type {Object<string, boolean>}
   * @since 3.7
   */
  var idsBarras = {};

  /**
   * Presentaciones de contador activas (F4-I9): una por segmento de
   * tipo contador bien formado, con su contador interno, su
   * dirección, si presenta el cero y las FILAS DE BARRAS REALES de
   * cada posición (la posición 0/unidades es el propio contador;
   * las demás, sus dígitos enlazados). Sin copias: el «11» enciende
   * las barras b de DOS «8» distintos, los que el autor dibujó.
   * @type {Array<Object>}
   * @since 3.7
   */
  var presentaciones = [];

  /**
   * ¿Hubo una decisión de colisión desde el último refresco de los
   * contadores? La presentación solo se refresca cuando un contador
   * cambia (nada periódico) y al iniciar la partida.
   * @type {boolean}
   * @since 3.7
   */
  var contadoresSucios = false;

  /**
   * VALOR INICIAL y DIRECCIÓN declarados por cada contador interno
   * (corrección del 21-10-2026): se capturan al iniciar. La
   * sincronización de la familia de MUERTE cuenta las muertes
   * ACUMULADAS: si el contador interno 2 es descendente (p. ej. el
   * dígito de vidas 3→0), las muertes son lo RESTADO desde el valor
   * inicial (3→2 es UNA muerte); si es ascendente, el valor
   * directamente. Sin capturar el inicial, el sync encendía los
   * últimos "valor" iconos (con vidas=3 encendía B y C a la primera
   * muerte) en vez de uno por muerte.
   * @type {number[]|Array<?string>}
   * @since 3.9
   */
  var inicialesInternos = [0, 0, 0, 0];
  var direccionesInternas = [null, null, null, null];

  /**
   * Configuración del FIN DE PARTIDA (F3-I11), leída del segmento
   * de cartucho (tipo 7) al iniciar: mecanismo ('vida', 'muerte',
   * 'contador' o null si el cartucho no lo declara) y, con
   * «contador», el contador interno (1-4) cuya transición de >0 a
   * 0 termina la partida.
   * @type {{mecanismo:?string, contador:number}}
   * @since 3.8
   */
  var configFin = { mecanismo: null, contador: 0 };

  /**
   * ¿Está la partida TERMINADA? (F3-I11). Al cumplirse la condición
   * del mecanismo de fin, el estado congelado: el tick no hace nada
   * (barrido y jugador parados) y el director, que lo consulta tras
   * cada tick, detiene el reloj. Nueva partida = iniciar().
   * @type {boolean}
   * @since 3.8
   */
  var terminada = false;

  /**
   * SECUENCIA del cartucho (duodécima iteración): { ticks, segmentos }
   * leída del puente al iniciar (campo «secuencia» del GWI), o null.
   * @type {?Object}
   * @since 3.11
   */
  var configSec = null;

  /**
   * Contador de ticks desde el último lanzamiento (o interrupción)
   * de la Secuencia.
   * @type {number}
   * @since 3.11
   */
  var secContador = 0;

  /**
   * Índice del segmento que la Secuencia tiene encendido AHORA
   * (-1 = inactiva).
   * @type {number}
   * @since 3.11
   */
  var secIdx = -1;

  /**
   * Marca de ANIMACIÓN: ids de los segmentos encendidos por la
   * Secuencia en este momento (el barrido de rutas y el bucle de
   * adicionales no los tocan mientras).
   * @type {Object<string, boolean>}
   * @since 3.11
   */
  var animados = {};

  /**
   * CONGELACIÓN POR DESENLACE (duodécima iteración): true mientras
   * corre una cadena salvado/muerte con eslabones de juego — rutas
 * paradas, sin lanzamientos y jugador sin responder; la Secuencia
 * se SUSPENDE solo si el ciclo es de MUERTE (23-10). Solo avanzan la
   * cadena del desenlace y los adicionales). Cae al morir el último
   * eslabón marcado.
   * @type {boolean}
   * @since 3.11
   */
  var congelada = false;

  /**
   * CICLO DE MUERTE (corrección del 23-10-2026): true mientras corre
   * un desenlace nacido de una colisión NEGATIVA — el ÚNICO momento
   * en que la Secuencia se suspende (una colisión en sí NO la para;
   * la congelación por desenlace salvado tampoco). Cae junto a la
   * congelación al morir el último eslabón. AJUSTE FINAL del
   * 23-10: al NACER el ciclo de muerte la Secuencia se INTERRUMPE
   * COMPLETAMENTE (segmento activo apagado y contador a cero) y al
   * caer la bandera espera los ticks necesarios y se lanza DE NUEVO
   * desde su primer segmento.
   * @since 3.12
   */
  var desenlaceMuerte = false;

  /**
   * Marca de ESLABÓN DE DESENLACE: ids de los segmentos de la
   * cadena salvado/muerte en curso; se propaga por siguiente y
   * define quién avanza durante la congelación.
   * @type {Object<string, boolean>}
   * @since 3.11
   */
  var marcaDesenlace = {};
  // ACOMPAÑANTES (13.ª iteración): mapa principal → { principal,
  // comp } del campo «mostrarJunto» de los segmentos. Al ENCENDER o
  // APAGAR el principal se hace lo mismo con el secundario
  // (siempre, en cualquier contexto); el secundario encendido por
  // la SECUENCIA (solo, sin su principal) no altera al principal.
  var mapaComp = {};
  var idsSecundarios = {};   // F5-I15 (A1): ids de los secundarios de «mostrar junto a»

  /**
   * Tabla fija del display de SIETE SEGMENTOS: qué barras (a-g)
   * enciende cada dígito. La trae el sistema; el autor solo dibuja
   * el «8».
   * @constant {Object<string, string>}
   * @since 3.7
   */
  var TABLA_SIETE = {
    '0': 'abcdef', '1': 'bc', '2': 'abged', '3': 'abgcd',
    '4': 'fgbc', '5': 'afgcd', '6': 'afgedc', '7': 'abc',
    '8': 'abcdefg', '9': 'abcdfg'
  };
  var LETRAS_BARRAS = 'abcdefg';
  /**
   * Enlaces del contador hacia sus dígitos (F4-I9 v3): digito_1
   * (unidades, OBLIGATORIO), digito_2 (decenas), digito_3,
   * digito_4. Solo viajan los puestos: el número de dígitos es
   * los que el autor agrupó.
   * @constant {string[]}
   * @since 3.7
   */
  var ENLACES_CONTADOR = ['digito_1', 'digito_2', 'digito_3', 'digito_4'];

  /**
   * CONTADORES (F3-I8 → F4-I9): los internos genéricos viven arriba
   * (contadoresInternos, presentación en pantalla incluida). Esta
   * declaración vieja se despide.
   */

  /**
   * ÍNDICE en la lista del segmento que es el JUGADOR ACTIVO: el
   * que está encendido y que cambia con las pulsaciones. Si es
   * null, al iniciar se BUSCA el primero que se encuentre (hoy
   * por tipo/enlaces; más adelante el diseñador lo marcará). Se
   * actualiza en cada movimiento: el nuevo segmento encendido
   * pasa a ser el jugador.
   * @type {?number}
   * @since 3.3
   */
  var jugador = null;

  /**
   * Variedad del generador (F3-I8): una ruta PUEDE repetirse, pero
   * no más de MAX_REPETICIONES_RUTA veces seguidas — con muy pocas
   * rutas (p. ej. 3 en el cartucho de prueba) el LCG caía con
   * frecuencia en la misma y la partida parecía un bucle. La lista
   * ultimasRutas guarda los números de las últimas rutas lanzadas
   * (como mucho MAX_REPETICIONES_RUTA); si TODAS son la misma, esa
   * ruta se queda fuera de los candidatos y se genera otra. La
   * constante es ajustable: con 2 una misma ruta puede salir dos
   * veces seguidas, nunca tres. Sigue siendo determinista (misma
   * semilla = misma partida) y consume el mismo servicio del
   * director. Con una sola ruta no hay nada que variar.
   * @constant {number}
   * @since 3.6
   */
  var MAX_REPETICIONES_RUTA = 2;

  /**
   * Números de las ÚLTIMAS RUTAS lanzadas (F3-I8), en orden de
   * lanzamiento; como mucho MAX_REPETICIONES_RUTA entradas (la más
   * vieja se sale). Se vacía en iniciar(): en una partida nueva la
   * primera ruta es libre.
   * @type {Array<number>}
   * @since 3.6
   */
  var ultimasRutas = [];

  /**
   * F4-I2: el CONTADOR DE RUTAS VIVAS — cuántas rutas hay en
   * pantalla ahora. Sube al lanzar una (lanzarRuta) y baja al
   * morir una (el barrido: final sin siguiente, enlace roto,
   * aterrizaje en familia o llegada a un punto de colisión —
   * nunca los eslabones de un desenlace, que van marcados). El
   * Director lo cruza con su MÁXIMO de simultáneas (campo
   * rutas.aumentarCada) para decidir cuándo se lanza la siguiente.
   * Se reinicia con cada partida (iniciar).
   * @type {number}
   * @since 4.2
   */
  var nRutasVivas = 0;

  /**
   * ¿Está la depuración activa? La llave global vive en
   * index.html (GW_DEBUG); aquí solo se consulta, con guarda de
   * typeof para que nada reviente si alguien la quita.
   * @returns {boolean} true si hay que escribir diagnóstico.
   * @since 2.5
   */
  function _debug() {
    return typeof GW_DEBUG !== 'undefined' && GW_DEBUG;
  }

  /**
   * ENUMERACIONES DEL PUENTE (F3-I11): los tipos de segmento y los
   * mecanismos de fin con NOMBRE — las comparaciones se leen
   * (seg.tipo === tipos.juego), nada de dígitos mágicos. Los valores
   * son los mismos de siempre; viven en comunListas porque los usan
   * las dos etapas. El fallback local es solo defensivo.
   * @constant {Object}
   * @since 3.8
   */
  var tiposEnum = (typeof comunListas !== 'undefined' &&
    comunListas.tipos)
    ? comunListas.tipos
    : {
      jugador: 0, juego: 1, inicio: 2, vida: 3, muerte: 4,
      digito: 5, contador: 6, cartucho: 7,
      adicional: 8, inicioAdicional: 9
    };
  var finEnum = (typeof comunListas !== 'undefined' &&
    comunListas.fin)
    ? comunListas.fin
    : {
      ninguno: null, vida: 'vida', muerte: 'muerte',
      contador: 'contador'
    };

  /**
   * La lista de segmentos en memoria, por REFERENCIA, del puente
   * de datos comunListas. Se pide en cada uso: si se recarga el
   * cartucho, la lista cambia y el motor nunca escribe en una
   * lista muerta. Sin cartucho GWI cargado: lista vacía.
   * @returns {Array<Object>} Segmentos en memoria.
   * @since 2.7
   */
  function _lista() {
    return (typeof comunListas !== 'undefined') ? comunListas.segmentos() : [];
  }

  /**
   * ¿Combina este cartucho dos teclas en un mismo tick? La regla
   * viaja por el puente (la autoría la escribió al cargar el
   * cartucho; hoy: { combinar: bool }). Ausente o sin puente:
   * cada pulsación es un paso independiente.
   * @returns {boolean} true si hay que reducir el buffer a ejes.
   * @since 3.2
   */
  function _combinar() {
    // La regla «combinar» vive en el SETUP (reglas, por el puente):
    // subir la combinación de pulsaciones por ejes al cartucho quedó
    // como AMPLIACIÓN futura (decisión del usuario, 24-10-2026:
    // solo la usan los últimos juegos lanzados).
    return typeof comunListas !== 'undefined' &&
      !!comunListas.reglas() && !!comunListas.reglas().combinar;
  }

  /**
   * BUSCA al jugador en la lista: el primero que se encuentre.
   * Prioridad: (1) el segmento MARCADO como primer jugador por el
   * diseñador (campo "primero" del GWI, F3-I3) — si alguien marcó
   * dos a mano en el JSON, gana el primero de la lista; (2) el
   * primer segmento de tipo jugador (tipo 0); (3) el primero con
   * algún enlace de dirección (la red del jugador); (4) el
   * primero de la lista, con aviso. Sin marca, la partida empieza
   * por donde el cartucho tenga su red: la marca es la palabra del
   * autor, la búsqueda es el salvavidas.
   * @param {Array<Object>} segs - Lista de segmentos.
   * @returns {?number} Índice del jugador, o null si lista vacía.
   * @since 3.3 (marca del diseñador: 3.4)
   */
  function _buscarJugador(segs) {
    if (segs.length === 0) return null;
    for (var m = 0; m < segs.length; m++) {
      if (segs[m].primero) return m;         // la marca del diseñador
    }
    for (var i = 0; i < segs.length; i++) {
      if (segs[i].tipo === tiposEnum.jugador) return i;      // marcado: tipo jugador
    }
    for (var j = 0; j < segs.length; j++) {    // la red de enlaces
      var s = segs[j];
      if (s.izquierda || s.derecha || s.arriba || s.abajo) return j;
    }
    if (_debug()) {
      console.warn('motor del juego: ningún segmento marcado como ' +
        'jugador; se usa el primero de la lista.');
    }
    return 0;
  }

  /**
   * Mueve al JUGADOR en una dirección: buscar el enlace que la
   * autoría dibujó desde el segmento ACTUAL (izquierda, derecha,
   * arriba o abajo); si existe, el actual se APAGA y el nuevo se
   * ENCIENDE, y el nuevo pasa a ser el jugador. Si no hay enlace
   * (el borde de la red: el bote ya está en el último hueco), no
   * pasa nada — la pulsación se consume y el jugador se queda
   * donde está, como en la máquina real. Nunca se tocan las
   * coordenadas: mover es cambiar de segmento, no desplazarlo.
   * @param {Array<Object>} segs - Lista de segmentos.
   * @param {string} direccion - Nombre del enlace a seguir.
   * @returns {void}
   * @since 3.3
   */
  function _moverJugador(segs, direccion) {
    if (jugador === null) return;            // sin jugador no hay movimiento
    var actual = segs[jugador];
    if (!actual) return;
    var idNuevo = actual[direccion];
    if (!idNuevo) {
      if (_debug()) {
        console.warn('motor del juego: el jugador ' + (actual.id || '?') +
          ' no tiene enlace "' + direccion + '": no se mueve.');
      }
      return;
    }
    var idxNuevo = -1;
    for (var i = 0; i < segs.length; i++) {
      if (segs[i].id === idNuevo) { idxNuevo = i; break; }
    }
    if (idxNuevo < 0) {
      if (_debug()) {
        console.warn('motor del juego: el enlace "' + direccion + '" del ' +
          'jugador ' + (actual.id || '?') + ' apunta a ' + idNuevo +
          ', que no existe en la lista.');
      }
      return;
    }
    var nuevo = segs[idxNuevo];
    actual.visible = false;                  // el hueco que se deja...
    actual.cambiar = true;
    nuevo.visible = true;                    // ...y el que se ocupa
    nuevo.cambiar = true;
    jugador = idxNuevo;                      // el nuevo es el jugador
    if (_debug()) {
      console.log('motor del juego: jugador ' + (actual.id || '?') +
        ' apagado, ' + (nuevo.id || '?') + ' encendido');
    }
  }

  /**
   * El paso (1) del tick: ENTRADA. Vacía la cola de pulsaciones
   * pendientes del puente (FIFO; quien la llena es la máquina) y
   * actúa en consecuencia. Con la regla "combinar" activa, todo
   * el buffer se reduce a EJES (dx, dy normalizados a -1, 0 o 1)
   * y cada eje da UN paso en su dirección; sin ella, cada
   * pulsación es un paso en orden de llegada. Las pulsaciones de
   * números sin movimiento se consumen y no hacen nada.
   * @param {Array<Object>} segs - Lista de segmentos.
   * @returns {void}
   * @since 3.2 (por enlaces: 3.3)
   */
  function _aplicarEntrada(segs) {
    var cola = (typeof comunListas !== 'undefined') ?
      comunListas.colaPulsaciones() : [];
    // CONGELACIÓN (duodécima iteración): con un desenlace en
    // marcha el jugador NO responde — las pulsaciones se consumen
    // sin efecto (como en la máquina real, que ignora los botones
    // durante la animación de muerte).
    if (congelada) {
      while (cola.length > 0) cola.shift();
      return;
    }
    if (cola.length === 0) return;
    if (_combinar()) {
      var dx = 0, dy = 0;
      while (cola.length > 0) {
        var eje = EJES[MOVER[String(cola.shift())]];
        if (eje) { dx += eje[0]; dy += eje[1]; }
      }
      // UN paso por eje, lo más parecido a 1 posible (como en la
      // máquina real): el vector se NORMALIZA por eje a -1, 0 o 1
      // — dos pulsaciones de la MISMA dirección en la misma
      // ventana son UN paso (no dos), y las opuestas ya se han
      // anulado al sumar.
      dx = dx < 0 ? -1 : (dx > 0 ? 1 : 0);
      dy = dy < 0 ? -1 : (dy > 0 ? 1 : 0);
      if (dx < 0) _moverJugador(segs, 'izquierda');
      if (dx > 0) _moverJugador(segs, 'derecha');
      if (dy < 0) _moverJugador(segs, 'arriba');
      if (dy > 0) _moverJugador(segs, 'abajo');
    } else {
      while (cola.length > 0) {
        var dir = MOVER[String(cola.shift())];
        if (dir) _moverJugador(segs, dir);
      }
    }
  }

  /**
   * LANZA una ruta nueva (F3-I5): si no queda NINGÚN elemento de
   * ruta visible (ninguna viva), pide un número de ruta al PRNG
   * del director (juegoDirector.aleatorio), localiza el segmento
   * inicio de esa ruta entre los de tipo 2 (ordenados por su
   * número de ruta) y lo ENCIENDE: la ruta nace con su primer
   * elemento encendido. Si el cartucho no tiene inicios, aviso y
   * no nace nada. Las rutas van encadenadas: esta política hace
   * que la nueva nazca un tick tras morir la anterior (el tick
   * que ve cero vivas es el que lanza); la política y las
   * aceleraciones viajarán en el cartucho en una fase posterior.
   * @param {Array<Object>} segs - Lista de segmentos.
   * @returns {void}
   * @since 3.5
   */
  function _lanzarRuta(segs) {
    // CONGELACIÓN (duodécima iteración): con un desenlace en curso
    // no se lanzan rutas nuevas (el barrido de vivos tampoco las
    // avanza: solo avanza la cadena del desenlace).
    if (congelada) return;
    var inicios = [];
    segs.forEach(function (seg) {
      if (seg.tipo === tiposEnum.inicio) inicios.push(seg);  // los inicios del cartucho
    });
    if (inicios.length === 0) {
      if (_debug()) {
        console.warn('motor del juego: el cartucho no tiene inicios ' +
          'de ruta; no nacen rutas.');
      }
      return;
    }
    // F4-I2: la política YA NO es «solo si no queda NINGUNA viva» —
    // se lanza una nueva mientras las VIVAS sean menos que el
    // MÁXIMO de simultáneas que autoriza el Director (sube cada
    // rutas.aumentarCada lanzamientos; 1 si el GWI no lo declara,
    // que es la regla histórica). Tope de seguridad: nunca más
    // simultáneas que las rutas DEFINIDAS en el cartucho.
    var maxSim = (typeof juegoDirector !== 'undefined' &&
      typeof juegoDirector.maxRutasSimultaneas === 'function')
      ? juegoDirector.maxRutasSimultaneas() : 1;
    if (maxSim > inicios.length) maxSim = inicios.length;
    if (nRutasVivas >= maxSim) return;
    inicios.sort(function (a, b) { return (a.ruta || 0) - (b.ruta || 0); });
    // Variedad (F3-I8): con las últimas lanzadas aún en la
    // memoria, si TODAS son la misma ruta esa ruta se queda fuera
    // y se genera otra — el generador puede repetir una ruta,
    // pero nunca más de MAX_REPETICIONES_RUTA veces seguidas (con
    // pocas rutas el LCG encadenaba repeticiones). Sigue siendo
    // determinista: la elección es función del estado del
    // generador, como siempre.
    var candidatos = inicios;
    if (ultimasRutas.length === MAX_REPETICIONES_RUTA && inicios.length > 1) {
      var saturada = ultimasRutas[0];
      var todasIguales = ultimasRutas.every(function (r) { return r === saturada; });
      if (todasIguales) {
        var otros = inicios.filter(function (s) {
          return (s.ruta || 0) !== saturada;
        });
        if (otros.length > 0) candidatos = otros;
      }
    }
    var elegido = candidatos[juegoDirector.aleatorio(candidatos.length)];
    ultimasRutas.push(elegido.ruta || 0);
    while (ultimasRutas.length > MAX_REPETICIONES_RUTA) ultimasRutas.shift();
    elegido.visible = true;
    elegido.cambiar = true;
    // F4-I2: la ruta NACE — una viva más y el Director cuenta el
    // lanzamiento (su total sube y con él, cada múltiplo de
    // rutas.aumentarCada, el máximo de simultáneas).
    nRutasVivas++;
    if (typeof juegoDirector !== 'undefined' &&
      typeof juegoDirector.rutaLanzada === 'function') {
      juegoDirector.rutaLanzada();
    }
    if (_debug()) {
      console.log('motor del juego: ruta ' + (elegido.ruta || '?') +
        ' lanzada (' + (elegido.id || '?') + ' encendido)');
    }
  }

  /**
   * F5-I15 (A3, A4b): cuenta las RUTAS VIVAS mirando la pantalla,
   * no apuntando nacimientos y muertes. Es viva toda ruta encendida
   * (juego o inicio) que no sea eslabón de un desenlace ni la tenga
   * encendida la Secuencia. Antes cada final de recorrido restaba
   * una (_muereRuta) y bastaba que un segmento se apagara por otra
   * vía (la Secuencia, dos rutas que se funden) para que el contador
   * se quedara de más y no naciera ninguna ruta más. Se recalcula
   * tras el barrido, antes de decidir el lanzamiento.
   * @param {Array<Object>} segs - Lista de segmentos.
   * @returns {void}
   * @since 4.2 (como cuenta: F5-I15)
   */
  function _contarRutasVivas(segs) {
    var n = 0;
    for (var i = 0; i < segs.length; i++) {
      var seg = segs[i];
      if (seg.visible && _esDeRuta(seg) && !marcaDesenlace[seg.id] &&
        !animados[seg.id]) n++;
    }
    nRutasVivas = n;
  }

  /**
   * Localiza el ÍNDICE de un segmento por su id (o -1).
   * @param {Array<Object>} segs - Lista de segmentos.
   * @param {string} id - Identificador seg_NNN buscado.
   * @returns {number} Índice en la lista, o -1 si no existe.
   * @since 3.6
   */
  function _indiceDe(segs, id) {
    for (var i = 0; i < segs.length; i++) {
      if (segs[i].id === id) return i;
    }
    return -1;
  }

  /**
   * Traduce el valor de salvadoContador/muerteContador al ÍNDICE del
   * contador interno genérico (F4-I9): '1'..'4' (o número 1-4 si
   * alguien editó el GWI a mano) → 0..3; null → -1 (no se toca
   * nada). Los GWI anteriores a esta iteración usaban 'vida'/
   * 'muerte': se mapean a los contadores 1 y 2 con aviso, para que
   * los cartuchos viejos sigan contando mientras se reescriben.
   * @param {?(string|number)} valor - Lo que declara el punto de colisión.
   * @returns {number} Índice 0..3, o -1 si no hay contador.
   * @since 3.7
   */
  function _numeroDeContador(valor) {
    if (valor === null || valor === undefined) return -1;
    if (valor === 'vida') {           // legado F3-I8
      if (_debug()) {
        console.warn('motor del juego: contador "vida" legado; se usa el 1.');
      }
      return 0;
    }
    if (valor === 'muerte') {         // legado F3-I8
      if (_debug()) {
        console.warn('motor del juego: contador "muerte" legado; se usa el 2.');
      }
      return 1;
    }
    var n = Number(valor) - 1;
    return (n >= 0 && n <= 3) ? n : -1;
  }

  /**
   * Ajusta un contador interno (F4-I9): SUBE o BAJA una unidad según
   * la DIRECCIÓN que declara el segmento de contador que lo usa (el
   * primero que se encuentre; sin contador en pantalla, decide el
   * mecanismo de fin por iconos: vidas descendente, muertes
   * ascendente).
   * Los descendentes no bajan de cero: al llegar se quedan. El
   * contador interno nunca se corta por arriba: la presentación se
   * queda sin dígitos pero el valor real sigue (lo necesitará el fin
   * de partida).
   * @param {Array<Object>} segs - Lista de segmentos.
   * @param {number} n - Índice del contador (0..3).
   * @returns {void}
   * @since 3.7
   */
  function _ajustarContador(segs, n) {
    var direccion = null;
    for (var i = 0; i < segs.length; i++) {
      if (segs[i].tipo === tiposEnum.contador &&
        Number(segs[i].contadorInterno) === n + 1) {
        direccion = segs[i].direccion || 'ascendente';
        break;
      }
    }
    // Sin contador en PANTALLA que declare la dirección, el
    // mecanismo de FIN POR ICONOS decide (F3-I11): las vidas se
    // PIERDEN (descendente) y las muertes se SUMAN (ascendente).
    if (direccion === null) {
      if (configFin.mecanismo === finEnum.vida && n === 0) {
        direccion = 'descendente';
      } else if (configFin.mecanismo === finEnum.muerte && n === 1) {
        direccion = 'ascendente';
      } else {
        direccion = 'ascendente';
      }
    }
    contadoresInternos[n] += (direccion === 'descendente') ? -1 : 1;
    if (contadoresInternos[n] < 0) contadoresInternos[n] = 0;   // no baja de 0
  }

  /**
   * PREPARA los contadores (F4-I9 v3): por cada segmento de tipo
   * contador bien formado levanta su PRESENTACIÓN jerárquica —
   * SIN COPIAS NI POSICIONES CALCULADAS: cada posición de dígito
   * es un «8» REAL del arte (agrupado por la autoría con «Hacer
   * dígito»/«Hacer contador»), y la presentación enciende las
   * BARRAS REALES de cada posición. El contador es un FICTICIO
   * del editor: sus posiciones son TODAS dígitos enlazados —
   * digito_1 (unidades, OBLIGATORIO) hasta digito_4, y cada dígito
   * tipo 5 resuelve sus SIETE barras por barra_a..barra_g. Las
   * barras quedan marcadas en idsBarras (fuera del barrido de
   * rutas: solo aportan su gráfico, las enciende la presentación
   * del contador). Un contador o dígito incompleto avisa y se
   * SALTA (sin romper la partida); el número de dígitos es el
   * que el autor agrupó: 1 (solo unidades) hasta 4.
   * @param {Array<Object>} segs - Lista de segmentos (solo se LEÍA).
   * @returns {void}
   * @since 3.7
   */
  function _prepararContadores(segs) {
    /**
     * Levanta la fila de las SIETE barras de un DÍGITO (tipo 5):
     * todas por sus enlaces barra_a..barra_g (el dígito es un
     * ficticio del editor: ninguna barra es él). Devuelve null
     * (con aviso) si falta alguna.
     * @param {Object} pos - Segmento tipo 5 (dígito).
     * @returns {?Object<string, Object>} Letra → barra, o null.
     */
    function filaDe(pos) {
      var fila = {};
      for (var i = 0; i < LETRAS_BARRAS.length; i++) {
        var letra = LETRAS_BARRAS[i];
        var j = _indiceDe(segs, pos['barra_' + letra]);
        if (j < 0) return null;
        fila[letra] = segs[j];
      }
      return fila;
    }
    idsBarras = {};
    presentaciones = [];
    segs.forEach(function (contador) {
      if (contador.tipo !== tiposEnum.contador) return;
      // Posición de las UNIDADES: digito_1 (F4-I9 v3: el contador
      // es un ficticio; sus posiciones son TODAS dígitos enlazados).
      if (!contador.digito_1) {
        if (_debug()) {
          console.warn('motor del juego: el contador ' + (contador.id || '?') +
            ' no enlaza con su dígito de las unidades: no se ' +
            'presenta.');
        }
        return;
      }
      var idxU = _indiceDe(segs, contador.digito_1);
      if (idxU < 0 || segs[idxU].tipo !== tiposEnum.digito) {
        if (_debug()) {
          console.warn('motor del juego: el digito_1 del contador ' +
            (contador.id || '?') + ' no es un dígito: no se ' +
            'presenta.');
        }
        return;
      }
      var posiciones = [];
      for (var k = 0; k < ENLACES_CONTADOR.length; k++) {
        var campo = ENLACES_CONTADOR[k];
        if (!contador[campo]) break;             // sin más dígitos: fin
        var idxDig = _indiceDe(segs, contador[campo]);
        if (idxDig < 0 || segs[idxDig].tipo !== tiposEnum.digito) {
          if (_debug()) {
            console.warn('motor del juego: el ' + campo + ' del contador ' +
              (contador.id || '?') + ' no es un dígito: se ' +
              'presentan las posiciones que hay.');
          }
          break;
        }
        var fila = filaDe(segs[idxDig]);
        if (!fila) {
          if (_debug()) {
            console.warn('motor del juego: al dígito ' +
              (segs[idxDig].id || '?') + ' le faltan barras: se ' +
              'presentan las posiciones que hay.');
          }
          break;
        }
        posiciones.push(fila);
      }
      // Las barras de TODAS las posiciones, fuera del barrido de rutas.
      for (var p = 0; p < posiciones.length; p++) {
        for (var q = 0; q < LETRAS_BARRAS.length; q++) {
          idsBarras[posiciones[p][LETRAS_BARRAS[q]].id] = true;
        }
      }
      var n = (Number(contador.contadorInterno) || 1) - 1;
      presentaciones.push({
        id: contador.id,
        n: Math.max(0, Math.min(3, n)),
        direccion: contador.direccion || 'ascendente',
        presentarCero: contador.presentarCero !== false,
        posiciones: posiciones
      });
    });
  }

  /**
   * PRESENTA los contadores en pantalla (F4-I9): por cada contador,
   * toma el valor de su contador interno, lo parte en dígitos y
   * enciende en cada posición las BARRAS REALES de su «8» que la
   * tabla del 7 segmentos marca; el resto apagadas (nada de copias:
   * cada posición es el dígito que el autor agrupó). Relleno de la
   * izquierda: mientras el valor CABE en n dígitos, las posiciones
   * sobrantes van en BLANCO (las siete apagadas); al PASAR de 10^n
   * se presentan los ÚLTIMOS n dígitos, rellenos con ceros a la
   * izquierda (cuenta kilométrica: 99, 00, 01...). Y la propiedad
   * «presentar el cero»: si el contador declara que NO lo presenta,
   * el valor cero deja TODAS las posiciones en blanco (la zona
   * queda vacía, como los marcadores de puntuación de las máquinas
   * reales). Se llama al iniciar y tras cada decisión de colisión
   * que toque un contador: nada periódico.
   * @returns {void}
   * @since 3.7
   */
  function _presentaContadores() {
    presentaciones.forEach(function (pr) {
      var n = pr.posiciones.length;
      var valor = contadoresInternos[pr.n] || 0;
      var texto;
      if (valor === 0 && !pr.presentarCero) {
        texto = '';                             // todo en blanco
        // (el bucle de abajo leerá charAt fuera de rango: cadena
        // vacía, todas las barras apagadas — el efecto buscado)
      } else if (valor >= Math.pow(10, n)) {
        // Los últimos n dígitos, con ceros a la izquierda (cuenta
        // kilométrica: 99, 00, 01...).
        var s = String(valor % Math.pow(10, n));
        while (s.length < n) s = '0' + s;
        texto = s;
      } else {
        // Más cortos: blancos a la izquierda (␣0, ␣1, ...).
        var s2 = String(valor);
        while (s2.length < n) s2 = ' ' + s2;
        texto = s2;
      }
      for (var k = 0; k < n; k++) {
        // La posición k=0 es la de las UNIDADES (la más a la
        // derecha); el texto se lee de izquierda a derecha.
        var ch = texto.charAt(n - 1 - k);
        var encendidas = (ch === ' ' || !TABLA_SIETE[ch]) ? '' : TABLA_SIETE[ch];
        var fila = pr.posiciones[k];
        for (var q = 0; q < LETRAS_BARRAS.length; q++) {
          var letra = LETRAS_BARRAS[q];
          var barra = fila[letra];
          var debe = encendidas.indexOf(letra) >= 0;
          if (barra.visible !== debe) {
            barra.visible = debe;
            barra.cambiar = true;
          }
        }
      }
    });
  }

  /**
   * La FAMILIA de iconos de vida o muerte (F3-I11), ordenada por su
   * número de contador (seg.contador, el que el GWI trae: 1..N en el
   * orden de la familia). Las vidas iniciales de un mecanismo de
   * iconos salen de CONTARLA: no hay que definirlas.
   * @param {Array<Object>} segs - Lista de segmentos.
   * @param {number} tipo - tiposEnum.vida o tiposEnum.muerte.
   * @returns {Array<Object>} La familia ordenada 1..N.
   * @since 3.8
   */
  function _familiaIconos(segs, tipo) {
    var fam = segs.filter(function (s) { return s.tipo === tipo; });
    fam.sort(function (a, b) { return (a.contador || 0) - (b.contador || 0); });
    return fam;
  }

  /**
   * Ordena una familia de iconos por su CADENA (corrección del
   * 21-10-2026): si los iconos están enlazados por «siguiente»
   * (A→B→C), el orden de presentación ES el de la cadena — la
   * primera muerte enciende el ÚLTIMO de la cadena (C), la segunda
   * el anterior (B), la tercera el primero (A): «si la cadena es
   * A→B→C, debe encender C y no se apaga ya nunca, luego B sin
   * apagar C, luego A, B y C». La numeración de la familia
   * («contador» del diseñador) queda como RESPALDO: si la familia
   * no forma UNA cadena completa (sin cabeza única, rota o con
   * ciclo), se ordena por número como siempre.
   * @param {Array<Object>} segs - Lista de segmentos.
   * @param {Array<Object>} fam - La familia ya filtrada.
   * @returns {Array<Object>} La familia ordenada (cabeza → último).
   * @since 3.10
   */
  function _ordenFamilia(segs, fam) {
    if (fam.length < 2) return fam;
    var porId = {};
    fam.forEach(function (s) { porId[s.id] = s; });
    // Cabeza: el icono al que NINGÚN otro de la familia apunta por
    // «siguiente» (debe haber exactamente una).
    var apuntados = {};
    fam.forEach(function (s) {
      if (s.siguiente && porId[s.siguiente]) apuntados[s.siguiente] = true;
    });
    var cabezas = fam.filter(function (s) { return !apuntados[s.id]; });
    if (cabezas.length !== 1) return fam;      // respaldo: numeración
    // Recorrido de la cadena con guarda de ciclos.
    var orden = [];
    var visto = {};
    var actual = cabezas[0];
    while (actual && !visto[actual.id]) {
      visto[actual.id] = true;
      orden.push(actual);
      actual = porId[actual.siguiente] || null;
    }
    if (orden.length !== fam.length) return fam;  // rota: respaldo
    return orden;
  }

  /**
   * SINCRONIZA las familias de iconos con sus contadores internos
   * (F3-I11; corrección del 21-10-2026): SIN puerta de mecanismo —
   * toda familia presente se sincroniza con su contador, conviva o
   * no con el mecanismo de fin declarado (fin=contador e iconos de
   * muerte pueden ir juntos). VIDA: quedan encendidos los PRIMEROS
   * n (n = contador interno 1). MUERTE: quedan encendidos los
   * ÚLTIMOS n (n = contador interno 2), donde n es el número de
   * MUERTES según la DIRECCIÓN del interno: si es ASCENDENTE, su
   * valor directo; si es DESCENDENTE (p. ej. un dígito de vidas
   * 3→0), lo RESTADO desde el valor inicial — así cada muerte
   * enciende UNO nuevo y ninguno se apaga nunca. La decisión de
   * una colisión (o el aterrizaje de una cadena) ajusta el
   * contador y marca la suciedad; la sincronización ocurre junto a
   * la presentación de los contadores numéricos, nada periódico.
   * El ORDEN de la familia es el de su CADENA de «siguiente»
   * (A→B→C: C enciende primero) si forma una cadena completa;
   * si no, la numeración del diseñador (ordenFamilia).
   * @param {Array<Object>} segs - Lista de segmentos.
   * @returns {void}
   * @since 3.8 (sin puerta + direccional: 3.9)
   */
  function _sincronizarIconos(segs) {
    /**
     * Enciende o apaga un icono si cambia (marca la suciedad).
     * @param {Object} seg - Icono.
     * @param {boolean} debe - Visible que le corresponde.
     */
    function _setVis(seg, debe) {
      if (seg.visible !== debe) {
        seg.visible = debe;
        seg.cambiar = true;
      }
    }
    var famV = _ordenFamilia(segs, _familiaIconos(segs, tiposEnum.vida));
    if (famV.length > 0) {
      var nV = Math.max(0, Math.min(famV.length, contadoresInternos[0]));
      famV.forEach(function (s, i) {
        _setVis(s, (i + 1) <= nV);            // primeros n (cadena o nº)
      });
    }
    var famM = _ordenFamilia(segs, _familiaIconos(segs, tiposEnum.muerte));
    if (famM.length > 0) {
      // Muertes según la dirección del interno 2: descendente =
      // lo restado desde el inicial (3→2 es UNA muerte);
      // ascendente = el valor directamente.
      var muertes = (direccionesInternas[1] === 'descendente')
        ? Math.max(0, inicialesInternos[1] - contadoresInternos[1])
        : contadoresInternos[1];
      var nM = Math.max(0, Math.min(famM.length, muertes));
      famM.forEach(function (s, i) {
        _setVis(s, (i + 1) > famM.length - nM);  // últimos n, del final hacia atrás
      });
    }
  }

  /**
   * ADICIONALES (duodécima iteración): los segmentos de tipo
   * adicional (8) e inicioAdicional (9) viven en bucles PROPIOS
   * entre ellos, independientes de las rutas y de las colisiones.
   * Nacimiento (iniciar): adicional SIN siguiente = fijo encendido
   * (p. ej. el helicóptero); adicional CON siguiente = apagado, lo
   * enciende el bucle (el aspa inferior); inicioAdicional = nace
   * encendido y avanza cada tick por su siguiente. Este bucle los
   * avanza SIEMPRE (la congelación no los para: solo se para el
   * juego) y salta los que la SECUENCIA tiene encendidos (marca
   * animados: mientras la animación los maneja, nadie más los toca).
   * @param {Array<Object>} segs - Lista de segmentos.
   * @returns {void}
   * @since 3.11
   */
  function _avanzarAdicionales(segs) {
    // FOTO de los visibles ANTES de mutar (criterio del barrido de
    // rutas): sin esto, al encender el siguiente del par el bucle lo
    // volvía a ver en la MISMA pasada y el ciclo oscilaba doble.
    var foto = [];
    for (var f = 0; f < segs.length; f++) {
      var sf = segs[f];
      if (sf.visible && (sf.tipo === tiposEnum.adicional ||
        sf.tipo === tiposEnum.inicioAdicional) && !animados[sf.id]) {
        foto.push(sf);
      }
    }
    for (var p = 0; p < foto.length; p++) {
      var seg = foto[p];
      if (!seg.siguiente) continue;        // fijo: no hay bucle
      var j = _indiceDe(segs, seg.siguiente);
      if (j < 0) {
        if (_debug()) {
          console.warn('motor del juego: el siguiente del adicional ' +
            (seg.id || '?') + ' no existe: se apaga.');
        }
        seg.visible = false;               // cadena rota: muere
        seg.cambiar = true;
        continue;
      }
      seg.visible = false;
      seg.cambiar = true;
      segs[j].visible = true;
      segs[j].cambiar = true;
      if (_debug()) {
        console.log('motor del juego: adicional avanza, ' +
          (segs[j].id || '?') + ' encendido');
      }
    }
  }

  /**
   * SECUENCIA del cartucho (duodécima iteración): animación
   * periódica de hasta 5 segmentos (juego/inicio/adicional)
   * encendidos EN ORDEN, uno por tick. Se lanza cada «ticks» +
   * lo que dura (el contador vuelve a cero al inicio, al terminar
   * lo que dura (el contador vuelve a cero al inicio y al terminar
   * la animación).
   * de rutas NO los avanza (pueden ser a la vez eslabones de
   * cadenas — aletas compartidas: encendidos por aquí, avanzan solo
   * cuando una cadena los enciende) y no cuentan como ruta viva
 * para la política de lanzamiento. Suspendida SOLO mientras
 * corre un CICLO DE MUERTE (23-10: ni las colisiones ni la
 * congelación por desenlace salvado la paran).
   * @param {Array<Object>} segs - Lista de segmentos.
   * @returns {void}
   * @since 3.11
   */
  function _avanzarSecuencia(segs) {
    if (!configSec || !configSec.segmentos ||
      configSec.segmentos.length === 0) return;
    if (desenlaceMuerte) return;    // 23-10: suspendida SOLO en ciclo de muerte
    if (secIdx >= 0) {
      // Animando: apagar el actual y pasar al siguiente.
      var actual = configSec.segmentos[secIdx];
      var iA = _indiceDe(segs, actual);
      if (iA >= 0 && animados[actual]) {
        segs[iA].visible = false;
        segs[iA].cambiar = true;
      }
      delete animados[actual];
      secIdx++;
      if (secIdx >= configSec.segmentos.length) {
        secIdx = -1;                // animación terminada
        secContador = 0;            // relanza tras n + m ticks
        return;
      }
    } else {
      secContador++;
      if (secContador < Math.max(1, Number(configSec.ticks) || 1)) {
        return;
      }
      secContador = 0;
      secIdx = 0;                   // lanzamiento: nace el primero
    }
    var idS = configSec.segmentos[secIdx];
    var iS = _indiceDe(segs, idS);
    if (iS < 0) {
      secIdx = -1;
      secContador = 0;
      return;
    }
    animados[idS] = true;
    segs[iS].visible = true;
    segs[iS].cambiar = true;
    if (_debug()) {
      console.log('motor del juego: Secuencia, ' + idS + ' encendido (' +
        (secIdx + 1) + '/' + configSec.segmentos.length + ')');
    }
  }

  /**
   * ACOMPAÑANTES («mostrar junto a», 13.ª iteración): el pase de
   * sincronización del FINAL del tick — todo lo que encendió o
   * apagó al principal se refleja en su secundario, en CUALQUIER
   * contexto (rutas, desenlaces, Secuencia, congelación, iconos de
   * familia): la regla es única y a prueba de mecanismos futuros.
   * EXCEPCIÓN: el secundario encendido por la SECUENCIA (p. ej. la
   * aleta sola en la animación de fondo): la Secuencia lo maneja y
   * este pase no lo apaga aunque su principal esté apagado — al
   * moverse la Secuencia al siguiente segmento, el pase vuelve a
   * mandar. El secundario nunca altera al principal (asimétrico:
   * como la unión, pero sin absorber).
   * @returns {void}
   * @since 3.13
   */
  function _sincronizarAcompanantes() {
    for (var idP in mapaComp) {
      var par = mapaComp[idP];
      if (animados[par.comp.id] && par.comp.visible) continue;
      if (par.comp.visible !== par.principal.visible) {
        par.comp.visible = par.principal.visible;
        par.comp.cambiar = true;
      }
    }
  }

  /**
   * Comprueba la condición de FIN DE PARTIDA (F3-I11) sobre el
   * estado actual y marca «terminada» si se cumple. VIDA: no queda
   * ningún icono visible; MUERTE: están todos; CONTADOR: el interno
   * elegido vale cero (la transición >0→0 la detecta el tick con
   * una foto previa). Sin mecanismo declarado, nunca termina.
   * @returns {void}
   * @since 3.8
   */
  function _comprobarFin() {
    if (terminada || configFin.mecanismo === null) return;
    var segs = _lista();
    if (configFin.mecanismo === finEnum.vida) {
      if (_familiaIconos(segs, tiposEnum.vida).every(function (s) {
        return !s.visible;
      })) {
        terminada = true;
      }
    } else if (configFin.mecanismo === finEnum.muerte) {
      var fam = _familiaIconos(segs, tiposEnum.muerte);
      if (fam.length > 0 && fam.every(function (s) { return s.visible; })) {
        terminada = true;
      }
    }
    // «contador» no se comprueba aquí: la transición >0→0 la
    // detecta el tick comparando su foto previa del interno.
  }

  /**
   * La cadena ATERRIZA en un icono de la familia de vida/muerte
   * (corrección del 21-10-2026): el icono NO se enciende aquí ni la
   * cadena lo recorre — cuenta el desenlace UNA vez en el contador
   * de su familia (muerte → interno 2, vida → interno 1, respetando
   * la dirección declarada) y la SINCRONIZACIÓN enciende el que
   * corresponda: en muerte, acumulativo desde el ÚLTIMO (1ª muerte
   * el último icono, y no se apaga ya nunca; 2ª el penúltimo; 3ª
   * todos: fin). Es el único conteo del desenlace cuando la cadena
   * aterriza en la familia: la decisión no debe declarar ADEMÁS el
   * MISMO contador o contaría doble.
   * @param {Array<Object>} segs - Lista de segmentos.
   * @param {Object} icono - Icono de la familia en el que aterriza.
   * @returns {void}
   * @since 3.9
   */
  function _contarAterrizaje(segs, icono) {
    _ajustarContador(segs, icono.tipo === tiposEnum.muerte ? 1 : 0);
    contadoresSucios = true;
  }

  /**
   * ¿Es este segmento un ICONO de la familia de vida o muerte?
   * @param {Object} seg - Un segmento de la lista.
   * @returns {boolean} true si es vida o muerte.
   * @since 3.9
   */
  function _esIconoFamilia(seg) {
    return seg.tipo === tiposEnum.vida || seg.tipo === tiposEnum.muerte;
  }

  /**
   * La DECISIÓN de una colisión (F3-I8): el punto de colisión
   * visible NO avanza por siguiente — decide. Se lee la bandera
   * visible del segmento del jugador que la colisión señala:
   *   - Jugador visible: COLISIÓN POSITIVA → cadena `salvado`.
   *   - Jugador sin iluminar: COLISIÓN NEGATIVA → cadena `muerte`.
   * Sin enlace, el elemento desaparece (regla por defecto). El
   * contador marcado por salvadoContador/muerteContador se ajusta
   * UNA sola vez — salvo que la cadena ATERRICE en una familia de
   * iconos con el MISMO contador: entonces cuenta solo el
   * aterrizaje (contar ambos sería doble). Y si aterriza en la
   * familia, el icono NO se enciende aquí: lo presenta la
   * sincronización (corrección del 21-10-2026).
   * @param {Array<Object>} segs - Lista de segmentos.
   * @param {Object} seg - Punto de colisión visible que decide.
   * @returns {void}
   * @since 3.6 (aterrizaje en familia: 3.9)
   */
  function _decidirColision(segs, seg) {
    // SECUENCIA (corrección del 23-10-2026): la animación NO se
    // interrumpe en las colisiones — solo se SUSPENDE mientras
    // corre un CICLO DE MUERTE (bandera desenlaceMuerte, abajo).
    var idxJugador = _indiceDe(segs, seg.colision);
    var jugadorSeg = idxJugador >= 0 ? segs[idxJugador] : null;
    var positiva = !!(jugadorSeg && jugadorSeg.visible);
    var enlace = positiva ? seg.salvado : seg.muerte;
    var contador = positiva ? seg.salvadoContador : seg.muerteContador;
    var nCont = _numeroDeContador(contador);
    var idxDestino = enlace ? _indiceDe(segs, enlace) : -1;
    var destino = idxDestino >= 0 ? segs[idxDestino] : null;
    var aterriza = destino !== null && _esIconoFamilia(destino);
    var nFamilia = aterriza
      ? (destino.tipo === tiposEnum.muerte ? 1 : 0) : -1;
    // El conteo del desenlace ocurre UNA sola vez: si la cadena
    // ATRIZA en la familia, cuenta el aterrizaje (el icono de la
    // familia no se enciende aquí: lo presenta la sincronización);
    // el contador declarado por la decisión solo se ajusta si es
    // OTRO distinto del de la familia (contar los dos sería doble).
    if (nCont >= 0 && nCont !== nFamilia) {
      _ajustarContador(segs, nCont);           // sube o baja UNA vez, aquí
      contadoresSucios = true;
    }
    if (aterriza) _contarAterrizaje(segs, destino);
    seg.visible = false;                      // el punto decide y se apaga
    seg.cambiar = true;
    var sufijo = nCont >= 0 ? ' (contador ' + (nCont + 1) + ': ' +
      contadoresInternos[nCont] + ')' : '';
    if (!enlace) {
      if (_debug()) {
        console.log('motor del juego: ' + (seg.id || '?') + ' colisión ' +
          (positiva ? 'POSITIVA' : 'NEGATIVA') +
          ' sin cadena: el elemento desaparece' + sufijo);
      }
      return;
    }
    if (idxDestino < 0) {
      if (_debug()) {
        console.warn('motor del juego: el desenlace de ' + (seg.id || '?') +
          ' apunta a ' + enlace + ', que no existe: la cadena muere.');
      }
      return;
    }
    if (aterriza) {
      // El desenlace aterriza en la familia: el icono NO se enciende
      // aquí — cuenta ya hecho, la sincronización presentará el que
      // toque (acumulativo desde el último en muerte).
      if (_debug()) {
        console.log('motor del juego: ' + (seg.id || '?') + ' colisión ' +
          (positiva ? 'POSITIVA' : 'NEGATIVA') + ' → aterriza en ' +
          enlace + ': la familia cuenta el desenlace');
      }
      return;
    }
    segs[idxDestino].visible = true;          // la cadena de desenlace nace
    segs[idxDestino].cambiar = true;
    // CONGELACIÓN (duodécima iteración): al nacer un ESLABÓN DE
    // JUEGO de la cadena de desenlace, el juego se CONGELA (como
    // en la máquina real: rutas, lanzamientos y jugador parados
    // mientras corre la animación). La marca se propaga por
    // siguiente y la bandera cae al morir el último eslabón; un
    // ATERRIZAJE directo en la familia (muerte instantánea, sin
    // eslabones) NO congela nada.
    if (_esCadena(segs[idxDestino])) {
      congelada = true;
      marcaDesenlace[destino.id] = true;
      desenlaceMuerte = desenlaceMuerte || !positiva;  // SOLO el ciclo de muerte; una positiva en el mismo tick no lo anula
      // suspende la Secuencia (las colisiones NO la interrumpen)
      // 23-10 (detalle del usuario, AJUSTE FINAL): al NACER el
      // ciclo de muerte, la Secuencia se INTERRUMPE COMPLETAMENTE
      // — el segmento activo DESAPARECE de la pantalla (no se
      // queda congelado encendido), la marca de animados se
      // retira (el barrido vuelve a poder avanzarlo) y el
      // contador vuelve a CERO: la Secuencia NO reanuda por donde
      // iba, sino que espera los ticks necesarios y se LANZA DE
      // NUEVO desde su primer segmento.
      if (desenlaceMuerte && secIdx >= 0) {
        var idSec = configSec.segmentos[secIdx];
        var iSec = _indiceDe(segs, idSec);
        if (iSec >= 0 && animados[idSec]) {
          segs[iSec].visible = false;
          segs[iSec].cambiar = true;
          delete animados[idSec];
        }
        secIdx = -1;
        secContador = 0;
      }
      if (_debug()) {
        console.log('motor del juego: desenlace en marcha, juego ' +
          'congelado');
      }
    }
    if (_debug()) {
      console.log('motor del juego: ' + (seg.id || '?') + ' colisión ' +
        (positiva ? 'POSITIVA' : 'NEGATIVA') + ' → ' +
        enlace + ' encendido' + sufijo);
    }
  }

  /**
   * Vuelve al estado inicial del juego: TODAS las banderas a
   * false (nada encendido, nada sucio) y el JUGADOR buscado de
   * nuevo desde cero (la partida siempre empieza por el primero
   * que se encuentre) y ENCENDIDO en su posición: la referencia
   * visual de que el juego está vivo. No hay ruta viva: el
   * primer tick lanzará la primera (F3-I5). Lo llama el
   * juegoDirector al arrancar: el reloj y el estado se
   * reinician juntos.
   * @returns {void}
   * @since 2.5 (jugador por enlaces: 3.3, rutas: 3.5)
   */
  function iniciar() {
    jugador = null;                          // se busca de nuevo: partida nueva
    ultimasRutas.length = 0;               // sin últimas rutas: la primera es libre
    nRutasVivas = 0;                       // F4-I2: sin rutas en pantalla
    terminada = false;                     // partida nueva: se juega (F3-I11)
    congelada = false;              // duodécima iteración: sin desenlace
    marcaDesenlace = {};
    desenlaceMuerte = false;   // 23-10: sin ciclo de muerte
    animados = {};
    secContador = 0;                // la Secuencia, a cero al inicio
    secIdx = -1;
    configSec = (typeof comunListas !== 'undefined' &&
      typeof comunListas.secuenciaDeCartucho === 'function')
      ? comunListas.secuenciaDeCartucho() : null;
    var segs = _lista();
    jugador = _buscarJugador(segs);
    // Fusionados (F4-I9 v4): los segmentos absorbidos por una unión
    // viajan en el GWI marcados con fusionadoPor (la pieza F01 que
    // los absorbió lleva su imagen dentro de su fusión). El motor
    // nunca debe encenderlos ni pintarlos: fuera de la lista al
    // arrancar (al generar el cartucho del ESP se eliminan igual).
    for (var c2 = segs.length - 1; c2 >= 0; c2--) {
      if (segs[c2].fusionadoPor) segs.splice(c2, 1);
    }
    // Acompañantes (13.ª iteración): el mapa principal→secundario
    // se construye al arrancar desde el campo «mostrarJunto» de los
    // segmentos del GWI (el «mostradoJunto» del secundario es
    // informativo: el motor solo lee el lado del principal).
    mapaComp = {};
    idsSecundarios = {};
    for (var c3 = 0; c3 < segs.length; c3++) {
      var idComp = segs[c3].mostrarJunto;
      if (!idComp) continue;
      var iComp = _indiceDe(segs, idComp);
      if (iComp < 0) continue;
      mapaComp[segs[c3].id] = { principal: segs[c3], comp: segs[iComp] };
      idsSecundarios[segs[iComp].id] = true;
    }
    // Contadores internos (F4-I9): cada uno arranca con el VALOR
    // INICIAL que declara su segmento de contador (0 si el cartucho
    // no lo usa o no lo declara). Ya NO se deducen de los segmentos
    // de tipo vida: esos son la presentación por iconos, un sistema
    // independiente que convive con el contador numérico.
    contadoresInternos = [0, 0, 0, 0];
    inicialesInternos = [0, 0, 0, 0];      // para la muerte direccional (3.9)
    direccionesInternas = [null, null, null, null];
    // Fin de partida (F3-I11, v12.5): PROPIEDAD del cartucho (campo
    // «fin» del GWI, viaja por el puente) — ya NO es un segmento
    // tipo 7: ese era solo el truco del diseñador para manejarlo.
    configFin.mecanismo = null;
    configFin.contador = 0;
    var finCfg = (typeof comunListas.finDeCartucho === 'function')
      ? comunListas.finDeCartucho() : null;
    if (finCfg && finCfg.mecanismo) {
      configFin.mecanismo = finCfg.mecanismo;
      configFin.contador = Number(finCfg.contador) || 0;
    }
    segs.forEach(function (seg) {
      if (seg.tipo === tiposEnum.contador) {
        var n = (Number(seg.contadorInterno) || 1) - 1;
        if (n >= 0 && n <= 3) {
          contadoresInternos[n] = Number(seg.valorInicial) || 0;
          inicialesInternos[n] = contadoresInternos[n];
          direccionesInternas[n] = seg.direccion || 'ascendente';
        }
      }
      // Compatibilidad (F3-I11 primera versión): GWI con el fin
      // como segmento tipo 7. Si el puente trae el campo «fin»
      // manda él; el viejo segmento solo sirve de respaldo.
      if (seg.tipo === tiposEnum.cartucho && configFin.mecanismo === null) {
        configFin.mecanismo = seg.finJuego || null;
        configFin.contador = Number(seg.finContador) || 0;
      }
      seg.visible = false;
      seg.cambiar = false;
    });
    // Nacimiento de los ADICIONALES (duodécima iteración): sin
    // siguiente = FIJO encendido (el helicóptero); con siguiente =
    // APAGADO, lo enciende su bucle (el aspa inferior); un
    // inicioAdicional nace ENCENDIDO y avanza en su bucle propio.
    // Ni la congelación ni el barrido los tocan: solo su bucle y
    // la Secuencia.
    segs.forEach(function (seg) {
      if (seg.tipo === tiposEnum.adicional) {
        seg.visible = !seg.siguiente;
      } else if (seg.tipo === tiposEnum.inicioAdicional) {
        seg.visible = true;
      }
      if (seg.visible) seg.cambiar = true;
    });
    // FIN POR ICONOS (F3-I11): con el mecanismo de vida, la familia
    // nace ENTERA encendida y el contador interno 1 arranca en el
    // número de iconos (las vidas iniciales salen de contarlos: no
    // hay que definirlas ni almacenarlas); con muerte, la familia
    // nace apagada y el contador 2 en cero.
    if (configFin.mecanismo === finEnum.vida) {
      contadoresInternos[0] = _familiaIconos(segs, tiposEnum.vida).length;
    }
    _prepararContadores(segs);              // las presentaciones jerárquicas nacen
    _presentaContadores();                  // el valor inicial, en pantalla
    _sincronizarIconos(segs);               // las familias de iconos, en pantalla
    _sincronizarAcompanantes();             // F5-I15 (A2): y sus secundarios, ya al nacer
    contadoresSucios = false;
    var j = jugador === null ? null : segs[jugador];
    if (j) { j.visible = true; j.cambiar = true; }
    if (_debug()) {
      console.log('motor del juego: iniciado, ' + segs.length +
        ' segmento(s) en memoria, contadores [' +
        contadoresInternos.join(', ') + ']' +
        (j ? ', jugador ' + (j.id || '?') + ' encendido' : ''));
    }
  }

  /**
   * Un paso del juego. Tres acciones, en este orden (F5-I15: la
   * LIMPIEZA va antes de la entrada, como el análisis fija — así
   * las banderas que la entrada marca al mover al jugador
   * sobreviven al fin del tick; las lee el repintado selectivo
   * del ESP32):
   * 0) LIMPIEZA: apaga las banderas de cambiado de TODA la lista
   *    (con diagnóstico de cuántas apaga);
   * 1) ENTRADA: vacía la cola de pulsaciones y mueve al jugador;
   * 2) RUTAS: cada elemento de ruta visible AVANZA por su enlace
   *    siguiente o MUERE al final de la cadena (sin colisión);
   *    si no queda ninguna viva, nace una nueva elegida por el
   *    PRNG del director.
   * @returns {void}
   * @since 2.5 (entrada: 3.2, rutas: 3.5; limpieza antes de la
   * entrada: F5-I15)
   */
  function tick() {
    // Partida TERMINADA (F3-I11): congelada — nada avanza (el
    // director detiene el reloj en cuanto lo ve; esto es la doble
    // seguridad si algo más llama al tick).
    if (terminada) return;
    var segs = _lista();
    // Foto PREVIA del contador de fin (F3-I11): la partida termina
    // en la TRANSICIÓN de >0 a 0, no estando en 0 (empezar en cero
    // significa que nunca termina — la verificación lo bloquea).
    var prevFin = -1;
    if (configFin.mecanismo === finEnum.contador && configFin.contador >= 1) {
      prevFin = contadoresInternos[configFin.contador - 1];
    }
    // 0. LIMPIEZA (F5-I15: antes de la entrada): apagar banderas
    //    de cambiado del tick anterior (estado ya presentado). Las
    //    marcas que la entrada dé a continuación SOBREVIVEN al
    //    tick: las lee el repintado selectivo del ESP32.
    var cambiadas = 0;
    segs.forEach(function (seg) {
      if (seg.cambiar) {
        seg.cambiar = false;
        cambiadas++;
      }
    });
    if (_debug()) {
      console.log('motor del juego. Banderas cambiar: ' +
        (cambiadas === 0 ? 'No modificadas' : cambiadas + ' modificadas'));
    }
    // 1. ENTRADA: el buffer de pulsaciones, consumido.
    _aplicarEntrada(segs);
    // 2. RUTAS: foto de los elementos de ruta visibles ANTES de
    //    tocar nada (si un recién encendido avanzara otra vez en
    //    el mismo tick, saltaría doble). Cada uno AVANZA por su
    //    enlace siguiente; si no tiene (el final de la cadena,
    //    sin colisión), MUERE: se apaga y desaparece.
    var vivos = [];
    segs.forEach(function (seg) {
      // El barrido avanza TODAS las cadenas visibles (F3-I8): las
      // de juego (1/2) Y las que atraviesan segmentos de tipo
      // vida/muerte (3/4) — la cadena de un desenlace sigue
      // ENLACE a ENLACE aunque sus segmentos sean la presentación
      // de un contador (los tiburones enlazados: cada uno se
      // enciende, avanza y el último muere al final).
      // EXCEPCIONES (duodécima iteración): los encendidos por la
      // SECUENCIA (marca animados) no los avanza el barrido de
      // RUTAS; y con el juego CONGELADO solo avanza la cadena del
      // desenlace (los eslabones marcados): rutas y jugador
      // esperan a que termine.
      // 23-10 (bug del ciclo de muerte atascado): un eslabón de la
      // cadena de desenlace AVANZA AUNQUE esté encendido por la
      // Secuencia (la cadena lo toma: apaga y sigue) — si no, el
      // ciclo encontraba el segmento ya encendido y no pasaba de
      // él: nunca aterrizaba y no se producían muertes.
      if (seg.visible && _esCadena(seg) &&
        (!animados[seg.id] || marcaDesenlace[seg.id]) &&
        (!congelada || marcaDesenlace[seg.id])) vivos.push(seg);
    });
    // F5-I15 (A3): BARRIDO EN DOS FASES. Fase 1: TODOS los de la
    // foto dejan su casilla a la vez (cada uno se mueve, muere o
    // decide, así que ninguno sigue encendido). Fase 2: cada uno
    // actúa sobre las casillas ya libres. Así el resultado no depende
    // del orden de la lista: dos rutas seguidas en una cadena avanzan
    // las dos, y la que llega a un final donde otra muere sobrevive.
    vivos.forEach(function (seg) {
      seg.visible = false;
      seg.cambiar = true;
    });
    // Dentro de la fase 2 actúan PRIMERO las que deciden (un punto de
    // colisión, o una ruta que llega a uno): si alguna congela el
    // juego, esperan TODAS las demás, estén donde estén en la lista.
    var deciden = [], resto = [];
    vivos.forEach(function (seg) {
      var iDest = seg.siguiente ? _indiceDe(segs, seg.siguiente) : -1;
      var decide = !!seg.colision || (iDest >= 0 && !!segs[iDest].colision);
      (decide ? deciden : resto).push(seg);
    });
    deciden.concat(resto).forEach(function (seg) {
      // F5-I15 (A4c): si una decisión de ESTA pasada congeló el
      // juego, las rutas que quedan por mover esperan (siguen donde
      // estaban): solo avanza la cadena del desenlace.
      if (congelada && !marcaDesenlace[seg.id]) {
        seg.visible = true;
        return;
      }
      // ¿Es un PUNTO DE COLISIÓN? (F3-I8): si declara colision,
      // NO avanza por siguiente — DECIDE, leyendo la bandera del
      // jugador señalado (positiva o negativa, con su contador y
      // su cadena de desenlace). La decisión ocurre el mismo tick
      // en que el punto se enciende: sin un tick de espera.
      if (seg.colision) {
        _decidirColision(segs, seg);
        return;
      }
      var idSiguiente = seg.siguiente;
      if (!idSiguiente) {
        // el final sin colisión: la ruta muere (su casilla ya quedó libre en la fase 1)
        if (_debug()) {
          console.log('motor del juego: ' + (seg.id || '?') +
            ' murió al final de la ruta');
        }
        return;
      }
      var idxSiguiente = -1;
      for (var i = 0; i < segs.length; i++) {
        if (segs[i].id === idSiguiente) { idxSiguiente = i; break; }
      }
      if (idxSiguiente < 0) {
        if (_debug()) {
          console.warn('motor del juego: el enlace siguiente de ' +
            (seg.id || '?') + ' apunta a ' + idSiguiente +
            ', que no existe: la ruta muere.');
        }
        return;
      }
      // ¿El destino es un ICONO de familia? (corrección del
      // 21-10-2026): la cadena ATERRIZA — el icono NO se enciende
      // ni la cadena lo recorre; cuenta el desenlace UNA vez en el
      // contador de su familia y la sincronización enciende el que
      // toque (en muerte, acumulativo desde el último).
      if (_esIconoFamilia(segs[idxSiguiente])) {
        _contarAterrizaje(segs, segs[idxSiguiente]);
        if (_debug()) {
          console.log('motor del juego: ruta aterriza en ' +
            (segs[idxSiguiente].id || '?') +
            ': la familia cuenta el desenlace');
        }
        return;
      }
      // el hueco que se deja ya está libre (fase 1); se ocupa el destino:
      segs[idxSiguiente].visible = true;
      segs[idxSiguiente].cambiar = true;
      // CONGELACIÓN (duodécima iteración): la marca del desenlace
      // se PROPAGA por siguiente — cada eslabón nuevo de la cadena
      // hereda que pertenece al desenlace que congela el juego.
      if (marcaDesenlace[seg.id]) {
        marcaDesenlace[segs[idxSiguiente].id] = true;
      }
      if (_debug()) {
        console.log('motor del juego: ruta avanza, ' +
          (segs[idxSiguiente].id || '?') + ' encendido');
      }
      // ¿El destino es un PUNTO DE COLISIÓN? (F3-I8): la decisión
      // ocurre EL MISMO TICK en que la ruta lo enciende — el
      // elemento llega al punto y la máquina decide ahí, sin un
      // tick de espera (el barrido siguiente no volvería a verlo:
      // el punto ya está decidido y apagado).
      if (segs[idxSiguiente].colision) {
        _decidirColision(segs, segs[idxSiguiente]);
      }
    });
    // 3. ¿Queda alguna ruta viva? Si no, nace una nueva (F3-I5).
    _contarRutasVivas(segs);                 // F5-I15: el contador sale de la pantalla
    _lanzarRuta(segs);
    // 3b. ADICIONALES (duodécima iteración): los elementos fuera
    //     del juego avanzan SIEMPRE en su bucle propio (helicóptero,
    //     aspas): la congelación no los para — solo se para el
    //     juego, no la decoración.
    _avanzarAdicionales(segs);
    // 3c. FIN DEL DESENLACE: muerto el último eslabón marcado, la
    //     bandera de congelación cae; la Secuencia, ya INTERRUMPIDA
    //     al nacer del ciclo de muerte (23-10: apagado y contador a
    //     cero), empieza a contar y se lanza de nuevo.
    if (congelada) {
      var queda = false;
      for (var c4 = 0; c4 < segs.length; c4++) {
        if (segs[c4].visible && marcaDesenlace[segs[c4].id]) {
          queda = true; break;
        }
      }
      if (!queda) {
        congelada = false;
        marcaDesenlace = {};
        desenlaceMuerte = false;
        if (_debug()) {
          console.log('motor del juego: desenlace terminado, juego ' +
            'descongelado');
        }
      }
    }
    // 3d. SECUENCIA (duodécima iteración): la animación periódica
    //     del cartucho — un segmento por tick, relanzada cada n
    //     ticks; interrumpida con cada colisión y mientras dura un
    //     desenlace (contador a cero en ambos casos).
    _avanzarSecuencia(segs);
    // 4. CONTADORES EN PANTALLA (F4-I9): solo si una decisión tocó
    //    algún contador (nada periódico); el refresco enciende y
    //    apaga las barras de los dígitos según su valor.
    if (contadoresSucios) {
      _presentaContadores();
      _sincronizarIconos(segs);   // las familias de iconos, con sus contadores
      contadoresSucios = false;
    }
    // 4b. ACOMPAÑANTES (13.ª iteración; F5-I15: tras los iconos): el pase final — el
    //     secundario copia SIEMPRE el visible de su principal,
    //     salvo cuando la SECUENCIA lo tiene encendido sola (la
    //     Secuencia manda entonces; ver sincronizarAcompanantes).
    _sincronizarAcompanantes();
    // 5. FIN DE PARTIDA (F3-I11): por iconos, con la familia en su
    //    estado final; por contador, en la transición >0→0 del
    //    interno elegido. Al cumplirse, el estado «terminada»
    //    congela el juego y el director detiene el reloj.
    _comprobarFin();
    if (!terminada && prevFin > 0 && configFin.contador >= 1 &&
      contadoresInternos[configFin.contador - 1] === 0) {
      terminada = true;
    }
    if (terminada && _debug()) {
      console.log('motor del juego: partida terminada (mecanismo: ' +
        configFin.mecanismo + ')');
    }
  }

  /**
   * ¿Cuántas RUTAS hay vivas ahora? (Elementos de ruta visibles;
   * con la política encadenada actual es 0 o 1, pero el mecanismo
   * no lo limita). Dato de diagnóstico: la lista es el estado,
   * pero contar las vivas ahorra buscarlas en consola. El motor
   * gráfico no usa esto: presenta todos los visible=true.
   * @returns {number} Elementos de ruta encendidos en este momento.
   * @since 3.5
   */
  function rutasVivas() {
    var n = 0;
    _lista().forEach(function (seg) {
      if (seg.visible && _esDeRuta(seg)) n++;
    });
    return n;
  }

  /**
   * El ÍNDICE del segmento que es el jugador ACTIVO ahora (o
   * null si no hay). Dato de diagnóstico: la lista es el estado,
   * pero ver quién es el jugador ahorra buscarlo en consola.
   * @returns {?number} Índice del jugador activo, o null.
   * @since 3.3
   */
  function jugadorActual() {
    return jugador;
  }

  /**
   * Los CONTADORES INTERNOS actuales (F4-I9): los CUATRO genéricos,
   * en orden (1 a 4). Por compatibilidad con la barra de estado del
   * director (que no se toca en esta iteración), los dos primeros
   * se exponen además como vidas/muertes.
   * @returns {{vidas:number, muertes:number, internos:number[]}} Los contadores.
   * @since 3.6 (genéricos: 3.7)
   */
  function contadores() {
    return {
      vidas: contadoresInternos[0], muertes: contadoresInternos[1],
      internos: contadoresInternos.slice()
    };
  }

  /**
   * PRUEBA DEL GENERADOR (F3-I4): pide 10 números SEGUIDOS al
   * generador del director (juegoDirector.aleatorio) y los
   * devuelve como array (con diagnóstico bajo GW_DEBUG). La llama
   * el juegoDirector en las pruebas de esta iteración: dos
   * pasadas con la semilla reiniciada entre ambas deben dar los
   * MISMOS números (misma semilla = misma secuencia = misma
   * partida). Tras las pruebas el director ya NO la llama (la
   * llamada quedó comentada allí); la función se queda para poder
   * repetir la verificación cuando se toque el generador. No
   * toca el estado del juego: solo lee el servicio del director.
   * @returns {number[]} Los 10 números pedidos (0..99).
   * @since 3.4
   */
  function pruebaAleatorios() {
    var numeros = [], i;
    for (i = 0; i < 10; i++) {
      numeros.push(juegoDirector.aleatorio(100));
    }
    if (_debug()) {
      console.log('motor del juego: prueba de aleatorios → ' +
        numeros.join(', '));
    }
    return numeros;
  }


  /**
   * DIAGNÓSTICO de la SECUENCIA (23-10): estado actual del
   * mecanismo de animación del cartucho, para la barra de estado
   * del director. «contador» son los ticks desde el último
   * lanzamiento/fin (lanza al llegar a «ticks»); «animando» e
   * «idActual» dicen si hay un segmento encendido AHORA y cuál;
   * «suspendida» es el ciclo de muerte (23-10). Sin cartucho
   * configurado, configurada=false y el resto a cero.
   * @returns {{configurada:boolean, ticks:number, contador:number, animando:boolean, idActual:?string, suspendida:boolean}}
   * @since 3.12
   */
  function secuenciaInfo() {
    var hay = !!(configSec && configSec.segmentos &&
      configSec.segmentos.length > 0);
    return {
      configurada: hay,
      ticks: hay ? Math.max(1, Number(configSec.ticks) || 1) : 0,
      contador: secContador,
      animando: hay && secIdx >= 0,
      idActual: (hay && secIdx >= 0) ? configSec.segmentos[secIdx] : null,
      suspendida: desenlaceMuerte
    };
  }

  /**
   * El ESTADO DE LAS RUTAS (F4-I2): cuántas hay VIVAS ahora y el
   * máximo de simultáneas que autoriza el Director. Dato de
   * diagnóstico para las pruebas de la política de lanzamiento
   * (la otra rutasVivas cuenta ELEMENTOS, no rutas).
   * @returns {{vivas:number, maxSimultaneas:number}} El estado.
   * @since 4.2
   */
  function estadoRutas() {
    var maxSim = (typeof juegoDirector !== 'undefined' &&
      typeof juegoDirector.maxRutasSimultaneas === 'function')
      ? juegoDirector.maxRutasSimultaneas() : 1;
    return { vivas: nRutasVivas, maxSimultaneas: maxSim };
  }
  return {
    iniciar: iniciar, tick: tick,
    jugadorActual: jugadorActual, 
    rutasVivas: rutasVivas,
    contadores: contadores,
    terminada: function () { return terminada; },
    congelada: function () { return congelada; },
    pruebaAleatorios: pruebaAleatorios,
    secuenciaInfo: secuenciaInfo,
    estadoRutas: estadoRutas,
    MOVER: MOVER
  };
})();