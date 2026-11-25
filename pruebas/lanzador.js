// pruebas/lanzador.js — Lanzador común de las pruebas de consola (Node + Playwright)
// ================================================================================================
// PROPÓSITO
//   Lo usan los cinco ficheros de pruebas (pruebasMotor.js, pruebasDirector.js, pruebasEditor.js,
//   pruebasGenerales.js y pruebasGWI_GWC.js): sirven el proyecto por un servidor local, abren
//   index.html en Chromium, ejecutan en la página las pruebas de un grupo (las mismas que los
//   botones de la pestaña «Pruebas», definidas en pruebas/pruebas.js y en cada fichero de
//   pruebas) y las muestran por consola. Termina con «RESULTADO: OK» o «RESULTADO: ERROR» y con
//   código de salida 0 o 1.
//   Para el grupo «editor» sirve una COPIA temporal del proyecto con baseDescomponer.js parcheado
//   para exportar sus interiores (lista en pruebasEditor.js); el código real no cambia.
//
// FUNCIONES
//   _servidor                  Servidor estático mínimo de una carpeta (con ficheros sustitutos);
//                              público como «servidor»: lo usa también pruebas/servidor.js.
//   _copiaParcheada            Copia del proyecto con los interiores de BaseDescomponer (editor).
//   _comparar                  Compara las partidas grabadas con las de referencia (COMPARAR).
//   _lanzar                    Lanza un grupo de pruebas y termina el proceso con su código.
//   lanzar                     Igual, y convierte cualquier excepción en «RESULTADO: ERROR».
//
// OPCIONES (variables de entorno y argumentos)
//   argumentos: [setup.json] [gwi.zip]    Sustituyen a los de pruebas/cartuchos (setup2.json y
//                                         cartucho_GWI.zip).
//   SEMILLAS=1,6699   TICKS=400   SIN_PULSAR=1     Para las pruebas de juego.
//   GRABAR=fichero    Guarda las partidas jugadas.   COMPARAR=fichero   Las compara con las guardadas.
// ================================================================================================
'use strict';
const http = require('http');
const fs = require('fs');
const path = require('path');

const RAIZ = path.resolve(__dirname, '..');
const MIME = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json', '.css': 'text/css', '.png': 'image/png',
  '.zip': 'application/zip'
};

/**
 * Servidor estático de una carpeta (solo 127.0.0.1). Lo usa el lanzador de pruebas y
 * pruebas/servidor.js (el servidor.bat que abre index.html por http en el navegador).
 * @param {string} raiz - Carpeta a servir.
 * @param {Object} [sustitutos] - URL → fichero ajeno a la carpeta (para las copias de pruebas).
 * @param {number} [puerto=0] - Puerto pedido; 0 = el primero libre que asigne el sistema.
 * @returns {Promise<http.Server>} El servidor; rechaza si el puerto pedido está ocupado.
 */
function _servidor(raiz, sustitutos, puerto) {
  return new Promise((resolver, rechazar) => {
    const s = http.createServer((rq, rs) => {
      const p = decodeURIComponent(rq.url.split('?')[0]);
      const f = sustitutos[p] || path.join(raiz, p === '/' ? 'index.html' : p);
      if (!sustitutos[p] && !path.resolve(f).startsWith(raiz)) { rs.writeHead(403); return rs.end(); }
      fs.readFile(f, (e, d) => {
        if (e) { rs.writeHead(404); return rs.end(); }
        rs.writeHead(200, { 'Content-Type': MIME[path.extname(f).toLowerCase()] || 'application/octet-stream' });
        rs.end(d);
      });
    });
    s.on('error', rechazar);
    s.listen(puerto || 0, '127.0.0.1', () => resolver(s));
  });
}

/**
 * Copia el proyecto a una carpeta temporal y parchea baseDescomponer.js para que exporte un
 * objeto «_t» con los interiores que piden las pruebas del editor.
 * @returns {string} Carpeta de la copia.
 */
function _copiaParcheada() {
  const os = require('os');
  const { interiores } = require('./pruebasEditor.js');
  const copia = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'gwE_')), 'p');
  const EXCLUIR = ['.git', 'node_modules', 'GW Iteraciones', 'GW Memoria'];
  fs.cpSync(RAIZ, copia, {
    recursive: true,
    filter: (origen) => !EXCLUIR.includes(path.relative(RAIZ, origen).split(path.sep)[0])
  });
  const f = path.join(copia, 'designer', 'baseDescomponer.js');
  // Normales CRLF a LF: en un árbol de trabajo de Windows (autocrlf) los
  // finales del fichero pueden ser \r\n y la marca con \n no casaría.
  let src = fs.readFileSync(f, 'utf8').replace(/\r\n/g, '\n');
  const marca = '  return {\n    arrancar: arrancar,';
  if (!src.includes(marca)) throw new Error('No encuentro el return de baseDescomponer.js');
  let t = '  return {\n    _t: {\n      _sel: (g) => { seleccion = g; },\n      _mostrarPanel: _mostrarPanel,\n';
  for (const n of interiores.nombres) t += '      ' + n + ': () => ' + n + ',\n';
  for (const n of interiores.funciones)
    t += '      ' + n + ': (typeof ' + n + " === 'function') ? " + n + ' : undefined,\n';
  t += '    },\n    arrancar: arrancar,';
  fs.writeFileSync(f, src.replace(marca, t));
  return copia;
}

function _comparar(datos, ruta) {
  const ref = JSON.parse(fs.readFileSync(ruta, 'utf8'));
  for (const prueba of Object.keys(datos)) {
    for (const sem of Object.keys(datos[prueba])) {
      const a = (ref[prueba] || {})[sem] || [], b = datos[prueba][sem];
      let t = -1;
      for (let i = 0; i < Math.max(a.length, b.length); i++) if (a[i] !== b[i]) { t = i; break; }
      console.log('Referencia ' + prueba + ' (semilla ' + sem + '): ' +
        (t < 0 ? 'IGUAL' : 'DIFIERE desde el tick ' + (t + 1) + ' (' + a.length + ' → ' + b.length + ' ticks)'));
    }
  }
}

/**
 * Lanza todas las pruebas de un grupo y termina el proceso (código 1 si hay fallos).
 * @param {string} grupo - 'motor', 'director', 'generales' o 'gwi_gwc'.
 * @returns {Promise<void>}
 */
async function _lanzar(grupo) {
  const { chromium } = require('playwright');
  const CART = path.join(RAIZ, 'pruebas', 'cartuchos');
  const setup = process.argv[2] ? path.resolve(process.argv[2]) : path.join(CART, 'setup2.json');
  const gwi = process.argv[3] ? path.resolve(process.argv[3]) : path.join(CART, 'cartucho_GWI.zip');
  const raiz = grupo === 'editor' ? _copiaParcheada() : RAIZ;
  const srv = await _servidor(raiz, { '/__setup.json': setup, '/__gwi.zip': gwi });
  const nav = await chromium.launch();
  const pg = await nav.newPage();
  const errPag = [];
  pg.on('pageerror', e => errPag.push(e.message));
  await pg.goto('http://127.0.0.1:' + srv.address().port + '/index.html');

  const lista = await pg.evaluate((g) => Pruebas.listar(g), grupo);
  const opciones = {
    setupUrl: '__setup.json', gwiUrl: '__gwi.zip',
    ticks: Number(process.env.TICKS) || 400,
    semillas: (process.env.SEMILLAS || '1,6699,48879,32767,4660').split(',').map(Number),
    sinPulsar: !!process.env.SIN_PULSAR
  };
  if (lista.some(t => t.necesita === 'gwi')) {
    await pg.setInputFiles('#ficheroCartucho', setup);
    await pg.waitForTimeout(500);
    await pg.setInputFiles('#ficheroCartucho', gwi);
    await pg.waitForTimeout(3500);
  }

  let fallos = 0;
  for (const t of lista) {
    console.log('== ' + t.nombre);
    let res;
    try { res = await pg.evaluate(([id, o]) => Pruebas.ejecutar(id, o), [t.id, opciones]); }
    catch (e) { console.log('FALLO la prueba lanzó una excepción  -> ' + e.message); fallos++; continue; }
    if (res === null) { console.log('SIN DATOS (necesita ' + t.necesita + ')'); fallos++; continue; }
    for (const [n, c, x] of res) {
      console.log((c ? 'OK    ' : 'FALLO ') + n + (c || !x ? '' : '  -> ' + x));
      if (!c) fallos++;
    }
  }
  const datos = await pg.evaluate(() => Pruebas.datos);
  if (process.env.GRABAR) fs.writeFileSync(process.env.GRABAR, JSON.stringify(datos));
  if (process.env.COMPARAR) _comparar(datos, process.env.COMPARAR);
  if (errPag.length) { console.log('Errores de página:', errPag); fallos++; }
  console.log(fallos ? 'RESULTADO: ERROR (' + fallos + ' fallo(s))' : 'RESULTADO: OK');
  await nav.close();
  srv.close();
  if (raiz !== RAIZ) fs.rmSync(path.dirname(raiz), { recursive: true, force: true });
  process.exit(fallos ? 1 : 0);
}

/**
 * Igual que _lanzar, pero cualquier excepción (Playwright sin instalar, navegador que no
 * arranca, error del servidor) también acaba en «RESULTADO: ERROR» y código de salida 1.
 * @param {string} grupo
 * @returns {Promise<void>}
 */
async function lanzar(grupo) {
  try { await _lanzar(grupo); }
  catch (e) {
    console.log('RESULTADO: ERROR (' + (e && e.message ? e.message.split('\n')[0] : e) + ')');
    process.exit(1);
  }
}

module.exports = { lanzar: lanzar, servidor: _servidor, raiz: RAIZ };
