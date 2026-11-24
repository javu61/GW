// pruebas/pruebas.js — Ejecutor de pruebas del diseñador (pestaña «Pruebas» y Node)
// ================================================================================================
// PROPÓSITO
//   Es el ÚNICO sitio que sabe lanzar pruebas. Las pruebas viven cada una en su fichero
//   (pruebasMotor.js, pruebasDirector.js, pruebasGenerales.js, pruebasGWI_GWC.js), se REGISTRAN
//   aquí y se lanzan de dos formas con el MISMO código:
//     - desde la pestaña «Pruebas» (visible solo con GW_DEBUG, index.html): un botón por prueba;
//     - desde la consola: «pruebas\Lanzar.bat motor» abre la página con Playwright y llama a
//       ejecutar() de este módulo (el lanzador común es pruebas/lanzador.js).
//   Las pruebas del Editor (soloConsola) necesitan ver el interior de un módulo que el código de
//   producción no publica: no tienen botón, solo comando (se ejecutan en una copia parcheada).
//
// FORMA DE UNA PRUEBA
//   { id, grupo, nombre, necesita, destructiva, soloConsola, ejecutar(opciones) }
//   ejecutar devuelve [[nombre, ok, detalle], ...], o null si faltan los datos que necesita
//   (aviso, no fallo). «necesita: 'gwi'» pide un GWI cargado. «destructiva» avisa de que la
//   prueba sustituye el cartucho cargado.
//   «soloConsola» no crea botón: la prueba solo se lanza desde el panel de comandos.
//
// FUNCIONES
//   _$                         Un elemento del DOM por id.
//   _linea                     Una línea (clase + texto) en la salida de la pestaña; las
//                              clases la pintan verde, roja o de aviso (estilos.css).
//   _ok / _mal                 Las líneas OK y FALLO del resultado.
//   registrar                  Añade pruebas al catálogo (lo llama cada fichero de pruebas).
//   listar                     Las pruebas de un grupo (id, nombre, necesita), para Node.
//   ejecutar                   Ejecuta una prueba por id y devuelve su resultado, para Node.
//   _lanzar                    Lanza una prueba desde su botón: pinta línea a línea y cierra
//                              con el resumen (N OK, M fallo(s) y tiempo).
//   _panelConsola              Panel «Desde consola»: una línea por grupo (y «todas») con el
//                              comando que lo lanza y un botón para copiarlo.
//   _avisarServidorLocal       Aviso visible si la página se abrió por file:// (las pruebas que
//                              leen ficheros del proyecto fallarán).
//   inicializar                Con GW_DEBUG activo: descubre la pestaña, crea una línea por
//                              grupo (título + un botón por prueba, salvo las soloConsola) y el
//                              panel de comandos. Público: lo llama index.html tras cargar los
//                              ficheros de pruebas.
//   util                       Utilidades que comparten los ficheros de pruebas:
//     igual / nz / nn            Comparación JSON y normalización de lo indefinido a null.
//     esperar                    Espera en milisegundos.
//     traerBytes                 Lee un fichero del proyecto por URL (necesita servidor local).
//     fichero                    Un File a partir de bytes.
//     cargarEn                   Entrega ficheros a uno de los inputs del diseñador, como si el
//                                usuario los hubiera elegido, y espera a que se procesen.
//     salvarListas               Guarda las listas del motor y devuelve quien las restaura.
//     cartuchoLaboratorio        Cartucho mínimo propio (2 sprites, 3 segmentos, 320×240).
//     crc16 / codigoCRC          CRC-16/CCITT-FALSE independiente y Código GWC «#HHHH#».
//   datos                      Datos que una prueba deja para el lanzador de Node (partidas).
//
// USO
//   Pestaña: abrir index.html por servidor local con GW_DEBUG = true y entrar en Pruebas.
//   Consola: ver el README.md (lista de comandos).
// ================================================================================================
'use strict';

var Pruebas = (function () {

  const ID_PESTANA = 'pesPruebas';
  const ID_BARRA = 'barraPruebas';
  const ID_SALIDA = 'salidaPruebas';

  const CATALOGO = [];
  const datos = {};

  /* ---------------- Utilidades del DOM y del resultado ---------------- */

  function _$(id) { return document.getElementById(id); }

  function _linea(clase, texto) {
    const d = document.createElement('div');
    d.className = 'pruebaLinea ' + clase;
    d.textContent = texto;
    _$(ID_SALIDA).appendChild(d);
    return d;
  }

  const _ok = (nombre, detalle) => _linea('pruebaOk', 'OK    ' + nombre +
    (detalle ? ' — ' + detalle : ''));
  const _mal = (nombre, detalle) => _linea('pruebaMal', 'FALLO ' + nombre +
    (detalle ? ' — ' + detalle : ''));

  /* ---------------- Utilidades compartidas con los ficheros de pruebas ---------------- */

  const igual = (a, b) => JSON.stringify(a) === JSON.stringify(b);
  const nz = (o) => (o === undefined ? null : o);
  const nn = (v) => (v === undefined || v === null) ? null : Number(v);
  const esperar = (ms) => new Promise(r => setTimeout(r, ms));

  /**
   * Lee un fichero del proyecto por URL relativa.
   * @param {string} url - Ruta relativa a index.html (p. ej. 'setup4.json').
   * @returns {Promise<Uint8Array>}
   * @throws {Error} Si no se puede leer (la página abierta con doble clic no lo permite).
   */
  async function traerBytes(url) {
    let r, causa = '';
    try { r = await fetch(url); } catch (e) { r = null; causa = e && e.message; }
    if (!r || !r.ok) throw new Error('No se pudo leer «' + url + '» (' +
      (r ? 'HTTP ' + r.status : causa || 'sin respuesta') + ') desde ' + location.href +
      ': index.html debe abrirse por un servidor local (http) cuya raíz sea la carpeta del proyecto');
    return new Uint8Array(await r.arrayBuffer());
  }

  /** Un File a partir de bytes (lo que entregaría el selector de ficheros). */
  function fichero(nombre, bytes, tipo) {
    return new File([bytes], nombre, { type: tipo || '' });
  }

  /**
   * Entrega ficheros a un input del diseñador como si el usuario los hubiera elegido
   * y espera a que el diseñador los procese.
   * @param {string} idInput - Id del input (p. ej. 'ficheroGWIZip').
   * @param {File[]} ficheros
   * @param {number} [ms=1500] - Espera tras el evento.
   * @returns {Promise<void>}
   */
  async function cargarEn(idInput, ficheros, ms) {
    const dt = new DataTransfer();
    for (const f of ficheros) dt.items.add(f);
    const el = _$(idInput);
    el.files = dt.files;
    el.dispatchEvent(new Event('change', { bubbles: true }));
    await esperar(ms || 1500);
  }

  /**
   * Guarda las listas del motor (para las pruebas que montan su propio cartucho
   * en memoria) y devuelve la función que las deja como estaban.
   * @returns {function(): void} Restaurador.
   */
  function salvarListas() {
    const s = {
      sprites: ComunListas.sprites().slice(), segmentos: ComunListas.segmentos().slice(),
      fondo: ComunListas.fondo(), reglas: ComunListas.reglas(),
      fin: ComunListas.finDeCartucho(), secuencia: ComunListas.secuenciaDeCartucho(),
      pausas: ComunListas.pausasDeCartucho(), aceleracion: ComunListas.aceleracionDeCartucho(),
      rutas: ComunListas.rutasDeCartucho()
    };
    return function restaurar() {
      ComunListas.cargar(s.sprites, s.segmentos);
      ComunListas.fijarFondo(s.fondo);
      ComunListas.fijarReglas(s.reglas);
      ComunListas.fijarFin(s.fin);
      ComunListas.fijarSecuencia(s.secuencia);
      ComunListas.fijarPausas(s.pausas);
      ComunListas.fijarAceleracion(s.aceleracion);
      ComunListas.fijarRutas(s.rutas);
    };
  }

  /**
   * Cartucho de laboratorio: 2 sprites y 3 segmentos, pantalla 320×240 (la menor que admite el GWC) sin escalar.
   * Lo usan las pruebas que no dependen del cartucho cargado.
   * @returns {{json:Object, sprites:Array, pantalla:Object}} Los tres argumentos
   *          de BaseCartucho.generarGWC.
   */
  function cartuchoLaboratorio() {
    const mk = (w, h) => {
      const c = document.createElement('canvas');
      c.width = w; c.height = h;
      const g = c.getContext('2d');
      g.fillStyle = '#000'; g.fillRect(0, 0, w, h);
      return c;
    };
    const sprites = [
      { id: 'img_000', ancho: 8, alto: 8, imagen: mk(8, 8) },
      { id: 'img_001', ancho: 8, alto: 8, imagen: mk(8, 8) }
    ];
    const json = {
      tipo: 'GWI', version: 1, nombre: 'p', estilo: '4',
      resolucion: { ancho: 320, alto: 240 },
      sprites: sprites.map(s => ({ id: s.id, ancho: 8, alto: 8, fichero: 'segmentos/' + s.id + '.png' })),
      segmentos: [
        { id: 'seg_000', tipo: 1, x: 0, y: 0, sprite: 'img_000', siguiente: 'seg_001' },
        { id: 'seg_001', tipo: 1, x: 10, y: 0, sprite: 'img_001' },
        { id: 'seg_002', tipo: 1, x: 20, y: 0, sprite: 'img_001' }
      ],
      secuencia: { ticks: 2, segmentos: ['seg_000', 'seg_001'] },
      fin: { mecanismo: 'vida' }
    };
    const pantalla = { ancho: 320, alto: 240, fuente: { ancho: 320, alto: 240 } };
    return { json: json, sprites: sprites, pantalla: pantalla };
  }

  /** CRC-16/CCITT-FALSE calculado de forma independiente (para contrastar). */
  function crc16(bytes) {
    let c = 0xFFFF;
    for (const x of bytes) {
      c ^= x << 8;
      for (let k = 0; k < 8; k++) c = (c & 0x8000) ? ((c << 1) ^ 0x1021) & 0xFFFF : (c << 1) & 0xFFFF;
    }
    return c;
  }

  /** Código GWC «#HHHH#» que corresponde a un fichero ya generado. */
  function codigoCRC(bytes) {
    return '#' + crc16(bytes.subarray(14)).toString(16).toUpperCase().padStart(4, '0') + '#';
  }

  /* ---------------- Catálogo ---------------- */

  /**
   * Añade pruebas al catálogo. Cada fichero de pruebas lo llama al cargarse.
   * @param {Array<Object>} lista - Pruebas con la forma descrita en la cabecera.
   * @returns {void}
   */
  function registrar(lista) { for (const p of lista) CATALOGO.push(p); }

  /**
   * Las pruebas de un grupo, sin su código (para que Node sepa qué lanzar).
   * @param {string} grupo
   * @returns {Array<{id:string, nombre:string, necesita:?string, destructiva:boolean}>}
   */
  function listar(grupo) {
    return CATALOGO.filter(p => p.grupo === grupo).map(p => ({
      id: p.id, nombre: p.nombre, necesita: p.necesita || null, destructiva: !!p.destructiva
    }));
  }

  /**
   * Ejecuta una prueba por id.
   * @param {string} id
   * @param {Object} [opciones] - Opciones de la prueba (cartuchos, semillas, ticks...).
   * @returns {Promise<?Array>} [[nombre, ok, detalle], ...] o null si faltan datos.
   */
  async function ejecutar(id, opciones) {
    const p = CATALOGO.find(x => x.id === id);
    if (!p) throw new Error('Prueba desconocida: ' + id);
    return await p.ejecutar(opciones || {});
  }

  /**
   * Lanza una prueba desde su botón: deshabilita los botones mientras corre,
   * limpia la salida, la ejecuta y pinta el resultado. Una prueba que devuelve
   * null no tiene los datos que necesita (aviso, no fallo).
   * @param {Object} prueba - Entrada del catálogo.
   * @returns {Promise<void>}
   */
  async function _lanzar(prueba) {
    for (const b of _$(ID_BARRA).querySelectorAll('button')) b.disabled = true;
    _$(ID_SALIDA).innerHTML = '';
    _linea('pruebaTitulo', prueba.nombre);
    if (prueba.destructiva)
      _linea('pruebaAviso', 'Esta prueba sustituye el cartucho cargado (vuelve a cargarlo después).');
    const t0 = performance.now();
    try {
      const res = await Promise.resolve().then(() => prueba.ejecutar({}));
      if (res === null) {
        _linea('pruebaAviso',
          'Esta prueba necesita un GWI cargado (pestaña Cartucho o Editor).');
      } else {
        let fallos = 0;
        for (const [n, c, x] of res) { (c ? _ok : _mal)(n, x); if (!c) fallos++; }
        _linea(fallos === 0 ? 'pruebaFinOk' : 'pruebaFinMal',
          (res.length - fallos) + ' OK, ' + fallos + ' fallo(s) — ' +
          Math.round(performance.now() - t0) + ' ms');
      }
    } catch (e) {
      _mal('la prueba lanzó una excepción', e && e.message);
      console.error('[Pruebas] ' + prueba.id + ':', e);
    } finally {
      for (const b of _$(ID_BARRA).querySelectorAll('button')) b.disabled = false;
    }
  }

  /**
   * Panel «Desde consola»: la línea de comando de cada grupo (y la de todos) con un botón
   * «copiar». Se pegan en CMD o PowerShell, en la carpeta del proyecto. Se coloca debajo
   * de la salida de la pestaña.
   * @returns {void}
   */
  /**
   * Aviso cuando index.html se abrió por fichero (file://): las pruebas
   * que leen ficheros del proyecto por URL (G3 y todas las que cargan
   * cartuchos de pruebas/cartuchos) fallan con «Failed to fetch».
   * El aviso va antes de la salida (no se limpia al lanzar una prueba).
   * @returns {void}
   */
  function _avisarServidorLocal() {
    if (location.protocol !== 'file:') return;
    const aviso = document.createElement('div');
    aviso.id = 'avisoServidorLocal';
    aviso.className = 'pruebaAviso';
    aviso.style.cssText = 'padding:.4em .6em;margin:0 0 8px 0';
    aviso.textContent = 'Página abierta por fichero (file://): las pruebas que leen ficheros del ' +
      'proyecto (G3 y todas las que cargan cartuchos de pruebas/cartuchos) fallan con «Failed to ' +
      'fetch». Abre index.html por un servidor local (http) con la raíz en la carpeta del proyecto; ' +
      'ejecuta pruebas\\Servidor.bat en la carpeta del proyecto (o npx http-server . -p 8080).';
    _$(ID_SALIDA).insertAdjacentElement('beforebegin', aviso);
    console.warn('[Pruebas] ' + aviso.textContent);
  }

  function _panelConsola() {
    const grupos = [];
    for (const p of CATALOGO) if (!grupos.includes(p.grupo)) grupos.push(p.grupo);
    const panel = document.createElement('div');
    panel.id = 'panelConsolaPruebas';
    panel.style.cssText = 'margin-top:1em';
    const t = document.createElement('div');
    t.style.cssText = 'font-weight:bold;margin-bottom:.3em';
    t.textContent = 'Desde consola (copiar y pegar en CMD o PowerShell, en la carpeta del proyecto):';
    panel.appendChild(t);
    for (const g of grupos.concat(['todas'])) {
      const cmd = 'pruebas\\Lanzar.bat ' + g;
      const fila = document.createElement('div');
      fila.style.cssText = 'margin:.15em 0';
      const b = document.createElement('button');
      b.textContent = 'Copiar';
      b.addEventListener('click', async () => {
        try { await navigator.clipboard.writeText(cmd); b.textContent = 'Copiado'; }
        catch (e) { b.textContent = 'No se pudo copiar'; }
        setTimeout(() => { b.textContent = 'Copiar'; }, 1500);
      });
      const c = document.createElement('code');
      c.style.cssText = 'margin-left:.6em';
      c.textContent = cmd;
      fila.appendChild(b); fila.appendChild(c);
      panel.appendChild(fila);
    }
    _$(ID_SALIDA).insertAdjacentElement('afterend', panel);
  }

  /**
   * Construye los botones de la pestaña (agrupados) y quita el oculto a la pestaña
   * si GW_DEBUG está activo; con debug apagado no hace nada. Lo llama index.html
   * después de cargar todos los ficheros de pruebas.
   * @returns {void}
   */
  function inicializar() {
    if (!(typeof GW_DEBUG !== 'undefined' && GW_DEBUG)) return;
    if (!(_$(ID_PESTANA) && _$(ID_BARRA) && _$(ID_SALIDA))) {
      console.error('[Pruebas] index.html desactualizado: faltan ' + ID_PESTANA +
        ', ' + ID_BARRA + ' o ' + ID_SALIDA + '.');
      return;
    }
    _$(ID_PESTANA).classList.remove('oculto');
    let grupo = null;
    let lineaGrupo = null;
    for (const p of CATALOGO) {
      if (p.soloConsola) continue;
      // Un grupo por línea: su título y sus botones en un bloque propio
      if (p.grupo !== grupo) {
        grupo = p.grupo;
        lineaGrupo = document.createElement('div');
        lineaGrupo.className = 'pruebaGrupo';
        const t = document.createElement('span');
        t.textContent = grupo;
        t.style.cssText = 'font-weight:bold;margin:0 .4em 0 0';
        lineaGrupo.appendChild(t);
        _$(ID_BARRA).appendChild(lineaGrupo);
      }
      const btn = document.createElement('button');
      btn.textContent = p.nombre;
      const aviso = [];
      if (p.necesita) aviso.push('Necesita ' + p.necesita);
      if (p.destructiva) aviso.push('Sustituye el cartucho cargado');
      if (aviso.length) btn.title = aviso.join('. ');
      btn.addEventListener('click', () => _lanzar(p));
      lineaGrupo.appendChild(btn);
    }
    _panelConsola();
    _avisarServidorLocal();
  }

  return {
    registrar: registrar, listar: listar, ejecutar: ejecutar, inicializar: inicializar,
    datos: datos,
    util: {
      igual: igual, nz: nz, nn: nn, esperar: esperar, traerBytes: traerBytes, fichero: fichero,
      cargarEn: cargarEn, salvarListas: salvarListas, cartuchoLaboratorio: cartuchoLaboratorio,
      crc16: crc16, codigoCRC: codigoCRC
    }
  };

})();
