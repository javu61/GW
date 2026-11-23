// pruebas/pruebasEditor.js — F5-I15, bloque Editor (E1-E9) + F5-I16: límites de la UI (L1, M2-M4, R4)
// ================================================================================================
// Las funciones del editor viven dentro de un cierre (BaseDescomponer es una IIFE): para probarlas sin
// ensuciar el código de producción, la prueba trabaja sobre una COPIA temporal del proyecto en la que
// BaseDescomponer.js exporta además un objeto «_t» con los internos que hacen falta. El código real no
// cambia.
// USO: NODE_PATH=$(npm root -g) node pruebas/pruebasEditorF5I15.js
// ================================================================================================
'use strict';
const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');
const os = require('os');
const cp = require('child_process');
const RAIZ = path.resolve(__dirname, '..');

const COPIA = fs.mkdtempSync(path.join(os.tmpdir(), 'gwE_'));
cp.execFileSync('cp', ['-r', RAIZ, COPIA + '/p']);
fs.rmSync(COPIA + '/p/.git', { recursive: true, force: true });
const fDesc = COPIA + '/p/designer/BaseDescomponer.js';
let src = fs.readFileSync(fDesc, 'utf8');
const marca = '  return {\n    arrancar: arrancar,';
if (!src.includes(marca)) { console.error('No encuentro el return de BaseDescomponer'); process.exit(2); }
const nombres = ['cambios', 'props', 'uniones', 'grupos', 'ficticios', 'base', 'marcados', 'rehacibles'];
const funciones = ['_reproducirCambios', '_reconstruir', '_unirGrupos', '_separarAgrupado', '_registrarCambio',
  '_propsDe', '_montarGWI', '_crearFicticio', '_verificarReferencias', '_grupoDeComp', '_refrescar', '_hacerContador', '_hacerDigito', '_aplicarEleccion', '_cartuchoDe', '_numContador', '_unirMarcados', '_ctxVerificacion'];
let t = '  return {\n    _t: {\n      _sel: (g) => { seleccion = g; },\n      _mostrarPanel: _mostrarPanel,\n';
for (const n of nombres) t += '      ' + n + ': () => ' + n + ',\n';
for (const f of funciones) t += "      " + f + ': (typeof ' + f + " === 'function') ? " + f + ' : undefined,\n';
t += '    },\n    arrancar: arrancar,';
src = src.replace(marca, t);
fs.writeFileSync(fDesc, src);

// Ficheros «a mano» para F5-I16 (M2/M3/M4, sobres COPIA/p): un GWI con pausaSim 5000
// y secuencia.ticks 300; un GWS con puerto 65000 y tecla «5»; y un GWS con tecla «AA».
const dirMano = fs.mkdtempSync(path.join(os.tmpdir(), 'gwM_'));
cp.execFileSync('unzip', ['-o', '-q', RAIZ + '/cartucho_gwi.zip', '-d', dirMano]);
const fGwiMano = dirMano + '/cartucho_GWI.json';
const jsonMano = JSON.parse(fs.readFileSync(fGwiMano, 'utf8'));
jsonMano.pausas.simulador = 5000;
jsonMano.secuencia.ticks = 300;
fs.writeFileSync(fGwiMano, JSON.stringify(jsonMano, null, 2));
cp.execFileSync('zip', ['-q', '-r', COPIA + '/gwi_limites.zip', '.'], { cwd: dirMano });
const setupPuerto = JSON.parse(fs.readFileSync(RAIZ + '/setup4.json', 'utf8'));
setupPuerto.botones[0].puerto = 65000;
setupPuerto.botones[0].tecla = '5';
fs.writeFileSync(COPIA + '/setup_puerto5.json', JSON.stringify(setupPuerto, null, 2));
const setupTecla = JSON.parse(fs.readFileSync(RAIZ + '/setup4.json', 'utf8'));
setupTecla.botones[0].tecla = 'AA';
fs.writeFileSync(COPIA + '/setup_teclaAA.json', JSON.stringify(setupTecla, null, 2));

const res = [];
const ok = (n, c, x) => res.push([n, !!c, x === undefined ? '' : String(x)]);

(async () => {
  const nav = await chromium.launch();
  const pg = await nav.newPage();
  const errPag = [];
  pg.on('pageerror', e => errPag.push(e.message));
  await pg.goto('file://' + COPIA + '/p/index.html');
  await pg.setInputFiles('#ficheroSetup', path.join(COPIA, 'p/setup4.json'));
  await pg.waitForTimeout(500);
  await pg.setInputFiles('#ficheroGWIZip', path.join(COPIA, 'p/cartucho_gwi.zip'));
  await pg.waitForTimeout(3500);

  const recargar = async () => {
    await pg.setInputFiles('#ficheroGWIZip', path.join(COPIA, 'p/cartucho_gwi.zip'));
    await pg.waitForTimeout(3000);
  };
  const sondeo = await pg.evaluate(() => {
    const t = BaseDescomponer._t;
    return { cambios: t.cambios().length, grupos: t.grupos().length, ficticios: t.ficticios().length, uniones: t.uniones().length,
      tipos: [...new Set(t.grupos().map(g => g.prop.tipo))] };
  });
  console.log('sondeo', JSON.stringify(sondeo));
  console.log('porTipo', JSON.stringify(await pg.evaluate(() => { const o = {}; BaseDescomponer._t.grupos().forEach(g => { const k = g.prop.tipo + (g.raiz < 0 ? '(F)' : '') + (g.absorbido ? '(abs)' : ''); o[k] = (o[k] || 0) + 1; }); return o; })));

  // E_: las pruebas se añaden aquí abajo
  await recargar();
  // ---- E2: el historial cargado de un GWI usa los ids internos (los de las piezas, números negativos) ----
  {
    const r = await pg.evaluate(() => {
      const t = BaseDescomponer._t;
      const crudo = JSON.stringify(t.cambios());
      const conF = (crudo.match(/"F\d+"/g) || []).length;
      const orig = BaseDirector.datosCartucho().autoria.cambios;
      const ida = JSON.stringify(t._montarGWI().autoria.cambios);
      return { conF, ida: ida === JSON.stringify(orig), n: t.cambios().length };
    });
    ok('E2: tras cargar un GWI el historial no guarda ids «F01» (son raíces numéricas)', r.conF === 0, r.conF + ' ids F en el historial interno');
    ok('E2: guardar el historial cargado reproduce el del GWI (ida y vuelta)', r.ida, '');
    const d = await pg.evaluate(() => {
      const t = BaseDescomponer._t;
      const antes = { ficticios: t.ficticios().length, grupos: t.grupos().length, cambios: t.cambios().length };
      let err = '';
      // se deshace la última acción que cree o borre una pieza F (alta/baja de ficticio)
      for (let i = 0; i < 400 && t.cambios().length > 0; i++) {
        const ult = t.cambios()[t.cambios().length - 1];
        const n = t.cambios().filter(c => c.n === ult.n);
        if (n.some(c => Array.isArray(c.altaFicticio))) break;
        try { BaseDescomponer.deshacer(); } catch (e) { err = e.message; break; }
      }
      const despues = { ficticios: t.ficticios().length, cambios: t.cambios().length };
      try { BaseDescomponer.deshacer(); } catch (e) { err = e.message; }
      return { antes, despues, tras: { ficticios: t.ficticios().length, cambios: t.cambios().length }, err };
    });
    ok('E2: deshacer el alta de una pieza F cargada la quita de verdad', d.tras.ficticios === d.despues.ficticios - 1 && !d.err, JSON.stringify(d));
  }

  await recargar();
  // ---- E3: «Presentar el cero = false» llega al GWI y sobrevive a la recarga ----
  {
    const r = await pg.evaluate(() => {
      const t = BaseDescomponer._t;
      const libre = t.grupos().find(g => g.prop.tipo === 'dígito' && !BaseDescomponer.listar().some(() => false));
      t.marcados().clear();
      const dig = t.grupos().filter(g => g.prop.tipo === 'dígito').find(g => {
        try { return !g.contadorDe; } catch (e) { return true; }
      });
      t.marcados().add(dig);
      t._hacerContador();
      const cont = t.grupos().find(g => g.prop.tipo === 'contador');
      if (!cont) return { error: 'no se creó el contador' };
      const p = t._propsDe(cont.raiz);
      p.presentarCero = false;
      t._registrarCambio(cont.raiz, { presentarCero: false }, { presentarCero: true });
      t._reconstruir();                      // como hace el panel tras cada cambio
      const gwi = t._montarGWI();
      const sc = gwi.segmentos.find(s => s.tipo === 'contador' || s.id === ('F' + String(-cont.raiz).padStart(2, '0')));
      const viaje = !!sc && sc.presentarCero === false;
      // recarga: se reproduce el historial guardado y se vuelve a leer
      BaseDescomponer.cargarAutoria({ cambios: gwi.autoria.cambios, ultimoOp: gwi.autoria.ultimoOp });
      t._reconstruir();
      const cont2 = t.grupos().find(g => g.prop.tipo === 'contador');
      return { viaje, recarga: !!cont2 && cont2.prop.presentarCero === false, seg: sc ? JSON.stringify(sc) : null };
    });
    ok('E3: presentarCero=false viaja en el segmento del contador del GWI', r.viaje, JSON.stringify(r));
    ok('E3: presentarCero=false sobrevive a recargar el historial', r.recarga, JSON.stringify(r));
  }

  await recargar();
  // ---- E1: los enlaces sec_1..sec_5 de la Secuencia se re-apuntan al unir y los revisa la verificación ----
  {
    const r = await pg.evaluate(() => {
      const t = BaseDescomponer._t;
      const cart = t._cartuchoDe();
      const libres = t.grupos().filter(g => g.prop.tipo === 'juego' && g.raiz >= 0 && g.miembros.length === 1 &&
        !BaseDescomponer.segmentos().some(() => false));
      const A = libres[0], B = libres[1];
      const pc = t._propsDe(cart.raiz);
      pc.sec_1 = A.raiz; pc.sec_2 = B.raiz;
      t._reconstruir();
      const antesCol = t._verificarReferencias();
      const id = t._unirGrupos([t._grupoDeComp(A.raiz), t._grupoDeComp(B.raiz)]);
      const p2 = t._propsDe(cart.raiz);
      const colgantes = t._verificarReferencias();
      return { id, sec1: p2.sec_1, sec2: p2.sec_2, colgantes, antesCol };
    });
    ok('E1: al unir, sec_1 y sec_2 pasan a apuntar a la pieza nueva', r.sec1 === r.id && r.sec2 === r.id, JSON.stringify(r));
    ok('E1: tras unir no quedan referencias colgantes de la Secuencia', r.colgantes === 0, JSON.stringify(r));
  }

  await recargar();
  // ---- E4: cambiar de tipo descarta solo los campos que el tipo nuevo no usa ----
  {
    const r = await pg.evaluate(() => {
      const t = BaseDescomponer._t;
      const libres = t.grupos().filter(g => g.prop.tipo === 'juego' && g.raiz >= 0 && g.miembros.length === 1);
      const [A, B, C] = libres;
      const pA = t._propsDe(A.raiz), pC = t._propsDe(C.raiz);
      pA.siguiente = B.raiz; pA.salvado = B.raiz; pA.mostrarJunto = C.raiz; pC.mostradoJunto = A.raiz;
      t._reconstruir();
      const cambiar = (tipo) => {
        t._sel(t._grupoDeComp(A.raiz));
        t._mostrarPanel();
        const sel = [...document.querySelectorAll('#panelSegmento select')].find(x => [...x.options].some(o => o.value === 'adicional'));
        sel.value = tipo; sel.dispatchEvent(new Event('change'));
      };
      cambiar('inicio');
      const a1 = { sig: pA.siguiente === B.raiz, salv: pA.salvado === B.raiz, mj: pA.mostrarJunto === C.raiz, mdj: pC.mostradoJunto === A.raiz, tipo: pA.tipo };
      cambiar('adicional');
      const a2 = { sig: pA.siguiente === B.raiz, salv: pA.salvado, mj: pA.mostrarJunto, mdj: pC.mostradoJunto, tipo: pA.tipo };
      return { a1, a2 };
    });
    ok('E4: juego→inicio conserva siguiente, salvado y «mostrar junto a» (los usa el tipo nuevo)',
      r.a1.tipo === 'inicio' && r.a1.sig && r.a1.salv && r.a1.mj && r.a1.mdj, JSON.stringify(r.a1));
    ok('E4: inicio→adicional conserva siguiente y descarta salvado y mostrarJunto',
      r.a2.tipo === 'adicional' && r.a2.sig && r.a2.salv === null && r.a2.mj === null, JSON.stringify(r.a2));
    ok('E4: al descartar mostrarJunto se limpia el mostradoJunto del secundario', r.a2.mdj === null, JSON.stringify(r.a2));
  }

  await recargar();
  // ---- E5: el alta de la ficha del cartucho no se puede deshacer ----
  {
    const r = await pg.evaluate(() => {
      const t = BaseDescomponer._t;
      let pasos = 0;
      for (; pasos < 2000 && t.cambios().length > 0; pasos++) {
        const antes = t.cambios().length;
        BaseDescomponer.deshacer();
        if (t.cambios().length === antes) break;      // «nada que deshacer»
      }
      const ficha = t._cartuchoDe();
      const altaFicha = t.cambios().some(c => Array.isArray(c.altaFicticio));
      return { pasos, ficha: !!ficha, restan: t.cambios().length, altaFicha };
    });
    ok('E5: tras deshacer todo, la ficha del cartucho sigue existiendo', r.ficha, JSON.stringify(r));
    ok('E5: el historial conserva el alta de la ficha (no se deshace)', r.altaFicha && r.restan > 0, JSON.stringify(r));
  }

  await recargar();
  // ---- E6: los absorbidos por una unión no cuentan en las familias ni en la numeración de rutas ----
  {
    const r = await pg.evaluate(() => {
      const t = BaseDescomponer._t;
      const rutas = () => BaseDescomponer.segmentos().filter(s => s.tipo === 2 && !s.fusionadoPor).map(s => s.ruta).sort((a, b) => a - b);
      const conRuta = () => BaseDescomponer.segmentos().filter(s => s.fusionadoPor && s.ruta !== undefined).length;
      const ini = t.grupos().filter(g => g.prop.tipo === 'inicio' && g.raiz >= 0 && g.miembros.length === 1);
      const antes = rutas();
      const id = t._unirGrupos([ini[0], ini[1]]);
      const despues = rutas();
      return { antes, despues, absorbidosConRuta: conRuta(), id };
    });
    const esperado = JSON.stringify(Array.from({ length: r.antes.length - 1 }, (_, i) => i + 1));
    ok('E6: tras unir 2 inicios las rutas son 1..N-1 sin huecos ni repetidos', JSON.stringify(r.despues) === esperado, JSON.stringify(r));
    ok('E6: los absorbidos no llevan número de ruta', r.absorbidosConRuta === 0, JSON.stringify(r));
  }

  await recargar();
  // ---- E7: no se unen dígitos ni contadores, ni una pieza de unión pasa a dígito o contador ----
  {
    const r = await pg.evaluate(() => {
      const t = BaseDescomponer._t;
      // dos dígitos de laboratorio: dos segmentos de juego puestos a tipo «dígito»
      const dj = t.grupos().filter(g => g.prop.tipo === 'juego' && g.raiz >= 0 && !g.absorbido && g.miembros.length === 1);
      t._propsDe(dj[0].raiz).tipo = 'dígito'; t._propsDe(dj[1].raiz).tipo = 'dígito';
      t._reconstruir();
      const digs = [t._grupoDeComp(dj[0].raiz), t._grupoDeComp(dj[1].raiz)];
      const nF0 = t.ficticios().length;
      t.marcados().clear(); t.marcados().add(digs[0]); t.marcados().add(digs[1]);
      const hayMarcados = t.marcados().size, tipos = [...t.marcados()].map(g => g.prop.tipo + ':' + g.raiz);
      t._unirMarcados();
      const dosDigitos = t.ficticios().length - nF0;
      // dos juego → pieza de unión; luego se intenta pasarla a dígito
      t.marcados().clear();
      const libres = t.grupos().filter(g => g.prop.tipo === 'juego' && g.raiz >= 0 && g.miembros.length === 1);
      const id = t._unirGrupos([libres[0], libres[1]]);
      t._sel(t._grupoDeComp(id)); t._mostrarPanel();
      const sel = [...document.querySelectorAll('#panelSegmento select')].find(x => [...x.options].some(o => o.value === 'adicional'));
      sel.value = 'dígito'; sel.dispatchEvent(new Event('change'));
      const tipoPieza = t._propsDe(id).tipo;
      return { dosDigitos, tipoPieza, hayMarcados, tipos, msg: document.getElementById('avisos') ? document.getElementById('avisos').textContent.slice(0, 200) : '' };
    });
    ok('E7: unir dos dígitos marcados no crea ninguna pieza', r.dosDigitos === 0, JSON.stringify(r));
    ok('E7: una pieza de unión no puede pasar a dígito', r.tipoPieza !== 'dígito', JSON.stringify(r));
  }

  // ---- E8: un píxel transparente (alfa 0) cuenta como blanco en el extractor ----
  {
    const r = await pg.evaluate(() => new Promise((res) => {
      const c = document.createElement('canvas'); c.width = 8; c.height = 8;
      const g = c.getContext('2d');                       // fondo TRANSPARENTE (0,0,0,0)
      g.fillStyle = '#000'; g.fillRect(2, 2, 3, 3);       // un cuadrado negro 3x3
      const img = new Image();
      img.onload = () => {
        const bn = BaseExtractor.verificarBN(img);
        const ex = BaseExtractor.extraerBN(img);
        res({ bn, comps: ex.comps.length, ancho: ex.comps[0] && ex.comps[0].ancho, alto: ex.comps[0] && ex.comps[0].alto });
      };
      img.src = c.toDataURL('image/png');
    }));
    ok('E8: un PNG con fondo transparente pasa la verificación B/N', r.bn === null, JSON.stringify(r));
    ok('E8: del PNG transparente sale solo el cuadrado negro (1 componente de 3×3)', r.comps === 1 && r.ancho === 3 && r.alto === 3, JSON.stringify(r));
  }

  await recargar();
  // ---- E9: los inversos que calcula la verificación no son acciones del autor ----
  {
    const r = await pg.evaluate(() => {
      const t = BaseDescomponer._t;
      const jug = t.grupos().filter(g => g.prop.tipo === 'jugador' && !g.absorbido);
      const A = jug[0], B = jug[1];
      for (const g of jug) for (const d of ['izquierda', 'derecha', 'arriba', 'abajo']) t._propsDe(g.raiz)[d] = null;
      t._reconstruir();
      // acción del autor: A.derecha = B (el panel escribe también el inverso solo si lo hace él; aquí no)
      t._propsDe(A.raiz).derecha = B.raiz;
      t._registrarCambio(A.raiz, { derecha: B.raiz }, { derecha: null });
      t._reconstruir();
      const nAntes = t.cambios().length;
      BaseCartucho.verificarCartucho(t._ctxVerificacion());
      const nVerif = t.cambios().length;
      const inverso = t._propsDe(B.raiz).izquierda === A.raiz;
      const gwi = t._montarGWI();
      const autoEnGWI = gwi.autoria.cambios.filter(c => c.auto === true).length;
      BaseDescomponer.deshacer();           // UNA sola vez
      const tras = { derecha: t._propsDe(A.raiz).derecha, izq: t._propsDe(B.raiz).izquierda };
      BaseDescomponer.rehacer();            // devuelve la acción y su inverso derivado
      const rehecho = { derecha: t._propsDe(A.raiz).derecha === B.raiz, izq: t._propsDe(B.raiz).izquierda === A.raiz, n: t.cambios().length };
      BaseDescomponer.deshacer();
      return { rehecho, autoEnGWI, nAntes, nVerif, inverso, derecha: t._propsDe(A.raiz).derecha, izquierda: t._propsDe(B.raiz).izquierda, nDespues: t.cambios().length };
    });
    ok('E9 (previo): la verificación calculó el inverso B.izquierda = A', r.inverso && r.nVerif > r.nAntes, JSON.stringify(r));
    ok('E9: el primer Ctrl+Z tras Verificar deshace la última acción del autor (A.derecha)', r.derecha === null, JSON.stringify(r));
    ok('E9: el GWI guarda el inverso derivado marcado «auto»', r.autoEnGWI >= 1, JSON.stringify(r));
    ok('E9: rehacer devuelve la acción del autor y su inverso derivado', r.rehecho.derecha && r.rehecho.izq && r.rehecho.n === r.nVerif, JSON.stringify(r));
    ok('E9: y se lleva con ella los inversos derivados (B.izquierda), sin dejar acciones invisibles', r.izquierda === null && r.nDespues === r.nAntes - 1, JSON.stringify(r));
  }

  await recargar();
  // ---- L1 (F5-I16): la ficha del cartucho ajusta el max y recorta por arriba con aviso ----
  {
    const r = await pg.evaluate(() => {
      const t = BaseDescomponer._t;
      const cart = t._cartuchoDe();
      const casos = [['Ticks entre lanzamientos', 'secTicks', 300],
        ['Pausa simulador', 'pausaSim', 1000],
        ['Ticks entre reducciones', 'accCada', 100],
        ['Reducción (ms)', 'accResta', 2000],
        ['Pausa mínima (ms)', 'accMinimo', 5000],
        ['Nº para aumentar rutas', 'aumentarCada', 123]];
      const detalle = {};
      for (const [etiqueta, campo, escribir] of casos) {
        t._sel(t._grupoDeComp(cart.raiz)); t._mostrarPanel();
        const fila = [...document.querySelectorAll('#panelSegmento .filaProp')]
          .find(f => f.querySelector('label') && f.querySelector('label').textContent === etiqueta);
        if (!fila) { detalle[campo] = 'sin campo'; continue; }
        const inp = fila.querySelector('input');
        inp.value = String(escribir);
        inp.dispatchEvent(new Event('change'));
        detalle[campo] = { max: inp.max, valor: t._propsDe(cart.raiz)[campo],
          estado: document.getElementById('estado').textContent };
      }
      return detalle;
    });
    ok('L1: los campos numéricos de la ficha del cartucho llevan el max de F5-I16',
      r.secTicks.max === '99' && r.pausaSim.max === '999' && r.accCada.max === '99' &&
      r.accResta.max === '999' && r.accMinimo.max === '999' && r.aumentarCada.max === '99', JSON.stringify(r));
    ok('L1: escribir fuera de rango recorta en memoria al máximo práctico',
      r.secTicks.valor === 99 && r.pausaSim.valor === 999 && r.accCada.valor === 99 &&
      r.accResta.valor === 999 && r.accMinimo.valor === 999 && r.aumentarCada.valor === 99, JSON.stringify(r));
    ok('L1: cada recorte avisa por la barra de estado',
      ['secTicks', 'pausaSim', 'accCada', 'accResta', 'accMinimo', 'aumentarCada']
        .every(c => /limitado/.test(r[c].estado || r[c] || '')), JSON.stringify(r));
  }

  // ---- L1 (F5-I16 R1): el «Valor inicial» de un contador recorta a 255 con aviso ----
  {
    const r = await pg.evaluate(() => {
      const t = BaseDescomponer._t;
      const dj = t.grupos().filter(g => g.prop.tipo === 'juego' && g.raiz >= 0 && !g.absorbido && g.miembros.length === 1);
      t._propsDe(dj[0].raiz).tipo = 'dígito'; t._propsDe(dj[1].raiz).tipo = 'dígito';
      t._reconstruir();
      t.marcados().clear();
      t.marcados().add(t._grupoDeComp(dj[0].raiz));
      t.marcados().add(t._grupoDeComp(dj[1].raiz));
      t._hacerContador();
      const cont = t.grupos().find(g => g.prop.tipo === 'contador');
      if (!cont) return { error: 'no se creó el contador' };
      t._sel(cont); t._mostrarPanel();
      const fila = [...document.querySelectorAll('#panelSegmento .filaProp')]
        .find(f => f.querySelector('label') && f.querySelector('label').textContent === 'Valor inicial');
      if (!fila) return { error: 'sin campo Valor inicial' };
      const inp = fila.querySelector('input');
      const maxAttr = inp.max;
      inp.value = '256';
      inp.dispatchEvent(new Event('change'));
      return { maxAttr, valor: t._propsDe(cont.raiz).valorInicial, estado: document.getElementById('estado').textContent };
    });
    ok('L1 (R1): el «Valor inicial» del contador lleva max 255', r.maxAttr === '255', JSON.stringify(r));
    ok('L1 (R1): escribir 256 recorta el valor a 255 con aviso', r.valor === 255 && /limitado/.test(r.estado || ''), JSON.stringify(r));
  }

  // ---- M2/M3 (F5-I16): un GWI a mano con valores fuera de rango se limita al cargar; el GWC lleva lo limitado ----
  {
    await pg.setInputFiles('#ficheroGWIZip', COPIA + '/gwi_limites.zip');
    await pg.waitForTimeout(3000);
    const r = await pg.evaluate(() => {
      const t = BaseDescomponer._t;
      const p = t._propsDe(t._cartuchoDe().raiz);
      return { pausaSim: p.pausaSim, secTicks: p.secTicks, estado: document.getElementById('estado').textContent };
    });
    ok('M2: un GWI a mano con pausaSim 5000 se limita a 999 en memoria, con aviso',
      r.pausaSim === 999 && /limitado/.test(r.estado), JSON.stringify(r));
    ok('M2: un GWI a mano con secuencia.ticks 300 se limita a 99',
      r.secTicks === 99 && /limitado/.test(r.estado), JSON.stringify(r));
    const l = await pg.evaluate(() => {
      const pantalla = { ancho: 320, alto: 240, fuente: { ancho: 320, alto: 240 } };
      const gwi = BaseDescomponer._t._montarGWI();
      const gwc = BaseCartucho.generarGWC(gwi, BaseDescomponer.sprites(), pantalla);
      return BaseCartucho.leerGWC(gwc.bytes);
    });
    ok('M3: el GWC generado desde el GWI a mano lleva pausaSim 999 (dentro del formato)',
      l.pausas && l.pausas.simulador === 999, JSON.stringify(l.pausas));
    ok('M3: el GWC generado lleva ticks de Secuencia 99',
      l.secuencia && l.secuencia.ticks === 99, JSON.stringify(l.secuencia));
  }

  // ---- R4 (F5-I16, condicional): la ficha no conserva errores de una verificación anterior ----
  {
    const r = await pg.evaluate(() => {
      const inpNombre = document.querySelector('#fichaCartucho input[placeholder="Nombre del cartucho"]');
      const antes = BaseFicha.estado().nombre;
      const zona = () => {
        const z = document.querySelector('#fichaCartucho .fichaMensajes');
        return { nErrores: z ? z.querySelectorAll('.fichaError').length : -1,
          texto: z ? z.textContent.slice(0, 200) : null };
      };
      inpNombre.value = '';
      BaseFicha.verificar({ mostrar: true });
      const conError = zona();
      inpNombre.value = antes;
      BaseFicha.verificar({ mostrar: true });
      return { conError, sinError: zona() };
    });
    ok('R4: un error de la ficha se pinta en .fichaMensajes',
      r.conError.nErrores > 0 && /Falta el nombre/.test(r.conError.texto || ''), JSON.stringify(r.conError));
    ok('R4: corregir y re-verificar deja la zona sin el error anterior',
      r.sinError.nErrores === 0 && !/Falta el nombre/.test(r.sinError.texto || ''), JSON.stringify(r.sinError));
  }

  // ---- M4 (F5-I16): GWS a mano — puerto 65000 se limita a 99; tecla «AA» no carga ----
  {
    await pg.setInputFiles('#ficheroSetup', COPIA + '/setup_puerto5.json');
    await pg.waitForTimeout(600);
    const rPuerto = await pg.evaluate(() => document.getElementById('estado').textContent);
    ok('M4: un GWS a mano con puerto 65000 y tecla «5» carga, y el puerto queda 99 con aviso',
      /Setup cargado/.test(rPuerto) && /limitado a 99/.test(rPuerto), rPuerto);
    await pg.setInputFiles('#ficheroSetup', COPIA + '/setup_teclaAA.json');
    await pg.waitForTimeout(600);
    const rTecla = await pg.evaluate(() => document.getElementById('estado').textContent);
    ok('M4: un GWS a mano con tecla «AA» NO se carga', /Setup NO cargado/.test(rTecla), rTecla);
  }

  ok('sin errores de página', errPag.length === 0, errPag.join(' | '));
  for (const [n, c, x] of res) console.log((c ? 'OK    ' : 'FALLO ') + n + (c ? '' : '  -> ' + x));
  const malos = res.filter(r => !r[1]).length;
  console.log(malos ? malos + ' fallo(s)' : 'TODO OK');
  await nav.close();
  fs.rmSync(COPIA, { recursive: true, force: true });
  process.exit(malos ? 1 : 0);
})();
