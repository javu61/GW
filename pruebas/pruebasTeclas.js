// pruebas/pruebasTeclas.js — Teclas del SIMULADOR en BaseDirector (F5-I17, M4/M5/M6)
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
//
// FUNCIONES
//   _setupConTecla       Setup de cartuchos con la tecla del botón 0 cambiada (en memoria).
//   _setupSinTeclas      Setup de cartuchos sin ninguna tecla declarada (en memoria).
//   _botonPorNumero      El botón físico del estilo activo por su número.
//   _pruebaT1            Prueba «T1 tecla cursor y rechazos» (destructiva).
//   _pruebaT2            Prueba «T2 teclas por defecto por estilo» (destructiva).
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
    await U.cargarEn('ficheroSetup', [U.fichero(fich, await U.traerBytes('pruebas/cartuchos/' + fich))], ms || 600);
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

  /** El botón físico del estilo activo por su número (o null). */
  function _botonPorNumero(numero) {
    const lista = [...document.querySelectorAll('.botonFisico')].filter(b => b.dataset.numero === numero);
    return lista.length ? lista[0] : null;
  }

  async function _pruebaT1() {
    const out = [];
    const ok = (n, c, x) => out.push([n, !!c, x === undefined ? '' : String(x)]);
    await U.cargarEn('ficheroSetup', [await _setupConTecla('cursor-izquierda')], 600);
    ok('T1: un GWS con tecla «cursor-izquierda» se carga', /Setup cargado/.test(estado()), estado());
    BaseDirector.pestanna('vistaSimulador');    // las teclas de botón solo juegan aquí (M4)
    const boton = _botonPorNumero('0');
    const pista = boton ? boton.querySelector('small').textContent : null;
    document.body.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowLeft', bubbles: true }));
    const pulsado = !!boton && boton.classList.contains('pulsado');
    document.body.dispatchEvent(new KeyboardEvent('keyup', { key: 'ArrowLeft', bubbles: true }));
    const soltado = !!boton && !boton.classList.contains('pulsado');
    ok('T1: el botón con cursor-izquierda lleva la pista «←» y la flecha del PC lo pulsa y suelta',
      pulsado && soltado && pista === '←', JSON.stringify({ hay: !!boton, pista, pulsado, soltado }));
    await U.cargarEn('ficheroSetup', [await _setupConTecla('cursorziq')], 600);
    ok('T1: tecla mal escrita «cursorziq» NO carga', /Setup NO cargado/.test(estado()), estado());
    await U.cargarEn('ficheroSetup', [await _setupConTecla('1')], 600);
    ok('T1: tecla dígito «1» NO carga (retirada en F5-I17)',
      /Setup NO cargado/.test(estado()) && /cursor/.test(estado()), estado());
    await _cargarSetup('setup2.json', 600);      // dejamos la máquina como estaba
    return out;
  }

  async function _pruebaT2() {
    const out = [];
    const ok = (n, c, x) => out.push([n, !!c, x === undefined ? '' : String(x)]);
    // Estilo 2 sin teclas: 0/4 con cursores y el trío A/B/R con 1/2/3 (M6)
    await U.cargarEn('ficheroSetup', [await _setupSinTeclas('setup2.json')], 600);
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
    await U.cargarEn('ficheroSetup', [await _setupSinTeclas('setup5.json')], 600);
    const r5 = {
      b0: _botonPorNumero('0') ? _botonPorNumero('0').dataset.tecla : null,
      b1: _botonPorNumero('1') ? _botonPorNumero('1').dataset.tecla : null,
      b2: _botonPorNumero('2') ? _botonPorNumero('2').dataset.tecla : null,
      b3: _botonPorNumero('3') ? _botonPorNumero('3').dataset.tecla : null,
      b4: _botonPorNumero('4') ? _botonPorNumero('4').dataset.tecla : null
    };
    ok('T2: estilo 5 sin teclas — cruceta 0-3 con los cuatro cursores y el 4 con la letra Z',
      r5.b0 === 'cursor-izquierda' && r5.b1 === 'cursor-derecha' &&
      r5.b2 === 'cursor-arriba' && r5.b3 === 'cursor-abajo' && r5.b4 === 'Z', JSON.stringify(r5));
    await _cargarSetup('setup2.json', 600);      // dejamos la máquina como estaba
    return out;
  }

  Pruebas.registrar([
    { id: 'teclaCursor', grupo: 'teclas', nombre: 'T1 tecla cursor y rechazos', destructiva: true, ejecutar: () => _pruebaT1() },
    { id: 'teclaDefaults', grupo: 'teclas', nombre: 'T2 teclas por defecto por estilo', destructiva: true, ejecutar: () => _pruebaT2() }
  ]);
})();

if (typeof require !== 'undefined' && typeof module !== 'undefined' && require.main === module)
  require('./lanzador.js').lanzar('teclas');
