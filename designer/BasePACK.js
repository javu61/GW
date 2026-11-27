'use strict';

// basePACK.js
// ====================================================================================================
// PROPÓSITO
//   Manejo unificado de los PAQUETES de ficheros del proyecto (cartuchos
//   GWB y GWI empaquetados). Hoy el paquete es un ZIP (librería JSZip),
//   pero el resto del programa solo habla de PACK: quien guarda pasa el
//   nombre SIN extensión y este módulo le pone la del formato en uso
//   (TIPO_COMPRESION), de modo que cambiar de formato es un cambio local.
//   Es lo más independiente posible: no conoce los formatos de cartucho
//   ni al director, y comunica los fallos LANZANDO excepciones (quien
//   llama decide cómo mostrarlas).
//
// IMPORTANTE
//   Solo se maneja hoy el formato ZIP con JSZip. La tabla
//   FORMATOS_COMPRESION define para cada formato su extensión, su
//   librería y las TRES funciones que lo manejan (verificar, leer,
//   construir); los demás formatos son solo ejemplos sin implementar
//   (sus funciones son null). TIPO_COMPRESION elige el formato en uso.
//   Para añadir un formato hay dos caminos:
//      - Escribir sus tres funciones en este módulo y ponerlas en la tabla.
//      - Moverlas a un módulo propio por formato y referenciarlas en la
//        tabla de forma diferida ((f) => PackXXX.leer(f)) para no depender
//        del orden de carga de los scripts.
//   En ambos casos este módulo sigue siendo el punto único de entrada
//   para el resto del sistema, que solo habla de PACK.
//   Regla: las funciones de un formato (verificarZIP, leerZIP,
//   construirZIP) no usan nada del resto del módulo salvo su librería;
//   así moverlas a otro fichero es cortar y pegar.
//
// FUNCIONES
//  Interfaz pública (despachan según TIPO_COMPRESION)
//   verificarPACK   Comprueba que la librería del formato está cargada.
//   nombreFichero   Añade al nombre base la extensión del formato.
//   esPACK          Dice si un nombre de fichero es un paquete (por extensión).
//   leerPACK        Abre un File de paquete y devuelve sus ficheros como Blob.
//   construirPACK   Construye el paquete (Blob) desde una lista de entradas.
//   guardarPACK     Construye el paquete y lo descarga; devuelve el tamaño.
//   descargarBlob   Fuerza la descarga de un Blob con un nombre.
//  Formato ZIP (JSZip)
//   _verificarZIP    Comprueba que JSZip está cargado (lanza error si no).
//   _leerZIP         Abre un ZIP y devuelve sus ficheros como Blob.
//   _construirZIP    Construye el ZIP (Blob) desde una lista de entradas.
//  Internas
//   _formatoEnUso    Devuelve el formato activo, comprobando que está implementado.
//   _tamanoDe        Bytes de una entrada (Blob o texto UTF-8).
//
// ENTRADAS
//   Cada entrada es {nombre, contenido}: nombre con su ruta dentro del
//   paquete ("segmentos/img_001.png") y contenido un Blob o un texto.
// ====================================================================================================

var basePack = (function () {

  // ---------------- Formato ZIP (JSZip) ----------------

  /**
   * Comprueba que la librería JSZip está disponible.
   * @returns {void}
   * @throws {Error} Si JSZip no está cargado.
   */
  function _verificarZIP() {
    if (typeof JSZip === 'undefined') {
      throw new Error('Manejar paquetes ZIP requiere la librería JSZip: ' +
        'coloca jszip.min.js junto a los demás scripts.');
    }
  }

  /**
   * Abre un ZIP en memoria: cada entrada (no carpeta) se convierte en un
   * Blob con ".name" igual al nombre base (sin carpetas), de modo que el
   * resultado se trata igual que los ficheros de una carpeta.
   * @param {File} fichero - Fichero ZIP seleccionado.
   * @returns {Promise<Blob[]>} Ficheros del ZIP (puede estar vacío).
   * @throws {Error} Si falta JSZip o el ZIP no es válido.
   */
  async function _leerZIP(fichero) {
    _verificarZIP();
    const zip = await JSZip.loadAsync(await fichero.arrayBuffer());
    const ficheros = [];
    for (const entrada of Object.values(zip.files)) {
      if (entrada.dir) continue;
      const blob = await entrada.async('blob');
      blob.name = entrada.name.split('/').pop();   // mapa plano por nombre base
      ficheros.push(blob);
    }
    return ficheros;
  }

  /**
   * Construye un ZIP en memoria desde entradas ya validadas.
   * @param {Array<{nombre:string, contenido:(Blob|string)}>} entradas -
   *        Ficheros del ZIP, con su ruta interna.
   * @returns {Promise<Blob>} El ZIP.
   * @throws {Error} Si falta JSZip.
   */
  async function _construirZIP(entradas) {
    _verificarZIP();
    const zip = new JSZip();
    for (const e of entradas) zip.file(e.nombre, e.contenido);
    return zip.generateAsync({ type: 'blob' });
  }

  // ---------------- Tabla de formatos ----------------

  // Formatos de paquete conocidos (tabla inmutable). Solo ZIP está
  // implementado y verificado; el resto son ejemplos con sus funciones a
  // null. Todo formato admitido debe poder leer Y escribir.
  // Los formatos de un solo flujo (gzip, zlib) no sirven solos como
  // paquete de varios ficheros: por eso solo aparecen combinados (TAR.GZ).
  const FORMATOS_COMPRESION = Object.freeze({
    ZIP: {
      nombre: 'ZIP', extension: '.zip', modulo: 'JSZip', fichero: 'jszip.min.js',
      verificar: _verificarZIP, leer: _leerZIP, construir: _construirZIP
    },
    TAR: {
      nombre: 'TAR', extension: '.tar', modulo: 'libarchive', fichero: 'libarchive.min.js',
      verificar: null, leer: null, construir: null
    },
    RAR: {
      nombre: 'RAR', extension: '.rar', modulo: 'libarchive', fichero: 'libarchive.min.js',
      verificar: null, leer: null, construir: null
    },
    SEVENZIP: {
      nombre: '7ZIP', extension: '.7z', modulo: '7z-wasm', fichero: '7z-wasm.min.js',
      verificar: null, leer: null, construir: null
    },
    TAR_GZ: {
      nombre: 'TAR.GZ', extension: '.tar.gz', modulo: 'fflate', fichero: 'fflate.min.js',
      verificar: null, leer: null, construir: null
    }
  });

  // Formato en uso: uno de la tabla.
  const TIPO_COMPRESION = FORMATOS_COMPRESION.ZIP;

  // ---------------- Interfaz pública ----------------

  /**
   * Devuelve el formato activo, comprobando que está implementado.
   * @returns {Object} Entrada de FORMATOS_COMPRESION en uso.
   * @throws {Error} Si el formato no tiene funciones implementadas.
   */
  function _formatoEnUso() {
    const f = TIPO_COMPRESION;
    if (!f || typeof f.verificar !== 'function' ||
      typeof f.leer !== 'function' || typeof f.construir !== 'function') {
      throw new Error('Formato de paquete no soportado: ' + (f ? f.nombre : f));
    }
    return f;
  }

  /**
   * Comprueba que la librería del formato en uso está disponible.
   * @returns {void}
   * @throws {Error} Si el formato no está soportado o falta su librería.
   */
  function verificarPACK() {
    _formatoEnUso().verificar();
  }

  /**
   * Añade al nombre base la extensión del formato de paquete.
   * @param {string} base - Nombre SIN extensión (p.ej. "cartucho_GWB").
   * @returns {string} Nombre con extensión (p.ej. "cartucho_GWB.zip").
   */
  function nombreFichero(base) {
    return base + TIPO_COMPRESION.extension;
  }

  /**
   * Indica si la extensión del nombre es la de un paquete del formato en uso.
   * @param {string} nombre - Nombre de fichero.
   * @returns {boolean} true si termina en la extensión del formato.
   */
  function esPACK(nombre) {
    return typeof nombre === 'string' &&
      nombre.toLowerCase().endsWith(TIPO_COMPRESION.extension);
  }

  /**
   * Abre un fichero de paquete en memoria (ver leerZIP): los ficheros
   * salen como Blob con ".name" base, tratables como los de una carpeta.
   * @param {File} fichero - Fichero de paquete seleccionado.
   * @returns {Promise<Blob[]>} Ficheros del paquete.
   * @throws {Error} Si el formato no está soportado, falta la librería, el paquete
   *         no es válido o está vacío.
   */
  async function leerPACK(fichero) {
    const f = _formatoEnUso();
    const ficheros = await f.leer(fichero);
    if (ficheros.length === 0) throw new Error('el paquete no contiene ficheros.');
    return ficheros;
  }

  /**
   * Bytes que ocupa el contenido de una entrada, sin comprimir.
   * @param {Blob|string} contenido - Blob o texto (UTF-8).
   * @returns {number} Tamaño en bytes.
   */
  function _tamanoDe(contenido) {
    return (contenido instanceof Blob) ? contenido.size : new Blob([contenido]).size;
  }

  /**
   * Construye un paquete en memoria desde una lista de entradas, sin
   * descargarlo (sirve también para pruebas). Valida las entradas aquí,
   * una sola vez para cualquier formato.
   * @param {Array<{nombre:string, contenido:(Blob|string)}>} entradas -
   *        Ficheros del paquete, con su ruta interna.
   * @returns {Promise<{blob:Blob, tamano:number}>} El paquete y la suma
   *          de los bytes de las entradas, sin comprimir.
   * @throws {Error} Si el formato no está soportado, falta la librería, no hay
   *         entradas o alguna no tiene nombre o contenido.
   */
  async function construirPACK(entradas) {
    const f = _formatoEnUso();
    if (!Array.isArray(entradas) || entradas.length === 0) {
      throw new Error('no hay ficheros que guardar en el paquete.');
    }
    let tamano = 0;
    for (const e of entradas) {
      if (!e || typeof e.nombre !== 'string' || e.nombre === '') {
        throw new Error('una entrada del paquete no tiene nombre.');
      }
      if (e.contenido === undefined || e.contenido === null) {
        throw new Error('la entrada «' + e.nombre + '» del paquete no tiene contenido.');
      }
      tamano += _tamanoDe(e.contenido);
    }
    return { blob: await f.construir(entradas), tamano: tamano };
  }

  /**
   * Fuerza la descarga de un Blob con un enlace efímero: la object URL
   * se revoca a los 5 s (el navegador ya habrá iniciado la descarga).
   * @param {Blob} blob - Contenido a descargar.
   * @param {string} nombreDescarga - Nombre con el que se descarga.
   * @returns {void}
   */
  function descargarBlob(blob, nombreDescarga) {
    const enlace = document.createElement('a');
    const url = URL.createObjectURL(blob);
    enlace.href = url;
    enlace.download = nombreDescarga;
    document.body.appendChild(enlace);
    enlace.click();
    enlace.remove();
    setTimeout(() => URL.revokeObjectURL(url), 5000);
  }

  /**
   * Construye el paquete desde las entradas y lo descarga con la
   * extensión del formato.
   * @param {Array<{nombre:string, contenido:(Blob|string)}>} entradas -
   *        Ficheros del paquete, con su ruta interna.
   * @param {string} nombreBase - Nombre de la descarga SIN extensión
   *        (p.ej. "cartucho_GWB"); se le añade la del formato.
   * @returns {Promise<number>} Suma de los bytes de las entradas, sin
   *          comprimir (no el tamaño del paquete).
   * @throws {Error} Los de construirPACK.
   */
  async function guardarPACK(entradas, nombreBase) {
    const { blob, tamano } = await construirPACK(entradas);
    descargarBlob(blob, nombreFichero(nombreBase));
    return tamano;
  }

  return {
    verificarPACK: verificarPACK,
    nombreFichero: nombreFichero,
    esPACK: esPACK,
    leerPACK: leerPACK,
    construirPACK: construirPACK,
    guardarPACK: guardarPACK,
    descargarBlob: descargarBlob
  };

})();
