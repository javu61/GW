'use strict';

// BaseCartucho.js
// ====================================================================================================
// PROPÓSITO
//   Lectura y grabación de los tres formatos de cartucho del proyecto
//   (GWB, GWI y GWC) y verificación del cartucho antes de escribirlo.
//   El manejo de paquetes (leer, construir, descargar) vive en BasePACK.
//
// FUNCIONES
//
//  Utilidades de ficheros
//   leerJSON                Lee un fichero y lo parsea como JSON.
//   crearURL / revocarURLs  Crea object URLs de ficheros y las revoca todas.
//   cargarImagen            Carga un fichero como imagen.
//   _cargarImagenAux        Carga una imagen opcional (null si falta o falla).
//   imagenBlob              Convierte una imagen en un PNG (Blob).
//
//  Lectura de GWB / GWI
//   _construirMapaFicheros  Mapa nombre → fichero de la carpeta o del paquete.
//   _elegirJSONCartucho     Elige el .json a cargar (GWC > GWI > GWB).
//   validarComunes          Contrato de ENTRADA común a GWB y GWI (img_s
//                           obligatoria; img_f e img_m opcionales).
//   validarGWB              Validación ESPECÍFICA, llama a validarComunes
//   validarGWI              Validación ESPECÍFICA, llama a validarComunes
//   cargarDelMapa           Carga una imagen referenciada por el JSON.
//   _validarTamanoImgS      Avisa si img_s y img_f difieren de tamaño.
//   leerCartucho            Lectura completa: JSON, validación despachada
//                           por tipo, tipo esperado e imágenes.
//   abrirPACK               Abre un paquete de cartucho (delega en BasePACK.leerPACK).
//   leerGWB / leerGWI       Lectura específica: delegan en leerCartucho
//                           con el tipo esperado.
//
//  Grabación del GWI
//   _formatearGWI           Serializa el GWI en JSON compacto.
//   guardarGWI              Guarda el GWI en paquete (avisos y bloqueo del botón).
//   _guardarGWIEnDisco      Monta las entradas del GWI y las guarda (BasePACK.guardarPACK).
//   _formatearGWB           Serializa el GWB (solo lo que un GWB declara).
//   guardarGWB              Guarda el GWB en paquete (F5-I10: JSON + imágenes).
//
//  Verificación del diseñador
//   verificarCartucho       Recorre los grupos y devuelve errores y avisos
//                           (delega en una función por regla).
//
//  Grabación del GWC
//   generarGWC              Orquesta el ensamblado del fichero binario.
//   _montarConfiguracion    Bloque 1: valores del Director y del fin.
//   _montarSprites          Bloque 2: máscaras de 1 bit escaladas.
//   _montarSegmentos        Bloque 3: registros fijos de 32 bytes.
//   _montarSecuencias       Bloque 4: la Secuencia (opcional).
//   _montarDatosGenerales   Bloque 0: estilo, pantalla (resolución), conteos, direcciones.
//   _montarCabecera         Cabecera con código «#HHHH#» y tamaño.
//   validarTopes            Comprueba el tope de 255 elementos por índice.
//   _viajanEnGWC            Qué segmentos y sprites viajan al GWC.
//   escalar                 Sprite → máscara de 1 bit escalada a la pantalla.
//   indiceDe                Id legible → índice de 1 byte (0xFF = nulo).
//   bloque                  Estructura común de un bloque.
//   _sumaDeVerificacion     Calcula el CRC de 16 bits
//   _codigoDeSuma           Retorna el texto del CRC como «#HHHH#».
//   estadistica             Texto con el tamaño final y su desglose.
//
//  Lectura del GWC (autocontenida)
//   leerGWC                 Valida y reconstruye listas y configuración.
//   _crearLectorBytes       
//   _validarCabeceraGWC 
//   _abrirBloqueGWC
//   _leerDatosGeneralesGWC  
//   _leerConfiguracionGWC 
//   _leerSpritesGWC
//   _leerSegmentosGWC
//   _leerSecuenciasGWC      Un paso de la lectura cada una.
// ====================================================================================================

var BaseCartucho = (function () {

  // ---------------- Estado privado ----------------

  let urlsCreadas = [];  // object URLs creadas al cargar, para revocarlas

  // Tipos de JSON de cartucho. El autor declara en qué estado está cada fichero.
  const TIPOS_CARTUCHO = ['GWB', 'GWI', 'GWC'];

  // Orden de prioridad al elegir qué .json cargar de una carpeta.
  const PRIORIDAD_TIPOS = ['GWC', 'GWI', 'GWB'];

  // Tipo numérico de los fantasmas de unión (solo informativos en el GWI).
  const TIPO_FANTASMA = 99;

  // Suma R+G+B a partir de la cual un píxel se considera blanco (transparente).
  const UMBRAL_BLANCO = 384;

  // ---------------- Utilidades de ficheros ----------------

  /**
   * Lee un fichero y lo parsea como JSON.
   * @param {File} fichero - Fichero .json a leer.
   * @returns {Promise<Object>} Objeto JSON parseado.
   */
  async function leerJSON(fichero) {
    const texto = await fichero.text();
    return JSON.parse(texto);
  }

  /**
   * Crea una object URL para un fichero y la anota para revocarla al limpiar.
   * @param {File} fichero - Fichero del cartucho.
   * @returns {string} Object URL del fichero.
   */
  function crearURL(fichero) {
    const url = URL.createObjectURL(fichero);
    urlsCreadas.push(url);
    return url;
  }

  /**
   * Revoca TODAS las object URLs creadas por el módulo (las imágenes del
   * cartucho anterior mueren con él). La llama BaseDirector al limpiar.
   * @returns {void}
   */
  function revocarURLs() {
    for (const url of urlsCreadas) URL.revokeObjectURL(url);
    urlsCreadas = [];
  }

  /**
   * Carga un fichero como imagen.
   * @param {File} fichero - Fichero de imagen.
   * @returns {Promise<HTMLImageElement>} Imagen cargada.
   */
  function cargarImagen(fichero) {
    return new Promise((resolver, rechazar) => {
      const imagen = new Image();
      imagen.onload = () => resolver(imagen);
      imagen.onerror = () => rechazar(new Error('No se pudo cargar la imagen: ' + fichero.name));
      imagen.src = crearURL(fichero);
    });
  }

  /**
   * Carga una imagen del cartucho SIN provocar error si falta o falla
   * (devuelve null y deja constancia en consola).
   * @param {Map<string,File>} mapa - Nombre de fichero → File.
   * @param {string} nombre - Nombre referenciado por el JSON.
   * @returns {Promise<?HTMLImageElement>} Imagen, o null si no está/falla.
   */
  async function _cargarImagenAux(mapa, nombre) {
    if (typeof nombre !== 'string' || !mapa.has(nombre)) return null;
    try {
      return await cargarImagen(mapa.get(nombre));
    } catch (e) {
      console.warn(e.message);
      return null;
    }
  }

  /**
   * Convierte una imagen en PNG (Blob) para empaquetarla en el paquete: pasa
   * por un canvas porque un HTMLImageElement no tiene toBlob.
   * @param {HTMLImageElement} imagen - Imagen en memoria (img_f o img_s).
   * @returns {Promise<Blob>} PNG de la imagen.
   */
  function imagenBlob(imagen) {
    const lienzo = document.createElement('canvas');
    lienzo.width = imagen.naturalWidth;
    lienzo.height = imagen.naturalHeight;
    lienzo.getContext('2d').drawImage(imagen, 0, 0);
    return new Promise(resolver => lienzo.toBlob(resolver, 'image/png'));
  }

  // ---------------- Lectura del cartucho (GWB / GWI) ----------------

  /**
   * Map nombreDeFichero → File, para resolver las imágenes que el JSON
   * referencia por nombre, sin depender de rutas reales en disco.
   * @param {File[]} ficheros - Ficheros de la carpeta o del paquete.
   * @returns {Map<string,File>} Mapa nombre → File.
   */
  function _construirMapaFicheros(ficheros) {
    const mapa = new Map();
    for (const fichero of ficheros) {
      if (mapa.has(fichero.name)) console.warn('Fichero repetido en la carpeta: ' + fichero.name);
      mapa.set(fichero.name, fichero);
    }
    return mapa;
  }

  /**
   * Lee todos los .json indicados; los que no se puedan leer se saltan
   * con aviso en consola.
   * @param {Map<string,File>} mapa - Mapa nombre → File.
   * @param {string[]} nombres - Nombres de los .json a leer.
   * @returns {Promise<Array<{nombre:string, json:Object}>>} Los leídos.
   */
  async function leerJSONsLegibles(mapa, nombres) {
    const leidos = [];
    for (const nombre of nombres) {
      try {
        leidos.push({ nombre: nombre, json: await leerJSON(mapa.get(nombre)) });
      } catch (e) {
        console.warn('No se puede leer ' + nombre + ': ' + e.message);
      }
    }
    return leidos;
  }

  /**
   * Elige el JSON de mayor prioridad de tipo (GWC > GWI > GWB).
   * @param {Array<{nombre:string, json:Object}>} leidos - JSONs leídos.
   * @returns {?{nombre:string, json:Object}} El elegido, o undefined si
   *   ninguno declara un tipo válido.
   */
  function elegirPorPrioridad(leidos) {
    for (const tipo of PRIORIDAD_TIPOS) {
      const encontrado = leidos.find(o => o.json && o.json.tipo === tipo);
      if (encontrado) return encontrado;
    }
    return undefined;
  }

  /**
   * Texto que dice exactamente qué «tipo» declara cada JSON leído
   * (nada silencioso cuando ninguno es válido).
   * @param {Array<{nombre:string, json:Object}>} leidos - JSONs leídos.
   * @returns {string} Lista «fichero (tipo: X), ...».
   */
  function describirTiposEncontrados(leidos) {
    return leidos.map(o =>
      o.nombre + ' (tipo: ' + (o.json && o.json.tipo !== undefined ?
        JSON.stringify(o.json.tipo) : 'falta') + ')').join(', ');
  }

  /**
   * Lee TODOS los .json del cartucho y elige cuál cargar por prioridad de
   * tipo. Así la carpeta puede convivir con sus tres estados y siempre se
   * carga el más avanzado.
   * @param {Map<string,File>} mapa - Mapa nombre → File.
   * @returns {Promise<{nombre:string, json:Object}>} JSON elegido.
   */
  async function _elegirJSONCartucho(mapa) {
    const nombres = Array.from(mapa.keys()).filter(n => n.toLowerCase().endsWith('.json'));
    if (nombres.length === 0) throw new Error('la carpeta no contiene ningún .json.');

    const leidos = await leerJSONsLegibles(mapa, nombres);
    if (leidos.length === 0) throw new Error('ningún .json de la carpeta se ha podido leer.');

    const elegido = elegirPorPrioridad(leidos);
    if (!elegido) {
      throw new Error('ningún .json de la carpeta declara un "tipo" válido ' +
        '(GWB, GWI o GWC). Encontrados: ' + describirTiposEncontrados(leidos) + '.');
    }
    if (leidos.length > 1) {
      console.info('[cartucho] había ' + leidos.length + ' .json en la carpeta: se carga ' +
        elegido.nombre + ' (tipo ' + elegido.json.tipo +
        ', prioridad GWC > GWI > GWB).');
    }
    return elegido;
  }

  /**
   * Contrato de ENTRADA común a GWB y GWI (F5-I9: antes
   * validarCartucho). Tipo y versión son OBLIGATORIOS: sin
   * tipo no se asume nada. El estilo debe coincidir con la máquina cargada
   * (se recibe por parámetro: el módulo no conoce el setup). Contrato
   * común de GWB y GWI en las imágenes de pantalla: img_s OBLIGATORIA
   * (y su fichero presente); img_f e img_m OPCIONALES, pero si se
   * declaran sus ficheros deben estar (el GWC se valida en leerGWC).
   * @param {Object} json - JSON del cartucho.
   * @param {Map<string,File>} mapa - Mapa nombre → File de la carpeta.
   * @param {string} estiloMaquina - Estilo del setup cargado.
   * @returns {?string} null si es válido, o el mensaje de error.
   */
  function validarComunes(json, mapa, estiloMaquina) {
    if (!json || typeof json !== 'object' || Array.isArray(json)) {
      return 'el cartucho no es un objeto JSON.';
    }
    if (json.tipo === undefined || TIPOS_CARTUCHO.indexOf(json.tipo) < 0) {
      return 'el cartucho necesita un "tipo" válido: ' + TIPOS_CARTUCHO.join(', ') + '.';
    }
    if (json.version === undefined || typeof json.version !== 'number') {
      return 'el cartucho necesita una "version" numérica (p.ej. 1).';
    }
    // estilo: OPCIONAL en el GWB (si falta se usa el del setup cargado);
    // en el GWI viaja siempre (el GWI es autosuficiente). Si viene,
    // debe coincidir con el del setup.
    if (json.estilo === undefined || json.estilo === null) {
      if (json.tipo === 'GWI') {
        return 'el GWI necesita un "estilo" de máquina válido.';
      }
    } else {
      if (typeof json.estilo !== 'string' || json.estilo === '') {
        return 'el "estilo" del cartucho no es válido.';
      }
      // Un cartucho de MENOS botones se juega en una máquina con más
      // (un juego de 2 botones en una máquina de 4); al revés, no.
      if (Number(json.estilo) > Number(estiloMaquina)) {
        return 'el cartucho es para una máquina de estilo ' + json.estilo +
          ' y el setup es de estilo ' + estiloMaquina + ' (menos botones).';
      }
    }
    // resolucion {ancho, alto}: OPCIONAL en el GWB (si falta se usa la
    // "pantalla" del GWS cargado); OBLIGATORIA en el GWI. Un GWI antiguo 
    // sin ella se rechaza con un mensaje claro. Si viene y difiere de la
    // del setup, solo aviso por consola (no bloquea).
    if (json.resolucion === undefined || json.resolucion === null) {
      if (json.tipo === 'GWI') {
        return 'el GWI necesita "resolucion" {ancho, alto}.';
      }
    } else {
      const r = json.resolucion;
      const entero = v => Number.isInteger(v) && v > 0;
      if (typeof r !== 'object' || Array.isArray(r) || !entero(r.ancho) || !entero(r.alto)) {
        return 'la "resolucion" del cartucho debe ser {ancho, alto} con enteros positivos.';
      }
      const ps = (typeof BaseDirector !== 'undefined' && BaseDirector.pantallaDeSetup)
        ? BaseDirector.pantallaDeSetup() : null;
      if (ps && (ps.ancho !== r.ancho || ps.alto !== r.alto)) {
        console.warn('[cartucho] la resolución del cartucho (' + r.ancho + 'x' +
          r.alto + ') difiere de la del setup (' + ps.ancho + 'x' + ps.alto + ').');
      }
    }
    // Las tres imágenes de pantalla (contrato común de GWB y GWI):
    // img_s OBLIGATORIA (de ella se extrae la geometría) e img_f e
    // img_m OPCIONALES (punto 8 de la Fase 5: hay cartuchos sin arte
    // de fondo). Si una se declara, su fichero DEBE estar presente.
    if (!json.imagenes || typeof json.imagenes !== 'object' || Array.isArray(json.imagenes)) {
      return 'el cartucho necesita "imagenes" con las imágenes ' +
        '(img_s obligatoria; img_f e img_m opcionales).';
    }
    if (typeof json.imagenes.img_s !== 'string') {
      return 'el cartucho necesita "imagenes" con "img_s": la imagen de ' +
        'segmentos es obligatoria (de ella se extrae la geometría).';
    }
    if (!mapa.has(json.imagenes.img_s)) {
      return 'no se encuentra en la carpeta: ' + json.imagenes.img_s;
    }
    for (const campo of ['img_f', 'img_m']) {
      const referencia = json.imagenes[campo];
      if (referencia !== undefined && referencia !== null &&
        typeof referencia === 'string' && !mapa.has(referencia)) {
        return 'no se encuentra en la carpeta: ' + referencia;
      }
    }
    if (json.botones !== undefined && !Array.isArray(json.botones)) {
      return 'el campo "botones" del cartucho debe ser un array.';
    }
    return null;
  }

  /**
   * Validación ESPECÍFICA del GWB (F5-I9): el contrato común al
   * principio y, después, las reglas propias del tipo. Hoy no hay
   * reglas específicas más allá de la comprobación del tipo (el
   * contrato común las cubre): el hueco queda preparado para cuando
   * los formatos diverjan.
   * @param {Object} json - JSON del cartucho.
   * @param {Map<string,File>} mapa - Mapa nombre → File de la carpeta.
   * @param {string} estiloMaquina - Estilo del setup cargado.
   * @returns {?string} null si es válido, o el mensaje de error.
   */
  function validarGWB(json, mapa, estiloMaquina) {
    const error = validarComunes(json, mapa, estiloMaquina);
    if (error) return error;
    if (json.tipo !== 'GWB') {
      return 'se esperaba un cartucho GWB y el contenido es de tipo ' +
        json.tipo + '.';
    }
    return null;
  }

  /**
   * Validación ESPECÍFICA del GWI (F5-I9): el contrato común al
   * principio y, después, las reglas propias del tipo (ver validarGWB).
   * @param {Object} json - JSON del cartucho.
   * @param {Map<string,File>} mapa - Mapa nombre → File de la carpeta.
   * @param {string} estiloMaquina - Estilo del setup cargado.
   * @returns {?string} null si es válido, o el mensaje de error.
   */
  function validarGWI(json, mapa, estiloMaquina) {
    const error = validarComunes(json, mapa, estiloMaquina);
    if (error) return error;
    if (json.tipo !== 'GWI') {
      return 'se esperaba un cartucho GWI y el contenido es de tipo ' +
        json.tipo + '.';
    }
    return null;
  }

  /**
   * Carga una imagen del cartucho referenciada por una ruta del GWI
   * ("segmentos/img_NNN.png"), resolviendo también por el nombre base
   * (el mapa de ficheros es plano: nombre → File).
   * @param {Map<string,File>} mapa - Mapa nombre → File.
   * @param {string} rutaFichero - Nombre referenciado, con o sin carpeta.
   * @returns {Promise<HTMLImageElement>} Imagen cargada.
   */
  async function cargarDelMapa(mapa, rutaFichero) {
    const fichero = mapa.get(rutaFichero) || mapa.get(rutaFichero.split('/').pop());
    return cargarImagen(fichero);
  }

  /**
   * img_s debe medir exactamente lo mismo que img_f (si hay fondo:
   * sin él no hay contra qué comparar). Aviso por consola,
   * NO bloqueante.
   * @param {?HTMLImageElement} imgS - Imagen de segmentos.
   * @param {?HTMLImageElement} imgF - Imagen de fondo (o null: sin fondo).
   * @param {string} nombre - Nombre del fichero img_s (para el aviso).
   * @returns {void}
   */
  function _validarTamanoImgS(imgS, imgF, nombre) {
    if (imgS && imgF && (imgS.naturalWidth !== imgF.naturalWidth ||
      imgS.naturalHeight !== imgF.naturalHeight)) {
      console.warn(nombre + ' no mide lo mismo que img_f: ' +
        imgS.naturalWidth + '×' + imgS.naturalHeight + ' vs ' +
        imgF.naturalWidth + '×' + imgF.naturalHeight);
    }
  }

  /**
   * Lectura COMPLETA de un cartucho JSON (GWB o GWI): mapa de ficheros,
   * JSON prioritario, validación DESPACHADA por tipo contra la máquina y
   * las imágenes (img_f OPCIONAL: null si el cartucho no la declara;
   * img_s e img_m si están). Cada fichero solo necesita
   * ".name" y comportarse como Blob.
   * @param {Array<Blob>} ficheros - Ficheros del cartucho (carpeta o paquete).
   * @param {string} estiloMaquina - Estilo del setup cargado.
   * @param {string} [tipoEsperado] - Tipo que espera el botón ('GWB' o
   *   'GWI', F5-I9): si el contenido detectado es otro, error BLOQUEANTE.
   * @returns {Promise<{nombre:string, json:Object, mapa:Map,
   *                     imgF:?HTMLImageElement, imgS:?HTMLImageElement,
   *                     imgM:Promise<?HTMLImageElement>}>} Cartucho leído.
   */
  async function leerCartucho(ficheros, estiloMaquina, tipoEsperado) {
    const mapa = _construirMapaFicheros(ficheros);
    const elegido = await _elegirJSONCartucho(mapa);
    const json = elegido.json;

    // Validación despachada por tipo (F5-I9): la específica se ejecuta
    // SIEMPRE (validarGWB/validarGWI llaman al contrato común al
    // principio). Un JSON etiquetado GWC no tiene validador: el GWC es
    // un cartucho BINARIO, no un JSON.
    const validar = json.tipo === 'GWB' ? validarGWB :
      json.tipo === 'GWI' ? validarGWI : null;
    if (!validar) {
      throw new Error('[' + elegido.nombre + '] un GWC es un cartucho ' +
        'binario (.gwc), no un JSON: usa el fichero cartucho_gwc.gwc ' +
        'generado.');
    }
    const error = validar(json, mapa, estiloMaquina);
    if (error) throw new Error('[' + elegido.nombre + '] ' + error);

    // Tipo esperado (F5-I9): el botón declara qué espera; si el
    // contenido es otro tipo, error BLOQUEANTE (el cartucho no se
    // carga). Sin tipoEsperado, cualquier tipo válido carga.
    if (tipoEsperado && json.tipo !== tipoEsperado) {
      throw new Error('[' + elegido.nombre + '] se esperaba un cartucho ' +
        tipoEsperado + ' y el contenido es de tipo ' + json.tipo + '.');
    }

    // img_f: OPCIONAL (punto 8 de la Fase 5). Sin fondo: imgF null y el
    // simulador pinta la pantalla en blanco.
    const referenciaImgF = json.imagenes &&
      typeof json.imagenes.img_f === 'string' ? json.imagenes.img_f : null;
    const imgF = referenciaImgF ? await cargarImagen(mapa.get(referenciaImgF)) : null;
    if (imgF) {
      console.log('[cartucho] img_f: ' + referenciaImgF + ' ' +
        imgF.naturalWidth + '×' + imgF.naturalHeight);
    } else {
      console.log('[cartucho] img_f: (sin fondo: el cartucho no declara img_f)');
    }

    // img_s: base de la geometría. En un GWI puede venir como fichero
    // propio (copiado al guardar); si no, la de pantalla.
    const imgS = (await _cargarImagenAux(mapa, json.imagenes.img_s)) ||
      (await _cargarImagenAux(mapa, json.img_s));
    _validarTamanoImgS(imgS, imgF, json.imagenes ? json.imagenes.img_s : '(gwi)');

    // img_m (portada): se carga en paralelo, sin bloquear; aún no se muestra.
    const imgM = _cargarImagenAux(mapa, json.imagenes.img_m);

    return {
      nombre: elegido.nombre, json: json, mapa: mapa,
      imgF: imgF, imgS: imgS, imgM: imgM
    };
  }

  /**
   * Abre un cartucho empaquetado (GWB o GWI): delega en
   * BasePACK.leerPACK; el resultado se lee con el MISMO flujo que una
   * carpeta (leerCartucho).
   * @param {File} fichero - Fichero de paquete seleccionado.
   * @returns {Promise<Blob[]>} Ficheros del paquete (Blob con ".name" base).
   */
  async function abrirPACK(fichero) {
    return BasePACK.leerPACK(fichero);
  }

  /**
   * Carga un cartucho GWB (base dibujada) exigiendo ese tipo (F5-I9):
   * delega en leerCartucho con el tipo esperado, que valida con la
   * específica validarGWB y bloquea si el contenido es otro tipo.
   * @param {Array<Blob>} ficheros - Ficheros del cartucho (carpeta o paquete).
   * @param {string} estiloMaquina - Estilo del setup cargado.
   * @returns {Promise<Object>} Cartucho leído (ver leerCartucho).
   */
  function leerGWB(ficheros, estiloMaquina) {
    return leerCartucho(ficheros, estiloMaquina, 'GWB');
  }

  /**
   * Carga un cartucho GWI (autoría hecha) exigiendo ese tipo (F5-I9):
   * delega en leerCartucho con el tipo esperado, que valida con la
   * específica validarGWI y bloquea si el contenido es otro tipo.
   * @param {Array<Blob>} ficheros - Ficheros del cartucho (carpeta o paquete).
   * @param {string} estiloMaquina - Estilo del setup cargado.
   * @returns {Promise<Object>} Cartucho leído (ver leerCartucho).
   */
  function leerGWI(ficheros, estiloMaquina) {
    return leerCartucho(ficheros, estiloMaquina, 'GWI');
  }

  // ---------------- Grabación del GWI ----------------

  // Campos del nivel superior del GWI que solo se escriben si existen
  // (un GWI sin ellos usa los valores por defecto del motor).
  const CAMPOS_OPCIONALES_GWI = ['fin', 'secuencia', 'pausas', 'aceleracion', 'rutas'];

  /** Línea JSON de un campo simple: `  "clave": valor`. */
  function lineaDeCampo(clave, valor) {
    return '  "' + clave + '": ' + JSON.stringify(valor);
  }

  /** Lista con UNA línea por elemento (sprites, segmentos, botones...). */
  function lineaDeLista(clave, lista) {
    if (!lista || lista.length === 0) return '  "' + clave + '": []';
    return '  "' + clave + '": [\n' +
      lista.map(elemento => '    ' + JSON.stringify(elemento)).join(',\n') +
      '\n  ]';
  }

  /** Sección de autoría: historial a una línea por acción + contador. */
  function lineaDeAutoria(autoria) {
    return '  "autoria": {\n' +
      lineaDeLista('cambios', autoria.cambios).replace('  ', '    ') + ',\n' +
      '    "ultimoOp": ' + JSON.stringify(autoria.ultimoOp) + '\n' +
      '  }';
  }

  /** Líneas de los campos opcionales que el GWI sí trae. */
  function lineasOpcionales(json) {
    return CAMPOS_OPCIONALES_GWI
      .filter(campo => json[campo])
      .map(campo => lineaDeCampo(campo, json[campo]));
  }

  /**
   * Serializa el GWI en JSON legible pero COMPACTO: los arrays largos
   * (sprites y segmentos) van a UNA línea por elemento, el resto de campos
   * también. Con muchos segmentos se pasa de 2500 líneas a unas centenas.
   * @param {Object} json - GWI completo (tal como se guardaría).
   * @returns {string} Texto JSON del GWI.
   */
  function _formatearGWI(json) {
    // El código del par (suma de verificación del GWC) solo si existe.
    const lineaCodigoGWC = (json.codigoGWC !== undefined && json.codigoGWC !== null)
      ? [lineaDeCampo('codigoGWC', json.codigoGWC)] : [];

    // imagenes TAL CUAL (decisión del cierre de la F5-I9): el GWI es el
    // contenedor intermedio y debe ser AUTOSUFICIENTE — declara todo lo
    // que el GWB declara, incluso redundante, y _guardarGWIEnDisco incluye
    // en el paquete cada imagen declarada (img_m incluida). Si se declarara
    // sin viajar, el GWI generado no cargaría: contrato de entrada.
    const imagenesGWI = json.imagenes;

    const lineas = [
      lineaDeCampo('tipo', json.tipo),
      lineaDeCampo('version', json.version),
      ...lineaCodigoGWC,
      lineaDeCampo('nombre', json.nombre),
      lineaDeCampo('estilo', json.estilo),
      lineaDeCampo('resolucion', json.resolucion),
      lineaDeCampo('imagenes', imagenesGWI),
      ...lineasOpcionales(json),
      lineaDeLista('botones', json.botones),
      lineaDeLista('sprites', json.sprites),
      lineaDeLista('segmentos', json.segmentos),
      lineaDeAutoria(json.autoria)
    ];
    return '{\n' + lineas.join(',\n') + '\n}';
  }

  /**
   * Serializa el GWB: solo lo que un GWB declara (sin sprites, segmentos
   * ni autoría). estilo y resolucion solo si el GWB los lleva.
   * @param {Object} json - GWB a guardar.
   * @returns {string} Texto JSON del GWB.
   */
  function _formatearGWB(json) {
    const lineas = [
      lineaDeCampo('tipo', 'GWB'),
      lineaDeCampo('version', json.version),
      lineaDeCampo('nombre', json.nombre)
    ];
    if (json.estilo) lineas.push(lineaDeCampo('estilo', json.estilo));
    if (json.resolucion) lineas.push(lineaDeCampo('resolucion', json.resolucion));
    lineas.push(lineaDeCampo('imagenes', json.imagenes));
    for (const campo of ['combinar', 'etiquetas']) {
      if (json[campo]) lineas.push(lineaDeCampo(campo, json[campo]));
    }
    lineas.push(lineaDeLista('botones', json.botones || []));
    return '{\n' + lineas.join(',\n') + '\n}';
  }

  /**
   * Guarda el GWI en un paquete descargable (cartucho_GWI). Avisa al
   * empezar y bloquea el botón «Guardar» mientras dura: el guardado es
   * asíncrono y sin esto podría lanzarse un segundo guardado solapado.
   * @param {Object} json - GWI completo (montado por BaseDescomponer).
   * @param {Array<{id:string, imagen:HTMLImageElement}>} sprites - Sprites
   *        con su imagen (su PNG va a segmentos/id.png).
   * @param {?HTMLImageElement} imgF - Imagen de fondo en memoria.
   * @param {?HTMLImageElement} imgS - Imagen de segmentos en memoria.
   * @param {?HTMLImageElement} imgM - Imagen de portada en memoria (img_m).
   * @param {number} nAvisos - Avisos de la verificación (informativo).
   * @returns {Promise<number>} Tamaño aproximado del GWI en bytes (ver
   *          _guardarGWIEnDisco), o 0 si falló.
   */
  async function guardarGWI(json, sprites, imgF, imgS, imgM, nAvisos) {
    try {
      BaseDirector.avisar('Guardando GWI (' + sprites.length + ' imagen(es))…');
      const botonGuardar = document.getElementById('btnGuardar');
      botonGuardar.disabled = true;
      try {
        return await _guardarGWIEnDisco(json, sprites, imgF, imgS, imgM, nAvisos);
      } finally {
        botonGuardar.disabled = false;   // siempre, aunque el guardado falle
      }
    } catch (e) {
      if (e && e.name === 'AbortError') return 0;
      BaseDirector.avisarError('Guardado fallido: ' + e.message);
      return 0;
    }
  }

  /**
   * Escribe realmente el GWI en el paquete: sprites en segmentos/, img_f,
   * img_s e img_m con el nombre que el JSON referencia, y el JSON en la
   * raíz. El paquete carga solo, sin la carpeta del GWB. img_f es OPCIONAL:
   * si el cartucho no tiene fondo no viaja (punto 8 de la Fase 5). img_m
   * (portada) SÍ VIAJA si está declarada (decisión del cierre de la
   * F5-I9): el GWI es el contenedor intermedio y debe llevar SIEMPRE
   * todo lo declarado, incluso redundante — si se declarara sin viajar,
   * el GWI generado no cargaría. El GWC decidirá lo suyo para el
   * selector de cartuchos (P07).
   * @param {Object} json - GWI completo.
   * @param {Array<{id:string, imagen:HTMLImageElement}>} sprites - Sprites.
   * @param {?HTMLImageElement} imgF - Imagen de fondo en memoria.
   * @param {?HTMLImageElement} imgS - Imagen de segmentos en memoria.
   * @param {?HTMLImageElement} imgM - Imagen de portada en memoria (img_m).
   * @param {number} nAvisos - Avisos de la verificación (informativo).
   * @returns {Promise<number>} Tamaño aproximado del GWI (F5-I7): la suma
   *          de los bytes del JSON y de los PNG que contiene, no el paquete.
   */
  async function _guardarGWIEnDisco(json, sprites, imgF, imgS, imgM, nAvisos) {
    const entradas = [];                  // {nombre, contenido} del paquete

    for (const sprite of sprites) {
      const png = await new Promise(resolver => sprite.imagen.toBlob(resolver, 'image/png'));
      entradas.push({ nombre: 'segmentos/' + sprite.id + '.png', contenido: png });
    }

    const referenciaImgS = (json.imagenes && json.imagenes.img_s) || json.img_s || null;
    const referenciaImgF = (json.imagenes && json.imagenes.img_f) || null;
    if (imgF && referenciaImgF) {
      entradas.push({ nombre: referenciaImgF, contenido: await imagenBlob(imgF) });
    } else if (referenciaImgF) {
      BaseDirector.avisarError('El paquete no incluye img_f: el GWI no podrá cargar solo.');
    } else {
      // Cartucho sin fondo (img_f opcional, punto 8 de la Fase 5):
      // legítimo, no es un error; solo se deja constancia en consola.
      console.info('[guardar] cartucho sin fondo: el paquete no incluye img_f ' +
        '(el GWI carga igual y el simulador pinta la pantalla en blanco).');
    }
    if (imgS && referenciaImgS) {
      entradas.push({ nombre: referenciaImgS, contenido: await imagenBlob(imgS) });
    } else {
      console.warn('[guardar] img_s no incluida en el paquete: ' +
        'el GWI cargará pero no se podrá re-extraer la geometría.');
    }
    // img_m (portada): SÍ VIAJA si el GWI la declara (cierre de la
    // F5-I9: el GWI lleva siempre todo lo declarado). Declarada y sin
    // imagen en memoria → error: el GWI resultante no cargaría.
    const referenciaImgM = (json.imagenes && json.imagenes.img_m) || null;
    if (referenciaImgM) {
      if (imgM) {
        entradas.push({ nombre: referenciaImgM, contenido: await imagenBlob(imgM) });
      } else {
        BaseDirector.avisarError('El paquete no incluye img_m (' + referenciaImgM +
          '), pero el GWI la declara: el GWI no podrá cargar solo.');
      }
    } else {
      // Cartucho sin portada: legítimo (img_m opcional), constancia en
      // consola.
      console.info('[guardar] cartucho sin portada: el paquete no incluye img_m.');
    }
    entradas.push({ nombre: 'cartucho_GWI.json', contenido: _formatearGWI(json) });

    const tamano = await BasePACK.guardarPACK(entradas, 'cartucho_GWI');

    BaseDirector.avisar('GWI guardado en ' + BasePACK.nombreFichero('cartucho_GWI') + ': ' + sprites.length +
      ' imagen(es) en segmentos/ + cartucho_GWI.json en la raíz' +
      (nAvisos ? ' · con ' + nAvisos + ' aviso(s)' : '') + '.');
    return tamano;
  }

  /**
   * Guarda el cartucho de autoría GWB como paquete descargable
   * (cartucho_GWB), F5-I10: la misma vía del GWI, porque un
   * navegador no puede escribir una carpeta de disco. El paquete lleva el
   * JSON en la raíz (cartucho_GWB.json) y las imágenes de pantalla
   * declaradas con el nombre que el JSON referencia: img_s
   * OBLIGATORIA (sin ella el GWB no es un cartucho), img_f e img_m si
   * están declaradas (cierre de la F5-I9: el cartucho lleva SIEMPRE
   * todo lo declarado). El núcleo de carga del director (F5-I9) lee
   * este paquete por contenido: paquete → abrirPACK (BasePACK.leerPACK) → flujo de carpeta con el
   * tipo esperado 'GWB'.
   * @param {Object} json - GWB completo (el cartucho en memoria).
   * @param {?HTMLImageElement} imgF - Imagen de fondo en memoria.
   * @param {?HTMLImageElement} imgS - Imagen de segmentos en memoria.
   * @param {?HTMLImageElement} imgM - Imagen de portada en memoria.
   * @returns {Promise<number>} Tamaño aproximado en bytes (JSON + PNG,
   *          sin comprimir), o 0 si falló.
   */
  async function guardarGWB(json, imgF, imgS, imgM) {
    try {
      BaseDirector.avisar('Guardando GWB…');
      const entradas = [];                // {nombre, contenido} del paquete
      const referenciaImgS = (json.imagenes && json.imagenes.img_s) || null;
      const referenciaImgF = (json.imagenes && json.imagenes.img_f) || null;
      const referenciaImgM = (json.imagenes && json.imagenes.img_m) || null;
      if (referenciaImgS && imgS) {
        entradas.push({ nombre: referenciaImgS, contenido: await imagenBlob(imgS) });
      } else {
        // img_s es OBLIGATORIA en el contrato de entrada: sin ella el
        // GWB guardado no cargaría, así que no se guarda a medias.
        BaseDirector.avisarError('El GWB no se guarda: falta img_s' +
          (referenciaImgS ? ' (' + referenciaImgS + ')' : '') +
          ' en memoria (es obligatoria).');
        return 0;
      }
      if (referenciaImgF) {
        if (imgF) {
          entradas.push({ nombre: referenciaImgF, contenido: await imagenBlob(imgF) });
        } else {
          BaseDirector.avisarError('El paquete no incluye img_f (' +
            referenciaImgF + '), pero el GWB la declara: el GWB no podrá cargar solo.');
        }
      }
      if (referenciaImgM) {
        if (imgM) {
          entradas.push({ nombre: referenciaImgM, contenido: await imagenBlob(imgM) });
        } else {
          BaseDirector.avisarError('El paquete no incluye img_m (' +
            referenciaImgM + '), pero el GWB la declara: el GWB no podrá cargar solo.');
        }
      }
      entradas.push({ nombre: 'cartucho_GWB.json', contenido: _formatearGWB(json) });
      const tamano = await BasePACK.guardarPACK(entradas, 'cartucho_GWB');
      BaseDirector.avisar('GWB guardado en ' + BasePACK.nombreFichero('cartucho_GWB') + ' (JSON + ' +
        'imágenes de pantalla). Cárgalo con «Cargar GWB (ZIP)».');
      return tamano;
    } catch (e) {
      BaseDirector.avisarError('Guardado del GWB fallido: ' + e.message);
      return 0;
    }
  }

  // ---------------- Verificación del diseñador ----------------
  // Decide si un cartucho PUEDE escribirse: es el contrato de SALIDA de
  // los formatos, igual que validarCartucho define lo que puede ENTRAR.
  // Recibe por parámetro (ctx) lo que el editor sabe: los grupos con sus
  // props, sus helpers y las constantes de los enlaces. No guarda estado.
  // OJO: no es de solo lectura — CALCULA los inversos que falten
  // (direcciones, colisionDe, mostradoJunto) y los registra en el
  // historial a través de ctx.registrarCambio.
  //
  // Cada regla vive en su propia función (grupos: ctx.grupos, hallazgos:
  // {errores, avisos} que cada regla va rellenando).

  const CONTADORES_INTERNOS_VALIDOS = ['1', '2', '3', '4'];

  /**
   * Recorre los grupos del diseñador y clasifica sus hallazgos en
   * errores (bloqueantes al guardar) y avisos (informativos).
   * @param {Object} ctx - El editor por parámetro (grupos, helpers y
   *   constantes ENLACES_* / CONTADORES_COLISION / CAMPOS_SECUENCIA / INVERSO).
   * @returns {{errores: string[], avisos: string[]}} Los hallazgos.
   */
  function verificarCartucho(ctx) {
    const hallazgos = { errores: [], avisos: [] };

    verificarReferenciasColgantes(ctx, hallazgos);
    verificarInversosDeDirecciones(ctx, hallazgos);
    verificarInversosDeColision(ctx, hallazgos);
    ctx.reconstruir();                       // los inversos calculados ya cuentan

    verificarSegmentosUnoAUno(ctx, hallazgos);
    verificarAcompanantes(ctx, hallazgos);
    verificarBarrasDeDigitos(ctx, hallazgos);
    verificarDigitosDeContadores(ctx, hallazgos);

    const fichas = ctx.grupos.filter(g => g.prop.tipo === 'cartucho');
    verificarFichaDeCartucho(ctx, hallazgos, fichas);
    // Secuencia y Director viven en la ficha: solo se revisan si hay UNA.
    const ficha = (fichas.length === 1) ? fichas[0] : null;
    if (ficha) {
      verificarSecuenciaDeCartucho(ctx, hallazgos, ficha.prop);
      verificarDirectorDeCartucho(hallazgos, ficha.prop);
    }

    verificarJugadoresYRutas(ctx, hallazgos);
    return hallazgos;
  }

  // ----- Referencias e inversos -----

  /**
   * Un enlace que no resuelve a NINGÚN grupo existente es un ERROR
   * bloqueante (referencia colgante): nunca en silencio.
   */
  function verificarReferenciasColgantes(ctx, hallazgos) {
    const camposConEnlace = [...ctx.ENLACES_JUGADOR, ...ctx.ENLACES_JUEGO,
    ...ctx.ENLACES_COLISION, 'mostradoJunto', 'colisionDe'];
    for (const grupo of ctx.grupos) {
      const props = ctx.propsDe(grupo.raiz);
      for (const campo of camposConEnlace) {
        if (props[campo] === null) continue;
        if (!ctx.grupoDeComp(props[campo])) {
          hallazgos.errores.push(ctx.segId(grupo) + '.' + campo + ' apunta a un segmento que no ' +
            'existe (referencia colgante).');
        }
      }
    }
  }

  /**
   * Inverso de las direcciones del jugador: si A.derecha = B, en la
   * verificación B.izquierda = A. Si el autor señaló ambos lados y no
   * coinciden, aviso (no error). El inverso se guarda en el GWI
   * (redundancia deliberada: menos cálculos al generar el GWC).
   */
  function verificarInversosDeDirecciones(ctx, hallazgos) {
    for (const grupo of ctx.grupos) {
      for (const direccion of ctx.ENLACES_JUGADOR) {
        verificarInversoDeUnaDireccion(ctx, hallazgos, grupo, direccion);
      }
    }
  }

  /** Comprueba (y completa si falta) el inverso de UNA dirección de un jugador. */
  function verificarInversoDeUnaDireccion(ctx, hallazgos, origen, direccion) {
    const propsOrigen = ctx.propsDe(origen.raiz);
    if (propsOrigen[direccion] === null) return;

    const destino = ctx.grupoDeComp(propsOrigen[direccion]);
    if (!destino) return;                    // ya reportado como colgante

    const propsDestino = ctx.propsDe(destino.raiz);
    // Una dirección a un NO jugador es un ERROR: la red del jugador es de
    // jugadores y el motor no sabría recorrerla.
    if (propsDestino.tipo !== 'jugador') {
      hallazgos.errores.push(ctx.segId(origen) + '.' + direccion + ' apunta a ' +
        ctx.segId(destino) + ', que no es de tipo jugador.');
      return;
    }

    const inverso = ctx.INVERSO[direccion];
    if (propsDestino[inverso] === null) {
      propsDestino[inverso] = origen.raiz;
      // El inverso calculado también entra en el historial: es un cambio
      // real y el GWI no guarda estado final (se perdería al recargar).
      ctx.registrarCambio(destino.raiz, { [inverso]: origen.raiz }, { [inverso]: null });
      console.info('[verificar] ' + ctx.segId(destino) + '.' + inverso + ' = ' +
        ctx.segId(origen) + ' (inverso calculado).');
    } else if (propsDestino[inverso] !== origen.raiz) {
      hallazgos.avisos.push(ctx.segId(origen) + '.' + direccion + ' = ' + ctx.segId(destino) +
        ' pero ' + ctx.segId(destino) + '.' + inverso + ' = ' +
        ctx.resolverEnlace(propsDestino[inverso]) + ' (inversos incoherentes).');
    }
  }

  /**
   * Inverso de la colisión: el jugador aprende quién choca contra él
   * (colisionDe). La unicidad (un jugador, un punto de colisión) lo
   * mantiene univaluado; una incoherencia solo puede venir de un GWI raro.
   */
  function verificarInversosDeColision(ctx, hallazgos) {
    for (const grupo of ctx.grupos) {
      const props = ctx.propsDe(grupo.raiz);
      if (props.colision === null) continue;

      const jugador = ctx.grupoDeComp(props.colision);
      if (!jugador) continue;                // ya reportado como colgante

      const propsJugador = ctx.propsDe(jugador.raiz);
      if (propsJugador.tipo !== 'jugador') continue;   // se reporta luego como error

      if (propsJugador.colisionDe === null) {
        propsJugador.colisionDe = grupo.raiz;
        ctx.registrarCambio(jugador.raiz, { colisionDe: grupo.raiz }, { colisionDe: null });
        console.info('[verificar] ' + ctx.segId(jugador) + '.colisionDe = ' +
          ctx.segId(grupo) + ' (inverso de colisión calculado).');
      } else if (propsJugador.colisionDe !== grupo.raiz) {
        hallazgos.avisos.push(ctx.segId(grupo) + '.colision = ' + ctx.segId(jugador) +
          ' pero ' + ctx.segId(jugador) + '.colisionDe = ' +
          ctx.resolverEnlace(propsJugador.colisionDe) +
          ' (inversos de colisión incoherentes).');
      }
    }
  }

  // ----- Reglas por segmento -----

  /**
   * Revisa cada segmento según su tipo. Los ABSORBIDOS por una unión están
   * inertes (sus props viven en la pieza que los absorbió): se saltan, sus
   * comprobaciones serían ruido.
   */
  function verificarSegmentosUnoAUno(ctx, hallazgos) {
    for (const grupo of ctx.grupos) {
      if (grupo.absorbido) continue;
      verificarEnlacesPropios(ctx, hallazgos, grupo);
      verificarCadenaDeRuta(ctx, hallazgos, grupo);
      verificarJugador(ctx, hallazgos, grupo);
      verificarColisionDeclarada(ctx, hallazgos, grupo);
      verificarDigito(ctx, hallazgos, grupo);
      verificarContador(ctx, hallazgos, grupo);
      verificarAdicional(ctx, hallazgos, grupo);
    }
  }

  /** Los enlaces del tipo deben apuntar a un segmento que exista y que no sea él mismo. */
  function verificarEnlacesPropios(ctx, hallazgos, grupo) {
    const id = ctx.segId(grupo);
    const props = grupo.prop;
    for (const campo of ctx.camposDe(props.tipo)) {
      if (props[campo] === null) continue;
      const destino = ctx.grupoDeComp(props[campo]);
      if (!destino) {
        hallazgos.errores.push(id + ': ' + campo + ' apunta a un segmento que ya no existe.');
      } else if (destino === grupo) {
        hallazgos.errores.push(id + ': ' + campo + ' no puede apuntar a sí mismo.');
      }
    }
  }

  /** Avisos sobre cadenas: inicios que no llevan a ningún sitio, contadores sin cadena, mezcla de siguiente y bifurcación. */
  function verificarCadenaDeRuta(ctx, hallazgos, grupo) {
    const id = ctx.segId(grupo);
    const props = grupo.prop;
    if (props.tipo === 'inicio' && props.siguiente === null &&
      props.salvado === null && props.muerte === null) {
      hallazgos.avisos.push(id + ' es inicio de ruta ' + ctx.numRuta(grupo) + ' pero no lleva a ningún sitio.');
    }
    if ((props.tipo === 'vida' || props.tipo === 'muerte') && props.siguiente === null) {
      hallazgos.avisos.push(id + ' es un contador (' + props.tipo + ') sin cadena (falta su siguiente).');
    }
    if (props.siguiente !== null && (props.salvado !== null || props.muerte !== null)) {
      hallazgos.avisos.push(id + ' tiene siguiente y bifurcación a la vez.');
    }
  }

  /**
   * Todo jugador necesita ALGUNA dirección (sin ninguna es imposible de
   * mover: bloqueante) y algún punto que choque contra él (aviso: sin eso
   * no se puede perder la partida).
   */
  function verificarJugador(ctx, hallazgos, grupo) {
    const props = grupo.prop;
    if (props.tipo !== 'jugador') return;
    const id = ctx.segId(grupo);
    if (ctx.ENLACES_JUGADOR.every(d => props[d] === null)) {
      hallazgos.errores.push(id + ' es jugador pero no tiene ninguna dirección: imposible de mover.');
    }
    if (props.colisionDe === null) {
      hallazgos.avisos.push(id + ' es jugador pero ningún elemento declara su ' +
        'colisión contra él (no se puede perder la partida).');
    }
  }

  /**
   * Colisiones: el jugador de una colisión debe existir y ser jugador
   * (bloqueante); sin desenlaces rige la regla por defecto (aviso); las
   * cadenas de desenlace no pueden enlazar con un jugador; los contadores
   * de desenlace son uno de los cuatro internos, o ninguno.
   */
  function verificarColisionDeclarada(ctx, hallazgos, grupo) {
    const props = grupo.prop;
    if (props.colision === null) return;
    const id = ctx.segId(grupo);

    const jugador = ctx.grupoDeComp(props.colision);
    if (jugador && jugador.prop.tipo !== 'jugador') {
      hallazgos.errores.push(id + ': su colisión apunta a ' + ctx.segId(jugador) +
        ', que no es de tipo jugador.');
    }
    if (props.siguiente === null && props.salvado === null && props.muerte === null) {
      hallazgos.avisos.push(id + ' declara colisión pero ningún desenlace: rige la ' +
        'regla por defecto (desaparece sin tocar contadores).');
    }
    for (const campo of ['salvado', 'muerte']) {
      if (props[campo] === null) continue;
      const destino = ctx.grupoDeComp(props[campo]);
      if (destino && destino.prop.tipo === 'jugador') {
        hallazgos.errores.push(id + ': su ' + campo + ' enlaza con ' + ctx.segId(destino) +
          ', de tipo ' + destino.prop.tipo + ' (debe ser juego, ' +
          'inicio o vida/muerte).');
      }
    }
    for (const campo of ctx.CONTADORES_COLISION) {
      if (props[campo] === null) continue;
      if (CONTADORES_INTERNOS_VALIDOS.indexOf(String(props[campo])) < 0) {
        hallazgos.errores.push(id + ': su ' + campo + ' vale "' + props[campo] +
          '" (debe ser un contador 1-4 o ninguno).');
      }
    }
  }

  /** Dígito: las SIETE barras (barra_a..g) puestas y de tipo juego. */
  function verificarDigito(ctx, hallazgos, grupo) {
    const props = grupo.prop;
    if (props.tipo !== 'dígito') return;
    const id = ctx.segId(grupo);
    for (const campo of ctx.ENLACES_DIGITO) {
      if (props[campo] === null) {
        hallazgos.errores.push(id + ': le falta su barra "' + campo.replace('barra_', '') + '".');
        continue;
      }
      const barra = ctx.grupoDeComp(props[campo]);
      if (barra && barra.prop.tipo !== 'juego') {
        hallazgos.errores.push(id + ': su barra "' + campo.replace('barra_', '') +
          '" (' + ctx.segId(barra) + ') no es de tipo juego.');
      }
    }
  }

  /**
   * Contador: digito_1 (unidades) obligatorio; cada dígito existe y es de
   * tipo dígito; contador interno 1-4; valor inicial >= 0.
   */
  function verificarContador(ctx, hallazgos, grupo) {
    const props = grupo.prop;
    if (props.tipo !== 'contador') return;
    const id = ctx.segId(grupo);

    if (props.digito_1 === null) {
      hallazgos.errores.push(id + ': no enlaza con su dígito de las unidades (digito_1).');
    }
    for (const campo of ctx.ENLACES_CONTADOR) {
      if (props[campo] === null) continue;
      const digito = ctx.grupoDeComp(props[campo]);
      if (!digito) {
        hallazgos.errores.push(id + ': su ' + campo + ' apunta a un segmento que no existe.');
      } else if (digito.prop.tipo !== 'dígito') {
        hallazgos.errores.push(id + ': su ' + campo + ' (' + ctx.segId(digito) + ') no es de tipo dígito.');
      }
    }
    const contadorInterno = Number(props.contadorInterno);
    if (!(contadorInterno >= 1 && contadorInterno <= 4)) {
      hallazgos.errores.push(id + ': su contador interno debe ser 1-4 (vale "' + props.contadorInterno + '").');
    }
    if (Number(props.valorInicial) < 0) {
      hallazgos.errores.push(id + ': el valor inicial no puede ser negativo.');
    }
  }

  /**
   * Tipos adicionales (fuera del juego): su «siguiente» solo apunta a otro
   * adicional/inicioAdicional; un inicioAdicional EXIGE siguiente (nace
   * encendido y avanza en su bucle); y no declaran colisión.
   */
  function verificarAdicional(ctx, hallazgos, grupo) {
    const props = grupo.prop;
    if (props.tipo !== 'adicional' && props.tipo !== 'inicioAdicional') return;
    const id = ctx.segId(grupo);

    if (props.siguiente !== null) {
      const destino = ctx.grupoDeComp(props.siguiente);
      if (destino && destino.prop.tipo !== 'adicional' && destino.prop.tipo !== 'inicioAdicional') {
        hallazgos.errores.push(id + ': su siguiente apunta a ' + ctx.segId(destino) +
          ' (' + destino.prop.tipo + '); solo puede apuntar a ' +
          'segmentos adicional/inicioAdicional.');
      }
    }
    if (props.tipo === 'inicioAdicional' && props.siguiente === null) {
      hallazgos.errores.push(id + ' es inicioAdicional pero no tiene siguiente ' +
        '(nace encendido y avanza en su propio bucle).');
    }
    if (props.colision !== null) {
      hallazgos.errores.push(id + ' (' + props.tipo + ') no puede declarar colisión.');
    }
  }

  // ----- Acompañantes («mostrar junto a») -----

  /** Raíces de todos los grupos a los que alguna cadena (siguiente/salvado/muerte) apunta. */
  function recogerApuntadosPorCadena(ctx) {
    const apuntados = new Set();
    for (const grupo of ctx.grupos) {
      for (const campo of ['siguiente', 'salvado', 'muerte']) {
        const destino = ctx.grupoDeComp(grupo.prop[campo]);
        if (destino) apuntados.add(destino.raiz);
      }
    }
    return apuntados;
  }

  /**
   * Acompañantes: coherencia (el lado que falte se CALCULA y viaja en el
   * historial) y reglas del secundario. El secundario NO forma parte de
   * NINGUNA red de enlaces; puede salir SOLO en la Secuencia del cartucho
   * (eso no es una red de enlaces y no se toca).
   */
  function verificarAcompanantes(ctx, hallazgos) {
    const apuntadosPorCadena = recogerApuntadosPorCadena(ctx);
    const principalDeSecundario = new Map();   // raíz del secundario → su principal

    for (const principal of ctx.grupos) {
      if (principal.prop.mostrarJunto === null) continue;
      const secundario = ctx.grupoDeComp(principal.prop.mostrarJunto);
      if (!secundario) continue;             // ya reportado como colgante

      if (principalDeSecundario.has(secundario.raiz)) {
        hallazgos.errores.push(ctx.segId(secundario) + ' es secundario de ' +
          ctx.segId(principalDeSecundario.get(secundario.raiz)) + ' y de ' +
          ctx.segId(principal) + ': un secundario tiene un solo principal.');
      } else {
        principalDeSecundario.set(secundario.raiz, principal);
      }
      completarInversoDeAcompanante(ctx, hallazgos, principal, secundario);
      verificarReglasDeSecundario(ctx, hallazgos, secundario, apuntadosPorCadena);
    }
    retirarAcompanantesHuerfanos(ctx, principalDeSecundario);
  }

  /** Calcula B.mostradoJunto = A si falta; avisa si apunta a otro. */
  function completarInversoDeAcompanante(ctx, hallazgos, principal, secundario) {
    const propsSecundario = ctx.propsDe(secundario.raiz);
    if (propsSecundario.mostradoJunto === null) {
      propsSecundario.mostradoJunto = principal.raiz;
      ctx.registrarCambio(secundario.raiz, { mostradoJunto: principal.raiz }, { mostradoJunto: null });
      console.info('[verificar] ' + ctx.segId(secundario) + '.mostradoJunto = ' +
        ctx.segId(principal) + ' (calculado).');
    } else if (propsSecundario.mostradoJunto !== principal.raiz) {
      hallazgos.avisos.push(ctx.segId(principal) + '.mostrarJunto = ' + ctx.segId(secundario) +
        ' pero ' + ctx.segId(secundario) + '.mostradoJunto = ' +
        ctx.resolverEnlace(propsSecundario.mostradoJunto) + ' (incoherentes).');
    }
  }

  /** Solo tipo juego, sin cadena ni colisión, que nadie lo apunte y que no sea principal a la vez. */
  function verificarReglasDeSecundario(ctx, hallazgos, secundario, apuntadosPorCadena) {
    const id = ctx.segId(secundario);
    const props = secundario.prop;
    if (props.tipo !== 'juego') {
      hallazgos.errores.push(id + ' es secundario pero no es de tipo juego.');
    }
    if (props.siguiente !== null || props.salvado !== null ||
      props.muerte !== null || props.colision !== null) {
      hallazgos.errores.push(id + ' es secundario pero tiene cadena o colisión: ' +
        'no pertenece a ninguna red de enlaces.');
    }
    if (apuntadosPorCadena.has(secundario.raiz)) {
      hallazgos.errores.push(id + ' es secundario pero alguien lo apunta como eslabón de su cadena.');
    }
    if (props.mostrarJunto !== null) {
      hallazgos.errores.push(id + ' es secundario y principal a la vez: no se encadenan acompañamientos.');
    }
  }

  /** Un «mostrado junto a» cuyo principal ya no lo apunta se retira (como los inversos al deshacer enlaces). */
  function retirarAcompanantesHuerfanos(ctx, principalDeSecundario) {
    for (const grupo of ctx.grupos) {
      if (grupo.prop.mostradoJunto === null) continue;
      if (principalDeSecundario.has(grupo.raiz)) continue;

      const principalAnterior = ctx.grupoDeComp(grupo.prop.mostradoJunto);
      ctx.propsDe(grupo.raiz).mostradoJunto = null;
      ctx.registrarCambio(grupo.raiz, { mostradoJunto: null },
        { mostradoJunto: principalAnterior ? principalAnterior.raiz : null });
      console.info('[verificar] ' + ctx.segId(grupo) + '.mostradoJunto retirado ' +
        '(su principal ya no lo apunta).');
    }
  }

  // ----- Barras y dígitos compartidos -----

  /**
   * Las barras no se comparten entre dígitos (error) y no participan en
   * rutas ni colisiones (aviso: solo aportan su gráfico al contador).
   */
  function verificarBarrasDeDigitos(ctx, hallazgos) {
    const digitoDeBarra = new Map();         // raíz de barra → su dígito
    for (const grupo of ctx.grupos) {
      if (grupo.prop.tipo !== 'dígito') continue;
      for (const campo of ctx.ENLACES_DIGITO) {
        if (grupo.prop[campo] === null) continue;
        const barra = ctx.grupoDeComp(grupo.prop[campo]);
        if (!barra) continue;
        if (digitoDeBarra.has(barra.raiz)) {
          hallazgos.errores.push(ctx.segId(barra) + ' es barra de ' +
            ctx.segId(digitoDeBarra.get(barra.raiz)) + ' y de ' +
            ctx.segId(grupo) + ': las barras no se comparten.');
        } else {
          digitoDeBarra.set(barra.raiz, grupo);
        }
      }
    }
    for (const [raizBarra, digito] of digitoDeBarra) {
      const propsBarra = ctx.propsDe(raizBarra);
      if (propsBarra.siguiente !== null || propsBarra.colision !== null) {
        hallazgos.avisos.push(ctx.segId(ctx.grupoDeComp(raizBarra)) + ' es barra del dígito ' +
          ctx.segId(digito) + ' pero tiene siguiente o colisión: las ' +
          'barras solo aportan su gráfico.');
      }
    }
  }

  /** Un dígito solo puede ser posición de UN contador (si no, dos contadores escribirían las mismas barras). */
  function verificarDigitosDeContadores(ctx, hallazgos) {
    const contadorDeDigito = new Map();      // raíz de dígito → su contador
    for (const grupo of ctx.grupos) {
      if (grupo.prop.tipo !== 'contador') continue;
      for (const campo of ctx.ENLACES_CONTADOR) {
        if (grupo.prop[campo] === null) continue;
        const digito = ctx.grupoDeComp(grupo.prop[campo]);
        if (!digito) continue;
        if (contadorDeDigito.has(digito.raiz)) {
          hallazgos.errores.push(ctx.segId(digito) + ' es posición de ' +
            ctx.segId(contadorDeDigito.get(digito.raiz)) + ' y de ' +
            ctx.segId(grupo) + ': los dígitos no se comparten.');
        } else {
          contadorDeDigito.set(digito.raiz, grupo);
        }
      }
    }
  }

  // ----- Ficha del cartucho: fin, Secuencia y Director -----

  /**
   * Debe haber exactamente UNA ficha de cartucho y con mecanismo de fin
   * declarado. Los mecanismos son excluyentes: con segmentos de vida/muerte
   * el fin por contador es un error.
   */
  function verificarFichaDeCartucho(ctx, hallazgos, fichas) {
    if (fichas.length === 0) {
      hallazgos.errores.push('Falta el segmento de cartucho: un cartucho sin su ficha no puede ejecutarse.');
      return;
    }
    if (fichas.length > 1) {
      hallazgos.errores.push('Hay ' + fichas.length + ' segmentos de cartucho: debe haber exactamente uno.');
      return;
    }
    verificarMecanismoDeFin(ctx, hallazgos, fichas[0].prop);
  }

  /** Coherencia del mecanismo de fin con lo que el cartucho tiene en pantalla. */
  function verificarMecanismoDeFin(ctx, hallazgos, propsFicha) {
    const hayVida = ctx.grupos.some(g => g.prop.tipo === 'vida');
    const hayMuerte = ctx.grupos.some(g => g.prop.tipo === 'muerte');
    const fin = propsFicha.finJuego;

    if (fin === null) {
      hallazgos.errores.push('El segmento de cartucho no define su mecanismo de fin de ' +
        'partida (el cartucho declararía que nunca termina).');
    } else if (fin === 'vida' && !hayVida) {
      hallazgos.errores.push('El fin es por iconos de vida pero no hay ningún segmento de tipo vida.');
    } else if (fin === 'muerte' && !hayMuerte) {
      hallazgos.errores.push('El fin es por iconos de muerte pero no hay ningún segmento de tipo muerte.');
    } else if (fin === 'contador') {
      verificarFinPorContador(ctx, hallazgos, propsFicha, hayVida || hayMuerte);
    }
  }

  /**
   * Fin por contador: excluyente con los iconos; el contador elegido debe
   * existir en pantalla, ser descendente y no empezar en cero (empezar en
   * 0 = la partida nunca termina).
   */
  function verificarFinPorContador(ctx, hallazgos, propsFicha, hayIconos) {
    if (hayIconos) {
      hallazgos.errores.push('El fin por contador es excluyente con los iconos de vida/muerte ' +
        '(el cartucho tiene segmentos de esos tipos).');
      return;
    }
    const numeroFin = Number(propsFicha.finContador);
    if (!(numeroFin >= 1 && numeroFin <= 4)) {
      hallazgos.errores.push('El fin por contador no elige su contador interno (debe ser 1-4).');
      return;
    }
    const contador = ctx.grupos.find(g => g.prop.tipo === 'contador' &&
      Number(g.prop.contadorInterno) === numeroFin);
    if (!contador) {
      hallazgos.errores.push('El fin usa el contador interno ' + numeroFin +
        ' pero no hay ningún contador en pantalla asociado a él.');
      return;
    }
    if (contador.prop.direccion !== 'descendente') {
      hallazgos.errores.push('El contador del fin (' + ctx.segId(contador) +
        ') no es descendente: la partida nunca terminaría.');
    }
    if (Number(contador.prop.valorInicial) === 0) {
      hallazgos.errores.push('El contador del fin (' + ctx.segId(contador) +
        ') empieza en 0: la partida nunca terminaría.');
    }
  }

  /** Secuencia: cada segmento existe y es juego/inicio/adicional; con segmentos, los ticks deben ser >= 1. */
  function verificarSecuenciaDeCartucho(ctx, hallazgos, propsFicha) {
    let haySecuencia = false;
    for (const campo of ctx.CAMPOS_SECUENCIA) {
      if (propsFicha[campo] === null) continue;
      haySecuencia = true;
      const destino = ctx.grupoDeComp(propsFicha[campo]);
      if (!destino) {
        hallazgos.errores.push('La Secuencia apunta a un segmento que no existe.');
      } else if (destino.prop.tipo !== 'juego' && destino.prop.tipo !== 'inicio' &&
        destino.prop.tipo !== 'adicional') {
        hallazgos.errores.push(ctx.segId(destino) + ' no puede ser segmento de la ' +
          'Secuencia (es de tipo ' + destino.prop.tipo + ').');
      }
    }
    if (haySecuencia && !(Number(propsFicha.secTicks) >= 1)) {
      hallazgos.errores.push('La Secuencia tiene segmentos pero no declara sus ticks ' +
        '(cada cuánto se relanza).');
    }
  }

  /**
   * Campos del Director: la aceleración se declara COMPLETA o nada; un
   * mínimo por encima de la pausa del simulador es un AVISO (no tendría
   * efecto en PC); el resto de números, si están, deben ser >= 1.
   */
  function verificarDirectorDeCartucho(hallazgos, propsFicha) {
    const camposAceleracion = ['accCada', 'accResta', 'accMinimo'];
    const declarados = camposAceleracion.filter(c => propsFicha[c] !== null).length;

    if (declarados > 0 && declarados < 3) {
      hallazgos.errores.push('La aceleración debe declararse completa: ticks entre reducciones, ' +
        'reducción y pausa mínima (o ninguno de los tres: pausa fija).');
    } else if (declarados === 3) {
      if (!(Number(propsFicha.accCada) >= 1)) {
        hallazgos.errores.push('Los ticks entre reducciones deben ser 1 o más.');
      }
      if (!(Number(propsFicha.accResta) >= 1)) {
        hallazgos.errores.push('La reducción de la aceleración debe ser 1 ms o más.');
      }
      const pausaBase = (propsFicha.pausaSim !== null) ? Number(propsFicha.pausaSim) : 500;
      if (Number(propsFicha.accMinimo) >= pausaBase) {
        hallazgos.avisos.push('La pausa mínima (' + propsFicha.accMinimo + ' ms) no es menor que la ' +
          'pausa del simulador (' + pausaBase + ' ms): la aceleración no ' +
          'tendrá efecto en PC.');
      }
    }
    if (propsFicha.pausaSim !== null && !(Number(propsFicha.pausaSim) >= 1)) {
      hallazgos.errores.push('La pausa del simulador debe ser 1 ms o más.');
    }
    if (propsFicha.pausaEsp !== null && !(Number(propsFicha.pausaEsp) >= 1)) {
      hallazgos.errores.push('La pausa del sistema externo debe ser 1 ms o más.');
    }
    if (propsFicha.aumentarCada !== null && !(Number(propsFicha.aumentarCada) >= 1)) {
      hallazgos.errores.push('El Nº para aumentar rutas debe ser 1 o más.');
    }
  }

  /** Al menos UN jugador (sin él no hay partida: bloqueante) y al menos un inicio de ruta (aviso). */
  function verificarJugadoresYRutas(ctx, hallazgos) {
    const hayJugador = ctx.grupos.some(g => !g.absorbido && g.prop.tipo === 'jugador');
    if (!hayJugador) {
      hallazgos.errores.push('No hay ningún segmento de tipo jugador: no se puede jugar.');
    }
    if (!ctx.grupos.some(g => g.prop.tipo === 'inicio')) {
      hallazgos.avisos.push('ningún segmento es inicio de ruta: el motor no sabrá por dónde empezar.');
    }
  }

  // ---------------- Formato del GWC (constantes) ----------------
  // El GWC es el cartucho de EJECUCIÓN binario: cabecera de 14 bytes
  // («GWC» + versión + código «#HHHH#» + tamaño del fichero) y bloques
  // uniformes (tipo 1 + tamaño del contenido 4 + contenido). La grabación
  // es un COMPILADOR: recorre las listas siempre en el mismo orden y
  // escribe siempre lo mismo (mismo GWI → mismo GWC byte a byte).

  // Versión del formato: el CARÁCTER «1» (la cabecera se lee «GWC1»).
  const VERSION_GWC = '1';

  // Tamaños fijos del formato.
  const TAM_CABECERA_GWC = 14;
  const TAM_CABECERA_BLOQUE_GWC = 5;          // tipo (1) + tamaño del contenido (4)
  const TAM_CONTENIDO_DATOS_GWC = 35;         // Bloque 0
  const TAM_CONTENIDO_CONFIG_GWC = 16;        // Bloque 1: 8 valores uint16
  const TAM_REGISTRO_SEGMENTO_GWC = 32;       // Bloque 3
  const TAM_REGISTRO_SECUENCIA_GWC = 6;       // Bloque 4: ticks + 5 índices
  const MAX_SEGMENTOS_SECUENCIA_GWC = 5;

  // Tope de elementos direccionables con índices de 1 byte (0-254;
  // 0xFF reservado como nulo): sprites, segmentos y secuencias.
  const TOPE_GWC = 255;

  // Nulo por anchura de campo (todos los bits a 1).
  const NULO_GWC = 0xFF;
  const NULO16_GWC = 0xFFFF;
  const NULO32_GWC = 0xFFFFFFFF;

  // Tipos de bloque.
  const BLOQUE_DATOS_GWC = 0;        // Datos Generales (SIEMPRE)
  const BLOQUE_CONFIG_GWC = 1;       // Configuración (SIEMPRE)
  const BLOQUE_SPRITES_GWC = 2;      // tabla de direcciones + máscaras 1 bit
  const BLOQUE_SEGMENTOS_GWC = 3;    // registros fijos de 32 bytes
  const BLOQUE_SECUENCIAS_GWC = 4;   // registros de 6 bytes (opcional)
  const BLOQUE_FONDO_GWC = 5;        // RESERVADO (v1 no lo escribe)

  // Los 20 enlaces del registro de segmento, en el ORDEN FIJO del formato.
  // Los inversos calculados (colisionDe, mostradoJunto) NO viajan: el
  // motor los deduce.
  const ENLACES_REGISTRO_GWC = ['siguiente', 'salvado', 'muerte',
    'mostrarJunto', 'izquierda', 'derecha', 'arriba', 'abajo',
    'colision', 'barra_a', 'barra_b', 'barra_c', 'barra_d', 'barra_e',
    'barra_f', 'barra_g', 'digito_1', 'digito_2', 'digito_3',
    'digito_4'];

  // Bits del byte de propiedades de un registro de segmento (bits 3-7 libres).
  const BIT_PRIMER_JUGADOR_GWC = 0x01;
  const BIT_ASCENDENTE_GWC = 0x02;
  const BIT_PRESENTAR_CERO_GWC = 0x04;

  // Mecanismo de fin de partida como valor del Bloque 1.
  const FIN_GWC = { vida: 1, muerte: 2, contador: 3 };
  const FIN_GWC_INV = { 1: 'vida', 2: 'muerte', 3: 'contador' };

  // Enteros little-endian (los uint16 del Bloque 1 y el RGB del fondo): el
  // ESP32 lee el fichero con casts directos a uint16_t.

  /** Un byte como array. */
  function byteDe(valor) { return [valor & 0xFF]; }

  /** uint16 little-endian como array de 2 bytes. */
  function u16LE(valor) { return [valor & 0xFF, (valor >>> 8) & 0xFF]; }

  /** uint32 little-endian como array de 4 bytes. */
  function u32LE(valor) {
    return [valor & 0xFF, (valor >>> 8) & 0xFF, (valor >>> 16) & 0xFF, (valor >>> 24) & 0xFF];
  }

  /** Texto ASCII como array de bytes. */
  function textoGWC(texto) {
    const bytes = [];
    for (let i = 0; i < texto.length; i++) bytes.push(texto.charCodeAt(i) & 0xFF);
    return bytes;
  }

  /** Concatena varios arrays/Uint8Array en un único Uint8Array. */
  function concatenar(listas) {
    let total = 0;
    for (const lista of listas) total += lista.length;
    const resultado = new Uint8Array(total);
    let desplazamiento = 0;
    for (const lista of listas) {
      resultado.set(lista, desplazamiento);
      desplazamiento += lista.length;
    }
    return resultado;
  }

  /**
   * Valor numérico o su valor por defecto si falta (undefined/null).
   * @param {*} valor - Valor leído del GWI.
   * @param {number} porDefecto - Valor si no está declarado.
   * @returns {number} El número resultante.
   */
  function numeroODefecto(valor, porDefecto) {
    return (valor === undefined || valor === null) ? porDefecto : Number(valor);
  }

  /**
   * Un campo opcional del GWI como byte: el valor (módulo 256) o el que
   * se indique si no está declarado.
   */
  function byteOpcional(valor, valorSiAusente) {
    return (valor === undefined || valor === null) ? valorSiAusente : Number(valor) & 0xFF;
  }

  // ---------------- Grabación del GWC ----------------

  /**
   * Los enlaces de un id legible («seg_003», «F01») a su ÍNDICE de 1 byte
   * en el GWC, con el NULO (0xFF) para los ausentes o los que no resuelvan
   * (un enlace colgante ya lo cantó la verificación; aquí se escribe el
   * nulo para que el firmware nunca lea un índice fuera de las tablas).
   * @param {?string} id - Identificador legible del destino.
   * @param {Map<string,number>} indices - Tabla id → índice.
   * @returns {number} El índice (0-254) o 0xFF si es nulo.
   */
  function indiceDe(id, indices) {
    if (id === null || id === undefined || id === false) return NULO_GWC;
    const indice = indices.get(id);
    return (indice === undefined) ? NULO_GWC : indice;
  }

  /**
   * Escribe la estructura común de todos los bloques: tipo (1 byte),
   * tamaño del CONTENIDO (4 bytes, sin los 5 de la propia cabecera) y
   * contenido.
   * @param {number} tipo - Tipo de bloque (0-5).
   * @param {Uint8Array} contenido - Contenido del bloque.
   * @returns {Uint8Array} El bloque completo.
   */
  function bloque(tipo, contenido) {
    return concatenar([new Uint8Array(byteDe(tipo)),
    new Uint8Array(u32LE(contenido.length)), contenido]);
  }

  /**
   * Lo que VIAJA al GWC de las listas del GWI: los segmentos que no sean
   * fantasmas tipo 99 ni absorbidos por una unión (fusionadoPor), y los
   * sprites que alguno de esos segmentos referencia (los sprites de los
   * absorbidos viven DENTRO de la imagen fusionada de su pieza). El orden
   * del GWI se conserva: es el orden determinista del editor.
   * @param {Object} json - GWI montado.
   * @returns {{segmentos:Array, sprites:Array}} Las dos listas que viajan.
   */
  function _viajanEnGWC(json) {
    const segmentos = (json.segmentos || []).filter(s =>
      s.tipo !== TIPO_FANTASMA && !s.fusionadoPor);
    const spritesUsados = new Set();
    for (const segmento of segmentos) {
      if (segmento.sprite) spritesUsados.add(segmento.sprite);
    }
    const sprites = (json.sprites || []).filter(s => spritesUsados.has(s.id));
    return { segmentos: segmentos, sprites: sprites };
  }

  /**
   * Comprueba que sprites, segmentos y secuencias no superan los 255
   * elementos direccionables. Cuenta solo lo que VIAJA. Devuelve cierto o
   * falso: es el punto de llamada quien decide — AVISO tras descomponer y
   * al guardar el GWI, BLOQUEANTE en «Generar GWI+GWC».
   * @param {Object} json - GWI montado, con sus listas.
   * @returns {boolean} true si todo está dentro de los topes.
   */
  function validarTopes(json) {
    const viaja = _viajanEnGWC(json);
    const haySecuencia = json.secuencia && json.secuencia.segmentos &&
      json.secuencia.segmentos.length > 0;
    const numeroSecuencias = haySecuencia ? 1 : 0;
    return viaja.sprites.length <= TOPE_GWC &&
      viaja.segmentos.length <= TOPE_GWC &&
      numeroSecuencias <= TOPE_GWC;
  }

  /** Escala por eje de la imagen fuente a la pantalla declarada. */
  function escalasDePantalla(pantalla) {
    return {
      x: pantalla.ancho / pantalla.fuente.ancho,
      y: pantalla.alto / pantalla.fuente.alto
    };
  }

  /** Píxeles RGBA de un sprite (canvas del editor, o Image pasada por un canvas efímero). */
  function pixelesDeSprite(sprite) {
    let lienzo = sprite.imagen;
    if (!lienzo.getContext) {
      lienzo = document.createElement('canvas');
      lienzo.width = sprite.ancho;
      lienzo.height = sprite.alto;
      lienzo.getContext('2d').drawImage(sprite.imagen, 0, 0);
    }
    return lienzo.getContext('2d').getImageData(0, 0, sprite.ancho, sprite.alto).data;
  }

  /**
   * Convierte un sprite en su MÁSCARA de 1 bit escalada a la pantalla
   * declarada: muestreo por VECINO MÁS CERCANO con escala por eje (la del
   * simulador, que estira img_s a la resolución del setup), bit más
   * significativo a la izquierda de cada byte, blanco = 0 y negro = 1.
   * @param {{id:string, ancho:number, alto:number, imagen:object}} sprite -
   *        Sprite del editor con su imagen en memoria.
   * @param {{ancho:number, alto:number, fuente:{ancho:number, alto:number}}}
   *        pantalla - Pantalla declarada (destino) y dimensiones de la
   *        imagen fuente (la propia pantalla si el origen es un GWC: escala 1).
   * @returns {{ancho:number, alto:number, filas:Uint8Array}} Máscara
   *        escalada (filas apiladas, ⌈ancho/8⌉ bytes por fila).
   */
  function escalar(sprite, pantalla) {
    const escala = escalasDePantalla(pantalla);
    const anchoDestino = Math.max(1, Math.round(sprite.ancho * escala.x));
    const altoDestino = Math.max(1, Math.round(sprite.alto * escala.y));
    const pixeles = pixelesDeSprite(sprite);

    const bytesPorFila = Math.ceil(anchoDestino / 8);
    const filas = new Uint8Array(bytesPorFila * altoDestino);

    for (let yDestino = 0; yDestino < altoDestino; yDestino++) {
      // Vecino más cercano por eje, desde el ORIGEN del sprite: la
      // posición del segmento viaja escalada aparte (en su registro).
      const yOrigen = Math.min(sprite.alto - 1, Math.max(0, Math.floor(yDestino / escala.y)));
      for (let xDestino = 0; xDestino < anchoDestino; xDestino++) {
        const xOrigen = Math.min(sprite.ancho - 1, Math.max(0, Math.floor(xDestino / escala.x)));
        const i = (yOrigen * sprite.ancho + xOrigen) * 4;
        const esClaro = (pixeles[i] + pixeles[i + 1] + pixeles[i + 2] >= UMBRAL_BLANCO);
        if (!esClaro) {
          filas[yDestino * bytesPorFila + (xDestino >> 3)] |= (0x80 >> (xDestino & 7));
        }
      }
    }
    return { ancho: anchoDestino, alto: altoDestino, filas: filas };
  }

  /**
   * Genera el GWC: valida los topes y ORQUESTA el ensamblado — cada bloque
   * lo monta SU PROPIA función; el Bloque 0 va el último (necesita las
   * direcciones de los demás) y la cabecera al final, sobre los bytes ya
   * montados, con la suma de verificación del resto. DETERMINISTA: sin
   * azar y con recorridos en orden fijo.
   * @param {Object} json - GWI montado (listas, fin, secuencia, pausas,
   *        aceleración y rutas al nivel superior).
   * @param {Array<{id:string, imagen:object}>} spritesConImagen - Sprites
   *        del editor con su imagen en memoria (para las máscaras).
   * @param {{ancho:number, alto:number, fuente:{ancho:number, alto:number}}}
   *        pantalla - Pantalla declarada y dimensiones de la fuente.
   * @returns {{bytes:Uint8Array, checksum:number, codigo:string,
   *            bloques:Object, nSprites:number, nSegmentos:number}} El
   *            fichero y su descomposición por bloques (para estadistica).
   */
  function generarGWC(json, spritesConImagen, pantalla) {
    if (!validarTopes(json)) {
      throw new Error('el cartucho supera los topes del GWC (' +
        TOPE_GWC + ' sprites/segmentos/secuencias por índice de 1 byte).');
    }

    // Lo que VIAJA y las tablas de índices: todos los bloques montan sobre ellas.
    const viaja = _viajanEnGWC(json);
    const imagenDeSprite = new Map();
    for (const sprite of (spritesConImagen || [])) imagenDeSprite.set(sprite.id, sprite.imagen);
    const indiceDeSegmento = new Map(viaja.segmentos.map((s, i) => [s.id, i]));
    const indiceDeSprite = new Map(viaja.sprites.map((s, i) => [s.id, i]));
    const escala = escalasDePantalla(pantalla);

    // El Bloque 5 (Fondo) es RESERVADO: la v1 no lo escribe.
    const bloqueConfiguracion = _montarConfiguracion(json);
    const bloqueSprites = _montarSprites(viaja, imagenDeSprite, pantalla);
    const bloqueSegmentos = _montarSegmentos(viaja, indiceDeSprite, indiceDeSegmento, escala.x, escala.y);
    const bloqueSecuencias = _montarSecuencias(json, indiceDeSegmento);
    const bloqueDatos = _montarDatosGenerales(json, viaja, pantalla, bloqueConfiguracion, bloqueSprites, bloqueSegmentos, bloqueSecuencias);

    // Ensamblado en el orden de los tipos; este cuerpo es lo que protege la suma.
    const partes = [bloqueDatos, bloqueConfiguracion, bloqueSprites, bloqueSegmentos];
    if (bloqueSecuencias) partes.push(bloqueSecuencias);
    const cuerpo = concatenar(partes);

    const cabecera = _montarCabecera(cuerpo);

    // Espacio ahorrado por la deduplicación de sprites (informativo):
    // cada máscara se escribe UNA vez aunque la usen varios segmentos;
    // sin deduplicación, cada segmento que viaja llevaría la suya. El
    // tamaño de la máscara es el mismo que calcula escalar (4 bytes de
    // ancho/alto + filas de bits escaladas a la pantalla declarada).
    const usosDeSprite = new Map();
    for (const s of viaja.segmentos) {
      usosDeSprite.set(s.sprite, (usosDeSprite.get(s.sprite) || 0) + 1);
    }
    let ahorroSprites = 0;
    for (const sprite of viaja.sprites) {
      const n = usosDeSprite.get(sprite.id) || 0;
      if (n < 2) continue;
      const anchoDestino = Math.max(1, Math.round(sprite.ancho * escala.x));
      const altoDestino = Math.max(1, Math.round(sprite.alto * escala.y));
      ahorroSprites += (n - 1) * (4 + Math.ceil(anchoDestino / 8) * altoDestino);
    }

    return {
      bytes: cabecera.bytes,
      checksum: cabecera.checksum,
      codigo: cabecera.codigo,          // el Código GWC «#HHHH#», para el par del GWI
      ahorroSprites: ahorroSprites,     // bytes ahorrados por la deduplicación
      nSprites: viaja.sprites.length,
      nSegmentos: viaja.segmentos.length,
      bloques: {
        datos: bloqueDatos.length,
        configuracion: bloqueConfiguracion.length,
        sprites: bloqueSprites.length,
        segmentos: bloqueSegmentos.length,
        secuencias: bloqueSecuencias ? bloqueSecuencias.length : 0
      }
    };
  }

  /**
   * Bloque 1 Configuración: los 8 valores uint16 del cartucho (el del
   * diseñador o el por defecto; nunca vacío, determinista). Sin
   * aceleración declarada, sus tres valores viajan a nulo; el fin ausente
   * también.
   * @param {Object} json - GWI montado.
   * @returns {Uint8Array} El Bloque 1 completo.
   */
  function _montarConfiguracion(json) {
    const pausas = json.pausas || {};
    const aceleracion = json.aceleracion || null;
    const rutas = json.rutas || {};
    const fin = json.fin || {};

    const valores = [
      ...u16LE(numeroODefecto(pausas.simulador, 500)),
      ...u16LE(numeroODefecto(pausas.externo, 500)),
      ...u16LE(aceleracion ? Number(aceleracion.cada) || 1 : NULO16_GWC),
      ...u16LE(aceleracion ? Number(aceleracion.resta) || 0 : NULO16_GWC),
      ...u16LE(aceleracion ? Number(aceleracion.minimo) || 0 : NULO16_GWC),
      ...u16LE(numeroODefecto(rutas.aumentarCada, 1)),
      ...u16LE(fin.mecanismo ? FIN_GWC[fin.mecanismo] : NULO16_GWC),
      ...u16LE(numeroODefecto(fin.contador, NULO16_GWC))
    ];
    return bloque(BLOQUE_CONFIG_GWC, new Uint8Array(valores));
  }

  /**
   * Bloque 2 Sprites: la tabla de direcciones (4 bytes por sprite,
   * desplazamiento del registro de máscara desde el inicio del CONTENIDO
   * del bloque) y a continuación las máscaras en el mismo orden (cada
   * registro: ancho 2, alto 2, filas), ESCALADAS a la pantalla declarada.
   * @param {{segmentos:Array, sprites:Array}} viaja - Lo que viaja (_viajanEnGWC).
   * @param {Map<string,object>} imagenDeSprite - Tabla id sprite → imagen.
   * @param {Object} pantalla - Pantalla declarada y fuente (ver escalar).
   * @returns {Uint8Array} El Bloque 2 completo.
   */
  function _montarSprites(viaja, imagenDeSprite, pantalla) {
    const mascaras = viaja.sprites.map(s => escalar(
      { id: s.id, ancho: s.ancho, alto: s.alto, imagen: imagenDeSprite.get(s.id) }, pantalla));

    // La tabla va antes de las máscaras: la primera empieza tras ella.
    const tablaDirecciones = [];
    let desplazamiento = viaja.sprites.length * 4;
    for (const mascara of mascaras) {
      tablaDirecciones.push(...u32LE(desplazamiento));
      desplazamiento += 4 + mascara.filas.length;
    }

    const registros = [];
    for (const mascara of mascaras) {
      registros.push(new Uint8Array([...u16LE(mascara.ancho), ...u16LE(mascara.alto)]));
      registros.push(mascara.filas);
    }
    return bloque(BLOQUE_SPRITES_GWC,
      concatenar([new Uint8Array(tablaDirecciones), ...registros]));
  }

  /**
   * Byte de propiedades de un segmento: bit 0 jugador inicial, bit 1
   * ascendente, bit 2 presentar el cero (los defaults de los dos últimos
   * son 1: el GWI no lleva sobras).
   */
  function propiedadesDeSegmento(segmento) {
    let propiedades = BIT_ASCENDENTE_GWC | BIT_PRESENTAR_CERO_GWC;
    if (segmento.primero) propiedades |= BIT_PRIMER_JUGADOR_GWC;
    if (segmento.direccion === 'descendente') propiedades &= ~BIT_ASCENDENTE_GWC;
    if (segmento.presentarCero === false) propiedades &= ~BIT_PRESENTAR_CERO_GWC;
    return propiedades;
  }

  /**
   * Bloque 3 Segmentos: registros FIJOS de 32 bytes (tipo 1, x 2, y 2,
   * sprite 1, 20 enlaces de 1, salvadoContador 1, muerteContador 1,
   * propiedades 1, contador interno 1, valor inicial 1, ruta 1).
   * Posiciones ESCALADAS a la pantalla; los enlaces, a ÍNDICES de 1 byte.
   * @param {{segmentos:Array, sprites:Array}} viaja - Lo que viaja.
   * @param {Map<string,number>} indiceDeSprite - Tabla id sprite → índice.
   * @param {Map<string,number>} indiceDeSegmento - Tabla id segmento → índice.
   * @param {number} escalaX - Escala X (pantalla / fuente).
   * @param {number} escalaY - Escala Y (pantalla / fuente).
   * @returns {Uint8Array} El Bloque 3 completo.
   */
  function _montarSegmentos(viaja, indiceDeSprite, indiceDeSegmento, escalaX, escalaY) {
    const registros = [];
    for (const segmento of viaja.segmentos) {
      registros.push(...byteDe(segmento.tipo));
      registros.push(...u16LE(Math.max(0, Math.round(segmento.x * escalaX))));
      registros.push(...u16LE(Math.max(0, Math.round(segmento.y * escalaY))));
      registros.push(...byteDe(indiceDe(segmento.sprite, indiceDeSprite)));
      for (const campo of ENLACES_REGISTRO_GWC) {
        registros.push(...byteDe(indiceDe(segmento[campo], indiceDeSegmento)));
      }
      registros.push(...byteDe(byteOpcional(segmento.salvadoContador, NULO_GWC)));
      registros.push(...byteDe(byteOpcional(segmento.muerteContador, NULO_GWC)));
      registros.push(...byteDe(propiedadesDeSegmento(segmento)));
      registros.push(...byteDe(byteOpcional(segmento.contadorInterno, NULO_GWC)));
      registros.push(...byteDe(byteOpcional(segmento.valorInicial, 0)));
      registros.push(...byteDe(byteOpcional(segmento.ruta, NULO_GWC)));
    }
    return bloque(BLOQUE_SEGMENTOS_GWC, new Uint8Array(registros));
  }

  /**
   * Bloque 4 Secuencias (OPCIONAL): la Secuencia del cartucho en un
   * registro de 6 bytes (ticks + 5 índices de segmento, huecos a nulo). Si
   * algún segmento de la Secuencia no viaja, se descarta con aviso (nunca
   * en silencio). Sin Secuencia declarada devuelve null (el bloque no
   * existe y su dirección viaja a nulo).
   * @param {Object} json - GWI montado.
   * @param {Map<string,number>} indiceDeSegmento - Tabla id segmento → índice.
   * @returns {?Uint8Array} El Bloque 4 completo, o null.
   */
  function _montarSecuencias(json, indiceDeSegmento) {
    if (!json.secuencia || !json.secuencia.segmentos ||
      json.secuencia.segmentos.length === 0) return null;

    const registro = [];
    registro.push(...byteDe(Math.min(0xFF, Math.max(1, Number(json.secuencia.ticks) || 1))));

    const idsSecuencia = json.secuencia.segmentos.slice(0, MAX_SEGMENTOS_SECUENCIA_GWC);
    for (let i = 0; i < MAX_SEGMENTOS_SECUENCIA_GWC; i++) {
      const id = idsSecuencia[i];
      const indice = indiceDe(id, indiceDeSegmento);
      if (id && indice === NULO_GWC) {
        console.warn('[gwc] la Secuencia apunta a ' + id + ', que no viaja en el GWC: se descarta.');
      }
      registro.push(...byteDe(indice));
    }
    return bloque(BLOQUE_SECUENCIAS_GWC, new Uint8Array(registro));
  }

  /**
   * Bloque 0 Datos Generales: estilo, pantalla declarada, conteos, color de
   * fondo RGB (blanco: la v1 no escribe el bloque de fondo) y las
   * direcciones de los seis bloques (los ausentes, a nulo). Mide SIEMPRE 40
   * bytes (35 de contenido): las direcciones se calculan con los TAMAÑOS
   * de los bloques ya montados — por eso se monta el último aunque en el
   * fichero va el primero.
   * @param {Object} json - GWI montado.
   * @param {{segmentos:Array, sprites:Array}} viaja - Lo que viaja.
   * @param {Object} pantalla - Pantalla declarada.
   * @param {Uint8Array} bloqueConfig - Bloque 1 montado.
   * @param {Uint8Array} bloqueSprites - Bloque 2 montado.
   * @param {Uint8Array} bloqueSegmentos - Bloque 3 montado.
   * @param {?Uint8Array} bloqueSecuencias - Bloque 4 montado (o null).
   * @returns {Uint8Array} El Bloque 0 completo.
   */
  function _montarDatosGenerales(json, viaja, pantalla, bloqueConfig, bloqueSprites,
    bloqueSegmentos, bloqueSecuencias) {
    const direccionBloque0 = TAM_CABECERA_GWC;
    const direccionBloque1 = direccionBloque0 + TAM_CABECERA_BLOQUE_GWC + TAM_CONTENIDO_DATOS_GWC;
    const direccionBloque2 = direccionBloque1 + bloqueConfig.length;
    const direccionBloque3 = direccionBloque2 + bloqueSprites.length;
    const direccionBloque4 = bloqueSecuencias
      ? direccionBloque3 + bloqueSegmentos.length : NULO32_GWC;
    const direccionBloque5 = NULO32_GWC;   // Fondo: RESERVADO

    const contenido = [];
    contenido.push(...byteDe(Number(json.estilo) || 0));
    contenido.push(...u16LE(pantalla.ancho), ...u16LE(pantalla.alto));
    contenido.push(...byteDe(viaja.sprites.length), ...byteDe(viaja.segmentos.length));
    contenido.push(...byteDe(bloqueSecuencias ? 1 : 0));
    contenido.push(0xFF, 0xFF, 0xFF);        // fondo RGB: blanco por defecto
    contenido.push(...u32LE(direccionBloque0), ...u32LE(direccionBloque1),
      ...u32LE(direccionBloque2), ...u32LE(direccionBloque3),
      ...u32LE(direccionBloque4), ...u32LE(direccionBloque5));
    return bloque(BLOQUE_DATOS_GWC, new Uint8Array(contenido));
  }

  /**
   * La cabecera del fichero: «GWC» + la versión como CARÁCTER (visible al
   * abrir el fichero: «GWC1») + la suma de verificación del resto como
   * TEXTO «#HHHH#» + el tamaño del FICHERO. Se monta AL FINAL sobre el
   * cuerpo ya ensamblado (la suma no se incluye a sí misma). La parte
   * visible va DELANTE a propósito: lo binario (el tamaño) detrás.
   * @param {Uint8Array} cuerpo - Todos los bloques ya ensamblados.
   * @returns {{bytes:Uint8Array, checksum:number, codigo:string}} El
   *          fichero completo, su suma de verificación y el código.
   */
  function _montarCabecera(cuerpo) {
    const tamanoTotal = TAM_CABECERA_GWC + cuerpo.length;
    const fichero = new Uint8Array(tamanoTotal);

    fichero.set(textoGWC('GWC' + VERSION_GWC), 0);   // 4 bytes visibles
    fichero.set(cuerpo, TAM_CABECERA_GWC);

    const checksum = _sumaDeVerificacion(cuerpo);
    const codigo = _codigoDeSuma(checksum);
    fichero.set(textoGWC(codigo), 4);                // 6 bytes: «#HHHH#»
    fichero.set(u32LE(tamanoTotal), 10);
    return { bytes: fichero, checksum: checksum, codigo: codigo };
  }

  /**
   * La suma de verificación del GWC: suma de los bytes módulo 65536. Cubre
   * TODO el fichero menos la cabecera.
   * @param {Uint8Array} bytes - Los bytes a proteger.
   * @returns {number} La suma módulo 65536.
   */
  function _sumaDeVerificacion(bytes) {
    let suma = 0;
    for (let i = 0; i < bytes.length; i++) suma = (suma + bytes[i]) & 0xFFFF;
    return suma;
  }

  /**
   * Formatea una suma de verificación como el Código GWC: el TEXTO visible
   * «#HHHH#» (hexadecimal en mayúsculas, 4 dígitos). Mismo formato que el
   * campo del par en el GWI y que la cabecera del GWC.
   * @param {number} suma - La suma módulo 65536.
   * @returns {string} El código, p. ej. «#0B99#».
   */
  function _codigoDeSuma(suma) {
    return '#' + suma.toString(16).toUpperCase().padStart(4, '0') + '#';
  }

  /**
   * Texto con la estadística de tamaños del GWC generado: el TAMAÑO FINAL
   * con su descomposición por bloques.
   * @param {Object} gwc - Resultado de generarGWC (bytes y bloques).
   * @returns {string} El mensaje con el total y sus bloques.
   */
  function estadistica(gwc) {
    const bloques = gwc.bloques;
    return 'GWC generado: ' + gwc.bytes.length + ' bytes — Datos ' +
      bloques.datos + ' · Configuración ' + bloques.configuracion + ' · Sprites ' +
      bloques.sprites + ' (' + gwc.nSprites + ') · Segmentos ' + bloques.segmentos +
      ' (' + gwc.nSegmentos + ') · Secuencias ' + bloques.secuencias +
      ' · código GWC ' + gwc.codigo + '.';
  }

  // ---------------- Lectura del GWC ----------------
  // SECCIÓN DELIMITADA Y AUTOCONTENIDA: no depende del GWB, del paquete, de
  // las imágenes PNG ni del editor — solo de los bytes y de las
  // constantes del formato — para servir, con los cambios oportunos, como
  // lector del firmware del ESP32. Reconstruye las listas con las MISMAS
  // formas que produce el editor: los índices vuelven a ser referencias
  // legibles (seg_NNN / img_NNN), las máscaras de 1 bit vuelven como
  // píxeles en memoria y la configuración vuelve al nivel superior como si
  // viniera de un GWI. Las coordenadas y máscaras ya están ESCALADAS a la
  // pantalla declarada.

  /** Lectores little-endian sobre un array de bytes. */
  function _crearLectorBytes(bytes) {
    return {
      u8: (p) => bytes[p],
      u16: (p) => bytes[p] | (bytes[p + 1] << 8),
      u32: (p) => (bytes[p] | (bytes[p + 1] << 8) | (bytes[p + 2] << 16) |
        (bytes[p + 3] << 24)) >>> 0
    };
  }

  /** Id legible de un segmento a partir de su índice. */
  function idDeSegmentoGWC(indice) {
    return 'seg_' + String(indice).padStart(3, '0');
  }

  /**
   * Valida la cabecera: tamaño mínimo, identificador «GWC», versión,
   * tamaño declarado y suma de verificación. Cualquier desviación es un
   * error explícito.
   * @returns {{suma:number, codigo:string}} Suma real y su código «#HHHH#».
   */
  function _validarCabeceraGWC(bytes, lector) {
    if (bytes.length < TAM_CABECERA_GWC) {
      throw new Error('el GWC está truncado: le faltan bytes de cabecera.');
    }
    if (String.fromCharCode(bytes[0], bytes[1], bytes[2]) !== 'GWC') {
      throw new Error('no es un cartucho GWC: el identificador no es «GWC».');
    }
    if (bytes[3] !== VERSION_GWC.charCodeAt(0)) {
      throw new Error('versión de GWC no soportada: ' + String.fromCharCode(bytes[3]) +
        ' (este lector entiende la ' + VERSION_GWC + ').');
    }
    if (lector.u32(10) !== bytes.length) {
      throw new Error('el tamaño declarado (' + lector.u32(10) +
        ') no cuadra con el fichero (' + bytes.length + ').');
    }

    let suma = 0;
    for (let i = TAM_CABECERA_GWC; i < bytes.length; i++) suma = (suma + bytes[i]) & 0xFFFF;
    const codigoReal = '#' + suma.toString(16).toUpperCase().padStart(4, '0') + '#';
    const codigoDeclarado = String.fromCharCode(...bytes.slice(4, 10));
    if (codigoDeclarado !== codigoReal) {
      throw new Error('la suma de verificación no coincide (declarada ' + codigoDeclarado +
        ', real ' + codigoReal + '): el GWC está corrupto.');
    }
    return { suma: suma, codigo: codigoReal };
  }

  /**
   * Abre un bloque: valida que su dirección esté dentro del fichero, que
   * sea del tipo esperado y que su contenido no desborde.
   * @returns {{inicio:number, tam:number}} Posición y tamaño del contenido.
   */
  function _abrirBloqueGWC(bytes, lector, posicion, tipoEsperado, nombre) {
    if (posicion === NULO32_GWC) {
      throw new Error('falta el bloque de ' + nombre + '.');
    }
    if (posicion < TAM_CABECERA_GWC || posicion >= bytes.length) {
      throw new Error('la dirección del bloque de ' + nombre +
        ' apunta fuera del fichero (' + posicion + ').');
    }
    if (bytes[posicion] !== tipoEsperado) {
      throw new Error('se esperaba el bloque de ' + nombre + ' (tipo ' + tipoEsperado +
        ') y su dirección apunta a un tipo ' + bytes[posicion] + '.');
    }
    const tamano = lector.u32(posicion + 1);
    if (posicion + TAM_CABECERA_BLOQUE_GWC + tamano > bytes.length) {
      throw new Error('el bloque de ' + nombre + ' declara ' + tamano + ' bytes y desborda el fichero.');
    }
    return { inicio: posicion + TAM_CABECERA_BLOQUE_GWC, tam: tamano };
  }

  /** Bloque 0: estilo, pantalla, conteos, color de fondo y direcciones de los 6 bloques. */
  function _leerDatosGeneralesGWC(bytes, lector) {
    const datos = _abrirBloqueGWC(bytes, lector, TAM_CABECERA_GWC, BLOQUE_DATOS_GWC, 'Datos Generales');
    if (datos.tam < TAM_CONTENIDO_DATOS_GWC) {
      throw new Error('el Bloque 0 de Datos Generales está incompleto (' + datos.tam +
        ' de ' + TAM_CONTENIDO_DATOS_GWC + ' bytes).');
    }
    const p = datos.inicio;
    const colorFondo = '#' + [lector.u8(p + 8), lector.u8(p + 9), lector.u8(p + 10)]
      .map(v => v.toString(16).toUpperCase().padStart(2, '0')).join('');
    const direcciones = [];
    for (let i = 0; i < 6; i++) direcciones.push(lector.u32(p + 11 + i * 4));

    return {
      estilo: lector.u8(p),
      ancho: lector.u16(p + 1),
      alto: lector.u16(p + 3),
      nSprites: lector.u8(p + 5),
      nSegmentos: lector.u8(p + 6),
      nSecuencias: lector.u8(p + 7),
      fondo: colorFondo,
      direcciones: direcciones
    };
  }

  /** Bloque 1: pausas, aceleración, política de rutas y fin (8 uint16; nulo = no aplica). */
  function _leerConfiguracionGWC(bytes, lector, posicion) {
    const config = _abrirBloqueGWC(bytes, lector, posicion, BLOQUE_CONFIG_GWC, 'Configuración');
    if (config.tam < TAM_CONTENIDO_CONFIG_GWC) {
      throw new Error('el Bloque 1 de Configuración está incompleto (' + config.tam +
        ' de ' + TAM_CONTENIDO_CONFIG_GWC + ' bytes).');
    }
    const valor = (n) => lector.u16(config.inicio + n * 2);
    const aceleracionCada = valor(2);
    const aceleracionResta = valor(3);
    const aceleracionMinimo = valor(4);
    const codigoFin = valor(6);
    const contadorFin = valor(7);

    if (aceleracionCada !== NULO16_GWC &&
      (aceleracionResta === NULO16_GWC || aceleracionMinimo === NULO16_GWC)) {
      console.warn('[gwc] la aceleración del cartucho está a medias: se toma como ausente.');
    }
    const aceleracionCompleta = aceleracionCada !== NULO16_GWC &&
      aceleracionResta !== NULO16_GWC && aceleracionMinimo !== NULO16_GWC;

    return {
      pausas: { simulador: valor(0), externo: valor(1) },
      aceleracion: aceleracionCompleta
        ? { cada: aceleracionCada, resta: aceleracionResta, minimo: aceleracionMinimo } : null,
      rutas: { aumentarCada: valor(5) },
      fin: (codigoFin !== NULO16_GWC) ? {
        mecanismo: FIN_GWC_INV[codigoFin] || 'contador',
        contador: (contadorFin !== NULO16_GWC) ? contadorFin : undefined
      } : null
    };
  }

  /**
   * Bloque 2: tabla de direcciones (4 por sprite, al registro de máscara
   * dentro del contenido) y máscaras (ancho 2, alto 2, ⌈ancho/8⌉ bytes por
   * fila apiladas, bit más significativo a la izquierda, 1 = negro).
   */
  function _leerSpritesGWC(bytes, lector, posicion, nSprites) {
    const bloqueSprites = _abrirBloqueGWC(bytes, lector, posicion, BLOQUE_SPRITES_GWC, 'Sprites');
    const finBloque = bloqueSprites.inicio + bloqueSprites.tam;
    const sprites = [];

    for (let i = 0; i < nSprites; i++) {
      const direccionMascara = lector.u32(bloqueSprites.inicio + i * 4);
      const registro = bloqueSprites.inicio + direccionMascara;
      if (registro + 4 > finBloque) {
        throw new Error('la máscara del sprite ' + i + ' apunta fuera del bloque.');
      }
      const ancho = lector.u16(registro);
      const alto = lector.u16(registro + 2);
      const bytesPorFila = Math.ceil(ancho / 8);
      if (registro + 4 + bytesPorFila * alto > finBloque) {
        throw new Error('la máscara del sprite ' + i + ' desborda el bloque de sprites.');
      }
      const filas = new Uint8Array(bytesPorFila * alto);
      for (let j = 0; j < filas.length; j++) filas[j] = bytes[registro + 4 + j];

      sprites.push({ id: 'img_' + String(i).padStart(3, '0'), ancho: ancho, alto: alto, filas: filas });
    }
    return sprites;
  }

  /**
   * Bloque 3: registros fijos de 32 bytes. Los índices vuelven a ids
   * legibles; el nulo (0xFF) deja el campo sin poner (el GWI no lleva
   * sobras: los defaults no viajan).
   */
  function _leerSegmentosGWC(bytes, lector, posicion, nSegmentos, sprites) {
    const bloqueSegmentos = _abrirBloqueGWC(bytes, lector, posicion, BLOQUE_SEGMENTOS_GWC, 'Segmentos');
    if (bloqueSegmentos.tam < nSegmentos * TAM_REGISTRO_SEGMENTO_GWC) {
      throw new Error('el Bloque 3 declara ' + nSegmentos +
        ' segmento(s) y no caben en su contenido.');
    }
    const segmentos = [];
    for (let i = 0; i < nSegmentos; i++) {
      segmentos.push(leerRegistroDeSegmentoGWC(lector, bloqueSegmentos.inicio + i * TAM_REGISTRO_SEGMENTO_GWC, i, sprites));
    }
    return segmentos;
  }

  /** Un registro de segmento del Bloque 3 como objeto con la forma del editor. */
  function leerRegistroDeSegmentoGWC(lector, inicioRegistro, indice, sprites) {
    const indiceSprite = lector.u8(inicioRegistro + 5);
    const segmento = {
      id: idDeSegmentoGWC(indice),
      x: lector.u16(inicioRegistro + 1),
      y: lector.u16(inicioRegistro + 3),
      sprite: (indiceSprite === NULO_GWC) ? null : sprites[indiceSprite].id,
      tipo: lector.u8(inicioRegistro),
      estado: 0,
      cambiado: 0
    };

    let posicion = inicioRegistro + 6;
    for (const campo of ENLACES_REGISTRO_GWC) {
      const indiceEnlace = lector.u8(posicion++);
      if (indiceEnlace !== NULO_GWC) segmento[campo] = idDeSegmentoGWC(indiceEnlace);
    }

    const salvadoContador = lector.u8(posicion++);
    if (salvadoContador !== NULO_GWC) segmento.salvadoContador = salvadoContador;
    const muerteContador = lector.u8(posicion++);
    if (muerteContador !== NULO_GWC) segmento.muerteContador = muerteContador;

    const propiedades = lector.u8(posicion++);
    if (propiedades & BIT_PRIMER_JUGADOR_GWC) segmento.primero = true;

    const contadorInterno = lector.u8(posicion++);
    if (contadorInterno !== NULO_GWC) segmento.contadorInterno = contadorInterno;
    const valorInicial = lector.u8(posicion++);
    const ruta = lector.u8(posicion++);
    if (ruta !== NULO_GWC) segmento.ruta = ruta;

    if (segmento.tipo === 6) {               // contador: sus propiedades
      segmento.valorInicial = valorInicial;
      if (!(propiedades & BIT_ASCENDENTE_GWC)) segmento.direccion = 'descendente';
      if (!(propiedades & BIT_PRESENTAR_CERO_GWC)) segmento.presentarCero = false;
    }
    return segmento;
  }

  /**
   * Bloque 4 (OPCIONAL): registros de 6 bytes (ticks + 5 índices, huecos
   * a nulo). La v1 lleva UNA Secuencia; si el cartucho trae más, se lee la
   * primera y se avisa. Sin bloque devuelve null.
   */
  function _leerSecuenciasGWC(bytes, lector, posicion, nSecuencias) {
    if (posicion === NULO32_GWC) return null;
    const bloqueSecuencias = _abrirBloqueGWC(bytes, lector, posicion, BLOQUE_SECUENCIAS_GWC, 'Secuencias');
    if (nSecuencias > 1) {
      console.warn('[gwc] el cartucho declara ' + nSecuencias +
        ' Secuencias y la v1 solo entiende una: se carga la primera.');
    }
    if (nSecuencias < 1 || bloqueSecuencias.tam < TAM_REGISTRO_SECUENCIA_GWC) return null;

    const inicio = bloqueSecuencias.inicio;
    const segmentos = [];
    for (let i = 0; i < MAX_SEGMENTOS_SECUENCIA_GWC; i++) {
      const indice = lector.u8(inicio + 1 + i);
      if (indice !== NULO_GWC) segmentos.push(idDeSegmentoGWC(indice));
    }
    return { ticks: lector.u8(inicio), segmentos: segmentos };
  }

  /**
   * Lee un cartucho GWC y reconstruye las listas: valida la cabecera,
   * recorre los bloques en su orden y devuelve estilo, pantalla declarada,
   * color de fondo, configuración, sprites (máscaras), segmentos con sus
   * enlaces resueltos y la Secuencia. Los bloques opcionales ausentes no se
   * echan en falta. Cualquier desviación es un error explícito: un
   * cartucho corrupto NO se carga a medias (la llamada lanza antes de
   * devolver nada y quien llama conserva el cartucho anterior).
   * @param {Uint8Array|ArrayBuffer} datos - Los bytes del GWC.
   * @returns {{estilo:string, pantalla:Object, fondo:string,
   *            pausas:Object, aceleracion:?Object, rutas:Object,
   *            fin:?Object, sprites:Array, segmentos:Array,
   *            secuencia:?Object, checksum:number, codigo:string}} Las
   *            listas y la configuración (codigo: el «#HHHH#» de la cabecera).
   */
  function leerGWC(datos) {
    const bytes = (datos instanceof Uint8Array) ? datos : new Uint8Array(datos);
    const lector = _crearLectorBytes(bytes);

    const cabecera = _validarCabeceraGWC(bytes, lector);
    const generales = _leerDatosGeneralesGWC(bytes, lector);
    const direcciones = generales.direcciones;
    const configuracion = _leerConfiguracionGWC(bytes, lector, direcciones[1]);
    const sprites = _leerSpritesGWC(bytes, lector, direcciones[2], generales.nSprites);
    const segmentos = _leerSegmentosGWC(bytes, lector, direcciones[3], generales.nSegmentos, sprites);
    const secuencia = _leerSecuenciasGWC(bytes, lector, direcciones[4], generales.nSecuencias);

    return {
      estilo: String(generales.estilo),
      resolucion: { ancho: generales.ancho, alto: generales.alto },
      fondo: generales.fondo,
      pausas: configuracion.pausas,
      aceleracion: configuracion.aceleracion,
      rutas: configuracion.rutas,
      fin: configuracion.fin,
      sprites: sprites,
      segmentos: segmentos,
      secuencia: secuencia,
      checksum: cabecera.suma,
      codigo: cabecera.codigo
    };
  }

  // ---------------- API pública ----------------

  return {
    // Lectura (GWB / GWI / genérico por tipo)
    leerCartucho: leerCartucho,
    // Validación despachada por tipo (F5-I9), exportada para prueba aislada
    validarComunes: validarComunes,
    validarGWB: validarGWB,
    validarGWI: validarGWI,
    leerGWB: leerGWB,
    leerGWI: leerGWI,
    abrirPACK: abrirPACK,
    // Grabación (GWI)
    guardarGWI: guardarGWI,
    guardarGWB: guardarGWB,
    // Verificación del diseñador
    verificarCartucho: verificarCartucho,
    // GWC: grabación, lectura y validación
    leerGWC: leerGWC,
    generarGWC: generarGWC,
    validarTopes: validarTopes,
    escalar: escalar,
    indiceDe: indiceDe,
    bloque: bloque,
    estadistica: estadistica,
    // Utilidades compartidas
    leerJSON: leerJSON,
    cargarImagen: cargarImagen,
    cargarDelMapa: cargarDelMapa,
    imagenBlob: imagenBlob,
    revocarURLs: revocarURLs
  };

})();
