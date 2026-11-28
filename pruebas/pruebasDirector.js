// pruebas/pruebasDirector.js — Pruebas del DIRECTOR del editor (baseDirector): carga de cartuchos
// ================================================================================================
// PROPÓSITO
//   Cargan cartuchos por los inputs del diseñador, como si el usuario los eligiera, y comprueban
//   en qué estado queda el diseñador. TODAS sustituyen el cartucho cargado (el botón avisa).
//   Necesitan los cartuchos de ejemplo del proyecto (pruebas/cartuchos (setup2.json, cartucho_GWI.zip
//   y cartucho_GWB.zip), que leen por URL: index.html debe abrirse por un servidor local.
//
// PRUEBAS (grupo «director»)
//   D5  (F5-I19) Un GWC sin máquina previa NO carga y da un error claro. Requiere la página
//       RECIÉN cargada: debe ser la PRIMERA de la suite (y D6 la sigue).
//   D6  (F5-I19) Carga SIN setup: un GWB con estilo declarado y un GWI cargan y poblan Setup
//       y Cartucho; #estado avisa «Setup derivado del cartucho».
//   D1  Cargar un GWC tras un GWI no deja la autoría del GWI viva (editable, Guardar, Generar).
//   D2  Un cartucho que no arranca la autoría no deja habilitados Guardar, Generar ni el Editor.
//   D3  Un cartucho incompatible con la máquina NO destruye el cartucho que ya estaba cargado.
//   D4  (F5-I17) Cargar un GWB sobre un GWI con autoría avisa del historial que se descarta;
//       recargar el mismo GWI, no.
//   D7  (F5-I19) Cambio de máquina EN CALIENTE: tras un setup2, cargar un GWB de estilo 4
//       re-ajusta esqueleto, botonera, lienzo, sprites y título (y avisa de setup derivado).
//   D8  (F5-I19) El botón «Limpiar» de la Carga REINICIA: sin setup ni cartucho, máquina
//       oculta, pestaña Carga delante y las pestañas de datos deshabilitadas; repetido
//       sin nada cargado es idempotente y no rompe.
//   D9  (F5-I20) Aplicar/cargar un setup PROPAGA a la ficha de Cartucho todos los datos
//       comunes (nombre, memoria, ColorFondo + estilo/resolución); a la inversa, la
//       memoria del setup derivado sale del cartucho, subcampo a subcampo. Con
//       cartucho en memoria pide SIEMPRE confirmación (cancelar conserva, confirmar
//       aplica) y con GW_DEBUG no se pide (criterio D8).
//   D10 (F5-I21) Ajuste de resolución (modelo simple): SOLO cambia la resolución
//       declarada (setup, ficha y canvas del aparato); el JUEGO NO SE REESCALA nunca
//       (img_s, sprites y segmentos quedan igual: el emulador reescala al vuelo y el
//       GWC escala al generar). Fuera de rango (F5-I16) se rechaza sin tocar nada; la
//       ventana muestra actuales, nuevos, factor de escala y si afecta a los
//       segmentos; cancelar conserva todo.
//   D11 (A02) El fondo del GWC en el emulador: un GWC con Bloque 5 reconstruye la
//       img_f YA escalada y la pinta; el ColorFondo del Bloque 0 queda debajo.
//   D12 (F6-I03) La pestaña Generador: se habilita con un cartucho editable (como
//       el Editor); la ficha trae los selectores de Destino (Mega/ESP) y Etapa
//       (Prueba/Completa) y el botón Generar, que aún no genera nada (avisa de
//       que su contenido llega en F6-I04).
//
// FUNCIONES
//   _estado              Lo que ve el usuario: tipo y nombre del cartucho, botones y pestañas.
//   _gwbModificado       El GWB de ejemplo con el JSON y la imagen img_s cambiados (en memoria).
//   _pruebaD1 ... _pruebaD12
//                        Una función por prueba (D5/D6/D7/D8: F5-I19; D9: F5-I20;
//                        D10: F5-I21; D11: A02; D12: F6-I03).
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
    tipo: baseDirector.datosCartucho() ? baseDirector.datosCartucho().tipo : null,
    nombre: baseDirector.datosCartucho() ? baseDirector.datosCartucho().nombre : null,
    imgS: !!baseDirector.imagenSegmentos(),
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
    await U.cargarEn('ficheroCartucho', [U.fichero('setup4.json', await U.traerBytes(opc.setupUrl || 'pruebas/cartuchos/setup2.json'))], 500);
    await U.cargarEn('ficheroCartucho', [U.fichero('g.zip', await U.traerBytes(opc.gwiUrl || 'pruebas/cartuchos/cartucho_GWI.zip'))], 3500);
    const antes = _estado();
    ok('D1 (previo): con el GWI cargado hay autoría y Guardar/Generar activos',
      antes.tipo === 'GWI' && antes.guardar && antes.generar && antes.pesEditor, JSON.stringify(antes));
    const lab = U.cartuchoLaboratorio();
    lab.json.estilo = baseDirector.datosCartucho().estilo;     // el GWC ha de ser de la máquina cargada
    const gwc = baseCartucho.generarGWC(lab.json, lab.sprites, lab.pantalla);
    await U.cargarEn('ficheroCartucho', [U.fichero('lab.gwc', gwc.bytes)], 1500);
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
    await U.cargarEn('ficheroCartucho', [U.fichero('setup2.json', await U.traerBytes('pruebas/cartuchos/setup2.json'))], 500);
    await U.cargarEn('ficheroCartucho', [await _gwbModificado(() => { })], 2500);
    const bueno = _estado();
    ok('D3 (previo): el GWB bueno carga', bueno.tipo === 'GWB' && bueno.nombre === 'Parachute' && bueno.imgS, JSON.stringify(bueno));
    const nAntes = document.querySelectorAll('.botonFisico').length, eAntes = etiquetas();
    await U.cargarEn('ficheroCartucho', [await _gwbModificado(j => { j.nombre = 'Malo'; j.botones.push({ numero: 99, id: 'X' }); })], 2500);
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
    await U.cargarEn('ficheroCartucho', [U.fichero('setup2.json', await U.traerBytes('pruebas/cartuchos/setup2.json'))], 500);
    // img_s completamente blanca: no hay nada que descomponer y la autoría no arranca
    await U.cargarEn('ficheroCartucho', [await _gwbModificado(j => { j.nombre = 'SinS'; }, true)], 2500);
    const sin = _estado();
    ok('D2: un GWB cuya img_s no descompone no deja Guardar/Generar ni Editor habilitados',
      sin.nombre === 'SinS' && !sin.guardar && !sin.generar && !sin.pesEditor, JSON.stringify(sin));
    return out;
  }

  // F5-I17 (M3): cargar un cartucho no-GWI sobre un GWI con autoría descarta el historial: aviso.
  async function _pruebaD4() {
    const out = [];
    const ok = (n, c, x) => out.push([n, !!c, x === undefined ? '' : String(x)]);
    const estado = () => document.getElementById('estado').textContent;
    await U.cargarEn('ficheroCartucho', [U.fichero('setup2.json', await U.traerBytes('pruebas/cartuchos/setup2.json'))], 500);
    const bytes = await U.traerBytes('pruebas/cartuchos/cartucho_GWI.zip');
    await U.cargarEn('ficheroCartucho', [U.fichero('g.zip', bytes)], 3500);
    const antes = _estado();
    ok('D4 (previo): el GWI cargado tiene autoría y Guardar activo',
      antes.tipo === 'GWI' && antes.guardar, JSON.stringify(antes));
    await U.cargarEn('ficheroCartucho', [U.fichero('g.zip', bytes)], 3500);
    ok('D4: recargar el MISMO GWI no avisa de historial',
      !/descarta el historial/.test(estado()), estado());
    await U.cargarEn('ficheroCartucho', [await _gwbModificado(() => { })], 2500);
    const tras = _estado();
    ok('D4: cargar un GWB sobre un GWI con autoría avisa del historial descartado',
      /descarta el historial/.test(estado()) && /acción/.test(estado()), estado());
    ok('D4 (previo): el GWB ahora es el cartucho en memoria', tras.tipo === 'GWB', JSON.stringify(tras));
    return out;
  }

  // F5-I19 (PA4): un GWC sin máquina previa no carga, con error claro.
  // Requiere la PÁGINA RECIÉN cargada (sin setup ni cartucho derivado):
  // debe ser la PRIMERA de la suite; tras ella viene D6, que aprovecha
  // esa misma máquina-aún-no-cargada para probar la carga sin setup.
  async function _pruebaD5() {
    const out = [];
    const ok = (n, c, x) => out.push([n, !!c, x === undefined ? '' : String(x)]);
    const estado = () => document.getElementById('estado').textContent;
    const bytes = await U.traerBytes('pruebas/cartuchos/cartucho.GWC');
    await U.cargarEn('ficheroCartucho', [U.fichero('cartucho.GWC', bytes)], 1500);
    ok('D5: un GWC sin máquina previa NO carga con el error claro',
      /Cartucho NO cargado: falta la configuración de la máquina/.test(estado()), estado());
    ok('D5: no hay cartucho en memoria', _estado().tipo === null, estado());
    return out;
  }

  // F5-I19 (PA4): la carga SIN setup. Un GWB con estilo declarado y un
  // GWI cargan solos, crean la máquina y poblan las pestañas Setup y
  // Cartucho; #estado avisa de que el setup es derivado del cartucho.
  async function _pruebaD6() {
    const out = [];
    const ok = (n, c, x) => out.push([n, !!c, x === undefined ? '' : String(x)]);
    const estado = () => document.getElementById('estado').textContent;
    await U.cargarEn('ficheroCartucho',
      [U.fichero('gwb.zip', await U.traerBytes('pruebas/cartuchos/cartucho_GWB.zip'))], 2500);
    const s1 = _estado();
    ok('D6: un GWB con estilo carga SIN setup y crea la máquina',
      s1.tipo === 'GWB' && s1.nombre === 'Parachute' && s1.imgS, JSON.stringify(s1));
    ok('D6: las pestañas Setup y Cartucho quedan disponibles',
      !document.getElementById('pesSetup').disabled &&
      !document.getElementById('pesCartucho').disabled, estado());
    ok('D6: #estado avisa que el setup es derivado del cartucho',
      /Setup derivado del cartucho/.test(estado()), estado());
    await U.cargarEn('ficheroCartucho',
      [U.fichero('g.zip', await U.traerBytes('pruebas/cartuchos/cartucho_GWI.zip'))], 3500);
    const s2 = _estado();
    ok('D6: un GWI también carga sin setup y trae su autoría',
      s2.tipo === 'GWI' && s2.guardar && s2.generar, JSON.stringify(s2));
    return out;
  }

  // F5-I19 (PA4): EL PUNTO PENDIENTE — el cambio de máquina en caliente.
  // Tras un setup2 real, un GWB de estilo 4 re-ajusta TODO: esqueleto,
  // botonera, lienzo, sprites y título, y el setup mostrado pasa a ser
  // derivado del cartucho.
  async function _pruebaD7() {
    const out = [];
    const ok = (n, c, x) => out.push([n, !!c, x === undefined ? '' : String(x)]);
    const estado = () => document.getElementById('estado').textContent;
    await U.cargarEn('ficheroCartucho',
      [U.fichero('setup2.json', await U.traerBytes('pruebas/cartuchos/setup2.json'))], 500);
    ok('D7 (previo): la máquina es la del setup2 (maquina-2)',
      !document.getElementById('maquina-2').classList.contains('oculto'), estado());
    // Un GWB valedero de estilo 4 (con contenido negro: debe descomponer
    // para que Guardar/Generar y el Editor queden disponibles, como en D2).
    const lienzo = document.createElement('canvas');
    lienzo.width = 320; lienzo.height = 240;
    const g = lienzo.getContext('2d');
    g.fillStyle = '#fff'; g.fillRect(0, 0, 320, 240);
    g.fillStyle = '#000'; g.fillRect(10, 10, 40, 20);
    const png = await new Promise(r => lienzo.toBlob(r, 'image/png'));
    const gw4 = {
      tipo: 'GWB', version: 1, nombre: 'Estilo4', estilo: '4',
      resolucion: { ancho: 320, alto: 240 },
      imagenes: { img_s: 'img_s.png' },
      botones: [{ numero: 0, id: 'IZQ' }, { numero: 4, id: 'DER' }, { numero: 6, id: 'Start' }]
    };
    const zip = new JSZip();
    zip.file('estilo4.json', JSON.stringify(gw4));
    zip.file('img_s.png', await png.arrayBuffer());
    await U.cargarEn('ficheroCartucho',
      [U.fichero('estilo4.zip', await zip.generateAsync({ type: 'uint8array' }))], 2500);
    const s = _estado();
    ok('D7: el cartucho nuevo está cargado',
      s.tipo === 'GWB' && s.nombre === 'Estilo4', JSON.stringify(s));
    ok('D7: la máquina se re-ajusta en caliente (esqueleto del estilo 4)',
      !document.getElementById('maquina-4').classList.contains('oculto') &&
      document.getElementById('maquina-2').classList.contains('oculto'), '');
    ok('D7: el lienzo toma la resolución del cartucho',
      document.getElementById('pantalla').width === 320 &&
      document.getElementById('pantalla').height === 240, '');
    ok('D7: la botonera es la del estilo 4',
      document.querySelectorAll('#maquina-4 .botonFisico').length > 0 &&
      document.querySelectorAll('#maquina-2 .botonFisico').length === 0, '');
    ok('D7: img_s del cartucho cargado y autoría disponible',
      s.imgS && s.pesEditor, JSON.stringify(s));
    ok('D7: #estado avisa del setup derivado',
      /Setup derivado del cartucho/.test(estado()), estado());
    return out;
  }

  // F5-I20 (ajuste)/F5-I21: cargar un setup propaga a la ficha de Cartucho los datos
  // comunes (nombre, ColorFondo + estilo/resolución); la memoria vive en el Setup. Y con
  // un cartucho en memoria, «Aplicar» va EN CALIENTE: SIN confirmación y SIN descartar
  // nada (los datos comunes de la ficha se aplican al juego vivo).
  async function _pruebaD9() {
    const out = [];
    const ok = (n, c, x) => out.push([n, !!c, x === undefined ? '' : String(x)]);
    const estado = () => document.getElementById('estado').textContent;
    const gwb = () => baseFicha.estado();
    // 1) Un GWS con memoria/nombre/ColorFondo: la ficha de Cartucho los recibe.
    const setup = JSON.parse(new TextDecoder().decode(await U.traerBytes('pruebas/cartuchos/setup2.json')));
    setup.nombre = 'Memoria';
    setup.ColorFondo = '#AABBCC';
    setup.memoria = { RAM: 216, FLASH: 128 };
    await U.cargarEn('ficheroCartucho', [U.fichero('setup2.json', JSON.stringify(setup))], 500);
    ok('D9 (previo): el GWS cargó y no hay cartucho',
      _estado().tipo === null && baseDirector.datosCartucho() === null, JSON.stringify(_estado()));
    const e1 = gwb();
    ok('D9: el nombre del setup llega a la ficha de Cartucho', e1.nombre === 'Memoria', e1.nombre);
    // F5-I21: la memoria ya no está en la ficha de Cartucho: vive en el Setup.
    ok('D9: la memoria del setup (RAM/FLASH) vive en el Setup (no en la ficha)',
      JSON.stringify(baseDirector.datosSetup().memoria) === JSON.stringify({ RAM: 216, FLASH: 128 })
      && e1.memoria === undefined,
      JSON.stringify(baseDirector.datosSetup().memoria));
    ok('D9: el ColorFondo del setup llega a la ficha de Cartucho',
      e1.colorFondo === '#AABBCC', String(e1.colorFondo));
    ok('D9: estilo y resolución siguen llegando (como antes)',
      e1.estilo === '2' && e1.resolucion && e1.resolucion.ancho === 320, JSON.stringify(e1));
    // 2) A la inversa: la memoria del GWB pasa al setup derivado (subcampo a
    //    subcampo: su RAM 128 manda; la FLASH no la declara y sigue 128, del GWS).
    await U.cargarEn('ficheroCartucho',
      [await _gwbModificado(j => { j.memoria = { RAM: 128 }; })], 2500);
    const memDerivada = baseDirector.datosSetup().memoria;
    ok('D9: la memoria del GWB pasa al setup derivado (subcampo a subcampo)',
      JSON.stringify(memDerivada) === JSON.stringify({ RAM: 128, FLASH: 128 }),
      JSON.stringify(memDerivada));
    ok('D9 (previo): hay cartucho (Parachute) antes de aplicar',
      (_estado().tipo === 'GWB' && _estado().nombre === 'Parachute'), JSON.stringify(_estado()));
    // 2b) Con ese cartucho en memoria, «Aplicar» va EN CALIENTE (F5-I21):
    //     SIN confirmación (ni siquiera sin GW_DEBUG) y SIN descartar nada;
    //     los datos comunes de la ficha de Setup se aplican al juego vivo.
    const confirmadas = [];
    const confirmOriginal = window.confirm;
    const gwdOriginal = window.GW_DEBUG;
    window.GW_DEBUG = false;                        // aún así no debe pedir nada
    window.confirm = (m) => { confirmadas.push(String(m)); return false; };
    const inNombreSetup = [...document.querySelectorAll('#fichaSetup input[type=text]')][0];
    inNombreSetup.value = 'Memoria2';
    document.getElementById('btnAplicarSetup').click();
    await new Promise(r => setTimeout(r, 400));
    window.GW_DEBUG = gwdOriginal;
    window.confirm = confirmOriginal;
    ok('D9: con cartucho en memoria, aplicar NO pide confirmación',
      confirmadas.length === 0, confirmadas.join(' | '));
    ok('D9: aplicar en caliente conserva el cartucho y su autoría',
      _estado().tipo === 'GWB' && _estado().nombre === 'Parachute' && _estado().pesEditor,
      JSON.stringify(_estado()));
    ok('D9: #estado avisa de que el cartucho sigue en memoria',
      /el cartucho y su autoría siguen en memoria/.test(estado()), estado());
    ok('D9: el nombre tocado en la ficha llega al setup vigente',
      baseDirector.datosSetup().nombre === 'Memoria2',
      String(baseDirector.datosSetup().nombre));
    ok('D9: la memoria sigue en el Setup tras aplicar en caliente',
      JSON.stringify(baseDirector.datosSetup().memoria) === JSON.stringify({ RAM: 128, FLASH: 128 }),
      JSON.stringify(baseDirector.datosSetup().memoria));
    return out;
  }

  async function _pruebaD8() {
    const out = [];
    const ok = (n, c, x) => out.push([n, !!c, x === undefined ? '' : String(x)]);
    const estado = () => document.getElementById('estado').textContent;
    await U.cargarEn('ficheroCartucho',
      [U.fichero('setup2.json', await U.traerBytes('pruebas/cartuchos/setup2.json'))], 500);
    ok('D8 (previo): hay máquina y la pestaña Simulador está habilitada',
      !document.getElementById('maquina').classList.contains('oculto') &&
      !document.getElementById('pesSimulador').disabled, estado());
    document.getElementById('btnLimpiarCarga').click();
    await new Promise(r => setTimeout(r, 300));
    ok('D8: #estado queda en «Sin setup cargado.»',
      /Sin setup cargado/.test(estado()), estado());
    ok('D8: no queda cartucho en memoria', _estado().tipo === null, estado());
    ok('D8: la máquina queda oculta',
      document.getElementById('maquina').classList.contains('oculto'), '');
    ok('D8: la vista delante es la Carga',
      document.body.dataset.vista === 'vistaCarga' &&
      !document.getElementById('vistaCarga').classList.contains('oculto'), '');
    ok('D8: Cartucho y Simulador se deshabilitan',
      document.getElementById('pesCartucho').disabled &&
      document.getElementById('pesSimulador').disabled, '');
    // Segunda pulsación: sin confirmación previa (GW_DEBUG la omite) y
    // sin NADA que perder, Limpiar es idempotente y no rompe (F5-I19).
    document.getElementById('btnLimpiarCarga').click();
    await new Promise(r => setTimeout(r, 300));
    ok('D8: repetir Limpiar sin nada cargado no rompe (idempotente)',
      document.body.dataset.vista === 'vistaCarga' && _estado().tipo === null, estado());
    return out;
  }

  // F5-I21 (D10): el AJUSTE de resolución, modelo simple: SOLO cambia la
  // resolución declarada; el juego (img_s, sprites, posiciones) NO se toca
  // (el GWI conserva el origen; el emulador reescala al vuelo y el GWC
  // escala declarada/fuente al generar). La ventana es la confirmación; la
  // vía programática aplicarAjusteResolucion es lo que usan también C9 y E10.
  async function _pruebaD10() {
    const out = [];
    const ok = (n, c, x) => out.push([n, !!c, x === undefined ? '' : String(x)]);
    const estado = () => document.getElementById('estado').textContent;
    const crudos = (segs) => JSON.stringify(segs.filter(s => s.tipo < 5).map(s => [s.id, s.x, s.y]));
    // Previo: setup2 + GWI con autoría.
    await U.cargarEn('ficheroCartucho',
      [U.fichero('setup2.json', await U.traerBytes('pruebas/cartuchos/setup2.json'))], 500);
    await U.cargarEn('ficheroCartucho',
      [U.fichero('gwi.zip', await U.traerBytes('pruebas/cartuchos/cartucho_GWI.zip'))], 3500);
    ok('D10 (previo): el GWI cargó con juego en memoria',
      baseDescomponer.segmentos().length > 0 && baseDirector.datosCartucho() !== null,
      JSON.stringify(_estado()));
    const acciones = baseDescomponer.numeroDeCambios();
    const en320 = crudos(baseDescomponer.segmentos());
    const dimsBase = () => JSON.stringify(baseDescomponer.dimensionesBase());
    const dimsSprites = () => JSON.stringify(baseDescomponer.sprites().map(s => [s.id, s.ancho, s.alto]));
    const base320 = dimsBase(), sprites320 = dimsSprites();
    // 1. A la MISMA resolución no toca nada (y no pide nada).
    ok('D10: ajustar a la misma resolución no toca nada',
      baseDirector.aplicarAjusteResolucion(320, 240) === true &&
      crudos(baseDescomponer.segmentos()) === en320, '');
    // 2. Ajuste a 640×480: SOLO la resolución declarada cambia; el juego
    //    queda EXACTO (posiciones, sprites e img_s) — el GWI conserva el
    //    origen; el escalado lo hacen el emulador (al vuelo) y el GWC (al generar).
    ok('D10: ajustar a 640×480 se aplica',
      baseDirector.aplicarAjusteResolucion(640, 480) === true, estado());
    ok('D10: el juego no se reescala (posiciones exactas)',
      crudos(baseDescomponer.segmentos()) === en320, '');
    ok('D10: el juego no se reescala (sprites exactos)',
      dimsSprites() === sprites320, '');
    ok('D10: img_s no se reescala (espacio fuente intacto)',
      dimsBase() === base320, '');
    ok('D10: la autoría queda intacta (mismas acciones)',
      baseDescomponer.numeroDeCambios() === acciones, String(acciones));
    ok('D10: el setup declara la nueva resolución',
      baseDirector.datosSetup().resolucion.ancho === 640 &&
      baseDirector.datosSetup().resolucion.alto === 480,
      JSON.stringify(baseDirector.datosSetup().resolucion));
    ok('D10: la pantalla del aparato mide lo nuevo',
      document.getElementById('pantalla').width === 640 &&
      document.getElementById('pantalla').height === 480, 'canvas');
    const resolucionFicha = () => {
      const nums = [...document.querySelectorAll('#fichaCartucho input[type=number]')];
      return nums.length === 2 ? { ancho: Number(nums[0].value), alto: Number(nums[1].value) } : null;
    };
    ok('D10: la ficha de Cartucho muestra la nueva resolución',
      JSON.stringify(resolucionFicha()) === '{"ancho":640,"alto":480}',
      JSON.stringify(resolucionFicha()));
    // 3. Fuera de rango (F5-I16): se rechaza ANTES de tocar nada (atómico).
    ok('D10: fuera de rango (200×200) se rechaza sin tocar nada',
      baseDirector.aplicarAjusteResolucion(200, 200) === false &&
      baseDirector.datosSetup().resolucion.ancho === 640, estado());
    // 4. La ventana: contenido, fuera de rango deshabilita y cancelar conserva.
    baseDirector.ajustarResolucion();
    const vent = document.querySelector('.ventanaResolucion');
    ok('D10: la ventana abre con factor de escala y aviso de que el juego queda igual',
      vent && /Factor de escala/.test(vent.textContent) &&
        /NO se reescala/.test(vent.textContent) && /el GWC escala al generar/.test(vent.textContent),
      vent ? vent.textContent.slice(0, 100) : '(sin ventana)');
    const botonesVent = () => Array.from(vent.querySelectorAll('button'));
    let btnCancelar = botonesVent().find(b => b.textContent === 'Cancelar');
    ok('D10: la ventana tiene Cancelar y Ajustar resolución',
      btnCancelar && botonesVent().some(b => b.textContent === 'Ajustar resolución'), '');
    btnCancelar.click();
    ok('D10: cancelar cierra y conserva', !document.querySelector('.ventanaResolucion') &&
      baseDirector.datosSetup().resolucion.ancho === 640, '');
    baseDirector.ajustarResolucion();
    const vent2 = document.querySelector('.ventanaResolucion');
    const inputs = Array.from(vent2.querySelectorAll('input[type=number]'));
    inputs[0].value = '200'; inputs[1].value = '200';
    inputs[0].dispatchEvent(new Event('input', { bubbles: true }));
    inputs[1].dispatchEvent(new Event('input', { bubbles: true }));
    const btnFuera = Array.from(vent2.querySelectorAll('button'))
      .find(b => b.textContent === 'Ajustar resolución');
    ok('D10: fuera de rango la ventana deshabilita «Ajustar resolución»',
      btnFuera && btnFuera.disabled && /fuera del rango/.test(vent2.textContent), '');
    Array.from(vent2.querySelectorAll('button')).find(b => b.textContent === 'Cancelar').click();
    // 5. Vuelta a 320×240: el juego sigue exacto (nada se reescala nunca).
    baseDirector.aplicarAjusteResolucion(320, 240);
    ok('D10: vuelta a 320×240 con el juego exacto',
      crudos(baseDescomponer.segmentos()) === en320 && dimsBase() === base320 &&
      baseDirector.datosSetup().resolucion.ancho === 320, '');
    return out;
  }

  async function _pruebaD11() {
    const U = Pruebas.util;
    const out = [];
    const ok = (n, c, x) => out.push([n, !!c, x === undefined ? '' : String(x)]);
    // Máquina previa (el GWC la exige, D5) y GWC de laboratorio CON fondo
    // (160×120 → declarada 320×240: el generador escala el Bloque 5 ×2).
    await U.cargarEn('ficheroCartucho', [U.fichero('setup2.json', await U.traerBytes('pruebas/cartuchos/setup2.json'))], 500);
    const lab = U.cartuchoLaboratorio();
    lab.json.estilo = baseDirector.datosSetup().estilo;   // el GWC ha de ser de la máquina cargada
    const fondo = document.createElement('canvas');
    fondo.width = 160; fondo.height = 120;
    const g = fondo.getContext('2d');
    g.fillStyle = '#FFFFFF'; g.fillRect(0, 0, 160, 120);
    g.fillStyle = '#000'; g.fillRect(10, 10, 20, 10);
    const gwc = baseCartucho.generarGWC(lab.json, lab.sprites, lab.pantalla, fondo);
    await U.cargarEn('ficheroCartucho', [U.fichero('labFondo.gwc', gwc.bytes)], 2000);
    const estado = document.getElementById('estado').textContent;
    ok('D11: el GWC con Bloque 5 carga', /Cartucho cargado \(GWC\)/.test(estado), estado);
    const imgF = baseDirector.imagenFondo();
    ok('D11: el fondo reconstruido mide la pantalla declarada',
      !!imgF && (imgF.naturalWidth || imgF.width) === 320 &&
      (imgF.naturalHeight || imgF.height) === 240,
      imgF ? ((imgF.naturalWidth || imgF.width) + 'x' + (imgF.naturalHeight || imgF.height)) : '(sin fondo)');
    const lienzo = document.createElement('canvas');
    lienzo.width = 320; lienzo.height = 240;
    if (imgF) lienzo.getContext('2d').drawImage(imgF, 0, 0);
    const ctx = lienzo.getContext('2d');
    const negro = ctx.getImageData(30, 30, 1, 1).data;
    const claro = ctx.getImageData(5, 5, 1, 1).data;
    ok('D11: el cuadrado negro del fondo queda en su sitio (×2)',
      !!negro && negro[0] === 0 && !!claro && claro[0] === 255,
      negro && claro ? (negro[0] + '/' + claro[0]) : '(sin canvas)');
    ok('D11: el ColorFondo del Bloque 0 queda bajo el fondo',
      baseDirector.colorFondo() === '#FFFFFF', baseDirector.colorFondo());
    return out;
  }

  async function _pruebaD12() {
    const out = [];
    const ok = (n, c, x) => out.push([n, !!c, x === undefined ? '' : String(x)]);
    // Con un setup sin cartucho editable, la pestaña no está disponible.
    await U.cargarEn('ficheroCartucho', [U.fichero('setup2.json', await U.traerBytes('pruebas/cartuchos/setup2.json'))], 500);
    ok('D12: con solo el setup, la pestaña Generador está deshabilitada',
      document.getElementById('pesGenerador').disabled);
    // Con un GWI editable, se habilita y la ficha trae sus controles.
    await U.cargarEn('ficheroCartucho', [U.fichero('cartucho_GWI.zip', await U.traerBytes('pruebas/cartuchos/cartucho_GWI.zip'))], 3000);
    ok('D12: con un GWI editable, la pestaña Generador está habilitada',
      !document.getElementById('pesGenerador').disabled);
    document.getElementById('pesGenerador').click();
    ok('D12: la vista Generador queda delante',
      document.body.dataset.vista === 'vistaGenerador' &&
      !document.getElementById('vistaGenerador').classList.contains('oculto'),
      document.body.dataset.vista);
    ok('D12: la ficha trae los dos selectores y el botón',
      !!document.getElementById('genDestino') && !!document.getElementById('genEtapa') &&
      !!document.getElementById('btnGeneradorGenerar'));
    ok('D12: valores por defecto: destino Mega y etapa Prueba',
      baseGenerador.estado().destino === 'mega' && baseGenerador.estado().etapa === 'prueba',
      JSON.stringify(baseGenerador.estado()));
    document.getElementById('genDestino').value = 'esp';
    document.getElementById('genEtapa').value = 'completa';
    ok('D12: los selectores aceptan ESP y Completa',
      baseGenerador.estado().destino === 'esp' && baseGenerador.estado().etapa === 'completa',
      JSON.stringify(baseGenerador.estado()));
    document.getElementById('btnGeneradorGenerar').click();
    ok('D12: Generar aún no genera nada y avisa de que llega en F6-I04',
      /F6-I04/.test(document.getElementById('genNota').textContent),
      document.getElementById('genNota').textContent);
    return out;
  }

  Pruebas.registrar([
    // F5-I19: d5 y d6 necesitan la página RECIÉN cargada: d5 PRIMERO.
    { id: 'd5', grupo: 'director', nombre: 'D5 GWC sin máquina (requiere página recién cargada)', destructiva: false, ejecutar: () => _pruebaD5() },
    { id: 'd6', grupo: 'director', nombre: 'D6 carga sin setup (F5-I19)', destructiva: true, ejecutar: () => _pruebaD6() },
    { id: 'd1', grupo: 'director', nombre: 'D1 GWC tras GWI', destructiva: true, ejecutar: (o) => _pruebaD1(o) },
    { id: 'd3', grupo: 'director', nombre: 'D3 cartucho incompatible', destructiva: true, ejecutar: () => _pruebaD3() },
    { id: 'd2', grupo: 'director', nombre: 'D2 GWB que no descompone', destructiva: true, ejecutar: () => _pruebaD2() },
    { id: 'd4', grupo: 'director', nombre: 'D4 GWB sobre autoría', destructiva: true, ejecutar: () => _pruebaD4() },
    { id: 'd7', grupo: 'director', nombre: 'D7 cambio de máquina en caliente (F5-I19)', destructiva: true, ejecutar: () => _pruebaD7() },
    { id: 'd8', grupo: 'director', nombre: 'D8 botón Limpiar de la Carga (F5-I19)', destructiva: true, ejecutar: () => _pruebaD8() },
    { id: 'd9', grupo: 'director', nombre: 'D9 aplicar propaga datos comunes y confirma (F5-I20)', destructiva: true, ejecutar: () => _pruebaD9() },
    { id: 'd10', grupo: 'director', nombre: 'D10 ajuste de resolución (F5-I21)', destructiva: true, ejecutar: () => _pruebaD10() },
    { id: 'd11', grupo: 'director', nombre: 'D11 fondo del GWC en el emulador (A02)', destructiva: true, ejecutar: () => _pruebaD11() },
    { id: 'd12', grupo: 'director', nombre: 'D12 la pestaña Generador (F6-I03)', destructiva: true, ejecutar: () => _pruebaD12() }
  ]);
})();

if (typeof require !== 'undefined' && typeof module !== 'undefined' && require.main === module)
  require('./lanzador.js').lanzar('director');
