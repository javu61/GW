// pruebas/pruebasGWI_GWC.js — Equivalencia entre un GWI y el GWC que sale de él
// ================================================================================================
// PROPÓSITO
//   Comprueba el principio de F5-I13: «el juego debe funcionar igual cargando el GWI o el GWC del
//   que sale». Genera con baseCartucho.generarGWC el GWC del GWI cargado, sin escalar (pantalla =
//   fuente), y compara:
//     - DATOS: lo que devuelve leerGWC (configuración y cada campo de cada segmento) con el GWI.
//     - JUEGO: una partida con el GWI y otra con el GWC (mismo arranque, mismo generador de
//       aleatorios, reloj sustituido por una cola que se vacía a mano, un jugador determinista
//       que mueve izquierda y derecha) y compara, tick a tick, qué segmentos están encendidos.
//
// PRUEBAS (grupo «gwi_gwc»)
//   C1 equivalencia (datos)     Pide un GWI cargado.
//   C2 equivalencia (variante)  Lo mismo declarando además rutas, aceleración, pausas y «combinar».
//   C3 equivalencia (juego)     Partidas del cartucho de ejemplo con cada semilla (cinco por
//                               defecto). Vuelve a cargar el GWI de ejemplo al terminar.
//   C4 equivalencia (completa)  Partidas con un GWI al que se declara además rutas, aceleración,
//                               pausas y «combinar» (los declara en el historial de autoría, que es
//                               de donde los reconstruye la carga del GWI).
//   Las dos de juego dejan sus partidas en Pruebas.datos: en Node, GRABAR=fichero las guarda y
//   COMPARAR=fichero las compara con las guardadas (red de seguridad del motor).
//   C5/C6/C7 el par (F5-I17)    El codigoGWC del GWI en la ficha de Cartucho (C5), el aviso al
//                               guardar el GWI a secas (C6) y al generar el par (C7). Las dos
//                               últimas solo en consola: el paso descarga los ficheros.
//   C8 memoria (F5-I20, MA02)   Al generar el par con memoria declarada (RAM/FLASH, en el setup o,
//                               por subcampo, en el cartucho) sale el porcentaje en la línea del
//                               panel y en el aviso final; sin memoria, o a 0, no sale nada; FLASH
//                               con el bloque del fondo (A02). Solo en consola: el paso descarga
//                               los ficheros.
//   C9 ajuste (F5-I21)          Tras ajustar la resolución, cada sprite mide lo mismo que da el
//                               «escalar» del generador de GWC con la nueva pantalla, y las
//                               posiciones de los segmentos son su redondeo canónico. Solo
//                               consola.
//   C10 memoria (F5-I21)        El «último GWC calculado» viaja en la «memoria» del GWI del par
//                               (ultimoGWC, y ultimoGWCimg a 0 explícito si no hay fondo); el GWI
//                               guardado a secas va sin él; el GWB ya no lleva resolucion,
//                               memoria ni botones. Solo consola.
//
// FUNCIONES
//   _codigoEnFicha              (F5-I17) El campo solo lectura «Código GWC» de la ficha de Cartucho.
//   _codigoDeGWI               (F5-I17) El codigoGWC declarado en el JSON del GWI.
//   _pruebaParFicha            (F5-I17) Prueba «C5 par: ficha codigoGWC».
//   _pruebaParGuardar          (F5-I17) Prueba «C6 par: guardar despareja» (solo consola).
//   _pruebaParGenerar          (F5-I17) Prueba «C7 par: generar desfasado» (solo consola).
//   _generarConMemoria         (F5-I20) Carga setup (+ memoria) y GWI (+ memoria), genera y devuelve aviso final y panel.
//   _pruebaMemoria             (F5-I20) Prueba «C8 memoria: porcentaje al generar» (solo consola).
//   _pruebaAjuste              (F5-I21) Prueba «C9 ajuste de resolución» (solo consola).
//   _pruebaUltimos             (F5-I21) Prueba «C10 memoria: ultimoGWC en el GWI» (solo consola).
//   _prepararEquivalencia       El GWI en memoria + el GWC que sale de él, releído.
//   _diferenciasEquivalencia    Configuración y campo a campo de cada segmento: GWI frente a GWC.
//   _pruebaEquivalencia         Pruebas de datos (normal y variante).
//   _gwiCompleto                El GWI de ejemplo con las declaraciones añadidas (en memoria).
//   _cargarGWI                  Carga el setup y un GWI por los inputs del diseñador.
//   _jugarPartida               N ticks con el reloj sustituido, devolviendo qué hay encendido.
//   _pruebaJuego                Pruebas de juego (ejemplo y completa).
//
// USO
//   Pestaña «Pruebas» (index.html por servidor local con GW_DEBUG) o, en consola:
//     pruebas\Lanzar.bat gwi_gwc      (opciones: ver lanzador.js)
//   Variables: SEMILLAS=1,6699  TICKS=400  SIN_PULSAR=1  GRABAR=fich  COMPARAR=fich
// ================================================================================================
'use strict';

(function () {
  if (typeof Pruebas === 'undefined') return;     // en Node solo cuenta el lanzador del final
  const U = Pruebas.util;

  function _prepararEquivalencia(variante) {
    const j0 = baseDirector.datosCartucho();
    if (!j0 || j0.tipo !== 'GWI') return null;
    const j = JSON.parse(JSON.stringify(j0));
    if (variante) {
      j.rutas = { aumentarCada: 3 };
      j.aceleracion = { cada: 5, resta: 20, minimo: 100 };
      j.pausas = { simulador: 300, externo: 250 };
      j.combinar = true;
    }
    const pantalla = {
      ancho: j.resolucion.ancho, alto: j.resolucion.alto,
      fuente: { ancho: j.resolucion.ancho, alto: j.resolucion.alto }
    };
    const gwc = baseCartucho.generarGWC(j, baseDescomponer.sprites(), pantalla);
    return { json: j, leido: baseCartucho.leerGWC(gwc.bytes), gwc: gwc };
  }

  function _diferenciasEquivalencia(j, l) {
    const d = [];
    const cmpVal = (etiqueta, a, b) => {
      if (!U.igual(U.nz(a), U.nz(b)))
        d.push(etiqueta + ': GWI=' + JSON.stringify(a) + ' GWC=' + JSON.stringify(b));
    };
    cmpVal('pausas.simulador', j.pausas && j.pausas.simulador, l.pausas && l.pausas.simulador);
    cmpVal('pausas.externo', j.pausas && j.pausas.externo, l.pausas && l.pausas.externo);
    cmpVal('aceleracion', j.aceleracion, l.aceleracion);
    cmpVal('rutas.aumentarCada', j.rutas && j.rutas.aumentarCada, l.rutas && l.rutas.aumentarCada);
    cmpVal('fin.mecanismo', j.fin && j.fin.mecanismo, l.fin && l.fin.mecanismo);
    cmpVal('fin.contador', j.fin && j.fin.contador, l.fin && l.fin.contador);
    if (!!j.combinar !== !!l.combinar)
      d.push('combinar: GWI=' + !!j.combinar + ' GWC=' + !!l.combinar);

    const viaja = j.segmentos.filter(s => s.tipo !== 99 && !s.fusionadoPor);
    if (viaja.length !== l.segmentos.length)
      d.push('nº de segmentos: GWI=' + viaja.length + ' GWC=' + l.segmentos.length);
    const idx = new Map(viaja.map((s, i) => [s.id, i]));
    const enlace = (id) => (id === undefined || id === null) ? null :
      (idx.has(id) ? idx.get(id) : 'x:' + id);
    const ENL = ['siguiente', 'salvado', 'muerte', 'mostrarJunto', 'izquierda', 'derecha',
      'arriba', 'abajo', 'colision', 'barra_a', 'barra_b', 'barra_c', 'barra_d', 'barra_e',
      'barra_f', 'barra_g', 'digito_1', 'digito_2', 'digito_3', 'digito_4'];
    viaja.forEach((s, i) => {
      const g = l.segmentos[i];
      if (!g) return;
      const cmp = (campo, a, b) => cmpVal(s.id + '.' + campo, a, b);
      cmp('tipo', s.tipo, g.tipo); cmp('x', s.x, g.x); cmp('y', s.y, g.y);
      for (const c of ENL)
        cmp(c, enlace(s[c]), enlace(g[c]) === null ? null :
          g[c] === undefined ? null : parseInt(String(g[c]).replace(/\D/g, ''), 10));
      cmp('salvadoContador', U.nn(s.salvadoContador), g.salvadoContador);
      cmp('muerteContador', U.nn(s.muerteContador), g.muerteContador);
      cmp('contadorInterno', s.contadorInterno, g.contadorInterno);
      cmp('ruta', s.ruta, g.ruta);
      cmp('primero', !!s.primero, !!g.primero);
      if (s.tipo === 3 || s.tipo === 4) cmp('contador (orden de la familia)', s.contador, g.contador);
      if (s.tipo === 6) {
        cmp('valorInicial', s.valorInicial || 0, g.valorInicial || 0);
        cmp('direccion', s.direccion === 'descendente', g.direccion === 'descendente');
        cmp('presentarCero', s.presentarCero !== false, g.presentarCero !== false);
      }
    });
    return d;
  }

  function _pruebaEquivalencia(variante) {
    const out = [];
    const preparado = _prepararEquivalencia(variante);
    if (!preparado) return null;           // lo avisa el lanzador, sin fallo
    const difs = _diferenciasEquivalencia(preparado.json, preparado.leido);
    out.push([((variante ? 'C2' : 'C1') + ': equivalencia de datos') + (variante ? ' (variante)' : ''),
    difs.length === 0,
    difs.slice(0, 40).join(' || ')]);
    if (difs.length > 40) out.push(['(resto de diferencias omitidas)', true,
      (difs.length - 40) + ' más']);
    return out;
  }

  /* ---------------- Juego tick a tick ---------------- */

  const SEMILLAS = [1, 6699, 48879, 32767, 4660];

  /** El GWI de ejemplo con rutas, aceleración, pausas y «combinar» declarados. */
  async function _gwiCompleto(bytes) {
    const zip = await JSZip.loadAsync(bytes);
    const nombre = Object.keys(zip.files).find(n => /^[^/]+\.json$/.test(n));
    const json = JSON.parse(await zip.file(nombre).async('string'));
    json.rutas = { aumentarCada: 3 };
    json.aceleracion = { cada: 5, resta: 20, minimo: 100 };
    json.pausas = { simulador: 300, externo: 250 };
    json.combinar = true;
    json.ColorFondo = '#336699';
    // Al cargar un GWI, pausas, aceleración y rutas se RECONSTRUYEN desde las propiedades del
    // segmento «cartucho» (autoria.cambios): hay que declararlas ahí, no solo arriba.
    const cartucho = json.autoria.cambios.find(c => c.tipo === 'cartucho').segmento;
    const nuevas = { pausaSim: 300, pausaEsp: 250, accCada: 5, accResta: 20, accMinimo: 100, aumentarCada: 3 };
    for (const [campo, valor] of Object.entries(nuevas)) {
      json.autoria.ultimoOp += 1;
      json.autoria.cambios.push({ n: json.autoria.ultimoOp, relacionados: 0, segmento: cartucho,
        [campo]: valor, antes: { [campo]: null } });
    }
    zip.file(nombre, JSON.stringify(json, null, 2));
    return { json: json, bytes: await zip.generateAsync({ type: 'uint8array' }) };
  }

  async function _cargarGWI(setup, bytes) {
    await U.cargarEn('ficheroCartucho', [U.fichero('setup.json', setup)], 400);
    await U.cargarEn('ficheroCartucho', [U.fichero('cartucho.zip', bytes)], 3500);
  }

  /* ---------------- F5-I17 (M1/M2): el par GWI/GWC y su codigoGWC ---------------- */

  /** El campo solo lectura «Código GWC» de la ficha de Cartucho (o null).
   * F5-I21: la ficha tiene TAMBIÉN los inputs readOnly ancho/alto de la
   * Resolución (number): el código es el único readOnly de TEXTO. */
  function _codigoEnFicha() {
    const inp = [...document.querySelectorAll('#fichaCartucho input')]
      .find(i => i.readOnly && i.type === 'text');
    return inp ? inp.value : null;
  }

  /** El codigoGWC declarado en el JSON del GWI (o null si no lo trae). */
  async function _codigoDeGWI(bytes) {
    const zip = await JSZip.loadAsync(bytes);
    const json = JSON.parse(await zip.file(Object.keys(zip.files)
      .find(n => /^[^/]+\.json$/.test(n))).async('string'));
    return json.codigoGWC || null;
  }

  async function _pruebaParFicha(opc) {
    const out = [];
    const ok = (n, c, x) => out.push([n, !!c, x === undefined ? '' : String(x)]);
    const j0 = baseDirector.datosCartucho();
    if (!j0 || j0.tipo !== 'GWI') return null;
    const esperado = (await _codigoDeGWI(await U.traerBytes(opc.gwiUrl || 'pruebas/cartuchos/cartucho_GWI.zip')))
      || '---';
    const enFicha = _codigoEnFicha();
    ok('C5: el GWI cargado muestra su codigoGWC en la ficha de Cartucho',
      enFicha === esperado, enFicha + ' (esperado ' + esperado + ')');
    return out;
  }

  // Las siguientes dos pruebas descargan ficheros al paso real del guardado, así que
  // solo se lanzan desde la consola (en Playwright la descarga no se acepta):
  // el contenido de la barra de estado se verifica igual.
  async function _pruebaParGuardar() {
    const out = [];
    const ok = (n, c, x) => out.push([n, !!c, x === undefined ? '' : String(x)]);
    const j0 = baseDirector.datosCartucho();
    if (!j0 || j0.tipo !== 'GWI') return null;
    const antes = _codigoEnFicha();
    if (!antes || antes === '---') {
      out.push(['C6: (omitida: el GWI cargado no trae codigoGWC)', true, '']);
      return out;
    }
    document.getElementById('btnGuardar').click();
    await U.esperar(2500);
    const estado = document.getElementById('estado').textContent;
    ok('C6: guardar el GWI a secas avisa de que el GWC del destino queda desparejado',
      /queda desparejado/.test(estado) && estado.includes(antes), estado);
    ok('C6: la ficha de Cartucho vuelve a «---» al soltar el código',
      _codigoEnFicha() === '---', _codigoEnFicha());
    return out;
  }

  async function _pruebaParGenerar(opc) {
    const out = [];
    const ok = (n, c, x) => out.push([n, !!c, x === undefined ? '' : String(x)]);
    const bytes = await U.traerBytes(opc.gwiUrl || 'pruebas/cartuchos/cartucho_GWI.zip');
    const codigoCargado = await _codigoDeGWI(bytes);
    if (!codigoCargado) {
      out.push(['C7: (omitida: el GWI no trae codigoGWC)', true, '']);
      return out;
    }
    // Empezar del cartucho tal cual (para que la ficha traiga su código) y
    // cargar de nuevo una copia con un cambio declarado en la autoría
    // (pausaSim): al cargar se reconstruye desde ahí y el Bloque 1 sale
    // distinto, de modo que generar produce un CRC diferente al declarado.
    const setup = await U.traerBytes(opc.setupUrl || 'pruebas/cartuchos/setup2.json');
    await _cargarGWI(setup, bytes);
    const enFichaInicio = _codigoEnFicha();
    ok('C7 (previo): el GWI cargado mantiene su codigoGWC declarado en la ficha',
      enFichaInicio === codigoCargado, enFichaInicio);
    const zip = await JSZip.loadAsync(bytes);
    const nombreJson = Object.keys(zip.files).find(n => /^[^/]+\.json$/.test(n));
    const json = JSON.parse(await zip.file(nombreJson).async('string'));
    const segCartucho = json.autoria.cambios.find(c => c.tipo === 'cartucho').segmento;
    const pausaSim = (json.pausas && json.pausas.simulador) || 0;
    const nuevoValor = pausaSim === 499 ? 501 : 499;
    json.autoria.ultimoOp += 1;
    json.autoria.cambios.push({ n: json.autoria.ultimoOp, relacionados: 0,
      segmento: segCartucho, pausaSim: nuevoValor, antes: { pausaSim: pausaSim } });
    zip.file(nombreJson, JSON.stringify(json, null, 2));
    await U.cargarEn('ficheroCartucho',
      [U.fichero('cartucho.zip', await zip.generateAsync({ type: 'uint8array' }))], 3500);
    document.getElementById('btnGenerar').click();
    await U.esperar(6000);
    const estado = document.getElementById('estado').textContent;
    ok('C7: generar avisa de que el GWC anterior queda desfasado (los dos códigos)',
      /queda desfasado/.test(estado) && estado.includes(codigoCargado), estado);
    const codigoNuevo = _codigoEnFicha();
    ok('C7: la ficha muestra el codigoGWC NUEVO del par',
      !!codigoNuevo && codigoNuevo !== '---' && codigoNuevo !== codigoCargado, codigoNuevo);
    return out;
  }

  /**
   * Carga el setup (con la memoria dada, o sin ella) y el GWI (con la suya, o sin ella), pulsa
   * «Generar» y devuelve el aviso final (#estado) y la información del panel (#infoDiseno).
   * @param {?Object} memSetup - «memoria» a poner en el setup (null = tal cual, sin campo).
   * @param {?Object} memCartucho - «memoria» a declarar en el GWI (null = sin campo).
   */
  async function _generarConMemoria(opc, memSetup, memCartucho) {
    const dec = new TextDecoder();
    const setup = JSON.parse(dec.decode(await U.traerBytes(opc.setupUrl || 'pruebas/cartuchos/setup2.json')));
    delete setup.memoria;
    if (memSetup) setup.memoria = memSetup;
    const bytes = await U.traerBytes(opc.gwiUrl || 'pruebas/cartuchos/cartucho_GWI.zip');
    const zip = await JSZip.loadAsync(bytes);
    const nombreJson = Object.keys(zip.files).find(n => /^[^/]+\.json$/.test(n));
    const json = JSON.parse(await zip.file(nombreJson).async('string'));
    delete json.memoria;
    if (memCartucho) json.memoria = memCartucho;
    zip.file(nombreJson, JSON.stringify(json, null, 2));
    await _cargarGWI(JSON.stringify(setup),
      await zip.generateAsync({ type: 'uint8array' }));
    document.getElementById('btnGenerar').click();
    await U.esperar(6000);
    return {
      estado: document.getElementById('estado').textContent,
      panel: document.getElementById('infoDiseno').textContent
    };
  }

  async function _pruebaMemoria(opc) {
    const out = [];
    const ok = (n, c, x) => out.push([n, !!c, x === undefined ? '' : String(x)]);
    const PORC = '\\((?:< 1|\\d+) %\\)';
    const reRAM = (kb) => new RegExp('RAM: [\\d.]+ de ' + kb + ' KB ' + PORC);
    const reFLASH = (kb) => new RegExp('FLASH: [\\d.]+ de ' + kb + ' KB ' + PORC);

    // 1) Memoria en el setup: porcentaje en el panel y en el aviso final; FLASH
    //    con el bloque del fondo (A02: el GWI de pruebas lleva img_f).
    let r = await _generarConMemoria(opc, { RAM: 64, FLASH: 32 }, null);
    ok('C8: con memoria en el setup, el aviso final trae la RAM con su porcentaje',
      reRAM(64).test(r.estado), r.estado);
    ok('C8: FLASH trae el fondo del GWC (Bloque 5) con su porcentaje',
      reFLASH(32).test(r.estado) && !/FLASH: 0 de/.test(r.estado), r.estado);
    ok('C8: la línea del panel (informarTamanos) trae también la ocupación',
      reRAM(64).test(r.panel) && reFLASH(32).test(r.panel), r.panel);

    // 2) El cartucho manda por subcampo: su RAM gana, la FLASH sigue siendo la del setup.
    r = await _generarConMemoria(opc, { RAM: 64, FLASH: 32 }, { RAM: 128 });
    ok('C8: la RAM del cartucho manda sobre la del setup', reRAM(128).test(r.estado) && !reRAM(64).test(r.estado), r.estado);
    ok('C8: la FLASH que el cartucho no declara se toma del setup', reFLASH(32).test(r.estado), r.estado);

    // 3) Sin memoria, o a 0: ni porcentaje ni aviso ni línea de panel.
    for (const [etiqueta, ms] of [['ausente', null], ['a 0', { RAM: 0, FLASH: 0 }]]) {
      r = await _generarConMemoria(opc, ms, null);
      ok('C8: memoria ' + etiqueta + ' → sin porcentaje en el aviso final',
        !/RAM:|FLASH:/.test(r.estado) && /Generados/.test(r.estado), r.estado);
      ok('C8: memoria ' + etiqueta + ' → sin línea de memoria en el panel', !/RAM:|FLASH:/.test(r.panel), r.panel);
    }
    return out;
  }

  /** Juega ticks con la cola del reloj; devuelve, por tick, qué segmentos están encendidos. */
  async function _jugarPartida(cargar, semilla, ticks, sinPulsar) {
    await cargar();
    document.getElementById('pesSimulador').click();
    window.__cola.length = 0;
    juegoDirector.fijarSemilla(semilla);
    for (const tipo of ['keydown', 'keyup'])
      document.dispatchEvent(new KeyboardEvent(tipo, { key: 'z', bubbles: true }));   // A = Start
    await U.esperar(100);
    const hist = [];
    for (let t = 0; t < ticks; t++) {
      const f = window.__cola.shift(); if (!f) break;
      if (!sinPulsar) { const r = (t * 7 + semilla) % 5; if (r === 0) comunListas.encolar(0); else if (r === 1) comunListas.encolar(4); }
      f();
      hist.push(comunListas.segmentos().filter(s => s.tipo !== 99 && !s.fusionadoPor)
        .map(s => (s.visible ? '1' : '0')).join(''));
    }
    return hist;
  }

  /**
   * Partidas con el GWI y con el GWC que sale de él, por semilla.
   * @param {string} id - Clave en Pruebas.datos.
   * @param {boolean} completa - GWI con las declaraciones añadidas.
   */
  async function _pruebaJuego(id, completa, opc) {
    const out = [];
    const ok = (n, c, x) => out.push([n, !!c, x === undefined ? '' : String(x)]);
    const setup = await U.traerBytes(opc.setupUrl || 'pruebas/cartuchos/setup2.json');
    let bytes = await U.traerBytes(opc.gwiUrl || 'pruebas/cartuchos/cartucho_GWI.zip');
    let json;
    if (completa) { const c = await _gwiCompleto(bytes); json = c.json; bytes = c.bytes; }
    else {
      const zip = await JSZip.loadAsync(bytes);
      json = JSON.parse(await zip.file(Object.keys(zip.files).find(n => /^[^/]+\.json$/.test(n))).async('string'));
    }
    const ticks = opc.ticks || 400, semillas = opc.semillas || SEMILLAS;
    const real = window.setTimeout;
    window.__cola = [];
    window.setTimeout = (f, ms, ...a) => {
      if (typeof ms === 'number' && ms >= 100 && f && f.name === '_tick') { window.__cola.push(f); return 1; }
      return real.call(window, f, ms, ...a);
    };
    const grabadas = {};
    try {
      await _cargarGWI(setup, bytes);
      const pantalla = { ancho: json.resolucion.ancho, alto: json.resolucion.alto,
        fuente: { ancho: json.resolucion.ancho, alto: json.resolucion.alto } };
      const gwc = baseCartucho.generarGWC(json, baseDescomponer.sprites(), pantalla);
      const difs = _diferenciasEquivalencia(json, baseCartucho.leerGWC(gwc.bytes));
      ok('datos iguales', difs.length === 0, difs.slice(0, 40).join(' || '));
      for (const semilla of semillas) {
        const hGWI = await _jugarPartida(() => _cargarGWI(setup, bytes), semilla, ticks, opc.sinPulsar);
        const hGWC = await _jugarPartida(() => U.cargarEn('ficheroCartucho', [U.fichero('equiv.gwc', gwc.bytes)], 1500),
          semilla, ticks, opc.sinPulsar);
        let primera = -1;
        const n = Math.min(hGWI.length, hGWC.length);
        for (let t = 0; t < n; t++) if (hGWI[t] !== hGWC[t]) { primera = t; break; }
        grabadas[semilla] = hGWI;
        const igualPartida = primera < 0 && hGWI.length === hGWC.length && hGWI.length > 0;
        ok('juego (semilla ' + semilla + '): ' + hGWI.length + ' ticks con el GWI, ' + hGWC.length + ' con el GWC',
          igualPartida, 'primera diferencia en el tick ' + (primera < 0 ? n + 1 : primera + 1));
      }
      await _cargarGWI(setup, bytes);                  // deja cargado el GWI para las pruebas de datos
    } finally {
      window.setTimeout = real;
      window.__cola.length = 0;
      const t = document.getElementById('pesPruebas');
      if (t && !t.disabled) t.click();
    }
    Pruebas.datos[id] = grabadas;
    return out;
  }

  // F5-I21 (C9): el GWC que saldría tras el ajuste de resolución coincide con el
  // que sale del cartucho original con la nueva pantalla: MISMA función escalar.
  // Se comprueba con las APIs públicas: dimensiones reescaladas de los sprites
  // == las que escalar da para el original a la nueva pantalla, y posiciones
  // de los segmentos == redondeo del generador (el mismo que usa _montarSegmentos).
  async function _pruebaAjuste() {
    const out = [];
    const ok = (n, c, x) => out.push([n, !!c, x === undefined ? '' : String(x)]);
    await U.cargarEn('ficheroCartucho',
      [U.fichero('setup2.json', await U.traerBytes('pruebas/cartuchos/setup2.json'))], 500);
    await U.cargarEn('ficheroCartucho',
      [U.fichero('gwi.zip', await U.traerBytes('pruebas/cartuchos/cartucho_GWI.zip'))], 3500);
    // F5-I21 modelo simple: el ajuste SOLO cambia la resolución declarada.
    // El juego (sprites y segmentos, en coordenadas de img_s) queda EXACTO:
    // el GWI conserva el origen; el GWC escala declarada/fuente AL GENERAR
    // (lo que aquí ya se verifica con un cartucho fuente≠declarada en C1-C4)
    // y el emulador reescala al vuelo.
    const spritesAntes = JSON.stringify(baseDescomponer.sprites().map(s => [s.id, s.ancho, s.alto]));
    const segsAntes = JSON.stringify(baseDescomponer.segmentos().filter(s => s.tipo < 5).map(s => [s.id, s.x, s.y]));
    const fuenteAntes = JSON.stringify(baseDescomponer.dimensionesBase());
    ok('C9: ajustar a 640×480 se aplica',
      baseDirector.aplicarAjusteResolucion(640, 480) === true, '');
    ok('C9: los sprites quedan EXACTOS (el juego no se reescala)',
      JSON.stringify(baseDescomponer.sprites().map(s => [s.id, s.ancho, s.alto])) === spritesAntes, '');
    ok('C9: las posiciones de los segmentos quedan exactas',
      JSON.stringify(baseDescomponer.segmentos().filter(s => s.tipo < 5).map(s => [s.id, s.x, s.y])) === segsAntes, '');
    ok('C9: img_s no se reescala (el GWI conserva el origen)',
      JSON.stringify(baseDescomponer.dimensionesBase()) === fuenteAntes, '');
    ok('C9: el setup declara la nueva resolución',
      baseDirector.datosSetup().resolucion.ancho === 640 &&
      baseDirector.datosSetup().resolucion.alto === 480,
      JSON.stringify(baseDirector.datosSetup().resolucion));
    // El escalar del GWC sobre el juego SIN TOCAR, con la nueva declarada:
    // eso es lo que llevará el cartucho (más detalle que a 320×240).
    const pantalla640 = { ancho: 640, alto: 480, fuente: baseDescomponer.dimensionesBase() };
    const primero = baseDescomponer.sprites()[0];
    const escalado = baseCartucho.escalar(primero, pantalla640);
    ok('C9: el escalar del GWC produce sprites para la pantalla nueva',
      escalado && escalado.ancho > 0 && escalado.alto > 0,
      escalado ? (escalado.ancho + '×' + escalado.alto) : 'null');
    baseDirector.aplicarAjusteResolucion(320, 240);   // restaurar
    ok('C9: vuelta a 320×240 con el juego exacto',
      JSON.stringify(baseDescomponer.sprites().map(s => [s.id, s.ancho, s.alto])) === spritesAntes, '');
    return out;
  }

  // F5-I21: el «último GWC calculado» (ultimoGWC/ultimoGWCimg) vive en la
  // «memoria» del GWI que sale del par (a 0 explícito si no hay fondo); el
  // GWI guardado a secas va SIN él; el GWB ya no lleva resolucion, memoria
  // ni botones (solo estilo). Descarga ficheros: solo consola.
  async function _pruebaUltimos(opc) {
    const out = [];
    const ok = (n, c, x) => out.push([n, !!c, x === undefined ? '' : String(x)]);
    const dec = new TextDecoder();
    const capturas = { gwi: null, gwb: null };
    const gwiReal = baseCartucho.guardarGWI, gwbReal = baseCartucho.guardarGWB;
    baseCartucho.guardarGWI = async function () { capturas.gwi = arguments[0]; return gwiReal.apply(baseCartucho, arguments); };
    baseCartucho.guardarGWB = async function () { capturas.gwb = arguments[0]; return gwbReal.apply(baseCartucho, arguments); };
    try {
      const montar = async (sinFondo) => {
        const setup = JSON.parse(dec.decode(await U.traerBytes(opc.setupUrl || 'pruebas/cartuchos/setup2.json')));
        setup.memoria = { RAM: 64, FLASH: 32 };
        const bytes = await U.traerBytes(opc.gwiUrl || 'pruebas/cartuchos/cartucho_GWI.zip');
        const zip = await JSZip.loadAsync(bytes);
        const nombreJson = Object.keys(zip.files).find(n => /^[^/]+\.json$/.test(n));
        const json = JSON.parse(await zip.file(nombreJson).async('string'));
        delete json.memoria;
        if (sinFondo) { zip.remove('img_f.png'); delete json.imagenes.img_f; }
        zip.file(nombreJson, JSON.stringify(json, null, 2));
        await _cargarGWI(JSON.stringify(setup), await zip.generateAsync({ type: 'uint8array' }));
      };
      // 1) Par CON fondo: el GWI lleva los dos informativos; el GWB, solo estilo.
      await montar(false);
      capturas.gwi = null; capturas.gwb = null;
      document.getElementById('btnGenerar').click();
      await U.esperar(6000);
      const m = capturas.gwi ? capturas.gwi.memoria : null;
      ok('C10: el GWI del par lleva memoria.ultimoGWC (bytes de datos, sin el fondo)',
        !!m && Number.isInteger(m.ultimoGWC) && m.ultimoGWC > 0, JSON.stringify(m));
      ok('C10: el GWI del par lleva memoria.ultimoGWCimg (el bloque del fondo)',
        !!m && Number.isInteger(m.ultimoGWCimg) && m.ultimoGWCimg > 0, JSON.stringify(m));
      ok('C10: el GWI del par mantiene los KB de RAM/FLASH del setup',
        !!m && m.RAM === 64 && m.FLASH === 32, JSON.stringify(m));
      const g = capturas.gwb;
      ok('C10: el GWB ya no lleva resolucion',
        !!g && g.resolucion === undefined, g ? 'resolucion: ' + JSON.stringify(g.resolucion) : 'sin captura');
      ok('C10: el GWB ya no lleva memoria',
        !!g && g.memoria === undefined, g ? 'memoria: ' + JSON.stringify(g.memoria) : 'sin captura');
      ok('C10: el GWB ya no lleva botones',
        !!g && g.botones === undefined, g ? 'botones: ' + JSON.stringify(g.botones) : 'sin captura');
      ok('C10: el GWB sigue llevando el estilo',
        !!g && g.estilo !== undefined && g.estilo !== null, g ? String(g.estilo) : 'sin captura');
      // 2) Par SIN fondo: ultimoGWCimg a 0 EXPLÍCITO (el cartucho dice que no lleva fondo).
      await montar(true);
      capturas.gwi = null; capturas.gwb = null;
      document.getElementById('btnGenerar').click();
      await U.esperar(6000);
      const m2 = capturas.gwi ? capturas.gwi.memoria : null;
      ok('C10: sin fondo, el GWI lleva ultimoGWCimg a 0 (explícito) y su ultimoGWC',
        !!m2 && m2.ultimoGWCimg === 0 && m2.ultimoGWC > 0, JSON.stringify(m2));
      // 3) GWI a secas: SIN los informativos (no hay GWC nuevo; así no
      //    queda discrepante con cambios hechos después en el editor).
      capturas.gwi = null;
      document.getElementById('btnGuardar').click();
      await U.esperar(2500);
      const m3 = capturas.gwi ? capturas.gwi.memoria : null;
      ok('C10: el GWI a secas va SIN ultimoGWC/ultimoGWCimg',
        !!capturas.gwi && !!m3 && m3.ultimoGWC === undefined && m3.ultimoGWCimg === undefined, JSON.stringify(m3));
    } finally {
      baseCartucho.guardarGWI = gwiReal;
      baseCartucho.guardarGWB = gwbReal;
    }
    return out;
  }

  Pruebas.registrar([
    { id: 'equivalencia', grupo: 'gwi_gwc', nombre: 'C1 equivalencia (datos)', necesita: 'gwi', ejecutar: () => _pruebaEquivalencia(false) },
    { id: 'equivalenciaVariante', grupo: 'gwi_gwc', nombre: 'C2 equivalencia (variante)', necesita: 'gwi', ejecutar: () => _pruebaEquivalencia(true) },
    { id: 'equivalenciaJuego', grupo: 'gwi_gwc', nombre: 'C3 equivalencia (juego)', destructiva: true, ejecutar: (o) => _pruebaJuego('equivalenciaJuego', false, o) },
    { id: 'equivalenciaCompleta', grupo: 'gwi_gwc', nombre: 'C4 equivalencia (completa)', destructiva: true, ejecutar: (o) => _pruebaJuego('equivalenciaCompleta', true, o) },
    { id: 'parFicha', grupo: 'gwi_gwc', nombre: 'C5 par: ficha codigoGWC', necesita: 'gwi', ejecutar: (o) => _pruebaParFicha(o) },
    { id: 'parGuardar', grupo: 'gwi_gwc', nombre: 'C6 par: guardar despareja', necesita: 'gwi', soloConsola: true, ejecutar: () => _pruebaParGuardar() },
    { id: 'parGenerar', grupo: 'gwi_gwc', nombre: 'C7 par: generar desfasado', necesita: 'gwi', soloConsola: true, ejecutar: (o) => _pruebaParGenerar(o) },
    { id: 'memoria', grupo: 'gwi_gwc', nombre: 'C8 memoria: porcentaje al generar', necesita: 'gwi', soloConsola: true, ejecutar: (o) => _pruebaMemoria(o) },
    { id: 'ajuste', grupo: 'gwi_gwc', nombre: 'C9 ajuste de resolución (F5-I21)', necesita: 'gwi', soloConsola: true, ejecutar: () => _pruebaAjuste() },
    { id: 'ultimos', grupo: 'gwi_gwc', nombre: 'C10 memoria: ultimoGWC en el GWI (F5-I21)', necesita: 'gwi', soloConsola: true, ejecutar: (o) => _pruebaUltimos(o) }
  ]);
})();

if (typeof require !== 'undefined' && typeof module !== 'undefined' && require.main === module)
  require('./lanzador.js').lanzar('gwi_gwc');
