// pruebas/pruebasDirector.js — F5-I15, bloque Director (D1-D3)
// ================================================================================================
// D1: cargar un GWC tras un GWI no deja la autoría del GWI viva (editable, Guardar/Generar).
// D2: un cartucho que no arranca la autoría no deja los botones de autoría habilitados.
// D3: un cartucho incompatible con la máquina NO destruye el cartucho que ya estaba cargado.
// USO: NODE_PATH=$(npm root -g) node pruebas/pruebasDirectorF5I15.js
// ================================================================================================
'use strict';
const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');
const os = require('os');
const RAIZ = path.resolve(__dirname, '..');
const res = [];
const ok = (n, c, x) => res.push([n, !!c, x === undefined ? '' : String(x)]);

(async () => {
  const nav = await chromium.launch();
  const pg = await nav.newPage();
  const errPag = [];
  pg.on('pageerror', e => errPag.push(e.message));
  await pg.goto('file://' + RAIZ + '/index.html');
  const cargar = async (sel, ruta, esperar) => { await pg.setInputFiles(sel, ruta); await pg.waitForTimeout(esperar || 1500); };
  const estado = () => pg.evaluate(() => ({
    tipo: BaseDirector.datosCartucho() ? BaseDirector.datosCartucho().tipo : null,
    nombre: BaseDirector.datosCartucho() ? BaseDirector.datosCartucho().nombre : null,
    imgS: !!BaseDirector.imagenSegmentos(),
    guardar: !document.getElementById('btnGuardar').disabled,
    generar: !document.getElementById('btnGenerar').disabled,
    pesEditor: !document.getElementById('pesEditor').disabled,
    msg: (document.getElementById('avisos') || document.body).textContent.slice(-200)
  }));

  // ---- D1: GWC tras GWI ----
  await cargar('#ficheroSetup', path.join(RAIZ, 'setup4.json'), 500);
  await cargar('#ficheroGWIZip', path.join(RAIZ, 'cartucho_gwi.zip'), 3500);
  const antes = await estado();
  ok('D1 (previo): con el GWI cargado hay autoría y Guardar/Generar activos', antes.tipo === 'GWI' && antes.guardar && antes.generar && antes.pesEditor, JSON.stringify(antes));
  const bytes = await pg.evaluate(() => {
    const j = BaseDirector.datosCartucho();
    const sprites = j.sprites.map(s => ({ id: s.id, ancho: s.ancho, alto: s.alto, imagen: s.imagen || s }));
    return null;
  });
  // GWC de laboratorio: se genera con el cartucho mínimo y se baja a un fichero temporal
  const b64 = await pg.evaluate(() => {
    const mk = (w, h) => { const c = document.createElement('canvas'); c.width = w; c.height = h; const g = c.getContext('2d'); g.fillStyle = '#000'; g.fillRect(0, 0, w, h); return c; };
    const sprites = [{ id: 'img_000', ancho: 8, alto: 8, imagen: mk(8, 8) }];
    const j = { tipo: 'GWI', version: 1, nombre: 'p', estilo: '4', resolucion: { ancho: 100, alto: 80 },
      sprites: [{ id: 'img_000', ancho: 8, alto: 8, fichero: 'segmentos/img_000.png' }],
      segmentos: [{ id: 'seg_000', tipo: 1, x: 0, y: 0, sprite: 'img_000' }], fin: { mecanismo: 'vida' } };
    const g = BaseCartucho.generarGWC(j, sprites, { ancho: 100, alto: 80, fuente: { ancho: 100, alto: 80 } });
    let s = ''; g.bytes.forEach(b => { s += String.fromCharCode(b); }); return btoa(s);
  });
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'gwi15_'));
  const fGWC = path.join(dir, 'lab.gwc');
  fs.writeFileSync(fGWC, Buffer.from(b64, 'base64'));
  await cargar('#ficheroGWC', fGWC, 1500);
  const despuesGWC = await estado();
  ok('D1: tras cargar el GWC el cartucho es el GWC', despuesGWC.tipo === 'GWC', JSON.stringify(despuesGWC));
  ok('D1: tras cargar el GWC no quedan Guardar/Generar ni Editor de la autoría del GWI', !despuesGWC.guardar && !despuesGWC.generar && !despuesGWC.pesEditor, JSON.stringify(despuesGWC));

  // ---- D3: cartucho incompatible tras uno bueno ----
  await cargar('#ficheroSetup', path.join(RAIZ, 'setup2.json'), 500);
  const dBueno = path.join(dir, 'bueno'); fs.mkdirSync(dBueno);
  const dMalo = path.join(dir, 'malo'); fs.mkdirSync(dMalo);
  for (const f of fs.readdirSync(path.join(RAIZ, 'cartucho'))) { fs.copyFileSync(path.join(RAIZ, 'cartucho', f), path.join(dBueno, f)); fs.copyFileSync(path.join(RAIZ, 'cartucho', f), path.join(dMalo, f)); }
  const jm = JSON.parse(fs.readFileSync(path.join(dMalo, 'parachute-demo.json'), 'utf8'));
  jm.nombre = 'Malo'; jm.botones.push({ numero: 99, id: 'X' });
  fs.writeFileSync(path.join(dMalo, 'parachute-demo.json'), JSON.stringify(jm));
  await cargar('#carpetaCartucho', dBueno, 2500);
  const bueno = await estado();
  ok('D3 (previo): el GWB bueno carga', bueno.tipo === 'GWB' && bueno.nombre === 'Parachute' && bueno.imgS, JSON.stringify(bueno));
  const botonesAntes = await pg.evaluate(() => document.querySelectorAll('.botonFisico').length);
  const etiquetasAntes = await pg.evaluate(() => [...document.querySelectorAll('.botonFisico .etiqueta')].map(e => e.textContent).join(','));
  await cargar('#carpetaCartucho', dMalo, 2500);
  const tras = await estado();
  const botonesTras = await pg.evaluate(() => document.querySelectorAll('.botonFisico').length);
  const etiquetasTras = await pg.evaluate(() => [...document.querySelectorAll('.botonFisico .etiqueta')].map(e => e.textContent).join(','));
  ok('D3: el cartucho incompatible no carga y el anterior sigue siendo el cartucho', tras.nombre === 'Parachute' && tras.imgS, JSON.stringify(tras));
  ok('D3: la botonera sigue como la del cartucho anterior', botonesTras === botonesAntes && etiquetasTras === etiquetasAntes, botonesAntes + ' ' + etiquetasAntes + ' | ' + botonesTras + ' ' + etiquetasTras);
  ok('D3: el editor sigue disponible con el cartucho anterior', tras.pesEditor && tras.guardar !== undefined, JSON.stringify(tras));

  // ---- D2: un GWB sin img_s no deja la autoría habilitada ----
  const dSin = path.join(dir, 'sin'); fs.mkdirSync(dSin);
  for (const f of fs.readdirSync(path.join(RAIZ, 'cartucho'))) fs.copyFileSync(path.join(RAIZ, 'cartucho', f), path.join(dSin, f));
  const js = JSON.parse(fs.readFileSync(path.join(dSin, 'parachute-demo.json'), 'utf8'));
  js.nombre = 'SinS';
  // img_s completamente blanca: no hay nada que descomponer y la autoría no arranca
  require('child_process').execFileSync('python3', ['-c',
    "from PIL import Image; Image.new('RGB',(320,240),'white').save(r'" + path.join(dSin, js.imagenes.img_s) + "')"]);
  fs.writeFileSync(path.join(dSin, 'parachute-demo.json'), JSON.stringify(js));
  await cargar('#carpetaCartucho', dSin, 2500);
  const sin = await estado();
  ok('D2: un GWB cuya img_s no descompone no deja Guardar/Generar ni Editor habilitados', sin.nombre === 'SinS' && !sin.guardar && !sin.generar && !sin.pesEditor, JSON.stringify(sin));

  ok('sin errores de página', errPag.length === 0, errPag.join(' | '));
  for (const [n, c, x] of res) console.log((c ? 'OK    ' : 'FALLO ') + n + (c ? '' : '  -> ' + x));
  const malos = res.filter(r => !r[1]).length;
  console.log(malos ? malos + ' fallo(s)' : 'TODO OK');
  await nav.close();
  process.exit(malos ? 1 : 0);
})();
