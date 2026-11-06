// ============================================================
// JuegoDirector.js — el reloj del simulador (Fase 2/3/4)
// Objeto global: JuegoDirector
// F3-I4: añade el GENERADOR DE ALEATORIOS (LCG de 16 bits).
//   - La semilla es del director: misma semilla = misma partida.
//   - El motor de estados queda puro y determinista; pedirá
//     los números al director ("dame un número de ruta").
// F3-I8: la barra de estado presenta, con GW_DEBUG activo, los
//   contadores internos de la partida tras el contador de ticks
//   ("Tick N · Vidas: V · Muertes: M", del JuegoMotorEstados).
// ============================================================

var JuegoDirector = (function () {
  'use strict';

  // F4-I2: la pausa YA NO es constante — la lee el Director del
  // puente al ARRANCAR (pausas.simulador del cartucho; 500 ms si
  // el GWI no lo declara: el comportamiento histórico). La pausa
  // VIGENTE puede bajar durante la partida con la aceleración
  // (cada «cada» ticks − «resta» ms, sin bajar de «minimo»);
  // el ESP32 leerá pausas.externo con el mismo mecanismo.
  var pausaBase = 500;    // la del arranque (pausas.simulador)
  var pausaVig = 500;     // la que se aplica AHORA (acelera)
  var temporizador = null; // un solo reloj, siempre
  var ticks = 0;

  // F4-I2: política de RUTAS del Director. El TOTAL de rutas
  // lanzadas sube con cada lanzamiento y NUNCA baja (es la
  // progresión de la partida); el MÁXIMO de simultáneas nace en 1
  // y sube cada vez que el total alcanza un múltiplo de
  // rutas.aumentarCada. Las VIVAS las cuenta el motor de estados
  // (es el dueño de la pantalla); el máximo lo consulta al decidir
  // si lanza una nueva.
  var rutasLanzadas = 0;  // total lanzadas en esta partida
  var maxSimultaneas = 1; // máximo de rutas a la vez autorizado

  // --- Generador de aleatorios (F3-I4): LCG de 16 bits ---
  var SEMILLA = 0x1A2B;               // constante editable: misma semilla = misma partida
  var LCG_A = 25173, LCG_C = 13849;   // constantes clásicas de 16 bits
  var estadoLCG = SEMILLA;

  function reiniciarAleatorios() { estadoLCG = SEMILLA; }

  function aleatorio(max) {
    // x = (a·x + c) mod 2^16 — el AND 0xFFFF ES el módulo del uint16
    // (en el ESP32 el desbordamiento del uint16_t lo hace solo)
    estadoLCG = (estadoLCG * LCG_A + LCG_C) & 0xFFFF;
    return estadoLCG % max;
  }

  // --- Reloj ---

  function tick() {
    JuegoMotorEstados.tick();   // (motor de juego: estados)
    JuegoMotorGrafico.tick();    // (motor gráfico: presentación)
    // FIN DE PARTIDA (F3-I11): el motor marca «terminada» cuando el
    // mecanismo del cartucho se cumple; el reloj se DETIENE aquí
    // (la pantalla queda congelada tal cual, como en las máquinas
    // reales) y el aviso pide el Start — que ya reinicia semilla,
    // cola, contadores e iniciar(): la nueva partida es el arranque
    // de siempre, sin piezas nuevas.
    if (typeof JuegoMotorEstados.terminada === 'function' &&
        JuegoMotorEstados.terminada()) {
      detener();
      BaseDirector.finDePartida();   // F5-I7: vuelven pestañas y botones de carga
      BaseDirector.avisar('Partida terminada — pulsa Start para jugar de nuevo.');
      return;                    // sin programar el siguiente tick
    }
    ticks++;
    // F4-I2 ACELERACIÓN: cada «cada» ticks de PARTIDA la pausa
    // vigente baja «resta» ms, sin bajar de «minimo» ni subir
    // JAMÁS de la base (un mínimo mal puesto no acelera al revés).
    // Cuenta ticks de partida, no de reloj: el motor es
    // determinista, la misma semilla atraviesa los mismos estados.
    var acc = (typeof ComunListas !== 'undefined' &&
               typeof ComunListas.aceleracionDeCartucho === 'function')
      ? ComunListas.aceleracionDeCartucho() : null;
    if (acc && ticks > 0 && ticks % (Number(acc.cada) || 0) === 0) {
      var nuevaP = Math.max(Number(acc.minimo) || 0,
                            pausaVig - (Number(acc.resta) || 0));
      pausaVig = Math.min(pausaBase, nuevaP);
    }
    // Contadores de la partida (F3-I8): con el modo debug activo,
    // la barra presenta vidas y muertes tras el contador de ticks;
    // con él apagado, solo el tick (los contadores internos
    // siguen su curso igual). Su presentación EN PANTALLA llegará
    // con el fin de partida.
    if (typeof BaseDirector !== 'undefined') {
      if (typeof GW_DEBUG !== 'undefined' && GW_DEBUG &&
          typeof JuegoMotorEstados.contadores === 'function') {
        var c = JuegoMotorEstados.contadores();
        // Secuencia (23-10): diagnóstico del lanzamiento de las
        // animaciones junto al contador de ticks — «Sec: n/m» son
        // los ticks que faltan para lanzar; si ya corre, el id del
        // segmento encendido; sin cartucho, se ve también.
        var sec = '';
        if (typeof JuegoMotorEstados.secuenciaInfo === 'function') {
          var si = JuegoMotorEstados.secuenciaInfo();
          sec = si.configurada
            ? (si.animando
                ? ' · Sec: ' + si.idActual + ' (' +
                  (si.suspendida ? 'suspendida' : 'animando') + ')'
                : ' · Sec: ' + si.contador + '/' + si.ticks)
            : ' · Sec: sin cartucho';
        }
        BaseDirector.avisar('Tick ' + ticks + ' · Vidas: ' + c.vidas +
                            ' · Muertes: ' + c.muertes + sec +
                            ' · Pausa: ' + pausaVig + ' ms');
      } else {
        BaseDirector.avisar('Tick ' + ticks);
      }
    }
    programar();
  }

  function programar() {
    temporizador = setTimeout(tick, pausaVig); // encadenado, nunca setInterval; F4-I2: la VIGENTE
  }

  function detener() {
    if (temporizador !== null) clearTimeout(temporizador);
    temporizador = null;
  }

  function enMarcha() { return temporizador !== null; }

  // --- Arranque de la partida ---

  function arrancar() {
    detener(); // nunca dos relojes

    // Guarda: sin motores, error visible y no arranca
    if (typeof JuegoMotorEstados === 'undefined' || typeof JuegoMotorGrafico === 'undefined') {
      BaseDirector.avisarError('No se puede arrancar: faltan JuegoMotorEstados.js y/o JuegoMotorGrafico.js');
      return;
    }

    ticks = 0;
    // F4-I2: pausas del CARTUCHO (pausas.simulador; 500 ms si el
    // GWI no lo declara: el comportamiento histórico) y contado-
    // res de la política de rutas — partida nueva, todo a cero.
    var cfgP = (typeof ComunListas !== 'undefined' &&
                typeof ComunListas.pausasDeCartucho === 'function')
      ? ComunListas.pausasDeCartucho() : null;
    pausaBase = (cfgP && Number(cfgP.simulador) > 0)
      ? Number(cfgP.simulador) : 500;
    pausaVig = pausaBase;
    rutasLanzadas = 0;
    maxSimultaneas = 1;
    reiniciarAleatorios();                     // la partida arranca con la semilla
    ComunListas.colaPulsaciones().length = 0;  // cola de pulsaciones limpia

    BaseDirector.jugar();                     // modo juego (solo el Simulador)
    JuegoMotorEstados.iniciar();              // estado inicial del juego
    JuegoMotorGrafico.inicializar();          // fondo fijo en pantalla

    // --- PRUEBA DEL GENERADOR (F3-I4; verificada en simulación con
    //     los ficheros reales: ambas pasadas idénticas, más las
    //     regresiones de pulsaciones y secuencia). 
//     //     SOLO PARA LAS PRUEBAS, comentar luego
//     var pruebaA = JuegoMotorEstados.pruebaAleatorios();
//     reiniciarAleatorios();                     // "vuelve a inicializar"
//     var pruebaB = JuegoMotorEstados.pruebaAleatorios();
//     var iguales = pruebaA.length === pruebaB.length &&
//       pruebaA.every(function (v, i) { return v === pruebaB[i]; });
//     if (typeof GW_DEBUG !== 'undefined' && GW_DEBUG) {
//       console.info('A1: ' + pruebaA.join(', '));
//       console.info('A2: ' + pruebaB.join(', '));
//       console.info('JuegoDirector: prueba de aleatorios ' + (iguales ? 'OK' : 'FALLO'));
//     }

    tick(); // tick inmediato y de ahí el bucle encadenado
  }

  // --- Aduana de entrada (F3-I2) ---

  function pulsar(numero) {
    if (!enMarcha()) return; // sin partida, la pulsación no existe
    if (typeof ComunListas === 'undefined' || !ComunListas.encolar) return;
    if (!ComunListas.encolar(String(numero))) {
      // tapa llena: avisa la aduana (el puente solo guarda datos, no habla)
      if (typeof GW_DEBUG !== 'undefined' && GW_DEBUG)
        console.warn('JuegoDirector: cola de pulsaciones llena (8); pulsación del botón ' + numero + ' descartada.');
    }
  }

  // --- Política de rutas (F4-I2) ---

  /**
   * Registra el LANZAMIENTO de una ruta: el total sube (nunca
   * baja) y, si acaba de alcanzar un múltiplo de
   * rutas.aumentarCada, el máximo de simultáneas sube en 1. Lo
   * llama el motor de estados al encender el inicio de la ruta.
   * @returns {number} El máximo de simultáneas vigente.
   * @since 4.2
   */
  function rutaLanzada() {
    rutasLanzadas++;
    var cfgR = (typeof ComunListas !== 'undefined' &&
                typeof ComunListas.rutasDeCartucho === 'function')
      ? ComunListas.rutasDeCartucho() : null;
    var cada = cfgR ? (Number(cfgR.aumentarCada) || 0) : 0;
    if (cada > 0 && rutasLanzadas % cada === 0) maxSimultaneas++;
    return maxSimultaneas;
  }

  /**
   * El MÁXIMO de rutas simultáneas vigente (nace en 1). El tope
   * real —las rutas definidas en el cartucho— lo aplica el motor
   * al elegir candidatos (solo hay tantas rutas como inicios).
   * @returns {number} Máximo de rutas simultáneas.
   * @since 4.2
   */
  function maxRutasSimultaneas() {
    return maxSimultaneas;
  }

  /**
   * La PAUSA VIGENTE (ms): la del arranque o la reducida por la
   * aceleración. Dato de diagnóstico para las pruebas.
   * @returns {number} Pausa vigente en milisegundos.
   * @since 4.2
   */
  function pausaVigente() {
    return pausaVig;
  }

  // API pública
  return {
    arrancar: arrancar,
    detener: detener,
    pulsar: pulsar,
    enMarcha: enMarcha,
    aleatorio: aleatorio,   // F3-I4: la única puerta del generador
    rutaLanzada: rutaLanzada,           // F4-I2
    maxRutasSimultaneas: maxRutasSimultaneas, // F4-I2
    pausaVigente: pausaVigente          // F4-I2
  };
})();