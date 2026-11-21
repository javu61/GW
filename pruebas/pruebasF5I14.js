// pruebas/pruebasF5I14.js — F5-I14 «Cambios menores»
// ================================================================================================
// Comprueba: (1) CRC-16/CCITT del GWC (vector «123456789» = 0x29B1 y detección de intercambios);
// (2) ColorFondo: ida y vuelta GWC, JSON del GWB/GWI y pintado del simulador sin img_f;
// (3) lector GWC: errores claros ante índices fuera de rango y mecanismo de fin desconocido
//     (con el CRC recalculado, para que lo único que falle sea la validación nueva);
// (4) img_f del GWI escalada al tamaño del Setup.
// USO: NODE_PATH=$(npm root -g) node pruebas/pruebasF5I14.js [setup.json] [gwi.zip]
// ================================================================================================
'use strict';
const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');
const RAIZ = path.resolve(__dirname, '..');
const SETUP = process.argv[2] || path.join(RAIZ, 'setup4.json');
const GWI = process.argv[3] || path.join(RAIZ, 'cartucho_gwi.zip');

(async () => {
  const nav = await chromium.launch();
  const pg = await nav.newPage();
  const errPag = [];
  pg.on('pageerror', e => errPag.push(e.message));
  await pg.goto('file://' + RAIZ + '/index.html');
  await pg.setInputFiles('#ficheroSetup', SETUP);
  await pg.waitForTimeout(400);
  await pg.setInputFiles('#ficheroGWIZip', GWI);
  await pg.waitForTimeout(3500);

  // Montaje de un cartucho mínimo propio (independiente del ejemplo): 2 sprites, 3 segmentos.
  const res = await pg.evaluate(() => {
    const out = [];
    const ok = (n, c, x) => out.push([n, !!c, x === undefined ? '' : String(x)]);
    const mk = (w, h) => { const c = document.createElement('canvas'); c.width = w; c.height = h; const g = c.getContext('2d'); g.fillStyle = '#000'; g.fillRect(0, 0, w, h); return c; };
    const sprites = [{ id: 'img_000', ancho: 8, alto: 8, imagen: mk(8, 8) }, { id: 'img_001', ancho: 8, alto: 8, imagen: mk(8, 8) }];
    const j = {
      tipo: 'GWI', version: 1, nombre: 'p', estilo: '4', resolucion: { ancho: 100, alto: 80 },
      sprites: sprites.map(s => ({ id: s.id, ancho: 8, alto: 8, fichero: 'segmentos/' + s.id + '.png' })),
      segmentos: [
        { id: 'seg_000', tipo: 1, x: 0, y: 0, sprite: 'img_000', siguiente: 'seg_001' },
        { id: 'seg_001', tipo: 1, x: 10, y: 0, sprite: 'img_001' },
        { id: 'seg_002', tipo: 1, x: 20, y: 0, sprite: 'img_001' }
      ],
      secuencia: { ticks: 2, segmentos: ['seg_000', 'seg_001'] },
      fin: { mecanismo: 'vida' }
    };
    const pant = { ancho: 100, alto: 80, fuente: { ancho: 100, alto: 80 } };
    // (1) CRC
    const g0 = BaseCartucho.generarGWC(j, sprites, pant);
    ok('GWC genera y se lee', BaseCartucho.leerGWC(g0.bytes).segmentos.length === 3);
    const b = g0.bytes.slice();
    // intercambio de dos bytes del cuerpo con suma aditiva idéntica
    let i1 = -1, i2 = -1;
    for (let i = 14; i < b.length && i2 < 0; i++) for (let k = i + 1; k < b.length; k++) if (b[i] !== b[k]) { i1 = i; i2 = k; break; }
    const t = b[i1]; b[i1] = b[i2]; b[i2] = t;
    let msg = ''; try { BaseCartucho.leerGWC(b); } catch (e) { msg = e.message; }
    ok('CRC detecta bytes intercambiados (la suma aditiva no)', /CRC/.test(msg), msg);
    // (2) ColorFondo
    ok('fondo por defecto blanco', BaseCartucho.leerGWC(g0.bytes).fondo === '#FFFFFF');
    const g1 = BaseCartucho.generarGWC(Object.assign({}, j, { ColorFondo: '#336699' }), sprites, pant);
    ok('ColorFondo viaja al GWC', BaseCartucho.leerGWC(g1.bytes).fondo === '#336699', BaseCartucho.leerGWC(g1.bytes).fondo);
    ok('ColorFondo cambia el código del GWC', g0.codigo !== g1.codigo);
    // (3) lector: reparar CRC tras corromper
    const crc = (bytes) => {
      let c = 0xFFFF;
      for (const x of bytes) { c ^= x << 8; for (let k = 0; k < 8; k++) c = (c & 0x8000) ? ((c << 1) ^ 0x1021) & 0xFFFF : (c << 1) & 0xFFFF; }
      return c;
    };
    const reparar = (bytes) => {
      const txt = '#' + crc(bytes.subarray(14)).toString(16).toUpperCase().padStart(4, '0') + '#';
      for (let k = 0; k < 6; k++) bytes[4 + k] = txt.charCodeAt(k);
      return bytes;
    };
    ok('CRC del test = CRC del módulo', g0.codigo === '#' + crc(g0.bytes.subarray(14)).toString(16).toUpperCase().padStart(4, '0') + '#');
    ok('vector 123456789 = 0x29B1', crc(new TextEncoder().encode('123456789')) === 0x29B1);
    const falla = (nombre, mut, re) => {
      const c = g0.bytes.slice(); mut(c); reparar(c);
      let m = ''; try { BaseCartucho.leerGWC(c); } catch (e) { m = e.message; }
      ok(nombre, re.test(m), m || '(no falló)');
    };
    const dv = new DataView(g0.bytes.buffer);
    const dir = (n) => dv.getUint32(14 + 5 + 11 + n * 4, true);   // cabecera 14 + cab. bloque 5 + offset de direcciones
    const regSeg0 = dir(3) + 5;                                    // inicio del contenido del Bloque 3
    falla('sprite fuera de rango', c => { c[regSeg0 + 5] = 9; }, /sprite 9/);
    falla('enlace fuera de rango', c => { c[regSeg0 + 6] = 50; }, /segmento 50/);
    const secIni = dir(4) + 5;
    falla('Secuencia con segmento fuera de rango', c => { c[secIni + 1] = 77; }, /Secuencia usa el segmento 77/);
    const cfgIni = dir(1) + 5;
    falla('mecanismo de fin desconocido', c => { c[cfgIni + 12] = 9; c[cfgIni + 13] = 0; }, /fin desconocido/);
    falla('tabla de sprites que no cabe', c => { c[14 + 5 + 5] = 250; }, /sprite|segmento/);
    return out;
  });

  // (2b) GWI con ColorFondo: pinta ese color; la ficha lo recoge
  await pg.evaluate(() => {
    const f = BaseFicha; f.poblar({ colorFondo: '#336699' });
  });
  const ficha = await pg.evaluate(() => ({ e: BaseFicha.estado().colorFondo, d: BaseFicha.datosCartucho().colorFondo }));
  const extra = [];
  extra.push(['la ficha entrega ColorFondo', ficha.e === '#336699' && ficha.d === '#336699', JSON.stringify(ficha)]);
  await pg.evaluate(() => BaseFicha.poblar({ colorFondo: '#ffffff' }));
  extra.push(['blanco no viaja', await pg.evaluate(() => BaseFicha.estado().colorFondo === null)]);

  // (2c) cargar un GWB sin img_f y con ColorFondo: el canvas se pinta de ese color
  const png64 = await pg.evaluate(() => {
    const c = document.createElement('canvas'); c.width = 40; c.height = 30;
    const g = c.getContext('2d'); g.fillStyle = '#fff'; g.fillRect(0, 0, 40, 30);
    return c.toDataURL('image/png').split(',')[1];
  });
  const jsonGWB = { tipo: 'GWB', version: 1, nombre: 'cf', estilo: '2', ColorFondo: '#336699', imagenes: { img_s: 'img_s.png' }, botones: [] };
  const dir = fs.mkdtempSync('/tmp/gwb_');
  fs.writeFileSync(path.join(dir, 'cartucho_GWB.json'), JSON.stringify(jsonGWB));
  fs.writeFileSync(path.join(dir, 'img_s.png'), Buffer.from(png64, 'base64'));
  await pg.setInputFiles('#carpetaCartucho', dir);
  await pg.waitForTimeout(1500);
  const pintado = await pg.evaluate(() => ({
    px: Array.from(document.getElementById('pantalla').getContext('2d').getImageData(2, 2, 1, 1).data),
    cf: BaseDirector.colorFondo(), ficha: BaseFicha.estado().colorFondo
  }));
  extra.push(['GWB sin img_f guarda y pinta el ColorFondo', pintado.cf === '#336699' && pintado.ficha === '#336699', JSON.stringify(pintado)]);

  let fallos = 0;
  for (const [n, c, x] of [...res, ...extra]) { console.log((c ? 'OK   ' : 'FALLO') + ' ' + n + (c ? '' : '  -> ' + x)); if (!c) fallos++; }
  if (errPag.length) { console.log('Errores de página:', errPag); fallos++; }
  console.log(fallos === 0 ? 'TODO OK' : fallos + ' fallo(s)');
  await nav.close();
  process.exit(fallos ? 1 : 0);
})();
