// pruebas/equivalenciaGWC.js — F5-I13
// ================================================================================================
// PROPÓSITO
//   Comprueba que un GWC generado desde un GWI es EQUIVALENTE a él: mismos datos de configuración
//   y mismo juego. Es la prueba del principio de F5-I13: «el juego debe funcionar igual cargando
//   el GWI o el GWC del que sale».
//
// QUÉ HACE
//   1. Carga el setup y el GWI en el diseñador (Playwright, Chromium).
//   2. Genera con BaseCartucho.generarGWC el GWC del GWI, sin escalar (pantalla = fuente).
//   3. DATOS: relee el GWC con leerGWC y compara la configuración (pausas, aceleración, rutas,
//      fin, secuencia) y cada campo de cada segmento que lee el motor con los del GWI.
//   4. JUEGO: ejecuta N ticks con el GWI y N con el GWC (mismo arranque, mismo generador de
//      aleatorios, reloj sustituido por una cola que se vacía a mano) y compara, tick a tick,
//      qué segmentos están encendidos.
//
// USO
//   NODE_PATH=$(npm root -g) node pruebas/equivalenciaGWC.js [setup.json] [gwi.zip] [ticks]
//   VARIANTE=1 declara además rutas, aceleración, pausas y regla «combinar» (que el cartucho de
//   ejemplo no usa) y comprueba solo los DATOS: así se prueba que también viajan los valores
//   declarados, no solo los ausentes.
//   Sale con código 1 si hay alguna diferencia.
// ================================================================================================
'use strict';
const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');
const { execFileSync } = require('child_process');

const RAIZ = path.resolve(__dirname, '..');
const SETUP = process.argv[2] || path.join(RAIZ, 'setup4.json');
const GWI = process.argv[3] || path.join(RAIZ, 'cartucho_gwi.zip');
const TICKS = Number(process.argv[4]) || 400;

function jsonDelGWI(zip) {
  const dir = fs.mkdtempSync('/tmp/gwi_');
  execFileSync('unzip', ['-q', '-o', zip, '-d', dir]);
  const f = fs.readdirSync(dir).find(n => n.endsWith('.json'));
  return JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8'));
}

(async () => {
  const json = jsonDelGWI(GWI);
  const VARIANTE = !!process.env.VARIANTE;
  if (VARIANTE) {
    json.rutas = { aumentarCada: 3 };
    json.aceleracion = { cada: 5, resta: 20, minimo: 100 };
    json.pausas = { simulador: 300, externo: 250 };
    json.combinar = true;
  }
  const navegador = await chromium.launch();
  const pg = await navegador.newPage();
  const errores = [];
  pg.on('pageerror', e => errores.push(e.message));
  // El reloj del simulador pasa a una cola que vaciamos a mano (tick a tick, sin esperas).
  await pg.addInitScript(() => {
    window.__cola = [];
    const real = window.setTimeout.bind(window);
    window.setTimeout = (f, ms, ...a) => {
      if (typeof ms === 'number' && ms >= 100 && f && f.name === '_tick') { window.__cola.push(f); return 1; }
      return real(f, ms, ...a);
    };
  });
  await pg.goto('file://' + RAIZ + '/index.html');
  await pg.setInputFiles('#ficheroSetup', SETUP);
  await pg.waitForTimeout(400);

  // --- Genera el GWC desde las listas del GWI cargado ---
  await pg.setInputFiles('#ficheroGWIZip', GWI);
  await pg.waitForTimeout(3500);
  const gwcBytes = await pg.evaluate((j) => {
    const pantalla = {
      ancho: j.resolucion.ancho, alto: j.resolucion.alto,
      fuente: { ancho: j.resolucion.ancho, alto: j.resolucion.alto }
    };
    const gwc = BaseCartucho.generarGWC(j, BaseDescomponer.sprites(), pantalla);
    return Array.from(gwc.bytes);
  }, json);
  fs.writeFileSync('/tmp/t_equiv.gwc', Buffer.from(gwcBytes));

  // --- DATOS: GWI frente a lo que lee leerGWC ---
  const difs = await pg.evaluate(({ j, bytes }) => {
    const l = BaseCartucho.leerGWC(new Uint8Array(bytes));
    const d = [];
    const igual = (a, b) => JSON.stringify(a) === JSON.stringify(b);
    const nz = (o) => (o === undefined ? null : o);
    const nn = (v) => (v === undefined || v === null) ? null : Number(v);
    // Configuración: «sin declarar» en el GWI debe seguir siendo «sin declarar» en el GWC.
    if (!igual(nz(j.pausas && j.pausas.simulador), nz(l.pausas && l.pausas.simulador)))
      d.push('pausas.simulador: GWI=' + JSON.stringify(j.pausas && j.pausas.simulador) + ' GWC=' + JSON.stringify(l.pausas && l.pausas.simulador));
    if (!igual(nz(j.pausas && j.pausas.externo), nz(l.pausas && l.pausas.externo)))
      d.push('pausas.externo: GWI=' + JSON.stringify(j.pausas && j.pausas.externo) + ' GWC=' + JSON.stringify(l.pausas && l.pausas.externo));
    if (!igual(nz(j.aceleracion), nz(l.aceleracion))) d.push('aceleracion: GWI=' + JSON.stringify(j.aceleracion) + ' GWC=' + JSON.stringify(l.aceleracion));
    if (!igual(nz(j.rutas && j.rutas.aumentarCada), nz(l.rutas && l.rutas.aumentarCada)))
      d.push('rutas.aumentarCada: GWI=' + JSON.stringify(j.rutas && j.rutas.aumentarCada) + ' GWC=' + JSON.stringify(l.rutas && l.rutas.aumentarCada));
    if (!igual(nz(j.fin && j.fin.mecanismo), nz(l.fin && l.fin.mecanismo))) d.push('fin.mecanismo');
    if (!igual(nz(j.fin && j.fin.contador), nz(l.fin && l.fin.contador))) d.push('fin.contador');
    if (!!j.combinar !== !!l.combinar) d.push('combinar: GWI=' + !!j.combinar + ' GWC=' + !!l.combinar);
    // Segmentos que viajan (sin fantasmas ni absorbidos), en orden.
    const viaja = j.segmentos.filter(s => s.tipo !== 99 && !s.fusionadoPor);
    if (viaja.length !== l.segmentos.length) d.push('nº de segmentos: GWI=' + viaja.length + ' GWC=' + l.segmentos.length);
    const idx = new Map(viaja.map((s, i) => [s.id, i]));
    const enlace = (id) => (id === undefined || id === null) ? null : (idx.has(id) ? idx.get(id) : 'x:' + id);
    const ENL = ['siguiente', 'salvado', 'muerte', 'mostrarJunto', 'izquierda', 'derecha', 'arriba', 'abajo', 'colision',
      'barra_a', 'barra_b', 'barra_c', 'barra_d', 'barra_e', 'barra_f', 'barra_g', 'digito_1', 'digito_2', 'digito_3', 'digito_4'];
    viaja.forEach((s, i) => {
      const g = l.segmentos[i]; if (!g) return;
      const cmp = (campo, a, b) => { if (!igual(nz(a), nz(b))) d.push(s.id + '.' + campo + ': GWI=' + JSON.stringify(a) + ' GWC=' + JSON.stringify(b)); };
      cmp('tipo', s.tipo, g.tipo); cmp('x', s.x, g.x); cmp('y', s.y, g.y);
      for (const c of ENL) cmp(c, enlace(s[c]), enlace(g[c]) === null ? null : g[c] === undefined ? null : parseInt(String(g[c]).replace(/\D/g, ''), 10));
      cmp('salvadoContador', nn(s.salvadoContador), g.salvadoContador);
      cmp('muerteContador', nn(s.muerteContador), g.muerteContador);
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
  }, { j: json, bytes: gwcBytes });

  // --- JUEGO: N ticks con cada cartucho y comparación tick a tick ---
  const jugar = async (cargar) => {
    await cargar();
    await pg.click('#pesSimulador');
    await pg.evaluate(() => { window.__cola.length = 0; });
    await pg.keyboard.press('z');                       // A = Start
    await pg.waitForTimeout(100);
    return pg.evaluate((n) => {
      const hist = [];
      for (let t = 0; t < n; t++) {
        const f = window.__cola.shift(); if (!f) break;
        f();
        hist.push(ComunListas.segmentos().filter(s => s.tipo !== 99 && !s.fusionadoPor)
          .map(s => (s.visible ? '1' : '0')).join(''));
      }
      return hist;
    }, TICKS);
  };
  if (VARIANTE) {
    console.log('Datos: ' + (difs.length === 0 ? 'IGUALES (variante con rutas, aceleración, pausas y combinar)' : difs.length + ' diferencia(s)'));
    for (const x of difs.slice(0, 40)) console.log('  - ' + x);
    await navegador.close();
    process.exit(difs.length === 0 && errores.length === 0 ? 0 : 1);
  }
  const histGWI = await jugar(async () => { await pg.setInputFiles('#ficheroGWIZip', GWI); await pg.waitForTimeout(3500); });
  const histGWC = await jugar(async () => {
    await pg.setInputFiles('#ficheroGWC', { name: 'equiv.gwc', mimeType: 'application/octet-stream', buffer: Buffer.from(gwcBytes) });
    await pg.waitForTimeout(1500);
  });
  let primera = -1;
  const n = Math.min(histGWI.length, histGWC.length);
  for (let t = 0; t < n; t++) if (histGWI[t] !== histGWC[t]) { primera = t; break; }

  console.log('Datos: ' + (difs.length === 0 ? 'IGUALES' : difs.length + ' diferencia(s)'));
  for (const x of difs.slice(0, 40)) console.log('  - ' + x);
  console.log('Juego: ' + histGWI.length + ' ticks con el GWI, ' + histGWC.length + ' con el GWC; ' +
    (primera < 0 && histGWI.length === histGWC.length ? 'IGUAL tick a tick' : 'primera diferencia en el tick ' + (primera < 0 ? n + 1 : primera + 1)));
  if (errores.length) console.log('Errores de página:', errores);
  await navegador.close();
  process.exit(difs.length === 0 && primera < 0 && histGWI.length === histGWC.length && errores.length === 0 ? 0 : 1);
})();
