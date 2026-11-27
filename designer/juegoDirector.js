// ====================================================================================================
// juegoDirector.js — el reloj del simulador (Fase 2/3/4/5)
// ====================================================================================================
// Objeto global: juegoDirector
// F3-I4: añade el GENERADOR DE ALEATORIOS (LCG de 16 bits).
//   - La semilla es del director: misma semilla = misma partida.
//   - El motor de estados queda puro y determinista; pedirá
//     los números al director ("dame un número de ruta").
// F5-I14: fijarSemilla(valor) cambia la semilla (pruebas con varias partidas).
// F3-I8: la barra de estado presenta, con GW_DEBUG activo, los
//   contadores internos de la partida tras el contador de ticks
//   ("Tick N · Vidas: V · Muertes: M", del juegoMotorEstados).
// F5-I10: PAUSA y STOP del emulador y TIPO de arranque (0, 1, 2
//   según el botón A, B o R). El reloj NUNCA se corta: el tick se
//   programa siempre y, con Pausa activa, solo se salta el trabajo;
//   así el navegador atiende el teclado entre tick y tick y el Stop
//   funciona también estando en pausa.
// ====================================================================================================

var juegoDirector = (function () {
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

  // F5-I10: PAUSA y STOP del emulador (nada de esto existe en la
  // máquina real). Son booleanos del módulo, false por defecto.
  //   Pausa:     la alterna SetPausa (botón A en partida). Con ella
  //              activa el tick no llama a los motores ni cuenta.
  //   Finalizar: la activa SetStop (botón B en partida); el tick
  //              siguiente llama a la función de fin y sale.
  var Pausa = false;
  var Finalizar = false;

  // F5-I10: TIPO de arranque (0, 1 o 2 según el botón A, B o R).
  // De momento los tres tipos hacen lo mismo; queda guardado para
  // la futura diferencia Game A / Game B.
  var tipoPartida = 0;

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

  function _reiniciarAleatorios() { estadoLCG = SEMILLA; }

  /**
   * Cambia la semilla del generador de aleatorios (F5-I14, para probar la
   * equivalencia GWI/GWC con varias partidas distintas). Surte efecto en
   * el siguiente arranque.
   * @param {number} valor - Semilla de 16 bits.
   */
  function _fijarSemilla(valor) { SEMILLA = valor & 0xFFFF; }

  function aleatorio(max) {
    // x = (a·x + c) mod 2^16 — el AND 0xFFFF ES el módulo del uint16
    // (en el ESP32 el desbordamiento del uint16_t lo hace solo)
    estadoLCG = (estadoLCG * LCG_A + LCG_C) & 0xFFFF;
    // Se usan los bits ALTOS: con a y c impares el bit 0 alterna 0,1,0,1 y
    // «% 2» daría siempre la misma secuencia (REVISION #3). Vale para max <= 256.
    return (estadoLCG >>> 8) % max;
  }

  // --- Reloj ---

  /**
   * ACELERACIÓN (F4-I2): cada «cada» ticks de PARTIDA la pausa
   * vigente baja «resta» ms, sin bajar de «minimo» ni subir JAMÁS
   * de la base (un mínimo mal puesto no acelera al revés). Cuenta
   * ticks de partida, no de reloj: el motor es determinista, la
   * misma semilla atraviesa los mismos estados.
   * @returns {void}
   */
  function _acelerar() {
    var acc = (typeof comunListas !== 'undefined' &&
      typeof comunListas.aceleracionDeCartucho === 'function')
      ? comunListas.aceleracionDeCartucho() : null;
    if (acc && ticks > 0 && ticks % (Number(acc.cada) || 0) === 0) {
      var nuevaP = Math.max(Number(acc.minimo) || 0,
        pausaVig - (Number(acc.resta) || 0));
      pausaVig = Math.min(pausaBase, nuevaP);
    }
  }

  /**
   * Barra de estado de la partida (F3-I8): con el modo debug activo
   * presenta vidas, muertes, diagnóstico de la Secuencia y pausa
   * vigente tras el contador de ticks; con él apagado, solo el tick
   * (los contadores internos siguen su curso igual).
   * @returns {void}
   */
  function _avisarTick() {
    if (typeof baseDirector === 'undefined') return;
    if (typeof GW_DEBUG !== 'undefined' && GW_DEBUG &&
      typeof juegoMotorEstados.contadores === 'function') {
      var c = juegoMotorEstados.contadores();
      // Secuencia (23-10): diagnóstico del lanzamiento de las
      // animaciones junto al contador de ticks — «Sec: n/m» son
      // los ticks que faltan para lanzar; si ya corre, el id del
      // segmento encendido; sin cartucho, se ve también.
      var sec = '';
      if (typeof juegoMotorEstados.secuenciaInfo === 'function') {
        var si = juegoMotorEstados.secuenciaInfo();
        sec = si.configurada
          ? (si.animando
            ? ' · Sec: ' + si.idActual + ' (' +
            (si.suspendida ? 'suspendida' : 'animando') + ')'
            : ' · Sec: ' + si.contador + '/' + si.ticks)
          : ' · Sec: sin cartucho';
      }
      baseDirector.avisar('Tick ' + ticks + ' · Vidas: ' + c.vidas +
        ' · Muertes: ' + c.muertes + sec +
        ' · Pausa: ' + pausaVig + ' ms');
    } else {
      baseDirector.avisar('Tick ' + ticks);
    }
  }

  /**
   * El tick (F5-I10). Hace exactamente esto, ni más ni menos:
   *   1. Finalizar activo (Stop) → función de fin y sale del bucle.
   *      Va PRIMERO y no depende de la pausa: Stop funciona en pausa.
   *   2. Pausa inactiva → motor de estados, motor gráfico y cuenta
   *      de ticks. Si el motor marca la partida como terminada
   *      (F3-I11) → función de fin y sale del bucle.
   *   3. Programa el siguiente tick. SIEMPRE (también en pausa): el
   *      reloj no se corta, el navegador atiende el teclado entre
   *      tick y tick.
   * @returns {void}
   */
  function _tick() {
    if (Finalizar) {
      _finJuego();
      return;                    // sin programar el siguiente tick
    }
    if (!Pausa) {
      try {
        juegoMotorEstados.tick();  // (motor de juego: estados)
        juegoMotorGrafico.tick();  // (motor gráfico: presentación)
        if (juegoMotorEstados.terminada()) {
          _finJuego();
          return;                  // sin programar el siguiente tick
        }
        ticks++;
        _acelerar();
        _avisarTick();
      } catch (e) {
        // Una excepción en un motor no deja un reloj muerto que dice
        // seguir en marcha (REVISION #15): se termina la partida y se avisa.
        console.error(e);
        _finJuego();
        baseDirector.avisarError('La partida se detuvo por un error: ' + e.message);
        return;
      }
    }
    _programar();
  }

  function _programar() {
    temporizador = setTimeout(_tick, pausaVig); // encadenado, nunca setInterval; F4-I2: la VIGENTE
  }

  function _detener() {
    if (temporizador !== null) clearTimeout(temporizador);
    temporizador = null;
  }

  function _enMarcha() { return temporizador !== null; }

  /**
   * FUNCIÓN DE FIN DEL JUEGO (F5-I10): la ÚNICA salida de una
   * partida, tanto si el motor la da por terminada (F3-I11) como si
   * se pulsó Stop. Detiene el reloj (la pantalla queda congelada
   * tal cual, como en las máquinas reales), deja Pausa y Finalizar
   * a false y avisa al baseDirector, que devuelve pestañas y botones
   * de carga y presenta el aviso según el motivo. La nueva partida
   * es el arranque de siempre: reinicia semilla, cola, contadores e
   * iniciar().
   * @returns {void}
   */
  function _finJuego() {
    var motivo = Finalizar ? 'stop' : 'fin';
    _detener();
    Pausa = false;
    Finalizar = false;
    baseDirector.finDePartida(motivo);   // F5-I7: vuelven pestañas y botones de carga
  }

  /**
   * SetPausa (F5-I10): Pausa = NOT Pausa. Solo cambia la variable: el
   * tick en curso termina entero y los siguientes se limitan a
   * reprogramarse hasta reanudar (la partida continúa donde estaba).
   * Sin partida en marcha no hace nada.
   * @returns {void}
   */
  function _setPausa() {
    if (!_enMarcha()) return;
    Pausa = !Pausa;
  }

  /**
   * SetStop (F5-I10): Finalizar = true (se ASIGNA, no se alterna: un
   * Stop no se deshace con una segunda pulsación). El siguiente tick
   * llama a la función de fin. Sin partida en marcha no hace nada.
   * @returns {void}
   */
  function _setStop() {
    if (!_enMarcha()) return;
    Finalizar = true;
  }

  /**
   * Estado de la pausa del emulador (F5-I10): lo consulta
   * etiquetarSistema del baseDirector para la etiqueta del A.
   * @returns {boolean} true si la partida está pausada.
   */
  function _estaPausada() {
    return Pausa;
  }

  // --- Arranque de la partida ---

  /**
   * Arranca la partida (F5-I10: con el TIPO según el botón pulsado).
   * @param {number} [tipo=0] - 0, 1 o 2 (botón A, B o R). De momento
   *        los tres hacen lo mismo.
   * @returns {void}
   */
  function _arrancar(tipo) {
    _detener(); // nunca dos relojes

    // Guarda: sin motores, error visible y no arranca
    if (typeof juegoMotorEstados === 'undefined' || typeof juegoMotorGrafico === 'undefined') {
      baseDirector.avisarError('No se puede arrancar: faltan juegoMotorEstados.js y/o juegoMotorGrafico.js');
      return;
    }

    tipoPartida = Number(tipo) || 0;
    ticks = 0;
    Pausa = false;       // F5-I10: una partida nueva nunca nace pausada
    Finalizar = false;   // ni con el Stop pendiente
    // F4-I2: pausas del CARTUCHO (pausas.simulador; 500 ms si el
    // GWI no lo declara: el comportamiento histórico) y contado-
    // res de la política de rutas — partida nueva, todo a cero.
    var cfgP = (typeof comunListas !== 'undefined' &&
      typeof comunListas.pausasDeCartucho === 'function')
      ? comunListas.pausasDeCartucho() : null;
    pausaBase = (cfgP && Number(cfgP.simulador) > 0)
      ? Number(cfgP.simulador) : 500;
    pausaVig = pausaBase;
    rutasLanzadas = 0;
    maxSimultaneas = 1;
    _reiniciarAleatorios();                     // la partida arranca con la semilla
    comunListas.colaPulsaciones().length = 0;  // cola de pulsaciones limpia

    baseDirector.jugar();                     // modo juego (solo el Simulador)
    juegoMotorEstados.iniciar();              // estado inicial del juego
    juegoMotorGrafico.inicializar();          // fondo fijo en pantalla
    _tick(); // tick inmediato y de ahí el bucle encadenado
  }

  // --- Aduana de entrada (F3-I2) ---

  function _pulsar(numero) {
    if (!_enMarcha()) return; // sin partida, la pulsación no existe
    // F5-I10: en pausa o con Stop pendiente la pulsación tampoco
    // existe (si no, la cola de 8 se llenaría y se procesaría de
    // golpe al reanudar).
    if (Pausa || Finalizar) return;
    if (typeof comunListas === 'undefined' || !comunListas.encolar) return;
    if (!comunListas.encolar(String(numero))) {
      // tapa llena: avisa la aduana (el puente solo guarda datos, no habla)
      if (typeof GW_DEBUG !== 'undefined' && GW_DEBUG)
        console.warn('juegoDirector: cola de pulsaciones llena (8); pulsación del botón ' + numero + ' descartada.');
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
  function _rutaLanzada() {
    rutasLanzadas++;
    var cfgR = (typeof comunListas !== 'undefined' &&
      typeof comunListas.rutasDeCartucho === 'function')
      ? comunListas.rutasDeCartucho() : null;
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
  function _maxRutasSimultaneas() {
    return maxSimultaneas;
  }

  /**
   * La PAUSA VIGENTE (ms): la del arranque o la reducida por la
   * aceleración. Dato de diagnóstico para las pruebas.
   * @returns {number} Pausa vigente en milisegundos.
   * @since 4.2
   */
  function _pausaVigente() {
    return pausaVig;
  }

  /**
   * El TIPO con el que se arrancó la partida en curso (F5-I10):
   * 0, 1 o 2 según el botón A, B o R.
   * @returns {number} Tipo de la partida.
   */
  function _tipoDePartida() {
    return tipoPartida;
  }

  // API pública
  return {
    arrancar: _arrancar,                       // F5-I10: arrancar(tipo)
    detener: _detener,
    pulsar: _pulsar,
    enMarcha: _enMarcha,
    setPausa: _setPausa,                       // F5-I10: Pausa = NOT Pausa
    setStop: _setStop,                         // F5-I10: Finalizar = true
    estaPausada: _estaPausada,                 // F5-I10
    tipoDePartida: _tipoDePartida,             // F5-I10
    aleatorio: aleatorio,                     // F3-I4: la única puerta del generador
    fijarSemilla: _fijarSemilla,               // F5-I14: semilla de la partida (pruebas)
    rutaLanzada: _rutaLanzada,                 // F4-I2
    maxRutasSimultaneas: _maxRutasSimultaneas, // F4-I2
    pausaVigente: _pausaVigente                // F4-I2
  };
})();
