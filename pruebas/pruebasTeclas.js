// pruebas/pruebasTeclas.js — Teclas del SIMULADOR en baseDirector (F5-I17, M4/M5/M6)
// ================================================================================================
// PROPÓSITO
//   Comprueban la tecla declarada para cada botón en el GWS y las teclas por defecto según el
//   ESTILO de máquina: los cuatro nombres de cursor (cursor-izquierda/derecha/arriba/abajo),
//   las letras A..Z (sin dígitos, retirados en F5-I17) y la tabla TECLAS_POR_DEFECTO por estilo,
//   con el trío de sistema 6/7/8 (A/B/R) asociado a las teclas 1/2/3.
//   Detienen lo que cargan: al terminar cada prueba dejan cargado setup2.json (el botón avisa).
//
// PRUEBAS (grupo «teclas»)
//   T1  Un GWS con tecla «cursor-izquierda» carga; el botón lleva la pista de símbolo («←») y la
//       flecha del teclado PC lo pulsa y lo suelta. Con un nombre mal escrito o una dígito, el
//       setup NO carga.
//   T2  Setups sin teclas: los botones toman la tecla por defecto del estilo (estilo 2: cursores
//       en 0/4 y el trío 1/2/3; estilo 5: cruceta con los cuatro cursores y el 4 con la letra Z).
//   T3  Teclas propias del cartucho (F5-I17, M8, precedencia GWI > GWB > GWS): un GWB que declara
//       teclas en botones[].tecla carga y manda sobre el setup (letra y cursor), los botones sin
//       tecla caen al nivel inferior (el setup); el dígito 1/2/3 solo vale en el trío A/B/R y una
//       tecla dígito fuera del trío (o el «5») o repetida NO carga.
//
// FUNCIONES
//   _setupConTecla       Setup de cartuchos con la tecla del botón 0 cambiada (en memoria).
//   _setupSinTeclas      Setup de cartuchos sin ninguna tecla declarada (en memoria).
//   _gwbConTeclas        El GWB de cartuchos con teclas propias en botones[].tecla (en memoria).
//   _botonPorNumero      El botón físico del estilo activo por su número.
//   _pruebaT1            Prueba «T1 tecla cursor y rechazos» (destructiva).
//   _pruebaT2            Prueba «T2 teclas por defecto por estilo» (destructiva).
//   _pruebaT3            Prueba «T3 teclas del cartucho» (destructiva).
//
// USO
//   Pestaña «Pruebas» (index.html por servidor local con GW_DEBUG) o, en consola:
//     pruebas\Lanzar.bat teclas
// ================================================================================================
'use strict';

(function () {
  if (typeof Pruebas === 'undefined') return;     // en Node solo cuenta el lanzador del final
  const U = Pruebas.util;

  const estado = () => document.getElementById('estado').textContent;

  /** Carga un setup de pruebas/cartuchos por URL y espera a que se aplique. */
  async function _cargarSetup(fich, ms) {
    await U.cargarEn('ficheroCartucho', [U.fichero(fich, await U.traerBytes('pruebas/cartuchos/' + fich))], ms || 600);
  }

  /** Setup de pruebas/cartuchos con la tecla del botón 0 cambiada (en memoria). */
  async function _setupConTecla(tecla) {
    const json = JSON.parse(new TextDecoder().decode(await U.traerBytes('pruebas/cartuchos/setup4.json')));
    json.botones[0].tecla = tecla;
    return U.fichero('setup.json', new TextEncoder().encode(JSON.stringify(json)), 'application/json');
  }

  /** Setup de pruebas/cartuchos sin ninguna tecla declarada (en memoria). */
  async function _setupSinTeclas(fich) {
    const json = JSON.parse(new TextDecoder().decode(await U.traerBytes('pruebas/cartuchos/' + fich)));
    for (const b of json.botones) delete b.tecla;
    return U.fichero(fich, new TextEncoder().encode(JSON.stringify(json)), 'application/json');
  }

  /** El GWB de cartuchos con teclas propias en botones[].tecla (en memoria). */
  async function _gwbConTeclas(teclas) {
    const zip = await JSZip.loadAsync(await U.traerBytes('pruebas/cartuchos/cartucho_GWB.zip'));
    const nombreJson = Object.keys(zip.files).find(n => /^[^/]+\.json$/.test(n));
    const json = JSON.parse(await zip.file(nombreJson).async('string'));
    const porNumero = new Map(json.botones.map(b => [String(b.numero), b]));
    for (const [n, t] of Object.entries(teclas)) porNumero.get(n).tecla = t;
    zip.file(nombreJson, JSON.stringify(json));
    return U.fichero('gwb.zip', await zip.generateAsync({ type: 'uint8array' }));
  }

  /** El botón físico del estilo activo por su número (o null). */
  function _botonPorNumero(numero) {
    const lista = [...document.querySelectorAll('.botonFisico')].filter(b => b.dataset.numero === numero);
    return lista.length ? lista[0] : null;
  }

  async function _pruebaT1() {
    const out = [];
    const ok = (n, c, x) => out.push([n, !!c, x === undefined ? '' : String(x)]);
    await U.cargarEn('ficheroCartucho', [await _setupConTecla('cursor-izquierda')], 600);
    ok('T1: un GWS con tecla «cursor-izquierda» se carga', /Setup cargado/.test(estado()), estado());
    baseDirector.pestanna('vistaSimulador');    // las teclas de botón solo juegan aquí (M4)
    const boton = _botonPorNumero('0');
    const pista = boton ? boton.querySelector('small').textContent : null;
    document.body.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowLeft', bubbles: true }));
    const pulsado = !!boton && boton.classList.contains('pulsado');
    document.body.dispatchEvent(new KeyboardEvent('keyup', { key: 'ArrowLeft', bubbles: true }));
    const soltado = !!boton && !boton.classList.contains('pulsado');
    ok('T1: el botón con cursor-izquierda lleva la pista «←» y la flecha del PC lo pulsa y suelta',
      pulsado && soltado && pista === '←', JSON.stringify({ hay: !!boton, pista, pulsado, soltado }));
    await U.cargarEn('ficheroCartucho', [await _setupConTecla('cursorziq')], 600);
    ok('T1: tecla mal escrita «cursorziq» NO carga', /Setup NO cargado/.test(estado()), estado());
    await U.cargarEn('ficheroCartucho', [await _setupConTecla('1')], 600);
    ok('T1: tecla dígito «1» NO carga (retirada en F5-I17)',
      /Setup NO cargado/.test(estado()) && /cursor/.test(estado()), estado());
    await _cargarSetup('setup2.json', 600);      // dejamos la máquina como estaba
    return out;
  }

  async function _pruebaT2() {
    const out = [];
    const ok = (n, c, x) => out.push([n, !!c, x === undefined ? '' : String(x)]);
    // Estilo 2 sin teclas: 0/4 con cursores y el trío A/B/R con 1/2/3 (M6)
    await U.cargarEn('ficheroCartucho', [await _setupSinTeclas('setup2.json')], 600);
    const pista = (n) => {
      const b = _botonPorNumero(n);
      const s = b ? b.querySelector('small') : null;
      return s ? s.textContent : null;
    };
    const r2 = {
      b0: _botonPorNumero('0') ? _botonPorNumero('0').dataset.tecla : null,
      p0: pista('0'),
      b4: _botonPorNumero('4') ? _botonPorNumero('4').dataset.tecla : null,
      b6: _botonPorNumero('6') ? _botonPorNumero('6').dataset.tecla : null,
      b7: _botonPorNumero('7') ? _botonPorNumero('7').dataset.tecla : null,
      b8: _botonPorNumero('8') ? _botonPorNumero('8').dataset.tecla : null
    };
    ok('T2: estilo 2 sin teclas — 0/4 cursores izq/der (pista «←») y trío A/B/R con 1/2/3',
      r2.b0 === 'cursor-izquierda' && r2.p0 === '←' && r2.b4 === 'cursor-derecha' &&
      r2.b6 === '1' && r2.b7 === '2' && r2.b8 === '3', JSON.stringify(r2));
    // Estilo 5 sin teclas: la cruceta (0-3) con los cuatro cursores y el 4 con la letra Z
    await U.cargarEn('ficheroCartucho', [await _setupSinTeclas('setup5.json')], 600);
    const r5 = {
      b0: _botonPorNumero('0') ? _botonPorNumero('0').dataset.tecla : null,
      b1: _botonPorNumero('1') ? _botonPorNumero('1').dataset.tecla : null,
      b2: _botonPorNumero('2') ? _botonPorNumero('2').dataset.tecla : null,
      b3: _botonPorNumero('3') ? _botonPorNumero('3').dataset.tecla : null,
      b4: _botonPorNumero('4') ? _botonPorNumero('4').dataset.tecla : null,
      p4: pista('4')
    };
    // dataset.tecla va normalizado en minúsculas (es la clave de comparación con
    // el teclado, baseDirector); la letra se pinta en mayúscula en la pista.
    ok('T2: estilo 5 sin teclas — cruceta 0-3 con los cuatro cursores y el 4 con la letra Z',
      r5.b0 === 'cursor-izquierda' && r5.b1 === 'cursor-derecha' &&
      r5.b2 === 'cursor-arriba' && r5.b3 === 'cursor-abajo' &&
      r5.b4 === 'z' && r5.p4 === 'Z', JSON.stringify(r5));
    await _cargarSetup('setup2.json', 600);      // dejamos la máquina como estaba
    return out;
  }

  async function _pruebaT3() {
    const out = [];
    const ok = (n, c, x) => out.push([n, !!c, x === undefined ? '' : String(x)]);
    const teclaDe = (n) => { const b = _botonPorNumero(String(n)); return b ? b.dataset.tecla : null; };
    const pistaDe = (n) => {
      const b = _botonPorNumero(String(n)); const s = b ? b.querySelector('small') : null;
      return s ? s.textContent : null;
    };
    // GWB con teclas propias (0 letra M, 4 cursor-arriba): mandan sobre el
    // setup (O y P); el botón sin tecla en el cartucho cae al nivel
    // inferior (el setup: 6 → Z).
    await _cargarSetup('setup2.json', 600);
    await U.cargarEn('ficheroCartucho', [await _gwbConTeclas({ 0: 'M', 4: 'cursor-arriba' })], 1500);
    ok('T3: el GWB con teclas propias carga', /Cartucho cargado/.test(estado()), estado());
    const r1 = { b0: teclaDe(0), p0: pistaDe(0), b4: teclaDe(4), p4: pistaDe(4), b6: teclaDe(6) };
    ok('T3: mandan las teclas del cartucho (0 → M, 4 → cursor-arriba) y el 6 sin tecla cae al setup (Z)',
      r1.b0 === 'm' && r1.p0 === 'M' && r1.b4 === 'cursor-arriba' && r1.p4 === '↑' &&
      r1.b6 === 'z', JSON.stringify(r1));
    // El dígito 1/2/3 SOLO vale en el trío de sistema A/B/R (F5-I17, M6):
    // el 6 lo admite; fuera del trío, no carga.
    await U.cargarEn('ficheroCartucho', [await _gwbConTeclas({ 6: '2' })], 1500);
    ok('T3: el dígito «2» como tecla del botón 6 (trío A/B/R) carga',
      /Cartucho cargado/.test(estado()), estado());
    const r2 = { b6: teclaDe(6), p6: pistaDe(6) };
    ok('T3: el botón 6 queda con la tecla «2» del cartucho',
      r2.b6 === '2' && r2.p6 === '2', JSON.stringify(r2));
    // Rechazos: tecla dígito fuera del trío, dígito «5» (no vale en
    // ningún caso) y tecla repetida en el cartucho (M8).
    await U.cargarEn('ficheroCartucho', [await _gwbConTeclas({ 0: '1' })], 1500);
    ok('T3: el dígito «1» en un botón fuera del trío NO carga',
      /Cartucho NO cargado/.test(estado()) && /tecla/.test(estado()), estado());
    await U.cargarEn('ficheroCartucho', [await _gwbConTeclas({ 0: '5' })], 1500);
    ok('T3: tecla dígito «5» en el cartucho NO carga',
      /Cartucho NO cargado/.test(estado()) && /tecla/.test(estado()), estado());
    await U.cargarEn('ficheroCartucho', [await _gwbConTeclas({ 0: 'M', 4: 'm' })], 1500);
    ok('T3: tecla repetida en el cartucho NO carga',
      /Cartucho NO cargado/.test(estado()) && /tecla/.test(estado()), estado());
    await _cargarSetup('setup2.json', 600);      // dejamos la máquina como estaba
    return out;
  }

  Pruebas.registrar([
    { id: 'teclaCursor', grupo: 'teclas', nombre: 'T1 tecla cursor y rechazos', destructiva: true, ejecutar: () => _pruebaT1() },
    { id: 'teclaDefaults', grupo: 'teclas', nombre: 'T2 teclas por defecto por estilo', destructiva: true, ejecutar: () => _pruebaT2() },
    { id: 'teclaCartucho', grupo: 'teclas', nombre: 'T3 teclas del cartucho', destructiva: true, ejecutar: () => _pruebaT3() }
  ]);
})();

if (typeof require !== 'undefined' && typeof module !== 'undefined' && require.main === module)
  require('./lanzador.js').lanzar('teclas');
