// pruebas/pruebasMotor.js — F5-I15: pruebas de laboratorio del MOTOR de estados
// ================================================================================================
// Cada prueba monta un cartucho mínimo EN MEMORIA (ComunListas.cargar) y juega unos ticks con
// JuegoMotorEstados, sin cartucho real. Son los casos A1–A4 de F5-I15: se escribieron primero
// para que FALLARAN con el código anterior y pasan con el corregido.
// USO: NODE_PATH=$(npm root -g) node pruebas/pruebasMotorF5I15.js
// ================================================================================================
'use strict';
const { chromium } = require('playwright');
const path = require('path');
const RAIZ = path.resolve(__dirname, '..');

(async () => {
  const nav = await chromium.launch();
  const pg = await nav.newPage();
  const errPag = [];
  pg.on('pageerror', e => errPag.push(e.message));
  await pg.goto('file://' + RAIZ + '/index.html');

  const res = await pg.evaluate(() => {
    const out = [];
    const ok = (n, c, x) => out.push([n, !!c, x === undefined ? '' : String(x)]);
    const S = (id, tipo, extra) => Object.assign({ id: id, tipo: tipo, x: 0, y: 0, sprite: 'img', visible: false, cambiar: false, estado: 0, cambiado: 0 }, extra || {});
    const T = ComunListas.tipos;
    // Monta y arranca; devuelve la lista viva del motor.
    const montar = (segs, rutas, semilla, fin) => {
      ComunListas.limpiar();
      ComunListas.cargar([], segs);
      ComunListas.fijarReglas({ combinar: false });
      ComunListas.fijarRutas(rutas || null);
      ComunListas.fijarFin(fin || null);
      JuegoDirector.fijarSemilla(semilla || 1);
      JuegoMotorEstados.iniciar();
      return ComunListas.segmentos();
    };
    const visibles = (segs) => segs.map(s => s.visible ? s.id : '').filter(Boolean).join(',');

    // ---- M1: el secundario de «mostrar junto a» no es una ruta ----
    // Con el fallo, el secundario (tipo juego, sin siguiente) moría en el barrido y restaba una
    // ruta viva: nRutasVivas valía 1 con DOS rutas en pantalla y se lanzaba una de más.
    {
      const segs = [
        S('jug', T.jugador, { primero: true }),
        S('ini', T.inicio, { siguiente: 'r1' }),
        S('r1', T.juego, { siguiente: 'r2', mostrarJunto: 'sec' }),
        S('r2', T.juego),
        S('sec', T.juego, { mostradoJunto: 'r1' })
      ];
      montar(segs);
      let maxReales = 0, desajustes = 0, minVivas = 99, errMsg = '';
      try {
        for (let t = 0; t < 60; t++) {
          JuegoMotorEstados.tick();
          const reales = segs.filter(s => ['ini', 'r1', 'r2'].includes(s.id) && s.visible).length;
          const v = JuegoMotorEstados.estadoRutas().vivas;
          maxReales = Math.max(maxReales, reales); minVivas = Math.min(minVivas, v);
          if (v !== reales) desajustes++;
        }
      } catch (e) { errMsg = e.message; }
      ok('M1: con un secundario nunca hay más rutas en pantalla que el máximo (1)', !errMsg && maxReales <= 1, 'máx. rutas visibles=' + maxReales + ' ' + errMsg);
      ok('M1: nRutasVivas coincide con las rutas visibles y no es negativo', !errMsg && desajustes === 0 && minVivas >= 0, 'desajustes=' + desajustes + ' min=' + minVivas);
    }

    // ---- M2a: al iniciar, el secundario de un icono ya coincide con su principal ----
    {
      const segs = [
        S('jug', T.jugador, { primero: true }),
        S('ini', T.inicio, { siguiente: 'r1' }),
        S('r1', T.juego),
        S('v1', T.vida, { contador: 1, mostrarJunto: 'c1' }),
        S('c1', T.juego, { mostradoJunto: 'v1' })
      ];
      montar(segs, null, 1, { mecanismo: 'vida' });
      const v1 = segs.find(s => s.id === 'v1'), c1 = segs.find(s => s.id === 'c1');
      ok('M2a: tras iniciar, el secundario del icono coincide con su principal', v1.visible === true && c1.visible === v1.visible,
        'v1=' + v1.visible + ' c1=' + c1.visible);
    }

    // ---- M2b: una ruta aterriza en un icono de muerte: principal y secundario cambian en el MISMO tick ----
    {
      const segs = [
        S('jug', T.jugador, { primero: true }),
        S('ini', T.inicio, { siguiente: 'm1' }),
        S('m1', T.muerte, { contador: 1 }),
        S('m2', T.muerte, { contador: 2 }),
        S('m3', T.muerte, { contador: 3, mostrarJunto: 'c1' }),   // la primera muerte enciende el ÚLTIMO
        S('c1', T.juego, { mostradoJunto: 'm3' })
      ];
      montar(segs, null, 1, { mecanismo: 'muerte' });
      const m1 = segs.find(s => s.id === 'm3'), c1 = segs.find(s => s.id === 'c1');
      let tickM1 = -1, tickC1 = -1;
      for (let t = 0; t < 6 && (tickM1 < 0 || tickC1 < 0); t++) {
        JuegoMotorEstados.tick();
        if (tickM1 < 0 && m1.visible) tickM1 = t;
        if (tickC1 < 0 && c1.visible) tickC1 = t;
      }
      ok('M2b: el secundario del icono se enciende en el mismo tick que su principal', tickM1 >= 0 && tickM1 === tickC1, 'm1 en el tick ' + tickM1 + ', c1 en el tick ' + tickC1);
    }

    // ---- M4a: un punto de colisión decide el MISMO tick en que la ruta llega (F3-I8) ----
    // Caso «el punto se enciende y apaga en el mismo tick». Es el diseño: la decisión no espera un
    // tick. Esta prueba fija el contrato: la ruta que llega a un punto con cadena de desenlace deja
    // encendido el primer eslabón de la cadena en ese mismo tick (el hueco no se ve).
    {
      const segs = [
        S('jug', T.jugador, { primero: true }),
        S('a0', T.juego, { siguiente: 'p1', visible: true }),
        S('p1', T.juego, { colision: 'jug', salvado: 'd1' }),
        S('d1', T.juego, { siguiente: 'd2' }),
        S('d2', T.juego)
      ];
      montar(segs);
      segs.forEach(s => { if (s.id === 'a0') s.visible = true; });
      JuegoMotorEstados.tick();
      const p1 = segs.find(s => s.id === 'p1'), d1 = segs.find(s => s.id === 'd1');
      ok('M4a: la colisión se decide el mismo tick: el punto no queda encendido y la cadena nace', !p1.visible && d1.visible, 'p1=' + p1.visible + ' d1=' + d1.visible);
    }

    // ---- M4b: una ruta que cruza un segmento de la Secuencia no deja nRutasVivas atascado ----
    // Con el fallo, la Secuencia apagaba el segmento con la ruta encima, nadie restaba la viva y,
    // con máximo 1, no volvía a nacer ninguna ruta: el juego se quedaba sin rutas para siempre.
    {
      const segs = [
        S('jug', T.jugador, { primero: true }),
        S('ini', T.inicio, { siguiente: 'r1' }),
        S('r1', T.juego, { siguiente: 's1' }),
        S('s1', T.juego, { siguiente: 'r3' }),
        S('r3', T.juego),
        S('s2', T.juego)
      ];
      montar(segs);
      ComunListas.fijarSecuencia({ ticks: 1, segmentos: ['s1', 's2'] });
      JuegoMotorEstados.iniciar();
      let lanzadas = 0, previa = false, enHueco = 0;
      for (let t = 0; t < 80; t++) {
        JuegoMotorEstados.tick();
        const hayIni = segs.find(s => s.id === 'ini').visible;
        if (hayIni && !previa) lanzadas++;
        previa = hayIni;
        const vivas = JuegoMotorEstados.estadoRutas().vivas;
        const hayRuta = ['ini', 'r1', 'r3'].some(id => segs.find(s => s.id === id).visible);
        if (vivas > 0 && !hayRuta && !segs.find(s => s.id === 's1').visible) enHueco++;
      }
      ComunListas.fijarSecuencia(null);
      ok('M4b: sigue habiendo lanzamientos de ruta (no se atasca el contador)', lanzadas >= 5, 'lanzamientos=' + lanzadas);
      ok('M4b: nunca hay «vivas» sin una ruta que las justifique', enHueco === 0, 'ticks con viva fantasma=' + enHueco);
    }

    // ---- M4c: la congelación corta el barrido en curso, con la lista en cualquier orden ----
    for (const invertida of [false, true]) {
      const base = [
        S('jug', T.jugador, { primero: true }),
        S('jug2', T.jugador),
        S('a0', T.juego, { siguiente: 'p1', visible: true }),
        S('p1', T.juego, { colision: 'jug2', muerte: 'd1' }),
        S('d1', T.juego, { siguiente: 'd2' }),
        S('d2', T.juego),
        S('b0', T.juego, { siguiente: 'b1', visible: true }),
        S('b1', T.juego)
      ];
      const segs = invertida ? [base[0], base[1], base[6], base[7], base[2], base[3], base[4], base[5]] : base;
      montar(segs);
      segs.forEach(s => { if (s.id === 'a0' || s.id === 'b0') s.visible = true; });
      JuegoMotorEstados.tick();
      const b0 = segs.find(s => s.id === 'b0'), b1 = segs.find(s => s.id === 'b1');
      ok('M4c' + (invertida ? ' (lista invertida)' : '') + ': tras nacer el desenlace, otra ruta de la misma pasada no avanza', JuegoMotorEstados.congelada() && b0.visible && !b1.visible,
        'congelada=' + JuegoMotorEstados.congelada() + ' b0=' + b0.visible + ' b1=' + b1.visible);
    }

    // ---- M3: el barrido no depende del orden de la lista ----
    // Dos rutas seguidas en la misma cadena (a→b→c con a y b encendidas): deben pasar a b y c.
    // Con el barrido secuencial, si «a» se procesaba antes que «b», la ruta de «a» se fundía con la de «b».
    {
      const ordenes = [['ra', 'rb', 'rc'], ['rb', 'ra', 'rc'], ['rc', 'rb', 'ra']];
      const resultados = ordenes.map(orden => {
        const def = { ra: { siguiente: 'rb' }, rb: { siguiente: 'rc' }, rc: {} };
        const segs = [S('jug', T.jugador, { primero: true })].concat(orden.map(id => S(id, T.juego, def[id])));
        montar(segs);
        segs.forEach(s => { if (s.id === 'ra' || s.id === 'rb') s.visible = true; });
        JuegoMotorEstados.tick();
        return visibles(segs.filter(s => s.id !== 'jug')).split(',').sort().join(',');
      });
      ok('M3a: dos rutas seguidas en la cadena avanzan las dos, con la lista en cualquier orden',
        resultados.every(r => r === 'rb,rc'), resultados.join(' | '));
    }
    // Una ruta aterriza donde otra muere al final de la cadena: la que llega sobrevive, en ambos órdenes.
    {
      const ordenes = [['rc', 'rd'], ['rd', 'rc']];
      const resultados = ordenes.map(orden => {
        const def = { rc: { siguiente: 'rd' }, rd: {} };
        const segs = [S('jug', T.jugador, { primero: true })].concat(orden.map(id => S(id, T.juego, def[id])));
        montar(segs);
        segs.forEach(s => { if (s.id === 'rc' || s.id === 'rd') s.visible = true; });
        JuegoMotorEstados.tick();
        return visibles(segs.filter(s => s.id !== 'jug'));
      });
      ok('M3b: la ruta que llega a un final donde otra muere sobrevive, con la lista en cualquier orden',
        resultados.every(r => r === 'rd'), resultados.join(' | '));
    }
    // Dos rutas que confluyen: el resultado es el mismo en ambos órdenes y el contador es exacto.
    {
      const ordenes = [['x', 'y', 'z'], ['y', 'x', 'z']];
      const resultados = ordenes.map(orden => {
        const def = { x: { siguiente: 'z' }, y: { siguiente: 'z' }, z: {} };
        const segs = [S('jug', T.jugador, { primero: true })].concat(orden.map(id => S(id, T.juego, def[id])));
        montar(segs);
        segs.forEach(s => { if (s.id === 'x' || s.id === 'y') s.visible = true; });
        JuegoMotorEstados.tick();
        return visibles(segs.filter(s => s.id !== 'jug')) + '/vivas=' + JuegoMotorEstados.estadoRutas().vivas;
      });
      ok('M3c: dos rutas que confluyen dan el mismo resultado con la lista en cualquier orden y el contador exacto',
        resultados[0] === resultados[1] && resultados[0] === 'z/vivas=1', resultados.join(' | '));
    }

    // ---- Orden del tick: el cambio del jugador llega al pintado ----
    {
      const segs = [
        S('jug', T.jugador, { primero: true, derecha: 'j2' }),
        S('j2', T.jugador, { izquierda: 'jug' }),
        S('ini', T.inicio, { siguiente: 'r1' }),
        S('r1', T.juego)
      ];
      montar(segs);
      JuegoMotorEstados.tick();                    // consume lo pendiente de iniciar
      ComunListas.encolar(4);                      // derecha
      JuegoMotorEstados.tick();
      const j2 = segs.find(s => s.id === 'j2');
      ok('Orden del tick: tras mover, el jugador nuevo queda con la bandera «cambiar»', j2.visible && j2.cambiar === true, 'j2=' + j2.visible + '/' + j2.cambiar);
    }
    return out;
  });

  let fallos = 0;
  for (const [n, c, x] of res) { console.log((c ? 'OK   ' : 'FALLO') + ' ' + n + (c ? '' : '  -> ' + x)); if (!c) fallos++; }
  if (errPag.length) { console.log('Errores de página:', errPag); fallos++; }
  console.log(fallos === 0 ? 'TODO OK' : fallos + ' fallo(s)');
  await nav.close();
  process.exit(fallos ? 1 : 0);
})();
