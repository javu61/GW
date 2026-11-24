// pruebas/pruebasDirector.js — Pruebas del DIRECTOR del editor (BaseDirector): carga de cartuchos
// ================================================================================================
// PROPÓSITO
//   Cargan cartuchos por los inputs del diseñador, como si el usuario los eligiera, y comprueban
//   en qué estado queda el diseñador. TODAS sustituyen el cartucho cargado (el botón avisa).
//   Necesitan los cartuchos de ejemplo del proyecto (pruebas/cartuchos (setup2.json, cartucho_GWI.zip
//   y cartucho_GWB.zip), que leen por URL: index.html debe abrirse por un servidor local.
//
// PRUEBAS (grupo «director»)
//   D1  Cargar un GWC tras un GWI no deja la autoría del GWI viva (editable, Guardar, Generar).
//   D2  Un cartucho que no arranca la autoría no deja habilitados Guardar, Generar ni el Editor.
//   D3  Un cartucho incompatible con la máquina NO destruye el cartucho que ya estaba cargado.
//
// FUNCIONES
//   _estado              Lo que ve el usuario: tipo y nombre del cartucho, botones y pestañas.
//   _gwbModificado       El GWB de ejemplo con el JSON y la imagen img_s cambiados (en memoria).
//   _pruebaD1 / _pruebaD2 / _pruebaD3
//                        Una función por prueba.
//
// USO
//   Pestaña «Pruebas» (index.html por servidor local con GW_DEBUG) o, en consola:
//     pruebas\Lanzar.bat director
// ================================================================================================
'use strict';

(function () {
  if (typeof Pruebas === 'undefined') return;     // en Node solo cuenta el lanzador del final
  const U = Pruebas.util;

  const _estado = () => ({
    tipo: BaseDirector.datosCartucho() ? BaseDirector.datosCartucho().tipo : null,
    nombre: BaseDirector.datosCartucho() ? BaseDirector.datosCartucho().nombre : null,
    imgS: !!BaseDirector.imagenSegmentos(),
    guardar: !document.getElementById('btnGuardar').disabled,
    generar: !document.getElementById('btnGenerar').disabled,
    pesEditor: !document.getElementById('pesEditor').disabled
  });

  /**
   * El GWB de ejemplo (cartucho_GWB.zip) con cambios, empaquetado de nuevo en memoria.
   * @param {function(Object): void} cambiarJson - Modifica el JSON del cartucho.
   * @param {boolean} [imgSBlanca] - Sustituye img_s por una imagen toda blanca.
   * @returns {Promise<File>}
   */
  async function _gwbModificado(cambiarJson, imgSBlanca) {
    const zip = await JSZip.loadAsync(await U.traerBytes('pruebas/cartuchos/cartucho_GWB.zip'));
    const nombre = Object.keys(zip.files).find(n => /^[^/]+\.json$/.test(n));
    const json = JSON.parse(await zip.file(nombre).async('string'));
    cambiarJson(json);
    zip.file(nombre, JSON.stringify(json));
    if (imgSBlanca) {
      const c = document.createElement('canvas'); c.width = 320; c.height = 240;
      const g = c.getContext('2d'); g.fillStyle = '#fff'; g.fillRect(0, 0, 320, 240);
      const png = await new Promise(r => c.toBlob(r, 'image/png'));
      zip.file(json.imagenes.img_s, await png.arrayBuffer());
    }
    return U.fichero('gwb.zip', await zip.generateAsync({ type: 'uint8array' }));
  }

  async function _pruebaD1(opc) {
    const out = [];
    const ok = (n, c, x) => out.push([n, !!c, x === undefined ? '' : String(x)]);
    await U.cargarEn('ficheroSetup', [U.fichero('setup4.json', await U.traerBytes(opc.setupUrl || 'pruebas/cartuchos/setup2.json'))], 500);
    await U.cargarEn('ficheroGWIZip', [U.fichero('g.zip', await U.traerBytes(opc.gwiUrl || 'pruebas/cartuchos/cartucho_GWI.zip'))], 3500);
    const antes = _estado();
    ok('D1 (previo): con el GWI cargado hay autoría y Guardar/Generar activos',
      antes.tipo === 'GWI' && antes.guardar && antes.generar && antes.pesEditor, JSON.stringify(antes));
    const lab = U.cartuchoLaboratorio();
    lab.json.estilo = BaseDirector.datosCartucho().estilo;     // el GWC ha de ser de la máquina cargada
    const gwc = BaseCartucho.generarGWC(lab.json, lab.sprites, lab.pantalla);
    await U.cargarEn('ficheroGWC', [U.fichero('lab.gwc', gwc.bytes)], 1500);
    const despues = _estado();
    ok('D1: tras cargar el GWC el cartucho es el GWC', despues.tipo === 'GWC', JSON.stringify(despues));
    ok('D1: tras cargar el GWC no quedan Guardar/Generar ni Editor de la autoría del GWI',
      !despues.guardar && !despues.generar && !despues.pesEditor, JSON.stringify(despues));
    return out;
  }

  async function _pruebaD3() {
    const out = [];
    const ok = (n, c, x) => out.push([n, !!c, x === undefined ? '' : String(x)]);
    const etiquetas = () => [...document.querySelectorAll('.botonFisico .etiqueta')].map(e => e.textContent).join(',');
    await U.cargarEn('ficheroSetup', [U.fichero('setup2.json', await U.traerBytes('pruebas/cartuchos/setup2.json'))], 500);
    await U.cargarEn('ficheroGWBZip', [await _gwbModificado(() => { })], 2500);
    const bueno = _estado();
    ok('D3 (previo): el GWB bueno carga', bueno.tipo === 'GWB' && bueno.nombre === 'Parachute' && bueno.imgS, JSON.stringify(bueno));
    const nAntes = document.querySelectorAll('.botonFisico').length, eAntes = etiquetas();
    await U.cargarEn('ficheroGWBZip', [await _gwbModificado(j => { j.nombre = 'Malo'; j.botones.push({ numero: 99, id: 'X' }); })], 2500);
    const tras = _estado();
    const nTras = document.querySelectorAll('.botonFisico').length, eTras = etiquetas();
    ok('D3: el cartucho incompatible no carga y el anterior sigue siendo el cartucho', tras.nombre === 'Parachute' && tras.imgS, JSON.stringify(tras));
    ok('D3: la botonera sigue como la del cartucho anterior', nTras === nAntes && eTras === eAntes, nAntes + ' ' + eAntes + ' | ' + nTras + ' ' + eTras);
    ok('D3: el editor sigue disponible con el cartucho anterior', tras.pesEditor && tras.guardar !== undefined, JSON.stringify(tras));
    return out;
  }

  async function _pruebaD2() {
    const out = [];
    const ok = (n, c, x) => out.push([n, !!c, x === undefined ? '' : String(x)]);
    await U.cargarEn('ficheroSetup', [U.fichero('setup2.json', await U.traerBytes('pruebas/cartuchos/setup2.json'))], 500);
    // img_s completamente blanca: no hay nada que descomponer y la autoría no arranca
    await U.cargarEn('ficheroGWBZip', [await _gwbModificado(j => { j.nombre = 'SinS'; }, true)], 2500);
    const sin = _estado();
    ok('D2: un GWB cuya img_s no descompone no deja Guardar/Generar ni Editor habilitados',
      sin.nombre === 'SinS' && !sin.guardar && !sin.generar && !sin.pesEditor, JSON.stringify(sin));
    return out;
  }

  Pruebas.registrar([
    { id: 'd1', grupo: 'director', nombre: 'D1 GWC tras GWI', destructiva: true, ejecutar: (o) => _pruebaD1(o) },
    { id: 'd3', grupo: 'director', nombre: 'D3 cartucho incompatible', destructiva: true, ejecutar: () => _pruebaD3() },
    { id: 'd2', grupo: 'director', nombre: 'D2 GWB que no descompone', destructiva: true, ejecutar: () => _pruebaD2() }
  ]);
})();

if (typeof require !== 'undefined' && typeof module !== 'undefined' && require.main === module)
  require('./lanzador.js').lanzar('director');
