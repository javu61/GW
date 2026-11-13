'use strict';

// BaseDirector.js
// ==================================================
//
// PROPÓSITO
//   Orquesta la máquina y el cartucho: cablea los botones e inputs,
//   carga y valida el setup, lanza el flujo automático por tipo de
//   cartucho (GWB → descomponer; GWI → listas + edición; GWC → carga
//   binaria) y arrastra las listas al puente (ComunListas) para el
//   motor. El modo juego se prepara con jugar() al pulsar el Start.
//
// SEPARACIÓN
//   No dibuja la máquina (HTML/CSS de cada estilo), no hace la autoría
//   (BaseDescomponer.js) ni lee ficheros (BaseCartucho.js): cablea,
//   valida, delega y presenta. El campo "puerto" del setup se lee pero
//   aún no se usa: lo consumirá el firmware del ESP32.
//
// FUNCIONES
//
//  Utilidades y avisos
//   $ / avisar / avisarError  Atajo de id y mensajes de la barra.
//   leerJSON                 Lee el setup (copia local mínima).
//
//  Setup
//   validarSetup             Valida el JSON del hardware.
//   aplicarSetup             Esqueleto del estilo, canvas y botonera.
//   alSeleccionarSetup       Evento del input: valida, limpia y aplica.
//
//  Botonera
//   crearBotonFisico         Un botón físico: hueco, tecla, etiqueta.
//   construirBotonera        La botonera del estilo del setup.
//   normalizarNumeroBoton    Número o alias → botón físico canónico.
//   aplicarBotonesCartucho   Botones del cartucho sobre la botonera.
//
//  Limpieza y dibujo
//   limpiarCartucho          Vacía el cartucho en memoria (y la autoría).
//   pintarFondoNeutro        Color de "sin cartucho".
//   pintarFondoCartucho      img_f escalada para LLENAR el canvas (blanco sin fondo).
//
//  Panel de información (F5-I7)
//   pintarInfo               Máquina y cartucho; en el Editor, el diseño.
//   informarTamanos          Tamaños del GWI y del GWC generados y línea de deduplicación.
//   sumarGWI                 Tamaño aproximado de un GWI cargado.
//   avisarEtiquetas          Etiquetas que no corresponden a nada.
//
//  Carga del cartucho (delegada en BaseCartucho)
//   alSeleccionarCartucho    Evento de la carpeta (copia los File).
//   alSeleccionarGWBZip      Botón «Cargar GWB (ZIP)» (F5-I10): doble
//                            vía de entrada del GWB hasta el panel único.
//   cargarCartucho           Núcleo UNIFICADO (F5-I9): detector de forma
//                            por el CONTENIDO + tipo esperado del botón.
//   procesarCartucho         Flujo de carpeta: lectura, puente y flujo.
//   alSeleccionarGWIZip      Botón «Cargar GWI»: el .zip viaja solo.
//   alSeleccionarGWC         Botón «Cargar GWC»: el .gwc viaja solo.
//
//  Presentación del GWC
//   procesarGWC              Binario: leerGWC + puente + presentación.
//   fabricarFondoColor       Canvas plano del color del Bloque 0.
//   fabricarSprite           Imagen de una máscara de 1 bit.
//
//  Edición, teclado y juego
//   descomponerImagen        Arranca la autoría (según el tipo).
//   verificarYGuardar        Delegado en BaseDescomponer.
//   buscarBotonPorTecla / alPulsarTecla / alSoltarTecla
//                            Jugar con el teclado.
//   alAtajoTeclado           Ctrl+Z / Ctrl+Y del historial.
//
//  Pestañas y partida (F5-I7)
//   mostrarPestanna          Cambia de vista; la barra y el panel la siguen.
//   actualizarPestanas       Qué pestañas están disponibles.
//   jugar / finDePartida     Entrar y salir del modo juego.
//   comprobarSalud           Los id del index.html, todos presentes.
//   inicializar              Cablea botones, inputs, mapa y teclado.
//
// JS puro, script clásico sin módulos ES (compatible con file://).
// Encapsulado como los demás ficheros del proyecto: IIFE con el
// objeto público BaseDirector.

var BaseDirector = (function () {

  // ---------------- Estado privado del BaseDirector ----------------

  let setup = null;      // JSON del hardware leído
  let cartucho = null;   // JSON del cartucho leído
  let pestanaVista = 'vistaSimulador';   // vista activa (la fija mostrarPestanna)
  let imgM = null;       // portada (img_m): cargada pero aún sin uso visual
  let imgF = null;       // fondo (img_f): guardado en memoria para el motor gráfico
  let imgS = null;       // imagen de segmentos (img_s): fuente de los sprites
  let sprites = [];      // sprites ÚNICOS (img_NNN) extraídos de img_s
  let segmentos = [];    // segmentos (seg_NNN) resueltos del mapa de objetos
  let numeroStart = '8'; // botón que arranca el juego (id "Start" del cartucho)
  let editable = false;  // hay autoría en marcha (GWB o GWI): pestaña Segmentos y Sprites
  let enJuego = false;   // partida en marcha: solo el Simulador
  let tamGWI = null;     // bytes del GWI generado o cargado (JSON + PNG, aproximado)
  let tamGWC = null;     // bytes del GWC generado o cargado (exacto)
  let deduplicacion = null; // línea de deduplicación del último «Generar GWI+GWC»

  // Botones de carga: se deshabilitan durante la partida
  const BOTONES_CARGA = ['btnCargarSetup', 'btnCargarCartucho', 'btnCargarGWBZip',
    'btnCargarGWIZip', 'btnCargarGWC'];

  const COLOR_FONDO_NEUTRO = '#888888';

  // Identificación del formato del fichero de setup
  const TIPO_SETUP = 'GW';       // campo "tipo" esperado en el setup.json
  const VERSION_SETUP = '1.1';  // versión del formato que entiende este motor

  // Teclas del teclado PC asociadas a cada número de botón, para jugar
  // sin ratón. El setup puede reasignar cada botón con "tecla" (una
  // letra); si no la declara, se usa esta tabla por defecto.
  const TECLAS_POR_DEFECTO = {
    '0': 'Q', '1': 'A', '2': 'W', '3': 'S',
    '4': 'P', '5': 'L', '6': 'G', '7': 'B', '8': 'T'
  };

  // ---------------- Catálogo de estilos de máquina ----------------
  // El setup declara el ESTILO de carcasa. Cada estilo es un DISEÑO
  // INDEPENDIENTE: tiene su propio esqueleto en index.html ("esqueleto")
  // y sus propios contenedores de botones. Añadir un estilo nuevo es
  // añadir un diseño completo, sin tocar los demás.
  // El trío de sistema 6-7-8 (A/B/R, como GAME A / GAME B / TIME en las
  // máquinas reales) existe en TODOS los estilos, abajo y centrado.
  // Solo la cruceta del estilo 5 usa "celda" ([fila, columna] anclada).
  const ESTILOS = {
    '2': {
      descripcion: '0 a la izquierda de la pantalla, 4 a la derecha',
      esqueleto: 'maquina-2',
      botones: {
        '0': { contenedor: 'm2-izq', forma: 'cuadrado' },
        '4': { contenedor: 'm2-der', forma: 'cuadrado' },
        '6': { contenedor: 'm2-sistema', forma: 'rect' },
        '7': { contenedor: 'm2-sistema', forma: 'rect' },
        '8': { contenedor: 'm2-sistema', forma: 'rect' }
      }
    },
    '4': {
      descripcion: '0 y 1 a la izquierda de la pantalla, 4 y 5 a la derecha',
      esqueleto: 'maquina-4',
      botones: {
        '0': { contenedor: 'm4-izq', forma: 'cuadrado' },
        '1': { contenedor: 'm4-izq', forma: 'cuadrado' },
        '4': { contenedor: 'm4-der', forma: 'cuadrado' },
        '5': { contenedor: 'm4-der', forma: 'cuadrado' },
        '6': { contenedor: 'm4-sistema', forma: 'rect' },
        '7': { contenedor: 'm4-sistema', forma: 'rect' },
        '8': { contenedor: 'm4-sistema', forma: 'rect' }
      }
    },
    '5': {
      descripcion: 'cruceta 0-3 a la izquierda de la pantalla, 4 a la derecha',
      esqueleto: 'maquina-5',
      botones: {
        '0': { contenedor: 'm5-izq', forma: 'cuadrado', celda: [2, 1] },
        '1': { contenedor: 'm5-izq', forma: 'cuadrado', celda: [2, 3] },
        '2': { contenedor: 'm5-izq', forma: 'cuadrado', celda: [1, 2] },
        '3': { contenedor: 'm5-izq', forma: 'cuadrado', celda: [3, 2] },
        '4': { contenedor: 'm5-der', forma: 'cuadrado' },
        '6': { contenedor: 'm5-sistema', forma: 'rect' },
        '7': { contenedor: 'm5-sistema', forma: 'rect' },
        '8': { contenedor: 'm5-sistema', forma: 'rect' }
      }
    }
  };

  // ---------------- Utilidades básicas ----------------

  /**
   * Atajo de document.getElementById.
   * @param {string} id - Identificador del elemento.
   * @returns {HTMLElement} Elemento con ese id, o null si no existe.
   */
  function $(id) {
    return document.getElementById(id);
  }

  /**
   * Mensaje de éxito: SOLO en la barra superior (nunca se duplica abajo).
   * @param {string} mensaje - Texto a mostrar.
   * @returns {void}
   */
  function avisar(mensaje) {
    const el = $('estado');
    el.textContent = mensaje;
    el.classList.remove('error');
  }

  /**
   * Mensaje de error: en la barra superior (visible en todas las
   * pestañas) y en la consola. Ante un "no pasa nada", mirar SIEMPRE
   * la consola (F12).
   * @param {string} mensaje - Texto del error.
   * @returns {void}
   */
  function avisarError(mensaje) {
    const el = $('estado');
    el.textContent = mensaje;
    el.classList.add('error');
    console.error(mensaje);
  }

  /**
   * Lee un File y lo parsea como JSON. Copia local mínima: el director
   * la usa para su SETUP (los cartuchos van por BaseCartucho, que tiene
   * la suya: el módulo es autocontenido para su futuro puerto).
   * @param {File} fichero - Fichero .json a leer.
   * @returns {Promise<Object>} Objeto JSON parseado.
   */
  async function leerJSON(fichero) {
    const texto = await fichero.text();
    return JSON.parse(texto);
  }

  // ---------------- Carga del setup ----------------

  /**
   * Valida el JSON del setup: tipo GW, versión 1.1, estilo conocido,
   * pantalla con dimensiones enteras y botones bien declarados.
   * Avisa en consola (sin bloquear) de números fuera de 0-8 o duplicados.
   * @param {Object} json - JSON del setup leído.
   * @returns {?string} null si es válido, o el mensaje de error.
   */
  function validarSetup(json) {
    if (!json || typeof json !== 'object' || Array.isArray(json)) {
      return 'el setup no es un objeto JSON.';
    }
    const p = json.pantalla;
    if (!p) {
      return 'el setup no ha podido cargarse.';
    }
    if (json.tipo !== TIPO_SETUP) {
      return 'no es un fichero de setup GW: "tipo" es "' +
        (json.tipo === undefined ? '(falta)' : json.tipo) + '", se espera "' + TIPO_SETUP + '".';
    }
    if (json.version !== VERSION_SETUP) {
      return 'versión de setup no soportada: "' +
        (json.version === undefined ? '(falta)' : json.version) +
        '", este motor entiende la "' + VERSION_SETUP + '".';
    }
    if (json.estilo === undefined || !ESTILOS[json.estilo]) {
      return 'el setup necesita un "estilo" de máquina válido: ' +
        Object.keys(ESTILOS).join(', ') + '.';
    }
    if (!Number.isInteger(p.ancho) || !Number.isInteger(p.alto) ||
      p.ancho <= 0 || p.alto <= 0) {
      return 'el setup necesita un elemento "pantalla" con "ancho" y "alto" enteros positivos.';
    }
    if (!Array.isArray(json.botones)) {
      return 'el setup necesita un array "botones".';
    }
    const vistos = new Set();
    const teclasVistas = new Set();
    for (const b of json.botones) {
      if (!b || b.numero === undefined) return 'cada botón necesita "numero".';
      if (typeof b.numero !== 'string') {
        console.warn('numero sin comillas en el setup, se convierte a texto: ' + b.numero);
        b.numero = String(b.numero);
      }
      if (vistos.has(b.numero)) console.warn('Botón repetido en el setup: ' + b.numero);
      vistos.add(b.numero);
      if (b.tecla !== undefined) {
        if (typeof b.tecla !== 'string' || !/^[a-zA-Z]$/.test(b.tecla)) {
          return 'la "tecla" del botón ' + b.numero + ' debe ser una sola letra.';
        }
        b.tecla = b.tecla.toUpperCase();
        if (teclasVistas.has(b.tecla)) console.warn('Tecla repetida en el setup: ' + b.tecla);
        teclasVistas.add(b.tecla);
      }
    }
    return null;
  }

  // ---------------- Limpieza ----------------

  /**
   * Revoca las object URLs del cartucho y vacía su estado en memoria.
   * Limpia también toda la autoría: BaseDescomponer.reset oculta el mapa
   * de segmentos y su panel, y el BaseGraficos queda sin fondo ni segmentos
   * (recargar setup con un cartucho cargado no debe dejar restos).
   * @returns {void}
   */
  function limpiarCartucho() {
    cartucho = null;
    editable = false;
    tamGWI = null;
    tamGWC = null;
    imgM = null;
    imgF = null;
    imgS = null;
    sprites = [];
    segmentos = [];
    BaseDescomponer.reset();
    BaseGraficos.fijarFondo(null);
    BaseGraficos.fijarSegmentos([]);
    // Las object URLs del cartucho viven en BaseCartucho (las crea su
    // lectura): el director NO las revoca aquí — el que limpia con
    // criterio (antes de leer el nuevo, o al recargar el setup) las
    // revoca explícitamente con BaseCartucho.revocarURLs().
  }

  // ---------------- Dibujo ----------------

  /**
   * Pinta el canvas de la pantalla con el color neutro de "sin cartucho"
   * (verificación visual de que el setup se leyó bien).
   * @returns {void}
   */
  function pintarFondoNeutro() {
    const canvas = $('pantalla');
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = COLOR_FONDO_NEUTRO;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }

  /**
   * Pinta una imagen (img_f) en la pantalla, escalada para LLENAR el
   * canvas siempre (aunque no respete la proporción original). Con
   * fondo null (cartucho sin img_f, opcional desde el punto 8 de la
   * Fase 5) pinta la pantalla en blanco, como define el anexo del
   * formato GWB.
   * @param {?HTMLImageElement} img - Imagen de fondo del cartucho (o null).
   * @returns {void}
   */
  function pintarFondoCartucho(img) {
    const canvas = $('pantalla');
    const ctx = canvas.getContext('2d');
    if (!img) {
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      return;
    }
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
  }

  // ---------------- Botonera ----------------

  /**
   * Crea un botón físico del DOM: hueco, forma, tecla asociada, alias y
   * resaltado al pulsar (de momento solo deja constancia en consola;
   * aquí se conectarán las pulsaciones al futuro BaseGraficos de Juego).
   * @param {Object} boton - Declaración del setup (numero/alias/tecla/puerto).
   * @param {Object} pos - Hueco, forma y contenedor que dicta el estilo.
   * @returns {HTMLButtonElement} Botón físico listo para colgar.
   */
  function crearBotonFisico(boton, pos) {
    const el = document.createElement('button');
    el.type = 'button';
    el.dataset.numero = boton.numero;          // referencia estable para el futuro BaseGraficos de Juego
    el.className = 'botonFisico ' + pos.forma;
    if (pos.celda) {                           // hueco anclado en la cruceta (estilo 5)
      el.style.gridRow = pos.celda[0];
      el.style.gridColumn = pos.celda[1];
    }
    // Tecla de teclado asociada (la del setup o la tabla por defecto)
    const tecla = (boton.tecla || TECLAS_POR_DEFECTO[boton.numero] || '').toUpperCase();
    if (tecla) el.dataset.tecla = tecla.toLowerCase();
    // Etiqueta visible + pista pequeña con la tecla asociada
    const etiqueta = document.createElement('span');
    etiqueta.className = 'etiqueta';
    etiqueta.textContent = boton.alias || boton.numero;
    el.appendChild(etiqueta);
    if (tecla) {
      el.appendChild(document.createElement('br'));
      const pista = document.createElement('small');
      pista.textContent = tecla;
      el.appendChild(pista);
    }
    // Resaltado al pulsar. Punto de enganche provisional.
    el.addEventListener('pointerdown', () => {
      el.classList.add('pulsado');
      if (typeof GW_DEBUG !== 'undefined' && GW_DEBUG) {
        console.log('[botón] numero=' + boton.numero + (boton.alias ? ' (' + boton.alias + ')' : ''));
      }
      // El Start del sistema lanza el simulador (Fase 2): con él la
      // máquina "se enciende" y empieza el juego. Qué botón ES el
      // Start lo decide el cartucho (id "Start"); por defecto, el 8.
      if (String(boton.numero) === numeroStart && typeof JuegoDirector !== 'undefined') {
        JuegoDirector.arrancar();
      } else if (typeof JuegoDirector !== 'undefined' &&
        typeof JuegoDirector.pulsar === 'function') {
        JuegoDirector.pulsar(String(boton.numero));   // F3-I2: la pulsación, al buffer
      }
    });
    el.addEventListener('pointerup', () => el.classList.remove('pulsado'));
    el.addEventListener('pointerleave', () => el.classList.remove('pulsado'));
    return el;
  }

  /**
   * Crea la botonera que define el ESTILO de máquina del setup. Las
   * declaraciones de "botones" del setup aportan puerto y alias; si un
   * botón del estilo no está declarado, se crea igual (con aviso, sin
   * puerto), y si un botón declarado no pertenece al estilo, se ignora.
   * @returns {void}
   */
  function construirBotonera() {
    // Vacía TODOS los contenedores de TODOS los diseños (cada estilo
    // tiene los suyos propios), para que quede solo lo del estilo activo.
    const contenedores = new Set();
    for (const e of Object.values(ESTILOS)) {
      for (const pos of Object.values(e.botones)) contenedores.add(pos.contenedor);
    }
    for (const id of contenedores) $(id).replaceChildren();
    const estilo = ESTILOS[setup.estilo];
    const declarados = new Map(setup.botones.map(b => [b.numero, b]));
    for (const numero of Object.keys(estilo.botones)) {
      const pos = estilo.botones[numero];
      const decl = declarados.get(numero);
      if (!decl) {
        console.warn('El estilo ' + setup.estilo + ' usa el botón ' + numero +
          ', que no está declarado en el setup; se crea sin puerto.');
      }
      $(pos.contenedor).appendChild(crearBotonFisico(decl || { numero: numero }, pos));
    }
    for (const numero of declarados.keys()) {
      if (!estilo.botones[numero]) {
        console.warn('Botón declarado que no existe en el estilo ' +
          setup.estilo + ', se ignora: ' + numero);
      }
    }
  }

  /**
   * Convierte el "numero" del botón del cartucho a la clave canónica del
   * layout: acepta 0-8 (con o sin comillas) y los alias A/B/R declarados
   * en el setup (se resuelven a su botón físico).
   * @param {string|number} numero - Número o alias del botón del cartucho.
   * @returns {string} Clave canónica del botón físico.
   */
  function normalizarNumeroBoton(numero) {
    const n = String(numero);
    for (const b of setup.botones) {
      if (b.alias === n) return b.numero;
    }
    return n;
  }

  /**
   * Aplica los botones del cartucho sobre la botonera física:
   * - restaura primero TODOS los botones del setup (por si el cartucho
   *   anterior había eliminado o renombrado),
   * - renombra los usados con su "id" lógico (IZQ, DER, Start...),
   * - ELIMINA del DOM los botones físicos que el cartucho no usa.
   * Setup >= cartucho (F3-I1): un botón del cartucho que la máquina
   * no tiene ya no es un aviso, es un ERROR: devuelve el mensaje y el
   * flujo de carga aborta (el cartucho no carga).
   * @param {Object} json - JSON del cartucho.
   * @returns {boolean|string} true si todo bien, o el mensaje de error.
   */
  function aplicarBotonesCartucho(json) {
    construirBotonera();
    numeroStart = '8';                 // por defecto; el cartucho puede cambiarlo
    if (json.botones === undefined) {
      console.warn('El cartucho no declara botones; se dejan los del setup.');
      return true;
    }
    const usados = new Set();
    const inexistentes = [];
    for (const b of json.botones) {
      const numero = normalizarNumeroBoton(b.numero);
      const el = document.querySelector('.botonFisico[data-numero="' + numero + '"]');
      if (!el) {
        inexistentes.push(String(b.numero));
        continue;
      }
      const et = el.querySelector('.etiqueta');   // renombra sin perder la pista de tecla
      if (et) et.textContent = b.id || numero;    // sin "id" se queda el número
      // El botón que el cartucho llama "Start" es el que enciende el
      // juego, sea cual sea su número físico (6, 7, 8…).
      if (b.id && String(b.id).trim().toLowerCase() === 'start') {
        numeroStart = numero;
      }
      usados.add(numero);
    }
    // Setup >= cartucho (F3-I1): jugar con MENOS botones que la
    // máquina ofrece está bien (los no usados se eliminan); usar un
    // botón que la máquina no tiene, NO: el cartucho no carga.
    if (inexistentes.length > 0) {
      return 'el cartucho usa ' + (inexistentes.length === 1 ?
        'el botón ' + inexistentes[0] + ', que no existe' :
        'los botones ' + inexistentes.join(', ') + ', que no existen') +
        ' en la máquina de estilo ' + setup.estilo + '.';
    }
    for (const el of document.querySelectorAll('.botonFisico')) {
      if (!usados.has(el.dataset.numero)) el.remove();
    }
    return true;
  }

  // ---------------- Aplicación del setup ----------------

  /**
   * Aplica el setup validado: muestra el esqueleto del estilo, dimensiona
   * el canvas, construye la botonera y deja el panel listo.
   * @returns {void}
   */
  function aplicarSetup() {
    // Cada estilo es un DISEÑO INDEPENDIENTE: se muestra solo su
    // esqueleto y la pantalla se cuelga en el hueco de ese diseño.
    const estilo = ESTILOS[setup.estilo];
    for (const e of Object.values(ESTILOS)) $(e.esqueleto).classList.add('oculto');
    const esqueleto = $(estilo.esqueleto);
    esqueleto.classList.remove('oculto');
    esqueleto.querySelector('.huecoPantalla').appendChild($('pantalla'));

    const canvas = $('pantalla');
    canvas.width = setup.pantalla.ancho;
    canvas.height = setup.pantalla.alto;
    pintarFondoNeutro();
    construirBotonera();
    $('maquina').classList.remove('oculto');
    $('panelEstado').classList.remove('oculto');
    pintarInfo();
    $('btnCargarCartucho').classList.remove('oculto');
    $('btnCargarCartucho').disabled = false;
    $('btnCargarGWIZip').classList.remove('oculto');   // carga de un GWI en ZIP
    $('btnCargarGWIZip').disabled = false;
    $('btnCargarGWC').classList.remove('oculto');     // y del GWC suelto (F5-I6)
    $('btnCargarGWC').disabled = false;
    $('btnGuardar').classList.add('oculto');   // sin cartucho no hay nada que guardar
    $('btnGuardar').disabled = true;
    $('btnGenerar').classList.add('oculto');   // ni nada que generar (F5-I6)
    $('btnGenerar').disabled = true;
    $('btnDeshacer').classList.add('oculto'); // ni historial que deshacer
    $('btnDeshacer').disabled = true;
    $('btnRehacer').classList.add('oculto');
    $('btnRehacer').disabled = true;
    // El setup deja la vista de la MÁQUINA delante (la autoría aún no
    // existe): con las pestañas, cargar el setup es ver el aparato.
    // El Editor queda disponible: desde él se carga el GWB.
    actualizarPestanas();
    mostrarPestanna('vistaSimulador');
    // Arriba indica la última operación realizada
    avisar('Setup cargado: ' + (setup.nombre || '(sin nombre)'));
  }

  /**
   * Evento del input de setup: lee y valida el fichero; si es correcto
   * limpia el cartucho anterior y aplica el nuevo. Si falla, se
   * conserva la máquina anterior (si la había).
   * @returns {Promise<void>}
   */
  async function alSeleccionarSetup() {
    const fichero = $('ficheroSetup').files[0];
    $('ficheroSetup').value = '';              // permite recargar el mismo fichero
    if (!fichero) return;
    console.log('[setup] fichero seleccionado: ' + fichero.name);
    try {
      const json = await leerJSON(fichero);
      const error = validarSetup(json);
      if (error) throw new Error(error);
      limpiarCartucho();                       // recargar setup limpia el cartucho actual
      BaseCartucho.revocarURLs();              // y las object URLs del cartucho viejo
      setup = json;
      aplicarSetup();
    } catch (e) {
      // Setup incorrecto: se conserva la máquina anterior (si la había)
      avisarError('Setup NO cargado: ' + e.message);
    }
  }

  // ---------------- Panel de información (F5-I7) ----------------

  /**
   * Bytes en texto legible, o «—» si no hay dato.
   * @param {?number} bytes - Tamaño en bytes.
   * @returns {string} P. ej. «7.342 bytes».
   */
  function textoBytes(bytes) {
    return bytes === null ? '—' : bytes.toLocaleString('es-ES') + ' bytes';
  }

  /**
   * Pinta el panel de información. La línea de la máquina (cartucho,
   * pantalla y botones) se ve en Simulador y Editor; la del diseño
   * (segmentos, imágenes y tamaños) solo en el Editor. Cuál se ve lo
   * decide el CSS con la pestaña activa: aquí se rellenan las dos.
   * @returns {void}
   */
  function pintarInfo() {
    if (!setup) return;
    $('infoMaquina').textContent =
      'Cartucho: ' + (cartucho ? cartucho.nombre || '(sin nombre)' : '(ninguno)') +
      ' · Pantalla: ' + setup.pantalla.ancho + '×' + setup.pantalla.alto +
      ' · Botones: ' + setup.estilo;
    const diseno = editable ? BaseDescomponer.resumen() : null;
    $('infoDiseno').textContent =
      'Segmentos: ' + (diseno ? diseno.segmentos : '—') +
      ' · Imágenes: ' + (diseno ? diseno.imagenes : '—') +
      ' · GWI: ' + textoBytes(tamGWI) + (tamGWI === null ? '' : ' (aprox.)') +
      ' · GWC: ' + textoBytes(tamGWC);
    // F5-I7+: debajo, la línea de la deduplicación (solo si la hay).
    $('infoDiseno').textContent +=
      deduplicacion ? '\n' + deduplicacion : '';
  }

  /**
   * Anota los tamaños del GWI y/o del GWC recién generados (los
   * campos ausentes no cambian) y repinta el panel.
   * @param {{gwi:?number, gwc:?number, deduplicacion:?string}} tamanos -
   *        Bytes de cada uno y la línea de deduplicación (o null para
   *        quitarla).
   * @returns {void}
   */
  function informarTamanos(tamanos) {
    if (tamanos.gwi !== undefined) tamGWI = tamanos.gwi;
    if (tamanos.gwc !== undefined) tamGWC = tamanos.gwc;
    if (tamanos.deduplicacion !== undefined) deduplicacion = tamanos.deduplicacion;
    pintarInfo();
  }

  /**
   * Tamaño aproximado de un GWI cargado: la suma de sus JSON y PNG,
   * con sus bytes reales y no lo que ocupan en el disco ni en el ZIP.
   * @param {Array<Blob>} ficheros - Ficheros del cartucho.
   * @returns {number} Bytes.
   */
  function sumarGWI(ficheros) {
    return ficheros.filter(f => /\.(json|png)$/i.test(f.name || ''))
      .reduce((suma, f) => suma + f.size, 0);
  }

  /**
   * Las "etiquetas" del cartucho dan nombres legibles a los seg_N;
   * avisa de las que no corresponden a ningún segmento real.
   * @param {?Object} etiquetas - Etiquetas del cartucho.
   * @param {Array<Object>} segs - Segmentos reales.
   * @returns {void}
   */
  function avisarEtiquetas(etiquetas, segs) {
    if (!etiquetas) return;
    for (const id of Object.keys(etiquetas)) {
      if (!segs.some(g => g.id === id)) {
        console.warn('El cartucho etiqueta un segmento que no existe: ' + id);
      }
    }
  }

  // ---------------- Carga del cartucho (delegada en BaseCartucho) ----------------
  // La LECTURA (mapa de ficheros, JSON prioritario, validación e imágenes)
  // vive en BaseCartucho.js (traspaso F5-I4); el director conserva la
  // orquestación: eventos de los inputs, el detector de forma (F5-I9),
  // el flujo automático por tipo y el arrastre de las listas al puente.

  /**
   * Evento del botón «Cargar GWB» (input de carpeta): copia inmediata de
   * los File (al vaciar el input, su FileList muere) y llamada al núcleo
   * unificado con el tipo esperado.
   * @returns {Promise<void>}
   */
  async function alSeleccionarCartucho() {
    // Copia inmediata de los File a un array ANTES de limpiar el value:
    // al vaciar el input, su FileList queda vacía y una referencia directa
    // a ella moriría a cero ficheros, sin mostrar mensaje alguno.
    const ficheros = Array.from($('carpetaCartucho').files);
    $('carpetaCartucho').value = '';           // permite recargar la misma carpeta
    if (ficheros.length === 0) {
      avisarError('No se ha leído ningún fichero de la carpeta seleccionada.');
      return;
    }
    console.log('[cartucho] carpeta seleccionada: ' + ficheros.length + ' fichero(s)');
    await cargarCartucho(ficheros, 'GWB');
  }

  /**
   * Evento del botón «Cargar GWB (ZIP)» (F5-I10): la doble vía de
   * entrada del GWB hasta el panel único de carga. El ZIP viaja solo
   * hasta el núcleo unificado, que lo descomprime en memoria y entra
   * en el flujo de carpeta con el tipo esperado 'GWB': un GWB
   * empaquetado carga IGUAL que la carpeta (la forma la detecta el
   * programa por el contenido).
   * @returns {Promise<void>}
   */
  async function alSeleccionarGWBZip() {
    const fichero = $('ficheroGWBZip').files[0];
    $('ficheroGWBZip').value = '';            // permite recargar el mismo ZIP
    if (!fichero) return;
    console.log('[cartucho] ZIP de GWB seleccionado: ' + fichero.name);
    await cargarCartucho([fichero], 'GWB');
  }

  /**
   * Núcleo UNIFICADO de carga (F5-I9): un solo flujo para las tres
   * formas del cartucho, decididas por el CONTENIDO de la selección y
   * no por el botón. El botón declara el tipo ESPERADO; el código
   * detecta el tipo real y, si no coincide, error BLOQUEANTE (el
   * cartucho no se carga). Detector de forma, en este orden:
   *   1. UN fichero .zip → se descomprime (abrirZIP) y el resultado
   *      vuelve a entrar aquí (un ZIP es una carpeta en memoria).
   *   2. UN fichero .gwc → carga binaria (procesarGWC).
   *   3. Resto → flujo de carpeta (procesarCartucho), que resuelve el
   *      JSON prioritario por tipo (GWC > GWI > GWB).
   * @param {Array<Blob>} ficheros - Ficheros del cartucho.
   * @param {string} tipoEsperado - 'GWB', 'GWI' o 'GWC' según el botón.
   * @returns {Promise<?string>} El tipo de cartucho cargado (o null si
   *   no se cargó nada).
   */
  async function cargarCartucho(ficheros, tipoEsperado) {
    try {
      if (ficheros.length === 1) {
        const nombre = ficheros[0].name || '';
        // UN .zip: carpeta empaquetada; se descomprime en memoria y el
        // resultado vuelve a entrar en el detector, con el MISMO tipo
        // esperado (la forma no cambia al descomprimir).
        if (/\.zip$/i.test(nombre)) {
          return await cargarCartucho(
            await BaseCartucho.abrirZIP(ficheros[0]), tipoEsperado);
        }
        // UN .gwc: el cartucho de ejecución binario viaja solo.
        if (/\.gwc$/i.test(nombre)) {
          if (tipoEsperado !== 'GWC') {
            throw new Error('se esperaba un cartucho ' + tipoEsperado +
              ' y el fichero es un GWC binario.');
          }
          await procesarGWC(ficheros[0]);
          return 'GWC';
        }
      }
      // En cualquier otro caso: flujo de carpeta (GWB, GWI en carpeta o
      // en ZIP ya descomprimido, o una carpeta que trae un .gwc).
      return await procesarCartucho(ficheros, tipoEsperado);
    } catch (e) {
      // Mensaje de error ÚNICO de la carga (F5-I9): desaparecen los
      // «ZIP GWI NO cargado» y «GWC NO cargado» por botón.
      avisarError('Cartucho NO cargado: ' + e.message);
      return null;
    }
  }

  /**
   * Flujo de CARPETA del cartucho (F5-I9: llamado desde el núcleo
   * unificado cargarCartucho), venga la carpeta de un input
   * webkitdirectory o de un ZIP descomprimido en memoria: el
   * director DELEGA la lectura en BaseCartucho (mapa de ficheros, JSON
   * prioritario, validación despachada por tipo e imágenes, F5-I4) y
   * orquesta lo demás: flujo automático por tipo y arrastre de las
   * listas al puente. Cada fichero solo necesita ".name" y
   * comportarse como Blob (File ya lo es).
   * @param {Array<Blob>} ficheros - Ficheros del cartucho.
   * @param {string} tipoEsperado - Tipo que espera el botón (F5-I9).
   * @returns {Promise<?string>} El tipo de cartucho cargado (o null).
   */
  async function procesarCartucho(ficheros, tipoEsperado) {
    // El GWC (F5-I6) es BINARIO: no hay JSON que leer. Si la carpeta
    // trae un .gwc, se carga por su propio flujo (leerGWC) y el JSON
    // prioritario ni se mira; pero el tipo esperado del botón manda
    // (F5-I9): una carpeta con .gwc en «Cargar GWB» no carga.
    const gwc = ficheros.find(f => /\.gwc$/i.test(f.name || ''));
    if (gwc) {
      if (tipoEsperado !== 'GWC') {
        throw new Error('se esperaba un cartucho ' + tipoEsperado +
          ' y la selección trae un GWC binario.');
      }
      await procesarGWC(gwc);
      return 'GWC';
    }
    try {
      // Las object URLs del cartucho ANTERIOR mueren antes de leer el
      // nuevo: leerCartucho crea las del nuevo en su módulo, y una
      // revocación tardía las mataría a ellas. Las imágenes YA cargadas
      // del cartucho viejo no sufren (un HTMLImageElement descargado no
      // necesita su URL).
      BaseCartucho.revocarURLs();
      // Lectura completa en el módulo: JSON prioritario, validación
      // despachada por tipo con el tipo esperado del botón (F5-I9)
      // contra la máquina (estilo del setup) e imágenes img_f/img_s.
      const leido = await BaseCartucho.leerCartucho(ficheros, setup.estilo,
        tipoEsperado);
      const json = leido.json;
      const mapa = leido.mapa;

      limpiarCartucho();                       // fuera el cartucho anterior
      cartucho = json;
      const tipo = json.tipo;                  // obligatorio: sin tipo no se carga
      // Tamaño del GWI cargado (aproximado: JSON + PNG); un GWB no tiene
      tamGWI = tipo === 'GWI' ? sumarGWI(ficheros) : null;
      // Setup >= cartucho (F3-I1): si el cartucho pide un botón que
      // la máquina no tiene, NO carga (error bloqueante, no un
      // aviso en consola como antes).
      const compat = aplicarBotonesCartucho(json);   // renombra usados, elimina el resto
      if (compat !== true) throw new Error(compat);

      imgF = leido.imgF;
      pintarFondoCartucho(imgF);
      // El fondo (img_f) es SIEMPRE el fondo en todas las vistas; el
      // BaseGraficos lo guarda: DibujarFondo y el XOR lo necesitan.
      BaseGraficos.fijarFondo(imgF);

      // img_s: la base de la geometría (leída por el módulo; en GWI
      // puede venir como fichero propio copiado al guardar).
      imgS = leido.imgS;
      BaseDescomponer.reset();                     // autoría anterior, fuera
      // El puente se escribe DESPUÉS del reset: limpiar() vacía fondo y
      // reglas, y lo que se fija antes lo borraría (bug F3-I2 pillado
      // por la simulación: el reset de la autoría se comía el fondo).
      ComunListas.fijarFondo(imgF);   // el fondo, para el juego
      // Las reglas del juego (hoy: si combina dos teclas en un mismo
      // tick, F3-I1) también viajan por el puente: la autoría escribe
      // al cargar, el motor de estados lee en cada tick.
      ComunListas.fijarReglas({ combinar: !!json.combinar });
      // Mecanismo de fin de partida (F3-I11, v12.5): PROPIEDAD del
      // cartucho — viaja en el campo «fin» del GWI al nivel superior
      // (no como segmento tipo 7) y cruza el puente como las reglas.
      ComunListas.fijarFin(json.fin || null);
      ComunListas.fijarSecuencia(json.secuencia || null);   // la Secuencia, igual que el fin
      // F4-I2: pausas, aceleración y política de rutas del cartucho
      // al nivel superior del GWI — igual que el fin y la Secuencia.
      // La regla «combinar» del teclado NO sube al GWI (decisión del
      // usuario: queda como AMPLIACIÓN futura; hoy sigue viniendo
      // del setup por reglas()).
      ComunListas.fijarPausas(json.pausas || null);
      ComunListas.fijarAceleracion(json.aceleracion || null);
      ComunListas.fijarRutas(json.rutas || null);
      // GWB: pantalla = solo fondo HASTA descomponer (entonces la
      // autoría pinta fondo + segmentos negros con refrescar).

      if (tipo === 'GWI') {
        // Flujo de modificación: listas a memoria para el motor SIN
        // descomponer, y el editor se abre DIRECTAMENTE: re-extrae +
        // precarga la autoría del GWI.
        if (Array.isArray(json.sprites)) {
          BaseDescomponer.cargarListas(json.sprites, json.segmentos);
          // El GWI referencia los sprites como "segmentos/img_NNN.png",
          // pero el mapa de ficheros es plano (nombre → File): se
          // resuelve también por el nombre solo, por si acaso.
          if (imgS) {
            BaseDescomponer.pintarGWI(imgS, json.sprites, json.segmentos,
              fich => BaseCartucho.cargarImagen(mapa.get(fich) ||
                mapa.get(fich.split('/').pop())));
          }
        }
        console.info('[cartucho] GWI cargado: ' + (json.sprites ? json.sprites.length : 0) +
          ' sprite(s), ' + (json.segmentos ? json.segmentos.length : 0) +
          ' segmento(s) en memoria, listos para el motor.');
        descomponerImagen();                   // editar autoría, automático
      } else {
        // GWB: flujo de creación — se descompone DIRECTAMENTE al cargar.
        // (Un JSON etiquetado GWC ya no llega aquí: la validación
        // despachada por tipo lo bloquea dentro de leerCartucho, F5-I9.)
        // GWB: flujo de creación — se descompone DIRECTAMENTE al cargar.
        if (!imgS) console.warn('El cartucho no declara img_s: no hay nada que descomponer.');
        descomponerImagen();                   // descomposición, automática
      }

      // img_m: portada para la futura pantalla de selección de juegos.
      // El módulo la carga en paralelo, sin bloquear, y de momento no
      // se muestra.
      leido.imgM.then(img => { imgM = img; });

      pintarInfo();
      // Arriba indica la última operación realizada (con el tipo de
      // cartucho cargado, F5-I9)
      avisar('Cartucho cargado (' + tipo + '): ' + (json.nombre || '(sin nombre)'));
      return tipo;
    } catch (e) {
      pintarInfo();
      avisarError('Cartucho NO cargado: ' + e.message);
      return null;
    }
  }

  /**
   * Evento del botón «Cargar GWI» (input de ficheros .zip, F5-I9): el
   * ZIP viaja solo hasta el núcleo unificado, que lo descomprime en
   * memoria y entra en el flujo de carpeta con el MISMO tipo esperado.
   * @returns {Promise<void>}
   */
  async function alSeleccionarGWIZip() {
    const fichero = $('ficheroGWIZip').files[0];
    $('ficheroGWIZip').value = '';            // permite recargar el mismo ZIP
    if (!fichero) return;
    console.log('[cartucho] ZIP seleccionado: ' + fichero.name);
    await cargarCartucho([fichero], 'GWI');
  }

  /**
   * Evento del botón «Cargar GWC» (F5-I9): el .gwc viaja solo hasta el
   * núcleo unificado, que lo reconoce por el CONTENIDO y ejecuta la
   * carga binaria: procesarGWC valida, fabrica fondo y sprites y deja
   * el juego LISTO para el Start.
   * @returns {Promise<void>}
   */
  async function alSeleccionarGWC() {
    const fichero = $('ficheroGWC').files[0];
    $('ficheroGWC').value = '';             // permite recargar el mismo GWC
    if (!fichero) return;
    console.log('[cartucho] GWC seleccionado: ' + fichero.name);
    await cargarCartucho([fichero], 'GWC');
  }

  // ---------------- Carga del GWC (F5-I6) ----------------

  /**
   * Carga de un cartucho GWC (el cartucho de EJECUCIÓN binario, F5-I6):
   * se valida con BaseCartucho.leerGWC (cabecera, suma de verificación,
   * bloques) y se presentan el fondo y los segmentos en pantalla —
   * visualmente lo mismo que un GWI — con el juego LISTO para arrancar:
   * las listas van al puente con la IMAGEN de cada segmento fabricada
   * de su máscara de 1 bit (el GWC no lleva PNG) y el fondo es un
   * canvas plano del color del Bloque 0 (la v1 no escribe el bloque de
   * fondo). El EDITOR NO SE TOCA: el GWC no lleva geometría ni
   * autoría, no hay nada que editar — y el estado previo (si había un
   * GWI en edición) se conserva intacto, que es lo que pide el ciclo
   * de ida y vuelta: cargar el GWC generado y, sin tocar nada,
   * generar de nuevo el GWI+GWC debe dar el mismo GWC byte a byte. Un
   * GWC corrupto NO se carga a medias: error explícito y el cartucho
   * anterior sigue donde estaba.
   * @param {File} fichero - El fichero .gwc seleccionado.
   * @returns {Promise<void>}
   */
  async function procesarGWC(fichero) {
    let leido = null;
    try {
      leido = BaseCartucho.leerGWC(new Uint8Array(await fichero.arrayBuffer()));
      // La máquina manda, como con el JSON: el estilo del Bloque 0
      // debe ser el del setup cargado.
      if (setup && String(leido.estilo) !== String(setup.estilo)) {
        throw new Error('el GWC es de estilo ' + leido.estilo +
          ' y la máquina cargada es de estilo ' + setup.estilo + '.');
      }
    } catch (e) {
      avisarError('Cartucho NO cargado: ' + e.message +
        ' (se conserva el cartucho anterior).');
      return;
    }
    BaseCartucho.revocarURLs();    // object URLs del cartucho anterior, fuera
    // El fondo del GWC es un COLOR (v1: sin bloque de fondo): se
    // fabrica un canvas plano del color del Bloque 0 — el mismo
    // camino que img_f (pintado, motor gráfico y puente).
    imgF = fabricarFondoColor(leido.fondo, leido.pantalla.ancho,
      leido.pantalla.alto);
    imgS = null;                   // el GWC no lleva img_s: sin geometría
    imgM = null;                   // ni portada
    pintarFondoCartucho(imgF);
    BaseGraficos.fijarFondo(imgF);
    // Las imágenes de los segmentos se fabrican de las MÁSCARAS de 1
    // bit (negro = 1, bit más significativo a la izquierda): las
    // mismas formas B/N que produce el editor.
    const imagenes = new Map();
    for (const s of leido.sprites) imagenes.set(s.id, fabricarSprite(s));
    for (const seg of leido.segmentos) {
      seg.imagen = imagenes.get(seg.sprite) || null;
    }
    // El cartucho equivalente en memoria (para el info del panel; el
    // Código GWC del par = el código «#HHHH#» leído). No es editable:
    // el editor conserva su estado previo.
    cartucho = {
      tipo: 'GWC', version: 1, nombre: fichero.name,
      estilo: leido.estilo, pantalla: leido.pantalla,
      codigoGWC: leido.codigo,
      fin: leido.fin || undefined,
      secuencia: leido.secuencia || undefined,
      pausas: leido.pausas, aceleracion: leido.aceleracion,
      rutas: leido.rutas,
      sprites: leido.sprites, segmentos: leido.segmentos
    };
    // Botonera: el GWC NO declara botones (son físicos del setup): se
    // restaura la botonera COMPLETA de la máquina (por si un cartucho
    // anterior eliminó alguna) y el Start vuelve a ser el de defecto.
    construirBotonera();
    numeroStart = '8';
    // Puente, como en el flujo del GWI: fondo, reglas, fin, Secuencia y
    // los campos del Director; y las listas con la imagen colgada de
    // cada segmento, listas para el motor.
    ComunListas.fijarFondo(imgF);
    ComunListas.fijarReglas({ combinar: false });
    ComunListas.fijarFin(leido.fin || null);
    ComunListas.fijarSecuencia(leido.secuencia || null);
    ComunListas.fijarPausas(leido.pausas || null);
    ComunListas.fijarAceleracion(leido.aceleracion || null);
    ComunListas.fijarRutas(leido.rutas || null);
    BaseDescomponer.cargarListas(leido.sprites, leido.segmentos);
    // Presentación: fondo + segmentos visibles en el aparato. Se
    // reutiliza el pintado del GWI (visualmente carga lo mismo que un
    // GWI) con las imágenes fabricadas como "loader" y la pantalla
    // declarada como referencia de escala (1: las listas del GWC ya
    // viven en coordenadas de pantalla).
    await BaseDescomponer.pintarGWI(
      { naturalWidth: leido.pantalla.ancho, naturalHeight: leido.pantalla.alto },
      leido.sprites.map(s => ({
        id: s.id, ancho: s.ancho, alto: s.alto,
        fichero: s.id
      })),
      leido.segmentos,
      id => imagenes.get(id));
    tamGWC = fichero.size;        // el GWC cargado: su tamaño exacto
    pintarInfo();
    console.info('[cartucho] GWC cargado: ' + leido.sprites.length +
      ' sprite(s), ' + leido.segmentos.length +
      ' segmento(s) en memoria, listos para el motor.');
    avisar('Cartucho cargado (GWC): ' + fichero.name);
    actualizarPestanas();       // solo Simulador: el GWC no se edita
    // El GWC es PURA EJECUCIÓN: al cargarlo, la máquina queda delante,
    // lista para pulsar Start (de venga de la pestaña que venga).
    mostrarPestanna('vistaSimulador');
  }

  /**
   * Fabrica el FONDO de un GWC: un canvas plano del color declarado en
   * el Bloque 0 (la v1 no escribe el bloque de fondo). El resto del
   * simulador lo consume como a img_f.
   * @param {string} color - Color '#RRGGBB' del Bloque 0.
   * @param {number} ancho - Ancho de la pantalla declarada.
   * @param {number} alto - Alto de la pantalla declarada.
   * @returns {HTMLCanvasElement} El canvas del fondo.
   */
  function fabricarFondoColor(color, ancho, alto) {
    const c = document.createElement('canvas');
    c.width = Math.max(1, ancho);
    c.height = Math.max(1, alto);
    const ctx = c.getContext('2d');
    ctx.fillStyle = color || '#FFFFFF';
    ctx.fillRect(0, 0, c.width, c.height);
    return c;
  }

  /**
   * Fabrica la IMAGEN de un sprite de GWC a partir de su máscara de 1
   * bit: blanco de fondo y negro donde el bit está a 1 (bit más
   * significativo a la izquierda), las mismas formas B/N que produce
   * el editor. Es lo único que el GWC no trae hecho: la máscara ES la
   * imagen.
   * @param {{id:string, ancho:number, alto:number, filas:Uint8Array}} s
   *        - Sprite leído (máscara).
   * @returns {HTMLCanvasElement} El canvas del sprite.
   */
  function fabricarSprite(s) {
    const c = document.createElement('canvas');
    c.width = s.ancho;
    c.height = s.alto;
    const ctx = c.getContext('2d');
    const n = Math.ceil(s.ancho / 8);
    const d = ctx.createImageData(s.ancho, s.alto);
    for (let y = 0; y < s.alto; y++) {
      for (let x = 0; x < s.ancho; x++) {
        const i = (y * s.ancho + x) * 4;
        const negro = (s.filas[y * n + (x >> 3)] & (0x80 >> (x & 7))) !== 0;
        d.data[i] = d.data[i + 1] = d.data[i + 2] = negro ? 0 : 255;
        d.data[i + 3] = 255;
      }
    }
    ctx.putImageData(d, 0, 0);
    return c;
  }

  // ---------------- Descomposición (delegada) ----------------
  // El BaseDirector orquesta; la autoría de segmentos vive en BaseDescomponer.js
  // (mapa de objetos, panel de propiedades, verificación y guardado del
  // GWI). Aquí solo se comprueban los requisitos y se delega.

  /**
   * Descomposición AUTOMÁTICA al cargar el cartucho: GWB → extraer la
   * geometría; GWI → editar autoría (re-extrae + precarga la sección
   * autoria). Ya no hay botón: el tipo del JSON decide el flujo.
   * @returns {void}
   */
  function descomponerImagen() {
    if (!imgS) {
      avisarError('No hay imagen de segmentos (img_s) para descomponer.');
      return;
    }
    const autoria = (cartucho && cartucho.tipo === 'GWI') ? cartucho.autoria : null;
    editable = BaseDescomponer.arrancar(imgS, cartucho, autoria);
    actualizarPestanas();         // Segmentos y Sprites: solo con autoría
    pintarInfo();
    if (!editable) return;        // el error ya lo ha avisado arrancar
    // La autoría arrancó bien: se habilita el guardado (los DOS
    // botones: «Verificar y Guardar» y «Generar GWI+GWC», F5-I6) y el
    // deshacer/rehacer del historial de autoría.
    $('btnGuardar').classList.remove('oculto');
    $('btnGuardar').disabled = BaseDescomponer.segmentos().length === 0;
    $('btnGenerar').classList.remove('oculto');
    $('btnGenerar').disabled = BaseDescomponer.segmentos().length === 0;
    $('btnDeshacer').classList.remove('oculto');
    $('btnDeshacer').disabled = false;
    $('btnRehacer').classList.remove('oculto');
    $('btnRehacer').disabled = false;
    // La autoría arranca en su pestaña: al descomponer, el editor
    // queda delante (la máquina pasa a ser una visita con su
    // pestaña). EXCEPCIÓN: un GWI cargado desde la pestaña Simulador
    // NO salta — el jugador carga el GWI para JUGAR, el editor no le
    // importa; el GWB (solo autoría) siempre salta.
    if (!cartucho || cartucho.tipo !== 'GWI' || pestanaVista === 'vistaEditor') {
      mostrarPestanna('vistaEditor');
    }
  }

  /**
   * Botón "Verificar y Guardar": delegado en BaseDescomponer.js.
   * @returns {void}
   */
  function verificarYGuardar() {
    BaseDescomponer.verificarYGuardar();
  }

  // ---------------- Teclado ----------------

  /**
   * Encuentra el botón físico asociado a una tecla (si existe).
   * @param {string} tecla - Tecla pulsada.
   * @returns {?HTMLElement} Botón físico, o null.
   */
  function buscarBotonPorTecla(tecla) {
    return document.querySelector('.botonFisico[data-tecla="' + tecla.toLowerCase() + '"]');
  }

  /**
   * Permite jugar sin ratón: cada botón físico lleva su tecla pintada.
   * @param {KeyboardEvent} ev - Evento de teclado.
   * @returns {void}
   */
  function alPulsarTecla(ev) {
    const el = buscarBotonPorTecla(ev.key);
    if (el) el.classList.add('pulsado');
    // La tecla del Start del sistema también lanza el simulador,
    // igual que pulsar el botón físico (el mismo criterio: id
    // "Start" del cartucho, por defecto el 8); cualquier OTRA
    // tecla del juego viaja al buffer como una pulsación física
    // (F3-I2): mismo número, misma vía.
    if (!el) return;
    if (String(el.dataset.numero) === numeroStart &&
      typeof JuegoDirector !== 'undefined') {
      JuegoDirector.arrancar();
    } else if (typeof JuegoDirector !== 'undefined' &&
      typeof JuegoDirector.pulsar === 'function') {
      JuegoDirector.pulsar(String(el.dataset.numero));
    }
  }

  /**
   * Soltar una tecla quita el resaltado de su botón.
   * @param {KeyboardEvent} ev - Evento de teclado.
   * @returns {void}
   */
  function alSoltarTecla(ev) {
    const el = buscarBotonPorTecla(ev.key);
    if (el) el.classList.remove('pulsado');
  }

  // ---------------- Pestañas y partida (F5-I7) ----------------

  /**
   * Cambia la vista activa (Simulador, Editor o Segmentos y Sprites).
   * Alterna las vistas y marca la pestaña activa; la barra de botones
   * y el panel de información siguen a la pestaña por CSS, con el
   * atributo data-vista del body. La lista de segmentos se construye
   * al entrar en su pestaña: así siempre refleja el diseño vigente.
   * @param {string} id - La vista: 'vistaSimulador', 'vistaEditor' o
   *        'vistaSprites'.
   * @returns {void}
   */
  function mostrarPestanna(id) {
    pestanaVista = id;
    const botones = { vistaSimulador: 'pesSimulador',
      vistaEditor: 'pesEditor', vistaSprites: 'pesSprites',
      vistaCartucho: 'pesCartucho' };
    for (const v of Object.keys(botones)) {
      $(v).classList.toggle('oculto', v !== id);
      $(botones[v]).classList.toggle('pestActiva', v === id);
    }
    document.body.dataset.vista = id;
    if (id === 'vistaSprites') BaseDescomponer.pintarListaSegmentos($('listaSegmentos'));
    // F5-I10: la ficha del cartucho se repinta al ENTRAR en la pestaña
    // (así siempre refleja el estado vigente del cartucho en memoria).
    if (id === 'vistaCartucho') BaseDescomponer.pintarFichaCartucho($('fichaCartucho'));
  }

  /**
   * Habilita las pestañas que tienen algo que mostrar: el Simulador
   * siempre; el Editor con el setup cargado (desde él se carga el
   * GWB); Segmentos y Sprites con autoría en marcha; Cartucho (F5-I10)
   * con un GWB o un GWI cargado (la ficha es manipulable con ambos;
   * el GWC, ejecución pura, no la activa). Durante la
   * partida, solo el Simulador.
   * @returns {void}
   */
  function actualizarPestanas() {
    // El GWC no trae la parte PC del cartucho (sin img_s no hay
    // geometría ni autoría): su edición queda como AMPLIACIÓN futura.
    // Con un GWC cargado, solo la pestaña Simulador está activa.
    const soloSimulador = cartucho !== null && cartucho.tipo === 'GWC';
    $('pesEditor').disabled = enJuego || !setup || soloSimulador;
    $('pesSprites').disabled = enJuego || !editable || soloSimulador;
    // F5-I10: la ficha del cartucho, con GWB o GWI en memoria.
    $('pesCartucho').disabled = enJuego || !cartucho || soloSimulador;
  }

  /**
   * Prepara el MODO JUEGO al pulsar el Start (lo llama el
   * JuegoDirector): la vista Simulador delante, la pantalla limpia al
   * fondo neutro —el motor gráfico presentará sobre ella lo que
   * toque— y, mientras dura la partida, las otras pestañas y los
   * botones de carga DESHABILITADOS (no ocultos). Vuelven con
   * finDePartida.
   * @returns {void}
   */
  function jugar() {
    enJuego = true;
    for (const id of BOTONES_CARGA) $(id).disabled = true;
    actualizarPestanas();
    mostrarPestanna('vistaSimulador');
    pintarFondoNeutro();          // máquina recién encendida
  }

  /**
   * Fin de la partida (lo llama el JuegoDirector al detenerse el
   * reloj): vuelven las pestañas y los botones de carga. La pantalla
   * queda congelada tal cual, como en las máquinas reales.
   * @returns {void}
   */
  function finDePartida() {
    enJuego = false;
    for (const id of BOTONES_CARGA) $(id).disabled = false;
    actualizarPestanas();
  }

  // ---------------- Arranque ----------------

  /**
   * Comprobación de salud: si falta algún elemento del index.html,
   * se avisa EN consola y en pantalla cuál es, en vez de reventar con
   * un TypeError críptico.
   * @returns {boolean} true si el index tiene todo lo necesario.
   */
  function comprobarSalud() {
    const necesarios = ['estado', 'pantalla', 'maquina',
      'panelEstado', 'infoMaquina', 'infoDiseno',
      'listaSegmentos', 'zonaMapa', 'mapaSegmentos',
      'panelSegmento', 'ficheroSetup', 'carpetaCartucho',
      'ficheroGWIZip', 'ficheroGWC',
      'ficheroGWBZip', 'btnCargarGWBZip',
      'pesSimulador', 'pesEditor', 'pesSprites', 'pesCartucho',
      'vistaSimulador', 'vistaEditor', 'vistaSprites', 'vistaCartucho',
      'fichaCartucho', 'lienzoEditor',
      'btnCargarSetup', 'btnCargarCartucho', 'btnCargarGWIZip', 'btnCargarGWC',
      'btnGuardar', 'btnGenerar', 'btnDeshacer', 'btnRehacer'];
    const faltan = necesarios.filter(id => $(id) === null);
    if (faltan.length > 0) {
      const msg = 'index.html desactualizado: faltan los elementos con id ' +
        faltan.map(i => '"' + i + '"').join(', ') + '.';
      console.error(msg);
      if ($('estado')) avisarError(msg);
      return false;
    }
    return true;
  }

  /**
   * Ctrl+Z / Ctrl+Y (o Ctrl+Shift+Z): deshacer y rehacer la última
   * acción de autoría, delegados en BaseDescomponer.js. No interfiere con
   * las teclas de la máquina (letras sueltas, sin Ctrl).
   * @param {KeyboardEvent} ev - Evento de teclado.
   * @returns {void}
   */
  function alAtajoTeclado(ev) {
    if (!ev.ctrlKey || ev.altKey || ev.metaKey) return;
    const k = (ev.key || '').toLowerCase();
    if (k === 'z' && !ev.shiftKey) {
      ev.preventDefault();
      BaseDescomponer.deshacer();
    } else if (k === 'y' || (k === 'z' && ev.shiftKey)) {
      ev.preventDefault();
      BaseDescomponer.rehacer();
    }
  }

  /**
   * Cablea botones, inputs, mapa y teclado. Único miembro público del
   * BaseDirector: lo llama la propia página al cargar.
   * @returns {void}
   */
  function inicializar() {
    if (!comprobarSalud()) return;            // sin index correcto no hay nada que cablear
    $('btnCargarSetup').addEventListener('click', () => $('ficheroSetup').click());
    $('btnCargarCartucho').addEventListener('click', () => $('carpetaCartucho').click());
    // F5-I10: la doble vía del GWB (carpeta o ZIP).
    $('btnCargarGWBZip').addEventListener('click', () => $('ficheroGWBZip').click());
    $('btnCargarGWIZip').addEventListener('click', () => $('ficheroGWIZip').click());
    $('btnCargarGWC').addEventListener('click', () => $('ficheroGWC').click());
    // Las TRES pestañas: máquina, autoría y segmentos con sus imágenes
    document.body.dataset.vista = 'vistaSimulador';
    $('pesSimulador').addEventListener('click', () => mostrarPestanna('vistaSimulador'));
    $('pesEditor').addEventListener('click', () => mostrarPestanna('vistaEditor'));
    $('pesSprites').addEventListener('click', () => mostrarPestanna('vistaSprites'));
    $('pesCartucho').addEventListener('click', () => mostrarPestanna('vistaCartucho'));
    $('btnGuardar').addEventListener('click', verificarYGuardar);
    // F5-I6: el botón «Generar GWI+GWC» — verificación bloqueante,
    // topes bloqueantes, GWC primero y GWI con el Código GWC del par
    // después. La lógica vive en BaseDescomponer.
    $('btnGenerar').addEventListener('click', () => BaseDescomponer.generarGWIyGWC());
    $('btnDeshacer').addEventListener('click', () => BaseDescomponer.deshacer());
    $('btnRehacer').addEventListener('click', () => BaseDescomponer.rehacer());
    BaseDescomponer.inicializar();                 // el clic del mapa, cableado por BaseDescomponer.js
    $('ficheroSetup').addEventListener('change', alSeleccionarSetup);
    $('carpetaCartucho').addEventListener('change', alSeleccionarCartucho);
    $('ficheroGWBZip').addEventListener('change', alSeleccionarGWBZip);
    $('ficheroGWIZip').addEventListener('change', alSeleccionarGWIZip);
    $('ficheroGWC').addEventListener('change', alSeleccionarGWC);
    document.addEventListener('keydown', alPulsarTecla);
    document.addEventListener('keyup', alSoltarTecla);
    document.addEventListener('keydown', alAtajoTeclado);
  }

  // API pública: el arranque, los avisos de la barra de estado (que
  // usan BaseExtractor/BaseGraficos/BaseDescomponer vía BaseDirector.avisar /
  // BaseDirector.avisarError), la entrada y salida del modo juego (las
  // llama el JuegoDirector), el panel de información (lo repinta
  // BaseDescomponer) y las imágenes en memoria del cartucho (img_f/img_s/
  // img_m), que BaseDescomponer pasa a BaseCartucho.guardarGWI.
  return {
    inicializar: inicializar, avisar: avisar, avisarError: avisarError,
    jugar: jugar, finDePartida: finDePartida,
    pestanna: mostrarPestanna,            // abrir el Editor desde la lista de segmentos
    pintarInfo: pintarInfo, informarTamanos: informarTamanos,
    pantallaDeSetup: () => (setup && setup.pantalla)
      ? { ancho: setup.pantalla.ancho, alto: setup.pantalla.alto } : null,
    imagenFondo: () => imgF, imagenSegmentos: () => imgS,
    imagenPortada: () => imgM,           // img_m: la pasa guardarGWI al ZIP
    imagenBlob: (img) => BaseCartucho.imagenBlob(img)
  };

})();

BaseDirector.inicializar();