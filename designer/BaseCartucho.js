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
//                           obligatoria; img_f e img_m opcionales; estilo:
//                           el cartucho manda, heredado del setup si falta;
//                           teclas de botones válidas, 1/2/3 solo en el
//                           trío A/B/R; F5-I17 M8 + F5-I19).
//   validarGWB              Validación ESPECÍFICA, llama a validarComunes
//   validarGWI              Validación ESPECÍFICA, llama a validarComunes
//   _esColorRGB             ¿Es un color «#RRGGBB»? (ColorFondo, F5-I14).
//   _bytesDeColor           Bytes R, G, B de un «#RRGGBB» (blanco por defecto).
//   _validarTamanoImgS      Avisa si img_s y img_f difieren de tamaño.
//   leerCartucho            Lectura completa: JSON, validación despachada
//                           por tipo e imágenes (F5-I19: sin tipo esperado;
//                           estilo nullable si no hay setup).
//   abrirPACK               Abre un paquete de cartucho (delega en BasePACK.leerPACK).
//
//  Grabación del GWI
//   _nombreBase             Base de los nombres guardados: el nombre del cartucho saneado (F5-I17 M10).
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
//   _montarConfiguracion    Bloque 1: Director y fin (lo no declarado, nulo).
//   _montarSprites          Bloque 2: máscaras de 1 bit escaladas.
//   _montarSegmentos        Bloque 3: registros fijos de 32 bytes.
//   _montarSecuencias       Bloque 4: la Secuencia (opcional).
//   _montarDatosGenerales   Bloque 0: estilo, pantalla, conteos, fondo, reglas, direcciones.
//   _montarCabecera         Cabecera con código «#HHHH#» y tamaño.
//   validarTopes            Comprueba el tope de 255 elementos por índice.
//   _viajanEnGWC            Qué segmentos y sprites viajan al GWC.
//   escalar                 Sprite → máscara de 1 bit escalada a la pantalla.
//                             (F5-I21: exportada; el ajuste de resolución
//                             del editor usa el MISMO redondeo que el GWC.)
//   indiceDe                Id legible → índice de 1 byte (0xFF = nulo).
//   bloque                  Estructura común de un bloque.
//   _crc16                  CRC-16/CCITT-FALSE del cuerpo del GWC (F5-I14).
//   _codigoDeCRC            Retorna el texto del CRC como «#HHHH#».
//   estadistica             Texto con el tamaño final y su desglose.
//
//  Lectura del GWC (autocontenida)
//   leerGWC                 Valida y reconstruye listas y configuración.
//   _crearLectorBytes       
//   _validarCabeceraGWC 
//   _abrirBloqueGWC
//   _leerDatosGeneralesGWC  
//   _mecanismoDeFin         Código de fin → mecanismo (error si es desconocido).
//   _leerConfiguracionGWC 
//   _leerSpritesGWC
//   _leerSegmentosGWC
//   _leerSecuenciasGWC      Un paso de la lectura cada una.
//
//  Otras funciones internas (lista completada en F5-I14)
//   _crearURL                     Crea una object URL para un fichero y la anota para revocarla al li…
//   _leerJSONsLegibles            Lee todos los .json indicados; los que no se puedan leer se saltan…
//   _elegirPorPrioridad           Elige el JSON de mayor prioridad de tipo (GWC > GWI > GWB).
//   _describirTiposEncontrados    Texto que dice exactamente qué «tipo» declara cada JSON leído (nada…
//   _lineaDeCampo                 Línea JSON de un campo simple: `  "clave": valor`.
//   _lineaDeLista                 Lista con UNA línea por elemento (sprites, segmentos, botones...).
//   _lineaDeAutoria               Sección de autoría: historial a una línea por acción + contador.
//   _lineasOpcionales             Líneas de los campos opcionales que el GWI sí trae.
//   _verificarReferenciasColgantesUn enlace que no resuelve a NINGÚN grupo existente es un ERROR bloq…
//   _verificarInversosDeDireccionesInverso de las direcciones del jugador:
//   _verificarInversoDeUnaDireccionComprueba (y completa si falta) el inverso de UNA dirección de un j…
//   _verificarInversosDeColision  Inverso de la colisión:
//   _verificarSegmentosUnoAUno    Revisa cada segmento según su tipo.
//   _verificarEnlacesPropios      Los enlaces del tipo deben apuntar a un segmento que exista y que n…
//   _verificarCadenaDeRuta        Avisos sobre cadenas: inicios que no llevan a ningún sitio, contado…
//   _verificarJugador             Todo jugador necesita ALGUNA dirección (sin ninguna es imposible de…
//   _verificarColisionDeclarada   Colisiones:
//   _verificarDigito              Dígito: las SIETE barras (barra_a..g) puestas y de tipo juego.
//   _verificarContador            Contador:
//   _verificarAdicional           Tipos adicionales (fuera del juego):
//   _recogerApuntadosPorCadena    Raíces de todos los grupos a los que alguna cadena (siguiente/salva…
//   _verificarAcompanantes        Acompañantes:
//   _completarInversoDeAcompananteCalcula B.mostradoJunto = A si falta; avisa si apunta a otro.
//   _verificarReglasDeSecundario  Solo tipo juego, sin cadena ni colisión, que nadie lo apunte y que…
//   _retirarAcompanantesHuerfanos Un «mostrado junto a» cuyo principal ya no lo apunta se retira (com…
//   _verificarBarrasDeDigitos     Las barras no se comparten entre dígitos (error) y no participan en…
//   _verificarDigitosDeContadores Un dígito solo puede ser posición de UN contador (si no, dos contad…
//   _verificarFichaDeCartucho     Debe haber exactamente UNA ficha de cartucho y con mecanismo de fin…
//   _verificarMecanismoDeFin      Coherencia del mecanismo de fin con lo que el cartucho tiene en pan…
//   _verificarFinPorContador      Fin por contador:
//   _verificarSecuenciaDeCartucho Secuencia: cada segmento existe y es juego/inicio/adicional; con se…
//   _verificarDirectorDeCartucho  Campos del Director:
//   _verificarJugadoresYRutas     Al menos UN jugador (sin él no hay partida: bloqueante) y al menos…
//   _byteDe                       Un byte como array.
//   _u16LE                        uint16 little-endian como array de 2 bytes.
//   _u32LE                        uint32 little-endian como array de 4 bytes.
//   _textoGWC                     Texto ASCII como array de bytes.
//   _concatenar                   Concatena varios arrays/Uint8Array en un único Uint8Array.
//   _numeroODefecto               Valor numérico o su valor por defecto si falta (undefined/null).
//   _byteOpcional                 Un campo opcional del GWI como byte:
//   _escalasDePantalla            Escala por eje de la imagen fuente a la pantalla declarada.
//   _pixelesDeSprite              Píxeles RGBA de un sprite (canvas del editor, o Image pasada por un…
//   _propiedadesDeSegmento        Byte de propiedades de un segmento:
//   _idDeSegmentoGWC              Id legible de un segmento a partir de su índice.
//   _leerRegistroDeSegmentoGWC    Un registro de segmento del Bloque 3 como objeto con la forma del e…
//
//  Límites de campos por fichero (F5-I16)
//   revisarValores          Limita en memoria los campos de un fichero (GWB, GWI, GWC o GWS) con su tabla y devuelve los avisos.
//   limitarValor            Un valor numérico acotado a [mínimo, máximo]; no toca nulos ni no numéricos.
//   _aplicarLimite          Aplica un límite de la tabla a un campo de un objeto y compone el aviso.
//   _avisosDeResolucion     Validación BLOQUEANTE de la resolución (M5, F5-I16): fuera de 320×240..1024×600 el fichero no carga ni se genera.
//
//  Memoria del hardware (F5-I20, MA02): campo opcional «memoria» {RAM, FLASH} en KB
//   memoriaNoCero           Solo los subcampos válidos y distintos de 0 de una «memoria» (o null): lo que se serializa.
//   memoriaEfectiva         La memoria que vale para un cartucho: la suya por subcampo, o la del setup.
//   ocupacionMemoria        Texto «RAM: 4 de 216 KB (2 %) · FLASH: …» de lo usado frente a la memoria efectiva (null si no hay memoria).
//   _revisarMemoria         Avisa de los subcampos inválidos de «memoria», los trata como 0 y quita los ceros.
//   _memoriaValida          true si un subcampo es un entero ≥ 0.
// ====================================================================================================

var BaseCartucho = (function () {

  // ---------------- Estado privado ----------------

  let urlsCreadas = [];  // object URLs creadas al cargar, para revocarlas

  // Tipos de JSON de cartucho. El autor declara en qué estado está cada fichero.
  // F5-I19 (R07-B): 'GWC' fuera de los tipos JSON: un GWC es un fichero
  // binario (.gwc), nunca un JSON validable aquí.
  const TIPOS_CARTUCHO = ['GWB', 'GWI'];

  // Orden de prioridad al elegir qué .json cargar de una carpeta.
  const PRIORIDAD_TIPOS = ['GWC', 'GWI', 'GWB'];

  // Tipo numérico de los fantasmas de unión (solo informativos en el GWI).
  const TIPO_FANTASMA = 99;
  const TIPO_VIDA_GWC = 3;      // iconos de vida y de muerte (ComunListas.tipos)
  const TIPO_MUERTE_GWC = 4;

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
  function _crearURL(fichero) {
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
      imagen.src = _crearURL(fichero);
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
  function imagenBlob(imagen, ancho, alto) {
    const lienzo = document.createElement('canvas');
    lienzo.width = ancho > 0 ? ancho : imagen.naturalWidth;
    lienzo.height = alto > 0 ? alto : imagen.naturalHeight;
    lienzo.getContext('2d').drawImage(imagen, 0, 0, lienzo.width, lienzo.height);
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
  async function _leerJSONsLegibles(mapa, nombres) {
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
  function _elegirPorPrioridad(leidos) {
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
  function _describirTiposEncontrados(leidos) {
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
    // F5-I17 (M11): el GWS viaja como .gws; el .json sigue admitido
    // (compatibilidad con los cartuchos de antes del cambio).
    const nombres = Array.from(mapa.keys())
      .filter(n => /\.(json|gws)$/i.test(n));
    if (nombres.length === 0) throw new Error('la carpeta no contiene ningún .json/.gws.');

    const leidos = await _leerJSONsLegibles(mapa, nombres);
    if (leidos.length === 0) throw new Error('ningún .json de la carpeta se ha podido leer.');

    const elegido = _elegirPorPrioridad(leidos);
    if (!elegido) {
      throw new Error('ningún .json de la carpeta declara un "tipo" válido ' +
        '(GWB, GWI o GWC). Encontrados: ' + _describirTiposEncontrados(leidos) + '.');
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
   * tipo no se asume nada. F5-I19: el cartucho cargado MANDA — si
   * declara "estilo"/"resolucion", la máquina se re-ajusta a él
   * (la comparación con el estilo del setup se RETIRA); si no lo
   * declara, heredan del setup vigente, y para eso SÍ importa si
   * hay una máquina previa: sin ella, un GWB debe declararlas.
   * Contrato común de GWB y GWI en las imágenes de pantalla: img_s
   * OBLIGATORIA (y su fichero presente); img_f e img_m OPCIONALES,
   * pero si se declaran sus ficheros deben estar (el GWC se valida
   * en leerGWC). La regla «combinar» (F3-I1) es opcional en ambos
   * y debe ser booleana.
   * @param {Object} json - JSON del cartucho.
   * @param {Map<string,File>} mapa - Mapa nombre → File de la carpeta.
   * @param {?string} estiloMaquina - Estilo del setup cargado, o null
   *   si no hay máquina previa (F5-I19: carga sin setup).
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
    // estilo: OPCIONAL en el GWB (si falta, se HEREDA del setup vigente:
    // el cartucho manda, la máquina se re-ajusta, F5-I19); en el GWI viaja
    // siempre (el GWI es autosuficiente). Sin setup previo, un GWB debe
    // declararlo: es lo que construye la máquina derivada.
    if (json.estilo === undefined || json.estilo === null) {
      if (json.tipo === 'GWI') {
        return 'el GWI necesita un "estilo" de máquina válido.';
      }
      if (estiloMaquina === undefined || estiloMaquina === null) {
        return 'el GWB necesita declarar "estilo" si no hay una máquina ' +
          'previa: cargue un setup (GWS) o un cartucho que lo incluya (F5-I19).';
      }
    } else {
      if (typeof json.estilo !== 'string' || json.estilo === '') {
        return 'el "estilo" del cartucho no es válido.';
      }
    }
    // ColorFondo (F5-I14): OPCIONAL, '#RRGGBB'. Es el fondo de la pantalla
    // cuando el cartucho no tiene img_f (blanco si falta).
    if (json.ColorFondo !== undefined && json.ColorFondo !== null &&
      !_esColorRGB(json.ColorFondo)) {
      return 'el "ColorFondo" del cartucho debe ser un color "#RRGGBB".';
    }
    // combinar (F3-I1): OPCIONAL, booleano. Es la fuente del bit de
    // Reglas del Bloque 0 del GWC; en el GWB llega como extra conservado
    // y en el GWI viaja al nivel superior (solo si está activa).
    if (json.combinar !== undefined && json.combinar !== null &&
      typeof json.combinar !== 'boolean') {
      return 'la regla "combinar" del cartucho debe ser un booleano.';
    }
    // descripcion (F5-I17, M13): OPCIONAL, cadena (no vacía a efectos de
    // escritura; aquí basta con el tipo). Igual significado en GWS, GWB
    // y GWI; el GWC no la lleva (binario, sin textos).
    if (json.descripcion !== undefined && json.descripcion !== null &&
      typeof json.descripcion !== 'string') {
      return 'el campo "descripcion" del cartucho debe ser una cadena.';
    }
    // resolucion {ancho, alto}: OPCIONAL en el GWB; OBLIGATORIA en el GWI,
    // que debe poder cargarse sin un setup previo. Es INFORMATIVA (F5-I14):
    // la que manda es la del Setup (el hardware); si difiere se escala y
    // solo hay aviso por consola (no bloquea).
    if (json.resolucion === undefined || json.resolucion === null) {
      if (json.tipo === 'GWI') {
        return 'el GWI necesita "resolucion" {ancho, alto}.';
      }
      if (estiloMaquina === undefined || estiloMaquina === null) {
        return 'el GWB necesita declarar "resolucion" si no hay una máquina ' +
          'previa: cargue un setup (GWS) o un cartucho que la incluya (F5-I19).';
      }
    } else {
      const r = json.resolucion;
      const entero = v => Number.isInteger(v) && v > 0;
      if (typeof r !== 'object' || Array.isArray(r) || !entero(r.ancho) || !entero(r.alto)) {
        return 'la "resolucion" del cartucho debe ser {ancho, alto} con enteros positivos.';
      }
      // F5-I16 (M5): fuera del rango de pantallas es ERROR bloqueante
      // (se conserva el fichero anterior): una resolución mala arrastra
      // el problema a todo lo construido sobre ella.
      if (r.ancho < PANTALLA_MIN.ancho || r.alto < PANTALLA_MIN.alto ||
        r.ancho > PANTALLA_MAX.ancho || r.alto > PANTALLA_MAX.alto) {
        return 'la "resolucion" del cartucho (' + r.ancho + 'x' + r.alto +
          ') está fuera del rango de pantallas (' + PANTALLA_MIN.ancho + 'x' +
          PANTALLA_MIN.alto + ' a ' + PANTALLA_MAX.ancho + 'x' + PANTALLA_MAX.alto + ').';
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
    // F5-I17 (M8): la tecla del cartucho (botones[].tecla) sigue la misma
    // regla que la del GWS: letra A..Z o nombre de cursor (el dígito
    // 1/2/3 solo en el trío de sistema A/B/R) y sin repetir entre los
    // botones declarados.
    if (Array.isArray(json.botones)) {
      const teclasVistas = new Set();
      for (const b of json.botones) {
        if (!b || typeof b !== 'object' || b.tecla === undefined ||
          b.tecla === null || b.tecla === '') continue;
        if (typeof BaseDirector === 'undefined' || !BaseDirector.teclaValida) continue;
        if (!BaseDirector.teclaValida(String(b.tecla), b.numero)) {
          return 'la "tecla" del botón ' + b.numero + ' del cartucho debe ser '
            + 'una letra A..Z o un nombre de cursor (cursor-izquierda/derecha/arriba/abajo);'
            + ' el dígito 1/2/3 solo vale en el trío de sistema A/B/R.';
        }
        const t = BaseDirector.normalizarTecla(String(b.tecla));
        if (teclasVistas.has(t)) {
          return 'la tecla "' + String(b.tecla) + '" está repetida en los botones del cartucho.';
        }
        teclasVistas.add(t);
      }
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

  // (F5-I19, R07-B: se retira cargarDelMapa: era solo una resolución de
  // ruta de dos líneas, muerta fuera de aquí.)

  /**
   * ¿Es un color «#RRGGBB»?
   * @param {*} valor - Valor a comprobar.
   * @returns {boolean} true si es un texto «#RRGGBB» (hexadecimal).
   */
  function _esColorRGB(valor) {
    return typeof valor === 'string' && /^#[0-9A-Fa-f]{6}$/.test(valor);
  }

  /**
   * Bytes R, G, B de un color «#RRGGBB» (blanco si no es válido o falta).
   * @param {?string} color - Color «#RRGGBB».
   * @returns {number[]} [R, G, B].
   */
  function _bytesDeColor(color) {
    const c = _esColorRGB(color) ? color : COLOR_FONDO_DEFECTO;
    return [parseInt(c.slice(1, 3), 16), parseInt(c.slice(3, 5), 16), parseInt(c.slice(5, 7), 16)];
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
   * JSON prioritario, validación DESPACHADA por tipo y las imágenes
   * (img_f OPCIONAL: null si el cartucho no la declara; img_s e img_m
   * si están). Cada fichero solo necesita ".name" y comportarse como
   * Blob. F5-I19: sin tipo esperado (el contenido manda) y el estilo de
   * la máquina es nullable (null: no hay setup; la validación exige que
   * el cartucho sea autosuficiente).
   * @param {Array<Blob>} ficheros - Ficheros del cartucho (carpeta o paquete).
   * @param {?string} estiloMaquina - Estilo del setup vigente, o null si
   *   no hay máquina previa (F5-I19).
   * @returns {Promise<{nombre:string, json:Object, mapa:Map,
   *                     imgF:?HTMLImageElement, imgS:?HTMLImageElement,
   *                     imgM:Promise<?HTMLImageElement>}>} Cartucho leído.
   */
  async function leerCartucho(ficheros, estiloMaquina) {
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

    // F5-I19: sin "tipo esperado": cualquier tipo válido carga — la
    // pestaña de carga admite todo y el tipo lo decide el contenido.

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

    // img_s: base de la geometría (F5-I19, R07-B: se retira el fantasma
    // "json.img_s" de la raíz — solo vale "imagenes.img_s").
    const imgS = await _cargarImagenAux(mapa, json.imagenes.img_s);
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

  // (F5-I19, R07-B: se retiran leerGWB y leerGWI: solo delegaban en
  // leerCartucho con el "tipo esperado" de un botón que ya no existe.)

  // ---------------- Grabación del GWI ----------------

  // Campos del nivel superior del GWI que solo se escriben si existen
  // (un GWI sin ellos usa los valores por defecto del motor).
  const CAMPOS_OPCIONALES_GWI = ['fin', 'secuencia', 'pausas', 'aceleracion', 'rutas'];

  /** Línea JSON de un campo simple: `  "clave": valor`. */
  function _lineaDeCampo(clave, valor) {
    return '  "' + clave + '": ' + JSON.stringify(valor);
  }

  /** Lista con UNA línea por elemento (sprites, segmentos, botones...). */
  function _lineaDeLista(clave, lista) {
    if (!lista || lista.length === 0) return '  "' + clave + '": []';
    return '  "' + clave + '": [\n' +
      lista.map(elemento => '    ' + JSON.stringify(elemento)).join(',\n') +
      '\n  ]';
  }

  /** Sección de autoría: historial a una línea por acción + contador. */
  function _lineaDeAutoria(autoria) {
    return '  "autoria": {\n' +
      _lineaDeLista('cambios', autoria.cambios).replace('  ', '    ') + ',\n' +
      '    "ultimoOp": ' + JSON.stringify(autoria.ultimoOp) + '\n' +
      '  }';
  }

  /** Líneas de los campos opcionales que el GWI sí trae. */
  function _lineasOpcionales(json) {
    return CAMPOS_OPCIONALES_GWI
      .filter(campo => json[campo])
      .map(campo => _lineaDeCampo(campo, json[campo]));
  }

  /**
   * Serializa el GWI en JSON legible pero COMPACTO: los arrays largos
   * (sprites y segmentos) van a UNA línea por elemento, el resto de campos
   * también. Con muchos segmentos se pasa de 2500 líneas a unas centenas.
   * @param {Object} json - GWI completo (tal como se guardaría).
   * @returns {string} Texto JSON del GWI.
   */
  function _formatearGWI(json) {
    // El código del par (CRC del GWC) solo si existe.
    const lineaCodigoGWC = (json.codigoGWC !== undefined && json.codigoGWC !== null)
      ? [_lineaDeCampo('codigoGWC', json.codigoGWC)] : [];

    // imagenes TAL CUAL (decisión del cierre de la F5-I9): el GWI es el
    // contenedor intermedio y debe ser AUTOSUFICIENTE — declara todo lo
    // que el GWB declara, incluso redundante, y _guardarGWIEnDisco incluye
    // en el paquete cada imagen declarada (img_m incluida). Si se declarara
    // sin viajar, el GWI generado no cargaría: contrato de entrada.
    const imagenesGWI = json.imagenes;

    const lineas = [
      _lineaDeCampo('tipo', json.tipo),
      _lineaDeCampo('version', json.version),
      ...lineaCodigoGWC,
      _lineaDeCampo('nombre', json.nombre),
      ...(json.descripcion ? [_lineaDeCampo('descripcion', json.descripcion)] : []),   // F5-I17 (M13)
      _lineaDeCampo('estilo', json.estilo),
      _lineaDeCampo('resolucion', json.resolucion),
      ...(_esColorRGB(json.ColorFondo) ? [_lineaDeCampo('ColorFondo', json.ColorFondo)] : []),
      ...(memoriaNoCero(json.memoria) ? [_lineaDeCampo('memoria', memoriaNoCero(json.memoria))] : []),
      _lineaDeCampo('imagenes', imagenesGWI),
      // Regla «combinar» (F3-I1): solo si está activa (falsy fuera: es
      // el valor por defecto). El GWC toma su bit de Reglas de aquí.
      ...(json.combinar ? [_lineaDeCampo('combinar', json.combinar)] : []),
      ..._lineasOpcionales(json),
      _lineaDeLista('botones', json.botones),
      _lineaDeLista('sprites', json.sprites),
      _lineaDeLista('segmentos', json.segmentos),
      _lineaDeAutoria(json.autoria)
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
    // F5-I17 (M13): la descripción viaja a nivel superior si no está vacía
    // (mismo significado que en el GWS; el GWC no lleva textos).
    const lineas = [
      _lineaDeCampo('tipo', 'GWB'),
      _lineaDeCampo('version', json.version),
      _lineaDeCampo('nombre', json.nombre)
    ];
    if (json.descripcion) lineas.push(_lineaDeCampo('descripcion', json.descripcion));   // F5-I17 (M13)
    if (json.estilo) lineas.push(_lineaDeCampo('estilo', json.estilo));
    if (json.resolucion) lineas.push(_lineaDeCampo('resolucion', json.resolucion));
    if (_esColorRGB(json.ColorFondo)) lineas.push(_lineaDeCampo('ColorFondo', json.ColorFondo));
    if (memoriaNoCero(json.memoria)) lineas.push(_lineaDeCampo('memoria', memoriaNoCero(json.memoria)));
    lineas.push(_lineaDeCampo('imagenes', json.imagenes));
    for (const campo of ['combinar', 'etiquetas']) {
      if (json[campo]) lineas.push(_lineaDeCampo(campo, json[campo]));
    }
    lineas.push(_lineaDeLista('botones', json.botones || []));
    return '{\n' + lineas.join(',\n') + '\n}';
  }

  /**
   * Base del nombre de los ficheros guardados (F5-I17, M10): el nombre
   * del cartucho en el JSON, saneado para el disco (caracteres
   * inválidos en Windows a "_"), en lugar del genérico "cartucho".
   * Obliga a tener el nombre antes de guardar.
   * @param {Object} json - El JSON del cartucho.
   * @returns {string} Base SIN extensión (p. ej. "Parachute").
   */
  function _nombreBase(json) {
    return String((json && json.nombre) || '')
      .replace(/[\\/:*?"<>|]/g, '_').trim() || 'cartucho';
  }

  /**
   * Guarda el GWI en un paquete descargable (el nombre del cartucho +
   * _GWI, F5-I17 M10). Avisa al empezar y bloquea el botón «Guardar»
   * mientras dura: el guardado es asíncrono y sin esto podría lanzarse
   * un segundo guardado solapado.
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
    // F5-I16: límites asentados antes de escribir (doble filtro deliberado).
    const avisosLimites = revisarValores('GWI', json);
    const entradas = [];                  // {nombre, contenido} del paquete

    for (const sprite of sprites) {
      const png = await new Promise(resolver => sprite.imagen.toBlob(resolver, 'image/png'));
      entradas.push({ nombre: 'segmentos/' + sprite.id + '.png', contenido: png });
    }

    const referenciaImgS = (json.imagenes && json.imagenes.img_s) || json.img_s || null;
    const referenciaImgF = (json.imagenes && json.imagenes.img_f) || null;
    if (imgF && referenciaImgF) {
      // F5-I14: en el GWI el fondo va SIEMPRE al tamaño del Setup (el GWB
      // conserva el original).
      const pantalla = BaseDirector.pantallaDeSetup();
      entradas.push({
        nombre: referenciaImgF,
        contenido: await imagenBlob(imgF, pantalla ? pantalla.ancho : 0, pantalla ? pantalla.alto : 0)
      });
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
    const base = _nombreBase(json);            // F5-I17 (M10): el nombre manda
    entradas.push({ nombre: base + '_GWI.json', contenido: _formatearGWI(json) });

    const tamano = await BasePACK.guardarPACK(entradas, base + '_GWI');

    BaseDirector.avisar('GWI guardado en ' + BasePACK.nombreFichero(base + '_GWI') + ': ' + sprites.length +
      ' imagen(es) en segmentos/ + ' + base + '_GWI.json en la raíz' +
      (nAvisos ? ' · con ' + nAvisos + ' aviso(s)' : '') + '.' +
      (avisosLimites.length > 0 ? ' ' + avisosLimites.join(' ') : ''));
    return tamano;
  }

  /**
   * Guarda el cartucho de autoría GWB como paquete descargable
   * (el nombre del cartucho + _GWB, F5-I17 M10), F5-I10: la misma vía del GWI, porque un
   * navegador no puede escribir una carpeta de disco. El paquete lleva el
   * JSON en la raíz (nombre_GWB.json) y las imágenes de pantalla
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
      const base = _nombreBase(json);          // F5-I17 (M10): el nombre manda
      entradas.push({ nombre: base + '_GWB.json', contenido: _formatearGWB(json) });
      const tamano = await BasePACK.guardarPACK(entradas, base + '_GWB');
      BaseDirector.avisar('GWB guardado en ' + BasePACK.nombreFichero(base + '_GWB') + ' (JSON + ' +
        'imágenes de pantalla). Cárgalo por la pestaña Carga (F5-I19).');
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
  // historial (marcados «auto») a través de ctx.registrarCambioDerivado.
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

    _verificarReferenciasColgantes(ctx, hallazgos);
    _verificarInversosDeDirecciones(ctx, hallazgos);
    _verificarInversosDeColision(ctx, hallazgos);
    ctx.reconstruir();                       // los inversos calculados ya cuentan

    _verificarSegmentosUnoAUno(ctx, hallazgos);
    _verificarAcompanantes(ctx, hallazgos);
    _verificarBarrasDeDigitos(ctx, hallazgos);
    _verificarDigitosDeContadores(ctx, hallazgos);

    const fichas = ctx.grupos.filter(g => g.prop.tipo === 'cartucho');
    _verificarFichaDeCartucho(ctx, hallazgos, fichas);
    // Secuencia y Director viven en la ficha: solo se revisan si hay UNA.
    const ficha = (fichas.length === 1) ? fichas[0] : null;
    if (ficha) {
      _verificarSecuenciaDeCartucho(ctx, hallazgos, ficha.prop);
      _verificarDirectorDeCartucho(hallazgos, ficha.prop);
    }

    _verificarJugadoresYRutas(ctx, hallazgos);
    return hallazgos;
  }

  // ----- Referencias e inversos -----

  /**
   * Un enlace que no resuelve a NINGÚN grupo existente es un ERROR
   * bloqueante (referencia colgante): nunca en silencio.
   */
  function _verificarReferenciasColgantes(ctx, hallazgos) {
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
  function _verificarInversosDeDirecciones(ctx, hallazgos) {
    for (const grupo of ctx.grupos) {
      for (const direccion of ctx.ENLACES_JUGADOR) {
        _verificarInversoDeUnaDireccion(ctx, hallazgos, grupo, direccion);
      }
    }
  }

  /** Comprueba (y completa si falta) el inverso de UNA dirección de un jugador. */
  function _verificarInversoDeUnaDireccion(ctx, hallazgos, origen, direccion) {
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
      ctx.registrarCambioDerivado(destino.raiz, { [inverso]: origen.raiz }, { [inverso]: null });
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
  function _verificarInversosDeColision(ctx, hallazgos) {
    for (const grupo of ctx.grupos) {
      const props = ctx.propsDe(grupo.raiz);
      if (props.colision === null) continue;

      const jugador = ctx.grupoDeComp(props.colision);
      if (!jugador) continue;                // ya reportado como colgante

      const propsJugador = ctx.propsDe(jugador.raiz);
      if (propsJugador.tipo !== 'jugador') continue;   // se reporta luego como error

      if (propsJugador.colisionDe === null) {
        propsJugador.colisionDe = grupo.raiz;
        ctx.registrarCambioDerivado(jugador.raiz, { colisionDe: grupo.raiz }, { colisionDe: null });
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
  function _verificarSegmentosUnoAUno(ctx, hallazgos) {
    for (const grupo of ctx.grupos) {
      if (grupo.absorbido) continue;
      _verificarEnlacesPropios(ctx, hallazgos, grupo);
      _verificarCadenaDeRuta(ctx, hallazgos, grupo);
      _verificarJugador(ctx, hallazgos, grupo);
      _verificarColisionDeclarada(ctx, hallazgos, grupo);
      _verificarDigito(ctx, hallazgos, grupo);
      _verificarContador(ctx, hallazgos, grupo);
      _verificarAdicional(ctx, hallazgos, grupo);
    }
  }

  /** Los enlaces del tipo deben apuntar a un segmento que exista y que no sea él mismo. */
  function _verificarEnlacesPropios(ctx, hallazgos, grupo) {
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
  function _verificarCadenaDeRuta(ctx, hallazgos, grupo) {
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
  function _verificarJugador(ctx, hallazgos, grupo) {
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
  function _verificarColisionDeclarada(ctx, hallazgos, grupo) {
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
  function _verificarDigito(ctx, hallazgos, grupo) {
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
  function _verificarContador(ctx, hallazgos, grupo) {
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
    if (Number(props.valorInicial) > 255) {
      hallazgos.errores.push(id + ': el valor inicial (' + props.valorInicial + ') no cabe en 1 byte del GWC (máximo 255).');
    }
  }

  /**
   * Tipos adicionales (fuera del juego): su «siguiente» solo apunta a otro
   * adicional/inicioAdicional; un inicioAdicional EXIGE siguiente (nace
   * encendido y avanza en su bucle); y no declaran colisión.
   */
  function _verificarAdicional(ctx, hallazgos, grupo) {
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
  function _recogerApuntadosPorCadena(ctx) {
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
  function _verificarAcompanantes(ctx, hallazgos) {
    const apuntadosPorCadena = _recogerApuntadosPorCadena(ctx);
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
      _completarInversoDeAcompanante(ctx, hallazgos, principal, secundario);
      _verificarReglasDeSecundario(ctx, hallazgos, secundario, apuntadosPorCadena);
    }
    _retirarAcompanantesHuerfanos(ctx, principalDeSecundario);
  }

  /** Calcula B.mostradoJunto = A si falta; avisa si apunta a otro. */
  function _completarInversoDeAcompanante(ctx, hallazgos, principal, secundario) {
    const propsSecundario = ctx.propsDe(secundario.raiz);
    if (propsSecundario.mostradoJunto === null) {
      propsSecundario.mostradoJunto = principal.raiz;
      ctx.registrarCambioDerivado(secundario.raiz, { mostradoJunto: principal.raiz }, { mostradoJunto: null });
      console.info('[verificar] ' + ctx.segId(secundario) + '.mostradoJunto = ' +
        ctx.segId(principal) + ' (calculado).');
    } else if (propsSecundario.mostradoJunto !== principal.raiz) {
      hallazgos.avisos.push(ctx.segId(principal) + '.mostrarJunto = ' + ctx.segId(secundario) +
        ' pero ' + ctx.segId(secundario) + '.mostradoJunto = ' +
        ctx.resolverEnlace(propsSecundario.mostradoJunto) + ' (incoherentes).');
    }
  }

  /** Solo tipo juego, sin cadena ni colisión, que nadie lo apunte y que no sea principal a la vez. */
  function _verificarReglasDeSecundario(ctx, hallazgos, secundario, apuntadosPorCadena) {
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
  function _retirarAcompanantesHuerfanos(ctx, principalDeSecundario) {
    for (const grupo of ctx.grupos) {
      if (grupo.prop.mostradoJunto === null) continue;
      if (principalDeSecundario.has(grupo.raiz)) continue;

      const principalAnterior = ctx.grupoDeComp(grupo.prop.mostradoJunto);
      ctx.propsDe(grupo.raiz).mostradoJunto = null;
      ctx.registrarCambioDerivado(grupo.raiz, { mostradoJunto: null },
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
  function _verificarBarrasDeDigitos(ctx, hallazgos) {
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
  function _verificarDigitosDeContadores(ctx, hallazgos) {
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
  function _verificarFichaDeCartucho(ctx, hallazgos, fichas) {
    if (fichas.length === 0) {
      hallazgos.errores.push('Falta el segmento de cartucho: un cartucho sin su ficha no puede ejecutarse.');
      return;
    }
    if (fichas.length > 1) {
      hallazgos.errores.push('Hay ' + fichas.length + ' segmentos de cartucho: debe haber exactamente uno.');
      return;
    }
    _verificarMecanismoDeFin(ctx, hallazgos, fichas[0].prop);
  }

  /** Coherencia del mecanismo de fin con lo que el cartucho tiene en pantalla. */
  function _verificarMecanismoDeFin(ctx, hallazgos, propsFicha) {
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
      _verificarFinPorContador(ctx, hallazgos, propsFicha, hayVida || hayMuerte);
    }
  }

  /**
   * Fin por contador: excluyente con los iconos; el contador elegido debe
   * existir en pantalla, ser descendente y no empezar en cero (empezar en
   * 0 = la partida nunca termina).
   */
  function _verificarFinPorContador(ctx, hallazgos, propsFicha, hayIconos) {
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
  function _verificarSecuenciaDeCartucho(ctx, hallazgos, propsFicha) {
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
    if (haySecuencia && Number(propsFicha.secTicks) > 255) {
      hallazgos.errores.push('Los ticks de la Secuencia (' + propsFicha.secTicks +
        ') no caben en 1 byte del GWC (máximo 255).');
    }
  }

  /**
   * Campos del Director: la aceleración se declara COMPLETA o nada; un
   * mínimo por encima de la pausa del simulador es un AVISO (no tendría
   * efecto en PC); el resto de números, si están, deben ser >= 1.
   */
  function _verificarDirectorDeCartucho(hallazgos, propsFicha) {
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
    // El GWC guarda estos campos en 2 bytes (0xFFFF es «sin valor»): un
    // valor mayor se recortaría sin avisar.
    const campos16 = { pausaSim: 'La pausa del simulador', pausaEsp: 'La pausa del sistema externo',
      accCada: 'Los ticks entre reducciones', accResta: 'La reducción de la aceleración',
      accMinimo: 'La pausa mínima', aumentarCada: 'El Nº para aumentar rutas' };
    for (const [campo, texto] of Object.entries(campos16)) {
      if (propsFicha[campo] !== null && Number(propsFicha[campo]) > 65534) {
        hallazgos.errores.push(texto + ' (' + propsFicha[campo] + ') no cabe en 2 bytes del GWC (máximo 65534).');
      }
    }
  }

  /** Al menos UN jugador (sin él no hay partida: bloqueante) y al menos un inicio de ruta (aviso). */
  function _verificarJugadoresYRutas(ctx, hallazgos) {
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
  const COLOR_FONDO_DEFECTO = '#FFFFFF';   // fondo si el cartucho no declara ColorFondo
  const CRC16_POLINOMIO = 0x1021;          // CRC-16/CCITT-FALSE: polinomio,
  const CRC16_INICIAL = 0xFFFF;            // valor inicial (sin reflejar, sin xor final)

  // Tamaños fijos del formato.
  const TAM_CABECERA_GWC = 14;
  const TAM_CABECERA_BLOQUE_GWC = 5;          // tipo (1) + tamaño del contenido (4)
  const TAM_CONTENIDO_DATOS_GWC = 36;         // Bloque 0 (F5-I14: + byte de reglas)
  const TAM_CONTENIDO_CONFIG_GWC = 16;        // Bloque 1: 8 valores uint16 (F5-I14: el 08 queda libre)
  const BIT_REGLA_COMBINAR_GWC = 0x01;        // Bloque 0, byte de reglas, bit 0: regla «combinar»
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

  // Límites de campos por fichero (F5-I16): la UI recorta al práctico
  // (Max.GWI) y la verificación conserva lo del formato (Max.GWC) como
  // red de seguridad. Como al cargar ya se recorta al práctico, el
  // filtro del guardado no debería activarse nunca: es la red ante un
  // cambio futuro que no contemple los límites (duplicidad DELIBERADA).
  const MAX_PUERTO_GWS = 99;                 // pin de botón del setup (F5-I16)
  const PANTALLA_MIN = { ancho: 320, alto: 240 };   // fuera de este rango:
  const PANTALLA_MAX = { ancho: 1024, alto: 600 };  // solo aviso, no recorte
  const TABLA_LIMITES = [
    { campo: 'pausas.simulador', ruta: ['pausas', 'simulador'], min: 1, maxGWI: 999, maxGWC: 65534 },
    { campo: 'pausas.externo', ruta: ['pausas', 'externo'], min: 1, maxGWI: 999, maxGWC: 65534 },
    { campo: 'aceleracion.cada', ruta: ['aceleracion', 'cada'], min: 1, maxGWI: 99, maxGWC: 65534 },
    { campo: 'aceleracion.resta', ruta: ['aceleracion', 'resta'], min: 1, maxGWI: 999, maxGWC: 65534 },
    { campo: 'aceleracion.minimo', ruta: ['aceleracion', 'minimo'], min: 0, maxGWI: 999, maxGWC: 65534 },
    { campo: 'rutas.aumentarCada', ruta: ['rutas', 'aumentarCada'], min: 1, maxGWI: 99, maxGWC: 65534 },
    { campo: 'fin.contador', ruta: ['fin', 'contador'], min: 1, maxGWI: 4, maxGWC: 4 },
    { campo: 'secuencia.ticks', ruta: ['secuencia', 'ticks'], min: 1, maxGWI: 99, maxGWC: 255 },
    { campo: 'valorInicial', segmento: 'valorInicial', min: 0, maxGWI: 255, maxGWC: 255 },
    { campo: 'contadorInterno', segmento: 'contadorInterno', min: 1, maxGWI: 4, maxGWC: 4 }
  ];

  // Tipos de bloque.
  const BLOQUE_DATOS_GWC = 0;        // Datos Generales (SIEMPRE)
  const BLOQUE_CONFIG_GWC = 1;       // Configuración (SIEMPRE)
  const BLOQUE_SPRITES_GWC = 2;      // tabla de direcciones + máscaras 1 bit
  const BLOQUE_SEGMENTOS_GWC = 3;    // registros fijos de 32 bytes
  const BLOQUE_SECUENCIAS_GWC = 4;   // registros de 6 bytes (opcional)
  // El bloque 5 (fondo) está RESERVADO: la v1 no lo escribe.

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
  function _byteDe(valor) { return [valor & 0xFF]; }

  /** uint16 little-endian como array de 2 bytes. */
  function _u16LE(valor) { return [valor & 0xFF, (valor >>> 8) & 0xFF]; }

  /** uint32 little-endian como array de 4 bytes. */
  function _u32LE(valor) {
    return [valor & 0xFF, (valor >>> 8) & 0xFF, (valor >>> 16) & 0xFF, (valor >>> 24) & 0xFF];
  }

  /** Texto ASCII como array de bytes. */
  function _textoGWC(texto) {
    const bytes = [];
    for (let i = 0; i < texto.length; i++) bytes.push(texto.charCodeAt(i) & 0xFF);
    return bytes;
  }

  /** Concatena varios arrays/Uint8Array en un único Uint8Array. */
  function _concatenar(listas) {
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
  function _numeroODefecto(valor, porDefecto) {
    return (valor === undefined || valor === null) ? porDefecto : Number(valor);
  }

  /**
   * Un campo opcional del GWI como byte: el valor (módulo 256) o el que
   * se indique si no está declarado.
   */
  function _byteOpcional(valor, valorSiAusente) {
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
    return _concatenar([new Uint8Array(_byteDe(tipo)),
    new Uint8Array(_u32LE(contenido.length)), contenido]);
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

  // ---------------- Límites de campos (F5-I16) ----------------

  /**
   * Acota un valor numérico a [minimo, maximo]. Los especiales se
   * respetan tal cual: el nulo («sin valor», NO es un cero legal) y lo
   * que no sea un número finito (lo caza después la verificación).
   * @param {*} valor - Valor a limitar.
   * @param {number} maximo - Máximo que admite el campo.
   * @param {number} [minimo] - Mínimo que admite el campo (0 si falta).
   * @returns {*} El valor ajustado (o el original si era nulo/no numérico).
   */
  function limitarValor(valor, maximo, minimo) {
    const min = (minimo === undefined || minimo === null) ? 0 : minimo;
    if (valor === null || valor === undefined || valor === '') return valor;
    const n = Number(valor);
    if (!Number.isFinite(n)) return valor;
    return Math.max(min, Math.min(maximo, Math.round(n)));
  }

  /**
   * Aplica un límite de la tabla a un campo de un objeto y compone el
   * aviso si el valor cambia. No inventa campos ausentes: lo no declarado
   * sigue sin declarar (el nulo no es cero).
   * @returns {void}
   */
  function _aplicarLimite(obj, campo, maximo, minimo, nombre, avisos) {
    if (!obj || typeof obj !== 'object' || !(campo in obj)) return;
    const original = obj[campo];
    const ajustado = limitarValor(original, maximo, minimo);
    if (typeof ajustado !== 'number' || ajustado === original) return;
    obj[campo] = ajustado;
    avisos.push(nombre + ': ' + String(original) + ' limitado a ' + String(ajustado) + '.');
  }

  /**
   * Valida el rango de la resolución (F5-I16, M5): fuera de 320×240 a
   * 1024×600 (siempre ancho×alto) es un ERROR bloqueante, no un aviso:
   * una resolución mala arrastra el problema a todo lo que se construye
   * sobre ella. Sin declarar (o incompleta) no es error aquí: cada
   * validador ya regula su obligatoriedad.
   * @param {?{ancho: *, alto: *}} resolucion - Resolución declarada.
   * @returns {?string} null si está en rango (o sin declarar), o el error.
   */
  function _avisosDeResolucion(resolucion) {
    if (!resolucion || resolucion.ancho === undefined || resolucion.alto === undefined) return null;
    const a = Number(resolucion.ancho), l = Number(resolucion.alto);
    if (!Number.isInteger(a) || !Number.isInteger(l)) return null;
    const texto = 'la resolución ' + a + '×' + l +
      ' está fuera del rango de pantallas (' + PANTALLA_MIN.ancho + '×' + PANTALLA_MIN.alto +
      ' a ' + PANTALLA_MAX.ancho + '×' + PANTALLA_MAX.alto + ').';
    if (a < PANTALLA_MIN.ancho || l < PANTALLA_MIN.alto ||
      a > PANTALLA_MAX.ancho || l > PANTALLA_MAX.alto) {
      return texto;
    }
    return null;
  }

  /**
   * Limita EN MEMORIA los campos de un fichero según su tipo (F5-I16):
   * al cargar, para que lo que ve el editor y arrastra el motor sea
   * coherente; al guardar, para que lo escrito sea siempre correcto
   * (la redundancia es deliberada: ver F5-I16, Manejo de los límites).
   * No toca nulos ni campos ausentes, y devuelve los avisos de lo
   * recortado para que el llamante los pinte donde corresponda.
   * @param {string} tipo - 'GWB' o 'GWI' (límites prácticos) o 'GWC'/'GWS' (límites del formato).
   * @param {Object} json - El JSON del fichero (mutado en memoria).
   * @returns {string[]} Avisos de los valores recortados.
   */
  function revisarValores(tipo, json) {
    const avisos = [];
    if (!json || typeof json !== 'object') return avisos;
    _revisarMemoria(json, avisos);       // F5-I20: «memoria» en GWS, GWB y GWI
    if (tipo === 'GWS') {
      for (const b of (Array.isArray(json.botones) ? json.botones : [])) {
        if (!b || typeof b !== 'object' || b.puerto === undefined) continue;
        const original = b.puerto;
        const ajustado = limitarValor(original, MAX_PUERTO_GWS, 0);
        if (typeof ajustado !== 'number' || ajustado === original) continue;
        b.puerto = ajustado;
        avisos.push('el puerto del botón ' + b.numero + ' (' + String(original) +
          ') limitado a ' + ajustado + '.');
      }
      return avisos;
    }
    const tope = (tipo === 'GWC') ? 'maxGWC' : 'maxGWI';
    for (const f of TABLA_LIMITES) {
      if (f.ruta) {
        const padre = f.ruta.slice(0, -1)
          .reduce((o, k) => (o && typeof o === 'object') ? o[k] : null, json);
        _aplicarLimite(padre, f.ruta[f.ruta.length - 1], f[tope], f.min, f.campo, avisos);
      } else if (f.segmento && Array.isArray(json.segmentos)) {
        for (const seg of json.segmentos) {
          _aplicarLimite(seg, f.segmento, f[tope], f.min, f.campo, avisos);
        }
      }
    }
    return avisos;
  }

  // ---------------- Memoria del hardware (F5-I20, MA02) ----------------
  // «memoria» {RAM, FLASH} en KB (enteros ≥ 0, ambos opcionales) va en la
  // raíz del GWS y de los cartuchos. Es INFORMATIVA: solo sirve para mostrar
  // el porcentaje de ocupación al generar el GWC; nunca bloquea.
  const CLAVES_MEMORIA = ['RAM', 'FLASH'];

  /** true si el valor es un entero ≥ 0 (los KB de un subcampo de memoria). */
  function _memoriaValida(v) {
    return typeof v === 'number' && Number.isInteger(v) && v >= 0;
  }

  /**
   * Revisa «memoria» de un fichero: lo que no es un entero ≥ 0 se AVISA y
   * se trata como 0 (F5-I16); los ceros y el objeto vacío se quitan, de modo
   * que 0 equivale a no declarar y no se serializa. Muta el JSON en memoria.
   * @param {Object} json - GWS, GWB o GWI.
   * @param {string[]} avisos - Se le añaden los avisos.
   * @returns {void}
   */
  function _revisarMemoria(json, avisos) {
    if (json.memoria === undefined || json.memoria === null) {
      if (json.memoria === null) delete json.memoria;
      return;
    }
    const m = json.memoria;
    if (typeof m !== 'object' || Array.isArray(m)) {
      avisos.push('"memoria" debe ser {RAM, FLASH} en KB: se ignora.');
      delete json.memoria;
      return;
    }
    for (const k of CLAVES_MEMORIA) {
      if (m[k] === undefined) continue;
      if (!_memoriaValida(m[k])) {
        avisos.push('memoria.' + k + ' (' + String(m[k]) + ') debe ser un entero ≥ 0 de KB: se trata como 0.');
        m[k] = 0;
      }
      if (m[k] === 0) delete m[k];
    }
    if (CLAVES_MEMORIA.every(k => m[k] === undefined)) delete json.memoria;
  }

  /**
   * Solo los subcampos válidos y distintos de 0 de una «memoria».
   * @param {*} memoria - Objeto {RAM, FLASH} (puede ser cualquier cosa).
   * @returns {?{RAM:number, FLASH:number}} Objeto con lo que se escribe, o null si no hay nada.
   */
  function memoriaNoCero(memoria) {
    if (!memoria || typeof memoria !== 'object' || Array.isArray(memoria)) return null;
    const o = {};
    for (const k of CLAVES_MEMORIA) if (_memoriaValida(memoria[k]) && memoria[k] > 0) o[k] = memoria[k];
    return Object.keys(o).length > 0 ? o : null;
  }

  /**
   * La memoria que vale para un cartucho: la que declara él, o la del
   * setup, SUBCAMPO a subcampo (el 0 o la ausencia significan «no declara»).
   * @param {*} delCartucho - «memoria» del cartucho (o null).
   * @param {*} delSetup - «memoria» del setup (o null).
   * @returns {{RAM:number, FLASH:number}} KB efectivos (0 = sin dato).
   */
  function memoriaEfectiva(delCartucho, delSetup) {
    const c = memoriaNoCero(delCartucho) || {};
    const s = memoriaNoCero(delSetup) || {};
    return { RAM: c.RAM || s.RAM || 0, FLASH: c.FLASH || s.FLASH || 0 };
  }

  /** «4,2» → «4.2»; entero sin decimales (un decimal como mucho). */
  function _kb(bytes) {
    return String(Math.round(bytes / 1024 * 10) / 10);
  }

  /** Porcentaje entero redondeado; «< 1 %» si hay uso pero menos del 1 %. */
  function _porcentaje(usado, total) {
    if (usado <= 0) return '0 %';
    const p = usado / total * 100;
    return p < 1 ? '< 1 %' : Math.round(p) + ' %';
  }

  /**
   * Texto de ocupación: «RAM: 4 de 216 KB (2 %) · FLASH: 0 de 216 KB (0 %)».
   * Solo entran los tipos con memoria > 0; sin ninguna, null (ni porcentaje
   * ni aviso). RAM usada = bytes del GWC; FLASH usada = bloque de fondo.
   * @param {{RAM:number, FLASH:number}} efectiva - De memoriaEfectiva.
   * @param {number} bytesRAM - Bytes del GWC.
   * @param {number} bytesFLASH - Bytes del bloque de fondo (hoy 0).
   * @returns {?string} El texto, o null si no hay memoria declarada.
   */
  function ocupacionMemoria(efectiva, bytesRAM, bytesFLASH) {
    const partes = [];
    const usos = { RAM: bytesRAM || 0, FLASH: bytesFLASH || 0 };
    for (const k of CLAVES_MEMORIA) {
      const total = efectiva && efectiva[k];
      if (!total) continue;
      partes.push(k + ': ' + _kb(usos[k]) + ' de ' + total + ' KB (' +
        _porcentaje(usos[k] / 1024, total) + ')');
    }
    return partes.length > 0 ? partes.join(' · ') : null;
  }

  /** Escala por eje de la imagen fuente a la pantalla declarada. */
  function _escalasDePantalla(pantalla) {
    return {
      x: pantalla.ancho / pantalla.fuente.ancho,
      y: pantalla.alto / pantalla.fuente.alto
    };
  }

  /** Píxeles RGBA de un sprite (canvas del editor, o Image pasada por un canvas efímero). */
  function _pixelesDeSprite(sprite) {
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
    const escala = _escalasDePantalla(pantalla);
    const anchoDestino = Math.max(1, Math.round(sprite.ancho * escala.x));
    const altoDestino = Math.max(1, Math.round(sprite.alto * escala.y));
    const pixeles = _pixelesDeSprite(sprite);

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
   * montados, con el CRC del resto. DETERMINISTA: sin
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

    // F5-I16: límites asentados antes de generar. Doble filtro DELIBERADO
    // (práctico + formato): aunque al cargar ya se ajustó, la generación
    // no confía en ello. Los avisos salen por #estado.
    const avisosLimites = revisarValores('GWI', json)
      .concat(revisarValores('GWC', json));
    if (avisosLimites.length > 0) BaseDirector.avisar(avisosLimites.join(' '));

    // F5-I16 (M5): la resolución es BLOQUEANTE también al generar (red
    // de seguridad: al cargar y aplicar ya lo estaba).
    const fueraDeRango = _avisosDeResolucion(pantalla || (json && json.resolucion));
    if (fueraDeRango) {
      throw new Error('no se genera el GWC: ' + fueraDeRango);
    }

    // Lo que VIAJA y las tablas de índices: todos los bloques montan sobre ellas.
    const viaja = _viajanEnGWC(json);
    const imagenDeSprite = new Map();
    for (const sprite of (spritesConImagen || [])) imagenDeSprite.set(sprite.id, sprite.imagen);
    const indiceDeSegmento = new Map(viaja.segmentos.map((s, i) => [s.id, i]));
    const indiceDeSprite = new Map(viaja.sprites.map((s, i) => [s.id, i]));
    const escala = _escalasDePantalla(pantalla);

    // El Bloque 5 (Fondo) es RESERVADO: la v1 no lo escribe.
    const bloqueConfiguracion = _montarConfiguracion(json);
    const bloqueSprites = _montarSprites(viaja, imagenDeSprite, pantalla);
    const bloqueSegmentos = _montarSegmentos(viaja, indiceDeSprite, indiceDeSegmento, escala.x, escala.y);
    const bloqueSecuencias = _montarSecuencias(json, indiceDeSegmento);
    const bloqueDatos = _montarDatosGenerales(json, viaja, pantalla, bloqueConfiguracion, bloqueSprites, bloqueSegmentos, bloqueSecuencias);

    // Ensamblado en el orden de los tipos; este cuerpo es lo que protege la suma.
    const partes = [bloqueDatos, bloqueConfiguracion, bloqueSprites, bloqueSegmentos];
    if (bloqueSecuencias) partes.push(bloqueSecuencias);
    const cuerpo = _concatenar(partes);

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
   * Bloque 1 Configuración: los 8 valores uint16 del cartucho, siempre
   * presentes y deterministas (F5-I13): pausas (2), aceleración (3), rutas (1)
   * y fin (2). El valor 08 (reglas) pasó al Bloque 0 en F5-I14 y queda libre. Lo que el GWI no declara viaja como NULO (0xFFFF),
   * nunca como un valor por defecto inventado.
   * @param {Object} json - GWI montado.
   * @returns {Uint8Array} El Bloque 1 completo.
   */
  function _montarConfiguracion(json) {
    const pausas = json.pausas || {};
    const aceleracion = json.aceleracion || null;
    const rutas = json.rutas || {};
    const fin = json.fin || {};

    const valores = [
      // F5-I13: lo que el GWI NO declara viaja como NULO (0xFFFF), no como un valor
      // por defecto inventado: el GWC y el GWI dan la misma partida. El valor por
      // defecto (500 ms, «sin aumento de rutas»…) lo aplica quien lee, igual en los dos.
      ..._u16LE(_numeroODefecto(pausas.simulador, NULO16_GWC)),
      ..._u16LE(_numeroODefecto(pausas.externo, NULO16_GWC)),
      ..._u16LE(aceleracion ? Number(aceleracion.cada) || 1 : NULO16_GWC),
      ..._u16LE(aceleracion ? Number(aceleracion.resta) || 0 : NULO16_GWC),
      ..._u16LE(aceleracion ? Number(aceleracion.minimo) || 0 : NULO16_GWC),
      ..._u16LE(_numeroODefecto(rutas.aumentarCada, NULO16_GWC)),
      ..._u16LE(fin.mecanismo ? FIN_GWC[fin.mecanismo] : NULO16_GWC),
      ..._u16LE(_numeroODefecto(fin.contador, NULO16_GWC))
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
      tablaDirecciones.push(..._u32LE(desplazamiento));
      desplazamiento += 4 + mascara.filas.length;
    }

    const registros = [];
    for (const mascara of mascaras) {
      registros.push(new Uint8Array([..._u16LE(mascara.ancho), ..._u16LE(mascara.alto)]));
      registros.push(mascara.filas);
    }
    return bloque(BLOQUE_SPRITES_GWC,
      _concatenar([new Uint8Array(tablaDirecciones), ...registros]));
  }

  /**
   * Byte de propiedades de un segmento: bit 0 jugador inicial, bit 1
   * ascendente, bit 2 presentar el cero (los defaults de los dos últimos
   * son 1: el GWI no lleva sobras).
   */
  function _propiedadesDeSegmento(segmento) {
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
      registros.push(..._byteDe(segmento.tipo));
      registros.push(..._u16LE(Math.max(0, Math.round(segmento.x * escalaX))));
      registros.push(..._u16LE(Math.max(0, Math.round(segmento.y * escalaY))));
      registros.push(..._byteDe(indiceDe(segmento.sprite, indiceDeSprite)));
      for (const campo of ENLACES_REGISTRO_GWC) {
        registros.push(..._byteDe(indiceDe(segmento[campo], indiceDeSegmento)));
      }
      registros.push(..._byteDe(_byteOpcional(segmento.salvadoContador, NULO_GWC)));
      registros.push(..._byteDe(_byteOpcional(segmento.muerteContador, NULO_GWC)));
      registros.push(..._byteDe(_propiedadesDeSegmento(segmento)));
      registros.push(..._byteDe(_byteOpcional(segmento.contadorInterno, NULO_GWC)));
      // «Valor inicial / orden»: en un contador es su valor inicial; en un icono de vida o
      // de muerte, su ORDEN en la familia (1..N), con el que el motor ordena los iconos
      // (F5-I13: antes no viajaba y el orden dependía solo de la posición en la lista).
      const valorOOrden = (segmento.tipo === TIPO_VIDA_GWC || segmento.tipo === TIPO_MUERTE_GWC)
        ? segmento.contador : segmento.valorInicial;
      registros.push(..._byteDe(_byteOpcional(valorOOrden, 0)));
      registros.push(..._byteDe(_byteOpcional(segmento.ruta, NULO_GWC)));
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
    registro.push(..._byteDe(Math.min(0xFF, Math.max(1, Number(json.secuencia.ticks) || 1))));

    const idsSecuencia = json.secuencia.segmentos.slice(0, MAX_SEGMENTOS_SECUENCIA_GWC);
    for (let i = 0; i < MAX_SEGMENTOS_SECUENCIA_GWC; i++) {
      const id = idsSecuencia[i];
      const indice = indiceDe(id, indiceDeSegmento);
      if (id && indice === NULO_GWC) {
        console.warn('[gwc] la Secuencia apunta a ' + id + ', que no viaja en el GWC: se descarta.');
      }
      registro.push(..._byteDe(indice));
    }
    return bloque(BLOQUE_SECUENCIAS_GWC, new Uint8Array(registro));
  }

  /**
   * Bloque 0 Datos Generales: estilo, pantalla declarada, conteos, color de
   * fondo RGB (json.ColorFondo, blanco por defecto: la v1 no escribe el
   * bloque de imagen de fondo) y las
   * direcciones de los seis bloques (los ausentes, a nulo). Mide SIEMPRE 41
   * bytes (36 de contenido): las direcciones se calculan con los TAMAÑOS
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
    contenido.push(..._byteDe(Number(json.estilo) || 0));
    contenido.push(..._u16LE(pantalla.ancho), ..._u16LE(pantalla.alto));
    contenido.push(..._byteDe(viaja.sprites.length), ..._byteDe(viaja.segmentos.length));
    contenido.push(..._byteDe(bloqueSecuencias ? 1 : 0));
    contenido.push(..._bytesDeColor(json.ColorFondo));   // fondo RGB (blanco por defecto)
    contenido.push(json.combinar ? BIT_REGLA_COMBINAR_GWC : 0);   // F5-I14: reglas del juego
    contenido.push(..._u32LE(direccionBloque0), ..._u32LE(direccionBloque1),
      ..._u32LE(direccionBloque2), ..._u32LE(direccionBloque3),
      ..._u32LE(direccionBloque4), ..._u32LE(direccionBloque5));
    return bloque(BLOQUE_DATOS_GWC, new Uint8Array(contenido));
  }

  /**
   * La cabecera del fichero: «GWC» + la versión como CARÁCTER (visible al
   * abrir el fichero: «GWC1») + el CRC del resto como
   * TEXTO «#HHHH#» + el tamaño del FICHERO. Se monta AL FINAL sobre el
   * cuerpo ya ensamblado (el CRC no se incluye a sí mismo). La parte
   * visible va DELANTE a propósito: lo binario (el tamaño) detrás.
   * @param {Uint8Array} cuerpo - Todos los bloques ya ensamblados.
   * @returns {{bytes:Uint8Array, checksum:number, codigo:string}} El
   *          fichero completo, su CRC y el código.
   */
  function _montarCabecera(cuerpo) {
    const tamanoTotal = TAM_CABECERA_GWC + cuerpo.length;
    const fichero = new Uint8Array(tamanoTotal);

    fichero.set(_textoGWC('GWC' + VERSION_GWC), 0);   // 4 bytes visibles
    fichero.set(cuerpo, TAM_CABECERA_GWC);

    const checksum = _crc16(cuerpo);
    const codigo = _codigoDeCRC(checksum);
    fichero.set(_textoGWC(codigo), 4);                // 6 bytes: «#HHHH#»
    fichero.set(_u32LE(tamanoTotal), 10);
    return { bytes: fichero, checksum: checksum, codigo: codigo };
  }

  /**
   * El CRC-16/CCITT-FALSE del GWC (F5-I14; polinomio 0x1021, inicial 0xFFFF,
   * sin reflejar ni xor final; «123456789» → 0x29B1). Cubre TODO el fichero
   * menos la cabecera. Detecta bytes cambiados, intercambiados y ráfagas de
   * hasta 16 bits, lo que la suma aditiva anterior no hacía.
   * @param {Uint8Array} bytes - Los bytes a proteger.
   * @returns {number} El CRC de 16 bits.
   */
  function _crc16(bytes) {
    let crc = CRC16_INICIAL;
    for (let i = 0; i < bytes.length; i++) {
      crc ^= bytes[i] << 8;
      for (let bit = 0; bit < 8; bit++) {
        crc = (crc & 0x8000) ? ((crc << 1) ^ CRC16_POLINOMIO) & 0xFFFF : (crc << 1) & 0xFFFF;
      }
    }
    return crc;
  }

  /**
   * Formatea el CRC como el Código GWC: el TEXTO visible «#HHHH#»
   * (hexadecimal en mayúsculas, 4 dígitos). Mismo formato que el campo del
   * par en el GWI y que la cabecera del GWC.
   * @param {number} crc - El CRC de 16 bits.
   * @returns {string} El código, p. ej. «#29B1#».
   */
  function _codigoDeCRC(crc) {
    return '#' + crc.toString(16).toUpperCase().padStart(4, '0') + '#';
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
  function _idDeSegmentoGWC(indice) {
    return 'seg_' + String(indice).padStart(3, '0');
  }

  /**
   * Valida la cabecera: tamaño mínimo, identificador «GWC», versión,
   * tamaño declarado y CRC. Cualquier desviación es un
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

    const crc = _crc16(bytes.subarray(TAM_CABECERA_GWC));
    const codigoReal = _codigoDeCRC(crc);
    const codigoDeclarado = String.fromCharCode(...bytes.slice(4, 10));
    if (codigoDeclarado !== codigoReal) {
      throw new Error('el CRC no coincide (declarado ' + codigoDeclarado +
        ', real ' + codigoReal + '): el GWC está corrupto.');
    }
    return { suma: crc, codigo: codigoReal };
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

  /** Bloque 0: estilo, pantalla, conteos, color de fondo, reglas y direcciones de los 6 bloques. */
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
    const reglas = lector.u8(p + 11);
    for (let i = 0; i < 6; i++) direcciones.push(lector.u32(p + 12 + i * 4));

    return {
      estilo: lector.u8(p),
      ancho: lector.u16(p + 1),
      alto: lector.u16(p + 3),
      nSprites: lector.u8(p + 5),
      nSegmentos: lector.u8(p + 6),
      nSecuencias: lector.u8(p + 7),
      fondo: colorFondo,
      combinar: (reglas & BIT_REGLA_COMBINAR_GWC) !== 0,
      direcciones: direcciones
    };
  }

  /** Mecanismo de fin a partir de su código; uno desconocido es un GWC corrupto. */
  function _mecanismoDeFin(codigo) {
    const mecanismo = FIN_GWC_INV[codigo];
    if (!mecanismo) throw new Error('el Bloque 1 declara un mecanismo de fin desconocido (' + codigo + ').');
    return mecanismo;
  }

  /** Bloque 1: pausas, aceleración, política de rutas y fin (8 uint16; nulo = no declarado). */
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
      // Nulo = el GWI no lo declaraba (F5-I13): se devuelve null, como el GWI.
      pausas: (valor(0) === NULO16_GWC && valor(1) === NULO16_GWC) ? null : {
        simulador: (valor(0) !== NULO16_GWC) ? valor(0) : null,
        externo: (valor(1) !== NULO16_GWC) ? valor(1) : null
      },
      aceleracion: aceleracionCompleta
        ? { cada: aceleracionCada, resta: aceleracionResta, minimo: aceleracionMinimo } : null,
      rutas: (valor(5) !== NULO16_GWC) ? { aumentarCada: valor(5) } : null,
      fin: (codigoFin !== NULO16_GWC) ? {
        mecanismo: _mecanismoDeFin(codigoFin),
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
    if (bloqueSprites.tam < nSprites * 4) {
      throw new Error('el Bloque 2 declara ' + nSprites +
        ' sprite(s) y su tabla de direcciones no cabe en su contenido.');
    }
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
      segmentos.push(_leerRegistroDeSegmentoGWC(lector, bloqueSegmentos.inicio + i * TAM_REGISTRO_SEGMENTO_GWC, i, sprites, nSegmentos));
    }
    return segmentos;
  }

  /** Un registro de segmento del Bloque 3 como objeto con la forma del editor. */
  function _leerRegistroDeSegmentoGWC(lector, inicioRegistro, indice, sprites, nSegmentos) {
    const indiceSprite = lector.u8(inicioRegistro + 5);
    if (indiceSprite !== NULO_GWC && indiceSprite >= sprites.length) {
      throw new Error('el segmento ' + indice + ' usa el sprite ' + indiceSprite +
        ' y el cartucho solo tiene ' + sprites.length + '.');
    }
    const segmento = {
      id: _idDeSegmentoGWC(indice),
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
      if (indiceEnlace !== NULO_GWC && indiceEnlace >= nSegmentos) {
        throw new Error('el segmento ' + indice + ' enlaza (' + campo + ') con el segmento ' +
          indiceEnlace + ' y el cartucho solo tiene ' + nSegmentos + '.');
      }
      if (indiceEnlace !== NULO_GWC) segmento[campo] = _idDeSegmentoGWC(indiceEnlace);
    }

    const salvadoContador = lector.u8(posicion++);
    if (salvadoContador !== NULO_GWC) segmento.salvadoContador = salvadoContador;
    const muerteContador = lector.u8(posicion++);
    if (muerteContador !== NULO_GWC) segmento.muerteContador = muerteContador;

    const propiedades = lector.u8(posicion++);
    if (propiedades & BIT_PRIMER_JUGADOR_GWC) segmento.primero = true;

    const contadorInterno = lector.u8(posicion++);
    if (contadorInterno !== NULO_GWC) segmento.contadorInterno = contadorInterno;
    const valorInicial = lector.u8(posicion++);       // valor inicial (contador) u orden (vida/muerte)
    const ruta = lector.u8(posicion++);
    if (ruta !== NULO_GWC) segmento.ruta = ruta;
    if ((segmento.tipo === TIPO_VIDA_GWC || segmento.tipo === TIPO_MUERTE_GWC) && valorInicial !== 0) {
      segmento.contador = valorInicial;
    }

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
  function _leerSecuenciasGWC(bytes, lector, posicion, nSecuencias, nSegmentos) {
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
      if (indice !== NULO_GWC && indice >= nSegmentos) {
        throw new Error('la Secuencia usa el segmento ' + indice +
          ' y el cartucho solo tiene ' + nSegmentos + '.');
      }
      if (indice !== NULO_GWC) segmentos.push(_idDeSegmentoGWC(indice));
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
    const secuencia = _leerSecuenciasGWC(bytes, lector, direcciones[4], generales.nSecuencias, generales.nSegmentos);

    return {
      estilo: String(generales.estilo),
      resolucion: { ancho: generales.ancho, alto: generales.alto },
      fondo: generales.fondo,
      pausas: configuracion.pausas,
      aceleracion: configuracion.aceleracion,
      rutas: configuracion.rutas,
      combinar: generales.combinar,
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
    // Lectura (GWB / GWI: el tipo lo decide el contenido; F5-I19)
    leerCartucho: leerCartucho,
    abrirPACK: abrirPACK,
    // Validación despachada por tipo (F5-I9), exportada para prueba aislada
    validarComunes: validarComunes,
    validarGWB: validarGWB,
    validarGWI: validarGWI,
    // Grabación (GWI)
    guardarGWI: guardarGWI,
    guardarGWB: guardarGWB,
    // Verificación del diseñador
    verificarCartucho: verificarCartucho,
    // Límites de campos por fichero (F5-I16)
    revisarValores: revisarValores,
    avisosDeResolucion: _avisosDeResolucion,   // F5-I21: la ventana de resolución la usa para el rango
    limitarValor: limitarValor,
    // Memoria del hardware (F5-I20)
    memoriaNoCero: memoriaNoCero,
    memoriaEfectiva: memoriaEfectiva,
    ocupacionMemoria: ocupacionMemoria,
    MAX_PUERTO_GWS: MAX_PUERTO_GWS,
    PANTALLA_MIN: PANTALLA_MIN,
    PANTALLA_MAX: PANTALLA_MAX,
    // GWC: grabación, lectura y validación
    leerGWC: leerGWC,
    generarGWC: generarGWC,
    validarTopes: validarTopes,
    estadistica: estadistica,
    // Utilidades compartidas
    escalar: escalar,               // F5-I21: la misma conversión que el GWC (ajuste de resolución)
    cargarImagen: cargarImagen,
    imagenBlob: imagenBlob,
    revocarURLs: revocarURLs
  };

})();
