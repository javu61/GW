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
//   _leerJSON                 Lee un .json a objeto (setup o cartucho; F5-I19).
//
//  Setup
//   validarSetup             Valida el JSON del hardware.
//   _aplicarSetup             Esqueleto del estilo, canvas y botonera.
//   _fijarHardware            Hardware visible: esqueleto, canvas, botonera
//                            y panel (la parte de _aplicarSetup sin pestañas;
//                            F5-I19: también la llama la derivación en caliente).
//   _setupDerivadoDe          F5-I19: deriva el GWS (la máquina) del cartucho
//                            cargado, heredando puertos/alias/teclas del previo.
//
//  Botonera
//   _crearBotonFisico         Un botón físico: hueco, tecla, etiqueta.
//   _construirBotonera        La botonera del estilo del setup.
//   _normalizarNumeroBoton    Número o alias → botón físico canónico.
//   _botonesInexistentes      ¿Usa el cartucho botones que la máquina no tiene? (pura)
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
//   _limpiarTodo              Botón «Limpiar» de la Carga (F5-I19): REINICIO total.
//   _pintarFondoNeutro        Color de "sin cartucho".
//   _pintarFondoCartucho      img_f escalada para LLENAR el canvas (ColorFondo/blanco sin fondo).
//
//  Panel de información (F5-I7)
//   pintarInfo               Máquina y cartucho; en el Editor, el diseño.
//   informarTamanos          Tamaños del GWI y del GWC generados, línea de deduplicación y línea de memoria (F5-I20).
//   _sumarGWI                 Tamaño aproximado de un GWI cargado.
//
//  Carga del cartucho (delegada en BaseCartucho)
//   _alSeleccionarFicheros    Input multiple de la pestaña Carga (F5-I19):
//                            GWS, GWB (ZIP), GWI (ZIP) y GWC por el mismo sitio.
//   _alSeleccionarCarpeta     Input de carpeta (webkitdirectory, F5-I19).
//   _entradasAFicheros        F5-I19: aplana entradas de arrastre (ficheros
//                            y carpetas, recursivo) a una lista de File.
//   _alSoltarPanel            Zona de arrastre del panel de carga: drop.
//   _alPegarPanel             Ctrl+V con ficheros DENTRO de la pestaña Carga.
//   _cargarCartucho           Núcleo UNIFICADO (F5-I9): detector de forma
//                            por el CONTENIDO (F5-I19: sin tipo esperado;
//                            un GWS pobla Setup, el resto es cartucho).
//   _procesarCartucho         Flujo de carpeta: lectura, puente y flujo.
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
//   _aplicarJSONSetup             Valida y APLICA un setup ya leído (de fichero o de la ficha de la p…
//   _confirmarDescarteCartucho    F5-I20: confirmación SIEMPRE antes de descartar el cartucho en
//                                memoria (con su juego); se omite con GW_DEBUG (como en Limpiar).
//   _confirmarCambioComun         F5-I21: confirmación de un cambio que afecta a otras pestañas
//                                (ajustar o rehacer); la resolución usa la ventana propia.
//   _abrirVentanaResolucion       F5-I21: LA ventana de ajuste de resolución (valores actuales,
//                                nuevos, factor de escala, si afecta; Cancelar / Ajustar resolución).
//   _aplicarAjusteResolucion      F5-I21: aplica el ajuste de resolución sin ventana (la usa la
//                                ventana y la caja D10); atómico (valida el rango antes de tocar nada).
//   _aplicarDesdeFichaSetup       Botón «Aplicar» de la pestaña Setup (F5-I12):
//   _aplicarDesdeFichaCartucho    Botón «Aplicar» de la pestaña Cartucho (F5-I12):
//   _textoBytes                   Bytes en texto legible, o «—» si no hay dato.
//   _buscarBotonPorTecla          Encuentra el botón físico asociado a una tecla (si existe); F5-I17
//                                también con las flechas del PC (ArrowLeft → cursor-izquierda…).
//   _teclaDeEvento               F5-I17: tecla de evento normalizada (flecha PC → nombre de cursor).
//   teclaValida / normalizarTecla F5-I17: la tecla del botón (letra A..Z o nombre de cursor;
//                                el dígito 1/2/3 solo en el trío de sistema A/B/R); públicas desde
//                                M8 (las usan la ficha del cartucho y la carga).
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
  let pestanaVista = 'vistaCarga';        // vista activa (la fija mostrarPestanna; F5-I19: arranca en Carga)
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
  let textoMemoria = null;                // F5-I20: «RAM: 4 de 216 KB (2 %) · …» del último «Generar GWI+GWC»
  let setupDerivado = false;              // F5-I19: el setup mostrado se derivó del cartucho, no es un GWS cargado

  // F5-I19: desaparecen los botones de carga repartidos por las pestañas:
  // la pestaña Carga y su panel (btnCargarFicheros + btnCargarCarpeta)
  // son la ÚNICA puerta. Setup y Cartucho conservan solo sus botones de
  // Aplicar/Guardar, y la autoría el suyo (F5-I12: se deshabilitan en
  // la partida; las fichas se repueblan al cargar).
  const BOTONES_SETUP = ['btnAplicarSetup', 'btnGuardarSetup'];
  // Botones que necesitan un setup aplicado (se deshabilitan en la partida)
  const BOTONES_CARTUCHO = ['btnAplicarCartucho', 'btnGuardarGWB'];
  // Botones de la pestaña Carga (F5-I19): activa en cualquier estado,
  // salvo durante la partida.
  const BOTONES_CARGA = ['btnCargarFicheros', 'btnCargarCarpeta', 'btnLimpiarCarga'];
  // Botones de autoría: deshabilitados mientras no hay cartucho editable
  const BOTONES_AUTORIA = ['btnGuardar', 'btnGenerar', 'btnDeshacer', 'btnRehacer'];

  const COLOR_FONDO_NEUTRO = '#888888';

  // Identificación del formato del fichero de setup
  const GWS_TIPO = 'GWS';               // campo "tipo" esperado en el setup.json (F5-I10: GWS como los demás JSON del proyecto)
  const GWS_VERSION = '1';              // versión del formato que entiende este motor

  // Teclas del teclado PC asociadas a cada número de botón, para jugar
  // sin ratón. El setup puede reasignar cada botón con "tecla" (una
  // letra o un nombre de cursor); si no la declara, se usa la de esta
  // tabla POR ESTILO (F5-I17, M6): los números 1/2/3 quedan para el
  // trío de sistema A/B/R, presente en todos los estilos.
  const TECLAS_POR_DEFECTO = {
    '2': { '0': 'cursor-izquierda', '4': 'cursor-derecha', '6': '1', '7': '2', '8': '3' },
    '4': { '0': 'W', '1': 'S', '4': 'O', '5': 'K', '6': '1', '7': '2', '8': '3' },
    '5': { '0': 'cursor-izquierda', '1': 'cursor-derecha', '2': 'cursor-arriba',
      '3': 'cursor-abajo', '4': 'Z', '6': '1', '7': '2', '8': '3' }
  };

  // F5-I17 (M4): los cuatro nombres de cursor del GWS (lista cerrada,
  // en minúsculas), la tecla de flecha del PC que los activa y el
  // símbolo que pinta la pista del botón.
  const CURSORES = {
    'cursor-izquierda': { flecha: 'ArrowLeft', simbolo: '\u2190' },
    'cursor-derecha':   { flecha: 'ArrowRight', simbolo: '\u2192' },
    'cursor-arriba':    { flecha: 'ArrowUp', simbolo: '\u2191' },
    'cursor-abajo':     { flecha: 'ArrowDown', simbolo: '\u2193' }
  };

  /**
   * F5-I17 (M4/M6): ¿es válida la tecla de un botón? Una letra A..Z o
   * un nombre de cursor de la lista cerrada, sin distinguir mayúsculas.
   * Los dígitos se retiraron en F5-I17: el 1/2/3 queda reservado al trío
   * de sistema A/B/R (botones 6/7/8) y se rechaza en cualquier otro.
   * @param {?string} valor - Valor del campo tecla.
   * @param {?string} [numero] - Número del botón (para admitir 1/2/3
   *   solo en el trío de sistema).
   * @returns {boolean} true si es válida.
   */
  function teclaValida(valor, numero) {
    if (typeof valor !== 'string' || valor === '') return false;
    if (/^[1-3]$/.test(valor)) return TIPO_SISTEMA[String(numero)] !== undefined;
    if (/^[a-zA-Z]$/.test(valor)) return true;
    return CURSORES[valor.toLowerCase()] !== undefined;
  }

  /**
   * F5-I17 (M4): normaliza una tecla para comparar y guardar: las letras
   * en mayúscula, los cursores con su nombre canónico en minúscula.
   * @param {?string} valor - Tecla tal como llegó (setup, ficha o teclado).
   * @returns {string} Tecla normalizada ('' si vacía).
   */
  function normalizarTecla(valor) {
    if (!valor) return '';
    const nombre = String(valor).toLowerCase();
    return CURSORES[nombre] ? nombre : String(valor).toUpperCase();
  }

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
    // F5-I16 (M5): fuera del rango de pantallas es ERROR bloqueante
    // (se conserva el setup anterior), no un aviso.
    if (res.ancho < BaseCartucho.PANTALLA_MIN.ancho || res.alto < BaseCartucho.PANTALLA_MIN.alto ||
      res.ancho > BaseCartucho.PANTALLA_MAX.ancho || res.alto > BaseCartucho.PANTALLA_MAX.alto) {
      return 'la "resolucion" del setup (' + res.ancho + 'x' + res.alto +
        ') está fuera del rango de pantallas (' + BaseCartucho.PANTALLA_MIN.ancho + 'x' +
        BaseCartucho.PANTALLA_MIN.alto + ' a ' + BaseCartucho.PANTALLA_MAX.ancho + 'x' +
        BaseCartucho.PANTALLA_MAX.alto + ').';
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
        if (!teclaValida(b.tecla, b.numero)) {
          return 'la "tecla" del botón ' + b.numero +
            ' debe ser una letra A..Z o un nombre de cursor (cursor-izquierda/derecha/arriba/abajo);' +
            ' el dígito 1/2/3 solo vale en el trío de sistema A/B/R.';
        }
        b.tecla = normalizarTecla(b.tecla);
        if (teclasVistas.has(b.tecla)) console.warn('Tecla repetida en el setup: ' + b.tecla);
        teclasVistas.add(b.tecla);
      }
      if (b.puerto !== undefined && (!Number.isInteger(b.puerto) || b.puerto < 0)) {
        return 'el "puerto" del botón ' + b.numero + ' debe ser un entero positivo.';
      }
    }
    // F5-I17 (M6): si una tecla explícita coincide con la de por defecto
    // de un botón sin tecla, ambos responderían a la misma tecla (gana
    // el primero del DOM): aviso en consola, como los repetidos.
    const defecto = TECLAS_POR_DEFECTO[jsonGWS.estilo] || {};
    for (const numero of Object.keys(defecto)) {
      const declarado = jsonGWS.botones.find(x => x.numero === numero);
      if (!declarado || declarado.tecla !== undefined) continue;
      if (teclasVistas.has(normalizarTecla(defecto[numero]))) {
        console.warn('La tecla por defecto ' + defecto[numero] + ' del botón ' + numero +
          ' coincide con una tecla explícita del setup.');
      }
    }
    return null;
  }

  // ---------------- Limpieza ----------------

  /**
   * F5-I20 (ajuste): confirmación SIEMPRE que la acción vaya a descartar
   * el cartucho en memoria, con los datos de juego que llevaría (la
   * autoría del GWI). Mismo criterio que el botón Limpiar (F5-I19): se
   * omite con GW_DEBUG (las suites corren solas y el navegador de
   * Playwright descarta los diálogos). Sin cartucho, no pide nada.
   * @param {string} accion - Lo que la va a descartar, p. ej.
   *        «Aplicar el setup» o «Cargar un GWS».
   * @returns {boolean} true si se puede continuar.
   */
  function _confirmarDescarteCartucho(accion) {
    if (!cartucho) return true;
    if (typeof GW_DEBUG !== 'undefined' && GW_DEBUG) return true;
    const n = BaseDescomponer.numeroDeCambios();
    return window.confirm(accion + ' descarta el cartucho en memoria' +
      (n > 0 ? ' y su juego (' + n + ' acción(es) de autoría)' : '') +
      '. ¿Continuar?');
  }

  // ---------------- Datos comunes y ajuste de resolución (F5-I21) ----------------

  /**
   * F5-I21: confirmación GENÉRICA de un cambio que afecta a otras
   * pestañas. Decide SI se pregunta y CON QUÉ TEXTO según el efecto:
   *   - «rehacer»: se descarta lo derivado y se vuelve a obtenerlo
   *     desde cero — reutiliza _confirmarDescarteCartucho (mismo
   *     criterio de las pruebas: se omite con GW_DEBUG).
   *   - «ajustar» (o cualquier otro): conserva el trabajo y lo adapta —
   *     el aviso lo dice expresamente.
   * Sin cartucho en memoria nunca pide nada (no hay nada que perder).
   * @param {string} dato - El dato que cambia, p. ej. «la resolución».
   * @param {string} [efecto] - «ajustar» (por defecto) o «rehacer».
   * @returns {boolean} true si se puede continuar.
   */
  function _confirmarCambioComun(dato, efecto) {
    if (!cartucho) return true;
    if (typeof GW_DEBUG !== 'undefined' && GW_DEBUG) return true;
    if (efecto === 'rehacer') {
      return _confirmarDescarteCartucho('Cambiar "' + dato + '"');
    }
    return window.confirm('Cambiar "' + dato +
      '" AJUSTA lo que depende de él: se reescalan las imágenes, los ' +
      'sprites y las posiciones, sin perder las acciones ni los roles ' +
      '(F5-I21). ¿Continuar?');
  }

  /** Ventana de ajuste de resolución abierta (una sola a la vez). */
  let ventanaResolucion = null;

  /**
   * F5-I21: cierra la ventana de ajuste de resolución si está abierta.
   * @returns {void}
   */
  function _cerrarVentanaResolucion() {
    if (ventanaResolucion) { ventanaResolucion.remove(); ventanaResolucion = null; }
  }

  /**
   * F5-I21: reescala una imagen (img_f, img_m) a las dimensiones dadas
   * con suavizado (canvas intermedio). Si ya tiene ese tamaño, devuelve
   * la misma imagen.
   * @param {Image|HTMLCanvasElement} img - Imagen origen.
   * @param {number} ancho - Ancho destino (px).
   * @param {number} alto - Alto destino (px).
   * @returns {Image|HTMLCanvasElement} La imagen reescalada.
   */
  function _reescalarSuave(img, ancho, alto) {
    const ow = img.naturalWidth || img.width, oh = img.naturalHeight || img.height;
    if (ow === ancho && oh === alto) return img;
    const c = document.createElement('canvas');
    c.width = ancho; c.height = alto;
    const ctx = c.getContext('2d');
    ctx.imageSmoothingEnabled = true;
    ctx.drawImage(img, 0, 0, ancho, alto);
    return c;
  }

  /**
   * F5-I21: LA ventana de ajuste de resolución (botón de la pestaña
   * Setup). Muestra los valores actuales, los nuevos (editables), el
   * factor de escala resultante, SI afectará a los segmentos y los
   * avisos: fuera del rango (F5-I16, el botón se deshabilita) o con
   * una escala no entera (el resultado puede degradarse). La ventana
   * ES la confirmación: no se abre ningún window.confirm adicional.
   * La vía programática para las pruebas es aplicarAjusteResolucion.
   * @returns {void}
   */
  function _abrirVentanaResolucion() {
    if (!setupGWS) { avisarError('Aplica antes un setup.'); return; }
    if (enJuego) { avisarError('No se ajusta la resolución con una partida en marcha.'); return; }
    _cerrarVentanaResolucion();
    const baseDims = BaseDescomponer.dimensionesBase ? BaseDescomponer.dimensionesBase() : null;
    const resumen = (baseDims && BaseDescomponer.resumen) ? BaseDescomponer.resumen() : null;
    const haySegmentos = !!(baseDims && resumen && resumen.segmentos > 0);
    const fuenteX = baseDims ? baseDims.ancho : setupGWS.resolucion.ancho;
    const fuenteY = baseDims ? baseDims.alto : setupGWS.resolucion.alto;

    const overlay = document.createElement('div');
    overlay.className = 'ventanaResolucion';
    overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.45);' +
      'display:flex;align-items:center;justify-content:center;z-index:9999;';
    const caja = document.createElement('div');
    caja.style.cssText = 'background:#fff;color:#000;padding:16px 20px;' +
      'border-radius:8px;font-family:sans-serif;min-width:340px;' +
      'box-shadow:0 8px 30px rgba(0,0,0,.4);';
    const titulo = document.createElement('h3');
    titulo.textContent = 'Ajustar resolución';
    titulo.style.marginTop = '0';
    caja.appendChild(titulo);

    const actual = document.createElement('p');
    actual.textContent = 'Valores actuales: ' + setupGWS.resolucion.ancho + '\u00d7' +
      setupGWS.resolucion.alto + ' px' +
      (baseDims ? ' (segmentos: ' + baseDims.ancho + '\u00d7' + baseDims.alto + ' px)' : '');
    caja.appendChild(actual);

    const filaNueva = document.createElement('p');
    filaNueva.append(document.createTextNode('Nueva: '));
    const inAncho = document.createElement('input');
    inAncho.type = 'number';
    inAncho.min = String(BaseCartucho.PANTALLA_MIN.ancho);
    inAncho.max = String(BaseCartucho.PANTALLA_MAX.ancho);
    inAncho.step = '1';
    inAncho.value = String(setupGWS.resolucion.ancho);
    inAncho.style.width = '5em';
    const inAlto = inAncho.cloneNode(true);
    inAlto.value = String(setupGWS.resolucion.alto);
    filaNueva.append(inAncho, document.createTextNode(' \u00d7 '), inAlto);
    caja.appendChild(filaNueva);

    const factor = document.createElement('p');
    factor.style.fontWeight = 'bold';
    const afecta = document.createElement('p');
    const avisoEscala = document.createElement('p');
    avisoEscala.style.color = '#8a6d00';
    const errorRango = document.createElement('p');
    errorRango.style.color = '#a00000';

    function _recalcular() {
      const a = parseInt(inAncho.value, 10), l = parseInt(inAlto.value, 10);
      if (!(a > 0) || !(l > 0)) {
        factor.textContent = 'Factor de escala: \u2014';
        afecta.textContent = '';
        avisoEscala.textContent = '';
        errorRango.textContent = 'Resolución no válida.';
        btnAjustar.disabled = true;
        return;
      }
      const fx = a / fuenteX, fy = l / fuenteY;
      factor.textContent = 'Factor de escala: ' + (Math.round(fx * 100) / 100) +
        ' \u00d7 ' + (Math.round(fy * 100) / 100) +
        (baseDims ? ' (sobre img_s: ' + fuenteX + '\u00d7' + fuenteY + ' px)' : '');
      afecta.textContent = haySegmentos
        ? 'Afectará a los segmentos: ' + resumen.segmentos + ' segmento(s) y ' +
          resumen.imagenes + ' sprite(s) se reescalarán (las acciones y los roles se conservan).'
        : 'No afecta a segmentos (no hay juego en memoria).';
      avisoEscala.textContent = (!baseDims || (Number.isInteger(fx) && Number.isInteger(fy)))
        ? '' : 'La escala no es entera: el reescalado de img_s puede degradar las formas.';
      const fuera = BaseCartucho.avisosDeResolucion({ ancho: a, alto: l });
      errorRango.textContent = fuera ? fuera : '';
      btnAjustar.disabled = !!fuera;
    }

    const filaBotones = document.createElement('p');
    const btnCancelar = document.createElement('button');
    btnCancelar.type = 'button';
    btnCancelar.textContent = 'Cancelar';
    const btnAjustar = document.createElement('button');
    btnAjustar.type = 'button';
    btnAjustar.textContent = 'Ajustar resolución';
    btnAjustar.style.fontWeight = 'bold';
    filaBotones.append(btnCancelar, document.createTextNode(' '), btnAjustar);

    btnCancelar.addEventListener('click', _cerrarVentanaResolucion);
    btnAjustar.addEventListener('click', () => {
      const a = parseInt(inAncho.value, 10), l = parseInt(inAlto.value, 10);
      if (_aplicarAjusteResolucion(a, l)) _cerrarVentanaResolucion();
    });
    inAncho.addEventListener('input', _recalcular);
    inAlto.addEventListener('input', _recalcular);

    caja.append(factor, afecta, avisoEscala, errorRango, filaBotones);
    overlay.appendChild(caja);
    document.body.appendChild(overlay);
    ventanaResolucion = overlay;
    _recalcular();
  }

  /**
   * F5-I21: aplica el ajuste de resolución YA, sin ventana (es la
   * vía programática que usa la propia ventana y la caja D10): valida el
   * rango (F5-I16) ANTES de tocar nada (atómico: o todo o nada), reescala
   * el juego en memoria con ajustarAResolucion (si lo hay), actualiza la
   * resolución declarada del setup, reescala img_f/img_m suavemente y
   * repinta todo.
   * @param {number} anchoNuevo - Nuevo ancho (px).
   * @param {number} altoNuevo - Nuevo alto (px).
   * @returns {boolean} true si se aplicó.
   */
  function _aplicarAjusteResolucion(anchoNuevo, altoNuevo) {
    const fueraDeRango = BaseCartucho.avisosDeResolucion({ ancho: anchoNuevo, alto: altoNuevo });
    if (fueraDeRango) {
      avisarError('Resolución NO ajustada: ' + fueraDeRango);
      return false;
    }
    const ajusta = !!(cartucho && editable);
    try {
      // 1. El lienzo del aparato al nuevo tamaño ANTES del ajuste: así
      //    la escala que fija el repintado del editor ya es la buena.
      const canvas = _$('pantalla');
      canvas.width = anchoNuevo;
      canvas.height = altoNuevo;
      // 2. El juego en memoria: geometría, sprites y posiciones (las
      //    acciones y los roles quedan intactos; el repintado lo hace
      //    el propio ajustarAResolucion).
      if (ajusta) {
        BaseDescomponer.ajustarAResolucion(anchoNuevo, altoNuevo);
        BaseDescomponer.pintarFondoAparato();      // fondo con la img_f ya reescalada
        BaseDescomponer.repintarAparato();
      }
      // 3. Resolución declarada e imágenes de presentación (suave).
      if (setupGWS) setupGWS.resolucion = { ancho: anchoNuevo, alto: altoNuevo };
      if (imgF) imgF = _reescalarSuave(imgF, anchoNuevo, altoNuevo);
      if (imgM) imgM = _reescalarSuave(imgM, anchoNuevo, altoNuevo);
      // 4. Repintado del resto de estados.
      if (cartucho) {
        BaseGraficos.fijarFondo(imgF);
        if (!ajusta) _pintarFondoCartucho(imgF);
      } else {
        BaseGraficos.fijarFondo(null);
        _pintarFondoNeutro();
      }
      pintarInfo();
      avisar('Resolución ajustada: ' + anchoNuevo + '\u00d7' + altoNuevo +
        (ajusta ? ' (imágenes, sprites y posiciones reescaladas; autoría intacta).' : '.'));
      return true;
    } catch (e) {
      avisarError('Resolución NO ajustada: ' + e.message);
      return false;
    }
  }

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
    textoMemoria = null;
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

  /**
   * Botón «Limpiar» de la pestaña Carga (F5-I19, ajuste tras la
   * primera prueba): REINICIO TOTAL del diseño — sin setup, sin
   * cartucho, máquina oculta y fichas en blanco, como al abrir la
   * página — para cargar otro cartucho limpio. No entra con una
   * partida en marcha: el botón se deshabilita en el juego. Pide
   * confirmación antes de borrar si hay datos en memoria (la omite
   * con GW_DEBUG, que corren las suites solas; F5-I19).
   * @returns {void}
   */
  function _limpiarTodo() {
    // Confirmación (F5-I19): SOLO si hay algo que perder (setup o
    // cartucho en memoria) y SIN GW_DEBUG — las suites corren solas y
    // el navegador de Playwright descarta los diálogos (daría
    // "cancelar" y la caja D8 no pasaría).
    if (typeof GW_DEBUG === 'undefined' || !GW_DEBUG) {
      if (setupGWS || cartucho) {
        if (!window.confirm('Se perderán los datos cargados. ¿Limpiar todo?')) return;
      }
    }
    _limpiarCartucho();
    BaseCartucho.revocarURLs();
    setupGWS = null;
    setupDerivado = false;
    BaseFicha.reiniciar();
    BaseSetup.reiniciar();
    // Fuera la máquina visible: esqueletos ocultos, carcasa y panel
    // de información fuera. _construirBotonera limpia los restos del
    // DOM del siguiente setup que se aplique.
    for (const e of Object.values(ESTILOS)) _$(e.esqueleto).classList.add('oculto');
    _$('maquina').classList.add('oculto');
    _$('panelEstado').classList.add('oculto');
    _actualizarPestanas();
    mostrarPestanna('vistaCarga');
    avisar('Sin setup cargado.');
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
    // Tecla de teclado asociada (F5-I17, M8): la del cartucho en memoria
    // (GWI o GWB, botones[].tecla), si la declara para ese botón; si no,
    // la del setup; si tampoco, la de por defecto del estilo (F5-I17, M6).
    // Los cursor llevan dataset con el nombre y pista con el símbolo; las
    // letras, dataset y pista como antes (minúscula/mayúscula).
    const delCartucho = (cartucho && Array.isArray(cartucho.botones))
      ? cartucho.botones.find(b => b && String(b.numero) === String(boton.numero) &&
        b.tecla !== undefined && b.tecla !== null && b.tecla !== '') || null
      : null;
    const defecto = (setupGWS && TECLAS_POR_DEFECTO[String(setupGWS.estilo)]) || {};
    const tecla = normalizarTecla(delCartucho ? delCartucho.tecla :
      (boton.tecla || defecto[boton.numero] || ''));
    const cursor = CURSORES[tecla.toLowerCase()];
    if (tecla) el.dataset.tecla = tecla.toLowerCase();
    // Etiqueta visible + pista pequeña con la tecla asociada
    const etiqueta = document.createElement('span');
    etiqueta.className = 'etiqueta';
    etiqueta.textContent = boton.alias || boton.numero;
    el.appendChild(etiqueta);
    if (tecla) {
      el.appendChild(document.createElement('br'));
      const pista = document.createElement('small');
      pista.textContent = cursor ? cursor.simbolo : tecla.toUpperCase();
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
   * en el setup (se resuelven a su botón físico). F5-I19: la máquina de
   * referencia puede pasarse por parámetro (la derivada del cartucho,
   * cuando aún no hay setup en memoria).
   * @param {string|number} numero - Número o alias del botón del cartucho.
   * @param {?Object} [maquina] - El setup (GWS) que declara los alias;
   *        por defecto el setup en memoria.
   * @returns {string} Clave canónica del botón físico.
   */
  function _normalizarNumeroBoton(numero, maquina) {
    const m = maquina || setupGWS;
    const n = String(numero);
    for (const b of m.botones) {
      if (b.alias === n) return b.numero;
    }
    return n;
  }

  /**
   * F5-I15 (D3): ¿usa el cartucho algún botón que la máquina no tiene?
   * Comprobación PURA (no toca el DOM ni el estado): se hace ANTES de
   * limpiar nada, para que un cartucho incompatible no destruya el que
   * ya estaba cargado. Setup >= cartucho (F3-I1): jugar con menos
   * botones que la máquina ofrece está bien; usar uno que no tiene, no.
   * F5-I19: la máquina contra la que se comprueba puede ser la QUE VENDRÁ
   * (la derivada del cartucho), no la actual: se pasa por parámetro.
   * @param {Object} json - JSON del cartucho.
   * @param {?Object} [maquina] - El setup (GWS) contra el que comprobar;
   *        por defecto el setup en memoria.
   * @returns {?string} El mensaje de error, o null si todo es compatible.
   */
  function _botonesInexistentes(json, maquina) {
    const m = maquina || setupGWS;
    if (!json || json.botones === undefined || !m) return null;
    const existentes = ESTILOS[m.estilo].botones;
    const faltan = [];
    for (const b of json.botones) {
      if (!existentes[_normalizarNumeroBoton(b.numero, m)]) faltan.push(String(b.numero));
    }
    if (faltan.length === 0) return null;
    return 'el cartucho usa ' + (faltan.length === 1 ?
      'el botón ' + faltan[0] + ', que no existe' :
      'los botones ' + faltan.join(', ') + ', que no existen') +
      ' en la máquina de estilo ' + m.estilo + '.';
  }

  /**
   * Aplica los botones del cartucho sobre la botonera física:
   * - restaura primero TODOS los botones del setup (por si el cartucho
   *   anterior había eliminado o renombrado),
   * - renombra cada botón con su texto de pantalla (el "alias" del
   *   setup, F5-I21; en cartuchos antiguos, su "id" lógico),
   * - los botones del cartucho son HOY los del setup (F5-I21), de modo
   *   que la botonera queda como la de la máquina.
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
    const faltan = _botonesInexistentes(json);
    if (faltan) return faltan;
    const usados = new Set();
    for (const b of json.botones) {
      const numero = _normalizarNumeroBoton(b.numero);
      usados.add(numero);
      const el = document.querySelector('.botonFisico[data-numero="' + numero + '"]');
      if (!el) continue;
      const et = el.querySelector('.etiqueta');   // renombra sin perder la pista de tecla
      // F5-I21: el texto de pantalla del setup (alias); los cartuchos
      // antiguos traían un "id" lógico, que se sigue aceptando.
      const texto = String(b.alias !== undefined && b.alias !== null ? b.alias :
        (b.id !== undefined && b.id !== null ? b.id : '')).trim();
      if (et) et.textContent = texto || numero;   // sin texto se queda el número
      // El botón que se llama "Start" es el que enciende el juego, sea
      // cual sea su número físico (6, 7, 8…).
      if (texto.toLowerCase() === 'start') {
        numeroStart = numero;
      }
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
   * Fija el hardware visible del setup (F5-I19: extraído de _aplicarSetup
   * para REUSARLO al derivar la máquina de un cartucho, en caliente):
   * muestra el esqueleto del estilo, dimensiona el canvas, construye la
   * botonera y repinta el panel. Sin pestañas ni avisos: de eso deciden
   * los que lo llaman (pues el siguiente paso del usuario es distinto).
   * @returns {void}
   */
  function _fijarHardware() {
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
  }

  /**
   * Aplica el setup validado: fija el hardware (fijarHardware) y deja
   * delante la pestaña Cartucho, el siguiente paso del flujo.
   * @param {Array<string>} [avisosLimites] - Avisos de límites F5-I16.
   * @returns {void}
   */
  function _aplicarSetup(avisosLimites) {
    _fijarHardware();
    // El setup aplicado deja delante la pestaña Cartucho (F5-I12): es
    // el siguiente paso. Las demás se habilitan según haya cartucho.
    _actualizarPestanas();
    mostrarPestanna('vistaCartucho');
    // Arriba indica la última operación realizada, con los avisos de
    // límites F5-I16 si el setup los trajo
    avisar('Setup cargado: ' + (setupGWS.nombre || '(sin nombre)') +
      (avisosLimites && avisosLimites.length > 0 ? ' ' + avisosLimites.join(' ') : ''));
  }

  /**
   * F5-I19 (PA4): el cartucho cargado MANDA. Deriva el setup (el GWS de
   * la máquina) a partir de un GWB/GWI cargado: estilo y resolución del
   * cartucho, y de un botón a otro del estilo, con la tecla del cartucho
   * si la declara; si no, la del setup previo y, en su defecto, la de
   * por defecto del estilo (precedencia M8). La memoria (F5-I20) va
   * SUBCAMPO a subcampo: la del cartucho manda, y lo que él no declara
   * viene de la máquina previa. F5-I21: los cartuchos llevan los
   * botones con los nombres de campo del setup, así que el puerto y el
   * alias TAMBIÉN viajan en ellos: manda el cartucho (F5-I19) y, lo
   * que él no declara, se hereda del setup previo (vacíos si no hay
   * setup). FUNCION PURA: no toca el estado ni el DOM (el llamador
   * decide cuándo se aplica).
   * @param {Object} json - JSON del cartucho cargado (GWB o GWI).
   * @param {?Object} previo - El setup anterior (o null).
   * @returns {Object} El GWS derivado.
   * @throws {Error} Si no hay estilo conocido ni setup del que heredarlo.
   */
  function _setupDerivadoDe(json, previo) {
    const estilo = (json.estilo !== undefined && json.estilo !== null)
      ? String(json.estilo)
      : (previo ? String(previo.estilo) : null);
    if (!estilo || !ESTILOS[estilo]) {
      throw new Error('el cartucho necesita declarar un "estilo" de máquina ' +
        'conocido, o haber un setup previo del que heredarlo (F5-I19).');
    }
    const previos = new Map((previo && Array.isArray(previo.botones))
      ? previo.botones.map(b => [String(b.numero), b]) : []);
    const delCartucho = (Array.isArray(json.botones))
      ? json.botones.filter(b => b && typeof b === 'object') : [];
    const defecto = TECLAS_POR_DEFECTO[estilo] || {};
    const botones = Object.keys(ESTILOS[estilo].botones).map(numero => {
      const p = previos.get(numero) || {};
      const delCr = delCartucho.find(b => String(b.numero) === numero);
      const tecla = (delCr && delCr.tecla) ? normalizarTecla(delCr.tecla) :
        (p.tecla ? normalizarTecla(p.tecla) : defecto[numero]);
      const boton = { numero: numero };
      if (tecla) boton.tecla = tecla;
      // F5-I21: puerto y alias viajan en el cartucho (nombres de campo
      // del setup): manda el cartucho; lo que no declara, el setup previo.
      const puerto = (delCr && delCr.puerto !== undefined) ? delCr.puerto : p.puerto;
      if (puerto !== undefined && puerto !== null) boton.puerto = puerto;
      const alias = (delCr && delCr.alias !== undefined) ? delCr.alias : p.alias;
      if (alias !== undefined && alias !== null) boton.alias = alias;
      return boton;
    });
    const resolucion = json.resolucion || (previo && previo.resolucion);
    if (!resolucion) {
      throw new Error('el cartucho no declara "resolucion" y no hay un setup ' +
        'previo del que heredarla (F5-I19).');
    }
    // F5-I20 (ajuste tras la primera prueba): la memoria del setup derivado
    // sale del CARTUCHO, subcampo a subcampo (lo que él no declara, de la
    // máquina previa, que es del hardware): así, al aplicar la ficha de
    // Cartucho o cargar el cartucho, el setup visible muestra la memoria
    // que MANDA (F5-I19: el cartucho cargado manda, también aquí).
    const mem = BaseCartucho.memoriaEfectiva(json.memoria,
      previo ? previo.memoria : null);
    const memoriaDerivada = (mem.RAM > 0 || mem.FLASH > 0) ? mem : null;
    return {
      tipo: GWS_TIPO, version: GWS_VERSION,
      nombre: json.nombre || 'Derivado del cartucho',
      estilo: estilo,
      resolucion: { ancho: resolucion.ancho, alto: resolucion.alto },
      botones: botones,
      ...(memoriaDerivada ? { memoria: memoriaDerivada } : {})
    };
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
    // F5-I16: límites asentados al validar el setup (puertos fuera de
    // rango se limitan aquí; la resolución solo avisa).
    const avisosLimites = BaseCartucho.revisarValores('GWS', json);
    textoMemoria = null;                      // F5-I20: la línea de memoria era del cartucho anterior
    _limpiarCartucho();                       // aplicar un setup limpia el cartucho actual
    BaseCartucho.revocarURLs();              // y las object URLs del cartucho viejo
    setupGWS = json;
    setupDerivado = false;                   // F5-I19: un GWS aplicado es REAL, no derivado
    // La ficha del cartucho recibe del GWS TODOS los datos comunes
    // (F5-I20, ajuste): estilo y resolución (que ya iban), más nombre,
    // memoria y ColorFondo — un GWB montado desde la ficha sale completo
    // y sus ficheros llevan el nombre del setup (F5-I17, M10). F5-I21:
    // la ficha ya no recibe botones ni los edita: viajan en los
    // cartuchos con los nombres de campo y los datos de esta pestaña
    // Setup, y el Aplicar deja de sincronizarlos.
    BaseFicha.reiniciar();
    BaseFicha.poblar({ estilo: json.estilo, resolucion: json.resolucion,
      nombre: json.nombre, memoria: json.memoria || null,
      colorFondo: json.ColorFondo || null });
    BaseSetup.poblar(json);
    _aplicarSetup(avisosLimites);
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
      // F5-I20 (ajuste): aplicar un setup descarta el cartucho en memoria
      // (con su juego): confirmación SIEMPRE que haya algo que perder.
      if (!_confirmarDescarteCartucho(guardar ? 'Guardar el GWS' : 'Aplicar el setup')) {
        avisar((guardar ? 'GWS NO guardado: ' : 'Setup NO aplicado: ') +
          'cancelado por el usuario.');
        return;
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
    // F5-I20 (ajuste): aplicar la ficha reconstruye el cartucho (GWB) y
    // descarta el cartucho en memoria, con su juego si era un GWI:
    // confirmación SIEMPRE (la comprobación exacta ya avisa D4/M3).
    if (!_confirmarDescarteCartucho('Aplicar la ficha del cartucho')) {
      avisar('Cartucho NO aplicado: cancelado por el usuario.');
      return;
    }
    const ficheros = await BaseFicha.ficherosGWB();
    await _cargarCartucho(ficheros);   // F5-I19: sin tipo esperado
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
    // F5-I20 (MA02): y la línea de memoria, solo si hay memoria declarada.
    _$('infoDiseno').textContent +=
      textoMemoria ? '\n' + textoMemoria : '';
  }

  /**
   * Anota los tamaños del GWI y/o del GWC recién generados (los
   * campos ausentes no cambian) y repinta el panel.
   * @param {{gwi:?number, gwc:?number, deduplicacion:?string, memoria:?string}} tamanos -
   *        Bytes de cada uno, la línea de deduplicación y la de memoria
   *        (F5-I20); null quita la línea.
   * @returns {void}
   */
  function informarTamanos(tamanos) {
    if (tamanos.gwi !== undefined) tamGWI = tamanos.gwi;
    if (tamanos.gwc !== undefined) tamGWC = tamanos.gwc;
    if (tamanos.deduplicacion !== undefined) deduplicacion = tamanos.deduplicacion;
    if (tamanos.memoria !== undefined) textoMemoria = tamanos.memoria;
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
  // orquestación: eventos del panel de carga (F5-I19), el detector de
  // forma (F5-I9) y el flujo automático por tipo.

  /**
   * Evento del input «Cargar ficheros» de la pestaña Carga (F5-I19): cada
   * entrada vale para TODO —.json GWS, .zip GWB/GWI, .gwc, un JSON suelto
   * de cartucho, o varias selecciones PARA UNA CARPETA—: copia los File
   * (al vaciar el input, su FileList muere) y llama al núcleo unificado
   * SIN tipo esperado: el tipo lo decide el contenido (F5-I9).
   * @returns {Promise<void>}
   */
  async function _alSeleccionarFicheros() {
    // Copia inmediata de los File a un array ANTES de limpiar el value:
    // al vaciar el input, su FileList queda vacía y una referencia directa
    // a ella moriría a cero ficheros, sin mostrar mensaje alguno.
    const ficheros = Array.from(_$('ficheroCartucho').files);
    _$('ficheroCartucho').value = '';           // permite recargar la misma selección
    if (ficheros.length === 0) return;
    console.log('[carga] ficheros seleccionados: ' + ficheros.length + ' fichero(s)');
    await _cargarCartucho(ficheros);
  }

  /**
   * Evento del input «Cargar carpeta» (webkitdirectory, F5-I19): copia
   * los File de la carpeta y entra en el núcleo unificado sin tipo.
   * @returns {Promise<void>}
   */
  async function _alSeleccionarCarpeta() {
    const ficheros = Array.from(_$('carpetaCartucho').files);
    _$('carpetaCartucho').value = '';           // permite recargar la misma carpeta
    if (ficheros.length === 0) {
      avisarError('No se ha leído ningún fichero de la carpeta seleccionada.');
      return;
    }
    console.log('[carga] carpeta seleccionada: ' + ficheros.length + ' fichero(s)');
    await _cargarCartucho(ficheros);
  }

  /**
   * F5-I19: aplana una entrada de arrastre (fichero o carpeta) a una
   * lista de File, navegando recursivamente las carpetas con la API
   * webkitGetAsEntry (los File de un directorio que viajan en
   * dataTransfer.files llegan vacíos: no tienen contenido leíble).
   * @param {FileSystemEntry} entrada - La entrada del arrastre (o null).
   * @returns {Promise<Array<File>>} Los ficheros contenidos.
   */
  function _entradasAFicheros(entrada) {
    return new Promise(resuelve => {
      if (!entrada) return resuelve([]);
      if (entrada.isFile) {
        entrada.file(f => resuelve([f]), () => resuelve([]));
        return;
      }
      if (entrada.isDirectory) {
        const lector = entrada.createReader();
        const pendientes = [];
        const leerLote = () => lector.readEntries(async entradas => {
          if (entradas.length === 0) {
            const listas = await Promise.all(pendientes.map(_entradasAFicheros));
            resuelve([].concat(...listas));
            return;
          }
          pendientes.push(...entradas);
          leerLote();
        }, () => resuelve([]));
        leerLote();
        return;
      }
      resuelve([]);
    });
  }

  /**
   * Zona de arrastre del panel de carga (F5-I19): ficheros sueltos o
   * carpetas (recursivas). Las ENTRADAS de dataTransfer.items se leen
   * SINCRONAMENTE, antes de cualquier await: al salir del evento mueren.
   * @param {DragEvent} ev - El evento drop.
   * @returns {Promise<void>}
   */
  async function _alSoltarPanel(ev) {
    ev.preventDefault();
    const panel = _$('panelCarga');
    panel.classList.remove('sobre');
    const dt = ev.dataTransfer;
    if (!dt) return;
    let ficheros = Array.from(dt.files || []);
    if (dt.items && dt.items.length > 0) {
      const entradas = [];
      for (const it of dt.items) {
        const entrada = it.webkitGetAsEntry && it.webkitGetAsEntry();
        if (entrada) entradas.push(entrada);
      }
      if (entradas.some(e => e.isDirectory)) {
        const listas = await Promise.all(entradas.map(_entradasAFicheros));
        ficheros = [].concat(...listas);
      }
    }
    if (ficheros.length === 0) {
      avisarError('Arrastre NO cargado: no se ha leído ningún fichero.');
      return;
    }
    console.log('[carga] arrastre: ' + ficheros.length + ' fichero(s)');
    await _cargarCartucho(ficheros);
  }

  /**
   * Ctrl+V cuando la pestaña Carga está delante (F5-I19): si el portapapeles
   * trae ficheros, sube al núcleo; si trae texto, NO interfiere (se escribe
   * en la ficha y demás). Solo actúa en su pestaña, como las teclas de
   * la máquina solo valen en el Simulador.
   * @param {ClipboardEvent} ev - El evento paste.
   * @returns {void}
   */
  function _alPegarPanel(ev) {
    if (pestanaVista !== 'vistaCarga') return;
    const ficheros = ev.clipboardData && ev.clipboardData.files;
    if (!ficheros || ficheros.length === 0) return;    // texto: no interfiere
    ev.preventDefault();
    console.log('[carga] pegado: ' + ficheros.length + ' fichero(s)');
    _cargarCartucho(Array.from(ficheros));
  }

  /**
   * Núcleo UNIFICADO de carga (F5-I9): un solo flujo para todas las
   * formas, decididas por el CONTENIDO de la selección. F5-I19: sin
   * tipo esperado —la pestaña Carga admite todo y cualquier orden—.
   * Detector de forma, en este orden (un solo fichero):
   *   0. UN .json: si es de tipo GWS, es el SETUP (PESTAÑA Setup, sin
   *      tocar el cartucho); si no, cartucho por flujo de carpeta.
   *   1. UN fichero de paquete → se descomprime (abrirPACK) y el resultado
   *      vuelve a entrar aquí (un paquete es una carpeta en memoria).
   *   2. UN fichero .gwc → carga binaria (procesarGWC), que exige
   *      máquina previa (F5-I19: el GWC no viaja la configuración).
   *   3. Resto → flujo de carpeta (procesarCartucho), que resuelve el
   *      JSON prioritario por tipo (GWC > GWI > GWB).
   * @param {Array<Blob>} ficheros - Ficheros de la selección.
   * @returns {Promise<?string>} El tipo de fichero cargado (o null si
   *   no se cargó nada).
   */
  async function _cargarCartucho(ficheros) {
    // Rótulo del mensaje de error único de la carga (F5-I9/F5-I19):
    // «Setup NO cargado» para el GWS y «Cartucho NO cargado» para el resto.
    let rotulo = 'Cartucho';
    try {
      if (ficheros.length === 1) {
        const nombre = ficheros[0].name || '';
        // UN .json/.gws: setup (GWS; F5-I17 M11: el GWS usa su extensión
        // .gws, el .json sigue admitido por compatibilidad) o cartucho de
        // un solo fichero.
        if (/\.(json|gws)$/i.test(nombre)) {
          const json = await _leerJSON(ficheros[0]);
          if (json.tipo === GWS_TIPO) {
            rotulo = 'Setup';                // el error, con su propio rótulo
            // F5-I20 (ajuste): cargar un GWS descarta el cartucho en
            // memoria (con su juego): confirmación SIEMPRE (se omite con
            // GW_DEBUG, como en el botón Limpiar).
            if (!_confirmarDescarteCartucho('Cargar un GWS')) {
              avisar('Carga cancelada: el cartucho en memoria se conserva.');
              return null;
            }
            _aplicarJSONSetup(json);         // los objetos o validación, al try/catch
            return 'GWS';
          }
          return await _procesarCartucho(ficheros);
        }
        // UN .zip: carpeta empaquetada; se descomprime en memoria y el
        // resultado vuelve a entrar en el detector (la forma no cambia
        // al descomprimir).
        if (BasePACK.esPACK(nombre)) {
          return await _cargarCartucho(
            await BaseCartucho.abrirPACK(ficheros[0]));
        }
        // UN .gwc: el cartucho de ejecución binario viaja solo; SIN la
        // configuración de la máquina (estilo y botones no viajan en el
        // GWC) no se carga.
        if (/\.gwc$/i.test(nombre)) {
          if (!setupGWS) {
            throw new Error('falta la configuración de la máquina, defínala ' +
              'o cargue un cartucho que la incluya (F5-I19).');
          }
          await _procesarGWC(ficheros[0]);
          return 'GWC';
        }
      }
      // En cualquier otro caso: flujo de carpeta (GWB, GWI en carpeta o
      // en ZIP ya descomprimido, o una carpeta que trae un .gwc).
      return await _procesarCartucho(ficheros);
    } catch (e) {
      // Mensaje de error ÚNICO de la carga (F5-I9).
      avisarError(rotulo + ' NO cargado: ' + e.message);
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
   * listas al puente. F5-I19: el cartucho cargado MANDA — la máquina
   * se re-ajusta en caliente derivando el setup del cartucho
   * (pestañas Setup y Cartucho se repoblan); el error implica conservar
   * el cartucho Y la máquina anteriores. Cada fichero solo necesita
   * ".name" y comportarse como Blob (File ya lo es).
   * @param {Array<Blob>} ficheros - Ficheros del cartucho.
   * @returns {Promise<?string>} El tipo de cartucho cargado (o null).
   */
  async function _procesarCartucho(ficheros) {
    // El GWC (F5-I6) es BINARIO: no hay JSON que leer. Si la carpeta
    // trae un .gwc, se carga por su propio flujo (leerGWC) y el JSON
    // prioritario ni se mira; F5-I19: sin máquina previa no se carga
    // (el GWC no viaja estilo ni botonera).
    const gwc = ficheros.find(f => /\.gwc$/i.test(f.name || ''));
    if (gwc) {
      if (!setupGWS) {
        throw new Error('falta la configuración de la máquina, defínala ' +
          'o cargue un cartucho que la incluya (F5-I19).');
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
      // despachada por tipo (F5-I19: sin tipo esperado) e imágenes
      // img_f/img_s. F5-I19: el estilo de la máquina NI SE PASA como
      // requisito: el cartucho manda y puede cambiar de máquina.
      const leido = await BaseCartucho.leerCartucho(ficheros,
        setupGWS ? setupGWS.estilo : null);
      const json = leido.json;
      const mapa = leido.mapa;

      // F5-I16: límites asentados al cargar (aviso junto al mensaje de
      // carga; lo que arrastra al puente y a las fichas ya es lo justo).
      const avisosLimites = BaseCartucho.revisarValores(json.tipo, json);

      // F5-I19: el cartucho cargado MANDA — la máquina se re-ajusta en
      // caliente derivando el setup del cartucho. Primero SIMULADO:
      // todas las comprobaciones se hacen contra la máquina que VENDRÁ,
      // para que un cartucho incompatible conserve el cartucho Y la
      // máquina anteriores (nada se toca hasta que todo es correcto).
      const candidato = _setupDerivadoDe(json, setupGWS);
      // F5-I15 (D3): TODAS las comprobaciones antes de tocar nada: si el
      // cartucho no es compatible con SU máquina, el anterior se conserva.
      const incompatible = _botonesInexistentes(json, candidato);
      if (incompatible) throw new Error(incompatible + ' (se conserva el cartucho anterior).');

      // F5-I17 (M3): ¿cuántas acciones tiene la autoría en curso? Hay que
      // contarlas ANTES de limpiar (la limpieza resetea la autoría). Si encima
      // viene un GWB (no un GWI, que trae la SUYA), se descartan sin que el
      // autor diga nada: hay que avisar (no bloqueante).
      const accionesPrevias = BaseDescomponer.numeroDeCambios();

      _limpiarCartucho();                       // fuera el cartucho anterior
      cartucho = json;
      const tipo = json.tipo;                  // obligatorio: sin tipo no se carga
      // F5-I19: la máquina derivada YA ES el setup (setupDerivado=true:
      // #estado avisará de que el GWS mostrado viene del cartucho) y el
      // hardware visible se re-fija EN CALIENTE (esqueleto, canvas,
      // botonera y panel), poblando la pestaña Setup con sus datos.
      setupGWS = candidato;
      setupDerivado = true;
      _fijarHardware();
      BaseSetup.poblar(setupGWS);
      // Tamaño del GWI cargado (aproximado: JSON + PNG); un GWB no tiene
      tamGWI = tipo === 'GWI' ? _sumarGWI(ficheros) : null;
      // F5-I19 (ya F3-I1): si el cartucho pide un botón que SU máquina
      // no tiene, NO carga (error bloqueante).
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
      // F5-I19: estilo y resolución vienen del cartucho, o de la
      // máquina derivada si el cartucho no los declara (heredados).
      BaseFicha.poblar({
        nombre: json.nombre,
        descripcion: json.descripcion || null,   // F5-I17 (M13)
        estilo: json.estilo !== undefined ? json.estilo : setupGWS.estilo,
        resolucion: json.resolucion || setupGWS.resolucion,
        codigoGWC: json.codigoGWC || null,   // F5-I17 (M1): «---» si no trae
        colorFondo: json.ColorFondo || null,
        memoria: json.memoria || null,        // F5-I20
        // F5-I21: sin botones: la ficha ya no los muestra ni los guarda.
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
      // cartucho cargado, F5-I9), y los avisos de límites F5-I16
      // ajustados en memoria al cargar.
      const descarteHistorial = (tipo !== 'GWI' && accionesPrevias > 0)
        ? ' ATENCIÓN: se descarta el historial del GWI anterior (' + accionesPrevias +
          ' acción(es)); si lo querías conservar, guarda el GWI antes de cargar otro cartucho.'
        : '';
      avisar('Cartucho cargado (' + tipo + '): ' + (json.nombre || '(sin nombre)') +
        (setupDerivado ? ' Setup derivado del cartucho.' : '') +
        (avisosLimites.length > 0 ? ' ' + avisosLimites.join(' ') : '') + descarteHistorial);
      return tipo;
    } catch (e) {
      pintarInfo();
      avisarError('Cartucho NO cargado: ' + e.message);
      return null;
    }
  }

  // (F5-I19: los eventos _alSeleccionarGWIZip y _alSeleccionarGWC se
  // RETIRAN con sus botones: la pestaña Carga y su panel son la
  // única puerta; el detector de forma (cargarCartucho) decide el flujo.)

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
      // F5-I16 (M5): la resolución del GWC es BLOQUEANTE (fuera de
      // rango no se carga, se conserva el cartucho anterior).
      if (leido.resolucion.ancho < BaseCartucho.PANTALLA_MIN.ancho ||
        leido.resolucion.alto < BaseCartucho.PANTALLA_MIN.alto ||
        leido.resolucion.ancho > BaseCartucho.PANTALLA_MAX.ancho ||
        leido.resolucion.alto > BaseCartucho.PANTALLA_MAX.alto) {
        throw new Error('la "resolucion" del GWC (' + leido.resolucion.ancho + 'x' +
          leido.resolucion.alto + ') está fuera del rango de pantallas (' +
          BaseCartucho.PANTALLA_MIN.ancho + 'x' + BaseCartucho.PANTALLA_MIN.alto + ' a ' +
          BaseCartucho.PANTALLA_MAX.ancho + 'x' + BaseCartucho.PANTALLA_MAX.alto + ').');
      }
    } catch (e) {
      avisarError('Cartucho NO cargado: ' + e.message +
        ' (se conserva el cartucho anterior).');
      return;
    }
    BaseCartucho.revocarURLs();    // object URLs del cartucho anterior, fuera
    // F5-I16: límites asentados también en el GWC binario cargado.
    const avisosLimites = BaseCartucho.revisarValores('GWC', leido);
    // F5-I15 (D1): el GWC es pura ejecución y no se edita: la autoría del
    // cartucho anterior (GWB/GWI) se descarta entera, con sus botones.
    BaseDescomponer.reset();
    editable = false;
    tamGWI = null;
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
    avisar('Cartucho cargado (GWC): ' + fichero.name +
      (avisosLimites.length > 0 ? ' ' + avisosLimites.join(' ') : ''));
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
  /**
   * F5-I17 (M4): la tecla de evento normalizada, con las flechas
   * del PC mapeadas al nombre de cursor; el resto, en minúsculas.
   * @param {string} k - ev.key del teclado PC.
   * @returns {string} Tecla normalizada para comparar con dataset.tecla.
   */
  function _teclaDeEvento(k) {
    for (const [nombre, c] of Object.entries(CURSORES)) {
      if (c.flecha === k) return nombre;
    }
    return String(k).toLowerCase();
  }

  /**
   * Encuentra el botón físico asociado a una tecla (si existe).
   * Sin selector CSS: una tecla como «"» o «\» lo rompería (REVISION #14).
   * F5-I17 (M4): las flechas del PC (ArrowLeft…) encuentran el botón
   * cuyo dataset.tecla es el nombre de cursor.
   * @param {string} tecla - Tecla pulsada (ev.key del teclado PC).
   * @returns {?HTMLElement} Botón físico, o null.
   */
  function _buscarBotonPorTecla(tecla) {
    const t = _teclaDeEvento(tecla);
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
      vistaCarga: 'pesCarga',
      vistaSetup: 'pesSetup',
      vistaSimulador: 'pesSimulador',
      vistaEditor: 'pesEditor',
      vistaSprites: 'pesSprites',
      vistaCartucho: 'pesCartucho',
      vistaPruebas: 'pesPruebas'
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
   * Carga SIEMPRE (F5-I19: es la puerta en cualquier estado, con setup o
   * sin él; salvo en partida); Setup siempre (menos en partida);
   * Cartucho y Simulador con un setup aplicado (cargado o derivado);
   * Editor y Sprites con un cartucho editable (GWB o GWI) y sin GWC
   * cargado (el GWC, ejecución pura, no se edita). Durante la partida,
   * solo el Simulador. Los botones siguen la misma regla; los de
   * autoría los habilita la autoría.
   * @returns {void}
   */
  function _actualizarPestanas() {
    const soloSimulador = cartucho !== null && cartucho.tipo === 'GWC';
    _$('pesCarga').disabled = enJuego;      // F5-I19: la carga, siempre disponible (menos en partida)
    _$('pesSetup').disabled = enJuego;
    _$('pesCartucho').disabled = enJuego || !setupGWS;
    _$('pesEditor').disabled = enJuego || !setupGWS || !editable || soloSimulador;
    _$('pesSprites').disabled = enJuego || !setupGWS || !editable || soloSimulador;
    _$('pesSimulador').disabled = !setupGWS;
    _$('pesPruebas').disabled = enJuego;    // Pruebas: con partida no se toca (GW_DEBUG la descubre pruebas/pruebas.js)
    for (const id of BOTONES_CARGA) _$(id).disabled = enJuego;
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
    const necesarios = [
      'estado', 'pantalla', 'maquina',
      'panelEstado', 'infoMaquina', 'infoDiseno',
      'listaSegmentos', 'zonaMapa', 'mapaSegmentos',
      'panelSegmento', 'ficheroCartucho', 'carpetaCartucho',
      'panelCarga',
      'pesCarga', 'pesSetup', 'pesSimulador', 'pesEditor',
      'pesSprites', 'pesCartucho', 'pesPruebas',
      'vistaCarga', 'vistaSetup', 'vistaSimulador', 'vistaEditor',
      'vistaSprites', 'vistaCartucho', 'fichaSetup',
      'fichaCartucho', 'lienzoEditor']
      .concat(BOTONES_CARGA, BOTONES_SETUP, BOTONES_CARTUCHO, BOTONES_AUTORIA);
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
    // F5-I19: los DOS botones de la pestaña Carga y sus inputs.
    _$('btnCargarFicheros').addEventListener('click', () => _$('ficheroCartucho').click());
    _$('btnCargarCarpeta').addEventListener('click', () => _$('carpetaCartucho').click());
    _$('ficheroCartucho').addEventListener('change', _alSeleccionarFicheros);
    _$('carpetaCartucho').addEventListener('change', _alSeleccionarCarpeta);
    // F5-I19: la zona de arrastre del panel y el pegado con ficheros
    // (solo actúa con la pestaña Carga delante).
    const panel = _$('panelCarga');
    panel.addEventListener('dragover', ev => {
      ev.preventDefault();
      panel.classList.add('sobre');
    });
    panel.addEventListener('dragleave', () => panel.classList.remove('sobre'));
    panel.addEventListener('drop', _alSoltarPanel);
    document.addEventListener('paste', _alPegarPanel);

    _$('btnAplicarSetup').addEventListener('click', () => _aplicarDesdeFichaSetup(false));
    _$('btnGuardarSetup').addEventListener('click', () => _aplicarDesdeFichaSetup(true));
    _$('btnAplicarCartucho').addEventListener('click', _aplicarDesdeFichaCartucho);
    _$('btnGuardarGWB').addEventListener('click', async () => {
      _$('btnGuardarGWB').disabled = true;           // evita guardados solapados
      try { await BaseFicha.guardar(); } finally { _actualizarPestanas(); }
    });
    document.body.dataset.vista = 'vistaCarga';   // F5-I19: se arranca EN la pestaña Carga
    _$('btnLimpiarCarga').addEventListener('click', _limpiarTodo);
    _$('pesCarga').addEventListener('click', () => mostrarPestanna('vistaCarga'));
    _$('pesSetup').addEventListener('click', () => mostrarPestanna('vistaSetup'));
    _$('pesSimulador').addEventListener('click', () => mostrarPestanna('vistaSimulador'));
    _$('pesEditor').addEventListener('click', () => mostrarPestanna('vistaEditor'));
    _$('pesSprites').addEventListener('click', () => mostrarPestanna('vistaSprites'));
    _$('pesCartucho').addEventListener('click', () => mostrarPestanna('vistaCartucho'));
    _$('pesPruebas').addEventListener('click', () => mostrarPestanna('vistaPruebas'));

    _$('btnGuardar').addEventListener('click', _verificarYGuardar);
    // F5-I6: el botón «Generar GWI+GWC» — verificación bloqueante,
    // topes bloqueantes, GWC primero y GWI con el Código GWC del par
    // después. La lógica vive en BaseDescomponer.
    _$('btnGenerar').addEventListener('click', () => BaseDescomponer.generarGWIyGWC());
    _$('btnDeshacer').addEventListener('click', () => BaseDescomponer.deshacer());
    _$('btnRehacer').addEventListener('click', () => BaseDescomponer.rehacer());
    BaseDescomponer.inicializar();                 // el clic del mapa, cableado por BaseDescomponer.js
    BaseSetup.pintar(_$('fichaSetup'));                  // F5-I12: la ficha del setup, desde el arranque
    _actualizarPestanas();                               // F5-I19: se arranca en la pestaña Carga
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
    inicializar: inicializar,
    avisar: avisar,
    avisarError: avisarError,
    validarSetup: validarSetup,           // F5-I12: la verifica también la ficha del Setup
    teclaValida: teclaValida,             // F5-I17 (M8): la usan la ficha del cartucho y la validación de carga
    normalizarTecla: normalizarTecla,     // F5-I17 (M8): idem, para comparar y guardar
    datosCartucho: () => cartucho,        // el JSON del cartucho en memoria (lo lee la pestaña Pruebas)
    datosSetup: () => setupGWS,           // el GWS en memoria (real o derivado); _descargarGWS lo usa (F5-I17 M9)
    codigoGWCCargado: () => (cartucho && cartucho.tipo === 'GWI' && cartucho.codigoGWC) ? cartucho.codigoGWC : null,   // F5-I17 (M2)
    jugar: jugar,
    finDePartida: finDePartida,
    pestanna: mostrarPestanna,            // abrir el Editor desde la lista de segmentos
    pintarInfo: pintarInfo,
    informarTamanos: informarTamanos,
    estiloDeSetup: () => (setupGWS ? String(setupGWS.estilo) : null),
    pantallaDeSetup: () => (setupGWS && setupGWS.resolucion) ? { ancho: setupGWS.resolucion.ancho, alto: setupGWS.resolucion.alto } : null,
    // F5-I21: los botones del cartucho (GWB/GWI) son los del setup; la
    // ficha de Cartucho los pide aquí al montarlos. Copia profunda.
    botonesDeSetup: () => (setupGWS && Array.isArray(setupGWS.botones))
      ? setupGWS.botones.map(b => Object.assign({}, b)) : [],
    imagenFondo: () => imgF,
    colorFondo: () => colorFondo,
    confirmarCambioComun: _confirmarCambioComun,       // F5-I21: decisiones de datos comunes (ajustar/rehacer)
    ajustarResolucion: _abrirVentanaResolucion,        // F5-I21: botón «Ajustar resolución» de Setup
    aplicarAjusteResolucion: _aplicarAjusteResolucion, // F5-I21: ajuste sin ventana (pruebas D10/C9/E10)
    imagenSegmentos: () => imgS,
    imagenPortada: () => imgM,           // img_m: la pasa guardarGWI al ZIP
    imagenBlob: (img) => BaseCartucho.imagenBlob(img)
  };

})();

BaseDirector.inicializar();