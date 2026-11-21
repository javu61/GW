'use strict';

// BaseDirector.js
// ====================================================================================================
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
//   $                        Atajo de getElementById
//   avisar / avisarError     Mensajes de la barra.
//   _leerJSON                 Lee el setup (copia local mínima).
//
//  Setup
//   validarSetup             Valida el JSON del hardware.
//   _aplicarSetup             Esqueleto del estilo, canvas y botonera.
//   _alSeleccionarSetup       Evento del input: valida, limpia y aplica.
//
//  Botonera
//   _crearBotonFisico         Un botón físico: hueco, tecla, etiqueta.
//   _construirBotonera        La botonera del estilo del setup.
//   _normalizarNumeroBoton    Número o alias → botón físico canónico.
//   _aplicarBotonesCartucho   Botones del cartucho sobre la botonera.
//   _montarBotonesSistema     Activa el trío A/B/R en modo sistema (GWI/GWC).
//   _etiquetarSistema         Etiquetas del trío según el estado: fuera de
//                            partida A/B/R; en partida Pausa/Stop y R oculto.
//   _pulsarBoton              ÚNICO despacho de un botón (ratón y teclado).
//   pulsarSistema / lanzarJuego
//                            Trío: fuera de partida arranca con el TIPO
//                            (0, 1, 2 = A, B, R); en partida A = SetPausa
//                            y B = SetStop (R sin función).
//
//  Limpieza y dibujo
//   _limpiarCartucho          Vacía el cartucho en memoria (y la autoría).
//   _pintarFondoNeutro        Color de "sin cartucho".
//   _pintarFondoCartucho      img_f escalada para LLENAR el canvas (ColorFondo/blanco sin fondo).
//
//  Panel de información (F5-I7)
//   pintarInfo               Máquina y cartucho; en el Editor, el diseño.
//   informarTamanos          Tamaños del GWI y del GWC generados y línea de deduplicación.
//   _sumarGWI                 Tamaño aproximado de un GWI cargado.
//
//  Carga del cartucho (delegada en BaseCartucho)
//   _alSeleccionarCartucho    Evento de la carpeta (copia los File).
//   _alSeleccionarGWBZip      Botón «Cargar GWB (ZIP)» (F5-I10): doble
//                            vía de entrada del GWB hasta el panel único.
//   _cargarCartucho           Núcleo UNIFICADO (F5-I9): detector de forma
//                            por el CONTENIDO + tipo esperado del botón.
//   _procesarCartucho         Flujo de carpeta: lectura, puente y flujo.
//   _alSeleccionarGWIZip      Botón «Cargar GWI»: el .zip viaja solo.
//   _alSeleccionarGWC         Botón «Cargar GWC»: el .gwc viaja solo.
//
//  Presentación del GWC
//   _volcarAlPuente           Fondo, reglas y campos del Director al puente
//                            (compartido por GWI/GWB y GWC).
//   _procesarGWC              Binario: leerGWC + puente + presentación.
//   _fondoDeColor             Fondo plano del ColorFondo (null si es blanco).
//   _fabricarFondoColor       Canvas plano del color del Bloque 0.
//   _fabricarSprite           Imagen de una máscara de 1 bit.
//
//  Edición, teclado y juego
//   _descomponerImagen        Arranca la autoría (según el tipo).
//   _verificarYGuardar        Delegado en BaseDescomponer.
//   buscarBotonPorTecla / alPulsarTecla / alSoltarTecla
//                            Jugar con el teclado.
//   _alAtajoTeclado           Ctrl+Z / Ctrl+Y del historial.
//
//  Pestañas y partida (F5-I7)
//   mostrarPestanna          Cambia de vista; la barra y el panel la siguen.
//   _actualizarPestanas       Qué pestañas están disponibles.
//   jugar / finDePartida     Entrar y salir del modo juego (finDePartida
//                            la llama el JuegoDirector: ÚNICA salida).
//   _comprobarSalud           Los id del index.html, todos presentes.
//   inicializar              Cablea botones, inputs, mapa y teclado.
//
// JS puro, script clásico sin módulos ES (compatible con file://).
// Encapsulado como los demás ficheros del proyecto: IIFE con el
// objeto público BaseDirector.
//
//  Otras funciones internas (lista completada en F5-I14)
//   _procesarSetup                Proceso del setup GWS dentro del núcleo unificado (F5-I10):
//   _aplicarJSONSetup             Valida y APLICA un setup ya leído (de fichero o de la ficha de la p…
//   _aplicarDesdeFichaSetup       Botón «Aplicar» de la pestaña Setup (F5-I12):
//   _aplicarDesdeFichaCartucho    Botón «Aplicar» de la pestaña Cartucho (F5-I12):
//   _textoBytes                   Bytes en texto legible, o «—» si no hay dato.
//   _buscarBotonPorTecla          Encuentra el botón físico asociado a una tecla (si existe).
//   _alPulsarTecla                Permite jugar sin ratón:
//   _alSoltarTecla                Soltar una tecla quita el resaltado de su botón.
//   _pulsarSistema                Pulsación de un botón del trío en modo sistema (F5-I10).
//   _lanzarJuego                  Lanza la partida con el TIPO del botón pulsado (F5-I10):
// ====================================================================================================

var BaseDirector = (function () {

  // Trío de sistema (F5-I10): A/B/R como en las máquinas reales
  // (GAME A / GAME B / TIME). Constantes para NO repetir valores.
  const BOTON_A = '6';
  const BOTON_B = '7';
  const BOTON_R = '8';
  // TIPO de arranque que recibe JuegoDirector.arrancar según el botón.
  const TIPO_SISTEMA = { [BOTON_A]: 0, [BOTON_B]: 1, [BOTON_R]: 2 };
  const TIPO_A = TIPO_SISTEMA[BOTON_A];

  // ---------------- Estado privado del BaseDirector ----------------

  let setupGWS = null;                       // JSON del hardware leído
  let cartucho = null;                    // JSON del cartucho leído
  let pestanaVista = 'vistaSetup';        // vista activa (la fija mostrarPestanna; F5-I12: arranca en Setup)
  let imgM = null;                        // portada (img_m): cargada pero aún sin uso visual
  let colorFondo = '#FFFFFF';             // ColorFondo del cartucho (fondo si no hay img_f; F5-I14)
  let imgF = null;                        // fondo (img_f): guardado en memoria para el motor gráfico
  let imgS = null;                        // imagen de segmentos (img_s): fuente de los sprites
  let numeroStart = BOTON_R;              // botón que arranca el juego (id "Start" del cartucho)
  let editable = false;                   // hay autoría en marcha (GWB o GWI): pestaña Segmentos y Sprites
  let enJuego = false;                    // partida en marcha: solo el Simulador
  let botonesSistema = false;             // F5-I10: trío A/B/R en modo sistema (tras GWI/GWC)
  let tamGWI = null;                      // bytes del GWI generado o cargado (JSON + PNG, aproximado)
  let tamGWC = null;                      // bytes del GWC generado o cargado (exacto)
  let deduplicacion = null;               // línea de deduplicación del último «Generar GWI+GWC»

  // Botones de carga de cartucho (los que aparecen al cargar el setup) y
  // todos los de carga (el setup incluido): se deshabilitan durante la partida
  // F5-I12: los botones viven dentro de su pestaña y un mismo botón puede
  // estar en varias (un id HTML no se repite: cada ejemplar tiene el suyo
  // y comparten manejador). Setup: btnCargarSetup, btnAplicarSetup,
  // btnGuardarSetup. Cartucho: btnCargarCartucho (GWB carpeta),
  // btnCargarGWBZip, btnCargarGWIZip, btnAplicarCartucho, btnGuardarGWB.
  // Editor: btnEdGWB, btnEdGWBZip, btnEdGWI + los de autoría. Simulador:
  // btnSimGWI, btnSimGWC.
  const BOTONES_SETUP = ['btnCargarSetup', 'btnAplicarSetup', 'btnGuardarSetup'];
  // Botones que necesitan un setup aplicado (se deshabilitan en la partida)
  const BOTONES_CARTUCHO = ['btnCargarCartucho', 'btnCargarGWBZip', 'btnCargarGWIZip',
    'btnAplicarCartucho', 'btnGuardarGWB', 'btnEdGWB', 'btnEdGWBZip', 'btnEdGWI',
    'btnSimGWI', 'btnSimGWC'];
  // Botones de autoría: deshabilitados mientras no hay cartucho editable
  const BOTONES_AUTORIA = ['btnGuardar', 'btnGenerar', 'btnDeshacer', 'btnRehacer'];
  // Cada acción de carga, con TODOS sus ejemplares (uno por pestaña)
  const BOTONES_ACCION = {
    gwbCarpeta: ['btnCargarCartucho', 'btnEdGWB'],
    gwbZip: ['btnCargarGWBZip', 'btnEdGWBZip'],
    gwi: ['btnCargarGWIZip', 'btnEdGWI', 'btnSimGWI'],
    gwc: ['btnSimGWC']
  };

  const COLOR_FONDO_NEUTRO = '#888888';

  // Identificación del formato del fichero de setup
  const GWS_TIPO = 'GWS';               // campo "tipo" esperado en el setup.json (F5-I10: GWS como los demás JSON del proyecto)
  const GWS_VERSION = '1';              // versión del formato que entiende este motor

  // Teclas del teclado PC asociadas a cada número de botón, para jugar
  // sin ratón. El setup puede reasignar cada botón con "tecla" (una
  // letra); si no la declara, se usa esta tabla por defecto.
  const TECLAS_POR_DEFECTO = {
    '0': 'Q',
    '1': 'A',
    '2': 'W',
    '3': 'S',
    '4': 'P',
    '5': 'L',
    '6': 'G',
    '7': 'B',
    '8': 'T'
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
  function _$(id) {
    return document.getElementById(id);
  }

  /**
   * Mensaje de éxito: SOLO en la barra superior (nunca se duplica abajo).
   * @param {string} mensaje - Texto a mostrar.
   * @returns {void}
   */
  function avisar(mensaje) {
    const el = _$('estado');
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
    const el = _$('estado');
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
  async function _leerJSON(fichero) {
    const texto = await fichero.text();
    return JSON.parse(texto);
  }

  // ---------------- Carga del setup ----------------

  /**
   * Valida el JSON del setup: tipo GW, versión 1.1, estilo conocido,
   * pantalla con dimensiones enteras y botones bien declarados.
   * Avisa en consola (sin bloquear) de números fuera de 0-8 o duplicados.
   * @param {Object} jsonGWS - JSON del setup leído.
   * @returns {?string} null si es válido, o el mensaje de error.
   */
  function validarSetup(jsonGWS) {
    if (!jsonGWS || typeof jsonGWS !== 'object' || Array.isArray(jsonGWS)) {
      return 'el setup no es un objeto JSON.';
    }
    const res = jsonGWS.resolucion;
    if (!res) {
      return 'el setup no ha podido cargarse, no tiene informada la "resolución".';
    }
    if (jsonGWS.tipo !== GWS_TIPO) {
      return 'no es un fichero de setup GWS: "tipo" es "' +
        (jsonGWS.tipo === undefined ? '(falta)' : jsonGWS.tipo) + '", se espera "' + GWS_TIPO + '".';
    }
    if (jsonGWS.version !== GWS_VERSION) {
      return 'versión de setup no soportada: "' +
        (jsonGWS.version === undefined ? '(falta)' : jsonGWS.version) +
        '", este motor entiende la "' + GWS_VERSION + '".';
    }
    if (jsonGWS.estilo === undefined || !ESTILOS[jsonGWS.estilo]) {
      return 'el setup necesita un "estilo" de máquina válido: ' +
        Object.keys(ESTILOS).join(', ') + '.';
    }
    if (!Number.isInteger(res.ancho) || !Number.isInteger(res.alto) ||
      res.ancho <= 0 || res.alto <= 0) {
      return 'el setup necesita una "resolucion" con "ancho" y "alto" enteros positivos.';
    }
    if (!Array.isArray(jsonGWS.botones)) {
      return 'el setup necesita un array "botones".';
    }
    const vistos = new Set();
    const teclasVistas = new Set();
    for (const b of jsonGWS.botones) {
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
  function _limpiarCartucho() {
    cartucho = null;
    editable = false;
    botonesSistema = false;   // F5-I10: fuera el modo sistema del trío
    tamGWI = null;
    tamGWC = null;
    imgM = null;
    imgF = null;
    colorFondo = '#FFFFFF';
    imgS = null;
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
  function _pintarFondoNeutro() {
    const canvas = _$('pantalla');
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
  function _pintarFondoCartucho(img) {
    const canvas = _$('pantalla');
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
  function _crearBotonFisico(boton, pos) {
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
      _pulsarBoton(String(boton.numero));   // el despacho es único (ratón y teclado)
    });
    el.addEventListener('pointerup', () => el.classList.remove('pulsado'));
    el.addEventListener('pointerleave', () => el.classList.remove('pulsado'));
    return el;
  }

  /**
   * ÚNICO despacho de la pulsación de un botón físico (F5-I10), venga
   * del ratón (pointerdown) o del teclado (alPulsarTecla):
   *  - Trío A/B/R en modo sistema (tras GWI/GWC): pulsarSistema.
   *  - Si no, el Start del sistema (el botón que el cartucho llama
   *    "Start"; por defecto el 8) lanza el simulador con el tipo A.
   *  - Cualquier otro botón viaja al buffer del juego (F3-I2).
   * @param {string} numero - Número del botón físico.
   * @returns {void}
   */
  function _pulsarBoton(numero) {
    if (botonesSistema && TIPO_SISTEMA[numero] !== undefined) {
      _pulsarSistema(numero);
      return;
    }
    if (typeof JuegoDirector === 'undefined') return;
    if (numero === numeroStart) {
      JuegoDirector.arrancar(TIPO_A);
    } else if (typeof JuegoDirector.pulsar === 'function') {
      JuegoDirector.pulsar(numero);
    }
  }

  /**
   * Crea la botonera que define el ESTILO de máquina del setup. Las
   * declaraciones de "botones" del setup aportan puerto y alias; si un
   * botón del estilo no está declarado, se crea igual (con aviso, sin
   * puerto), y si un botón declarado no pertenece al estilo, se ignora.
   * @returns {void}
   */
  function _construirBotonera() {
    // Vacía TODOS los contenedores de TODOS los diseños (cada estilo
    // tiene los suyos propios), para que quede solo lo del estilo activo.
    const contenedores = new Set();
    for (const e of Object.values(ESTILOS)) {
      for (const pos of Object.values(e.botones)) contenedores.add(pos.contenedor);
    }
    for (const id of contenedores) _$(id).replaceChildren();
    const estilo = ESTILOS[setupGWS.estilo];
    const declarados = new Map(setupGWS.botones.map(b => [b.numero, b]));
    for (const numero of Object.keys(estilo.botones)) {
      const pos = estilo.botones[numero];
      const decl = declarados.get(numero);
      if (!decl) {
        console.warn('El estilo ' + setupGWS.estilo + ' usa el botón ' + numero +
          ', que no está declarado en el setup; se crea sin puerto.');
      }
      _$(pos.contenedor).appendChild(_crearBotonFisico(decl || { numero: numero }, pos));
    }
    for (const numero of declarados.keys()) {
      if (!estilo.botones[numero]) {
        console.warn('Botón declarado que no existe en el estilo ' +
          setupGWS.estilo + ', se ignora: ' + numero);
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
  function _normalizarNumeroBoton(numero) {
    const n = String(numero);
    for (const b of setupGWS.botones) {
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
  function _aplicarBotonesCartucho(json) {
    _construirBotonera();
    numeroStart = BOTON_R;             // por defecto; el cartucho puede cambiarlo
    botonesSistema = false;            // régimen GWB/setup: el cartucho manda
    if (json.botones === undefined) {
      console.warn('El cartucho no declara botones; se dejan los del setup.');
      return true;
    }
    const usados = new Set();
    const inexistentes = [];
    for (const b of json.botones) {
      const numero = _normalizarNumeroBoton(b.numero);
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
        ' en la máquina de estilo ' + setupGWS.estilo + '.';
    }
    // En un GWI el trío A/B/R es del SISTEMA (F5-I10): no lo toca el
    // cartucho, se conserva aunque no lo use.
    const conservaTrio = json.tipo === 'GWI';
    for (const el of document.querySelectorAll('.botonFisico')) {
      const n = el.dataset.numero;
      if (!usados.has(n) && !(conservaTrio && TIPO_SISTEMA[n] !== undefined)) el.remove();
    }
    return true;
  }

  // ---------------- Aplicación del setup ----------------

  /**
   * Aplica el setup validado: muestra el esqueleto del estilo, dimensiona
   * el canvas, construye la botonera y deja el panel listo.
   * @returns {void}
   */
  function _aplicarSetup() {
    // Cada estilo es un DISEÑO INDEPENDIENTE: se muestra solo su
    // esqueleto y la pantalla se cuelga en el hueco de ese diseño.
    const estilo = ESTILOS[setupGWS.estilo];
    for (const e of Object.values(ESTILOS)) _$(e.esqueleto).classList.add('oculto');
    const esqueleto = _$(estilo.esqueleto);
    esqueleto.classList.remove('oculto');
    esqueleto.querySelector('.huecoPantalla').appendChild(_$('pantalla'));

    const canvas = _$('pantalla');
    canvas.width = setupGWS.resolucion.ancho;
    canvas.height = setupGWS.resolucion.alto;
    _pintarFondoNeutro();
    _construirBotonera();
    _$('maquina').classList.remove('oculto');
    _$('panelEstado').classList.remove('oculto');
    pintarInfo();
    // El setup aplicado deja delante la pestaña Cartucho (F5-I12): es
    // el siguiente paso. Las demás se habilitan según haya cartucho.
    _actualizarPestanas();
    mostrarPestanna('vistaCartucho');
    // Arriba indica la última operación realizada
    avisar('Setup cargado: ' + (setupGWS.nombre || '(sin nombre)'));
  }

  /**
   * Evento del input de setup: el fichero viaja solo hasta el núcleo
   * unificado con el tipo esperado 'GWS' (F5-I10), que lo despacha a
   * procesarSetup: un solo punto de entrada de cara al panel único.
   * @returns {Promise<void>}
   */
  async function _alSeleccionarSetup() {
    const fichero = _$('ficheroSetup').files[0];
    _$('ficheroSetup').value = '';              // permite recargar el mismo fichero
    if (!fichero) return;
    console.log('[setup] fichero seleccionado: ' + fichero.name);
    await _cargarCartucho([fichero], 'GWS');
  }

  /**
   * Proceso del setup GWS dentro del núcleo unificado (F5-I10): lee y
   * valida el fichero; si es correcto limpia el cartucho anterior (y
   * sus object URLs) y aplica el nuevo hardware. Si falla, se conserva
   * la máquina anterior (si la había): el error sube al try/catch del
   * núcleo, que lo presenta con el rótulo «Setup NO cargado».
   * @param {File} fichero - El .json del setup.
   * @returns {Promise<void>}
   */
  async function _procesarSetup(fichero) {
    const json = await _leerJSON(fichero);
    _aplicarJSONSetup(json);
  }

  /**
   * Valida y APLICA un setup ya leído (de fichero o de la ficha de la
   * pestaña Setup, F5-I12): limpia en cascada el cartucho y todo lo que
   * de él depende, aplica la máquina y rellena las dos fichas. Si no es
   * válido lanza un error y se conserva la máquina anterior.
   * @param {Object} json - El GWS.
   * @returns {void}
   */
  function _aplicarJSONSetup(json) {
    const error = validarSetup(json);
    if (error) throw new Error(error);
    _limpiarCartucho();                       // aplicar un setup limpia el cartucho actual
    BaseCartucho.revocarURLs();              // y las object URLs del cartucho viejo
    setupGWS = json;
    // La ficha del cartucho recibe del GWS el estilo y la resolución
    // (los ids de botón son del cartucho: quedan vacíos); la del setup,
    // todos sus datos.
    BaseFicha.reiniciar();
    BaseFicha.poblar({ estilo: json.estilo, resolucion: json.resolucion });
    BaseSetup.poblar(json);
    _aplicarSetup();
  }

  /**
   * Botón «Aplicar» de la pestaña Setup (F5-I12): verifica la ficha y
   * aplica el setup (limpia lo posterior, como cargar un setup nuevo).
   * @param {boolean} guardar - true en «Guardar GWS»: además lo descarga.
   * @returns {void}
   */
  function _aplicarDesdeFichaSetup(guardar) {
    try {
      let json;
      if (guardar) {
        json = BaseSetup.guardar();         // verifica, muestra y descarga
        if (!json) {
          avisarError('El GWS no se guarda ni se aplica: hay errores en la ficha.');
          return;
        }
      } else {
        const r = BaseSetup.verificar({ mostrar: true });
        if (r.errores.length > 0) {
          avisarError('Setup NO aplicado: hay ' + r.errores.length +
            (r.errores.length === 1 ? ' error' : ' errores') + ' en la ficha.');
          return;
        }
        json = r.json;
      }
      _aplicarJSONSetup(json);
      avisar((guardar ? 'Setup guardado y aplicado: ' : 'Setup aplicado: ') + json.nombre);
    } catch (e) {
      avisarError('Setup NO aplicado: ' + e.message);
    }
  }

  /**
   * Botón «Aplicar» de la pestaña Cartucho (F5-I12): verifica la ficha
   * y entrega al núcleo de carga el GWB que describe (en memoria), de
   * modo que un cartucho creado en la ficha y uno cargado de disco son
   * indistinguibles: se descartan los datos del Editor y de Sprites y
   * se extraen de nuevo.
   * @returns {Promise<void>}
   */
  async function _aplicarDesdeFichaCartucho() {
    if (!setupGWS) { avisarError('Aplica antes un setup.'); return; }
    const r = BaseFicha.verificar({ mostrar: true });
    if (r.errores.length > 0) {
      avisarError('Cartucho NO aplicado: hay ' + r.errores.length +
        (r.errores.length === 1 ? ' error' : ' errores') + ' en la ficha.');
      return;
    }
    const ficheros = await BaseFicha.ficherosGWB();
    await _cargarCartucho(ficheros, 'GWB');
  }

  // ---------------- Panel de información (F5-I7) ----------------

  /**
   * Bytes en texto legible, o «—» si no hay dato.
   * @param {?number} bytes - Tamaño en bytes.
   * @returns {string} P. ej. «7.342 bytes».
   */
  function _textoBytes(bytes) {
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
    if (!setupGWS) return;
    _$('infoMaquina').textContent =
      'Cartucho: ' + (cartucho ? cartucho.nombre || '(sin nombre)' : '(ninguno)') +
      ' · Pantalla: ' + setupGWS.resolucion.ancho + '×' + setupGWS.resolucion.alto +
      ' · Botones: ' + setupGWS.estilo;
    const diseno = editable ? BaseDescomponer.resumen() : null;
    _$('infoDiseno').textContent =
      'Segmentos: ' + (diseno ? diseno.segmentos : '—') +
      ' · Imágenes: ' + (diseno ? diseno.imagenes : '—') +
      ' · GWI: ' + _textoBytes(tamGWI) + (tamGWI === null ? '' : ' (aprox.)') +
      ' · GWC: ' + _textoBytes(tamGWC);
    // F5-I7+: debajo, la línea de la deduplicación (solo si la hay).
    _$('infoDiseno').textContent +=
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
  function _sumarGWI(ficheros) {
    return ficheros.filter(f => /\.(json|png)$/i.test(f.name || ''))
      .reduce((suma, f) => suma + f.size, 0);
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
  async function _alSeleccionarCartucho() {
    // Copia inmediata de los File a un array ANTES de limpiar el value:
    // al vaciar el input, su FileList queda vacía y una referencia directa
    // a ella moriría a cero ficheros, sin mostrar mensaje alguno.
    const ficheros = Array.from(_$('carpetaCartucho').files);
    _$('carpetaCartucho').value = '';           // permite recargar la misma carpeta
    if (ficheros.length === 0) {
      avisarError('No se ha leído ningún fichero de la carpeta seleccionada.');
      return;
    }
    console.log('[cartucho] carpeta seleccionada: ' + ficheros.length + ' fichero(s)');
    await _cargarCartucho(ficheros, 'GWB');
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
  async function _alSeleccionarGWBZip() {
    const fichero = _$('ficheroGWBZip').files[0];
    _$('ficheroGWBZip').value = '';            // permite recargar el mismo ZIP
    if (!fichero) return;
    console.log('[cartucho] ZIP de GWB seleccionado: ' + fichero.name);
    await _cargarCartucho([fichero], 'GWB');
  }

  /**
   * Núcleo UNIFICADO de carga (F5-I9): un solo flujo para las tres
   * formas del cartucho, decididas por el CONTENIDO de la selección y
   * no por el botón. El botón declara el tipo ESPERADO; el código
   * detecta el tipo real y, si no coincide, error BLOQUEANTE (el
   * cartucho no se carga). Detector de forma, en este orden:
   *   1. UN fichero de paquete → se descomprime (abrirPACK) y el resultado
   *      vuelve a entrar aquí (un paquete es una carpeta en memoria).
   *   2. UN fichero .gwc → carga binaria (procesarGWC).
   *   3. Resto → flujo de carpeta (procesarCartucho), que resuelve el
   *      JSON prioritario por tipo (GWC > GWI > GWB).
   * @param {Array<Blob>} ficheros - Ficheros del cartucho.
   * @param {string} tipoEsperado - 'GWB', 'GWI' o 'GWC' según el botón.
   * @returns {Promise<?string>} El tipo de cartucho cargado (o null si
   *   no se cargó nada).
   */
  async function _cargarCartucho(ficheros, tipoEsperado) {
    try {
      // GWS (F5-I10): el setup entra por el MISMO núcleo que los
      // cartuchos (un solo punto de entrada de cara al panel único de
      // carga). Un setup es SIEMPRE UN .json: otra forma no es un setup.
      if (tipoEsperado === 'GWS') {
        if (ficheros.length !== 1 || !/\.json$/i.test(ficheros[0].name || '')) {
          throw new Error('un setup es un único fichero .json.');
        }
        await _procesarSetup(ficheros[0]);
        return 'GWS';
      }
      if (ficheros.length === 1) {
        const nombre = ficheros[0].name || '';
        // UN .zip: carpeta empaquetada; se descomprime en memoria y el
        // resultado vuelve a entrar en el detector, con el MISMO tipo
        // esperado (la forma no cambia al descomprimir).
        if (BasePACK.esPACK(nombre)) {
          return await _cargarCartucho(
            await BaseCartucho.abrirPACK(ficheros[0]), tipoEsperado);
        }
        // UN .gwc: el cartucho de ejecución binario viaja solo.
        if (/\.gwc$/i.test(nombre)) {
          if (tipoEsperado !== 'GWC') {
            throw new Error('se esperaba un cartucho ' + tipoEsperado +
              ' y el fichero es un GWC binario.');
          }
          await _procesarGWC(ficheros[0]);
          return 'GWC';
        }
      }
      // En cualquier otro caso: flujo de carpeta (GWB, GWI en carpeta o
      // en ZIP ya descomprimido, o una carpeta que trae un .gwc).
      return await _procesarCartucho(ficheros, tipoEsperado);
    } catch (e) {
      // Mensaje de error ÚNICO de la carga (F5-I9): desaparecen los
      // «ZIP GWI NO cargado» y «GWC NO cargado» por botón. El setup
      // conserva su propio rótulo (F5-I10).
      avisarError((tipoEsperado === 'GWS' ? 'Setup NO cargado: ' :
        'Cartucho NO cargado: ') + e.message);
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
  async function _procesarCartucho(ficheros, tipoEsperado) {
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
      await _procesarGWC(gwc);
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
      const leido = await BaseCartucho.leerCartucho(ficheros, setupGWS.estilo,
        tipoEsperado);
      const json = leido.json;
      const mapa = leido.mapa;

      _limpiarCartucho();                       // fuera el cartucho anterior
      cartucho = json;
      const tipo = json.tipo;                  // obligatorio: sin tipo no se carga
      // Tamaño del GWI cargado (aproximado: JSON + PNG); un GWB no tiene
      tamGWI = tipo === 'GWI' ? _sumarGWI(ficheros) : null;
      // Setup >= cartucho (F3-I1): si el cartucho pide un botón que
      // la máquina no tiene, NO carga (error bloqueante, no un
      // aviso en consola como antes).
      const compat = _aplicarBotonesCartucho(json);   // renombra usados, elimina el resto
      if (compat !== true) throw new Error(compat);
      // GWI (F5-I10): trío de sistema en modo partida (A=Start, B, R),
      // con los botones de juego respetando el renombrado del cartucho.
      if (tipo === 'GWI') _montarBotonesSistema();

      imgF = leido.imgF;
      colorFondo = json.ColorFondo || '#FFFFFF';
      // Sin img_f, el fondo es el ColorFondo del cartucho (F5-I14); en
      // blanco (por defecto) no hace falta fabricar nada.
      const fondo = imgF || _fondoDeColor(colorFondo);
      _pintarFondoCartucho(fondo);
      // El fondo es SIEMPRE el fondo en todas las vistas; el
      // BaseGraficos lo guarda: DibujarFondo y el XOR lo necesitan.
      BaseGraficos.fijarFondo(fondo);

      // img_s: la base de la geometría (leída por el módulo; en GWI
      // puede venir como fichero propio copiado al guardar).
      imgS = leido.imgS;
      BaseDescomponer.reset();                     // autoría anterior, fuera
      // El puente se escribe DESPUÉS del reset (ver volcarAlPuente).
      _volcarAlPuente(fondo, !!json.combinar, json);
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
      } else if (!imgS) {
        // (Un JSON etiquetado GWC ya no llega aquí: la validación
        // despachada por tipo lo bloquea dentro de leerCartucho, F5-I9.)
        console.warn('El cartucho no declara img_s: no hay nada que descomponer.');
      }
      // Autoría automática al cargar: GWI → editar (re-extrae + precarga
      // la autoría); GWB → flujo de creación (descomponer directamente).
      _descomponerImagen();

      // img_m: portada para la futura pantalla de selección de juegos.
      // El módulo la carga en paralelo, sin bloquear, y de momento no
      // se muestra.
      // F5-I10: la ficha del cartucho se rellena con TODO lo que trae
      // el GWB/GWI (la portada, cuando termine de cargar).
      BaseFicha.reiniciar();
      BaseFicha.poblar({
        nombre: json.nombre,
        estilo: json.estilo,
        resolucion: json.resolucion,
        colorFondo: json.ColorFondo || null,
        botones: (json.botones || []).map(b => ({
          numero: _normalizarNumeroBoton(b.numero), id: b.id
        })),
        imagenes: { img_s: imgS, img_f: imgF },
        extras: Object.fromEntries(['combinar', 'etiquetas']
          .filter(k => json[k] !== undefined).map(k => [k, json[k]]))
      });
      leido.imgM.then(img => {
        imgM = img;
        BaseFicha.ponerImagen('img_m', img);
      });

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
  async function _alSeleccionarGWIZip() {
    const fichero = _$('ficheroGWIZip').files[0];
    _$('ficheroGWIZip').value = '';            // permite recargar el mismo ZIP
    if (!fichero) return;
    console.log('[cartucho] ZIP seleccionado: ' + fichero.name);
    await _cargarCartucho([fichero], 'GWI');
  }

  /**
   * Evento del botón «Cargar GWC» (F5-I9): el .gwc viaja solo hasta el
   * núcleo unificado, que lo reconoce por el CONTENIDO y ejecuta la
   * carga binaria: procesarGWC valida, fabrica fondo y sprites y deja
   * el juego LISTO para el Start.
   * @returns {Promise<void>}
   */
  async function _alSeleccionarGWC() {
    const fichero = _$('ficheroGWC').files[0];
    _$('ficheroGWC').value = '';             // permite recargar el mismo GWC
    if (!fichero) return;
    console.log('[cartucho] GWC seleccionado: ' + fichero.name);
    await _cargarCartucho([fichero], 'GWC');
  }

  /**
   * Vuelca al puente (ComunListas) lo que el motor lee del cartucho:
   * lo comparten el flujo GWB/GWI y el del GWC (antes, el mismo bloque
   * escrito dos veces). Se llama DESPUÉS del reset de la autoría:
   * limpiar() vacía fondo y reglas, y lo que se fija antes lo borraría
   * (bug F3-I2: el reset de la autoría se comía el fondo).
   *  - fondo: el fondo para el juego.
   *  - reglas: hoy solo «combinar» (dos teclas en un mismo tick, F3-I1);
   *    NO sube al GWI (queda como AMPLIACIÓN futura): viene del setup.
   *  - fin (F3-I11): propiedad del cartucho, al nivel superior del GWI.
   *  - secuencia y, F4-I2, pausas, aceleración y rutas: igual que el fin.
   * @param {HTMLImageElement|HTMLCanvasElement} fondo - El fondo del cartucho.
   * @param {boolean} combinar - Regla «combinar» del cartucho.
   * @param {Object} datos - JSON del cartucho o GWC leído (mismos campos).
   * @returns {void}
   */
  function _volcarAlPuente(fondo, combinar, datos) {
    ComunListas.fijarFondo(fondo);
    ComunListas.fijarReglas({ combinar: combinar });
    ComunListas.fijarFin(datos.fin || null);
    ComunListas.fijarSecuencia(datos.secuencia || null);
    ComunListas.fijarPausas(datos.pausas || null);
    ComunListas.fijarAceleracion(datos.aceleracion || null);
    ComunListas.fijarRutas(datos.rutas || null);
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
  async function _procesarGWC(fichero) {
    let leido = null;
    try {
      leido = BaseCartucho.leerGWC(new Uint8Array(await fichero.arrayBuffer()));
      // La máquina manda, como con el JSON: el estilo del Bloque 0
      // debe ser el del setup cargado.
      // (Un GWC de menos botones se juega en una máquina con más.)
      if (setupGWS && Number(leido.estilo) > Number(setupGWS.estilo)) {
        throw new Error('el GWC es de estilo ' + leido.estilo +
          ' y la máquina cargada es de estilo ' + setupGWS.estilo + ' (menos botones).');
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
    colorFondo = leido.fondo;
    imgF = _fabricarFondoColor(leido.fondo, leido.resolucion.ancho,
      leido.resolucion.alto);
    imgS = null;                   // el GWC no lleva img_s: sin geometría
    imgM = null;                   // ni portada
    _pintarFondoCartucho(imgF);
    BaseGraficos.fijarFondo(imgF);
    // Las imágenes de los segmentos se fabrican de las MÁSCARAS de 1
    // bit (negro = 1, bit más significativo a la izquierda): las
    // mismas formas B/N que produce el editor.
    const imagenes = new Map();
    for (const s of leido.sprites) imagenes.set(s.id, _fabricarSprite(s));
    for (const seg of leido.segmentos) {
      seg.imagen = imagenes.get(seg.sprite) || null;
    }
    // El cartucho equivalente en memoria (para el info del panel; el
    // Código GWC del par = el código «#HHHH#» leído). No es editable:
    // el editor conserva su estado previo.
    cartucho = {
      tipo: 'GWC', version: 1, nombre: fichero.name,
      estilo: leido.estilo, pantalla: leido.resolucion,
      codigoGWC: leido.codigo,
      fin: leido.fin || undefined,
      secuencia: leido.secuencia || undefined,
      pausas: leido.pausas, aceleracion: leido.aceleracion,
      rutas: leido.rutas,
      sprites: leido.sprites, segmentos: leido.segmentos
    };
    // Botonera: el GWC NO declara botones (son físicos del setup): se
    // restaura la botonera COMPLETA de la máquina y el trío de sistema
    // pasa a modo sistema (F5-I10: fuera de partida A/B/R, en partida
    // Pausa/Stop).
    _construirBotonera();
    _montarBotonesSistema();
    // Puente, como en el flujo del GWI (volcarAlPuente), y las listas
    // con la imagen colgada de cada segmento, listas para el motor.
    _volcarAlPuente(imgF, !!leido.combinar, leido);
    BaseDescomponer.cargarListas(leido.sprites, leido.segmentos);
    // Presentación: fondo + segmentos visibles en el aparato. Se
    // reutiliza el pintado del GWI (visualmente carga lo mismo que un
    // GWI) con las imágenes fabricadas como "loader" y la pantalla
    // declarada como referencia de escala (1: las listas del GWC ya
    // viven en coordenadas de pantalla).
    await BaseDescomponer.pintarGWI(
      { naturalWidth: leido.resolucion.ancho, naturalHeight: leido.resolucion.alto },
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
    _actualizarPestanas();       // solo Simulador: el GWC no se edita
    // El GWC es PURA EJECUCIÓN: al cargarlo, la máquina queda delante,
    // lista para pulsar Start (de venga de la pestaña que venga).
    mostrarPestanna('vistaSimulador');
  }

  /**
   * El fondo plano del ColorFondo de un GWB/GWI sin img_f, del tamaño del
   * canvas de la pantalla (F5-I14). Null si es blanco (no hace falta).
   * @param {?string} color - Color '#RRGGBB'.
   * @returns {?HTMLCanvasElement} El canvas del fondo, o null.
   */
  function _fondoDeColor(color) {
    if (!color || color.toUpperCase() === '#FFFFFF') return null;
    const canvas = _$('pantalla');
    return _fabricarFondoColor(color, canvas.width, canvas.height);
  }

  /**
   * Fabrica el FONDO de un color plano: el del Bloque 0 de un GWC (la v1
   * no escribe el bloque de imagen de fondo) o el ColorFondo de un GWI. El
   * resto del simulador lo consume como a img_f.
   * @param {string} color - Color '#RRGGBB'.
   * @param {number} ancho - Ancho del canvas.
   * @param {number} alto - Alto del canvas.
   * @returns {HTMLCanvasElement} El canvas del fondo.
   */
  function _fabricarFondoColor(color, ancho, alto) {
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
  function _fabricarSprite(s) {
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
  function _descomponerImagen() {
    if (!imgS) {
      avisarError('No hay imagen de segmentos (img_s) para descomponer.');
      return;
    }
    const autoria = (cartucho && cartucho.tipo === 'GWI') ? cartucho.autoria : null;
    editable = BaseDescomponer.arrancar(imgS, cartucho, autoria);
    _actualizarPestanas();         // Segmentos y Sprites: solo con autoría
    pintarInfo();
    if (!editable) return;        // el error ya lo ha avisado arrancar
    // La autoría arrancó bien: se habilita el guardado (los DOS
    // botones: «Verificar y Guardar» y «Generar GWI+GWC», F5-I6) y el
    // deshacer/rehacer del historial de autoría.
    _$('btnGuardar').classList.remove('oculto');
    _$('btnGuardar').disabled = BaseDescomponer.segmentos().length === 0;
    _$('btnGenerar').classList.remove('oculto');
    _$('btnGenerar').disabled = BaseDescomponer.segmentos().length === 0;
    _$('btnDeshacer').classList.remove('oculto');
    _$('btnDeshacer').disabled = false;
    _$('btnRehacer').classList.remove('oculto');
    _$('btnRehacer').disabled = false;
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
  function _verificarYGuardar() {
    BaseDescomponer.verificarYGuardar();
  }

  // ---------------- Teclado ----------------

  /**
   * Encuentra el botón físico asociado a una tecla (si existe).
   * @param {string} tecla - Tecla pulsada.
   * @returns {?HTMLElement} Botón físico, o null.
   */
  function _buscarBotonPorTecla(tecla) {
    // Sin selector CSS: una tecla como «"» o «\» lo rompería (REVISION #14).
    const t = tecla.toLowerCase();
    for (const b of document.querySelectorAll('.botonFisico')) {
      if (b.dataset.tecla === t) return b;
    }
    return null;
  }

  /**
   * Permite jugar sin ratón: cada botón físico lleva su tecla pintada.
   * @param {KeyboardEvent} ev - Evento de teclado.
   * @returns {void}
   */
  function _alPulsarTecla(ev) {
    // Las teclas de los botones solo valen en la pestaña Simulador: en
    // las demás se está escribiendo (nombre, ids…) y no deben jugar.
    if (pestanaVista !== 'vistaSimulador') return;
    // Ctrl/Alt/Meta (atajos: Ctrl+Z no es el botón Z) o escribiendo en un
    // campo: no son pulsaciones de la máquina.
    if (ev.ctrlKey || ev.altKey || ev.metaKey) return;
    if (ev.target && ev.target.closest && ev.target.closest('input,select,textarea')) return;

    const el = _buscarBotonPorTecla(ev.key);
    if (!el) return;
    el.classList.add('pulsado');
    // Misma vía que el clic (pulsarBoton). Las teclas del trío de
    // sistema ignoran la repetición automática al mantener pulsado:
    // si no, la Pausa parpadearía (se alterna en cada pulsación).
    const numero = String(el.dataset.numero);
    if (ev.repeat && botonesSistema && TIPO_SISTEMA[numero] !== undefined) return;
    _pulsarBoton(numero);
  }

  /**
   * Soltar una tecla quita el resaltado de su botón.
   * @param {KeyboardEvent} ev - Evento de teclado.
   * @returns {void}
   */
  function _alSoltarTecla(ev) {
    const el = _buscarBotonPorTecla(ev.key);
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
    const botones = {
      vistaSetup: 'pesSetup',
      vistaSimulador: 'pesSimulador',
      vistaEditor: 'pesEditor', vistaSprites: 'pesSprites',
      vistaCartucho: 'pesCartucho'
    };
    for (const v of Object.keys(botones)) {
      _$(v).classList.toggle('oculto', v !== id);
      _$(botones[v]).classList.toggle('pestActiva', v === id);
    }
    document.body.dataset.vista = id;
    if (id === 'vistaSprites') BaseDescomponer.pintarListaSegmentos(_$('listaSegmentos'));
    // F5-I10: la ficha del cartucho se repinta al ENTRAR en la pestaña
    // (así siempre refleja el estado vigente del cartucho en memoria).
    // F5-I12: img_s ya no se bloquea: cambiarla solo tiene efecto al
    // Aplicar, que descarta y recalcula segmentos y sprites.
    if (id === 'vistaCartucho') BaseFicha.pintar(_$('fichaCartucho'));
    if (id === 'vistaSetup') BaseSetup.pintar(_$('fichaSetup'));
  }

  /**
   * Habilita las pestañas y los botones según los datos que hay (F5-I12):
   * Setup siempre (menos en partida); Cartucho y Simulador con un setup
   * aplicado; Editor y Sprites con un cartucho editable (GWB o GWI) y
   * sin GWC cargado (el GWC, ejecución pura, no se edita). Durante la
   * partida, solo el Simulador. Los botones de carga y de aplicar
   * siguen la misma regla; los de autoría los habilita la autoría.
   * @returns {void}
   */
  function _actualizarPestanas() {
    const soloSimulador = cartucho !== null && cartucho.tipo === 'GWC';
    _$('pesSetup').disabled = enJuego;
    _$('pesCartucho').disabled = enJuego || !setupGWS;
    _$('pesEditor').disabled = enJuego || !setupGWS || !editable || soloSimulador;
    _$('pesSprites').disabled = enJuego || !setupGWS || !editable || soloSimulador;
    _$('pesSimulador').disabled = !setupGWS;
    for (const id of BOTONES_SETUP) _$(id).disabled = enJuego;
    for (const id of BOTONES_CARTUCHO) _$(id).disabled = enJuego || !setupGWS;
    if (!editable) for (const id of BOTONES_AUTORIA) _$(id).disabled = true;
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
    _actualizarPestanas();
    _etiquetarSistema();           // A=Pausa, B=Stop, R oculto (F5-I10)
    mostrarPestanna('vistaSimulador');
    _pintarFondoNeutro();          // máquina recién encendida
  }

  /**
   * Fin de la partida (F5-I10: ÚNICA salida, la llama la función de
   * fin del JuegoDirector, tanto si el juego terminó solo como si se
   * pulsó Stop): vuelven las pestañas y los botones de carga, el trío
   * recupera sus etiquetas y se presenta el aviso según el motivo. La
   * pantalla queda congelada tal cual, como en las máquinas reales.
   * @param {string} [motivo] - 'stop' (botón Stop) o 'fin' (terminó el juego).
   * @returns {void}
   */
  function finDePartida(motivo) {
    enJuego = false;
    _actualizarPestanas();
    _etiquetarSistema();           // A/B/R otra vez (F5-I10)
    const arranque = botonesSistema ? 'A, B o R' : 'Start';
    avisar((motivo === 'stop' ? 'Partida detenida con Stop' : 'Partida terminada') +
      ' — pulsa ' + arranque + ' para jugar de nuevo.');
  }

  /**
   * Activa el trío de sistema (F5-I10): lo llama la carga de un GWI o
   * de un GWC, con la botonera ya montada (en el GWI, la de
   * aplicarBotonesCartucho, que conserva el trío; en el GWC, la
   * completa del setup). NO reconstruye nada: los botones de juego
   * conservan el renombrado del cartucho y los del trío los manda el
   * emulador (sus etiquetas, etiquetarSistema). Con el modo sistema
   * los tres botones lanzan la partida (con su TIPO) y el Start del
   * cartucho deja de contar.
   * @returns {void}
   */
  function _montarBotonesSistema() {
    numeroStart = BOTON_A;
    botonesSistema = true;
    _etiquetarSistema();
  }

  /**
   * Etiquetas (y visibilidad) del trío de sistema según el estado
   * (F5-I10), sin tocar la pista de tecla. Fuera de partida: A, B y R
   * (los tres lanzan el juego). En partida: A = Pausa (Reanudar si
   * está pausada), B = Stop y R desaparece. Solo actúa en el modo
   * sistema (tras GWI/GWC): con un GWB los botones quedan como los
   * defina el cartucho.
   * @returns {void}
   */
  function _etiquetarSistema() {
    if (!botonesSistema) return;
    const pausada = (typeof JuegoDirector !== 'undefined' &&
      typeof JuegoDirector.estaPausada === 'function' &&
      JuegoDirector.estaPausada());
    for (const numero of [BOTON_A, BOTON_B, BOTON_R]) {
      const el = document.querySelector('.botonFisico[data-numero="' + numero + '"]');
      const et = el && el.querySelector('.etiqueta');
      if (!et) continue;
      if (numero === BOTON_A) {
        et.textContent = !enJuego ? 'A' : pausada ? 'Reanudar' : 'Pausa';
      } else if (numero === BOTON_B) {
        et.textContent = enJuego ? 'Stop' : 'B';
      } else {
        el.classList.toggle('oculto', enJuego);   // en partida R desaparece
        et.textContent = 'R';
      }
    }
  }

  /**
   * Pulsación de un botón del trío en modo sistema (F5-I10). Fuera de
   * partida, los tres lanzan el juego con su TIPO (0, 1, 2). En
   * partida: A llama a SetPausa (y re-etiqueta), B llama a SetStop
   * y R no hace nada (está oculto; la tecla se ignora).
   * @param {string} numero - BOTON_A, BOTON_B o BOTON_R.
   * @returns {void}
   */
  function _pulsarSistema(numero) {
    if (typeof JuegoDirector === 'undefined') return;
    if (!enJuego) {
      _lanzarJuego(TIPO_SISTEMA[numero]);
      return;
    }
    if (numero === BOTON_A) {
      JuegoDirector.setPausa();
      _etiquetarSistema();
      avisar(JuegoDirector.estaPausada()
        ? 'Pausa — pulsa Reanudar (A) para continuar.'
        : 'Continúa la partida.');
    } else if (numero === BOTON_B) {
      JuegoDirector.setStop();    // el siguiente tick llama a la función de fin
      avisar('Stop — la partida se detiene al final del tick.');
    }
    // BOTON_R en partida: sin función.
  }

  /**
   * Lanza la partida con el TIPO del botón pulsado (F5-I10): 0, 1 o 2
   * (A, B o R). Preparado para la futura diferencia Game A / Game B;
   * de momento los tres tipos arrancan la partida igual.
   * @param {number} tipo - 0, 1 o 2.
   * @returns {void}
   */
  function _lanzarJuego(tipo) {
    console.info('[juego] arranque de tipo ' + tipo);
    JuegoDirector.arrancar(tipo);
  }

  // ---------------- Arranque ----------------

  /**
   * Comprobación de salud: si falta algún elemento del index.html,
   * se avisa EN consola y en pantalla cuál es, en vez de reventar con
   * un TypeError críptico.
   * @returns {boolean} true si el index tiene todo lo necesario.
   */
  function _comprobarSalud() {
    const necesarios = ['estado', 'pantalla', 'maquina',
      'panelEstado', 'infoMaquina', 'infoDiseno',
      'listaSegmentos', 'zonaMapa', 'mapaSegmentos',
      'panelSegmento', 'ficheroSetup', 'carpetaCartucho',
      'ficheroGWIZip', 'ficheroGWC',
      'ficheroGWBZip',
      'pesSetup', 'pesSimulador', 'pesEditor', 'pesSprites', 'pesCartucho',
      'vistaSetup', 'vistaSimulador', 'vistaEditor', 'vistaSprites', 'vistaCartucho',
      'fichaSetup', 'fichaCartucho', 'lienzoEditor']
      .concat(BOTONES_SETUP, BOTONES_CARTUCHO, BOTONES_AUTORIA);
    const faltan = necesarios.filter(id => _$(id) === null);
    if (faltan.length > 0) {
      const msg = 'index.html desactualizado: faltan los elementos con id ' +
        faltan.map(i => '"' + i + '"').join(', ') + '.';
      console.error(msg);
      if (_$('estado')) avisarError(msg);
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
  function _alAtajoTeclado(ev) {
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
    if (!_comprobarSalud()) return;            // sin index correcto no hay nada que cablear
    _$('btnCargarSetup').addEventListener('click', () => _$('ficheroSetup').click());
    _$('btnAplicarSetup').addEventListener('click', () => _aplicarDesdeFichaSetup(false));
    _$('btnGuardarSetup').addEventListener('click', () => _aplicarDesdeFichaSetup(true));
    // F5-I12: cada carga tiene un ejemplar por pestaña; todos hacen lo mismo.
    const entradas = { gwbCarpeta: 'carpetaCartucho', gwbZip: 'ficheroGWBZip',
      gwi: 'ficheroGWIZip', gwc: 'ficheroGWC' };
    for (const [accion, ids] of Object.entries(BOTONES_ACCION)) {
      for (const id of ids) _$(id).addEventListener('click', () => _$(entradas[accion]).click());
    }
    _$('btnAplicarCartucho').addEventListener('click', _aplicarDesdeFichaCartucho);
    _$('btnGuardarGWB').addEventListener('click', async () => {
      _$('btnGuardarGWB').disabled = true;           // evita guardados solapados
      try { await BaseFicha.guardar(); } finally { _actualizarPestanas(); }
    });
    document.body.dataset.vista = 'vistaSetup';
    _$('pesSetup').addEventListener('click', () => mostrarPestanna('vistaSetup'));
    _$('pesSimulador').addEventListener('click', () => mostrarPestanna('vistaSimulador'));
    _$('pesEditor').addEventListener('click', () => mostrarPestanna('vistaEditor'));
    _$('pesSprites').addEventListener('click', () => mostrarPestanna('vistaSprites'));
    _$('pesCartucho').addEventListener('click', () => mostrarPestanna('vistaCartucho'));
    _$('btnGuardar').addEventListener('click', _verificarYGuardar);
    // F5-I6: el botón «Generar GWI+GWC» — verificación bloqueante,
    // topes bloqueantes, GWC primero y GWI con el Código GWC del par
    // después. La lógica vive en BaseDescomponer.
    _$('btnGenerar').addEventListener('click', () => BaseDescomponer.generarGWIyGWC());
    _$('btnDeshacer').addEventListener('click', () => BaseDescomponer.deshacer());
    _$('btnRehacer').addEventListener('click', () => BaseDescomponer.rehacer());
    BaseDescomponer.inicializar();                 // el clic del mapa, cableado por BaseDescomponer.js
    BaseSetup.pintar(_$('fichaSetup'));                  // F5-I12: la ficha del setup, desde el arranque
    _actualizarPestanas();                               // al inicio solo Setup
    _$('ficheroSetup').addEventListener('change', _alSeleccionarSetup);
    _$('carpetaCartucho').addEventListener('change', _alSeleccionarCartucho);
    _$('ficheroGWBZip').addEventListener('change', _alSeleccionarGWBZip);
    _$('ficheroGWIZip').addEventListener('change', _alSeleccionarGWIZip);
    _$('ficheroGWC').addEventListener('change', _alSeleccionarGWC);
    document.addEventListener('keydown', _alPulsarTecla);
    document.addEventListener('keyup', _alSoltarTecla);
    document.addEventListener('keydown', _alAtajoTeclado);
  }

  // API pública: el arranque, los avisos de la barra de estado (que
  // usan BaseExtractor/BaseGraficos/BaseDescomponer vía BaseDirector.avisar /
  // BaseDirector.avisarError), la entrada y salida del modo juego (las
  // llama el JuegoDirector), el panel de información (lo repinta
  // BaseDescomponer) y las imágenes en memoria del cartucho (img_f/img_s/
  // img_m), que BaseDescomponer pasa a BaseCartucho.guardarGWI.
  return {
    inicializar: inicializar, avisar: avisar, avisarError: avisarError,
    validarSetup: validarSetup,           // F5-I12: la verifica también la ficha del Setup
    jugar: jugar, finDePartida: finDePartida,
    pestanna: mostrarPestanna,            // abrir el Editor desde la lista de segmentos
    pintarInfo: pintarInfo, informarTamanos: informarTamanos,
    estiloDeSetup: () => (setupGWS ? String(setupGWS.estilo) : null),
    pantallaDeSetup: () => (setupGWS && setupGWS.resolucion)
      ? { ancho: setupGWS.resolucion.ancho, alto: setupGWS.resolucion.alto } : null,
    imagenFondo: () => imgF, colorFondo: () => colorFondo, imagenSegmentos: () => imgS,
    imagenPortada: () => imgM,           // img_m: la pasa guardarGWI al ZIP
    imagenBlob: (img) => BaseCartucho.imagenBlob(img)
  };

})();

BaseDirector.inicializar();