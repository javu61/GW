// pruebas/pruebasEditor.js — Pruebas del EDITOR (BaseDescomponer, BaseCartucho, BaseExtractor)
// ================================================================================================
// PROPÓSITO
//   Comprueban el editor sobre el cartucho de ejemplo cargado: historial de autoría (ids «F01»,
//   deshacer, rehacer), presentar el cero, cambio de tipo, alta de la ficha, numeración y uniones,
//   dígitos y contadores, PNG con alfa y verificación (E1-E9 de F5-I15).
//
//   Estas pruebas necesitan ver el INTERIOR de BaseDescomponer (vive dentro de una función
//   cerrada) y el código de producción no lo publica. Por eso solo se lanzan desde la consola:
//   el lanzador sirve una COPIA temporal del proyecto en la que BaseDescomponer.js exporta además
//   un objeto «_t» con los interiores de la lista «interiores» de este fichero. El código real no
//   cambia, y en la pestaña «Pruebas» esta prueba no tiene botón (solo aparece en el panel de
//   comandos).
//
// PRUEBAS (grupo «editor»)
//   Editor (E1-E9)       Un solo bloque de comprobaciones, cada una con su rótulo E1…E9.
//
// FUNCIONES
//   interiores           (solo Node) Qué variables y funciones de BaseDescomponer hay que exportar.
//   _pruebaEditor        La prueba. Recarga el GWI de ejemplo entre bloques, porque E5 deshace
//                        todo el historial y contaminaría a los siguientes.
//
// USO
//   Solo consola:  pruebas\Lanzar.bat editor
// ================================================================================================
'use strict';

if (typeof module !== 'undefined') {
  // Lo lee pruebas/lanzador.js para preparar la copia que sirve a la página.
  const nombres = ['cambios', 'props', 'uniones', 'grupos', 'ficticios', 'base', 'marcados', 'rehacibles'];
  const funciones = ['_reproducirCambios', '_reconstruir', '_unirGrupos', '_separarAgrupado', '_registrarCambio',
    '_propsDe', '_montarGWI', '_crearFicticio', '_verificarReferencias', '_grupoDeComp', '_refrescar', '_hacerContador', '_hacerDigito', '_aplicarEleccion', '_cartuchoDe', '_numContador', '_unirMarcados', '_ctxVerificacion'];
  module.exports = { interiores: { nombres: nombres, funciones: funciones } };
}

(function () {
  if (typeof Pruebas === 'undefined') return;     // en Node solo cuenta el lanzador del final

  async function _pruebaEditor(opc) {
    if (typeof BaseDescomponer === 'undefined' || !BaseDescomponer._t)
      return [['esta prueba solo se lanza desde la consola (necesita la copia con los interiores)', false, '']];
    const U = Pruebas.util;
    const res = [];
    const ok = (n, c, x) => res.push([n, !!c, x === undefined ? '' : String(x)]);
    const gwiBytes = await U.traerBytes(opc.gwiUrl || 'pruebas/cartuchos/cartucho_GWI.zip');
    // Las comprobaciones se escribieron para dirigirse desde fuera con pg.evaluate; aquí ya
    // estamos dentro de la página, y pg.evaluate solo llama a la función.
    const pg = { evaluate: async (f) => f() };
    const recargar = async () => { await U.cargarEn('ficheroCartucho', [U.fichero('cartucho.zip', gwiBytes)], 3000); };

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

    return res;
  }

  Pruebas.registrar([
    { id: 'editor', grupo: 'editor', nombre: 'Editor (E1-E9)', necesita: 'gwi', soloConsola: true,
      ejecutar: (o) => _pruebaEditor(o) }
  ]);
})();

if (typeof require !== 'undefined' && typeof module !== 'undefined' && require.main === module)
  require('./lanzador.js').lanzar('editor');
