'use strict';

// baseDescomponer.js
// ====================================================================================================
// PROPÓSITO
//   La autoría de los segmentos de un cartucho: el mapa de objetos
//   (seleccionar, señalar propiedades, unir, agrupar), el panel de
//   propiedades, el historial de deshacer/rehacer, la composición del
//   aparato y el montaje y la generación de los cartuchos (botones
//   «Verificar y Guardar» y «Generar GWI+GWC»).
//
// SEPARACIÓN
//   La geometría se dibuja, la lógica se señala. La extracción vive en
//   baseExtractor, el dibujo del mapa en baseGraficos, los ficheros
//   (ZIP, serialización del GWI, GWC binario) en baseCartucho y el
//   cableado de botones e inputs en baseDirector. Este módulo MONTA
//   el JSON del GWI con la autoría (montarGWI) y repinta; la
//   VERIFICACIÓN (verificarCartucho) y el guardado (guardarGWI,
//   generarGWC) los escribe baseCartucho: verificarYGuardar y
//   generarGWIyGWC los llaman y presentan sus hallazgos.
//
// FUNCIONES
//
//  Arranque y estado
//   arrancar               Arranca la autoría de un cartucho (GWB o GWI).
//   reset                  Limpia el estado (recargar cartucho/setup).
//   cargarListas           Listas del GWI al puente (comunListas).
//   repintarAparato        Repinta el aparato (F5-I10: tras cambiar img_f en la ficha).
//   inicializar            Cablea los eventos del mapa (una vez).
//
//  Identificación de grupos
//   _segId                  Id legible seg_NNN (o F0N si es ficticio).
//   _grupoDeComp            Grupo actual de un índice de componente.
//   _grupoDelPixel          Grupo de un píxel del mapa.
//   _resolverEnlace         Enlace (índice) → segId legible.
//   _propsDe                Props por componente (crea las por defecto).
//   _camposDe               Enlaces válidos para un tipo.
//   numeroDe / numRuta / numContador
//                          Nº de lista, de ruta y de contador de un grupo.
//
//  Ficticios y jerarquía (dígito/contador/unión)
//   _clasificarBarras       Las SIETE barras de un «8» por geometría.
//   esBarraDeDigito / esDigitoDeContador / esAbsorbido
//                          Pertenencia a un dígito, contador o unión.
//   digitoDeBarra / contadorDeDigito / ficticioAbsorbente
//                          El dueño de una barra, dígito o absorbido.
//   _piezaDe                La pieza visible que maneja el editor.
//   _barrasDe               Las siete barras de un dígito, con letras.
//   _cajaPresentable        Caja envolvente de un dígito/contador.
//   aportantes / fusionarGrupos / firmaPieza / imagenFusionada
//                          La imagen fusionada de una pieza (OR de
//                          píxeles, dibujada una sola vez por firma).
//
//  Historial (deshacer/rehacer)
//   registrarCambio / registrarCambios
//                          Registra una acción (atómica, con «antes»).
//   registrarCambioDerivado
//                          Igual, marcada auto:true (inversa derivada de la
//                          verificación): se deshace y rehace con su acción.
//   _esBloqueDeFicha        El alta de la ficha del cartucho no se deshace.
//   _deshacerBloque / _rehacerBloque
//                          Deshacen o rehacen un bloque del historial.
//   _reproducirCambios      Reproduce un historial sobre el estado de
//                          nacimiento (carga de GWI y fallback legacy).
//   quitarParUnion / invertirEntrada
//                          Inversas estructurales de unir/baja.
//   deshacer / rehacer    Deshace y rehace la última acción atómica.
//
//  Reconstrucción y listas
//   _motivoNoUnible         Por qué una lista de piezas no puede unirse
//                          (dígitos, contadores); null si se puede.
//   _reconstruir            Re-agrupa con las uniones vigentes y fusiona
//                          las props de los miembros.
//   refrescar / refrescarInfo
//                          Repinta mapa, aparato y panel de información.
//   resumen                Nº de segmentos e imágenes (panel del Editor).
//   direccionesDeJugador   Direcciones que usan los segmentos de jugador (¿cabe el juego en otro estilo?, F5-I21).
//
//  Lista de segmentos (pestaña Segmentos y Sprites, F5-I7)
//   pintarListaSegmentos   Las cinco sublistas con su imagen.
//   filaDeLista / agregarSublista / usosDeSprite
//                          Una fila, una sublista con título y los usos de un sprite.
//   _abrirEnEditor          Pulsar una fila: el segmento en el Editor.
//   segmentos / listar    Las listas (fantasmas incluidos) y su vuelco.
//   colorRGB / relacionadosDe / entrantesDe / listaMotor
//                          Colores de relación y lista para el baseGraficos.
//
//  Composición del aparato
//   _fijarEscalaAparato     Escala de la pantalla del aparato.
//   _pixelesDeImagen        Lee los píxeles de una imagen en memoria.
//   pintarFondoAparato     Fondo (ColorFondo + img_f estirada).
//   pintarSegmentoAparato  Un segmento en negro puro, escalado.
//   pintarPantallaAutoria  Fondo solo (GWB) o composición (GWI/guardado).
//   pintarGWI              Presentación de un GWI cargado.
//
//  Mapa de objetos
//   _pintarMapa             Dibuja el mapa de trabajo.
//   _puntoDe                Píxel del mapa bajo el puntero.
//   alPulsarMapa / alMoverMapa / alSoltarMapa
//                          Clic, selección múltiple por recuadro y fin.
//   _unirGrupos             Une grupos (elección o marcados).
//   _unirMarcados          Unión en lote de los marcados por recuadro.
//
//  Ficticios de edición
//   _crearFicticio          Da de alta un ficticio (dígito/contador/cartucho).
//   _separarAgrupado        Separa una pieza (inversa del agrupado).
//   hacerDigito / hacerContador
//                          «Hacer dígito» y «Hacer contador».
//
//  Ficha del cartucho y campos del Director
//   esCartucho / cartuchoDe / asegurarCartucho
//                          El segmento de cartucho (único ficha).
//   _finDelCartucho         Mecanismo de fin de la ficha.
//   secuenciaDelCartucho / sincronizarSecuencia
//                          La Secuencia de la ficha.
//   pausasDelCartucho / aceleracionDelCartucho / rutasDelCartucho
//                          Pausas, aceleración y política de rutas.
//   _sincronizarDirector    Copia los campos del panel a la ficha.
//
//  Enlaces y panel de propiedades
//   _aplicarEleccion        Aplica el destino clicado en el mapa.
//   _verificarReferencias  Enlaces que apuntan a segmentos extintos.
//   _moverNumero            Subir/Bajar el número de un segmento.
//   _mostrarPanel           Panel de propiedades (todo el UI de autoría).
//
//  Verificación y generación
//   verificarYGuardar      Botón «Verificar y Guardar»: verificar +
//                          topes (aviso) + guardar GWI.
//   generarGWIyGWC         Botón «Generar GWS+GWB+GWI+GWC» (F5-I17 M9): verificar
//                          + topes BLOQUEANTES + GWC + su GWS + GWI con el Código GWC.
//   _cambiosSinAplicar     F5-I17 (M12): «Generar pide Aplicar» — si el
//                          setup tiene cambios sin aplicar, no se genera.
//   _ctxVerificacion        El contexto que pide baseCartucho para
//                          verificar (helpers y tablas de aquí).
//   _avisoTopes            Presenta los avisos de tope de 255.
//   _nombreFichero         Nombre de fichero saneado: el nombre del cartucho (F5-I17 M10).
//   _descargarGWC          Descarga el fichero .gwc generado (con su nombre; F5-I17 M10).
//   _descargarGWS          Descarga el GWS del setup vigente junto al GWC (F5-I17 M9).
//   _montarGWI             Monta el JSON del GWI (con la autoría).
//   _guardarGWI             Validaciones de contexto y delega en
//                          baseCartucho.guardarGWI.
//   cargarAutoria         Reproduce el historial de un GWI (precarga).
//   numeroDeCambios       F5-I17 (M3): acciones de la autoría en curso (sin contar
//                          el alta de la ficha del cartucho).
//
//  Otras funciones internas (lista completada en F5-I14)
//   _esBarraDeDigito              ¿Es este grupo una BARRA de un dígito (F4-I9)? Las barras se agrupa…
//   _esDigitoDeContador           ¿Es este grupo un DÍGITO agrupado por un contador (F4-I9 v3)? Igual…
//   _contadorDeDigito             El CONTADOR dueño de un dígito (o null si es dígito libre).
//   _digitoDeBarra                El DÍGITO dueño de una barra (o null si es barra libre).
//   _ficticioAbsorbente           La PIEZA (ficticio de UNIÓN) que ABSORBIÓ a un grupo (v4), o null.
//   _esAbsorbido                  ¿Está este grupo ABSORBIDO por una unión (v4)? Los absorbidos no se…
//   _aportantes                   Los grupos que APORTAN píxeles a una pieza (v4.6):
//   _fusionarGrupos               
//   _firmaPieza                   FIRMA de composición de una pieza (v4.7):
//   _imagenFusionada              
//   _registrarCambio              Registra una acción INDIVIDUAL:
//   _registrarCambios             Registra una acción del historial, atómica:
//   _quitarParUnion               Quita un par de la lista de uniones, en CUALQUIER de los dos órdene…
//   _invertirEntrada              Aplica la INVERSA de una entrada del historial usando el valor prev…
//   _propPorDefecto               Propiedades de un segmento recién nacido (todas por defecto):
//   _numeroDe                     Número (posición) de un segmento numerable dentro de su familia ('i…
//   _numRuta                      Número de ruta de un segmento de inicio.
//   _numContador                  Número de contador de un segmento vida/muerte.
//   _refrescarInfo                Repinta el panel de información (F5-I7):
//   _filaDeLista                  Fila de la lista:
//   _usosDeSprite                 Número de segmentos que usan un sprite (deduplicación:
//   _agregarSublista              Añade una sublista con su título al contenedor.
//   _colorRGB                     Convierte un color hex "#RRGGBB" a componentes [r, g, b].
//   _relacionadosDe               Segmentos enlazados (SALIENTES) con el seleccionado:
//   _entrantesDe                  Grupos cuyo enlace apunta DIRECTAMENTE al seleccionado (sus "anteri…
//   _listaMotor                   Construye la lista residente del baseGraficos desde los grupos:
//   _refrescar                    Refresca todo el estado visible:
//   _alPulsarMapa                 Pulsación en el mapa:
//   _alMoverMapa                  Movimiento con el botón pulsado:
//   _alSoltarMapa                 Al soltar:
//   _esCartucho                   ¿El grupo es el segmento de CARTUCHO (F3-I11)? La ficha que alberga…
//   _cartuchoDe                   El segmento de CARTUCHO vigente, o null (F3-I11).
//   _secuenciaDelCartucho         La SECUENCIA como PROPIEDAD DEL CARTUCHO (duodécima iteración):
//   _sincronizarSecuencia         ESCRIBE la Secuencia en el PUENTE (corrección del 23-10-2026):
//   _pausasDelCartucho            Las PAUSAS como PROPIEDAD DEL CARTUCHO (F4-I2):
//   _aceleracionDelCartucho       La ACELERACIÓN como PROPIEDAD DEL CARTUCHO (F4-I2):
//   _rutasDelCartucho             La política de RUTAS como PROPIEDAD DEL CARTUCHO (F4-I2):
//   _asegurarCartucho             ASEGURA que existe el segmento de CARTUCHO (F3-I11):
//   _hacerDigito                  HACER DÍGITO (F4-I9 v3):
//   _hacerContador                HACER CONTADOR (F4-I9 v3):
//   _generarPar                   El cuerpo de «Generar»: se monta todo en memoria y los ficheros se…
// ====================================================================================================

const baseDescomponer = (() => {

  // ---- Estado ----

  let base = null;              // geometría del extractor (ver extraerBN)
  let uniones = [];             // pares [compA, compB] fusionados
  let props = new Map();        // componente -> propiedades señaladas
  let grupos = [];              // grupos resultantes (segmentos)
  let sprites = [];             // sprites únicos
  let indiceGrupo = new Map();  // componente -> grupo
  let seleccion = null;         // grupo seleccionado en el mapa
  let eleccion = null;          // campo que espera un clic en el mapa
  let marcados = new Set();     // selección MÚLTIPLE por recuadro (para unir)
  let arrastre = null;          // recuadro en curso: {x0,y0,x1,y1,movido}
  let escala = 1;
  // Segmentos FICTICIOS (F4-I9 v3): dígito y contador son grupos que
  // NO corresponden a ninguna componente de la imagen — nacen de
  // «Hacer dígito»/«Hacer contador» y su raíz es un id NEGATIVO
  // (-1, -2, ...) que NO choca con ningún índice de componente (la
  // extracción y las props de siempre quedan intactas). Viven como
  // grupos normales (panel, enlaces, verificación, GWI) con la
  // IMAGEN FUSIONADA de lo que agrupan como sprite.
  let ficticios = [];            // [{id, x, y, ancho, alto}]
  let ficticioSeq = 0;          // último id negativo repartido (replay-safe)

  // Registro CRONOLÓGICO de acciones (ÚNICA fuente de verdad de la
  // autoría): cada entrada es {"n": nº de acción, "relacionados": R,
  // ...campos}. Se aplica en orden sobre el estado de nacimiento;
  // null = campo anulado. La numeración CONTINÚA entre guardados.
  // Formato de las entradas:
  //   - prop:      {"segmento": comp, ...campos cambiados}
  //   - unir:      {"unir": [compA, compB]}
  //   - separar:   {"separar": [compA, compB]}   (deshacer unión)
  // "relacionados": 0 = acción individual; si una acción genera
  // varias entradas (re-apuntados al unir, pares al separar, los
  // dos intercambios de moverNumero), TODAS llevan el nº de la
  // PRIMERA entrada del grupo (incluida ella): deshacer la última
  // acción es deshacer todas las que compartan "relacionados".
  let cambios = [];
  let ultimoOp = 0;            // nº de la última acción registrada
  let rehacibles = [];         // bloques deshechos, en orden de rehacer
  let componerPantalla = false; // el aparato compone fondo+segmentos SOLO
  // con GWI cargado o tras guardar (11.0)
  // (pila: el último deshecho es el primero
  // en rehacerse). Se VACÍA al registrar
  // una acción nueva: un cambio nuevo
  // invalida la rama deshecha (undo lineal).

  // Límites del mapa de trabajo: ancho máximo del canvas y escala
  // (entera) que se le aplica a la geometría extraída.
  const ANCHO_MAPA_MAX = 760;
  const ESCALA_MAX = 3;
  const ESCALA_MIN = 1;

  // Enlaces según el tipo (excluyentes: nunca ambos a la vez):
  //   juego    -> 'siguiente', 'salvado', 'muerte' (cadena unidireccional;
  //               no hay anterior: el motor nunca retrocede)
  //   jugador  -> 'izquierda', 'derecha', 'arriba', 'abajo' (cada enlace
  //               ES el botón que lo dispara)
  //   inicio/vida/muerte usan los enlaces de juego.
  // El inverso de una dirección se calcula en la verificación.
  const ENLACES_JUEGO = ['siguiente', 'salvado', 'muerte', 'mostrarJunto'];
  const ENLACES_JUGADOR = ['izquierda', 'derecha', 'arriba', 'abajo'];
  // Colisiones (F3-I7): un segmento de juego/inicio DECLARA con qué
  // jugador choca ('colision') y, por desenlace (positiva =
  // jugador visible → salvado; negativa = sin jugador → muerte), QUÉ
  // CONTADOR INTERNO aumenta ('salvadoContador'/'muerteContador':
  // null = ninguno, 'vida' o 'muerte'). El contador interno NO es un
  // segmento: los tipos vida/muerte son su PRESENTACIÓN en pantalla;
  // la cadena del desenlace (salvado/muerte) enlaza con un segmento
  // de juego (p. ej. la animación de las aletas bajo las barcas, que
  // NO es un segmento de muerte), de inicio o de vida/muerte. El
  // inverso 'colisionDe' vive en el jugador: lo calcula la
  // verificación, como los inversos de las direcciones.
  const ENLACES_COLISION = ['colision'];
  const CONTADORES_COLISION = ['salvadoContador', 'muerteContador'];
  // Dígitos de 7 segmentos (F4-I9 v3): un segmento de tipo dígito
  // es un FICTICIO que agrupa las SIETE barras del «8» (barra_a..g,
  // segmentos normales de tipo juego: solo aportan su gráfico).
  // El contador también es un segmento ficticio: enlaza con sus dígitos (digito_1..digito_4, el 1 es el
  // de las UNIDADES) y declara el resto de sus propiedades (qué
  // contador interno usa, valor inicial, dirección y si presenta el
  // cero).
  const ENLACES_DIGITO = ['barra_a', 'barra_b', 'barra_c', 'barra_d',
    'barra_e', 'barra_f', 'barra_g'];
  const LETRAS_BARRAS = ['a', 'b', 'c', 'd', 'e', 'f', 'g'];
  // Contador (F4-I9 v3, ficticio): el segmento de tipo contador es
  // un FICTICIO que agrupa los dígitos; digito_1 es el «8» de las
  // UNIDADES (el más a la derecha) y digito_2..digito_4 los demás,
  // hacia la izquierda. «Hacer contador» los escribe ordenados; el
  // panel permite corregirlos. El nº de dígitos se CUENTA de estos
  // enlaces (solo lectura en el panel).
  const ENLACES_CONTADOR = ['digito_1', 'digito_2', 'digito_3', 'digito_4'];
  // Secuencia del cartucho (duodécima iteración): animación
  // periódica de hasta 5 segmentos (juego/inicio/adicional) que se
  // encienden EN ORDEN, uno por tick. Vive en la FICHA del
  // cartucho (como el fin) y viaja al nivel superior del GWI
  // (campo «secuencia»); los campos sec_1..sec_5 apuntan a los
  // segmentos elegidos en el mapa.
  const CAMPOS_SECUENCIA = ['sec_1', 'sec_2', 'sec_3', 'sec_4', 'sec_5'];
  // Todos los campos que apuntan a otro segmento: los revisan las
  // uniones (re-apuntado a la raíz resultante), la verificación de
  // referencias colgantes y el descarte al cambiar de tipo.
  // F5-I15 (E1): incluye los sec_1..sec_5 de la Secuencia (viven en la
  // ficha del cartucho): sin ellos, unir un segmento de la Secuencia
  // dejaba su enlace apuntando a un absorbido y separarlo no lo anulaba.
  const TODOS_ENLACES = [...ENLACES_JUEGO, ...ENLACES_JUGADOR,
  ...ENLACES_COLISION, ...ENLACES_DIGITO, 'mostradoJunto',
  ...ENLACES_CONTADOR, ...CAMPOS_SECUENCIA];
  // Campos de una prop que pueden viajar en una entrada del historial
  // (para deshacer/rehacer por inversión). 'primero' es la marca de
  // jugador inicial (solo tipo jugador): la que el motor busca al
  // arrancar (F3-I3). Las propiedades del contador (F4-I9) también:
  // cambiar de tipo las descarta en la misma acción.
  const CAMPOS_PROP = [...TODOS_ENLACES, ...CONTADORES_COLISION, 'tipo',
    'orden', 'primero', 'colisionDe',
    'contadorInterno', 'valorInicial', 'direccion',
    'presentarCero',
    'finJuego', 'finContador',
    'secTicks', 'sec_1', 'sec_2', 'sec_3', 'sec_4', 'sec_5',
    // F4-I2: campos de la ficha del Director.
    'pausaSim', 'pausaEsp',
    'accCada', 'accResta', 'accMinimo',
    'aumentarCada'];
  const INVERSO = {
    izquierda: 'derecha', derecha: 'izquierda',
    arriba: 'abajo', abajo: 'arriba'
  };

  // Catálogo de tipos. Nº GWI = lo que se guarda en el JSON (evita
  // errores de texto); el color es SOLO de debug en pantalla, para
  // ver el tipo de cada segmento con el juego presentado:
  //   jugador (0) los que maneja el jugador con los botones; rojo
  //   juego   (1) por defecto, todos nacen así; negro
  //   inicio  (2) primer segmento de una ruta; verde. Los elementos
  //              aparecen según un parámetro aleatorio que elige
  //              RUTA; el número de ruta se asigna solo, por orden de
  //              aparición (determinista), contando desde 1.
  //   vida    (3) contador de vidas (disminuye por colisión); naranja
  //   muerte  (4) contador de muertes (aumenta por colisión); naranja
  // Los contadores forman una secuencia de encendidos (muertes) o de
  // apagados (vidas restantes); cuál de los dos comportamientos se
  // usa lo define un parámetro del JSON del cartucho (simplifica el
  // motor). Puede haber ambos tipos a la vez.
  const TIPOS = ['jugador', 'juego', 'inicio', 'vida', 'muerte', 'dígito', 'contador',
    'adicional', 'inicioAdicional'];
  // 'cartucho' NO está en TIPOS a propósito: nunca se elige en el
  // desplegable de cambio de tipo (no tiene sentido convertir un
  // segmento de arte en la ficha del cartucho) — se crea SOLO, al
  // arrancar la edición (F3-I11), y solo existe UNO.
  const TIPO_NUM = {
    jugador: 0, juego: 1, inicio: 2, vida: 3, muerte: 4,
    'dígito': 5, contador: 6, cartucho: 7,
    adicional: 8, inicioAdicional: 9
  };
  const COLOR_TIPO = {
    juego: '#000000', jugador: '#C00000',
    inicio: '#008000', vida: '#C06000', muerte: '#C06000',
    'dígito': '#7030A0', contador: '#1060B0',
    adicional: '#556B2F', inicioAdicional: '#8B4513',
    cartucho: '#606060'
  };
  // Tipos que pueden ser PUNTO DE COLISIÓN: los que forman las rutas
  // (juego e inicio). Un contador (vida/muerte) o un jugador no lo son.
  const TIPOS_COLISION = ['juego', 'inicio'];

  /**
   * Campos de enlace válidos para un tipo: jugador usa las cuatro
   * direcciones; el resto usa la cadena (siguiente/salvado/muerte).
   * @param {string} tipo - Tipo del segmento.
   * @returns {string[]} Nombres de los campos de enlace del tipo.
   */
  function _camposDe(tipo) {
    if (tipo === 'jugador') return ENLACES_JUGADOR;
    if (tipo === 'dígito') return ENLACES_DIGITO;
    if (tipo === 'contador') return ENLACES_CONTADOR;
    // Tipos adicionales (duodécima iteración): su ÚNICO enlace es
    // «siguiente» — bucles propios entre adicionales, nunca rutas.
    if (tipo === 'adicional' || tipo === 'inicioAdicional') {
      return ['siguiente'];
    }
    return ENLACES_JUEGO;
  }

  /**
   * Clasifica SIETE barras de un «8» por su GEOMETRÍA (F4-I9): las
   * tres horizontales por altura son a (arriba), g (centro) y d
   * (abajo); de las cuatro verticales, las de la derecha son b
   * (arriba) y c (abajo) y las de la izquierda f (arriba) y e
   * (abajo). Devuelve un mapa letra → grupo, o null si la geometría
   * no es la de un 8 (no hay 3 horizontales + 4 verticales, o hay
   * ambigüedad). Así el autor no marca letras a mano: dibuja el 8,
   * marca las siete barras y el sistema las nombra.
   * @param {Array<Object>} siete - Los SIETE grupos marcados.
   * @returns {?Object<string, Object>} Mapa letra → grupo, o null.
   */
  function _clasificarBarras(siete) {
    if (siete.length !== 7) return null;
    const horizontales = siete.filter(g => g.ancho > g.alto);
    const verticales = siete.filter(g => g.ancho <= g.alto);
    if (horizontales.length !== 3 || verticales.length !== 4) return null;
    const porY = (x, y) => (x.y - y.y) || (x.x - y.x);
    horizontales.sort(porY);
    const xMedia = siete.reduce((s, g) => s + g.x + g.ancho / 2, 0) / 7;
    const derecha = verticales.filter(g => g.x + g.ancho / 2 >= xMedia);
    const izquierda = verticales.filter(g => g.x + g.ancho / 2 < xMedia);
    if (derecha.length !== 2 || izquierda.length !== 2) return null;
    derecha.sort(porY);
    izquierda.sort(porY);
    return {
      a: horizontales[0], g: horizontales[1], d: horizontales[2],
      b: derecha[0], c: derecha[1],
      f: izquierda[0], e: izquierda[1]
    };
  }

  /**
   * ¿Es este grupo una BARRA de un dígito (F4-I9)? Las barras se
   * agruparon: dejaron de ser manejables en el editor (no se pintan
   * en el mapa ni se seleccionan; clicarlas selecciona su dígito),
   * pero siguen existiendo como segmentos con sus sprites: el GWI
   * las lleva porque el motor enciende cada barra por separado.
   * @param {Object} g - Grupo a comprobar.
   * @returns {boolean} true si es barra de un dígito.
   */
  function _esBarraDeDigito(g) {
    for (const x of grupos) {
      if (x.prop.tipo !== 'dígito') continue;
      for (const campo of ENLACES_DIGITO) {
        if (_grupoDeComp(x.prop[campo]) === g) return true;
      }
    }
    return false;
  }

  /**
   * ¿Es este grupo un DÍGITO agrupado por un contador (F4-I9 v3)?
   * Igual que las barras del dígito: deja de ser manejable en el
   * editor (no se pinta ni se selecciona; clicarlo selecciona su
   * contador) pero sigue viajando en el GWI — el motor enciende
   * las barras reales de cada posición.
   * @param {Object} g - Grupo a comprobar.
   * @returns {boolean} true si es dígito de un contador.
   */
  function _esDigitoDeContador(g) {
    for (const x of grupos) {
      if (x.prop.tipo !== 'contador') continue;
      for (const campo of ENLACES_CONTADOR) {
        if (_grupoDeComp(x.prop[campo]) === g) return true;
      }
    }
    return false;
  }

  /**
   * El CONTADOR dueño de un dígito (o null si es dígito libre).
   * @param {Object} g - Grupo dígito.
   * @returns {?Object} El contador que lo agrupó.
   */
  function _contadorDeDigito(g) {
    for (const x of grupos) {
      if (x.prop.tipo !== 'contador') continue;
      for (const campo of ENLACES_CONTADOR) {
        if (_grupoDeComp(x.prop[campo]) === g) return x;
      }
    }
    return null;
  }

  /**
   * El DÍGITO dueño de una barra (o null si es barra libre).
   * @param {Object} g - Grupo barra.
   * @returns {?Object} El dígito (o contador) que la agrupó.
   */
  function _digitoDeBarra(g) {
    for (const x of grupos) {
      if (x.prop.tipo !== 'dígito') continue;
      for (const campo of ENLACES_DIGITO) {
        if (_grupoDeComp(x.prop[campo]) === g) return x;
      }
    }
    return null;
  }

  /**
   * La PIEZA que maneja el editor para un grupo clicado (F4-I9 v3):
   * sube TODA la jerarquía de agrupados, no un solo nivel — clicar
   * una barra del «8» de un dígito que a su vez está dentro de un
   * contador selecciona el CONTADOR (la pieza visible), no el
   * dígito intermedio (oculto). Sin esto el clic se quedaba en el
   * dígito y el contador no se podía seleccionar NUNCA (bug v3:
   * «al pinchar encima es el dígito, no el contador»).
   * @param {Object} g - Grupo a nivel de píxel.
   * @returns {Object} La pieza visible que lo agrupa (o él mismo).
   */
  function _piezaDe(g) {
    let pieza = g;
    // Tres saltos como máximo: barra → dígito → contador, y
    // absorbido → pieza que lo absorbió (unión).
    for (let nivel = 0; nivel < 3; nivel++) {
      if (_esBarraDeDigito(pieza)) {
        pieza = _digitoDeBarra(pieza) || pieza;
      } else if (_esDigitoDeContador(pieza)) {
        pieza = _contadorDeDigito(pieza) || pieza;
      } else {
        const absorbente = _ficticioAbsorbente(pieza);
        if (!absorbente || absorbente === pieza) break;
        pieza = absorbente;
      }
    }
    return pieza;
  }

  /**
   * La PIEZA (ficticio de UNIÓN) que ABSORBIÓ a un grupo (v4), o
   * null. La unión ya no fusiona en un segmento existente: crea un
   * segmento NUEVO y los originales quedan marcados como
   * absorbidos — inertes, ocultos, y fuera del GWI (se eliminan al
   * generar el cartucho para el ESP).
   * @param {Object} g - Grupo posiblemente absorbido.
   * @returns {?Object} El ficticio que lo absorbió, o null.
   */
  function _ficticioAbsorbente(g) {
    for (const f of ficticios) {
      if (!f.miembros) continue;
      for (const r of f.miembros) {
        if (_grupoDeComp(r) === g) return _grupoDeComp(f.id);
      }
    }
    return null;
  }

  /**
   * ¿Está este grupo ABSORBIDO por una unión (v4)? Los absorbidos
   * no se manejan ni se pintan; tampoco viajan en el GWI.
   * @param {Object} g - Grupo a comprobar.
   * @returns {boolean} true si algún ficticio de unión lo absorbió.
   */
  function _esAbsorbido(g) {
    return _ficticioAbsorbente(g) !== null;
  }

  /**
   * Las SIETE BARRAS de un dígito, con sus letras (a–g), todas por
   * sus enlaces (el dígito es un FICTICIO: ninguna barra es él).
   * Devuelve null si falta alguna (dígito incompleto).
   * @param {Object} g - Grupo dígito.
   * @returns {?Object<string, Object>} Mapa letra → grupo, o null.
   */
  function _barrasDe(g) {
    const barras = {};
    for (const letra of LETRAS_BARRAS) {
      const barra = _grupoDeComp(g.prop['barra_' + letra]);
      if (!barra) return null;
      barras[letra] = barra;
    }
    return barras;
  }

  /**
   * Caja ENVOLVENTE de un dígito/contador (F4-I9 v3): el ficticio
   * nace con la envolvente de lo que agrupa, pero las barras y los
   * dígitos pueden tener reposiciones: se RECALCULA. Dígito: la
   * envolvente de sus siete barras. Contador: la de sus dígitos.
   * Para el resto de grupos es su propia caja.
   * @param {Object} g - Grupo.
   * @returns {{x:number, y:number, ancho:number, alto:number}} Caja.
   */
  function _cajaPresentable(g) {
    if (g.prop.tipo === 'dígito') {
      const barras = _barrasDe(g);
      if (!barras) {
        return {
          x: g.x, y: g.y,
          ancho: g.ancho, alto: g.alto
        };
      }
      let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
      for (const letra of LETRAS_BARRAS) {
        const b = barras[letra];
        const bx = b.x, by = b.y;
        x0 = Math.min(x0, bx); y0 = Math.min(y0, by);
        x1 = Math.max(x1, bx + b.ancho); y1 = Math.max(y1, by + b.alto);
      }
      return {
        x: x0, y: y0,
        ancho: x1 - x0, alto: y1 - y0
      };
    }
    if (g.prop.tipo === 'contador') {
      let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
      let hay = false;
      for (const campo of ENLACES_CONTADOR) {
        const d = _grupoDeComp(g.prop[campo]);
        if (!d) continue;
        const c = _cajaPresentable(d);
        hay = true;
        x0 = Math.min(x0, c.x); y0 = Math.min(y0, c.y);
        x1 = Math.max(x1, c.x + c.ancho); y1 = Math.max(y1, c.y + c.alto);
      }
      if (!hay) {
        return {
          x: g.x, y: g.y,
          ancho: g.ancho, alto: g.alto
        };
      }
      return {
        x: x0, y: y0,
        ancho: x1 - x0, alto: y1 - y0
      };
    }
    return {
      x: g.x, y: g.y,
      ancho: g.ancho, alto: g.alto
    };
  }

  /**
   * IMAGEN FUSIONADA de un dígito/contador (F4-I9 v3): un canvas
   * nuevo con la pieza única que el editor maneja y pinta — las
   * siete barras del «8» (dígito) o las barras de TODOS sus
   * dígitos (contador). Se compone PÍXEL A PÍXEL, con el MISMO
   * criterio que la unión del extractor (mapa de bits sobre la
   * envolvente): dibujar los sprites con drawImage salía MAL (bug
   * F4-I9 v2) porque cada sprite de barra es OPACO (blanco + negro)
   * y al pintar una barra sobre la anterior su fondo blanco
   * BORRABA los píxeles de la que ya estaba. Es también el SPRITE
   * que el ficticio lleva al GWI: al recargar un cartucho la
   * previsualización pinta esta imagen (las barras y los dígitos
   * agrupados no se pintan: están dentro). Para el resto de grupos
   * devuelve su sprite de siempre.
   * @param {Object} g - Grupo dígito o contador.
   * @returns {?Object} Canvas con la pieza fusionada (blanco si
   *   está incompleto: la verificación lo cantará).
   */
  /**
   * FUSIONA un conjunto de grupos en un canvas (OR de píxeles, el
   * criterio de la unión del extractor): primero los bits, luego
   * el canvas, para que ningún sprite OPACO (blanco + negro) tape
   * con su fondo los píxeles ya puestos (bug v2). Cada grupo pinta
   * sus componentes.
   * @param {Array<Object>} listaP - Grupos a fusionar.
   * @param {{x:number, y:number, ancho:number, alto:number}} caja -
   *   Caja (presentada) que marca el origen del canvas.
   * @returns {Object} Canvas con la fusión (blanco si nada).
   */
  /**
   * Los grupos que APORTAN píxeles a una pieza (v4.6): un grupo real
   * aporta él mismo; un FICTICIO de unión aporta los de sus
   * ABSORBIDOS, en recursión (unir 3 con F01 debe pintar los píxeles
   * de 1, 2 y 3, no nada — F01 no tiene píxeles propios). Los
   * ficticios de dígito/contador no aportan nada por aquí (sus
   * barras se toman con barrasDe).
   * @param {Object} g - Grupo (real o ficticio).
   * @returns {Array<Object>} Grupos reales con píxeles.
   */
  function _aportantes(g) {
    if (!g) return [];
    if (g.raiz >= 0) return [g];
    const f = ficticios.find(x => x.id === g.raiz);
    if (!f || !f.miembros) return [];
    const lista = [];
    for (const r of f.miembros) {
      lista.push(..._aportantes(_grupoDeComp(r)));
    }
    return lista;
  }

  function _fusionarGrupos(listaP, caja) {
    const anchoC = Math.max(1, caja.ancho), altoC = Math.max(1, caja.alto);
    const bits = new Uint8Array(anchoC * altoC);
    for (const b of listaP) {
      if (!b) continue;
      const ox = -caja.x, oy = -caja.y;
      for (const m of b.miembros) {
        const comp = base.comps[m];
        if (!comp) continue;
        for (const p of comp.pixeles) {
          const sx = (p % base.ancho) + ox;
          const sy = ((p / base.ancho) | 0) + oy;
          if (sx < 0 || sy < 0 || sx >= anchoC || sy >= altoC) continue;
          bits[sy * anchoC + sx] = 1;
        }
      }
    }
    const c = document.createElement('canvas');
    c.width = anchoC;
    c.height = altoC;
    const ctx = c.getContext('2d');
    const idd = ctx.createImageData(anchoC, altoC);
    const d = idd.data;
    for (let i = 0; i < bits.length; i++) {
      const j = i * 4;
      if (bits[i]) { d[j] = 0; d[j + 1] = 0; d[j + 2] = 0; d[j + 3] = 255; }
      else { d[j] = 255; d[j + 1] = 255; d[j + 2] = 255; d[j + 3] = 255; }
    }
    ctx.putImageData(idd, 0, 0);
    return c;
  }

  /**
   * FIRMA de composición de una pieza (v4.7): identifica qué píxeles
   * componen su imagen fusionada. Las piezas de UNIÓN son INMUTABLES
   * (sus absorbidos se fijan al nacer y solo «Separar» las elimina
   * enteras): firma fija. Dígito: sus siete barras; contador: sus
   * dígitos (con la firma de cada uno: si un dígito cambia sus
   * barras, el contador entero cambia). Cambiar un enlace cambia la
   * firma: la caché de la imagen se invalida y se redibuja UNA vez.
   * @param {Object} g - Grupo pieza.
   * @returns {string} Firma de su composición.
   */
  function _firmaPieza(g) {
    if (g.prop.tipo === 'dígito') {
      return 'D' + ENLACES_DIGITO.map(c => g.prop[c]).join(',');
    }
    return 'C' + ENLACES_CONTADOR.map(c => {
      const d = _grupoDeComp(g.prop[c]);
      return d ? _firmaPieza(d) : '-';
    }).join('|');
  }

  function _imagenFusionada(g) {
    // Cartucho (F3-I11): pieza SIN píxeles — su "imagen" es un
    // lienzo en blanco (solo es una marca en el mapa; nunca se
    // presenta en pantalla). Se materializa UNA vez y se cachea en
    // el propio ficticio (criterio v4.7).
    if (g.prop.tipo === 'cartucho') {
      const fC = ficticios.find(x => x.id === g.raiz);
      if (!fC) return null;
      if (!fC.imagen) {
        const c = document.createElement('canvas');
        c.width = Math.max(1, g.ancho);
        c.height = Math.max(1, g.alto);
        fC.imagen = c;
      }
      return fC.imagen;
    }
    // Pieza de UNIÓN (v4): la imagen fusionada de sus ABSORBIDOS
    // (OR de píxeles sobre la caja de nacimiento de la pieza). Los
    // absorbidos pueden ser a su vez piezas de unión (unir 3 con
    // F01): `_aportantes` los EXPANDE en recursión hasta los grupos
    // de píxeles reales — sin esto F02 nacía sin la parte de F01
    // (un ficticio no tiene píxeles propios) (bug v4.6).
    if (g.raiz < 0 && g.prop.tipo !== 'dígito' && g.prop.tipo !== 'contador') {
      const f = ficticios.find(x => x.id === g.raiz);
      if (!f || !f.miembros) return null;
      // DIBUJAR UNA SOLA VEZ (v4.7): la pieza de unión es inmutable
      // (sus absorbidos no cambian) — la fusión se materializa en un
      // canvas la PRIMERA vez y se cachea en el propio ficticio;
      // editor, sprites del GWI y el futuro generador del ESP usan
      // esa imagen ya hecha, nunca redibujada.
      if (!f.imagen) {
        const caja = { x: g.x, y: g.y, ancho: g.ancho, alto: g.alto };
        const reales = [];
        for (const r of f.miembros) reales.push(..._aportantes(_grupoDeComp(r)));
        f.imagen = _fusionarGrupos(reales, caja);
      }
      return f.imagen;
    }
    if (g.prop.tipo !== 'dígito' && g.prop.tipo !== 'contador') {
      return (g.sprite && g.sprite.imagen) || null;
    }
    // DIBUJAR UNA SOLA VEZ (v4.7) también en dígito/contador: la
    // imagen fusionada se cachea en el ficticio con su FIRMA de
    // composición; si sus enlaces cambian (elegir/quitar una barra o
    // un dígito), la firma cambia y se redibuja UNA vez. Sin firma
    // igual se devolvería una imagen obsoleta; sin caché se
    // redibujaría en cada pintado del mapa, de la pantalla de
    // autoria, de la lista del motor y del guardado.
    const f2 = ficticios.find(x => x.id === g.raiz);
    if (f2) {
      const firma = _firmaPieza(g);
      if (f2.imagen && f2.firma === firma) return f2.imagen;
      const caja = _cajaPresentable(g);
      // Las barras que componen la pieza: las del dígito, o las de
      // todos los dígitos del contador (los incompletos se saltan).
      const barrasTotal = [];
      if (g.prop.tipo === 'dígito') {
        const barras = _barrasDe(g);
        if (barras) barrasTotal.push(...Object.values(barras));
      } else {
        for (const campo of ENLACES_CONTADOR) {
          const d = _grupoDeComp(g.prop[campo]);
          if (!d) continue;
          const barras = _barrasDe(d);
          if (barras) barrasTotal.push(...Object.values(barras));
        }
      }
      f2.imagen = _fusionarGrupos(barrasTotal, caja);
      f2.firma = firma;
      return f2.imagen;
    }
    const caja = _cajaPresentable(g);
    const barrasTotal = [];
    if (g.prop.tipo === 'dígito') {
      const barras = _barrasDe(g);
      if (barras) barrasTotal.push(...Object.values(barras));
    } else {
      for (const campo of ENLACES_CONTADOR) {
        const d = _grupoDeComp(g.prop[campo]);
        if (!d) continue;
        const barras = _barrasDe(d);
        if (barras) barrasTotal.push(...Object.values(barras));
      }
    }
    return _fusionarGrupos(barrasTotal, caja);
  }

  /**
   * Registra una acción INDIVIDUAL: los campos cambiados de un
   * componente (null = anulado).
   * Atajo de registrarCambios para una sola entrada. El parámetro
   * "antes" lleva el valor PREVIO de cada campo tocado (log de
   * eventos completo): es lo que permite deshacer por inversión
   * @param {number} comp - Índice de componente.
   * @param {Object} campos - Campos cambiados (valor nuevo o null).
   * @param {?Object} antes - Valor previo de cada campo tocado, o
   *   null si no existía.
   *   antes, la entrada es la de siempre.
   * @returns {void}
   */
  function _registrarCambio(comp, campos, antes) {
    const e = Object.assign({ segmento: comp }, campos);
    if (antes !== undefined) e.antes = antes;
    _registrarCambios([e]);
  }

  /**
   * Registra una acción del historial, atómica: TODAS las entradas
   * comparten el mismo nº de acción; "relacionados" lleva el nº de
   * la primera entrada del grupo (0 si la acción solo tiene una).
   * Deshacer la última acción = retirar todas las entradas con ese
   * nº y aplicar la inversa de cada una (campo "antes").
   * Registrar una acción nueva VACÍA la pila de rehacer: el undo es
   * lineal, una rama deshecha no puede revivir junto a cambios
   * posteriores.
   * @param {Array<Object>} entradas - Entradas de la acción (sin n
   *   ni relacionados: se añaden aquí).
   * @returns {void}
   */
  function _registrarCambios(entradas, derivada) {
    rehacibles = [];          // acción nueva: nada que rehacer
    ultimoOp++;
    const n = ultimoOp;
    const relacionados = (entradas.length > 1) ? n : 0;
    for (const e of entradas) {
      const entrada = Object.assign({ n: n, relacionados: relacionados }, e);
      if (derivada) entrada.auto = true;
      cambios.push(entrada);
    }
  }

  /**
   * F5-I15 (E9): registra un cambio DERIVADO, calculado por la
   * verificación (los inversos de direcciones, de colisión y de
   * «mostrar junto a»). Entra en el historial (el GWI no guarda estado
   * final: sin él se perdería al recargar) pero marcado «auto»: no es
   * una acción del autor, y deshacer lo retira junto con la acción
   * del autor anterior (ver deshacer), no como un paso invisible.
   * @param {number} comp - Componente.
   * @param {Object} campos - Valores nuevos.
   * @param {Object} antes - Valores anteriores.
   * @returns {void}
   */
  function _registrarCambioDerivado(comp, campos, antes) {
    const e = Object.assign({ segmento: comp }, campos);
    if (antes !== undefined) e.antes = antes;
    _registrarCambios([e], true);
  }

  /**
   * Reproduce un historial completo sobre el estado de nacimiento
   * (props/uniones a cero) y lo instala como vigente. Es el
   * camino de carga de un GWI y el FALLBACK de deshacer cuando un
   * bloque antiguo no lleva "antes" (GWI previos a la iteración 10).
   * Solo aplica los valores NUEVOS de cada entrada (ignora "antes").
   * @param {Array<Object>} lista - Entradas del historial, en orden.
   * @returns {void}
   */
  function _reproducirCambios(lista) {
    props = new Map();
    uniones = [];
    cambios = [];
    ficticios = [];
    ficticioSeq = 0;
    // Ids legibles (v4): el GWI guarda los ficticios como F01, F02...
    // (mismos ids que sus sprites); en memoria son su raíz negativa.
    // F5-I15 (E2): el HISTORIAL que queda en memoria también se guarda
    // con las raíces numéricas; antes conservaba los «F01» del fichero
    // y deshacer no encontraba la pieza (la acción se «deshacía» sin
    // efecto y el historial quedaba desalineado). Los GWIs antiguos con
    // el número negativo crudo siguen cargando igual.
    const idLegible = (v) =>
      (typeof v === 'string' && /^F\d+$/.test(v)) ? -Number(v.slice(1)) : v;
    const aNumerico = (e) => {
      const o = Object.assign({}, e);
      if (o.segmento !== undefined) o.segmento = idLegible(o.segmento);
      if (Array.isArray(o.altaFicticio)) {
        o.altaFicticio = o.altaFicticio.slice();
        o.altaFicticio[0] = idLegible(o.altaFicticio[0]);
      }
      if (Array.isArray(o.bajaFicticio)) {
        o.bajaFicticio = o.bajaFicticio.slice();
        o.bajaFicticio[0] = idLegible(o.bajaFicticio[0]);
      }
      if (o.antes && typeof o.antes === 'object') {
        o.antes = Object.assign({}, o.antes);
        for (const k of Object.keys(o.antes)) o.antes[k] = idLegible(o.antes[k]);
      }
      // Los VALORES de los enlaces también pueden llevar F01 (un
      // enlace re-apuntado a una pieza de unión): misma conversión.
      for (const campoE of TODOS_ENLACES) {
        if (o[campoE] !== undefined && o[campoE] !== null) {
          o[campoE] = idLegible(o[campoE]);
        }
      }
      return o;
    };
    for (const c of lista) {
      const entrada = aNumerico(c);          // lo que queda en el historial
      const copia = aNumerico(c);            // lo que se reproduce
      delete copia.n;
      delete copia.relacionados;
      delete copia.antes;      // el replay aplica el valor NUEVO
      if (Array.isArray(copia.unir)) {
        uniones.push([copia.unir[0], copia.unir[1]]);
      } else if (Array.isArray(copia.altaFicticio)) {
        // Alta de segmento ficticio (F4-I9 v3): el id viaja en la
        // entrada, el orden del historial lo hace determinista. El
        // 6º elemento (v4, opcional) son los ABSORBIDOS cuando la
        // pieza nace de una UNIÓN.
        const [id, x, y, ancho, alto, miembros] = copia.altaFicticio;
        ficticios.push({
          id: id, x: x, y: y, ancho: ancho, alto: alto,
          miembros: miembros || null
        });
        ficticioSeq = Math.max(ficticioSeq, -id);
      } else if (Array.isArray(copia.bajaFicticio)) {
        const [id] = copia.bajaFicticio;
        ficticios = ficticios.filter(f => f.id !== id);
      } else if (Array.isArray(copia.separar)) {
        const [a, b] = copia.separar;
        uniones = uniones.filter(([x, y]) =>
          !((x === a && y === b) || (x === b && y === a)));
      } else {
        const comp = copia.segmento;
        delete copia.segmento;
        Object.assign(_propsDe(comp), copia);
      }
      cambios.push(entrada);
    }
    ultimoOp = (cambios.length > 0) ? cambios[cambios.length - 1].n : 0;
  }

  /**
   * Quita un par de la lista de uniones, en CUALQUIER de los dos
   * órdenes (inversa de "unir").
   * @param {Array<number>} par - Par [compA, compB] a retirar.
   * @returns {void}
   */
  function _quitarParUnion(par) {
    const [a, b] = par;
    uniones = uniones.filter(([x, y]) =>
      !((x === a && y === b) || (x === b && y === a)));
  }

  /**
   * Aplica la INVERSA de una entrada del historial usando el valor
   * previo guardado en "antes" (props) o la operación
   * estructural opuesta (unir retira el par, separar lo re-añade).
   * Solo se invierten entradas con "antes" (o unir/separar): las
   * legacy sin antes se deshacen por replay, nunca a ciegas.
   * @param {Object} e - Entrada del historial a invertir.
   * @returns {void}
   */
  function _invertirEntrada(e) {
    if (Array.isArray(e.unir)) {
      _quitarParUnion(e.unir);
    } else if (Array.isArray(e.altaFicticio)) {
      // Inversa del alta: el ficticio (y sus props) desaparece.
      const [id] = e.altaFicticio;
      ficticios = ficticios.filter(f => f.id !== id);
      props.delete(id);
    } else if (Array.isArray(e.bajaFicticio)) {
      // Inversa de la baja: el ficticio vuelve, con su caja y sus
      // absorbidos (si era una pieza de unión).
      const [id, x, y, ancho, alto, miembros] = e.bajaFicticio;
      ficticios.push({
        id: id, x: x, y: y, ancho: ancho, alto: alto,
        miembros: miembros || null
      });
      ficticioSeq = Math.max(ficticioSeq, -id);
    } else if (Array.isArray(e.separar)) {
      uniones.push([e.separar[0], e.separar[1]]);
    } else {
      const p = _propsDe(e.segmento);
      for (const campo of CAMPOS_PROP) {
        if (campo in e) p[campo] = e.antes[campo];
      }
    }
  }

  /**
   * F5-I15 (E5): ¿es este bloque del historial el ALTA de la ficha del
   * cartucho (el ficticio de tipo «cartucho» y su tipo)? Esa acción la
   * hace la autoría sola al arrancar; deshacerla dejaría el editor sin
   * ficha del cartucho.
   * @param {Array<Object>} bloque - Entradas de una acción del historial.
   * @returns {boolean} true si el bloque solo da de alta la ficha.
   */
  function _esBloqueDeFicha(bloque) {
    return bloque.length > 0 && bloque.every(e => {
      const alta = Array.isArray(e.altaFicticio);
      const p = props.get(alta ? e.altaFicticio[0] : e.segmento);
      return !!p && p.tipo === 'cartucho' && (alta || e.tipo === 'cartucho');
    });
  }

  /**
   * DESHACE la última acción del historial, ATÓMICA: todas las
   * entradas con el nº de la última comparten acción (unir con sus
   * re-apuntados/anulaciones, intercambio de Subir/Bajar, etc.) y se
   * retiran y revierten JUNTAS, en orden inverso. Cada entrada se
   * invierte con su "antes" — sin reinterpretar nada. Si el bloque
   * es legacy (sin "antes", GWI anterior a la iteración 10), se
   * deshace reproduciendo el historial restante (mismo resultado,
   * camino seguro). El bloque deshecho queda en la pila de rehacer;
   * registrar una acción nueva la vacía (undo lineal).
   * @returns {void}
   */
  function deshacer() {
    if (!base) {
      baseDirector.avisar('Nada que deshacer: no hay autoría en curso.');
      return;
    }
    // F5-I15 (E9): los bloques «auto» (inversos derivados por la
    // verificación) no son del autor: se retiran con el paso siguiente.
    let hecho;
    do {
      hecho = _deshacerBloque();
    } while (hecho && hecho.auto && cambios.length > 0);
  }

  /**
   * Deshace UN bloque del historial (ver deshacer).
   * @returns {?{auto:boolean}} null si no había nada que deshacer.
   */
  function _deshacerBloque() {
    if (cambios.length === 0) {
      baseDirector.avisar('Nada que deshacer.');
      return null;
    }
    const nUlt = cambios[cambios.length - 1].n;
    const bloque = cambios.filter(c => c.n === nUlt);
    const resto = cambios.filter(c => c.n !== nUlt);
    // F5-I15 (E5): el alta de la ficha del cartucho NO es una acción del
    // autor (la crea la propia autoría al arrancar): no se deshace.
    if (_esBloqueDeFicha(bloque)) {
      baseDirector.avisar('Nada que deshacer.');
      return null;
    }
    const invertible = bloque.every(e =>
      Array.isArray(e.unir) || Array.isArray(e.separar) ||
      Array.isArray(e.altaFicticio) || Array.isArray(e.bajaFicticio) ||
      e.antes !== undefined);
    if (invertible) {
      for (let i = bloque.length - 1; i >= 0; i--) {
        _invertirEntrada(bloque[i]);
      }
      cambios = resto;
      ultimoOp = (resto.length > 0) ? resto[resto.length - 1].n : 0;
    } else {
      _reproducirCambios(resto);   // legacy: replay del resto
    }
    rehacibles.push(bloque);
    eleccion = null;
    marcados = new Set();
    seleccion = null;
    _reconstruir();
    _refrescar();
    _$('panelSegmento').classList.add('oculto');
    _$('panelSegmento').replaceChildren();
    baseDirector.avisar('Deshecha la acción ' + nUlt + ' (' +
      bloque.length + ' cambio(s)).');
    return { auto: !!bloque[0].auto };
  }

  /**
   * REHACE el último bloque deshecho: aplica cada entrada hacia
   * delante (valor nuevo, pares re-añadidos) y la devuelve al
   * historial con su nº original — no ha habido acciones nuevas
   * desde el deshacer (registrar una vacía la pila), así que
   * reponer el bloque deja el historial exactamente como estaba.
   * @returns {void}
   */
  function rehacer() {
    if (!base) {
      baseDirector.avisar('Nada que rehacer: no hay autoría en curso.');
      return;
    }
    if (rehacibles.length === 0) {
      baseDirector.avisar('Nada que rehacer.');
      return;
    }
    // F5-I15 (E9): se rehace el bloque del autor y, tras él, los
    // derivados («auto») que se retiraron con él.
    _rehacerBloque();
    while (rehacibles.length > 0 && rehacibles[rehacibles.length - 1][0].auto) {
      _rehacerBloque();
    }
  }

  /**
   * Rehace UN bloque (ver rehacer).
   * @returns {void}
   */
  function _rehacerBloque() {
    const bloque = rehacibles.pop();
    for (const e of bloque) {
      if (Array.isArray(e.unir)) {
        uniones.push([e.unir[0], e.unir[1]]);
      } else if (Array.isArray(e.altaFicticio)) {
        const [id, x, y, ancho, alto, miembros] = e.altaFicticio;
        ficticios.push({
          id: id, x: x, y: y, ancho: ancho, alto: alto,
          miembros: miembros || null
        });
        ficticioSeq = Math.max(ficticioSeq, -id);
      } else if (Array.isArray(e.bajaFicticio)) {
        const [id] = e.bajaFicticio;
        ficticios = ficticios.filter(f => f.id !== id);
      } else if (Array.isArray(e.separar)) {
        _quitarParUnion(e.separar);
      } else {
        const p = _propsDe(e.segmento);
        for (const campo of CAMPOS_PROP) {
          if (campo in e) p[campo] = e[campo];
        }
      }
      cambios.push(e);
    }
    ultimoOp = bloque[0].n;
    eleccion = null;
    marcados = new Set();
    seleccion = null;
    _reconstruir();
    _refrescar();
    _$('panelSegmento').classList.add('oculto');
    _$('panelSegmento').replaceChildren();
    baseDirector.avisar('Rehecha la acción ' + bloque[0].n + ' (' +
      bloque.length + ' cambio(s)).');
  }

  /**
   * Propiedades de un segmento recién nacido (todas por defecto):
   * tipo juego, "orden" vacío (clave de ordenación del número de
   * ruta/contador) y los enlaces de ambos tipos vacíos (excluyentes).
   * @returns {Object} Props por defecto.
   */
  function _propPorDefecto() {
    return {
      tipo: 'juego', orden: null, siguiente: null, salvado: null, muerte: null,
      izquierda: null, derecha: null, arriba: null, abajo: null,
      primero: null,
      colision: null, salvadoContador: null, muerteContador: null,
      mostrarJunto: null, mostradoJunto: null,
      colisionDe: null,
      barra_a: null, barra_b: null, barra_c: null, barra_d: null,
      barra_e: null, barra_f: null, barra_g: null,
      digito_1: null, digito_2: null, digito_3: null, digito_4: null,
      contadorInterno: null, valorInicial: 0,
      direccion: 'ascendente', presentarCero: true,
      finJuego: null, finContador: null,
      secTicks: null, sec_1: null, sec_2: null, sec_3: null,
      sec_4: null, sec_5: null,
      // F4-I2 (ficha del Director): pausas por plataforma,
      // aceleración y política de rutas. null = el GWI no
      // lo declara (el motor usa sus valores por defecto:
      // 500 ms, sin acelerar, máximo de simultáneas 1).
      pausaSim: null, pausaEsp: null,
      accCada: null, accResta: null, accMinimo: null,
      aumentarCada: null
    };
  }

  /**
   * Atajo de document.getElementById.
   * @param {string} id - Identificador del elemento.
   * @returns {HTMLElement} Elemento con ese id, o null si no existe.
   */
  function _$(id) { return document.getElementById(id); }

  /**
   * Propiedades de un COMPONENTE (crea las por defecto si no existen).
   * Es la fuente de verdad: reconstruir fusiona estas en g.prop,
   * pero los cambios se escriben AQUÍ para sobrevivir.
   * @param {number} comp - Índice de componente.
   * @returns {Object} Props del componente.
   */
  function _propsDe(comp) {
    let p = props.get(comp);
    if (!p) {
      p = _propPorDefecto();
      props.set(comp, p);
    }
    return p;
  }

  /**
   * Identificador legible y determinista de un grupo por su posición
   * en la lista de grupos: seg_NNN.
   * @param {Object} g - Grupo.
   * @returns {string} Identificador seg_NNN.
   */
  function _segId(g) {
    // Los FICTICIOS (v4) se llaman como su imagen: F01, F02... El
    // número sale de su raíz negativa (-1 → F01). Así la pieza de
    // una unión se llama igual que el sprite img_F01 que lleva, y
    // los absorbidos quedan «fusionados con F01», no con un
    // correlativo seg_105 que no dice nada.
    if (g.raiz < 0) {
      return 'F' + String(-g.raiz).padStart(2, '0');
    }
    return 'seg_' + String(grupos.indexOf(g)).padStart(3, '0');
  }

  /**
   * Grupo actual de un índice de componente (cualquier miembro
   * resuelve al grupo entero).
   * @param {number} i - Índice de componente.
   * @returns {?Object} Grupo, o null si no está en ninguno.
   */
  function _grupoDeComp(i) { return indiceGrupo.get(i) || null; }

  /**
   * El grupo de un PÍXEL del mapa (F3-I11): OJO al centinela — los
   * píxeles sin componente viajan como -1 en indicePixel, y los
   * FICTICIOS usan ids NEGATIVOS (-1 = F01), así que consultar
   * _grupoDeComp(-1) entregaría la pieza ficticia en un pixel VACÍO.
   * Solo se consulta el índice cuando el píxel tiene componente.
   * @param {number} x - Coordenada de imagen.
   * @param {number} y - Coordenada de imagen.
   * @returns {?Object} Grupo del píxel, o null si es vacío.
   */
  function _grupoDelPixel(x, y) {
    const i = base.indicePixel[y * base.ancho + x];
    return (i >= 0) ? _grupoDeComp(i) : null;
  }

  /**
   * Resuelve un enlace (índice de componente) a su segId legible.
   * @param {?number} valor - Índice de componente del destino.
   * @returns {?string} segId del destino, o null.
   */
  function _resolverEnlace(valor) {
    if (valor === null || valor === false) return null;
    const g = _grupoDeComp(valor);
    return g ? _segId(g) : null;
  }

  // ---- Reconstrucción ----

  /**
   * Re-agrupa los componentes con las uniones vigentes y recalcula
   * sprites, grupos, índices y la prop fusionada (g.prop) de cada
   * grupo. El merge de propiedades: el PRIMER valor no nulo de cada
   * campo gana; conflicto (aviso) solo si un miembro POSTERIOR
   * discrepa de uno fijado.
   * sin tocar la geometría extraída. Fuente de verdad: props por
   * componente (lo que se escribe allí sobrevive aquí).
   * @returns {void}
   */
  function _reconstruir() {
    const r = baseExtractor.reagrupar(base, uniones);
    sprites = r.sprites;
    grupos = r.grupos;
    indiceGrupo = new Map();
    for (const g of grupos) {
      for (const m of g.miembros) indiceGrupo.set(m, g);
    }
    // Segmentos FICTICIOS (F4-I9 v3): dígito y contador son grupos
    // sin componente de imagen — entran AL FINAL de la lista (sus
    // números en el mapa son los últimos: las barras agrupadas se
    // ocultan y el ficticio aparece como segmento nuevo). Su raíz
    // negativa no choca con ningún índice de componente.
    for (const f of ficticios) {
      const g = {
        miembros: [f.id], raiz: f.id,
        x: f.x, y: f.y, ancho: f.ancho, alto: f.alto,
        spriteId: null, sprite: null,
        prop: null, dx: 0, dy: 0
      };
      grupos.push(g);
      indiceGrupo.set(f.id, g);
    }
    for (const g of grupos) {
      g.prop = _propPorDefecto();
      // Merge de propiedades de los miembros: el PRIMER valor no nulo
      // de cada campo gana; solo hay conflicto (y aviso) si un
      // miembro POSTERIOR discrepa de uno anterior. El default NO
      // cuenta como valor fijado: si no, un tipo distinto de 'juego'
      // se tomaba por "conflicto" contra el default y se ignoraba
      // (bug de los colores: el tipo nunca cambiaba al pintar).
      const fijados = new Set();
      for (const m of g.miembros) {
        const p = props.get(m);
        if (!p) continue;
        for (const campo of Object.keys(g.prop)) {
          const nuevo = p[campo];
          // F5-I15 (E3): el false de «presentarCero» es un valor FIJADO
          // (el defecto es true); saltarlo lo devolvía a true al
          // reconstruir y el GWI nunca lo llevaba.
          if (nuevo === null || (nuevo === false && campo !== 'presentarCero')) continue;
          if (fijados.has(campo)) {
            if (nuevo !== g.prop[campo]) {
              console.warn('[autoría] conflicto de "' + campo + '" al unir ' +
                _segId(g) + ': se conserva el primero.');
            }
            continue;
          }
          g.prop[campo] = nuevo;
          fijados.add(campo);
        }
      }
      // Enlaces excluyentes: solo los del tipo quedan; los del otro, fuera.
      const camposFuera = (g.prop.tipo === 'jugador')
        ? ENLACES_JUEGO : ENLACES_JUGADOR;
      for (const campo of camposFuera) {
        if (g.prop[campo] !== null) {
          console.warn('[autoría] ' + _segId(g) + ' es ' + g.prop.tipo +
            ': se descarta su enlace "' + campo + '" (tipos excluyentes).');
          g.prop[campo] = null;
        }
      }
    }
    // VISIBILIDAD (petición del usuario, F4-I9 v3): cada grupo lleva
    // la propiedad «oculto» calculada AQUÍ, una vez por
    // reconstrucción: un segmento agrupado (barra de un dígito,
    // dígito de un contador) no se ve ni se maneja — está DENTRO de
    // la imagen fusionada de la pieza que lo agrupa. El mapa, la
    // pantalla de autoria, la lista del motor y la selección leen
    // SOLO esta propiedad (nadie recorre los enlaces por su
    // cuenta), y además viaja en el GWI (visible:false) para que
    // el motor y la previsualización tampoco la recalculen.
    for (const g of grupos) {
      g.absorbido = _esAbsorbido(g);        // absorbido por una unión (v4)
      g.oculto = g.absorbido ||
        _esBarraDeDigito(g) || _esDigitoDeContador(g);
    }
    // Sprites de los FICTICIOS (F4-I9 v3): la IMAGEN FUSIONADA de lo
    // que agrupan es su sprite — así el GWI lleva la pieza completa
    // (la previsualización de un cartucho cargado la pinta) y el
    // editor la maneja como una sola. Un canvas en blanco si está
    // incompleto (la verificación lo cantará).
    for (const g of grupos) {
      if (g.raiz >= 0) continue;
      const caja = _cajaPresentable(g);
      const sprite = {
        id: 'img_F' + String(-g.raiz).padStart(2, '0'),
        ancho: Math.max(1, caja.ancho), alto: Math.max(1, caja.alto),
        imagen: _imagenFusionada(g)
      };
      sprites.push(sprite);
      g.spriteId = sprite.id;
      g.sprite = sprite;
    }
    // PUENTE (corrección del 23-10-2026): tras cada reconstrucción, la
    // Secuencia de la ficha llega VIVA al puente — el motor la lee
    // (comunListas.secuenciaDeCartucho) al iniciar; sin esto, definirla en
    // el editor y pulsar Start SIN recargar el GWI dejaba el puente
    // en null: las animaciones no se lanzaban nunca.
    _sincronizarSecuencia();
    _sincronizarDirector();   // F4-I2: pausas/aceleración/rutas en vivo
  }

  /**
   * Número (posición) de un segmento numerable dentro de su familia
   * ('inicio', 'vida' o 'muerte'). SISTEMA COHERENTE DE 1..N,
   * renumerando en cada cambio: la familia se ordena por "orden" y
   * desempate por posición en grupos (determinista); el número de
   * cada uno es su POSICIÓN en ese orden. Subir o bajar mueve el
   * "orden" relativo, y al recalcular todos quedan 1..N sin huecos
   * ni duplicados: cambiar un número es reordenar la lista entera.
   * @param {Object} g - Grupo del segmento.
   * @param {string} familia - 'inicio', 'vida' o 'muerte'.
   * @returns {number} Posición 1..N en la familia.
   */
  function _numeroDe(g, familia) {
    // F5-I15 (E6): los ABSORBIDOS por una unión no cuentan en la familia
    // (la pieza que los absorbe ya cuenta por ellos).
    const grupoF = grupos.filter(x => x.prop.tipo === familia && !x.absorbido);
    grupoF.sort((a, b) => ((a.prop.orden || 0) - (b.prop.orden || 0)) ||
      (grupos.indexOf(a) - grupos.indexOf(b)));
    return grupoF.indexOf(g) + 1;
  }

  /**
   * Intercambia el orden de un segmento con su vecino en su familia.
   * IMPORTANTE: se escribe en la prop del COMPONENTE (propsDe), no en
   * g.prop (la copia fusionada que reconstruir recalcula y descarta).
   * @param {Object} g - Grupo a mover.
   * @param {number} delta - -1 para subir, +1 para bajar.
   * @returns {boolean} true si se movió; false si ya era extremo.
   */
  function _moverNumero(g, delta) {
    const familia = g.prop.tipo;
    // F5-I15 (E6): los ABSORBIDOS por una unión no cuentan en la familia
    // (la pieza que los absorbe ya cuenta por ellos).
    const grupoF = grupos.filter(x => x.prop.tipo === familia && !x.absorbido);
    grupoF.sort((a, b) => ((a.prop.orden || 0) - (b.prop.orden || 0)) ||
      (grupos.indexOf(a) - grupos.indexOf(b)));
    const i = grupoF.indexOf(g);
    const j = i + delta;
    if (j < 0 || j >= grupoF.length) return false;
    // MATERIALIZAR "orden" efectivo 1..N ANTES de intercambiar:
    // nace null y el intercambio null<->null no cambiaba nada (el
    // número no se movía nunca). Con (orden||0) la ordenación es
    // estable también con nulls mezclados con valores.
    const viejos = new Map(grupoF.map(x => [x.raiz, _propsDe(x.raiz).orden]));
    for (let k = 0; k < grupoF.length; k++) {
      _propsDe(grupoF[k].raiz).orden = k + 1;
    }
    // Intercambio con el vecino (sobre valores YA materializados).
    const o = _propsDe(g.raiz).orden;
    _propsDe(g.raiz).orden = _propsDe(grupoF[j].raiz).orden;
    _propsDe(grupoF[j].raiz).orden = o;
    // UNA acción atómica con TODAS las entradas cuyo "orden"
    // almacenado cambió (materializaciones incluidas): un solo gesto
    // del autor, se deshace junto.
    const entradas = [];
    for (const x of grupoF) {
      const p = _propsDe(x.raiz);
      if (p.orden !== viejos.get(x.raiz)) {
        entradas.push({
          segmento: x.raiz, orden: p.orden,
          antes: { orden: viejos.get(x.raiz) }
        });
      }
    }
    _registrarCambios(entradas);
    return true;
  }

  /**
   * Número de ruta de un segmento de inicio.
   * @param {Object} g - Grupo del inicio.
   * @returns {number} Posición 1..N entre los inicios.
   */
  function _numRuta(g) {
    return _numeroDe(g, 'inicio');
  }

  /**
   * Número de contador de un segmento vida/muerte.
   * @param {Object} g - Grupo del contador.
   * @returns {number} Posición 1..N en su familia.
   */
  function _numContador(g) {
    return _numeroDe(g, g.prop.tipo);
  }

  /**
   * Repinta el panel de información (F5-I7): lo compone el
   * baseDirector con el resumen del diseño (resumen()).
   * @returns {void}
   */
  function _refrescarInfo() {
    baseDirector.pintarInfo();
  }

  /**
   * Resumen del diseño para el panel de información del Editor: los
   * segmentos (sin la ficha del cartucho, que no es arte) y las
   * imágenes.
   * @returns {{segmentos:number, imagenes:number}} Los dos números.
   */
  function resumen() {
    return {
      segmentos: grupos.filter(g => !_esCartucho(g)).length,
      imagenes: sprites.length
    };
  }

  /**
   * Las direcciones que usan los segmentos de tipo JUGADOR (F5-I21): las
   * de sus enlaces izquierda/derecha/arriba/abajo que están definidos.
   * Sirve para decidir si un estilo de máquina (con menos botones) sigue
   * siendo compatible con el juego en memoria. Solo lectura.
   * @returns {string[]} Las direcciones usadas, sin repetir (vacío sin juego).
   */
  function direccionesDeJugador() {
    const usadas = new Set();
    for (const g of grupos) {
      if (_esCartucho(g) || g.absorbido) continue;
      const p = _propsDe(g.raiz);
      if (p.tipo !== 'jugador') continue;
      for (const d of ENLACES_JUGADOR) {
        if (p[d] !== null && p[d] !== undefined) usadas.add(d);
      }
    }
    return Array.from(usadas);
  }

  // ---- Lista de segmentos (pestaña Segmentos y Sprites, F5-I7) ----

  /**
   * Fila de la lista: id, tipo e imagen (o «sin imagen»). Si se pasa
   * un grupo, la fila se puede pulsar para abrirlo en el Editor.
   * @param {string} id - Identificador a mostrar.
   * @param {string} tipo - Tipo (o descripción) a mostrar.
   * @param {?HTMLCanvasElement|HTMLImageElement} imagen - Imagen, o null.
   * @param {?Object} g - Grupo a seleccionar al pulsar, o null.
   * @returns {HTMLLIElement} La fila.
   */
  function _filaDeLista(id, tipo, imagen, g) {
    const li = document.createElement('li');
    const idEl = document.createElement('span');
    idEl.className = 'idSeg';
    idEl.textContent = id;
    const tipoEl = document.createElement('span');
    tipoEl.className = 'tipoSeg';
    tipoEl.textContent = tipo;
    li.append(idEl, tipoEl);
    if (imagen) {
      const mini = document.createElement('canvas');
      mini.width = imagen.width;
      mini.height = imagen.height;
      mini.getContext('2d').drawImage(imagen, 0, 0);
      li.appendChild(mini);
    } else {
      const sin = document.createElement('span');
      sin.className = 'sinImagen';
      sin.textContent = 'sin imagen';
      li.appendChild(sin);
    }
    if (g) {
      li.classList.add('seleccionable');
      li.title = 'Abrir ' + id + ' en el Editor';
      li.addEventListener('click', () => _abrirEnEditor(g));
    }
    return li;
  }

  /**
   * Pinta la lista de segmentos con su imagen en cinco sublistas:
   * sin imagen (dígitos, contadores y la ficha del cartucho), visibles
   * con imagen (los normales y las piezas de unión, con su imagen
   * combinada), no visibles con imagen (los absorbidos por una unión),
   * imágenes sin segmento (solo si las hay) y segmentos deduplicados
   * (los que comparten la misma imagen, abajo del todo). Las filas de
   * los segmentos deduplicados llevan la clase «deduplicado» (púrpura
   * en los estilos) para distinguirlos de un vistazo.
   * @param {HTMLElement} contenedor - Donde se pinta la lista.
   * @returns {void}
   */
  function pintarListaSegmentos(contenedor) {
    contenedor.replaceChildren();
    const SIN_IMAGEN = ['dígito', 'contador', 'cartucho'];
    // Deduplicación: qué sprites usa cada segmento. Los sprites con
    // DOS o más segmentos son los deduplicados (el extractor ya los
    // fusionó por huella idéntica: comparten el objeto sprite).
    const usos = new Map();                 // sprite → [grupos]
    for (const g of grupos) {
      if (!g.sprite) continue;
      if (!usos.has(g.sprite)) usos.set(g.sprite, []);
      usos.get(g.sprite).push(g);
    }
    const sublistas = [
      { titulo: 'Segmentos sin imagen',
        grupos: grupos.filter(g => SIN_IMAGEN.includes(g.prop.tipo)) },
      { titulo: 'Segmentos visibles con imagen',
        grupos: grupos.filter(g => !SIN_IMAGEN.includes(g.prop.tipo) && !g.absorbido) },
      { titulo: 'Segmentos no visibles con imagen (unidos con otros)',
        grupos: grupos.filter(g => !SIN_IMAGEN.includes(g.prop.tipo) && g.absorbido) }
    ];
    for (const sub of sublistas) {
      if (sub.grupos.length === 0) continue;
      const ul = document.createElement('ul');
      for (const g of sub.grupos) {
        const imagen = SIN_IMAGEN.includes(g.prop.tipo) ? null : g.sprite && g.sprite.imagen;
        const li = _filaDeLista(_segId(g), g.prop.tipo, imagen, g);
        if (g.sprite && usos.get(g.sprite).length > 1) li.classList.add('deduplicado');
        ul.appendChild(li);
      }
      _agregarSublista(contenedor, sub.titulo + ' (' + sub.grupos.length + ')', ul);
    }
    const usadas = new Set(grupos.map(g => g.sprite));
    const libres = sprites.filter(s => !usadas.has(s));
    if (libres.length > 0) {
      const ul = document.createElement('ul');
      for (const s of libres) ul.appendChild(_filaDeLista(s.id, 'imagen', s.imagen, null));
      _agregarSublista(contenedor, 'Imágenes sin segmento (' + libres.length + ')', ul);
    }
    // Abajo del todo, la lista de deduplicados: UNA fila por imagen
    // compartida (la imagen, su id y los segmentos que la usan), sin
    // importar cuántos sean: una imagen, una línea.
    const compartidos = [...usos.entries()].filter(([, gs]) => gs.length > 1);
    if (compartidos.length > 0) {
      const ul = document.createElement('ul');
      for (const [sprite, gs] of compartidos) {
        const fila = _filaDeLista(sprite.id,
          'usada por ' + gs.map(_segId).join(', '), sprite.imagen, null);
        fila.title = 'Imagen compartida por ' + gs.length +
          ' segmentos (deduplicación: se guarda una sola vez).';
        ul.appendChild(fila);
      }
      _agregarSublista(contenedor, 'Segmentos deduplicados (' + compartidos.length + ')', ul);
    }
  }

  /**
   * Número de segmentos que usan un sprite (deduplicación: los sprites
   * del extractor se comparten por huella idéntica, así que DOS o más
   * segmentos pueden apuntar al MISMO objeto sprite).
   * @param {Object} sprite - El sprite a contar.
   * @returns {number} Cuántos grupos lo usan.
   */
  function _usosDeSprite(sprite) {
    let n = 0;
    for (const g of grupos) if (g.sprite === sprite) n++;
    return n;
  }

  /**
   * Añade una sublista con su título al contenedor.
   * @param {HTMLElement} contenedor - La lista completa.
   * @param {string} titulo - Título de la sublista.
   * @param {HTMLUListElement} ul - Sus filas.
   * @returns {void}
   */
  function _agregarSublista(contenedor, titulo, ul) {
    const h = document.createElement('h3');
    h.textContent = titulo;
    contenedor.append(h, ul);
  }

  /**
   * Abre un segmento de la lista en el Editor: pasa a su pestaña con
   * él seleccionado. Si está agrupado (barra de un dígito, absorbido
   * por una unión…) se selecciona la pieza visible que lo contiene,
   * como al pulsarlo en el mapa.
   * @param {Object} g - Grupo de la fila pulsada.
   * @returns {void}
   */
  function _abrirEnEditor(g) {
    marcados = new Set();
    eleccion = null;
    seleccion = _esCartucho(g) ? g : _piezaDe(g);
    baseDirector.pestanna('vistaEditor');
    _pintarMapa();
    _mostrarPanel();
  }

  /**
   * Lista de segmentos para el GWI: id, posición presentada, sprite,
   * tipo numérico, enlaces del tipo y ruta/contador. Los componentes
   * absorbidos por una unión aparecen como FANTASMAS (tipo 99): solo
   * informativos, nadie los debe pintar ni consumir. Solo los enlaces del tipo de cada segmento van al
   * JSON (autoexplicativo y editable a mano). El inverso de las
   * direcciones lo calcula la verificación y se incluye aquí
   * (redundancia deliberada: el generador del cartucho compilado
   * trabaja en el PC, sin cálculo extra).
   * @returns {Array<Object>} Segmentos del GWI.
   */
  function segmentos() {
    // La ficha del CARTUCHO (F3-I11) NO viaja en la lista (v12.5):
    // no es arte — su mecanismo de fin es una propiedad del
    // cartucho que viaja en el campo «fin» del GWI.
    const lista = grupos.filter(g => !_esCartucho(g)).map(function (g) {
      // Los ABSORBIDOS por una unión (v4) viajan MARCADOS con
      // fusionadoPor (la pieza F01 que los absorbió) y ocultos: sus
      // imágenes siguen en el cartucho (la pieza las lleva dentro
      // de su fusión) y el editor los sigue listando, pero al
      // generar el cartucho del ESP se eliminarán (nadie debe
      // encenderlos ni pintarlos: el motor los descarta al arrancar).
      const esJugador = (g.prop.tipo === 'jugador');
      // Los FICTICIOS viajan con su caja presentable (envolvente de
      // lo que agrupan, reposiciones incluidas): el GWI es fiel a
      // lo que el editor ve.
      const cajaFic = (g.raiz < 0) ? _cajaPresentable(g) : null;
      const seg = {
        id: _segId(g),
        x: cajaFic ? cajaFic.x : g.x,
        y: cajaFic ? cajaFic.y : g.y,
        sprite: g.spriteId,
        tipo: TIPO_NUM[g.prop.tipo],
        estado: 0, cambiado: 0
      };
      if (esJugador) {
        for (const d of ENLACES_JUGADOR) {
          seg[d] = _resolverEnlace(g.prop[d]);
        }
        // Marca de jugador inicial (F3-I3): solo viaja si está puesta
        // (el motor busca primero un segmento con primero=true y, si
        // no hay, el primero que se encuentre).
        if (g.prop.primero) seg.primero = true;
        // Inverso de la colisión (redundancia deliberada, como los
        // inversos de direcciones): el jugador sabe quién choca.
        if (g.prop.colisionDe !== null) {
          seg.colisionDe = _resolverEnlace(g.prop.colisionDe);
        }
      } else {
        seg.siguiente = _resolverEnlace(g.prop.siguiente);
        seg.salvado = _resolverEnlace(g.prop.salvado);
        seg.muerte = _resolverEnlace(g.prop.muerte);
        // Acompañantes (13.ª iteración): ambos lados viajan en el
        // GWI (redundancia deliberada, como los inversos de las
        // direcciones — el motor solo lee el lado del principal).
        if (g.prop.mostrarJunto !== null) {
          seg.mostrarJunto = _resolverEnlace(g.prop.mostrarJunto);
        }
        if (g.prop.mostradoJunto !== null) {
          seg.mostradoJunto = _resolverEnlace(g.prop.mostradoJunto);
        }
        // Colisiones (F3-I7): solo viajan si están puestas. La cadena
        // del desenlace (salvado/muerte) enlaza con un segmento de
        // juego o de vida/muerte; el contador interno que aumenta es
        // 'vida'/'muerte' o nada (null = regla por defecto).
        if (g.prop.colision !== null) {
          seg.colision = _resolverEnlace(g.prop.colision);
        }
        if (g.prop.salvadoContador !== null) {
          seg.salvadoContador = g.prop.salvadoContador;
        }
        if (g.prop.muerteContador !== null) {
          seg.muerteContador = g.prop.muerteContador;
        }
        // Dígito (F4-I9 v3, ficticio): sus SIETE barras (barra_a..g),
        // todas segmentos de juego que viajan aparte — el motor
        // enciende las barras REALES de cada posición.
        if (g.prop.tipo === 'dígito') {
          for (const campo of ENLACES_DIGITO) {
            const idB = _resolverEnlace(g.prop[campo]);
            if (idB) seg[campo] = idB;
          }
        }
        // Contador (F4-I9 v3, ficticio): sus dígitos (digito_1..4,
        // el 1 es el de las unidades) y sus propiedades de
        // comportamiento. El «presentar el cero» solo viaja si es
        // false (el true es el defecto y el GWI no lleva sobras).
        if (g.prop.tipo === 'contador') {
          for (const campo of ENLACES_CONTADOR) {
            const idD = _resolverEnlace(g.prop[campo]);
            if (idD) seg[campo] = idD;
          }
          seg.contadorInterno = g.prop.contadorInterno === null
            ? 1 : Number(g.prop.contadorInterno);
          seg.valorInicial = Number(g.prop.valorInicial) || 0;
          seg.direccion = g.prop.direccion || 'ascendente';
          if (g.prop.presentarCero === false) seg.presentarCero = false;
        }
        // Cartucho (F3-I11): la ficha YA NO viaja como segmento
        // (v12.5, petición del usuario): el mecanismo de fin es una
        // PROPIEDAD DEL CARTUCHO y viaja al nivel superior del GWI
        // (campo «fin», ver finDelCartucho) — el segmento tipo 7
        // era solo un truco del diseñador para manejarlo.
      }
      // Visibilidad (F4-I9 v3): lo agrupado viaja OCULTO — quien
      // reciba el GWI no recalcula nada (visible:false = está
      // dentro de la imagen fusionada de su pieza). Los visibles
      // no llevan el campo: true es el defecto y el GWI no lleva
      // sobras.
      if (g.oculto) seg.visible = false;
      // Absorbido por una unión (v4): marcado con la pieza F01 que
      // lo fusionó, oculto, y sin pintarse nunca (visible:false).
      if (g.absorbido) {
        seg.fusionadoPor = _segId(_ficticioAbsorbente(g));
        seg.visible = false;
      }
      // Las componentes absorbidas por una unión NO viajan aquí como
      // "unidos" (redundante con el historial de cambios): aparecen
      // como fantasmas tipo 99 al final de la lista.
      // F5-I15 (E6): los absorbidos no llevan número de ruta ni de contador.
      if (!g.absorbido && g.prop.tipo === 'inicio') seg.ruta = _numRuta(g);
      if (!g.absorbido && (g.prop.tipo === 'vida' || g.prop.tipo === 'muerte')) {
        seg.contador = _numContador(g);
      }
      return seg;
    });
    // Fantasmas de unión (tipo 99): cada componente absorbido por una
    // unión aparece en la lista marcado, con el segmento que lo
    // absorbió. ES SOLO INFORMATIVO (para revisar el JSON a mano en
    // desarrollo): la reconstrucción usa autoria.uniones, y nadie
    // debe pintar ni consumir un fantasma.
    for (const g of grupos) {
      if (g.miembros.length <= 1) continue;
      for (const m of g.miembros) {
        // La raíz del grupo NO es fantasma: es el segmento resultante
        // de la unión (seg_NNN, no seg_xN). Emitirla como fantasma
        // sería redundante ("absorbido por sí mismo").
        if (m === g.raiz) continue;
        const c = base.comps[m];
        lista.push({
          id: 'seg_x' + m,                    // x = absorbido (índice de componente)
          x: c.x, y: c.y,
          sprite: null,
          tipo: 99,
          estado: 0, cambiado: 0,
          absorbidoPor: _segId(g)
        });
      }
    }
    return lista;
  }

  /**
   * Lista por consola (console.table) los sprites y segmentos, y
   * refresca la tira de sprites y el panel del baseDirector.
   * @returns {Array<Object>} La lista de segmentos actual.
   */
  function listar() {
    const segs = segmentos();
    console.table(sprites.map(function (s) {
      return {
        id: s.id, ancho: s.ancho, alto: s.alto,
        usos: segs.filter(g => g.sprite === s.id).length
      };
    }));
    console.table(segs);
    return segs;
  }

  // ---- Pantalla y mapa ----

  /**
   * Convierte un color hex "#RRGGBB" a componentes [r, g, b].
   * @param {string} hex - Color en formato #RRGGBB.
   * @returns {number[]} [r, g, b].
   */
  function _colorRGB(hex) {
    return [parseInt(hex.slice(1, 3), 16),
    parseInt(hex.slice(3, 5), 16),
    parseInt(hex.slice(5, 7), 16)];
  }

  // Azul de relación: "esto está enlazado con lo que tienes
  // seleccionado". Un solo color para todos los usos (direcciones
  // del jugador, cadena de un inicio, siguiente marcado).
  const COLOR_RELACION = '#2050C0';   // salientes (hacia dónde va)
  const COLOR_ENTRANTE = '#A000A0';   // entrantes (quién depende del seleccionado)
  const COLOR_COLISION = '#008080';   // puntos de colisión (F3-I7) y su trazo

  /**
   * Segmentos enlazados (SALIENTES) con el seleccionado:
   *  - jugador: sus direcciones (izquierda/derecha/arriba/abajo).
   *  - juego/inicio/vida/muerte: la cadena completa siguiendo
   *    "siguiente" (y las ramas salvado/muerte) de forma transitiva
   *    hasta agotarla — un inicio muestra su ruta entera de un vistazo.
   * Se pintan en AZUL: "hacia dónde va lo seleccionado". Un ciclo no
   * cuelga el bucle: el Set evita repetir visitas.
   * @param {?Object} g - Grupo seleccionado.
   * @returns {Set<Object>} Grupos relacionados (salientes).
   */
  function _relacionadosDe(g) {
    const rel = new Set();
    if (!g) return rel;
    const p = g.prop;
    if (p.tipo === 'jugador') {
      for (const d of ENLACES_JUGADOR) {
        const destino = _grupoDeComp(p[d]);
        if (destino) rel.add(destino);
      }
      return rel;
    }
    // Cadena transitiva: los enlaces del tipo de cada segmento
    // (direcciones del jugador, cadena de juego, barras del dígito o
    // el dígito de un contador) hasta agotar.
    const pendientes = [g];
    const vistos = new Set([g]);
    while (pendientes.length > 0) {
      const actual = pendientes.pop();
      const pa = actual.prop;
      for (const campo of _camposDe(pa.tipo)) {
        const destino = _grupoDeComp(pa[campo]);
        if (!destino) continue;
        rel.add(destino);
        if (!vistos.has(destino)) {
          vistos.add(destino);
          pendientes.push(destino);
        }
      }
    }
    return rel;
  }

  /**
   * Grupos cuyo enlace apunta DIRECTAMENTE al seleccionado (sus
   * "anteriores": quién depende de él). Solo el salto inmediato, sin
   * expandir hacia atrás (una cadena entera pintada de magenta
   * confundiría más de lo que aclara). Barrido directo de los props
   * de todos los grupos mirando los campos del tipo de cada dueño —
   * la matriz de inversos solo cubre direcciones de jugador y no
   * hace falta aquí. Se pintan en MAGENTA (el naranja chocaría con el
   * color de tipo de vida/muerte). El azul prevalece si un grupo es
   * ambas cosas (ciclo de dos): lo que va HACIA delante manda.
   * @param {?Object} g - Grupo seleccionado.
   * @returns {Set<Object>} Grupos que apuntan al seleccionado.
   */
  function _entrantesDe(g) {
    const ent = new Set();
    if (!g) return ent;
    for (const x of grupos) {
      if (x === g) continue;
      const px = x.prop;
      const campos = _camposDe(px.tipo);
      for (const campo of campos) {
        if (_grupoDeComp(px[campo]) === g) { ent.add(x); break; }
      }
      // Colisiones (F3-I7): también es entrante quien declara su
      // colisión contra el seleccionado (el punto de decisión) y,
      // en un jugador, quien lleva su inverso colisionDe.
      if (!ent.has(x) &&
        (_grupoDeComp(px.colision) === g ||
          (px.tipo === 'jugador' && _grupoDeComp(px.colisionDe) === g))) {
        ent.add(x);
      }
    }
    return ent;
  }

  /**
   * Construye la lista residente del baseGraficos desde los grupos:
   * posición presentada + imagen del sprite + color de
   * su tipo — AZUL si es saliente del seleccionado, MAGENTA si le
   * apunta (el azul prevalece en un ciclo de dos). Es
   * la MISMA forma de lista que usará el motor del juego con el GWI.
   * @returns {Array<{x:number, y:number, imagen:object, color:number[]}>}
   */
  function _listaMotor() {
    const rel = _relacionadosDe(seleccion);
    const ent = _entrantesDe(seleccion);
    return grupos.map(g => {
      const color = rel.has(g) ? COLOR_RELACION
        : (ent.has(g) ? COLOR_ENTRANTE
          : (g.prop.colision !== null ? COLOR_COLISION
            : COLOR_TIPO[g.prop.tipo]));
      // La ficha del CARTUCHO (F3-I11) NO se pinta en el mapa
      // (v12.5): fuera del lienzo, sin romper la alineación de
      // índices del baseGraficos — se abre con un clic en el vacío.
      if (_esCartucho(g)) {
        return {
          x: -9999, y: -9999, imagen: g.sprite.imagen,
          color: _colorRGB(color)
        };
      }
      // Las BARRAS de un dígito y los DÍGITOS de un contador no se
      // pintan (la pieza que los agrupa lleva su imagen fusionada):
      // entrada fuera del lienzo, sin romper la alineación de
      // índices del baseGraficos.
      if (g.oculto) {
        return {
          x: -9999, y: -9999, imagen: g.sprite.imagen,
          color: _colorRGB(color)
        };
      }
      // Los dígitos y contadores se pintan como UNA pieza: su imagen
      // FUSIONADA del «8» y la caja envolvente de las siete barras
      // (F4-I9). El resto, sprite y caja de siempre.
      const caja = _cajaPresentable(g);
      return {
        x: caja.x,
        y: caja.y,
        imagen: _imagenFusionada(g),
        color: _colorRGB(color)
      };
    });
  }

  /**
   * Fija la escala del aparato POR EJE a partir de las dimensiones de
   * img_s: las coordenadas y tamaños de los segmentos viven en el
   * espacio de la imagen de segmentos, que puede NO medir lo mismo
   * que img_f (cada arte se estira al vuelo a la resolución real que
   * declara el setup; el escalado definitivo lo hace el GWC). Sin
   * esto el baseGraficos deduciría la escala de img_f y con imágenes de
   * tamaños distintos los segmentos caerían fuera del canvas (bug 8h).
   * @param {number} anchoS - Ancho de img_s en píxeles.
   * @param {number} altoS - Alto de img_s en píxeles.
   * @returns {void}
   */
  function _fijarEscalaAparato(anchoS, altoS) {
    const canvas = _$('pantalla');
    if (!anchoS || !altoS) {                 // sin img_s: fuera la escala
      canvas.escalaX = undefined;            // vieja (que el baseGraficos deduzca
      canvas.escalaY = undefined;             // del fondo, como antes)
      return;
    }
    canvas.escalaX = canvas.width / anchoS;
    canvas.escalaY = canvas.height / altoS;
  }

  /**
   * Lee los píxeles de una imagen (canvas del diseñador o Image PNG del
   * GWI) como ImageData; para los PNG pasa por un canvas temporal.
   * Solo para el pintado del aparato (Fase 1).
   * @param {object} imagen - Canvas o Image del sprite.
   * @returns {ImageData} Píxeles del sprite.
   */
  function _pixelesDeImagen(imagen) {
    const ancho = imagen.naturalWidth || imagen.width;
    const alto = imagen.naturalHeight || imagen.height;
    if (imagen.getContext) {                  // ya es un canvas
      return imagen.getContext('2d').getImageData(0, 0, ancho, alto);
    }
    const c = document.createElement('canvas');
    c.width = ancho; c.height = alto;
    const ctx = c.getContext('2d');
    ctx.drawImage(imagen, 0, 0);
    return ctx.getImageData(0, 0, ancho, alto);
  }

  /**
   * Pinta el FONDO de la pantalla del aparato (Fase 1, diseñador):
   * base blanca opaca + img_f estirada a la resolución del canvas (la
   * que declara el setup), como el arte impreso bajo el cristal. Esta
   * presentación NO usa el baseGraficos: pintar fondo y todos los segmentos
   * en negro es propio del entorno de autoría, y el aparato siempre se
   * repinta desde el fondo (no se borra nada en sitio).
   * @returns {void}
   */
  function pintarFondoAparato() {
    const canvas = _$('pantalla');
    const imgF = baseDirector.imagenFondo();
    const ctx = canvas.getContext('2d');
    ctx.imageSmoothingEnabled = false;
    ctx.fillStyle = baseDirector.colorFondo();   // base opaca (LCD apagado; ColorFondo del cartucho)
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    if (imgF) ctx.drawImage(imgF, 0, 0, canvas.width, canvas.height);
  }

  /**
   * Pinta un SEGMENTO en NEGRO PURO sobre la pantalla del aparato
   * (Fase 1, diseñador): los píxeles blancos del sprite son
   * transparentes y no tocan nada; los oscuros se ESCRIBEN en negro,
   * como el cristal líquido real (venga del color que venga el arte
   * del fondo, que está impreso en capa aparte). Sin XOR: no hay
   * auto-borrado, pero el aparato siempre se repinta fondo + todos.
   * El sprite se estira AL VUELO con la escala por eje del aparato
   * (fijada por fijarEscalaAparato a partir de img_s): el bucle
   * recorre los píxeles del DESTINO y muestrea el sprite por
   * vecino más cercano (cualquier escala, fraccionaria o <1).
   * @param {HTMLCanvasElement} canvas - Canvas del aparato.
   * @param {number} x - Posición x en el espacio de img_s.
   * @param {number} y - Posición y en el espacio de img_s.
   * @param {object} imagen - Sprite (canvas del diseñador o Image PNG).
   * @returns {void}
   */
  function pintarSegmentoAparato(canvas, x, y, imagen) {
    const escX = canvas.escalaX, escY = canvas.escalaY;
    if (!(escX > 0) || !(escY > 0)) {
      console.warn('[aparato] escala sin fijar: no se pinta el segmento.');
      return;
    }
    const pix = _pixelesDeImagen(imagen);
    const p = pix.data;
    const sw = pix.width, sh = pix.height;
    // Caja destino en píxeles del canvas (recortada al lienzo)
    const xf = x * escX, yf = y * escY;
    const x0 = Math.max(0, Math.round(xf));
    const y0 = Math.max(0, Math.round(yf));
    const x1 = Math.min(canvas.width, Math.round(xf + sw * escX));
    const y1 = Math.min(canvas.height, Math.round(yf + sh * escY));
    if (x1 <= x0 || y1 <= y0) return;       // fuera del canvas, nada
    const wTot = x1 - x0, hTot = y1 - y0;
    const ctx = canvas.getContext('2d');
    const idd = ctx.getImageData(x0, y0, wTot, hTot);
    const d = idd.data;
    for (let dy = 0; dy < hTot; dy++) {
      const sy = Math.min(sh - 1, Math.max(0, Math.floor((y0 + dy - yf) / escY)));
      for (let dx = 0; dx < wTot; dx++) {
        const sx = Math.min(sw - 1, Math.max(0, Math.floor((x0 + dx - xf) / escX)));
        const i = (sy * sw + sx) * 4;
        if (p[i] + p[i + 1] + p[i + 2] >= 384) continue;   // blanco: fuera
        const j = (dy * wTot + dx) * 4;
        d[j] = 0; d[j + 1] = 0; d[j + 2] = 0; d[j + 3] = 255;
      }
    }
    ctx.putImageData(idd, x0, y0);
  }

  /**
   * Pinta el canvas del aparato: SIEMPRE el estado del juego — fondo
   * (img_f) + TODOS los segmentos en negro (XOR blanco del baseGraficos,
   * look LCD real). Este canvas nunca lleva colores de tipo: los
   * colores viven en el mapa de trabajo.
   * @returns {void}
   */
  function pintarPantallaAutoria() {
    const canvas = _$('pantalla');
    _fijarEscalaAparato(base ? base.ancho : 0, base ? base.alto : 0);
    pintarFondoAparato();
    // La composición (fondo + segmentos en negro, look LCD) es la
    // PREVISUALIZACIÓN del resultado final: solo se ofrece con un
    // GWI en edición o tras guardar. Con un GWB fresco el aparato
    // muestra solo el arte fijo de fondo (iteración 11).
    if (!componerPantalla) return;
    for (const g of grupos) {
      // Las barras agrupadas y los dígitos de un contador NO se
      // pintan aquí: ya van DENTRO de la imagen fusionada de la
      // pieza que los agrupa. Pintarlos además una a una los
      // dibujaba DOS veces con redondeos distintos (bug F4-I9 v2:
      // el «8» salía con los bordes dobles).
      if (g.oculto) continue;
      // El segmento de CARTUCHO (F3-I11) no es arte: no se presenta
      // en la previsualización (su "imagen" es un lienzo en blanco).
      if (_esCartucho(g)) continue;
      // Dígitos y contadores: pieza única (imagen fusionada del
      // «8», caja envolvente); el resto, como siempre (F4-I9).
      const caja = _cajaPresentable(g);
      pintarSegmentoAparato(canvas, caja.x, caja.y, _imagenFusionada(g));
    }
  }

  /**
   * Pinta la fusión del GWI en el aparato: fondo (img_f) + todos los
   * segmentos de los PNG del cartucho (leídos UNA vez, lista local
   * temporal). IMPORTANTE: es asíncrona y NO deja su lista en el
   * baseGraficos: al terminar restaura la lista del editor (grupos), que
   * arrancar ya fijó — si no, el primer clic en el mapa pintaría
   * sin colores.
   * @param {HTMLImageElement} imgS - img_s del cartucho (no se pinta).
   * @param {Array<Object>} spritesJson - Lista sprites del GWI.
   * @param {Array<Object>} segmentosJson - Lista segmentos del GWI.
   * @param {Function} loader - Devuelve Promise<Image> del fichero.
   * @returns {Promise<void>}
   */
  async function pintarGWI(imgS, spritesJson, segmentosJson, loader) {
    const cache = new Map();                 // id sprite -> Image
    for (const s of (spritesJson || [])) {
      try {
        cache.set(s.id, await loader(s.fichero));
      } catch (e) {
        console.warn('[gwi] sprite no encontrado: ' + s.fichero);
      }
    }
    const lista = [];
    // Ocultos (F4-I9 v3): las barras de un dígito y los dígitos de
    // un contador no se pintan — ya van DENTRO de la imagen
    // fusionada que el ficticio lleva como sprite. Se reconocen
    // por los enlaces del propio GWI, sin autoría.
    const ocultos = new Set();
    for (const seg of (segmentosJson || [])) {
      if (seg.tipo === comunListas.tipos.digito) {
        for (const campo of ENLACES_DIGITO) {
          if (seg[campo]) ocultos.add(seg[campo]);
        }
      }
      if (seg.tipo === comunListas.tipos.contador) {
        for (const campo of ENLACES_CONTADOR) {
          if (seg[campo]) ocultos.add(seg[campo]);
        }
      }
    }
    for (const seg of (segmentosJson || [])) {
      if (seg.tipo === 99) continue;          // fantasma de unión: informativo
      const img = cache.get(seg.sprite);
      if (img) seg.imagen = img;   // colgada de TODOS (ocultos incluidos):
      // el MOTOR enciende las barras de un dígito
      // aunque viajen apagadas en el GWI — sin
      // imagen no hay nada que presentar (bug:
      // el contador de vidas no aparecía)
      if (seg.visible === false) continue;    // oculto declarado en el GWI
      if (ocultos.has(seg.id)) continue;      // agrupado: dentro de su pieza
      if (img) {
        lista.push({ x: seg.x, y: seg.y, imagen: img, color: null });
      }
    }
    // Pintado con las funciones propias del diseñador (sin baseGraficos):
    // fondo + todos los segmentos de la lista temporal, en negro.
    _fijarEscalaAparato(imgS ? imgS.naturalWidth : 0, imgS ? imgS.naturalHeight : 0);
    const canvas = _$('pantalla');
    pintarFondoAparato();
    for (const seg of lista) {
      pintarSegmentoAparato(canvas, seg.x, seg.y, seg.imagen);
    }
    // Restaurar la lista del editor (la de grupos), que arrancar ya
    // fijó: sin esto, el primer clic en el mapa pintaría sin colores.
    baseGraficos.fijarSegmentos(_listaMotor());
    console.info('[gwi] pantalla fusionada (fondo + ' + lista.length +
      ' segmentos); ' + (segmentosJson || []).length +
      ' segmento(s) en memoria.');
  }

  /**
   * Pinta el mapa de trabajo: base BLANCA lisa (el fondo no pinta
   * aquí: no es necesario y, si img_f e img_s difieren algo de
   * tamaño, el arte desplazado se mezclaría con los segmentos) y
   * ENCIMA cada segmento con el COLOR de su tipo (tipico=true del
   * baseGraficos, color escrito sobre el blanco). Caja y número con el
   * mismo color; el seleccionado, rojo intenso. La escala vive como
   * propiedad del canvas (canvas.escala), que es lo que usa el baseGraficos.
   * @returns {void}
   */
  function _pintarMapa() {
    const canvas = _$('mapaSegmentos');
    _$('zonaMapa').classList.remove('oculto');
    escala = Math.min(ESCALA_MAX,
      Math.max(ESCALA_MIN, Math.floor(ANCHO_MAPA_MAX / base.ancho)));
    canvas.width = base.ancho * escala;
    canvas.height = base.alto * escala;
    canvas.escala = escala;                  // factor fijo para el baseGraficos
    // La lista del baseGraficos SIEMPRE sincronizada con los grupos antes
    // de dibujar: si quedó desfasada (p. ej. la de pintarGWI, con
    // color null tras cargar un GWI), los segmentos saldrían todos
    // negros. El mapa es el consumidor de la vista de trabajo.
    baseGraficos.fijarSegmentos(_listaMotor());
    const ctx = canvas.getContext('2d');
    ctx.imageSmoothingEnabled = false;
    ctx.fillStyle = '#FFFFFF';               // lienzo neutro, sin fondo
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    for (let i = 0; i < grupos.length; i++) {
      baseGraficos.DibujarSegmento(canvas, i, true);
    }
    const fuente = Math.max(9, 6 * escala);
    ctx.font = fuente + 'px monospace';
    ctx.textBaseline = 'top';
    // Cajas y números con el mismo criterio que el baseGraficos: azul los
    // salientes del seleccionado, magenta los que le apuntan, su
    // color de tipo el resto, rojo intenso el seleccionado.
    const relCajas = _relacionadosDe(seleccion);
    const entCajas = _entrantesDe(seleccion);
    for (let i = 0; i < grupos.length; i++) {
      const g = grupos[i];
      if (g.oculto) continue;   // agrupadas: solo se ve su pieza
      if (_esCartucho(g)) continue; // ficha del cartucho: fuera del mapa
      const sel = (seleccion === g) || marcados.has(g);
      const color = sel ? '#E04040'
        : (relCajas.has(g) ? COLOR_RELACION
          : (entCajas.has(g) ? COLOR_ENTRANTE
            : (g.prop.colision !== null ? COLOR_COLISION
              : COLOR_TIPO[g.prop.tipo])));
      // En pantalla, caja y número: F01, F02... para los ficticios
      // (v4: la pieza se llama como su imagen img_F01); correlativo
      // 000.. para los segmentos reales.
      const num = (g.raiz < 0) ? _segId(g) : String(i).padStart(3, '0');
      const anchoTexto = ctx.measureText(num).width;
      // Caja: envolvente del «8» en dígitos/contadores (F4-I9),
      // propia en el resto.
      const caja = _cajaPresentable(g);
      ctx.strokeStyle = color;
      ctx.lineWidth = sel ? 2 : 1;
      ctx.strokeRect(caja.x * escala - 0.5, caja.y * escala - 0.5,
        caja.ancho * escala + 1, caja.alto * escala + 1);
      let nx, ny;
      if (anchoTexto + 4 <= caja.ancho * escala) {
        nx = caja.x * escala + 2; ny = caja.y * escala + 1;
      } else {
        nx = (caja.x + caja.ancho) * escala + 2; ny = caja.y * escala + 1;
      }
      ctx.lineWidth = Math.max(2, fuente / 3);
      ctx.strokeStyle = '#FFFFFF';
      ctx.strokeText(num, nx, ny);
      ctx.fillStyle = color;
      ctx.fillText(num, nx, ny);
    }
    // Trazo de colisión (F3-I7): línea teal entre el punto de
    // colisión y su jugador cuando CUALQUIERA de los dos está
    // seleccionado (la relación se ve de un vistazo, sin leer el
    // panel). Discontinua, para no confundirse con el recuadro de
    // selección múltiple.
    if (seleccion) {
      const centroX = gg => (gg.x + gg.ancho / 2) * escala;
      const centroY = gg => (gg.y + gg.alto / 2) * escala;
      const pares = [];
      for (const g of grupos) {
        if (g.prop.colision === null) continue;
        const jugador = _grupoDeComp(g.prop.colision);
        if (!jugador) continue;
        if (g === seleccion || jugador === seleccion) pares.push([g, jugador]);
      }
      if (pares.length > 0) {
        if (ctx.setLineDash) ctx.setLineDash([3, 2]);
        ctx.strokeStyle = COLOR_COLISION;
        ctx.lineWidth = 1;
        for (const [a, b] of pares) {
          ctx.beginPath();
          ctx.moveTo(centroX(a), centroY(a));
          ctx.lineTo(centroX(b), centroY(b));
          ctx.stroke();
        }
        if (ctx.setLineDash) ctx.setLineDash([]);
      }
    }
    // Recuadro de selección múltiple en curso: banda elástica azul.
    if (arrastre && arrastre.movido) {
      const rx = Math.min(arrastre.x0, arrastre.x1);
      const ry = Math.min(arrastre.y0, arrastre.y1);
      const rw = Math.abs(arrastre.x1 - arrastre.x0);
      const rh = Math.abs(arrastre.y1 - arrastre.y0);
      if (ctx.setLineDash) ctx.setLineDash([4, 3]);
      ctx.strokeStyle = COLOR_RELACION;
      ctx.lineWidth = 1;
      ctx.strokeRect(rx * escala - 0.5, ry * escala - 0.5,
        rw * escala + 1, rh * escala + 1);
      if (ctx.setLineDash) ctx.setLineDash([]);
    }
  }

  /**
   * Refresca todo el estado visible: barra de info, lista de
   * numerables, sincronización de la lista del baseGraficos y las dos
   * vistas (aparato y mapa).
   * @returns {void}
   */
  function _refrescar() {
    _refrescarInfo();
    baseGraficos.fijarSegmentos(_listaMotor());      // grupos → lista del baseGraficos
    pintarPantallaAutoria();
    _pintarMapa();
  }

  // ---- Interacción ----

  /**
   * Convierte un evento de puntero a coordenadas de IMAGEN del mapa
   * (la misma fórmula que usaba alPulsarMapa).
   * @param {PointerEvent} ev - Evento de puntero.
   * @returns {{x:number, y:number}} Coordenadas de imagen.
   */
  function _puntoDe(ev) {
    const canvas = _$('mapaSegmentos');
    const r = canvas.getBoundingClientRect();
    return {
      x: Math.floor((ev.clientX - r.left) * canvas.width / r.width / escala),
      y: Math.floor((ev.clientY - r.top) * canvas.height / r.height / escala)
    };
  }

  /**
   * Pulsación en el mapa: si hay elección pendiente se aplica YA
   * (como siempre); si no, se anota el punto de inicio del posible
   * recuadro — la selección ocurre al SOLTAR: sin arrastre es un
   * clic normal, con arrastre es selección múltiple por recuadro.
   * @param {PointerEvent} ev - Evento de puntero.
   * @returns {void}
   */
  function _alPulsarMapa(ev) {
    if (!base) return;
    const p = _puntoDe(ev);
    if (p.x < 0 || p.y < 0 || p.x >= base.ancho || p.y >= base.alto) return;
    if (eleccion) {
      arrastre = null;
      // La ELECCIÓN también recibe la PIEZA (F4-I9 v3), no el grupo
      // a nivel de píxel: elegir el dígito de un contador clicando
      // su «8» debe entregar el DÍGITO ficticio (la pieza visible),
      // no una de sus barras.
      const grupo = _grupoDelPixel(p.x, p.y);
      if (grupo) _aplicarEleccion(_piezaDe(grupo));
      return;
    }
    arrastre = { x0: p.x, y0: p.y, x1: p.x, y1: p.y, movido: false };
  }

  /**
   * Movimiento con el botón pulsado: banda elástica del recuadro de
   * selección múltiple (el mapa se repinta con el recuadro en curso).
   * Si el botón ya no está pulsado (soltó fuera del lienzo), se
   * cierra el arrastre aquí.
   * @param {PointerEvent} ev - Evento de puntero.
   * @returns {void}
   */
  function _alMoverMapa(ev) {
    if (!arrastre || eleccion) return;
    if (ev.buttons !== undefined && (ev.buttons & 1) === 0) {
      _alSoltarMapa(ev);          // soltó fuera del lienzo: cerrar aquí
      return;
    }
    const p = _puntoDe(ev);
    arrastre.x1 = p.x;
    arrastre.y1 = p.y;
    if (!arrastre.movido &&
      (Math.abs(p.x - arrastre.x0) > 1 || Math.abs(p.y - arrastre.y0) > 1)) {
      arrastre.movido = true;
    }
    if (arrastre.movido) _pintarMapa();
  }

  /**
   * Al soltar: si hubo arrastre, TODO grupo cuya caja PRESENTADA
   * corte el recuadro (total o parcialmente) queda marcado en rojo y
   * el panel ofrece unirlos de una vez; un solo grupo = selección
   * simple. Si no hubo arrastre es un clic normal, que además
   * DESMARCA cualquier selección múltiple anterior.
   * @param {PointerEvent} ev - Evento de puntero.
   * @returns {void}
   */
  function _alSoltarMapa(ev) {
    if (!arrastre) return;
    const a = arrastre;
    arrastre = null;
    if (a.movido) {
      const rx0 = Math.min(a.x0, a.x1), rx1 = Math.max(a.x0, a.x1);
      const ry0 = Math.min(a.y0, a.y1), ry1 = Math.max(a.y0, a.y1);
      const dentro = grupos.filter(g => {
        if (g.oculto) return false;   // agrupadas: no se marcan
        if (_esCartucho(g)) return false; // la ficha del cartucho tampoco
        const gx = g.x, gy = g.y;
        return gx <= rx1 && gx + g.ancho - 1 >= rx0 &&
          gy <= ry1 && gy + g.alto - 1 >= ry0;
      });
      marcados = new Set(dentro);
      seleccion = (dentro.length === 1) ? dentro[0] : null;
      _pintarMapa();
      _mostrarPanel();
      if (dentro.length > 1) {
        baseDirector.avisar(dentro.length + ' segmentos marcados: "Unir" los ' +
          'fusiona; un clic en el mapa los desmarca.');
      }
      return;
    }
    // Clic simple: primero se desmarca cualquier selección múltiple
    // (y YA está: ese clic NO abre la ficha del cartucho — desmarcar
    // es desmarcar; para la ficha, un clic en el vacío sin marcas).
    if (marcados.size > 0) {
      marcados = new Set();
      _pintarMapa();
      _mostrarPanel();
      return;
    }
    const x = a.x0, y = a.y0;
    if (x < 0 || y < 0 || x >= base.ancho || y >= base.alto) return;
    const grupo = _grupoDelPixel(x, y);
    if (!grupo) {
      // Clic en el VACÍO (v12.5): abre la ficha del CARTUCHO
      // (F3-I11), QUE NO SE PINTA en el mapa — cualquier punto
      // sin segmento es su zona de clic, así su caja no ocupa
      // sitio ni puede quedar escondida tras el arte.
      const cart = _cartuchoDe();
      if (cart) {
        seleccion = cart;
        _pintarMapa();
        _mostrarPanel();
      }
      return;
    }
    // Clicar una BARRA agrupada selecciona su DÍGITO y un DÍGITO
    // agrupado su CONTADOR: SIEMPRE la pieza VISIBLE, subiendo toda
    // la jerarquía (F4-I9 v3). Un clic en cualquier parte del «8»
    // o del número selecciona la pieza entera.
    seleccion = _piezaDe(grupo);
    _pintarMapa();
    _mostrarPanel();
  }

  /**
   * F5-I15 (E7): motivo por el que unos grupos NO se pueden unir, o
   * null. El dígito y el contador son piezas indivisibles (F3-I10):
   * unirlos entre sí no tiene sentido y rompería sus enlaces de barras
   * o de dígitos.
   * @param {Array<Object>} lista - Grupos que se quieren unir.
   * @returns {?string} El mensaje de error, o null si se pueden unir.
   */
  function _motivoNoUnible(lista) {
    if (lista.some(g => g.prop.tipo === 'dígito' || g.prop.tipo === 'contador')) {
      return 'El dígito y el contador son piezas indivisibles: no se unen ' +
        'con otros segmentos (se crean con «Hacer dígito» / «Hacer contador»).';
    }
    return null;
  }

  /**
   * Une TODOS los grupos marcados por recuadro en UNO: cada marcado
   * (menos el primero) se une al primero y luego se re-apuntan los
   * enlaces que referencien a un miembro absorbido (igual que la
   * unión por elección). TODO es UNA acción atómica del historial:
   * un solo gesto del autor, se deshace junto.
   * @returns {void}
   */
  function _unirMarcados() {
    const lista = grupos.filter(g => marcados.has(g));   // orden del mapa
    // La ficha del cartucho (F3-I11) no participa en uniones: no
    // es arte (y el recuadro ya no la marca; esto es por si un
    // GWI editado a mano la metió en «marcados»).
    if (lista.some(_esCartucho)) {
      baseDirector.avisarError('El segmento de cartucho no participa en ' +
        'uniones: es la ficha del cartucho, no arte.');
      return;
    }
    if (lista.length < 2) {
      marcados = new Set();
      _refrescar();
      _mostrarPanel();
      return;
    }
    // Tipos distintos NO se unen: casi siempre es un error del
    // autor (p. ej. jugador + juego). Se bloquea con error y no se
    // toca nada (ni uniones ni historial): que cambie primero el
    // tipo de todos los marcados al mismo. Las marcas se conservan
    // para reintentar tras corregir (o desmarcar con un clic).
    const tipos = new Set(lista.map(g => g.prop.tipo));
    if (tipos.size > 1) {
      baseDirector.avisarError('No se pueden unir segmentos de tipos distintos (' +
        [...tipos].join(', ') + '): ponlos todos del mismo tipo antes de unir.');
      return;
    }
    // F5-I15 (E7): dígitos y contadores no se unen.
    const noUnible = _motivoNoUnible(lista);
    if (noUnible) {
      baseDirector.avisarError(noUnible);
      return;
    }
    // UNIR de un «8» = DÍGITO (F4-I9 v4): si lo marcado son exacta-
    // mente las SIETE barras de un «8» reconocible, la unión NO crea
    // una pieza de tipo juego (heredado de las barras) — delega en
    // hacerDigito, que clasifica a–g y crea la pieza como tipo
    // dígito con sus enlaces barra_a..g. Igual que el usuario
    // esperaba: unir los 7 segmentos crea el dígito.
    if (lista.length === 7 && lista.every(g => g.prop.tipo === 'juego') &&
      _clasificarBarras(lista)) {
      _hacerDigito();
      return;
    }
    // ABSORCIÓN (v4): la unión crea una PIEZA NUEVA que absorbe los
    // marcados — mismo sistema que dígito/contador. Los absorbidos
    // quedan inertes y ocultos; la pieza nueva toma el siguiente
    // número libre.
    const ids = lista.map(g => _segId(g)).join(', ');
    const id = _unirGrupos(lista);
    marcados = new Set();
    seleccion = _grupoDeComp(id) || null;
    _refrescar();
    _mostrarPanel();
    baseDirector.avisar('Unidos ' + ids + ' en la pieza nueva ' +
      _segId(seleccion) + ' (los originales quedan absorbidos).');
  }

  /**
   * Crea un segmento FICTICIO (F4-I9 v3): grupo sin componente de
   * imagen, con raíz NEGATIVA, que nace con la caja envolvente de
   * lo que agrupa. Los ids son -1, -2, ... y NO se reutilizan
   * dentro de una sesión (el replay del historial los reparte en
   * el mismo orden: determinista). NO registra historial: lo hace
   * el llamante con la entrada {altaFicticio}.
   * @param {{x:number, y:number, ancho:number, alto:number}} caja -
   *   Caja de nacimiento del ficticio.
   * @returns {number} Id negativo del ficticio.
   */
  function _crearFicticio(caja, miembros) {
    ficticioSeq++;
    const id = -ficticioSeq;
    ficticios.push({
      id: id, x: caja.x, y: caja.y,
      ancho: caja.ancho, alto: caja.alto,
      miembros: miembros || null
    });
    return id;
  }

  /**
   * ¿El grupo es el segmento de CARTUCHO (F3-I11)? La ficha que
   * alberga las características del cartucho (hoy: el mecanismo de
   * fin de partida). No es arte: nunca se presenta en pantalla y
   * no participa en uniones ni agrupaciones.
   * @param {Object} g - Grupo.
   * @returns {boolean} true si es el segmento de cartucho.
   */
  function _esCartucho(g) {
    return !!(g && g.prop && g.prop.tipo === 'cartucho');
  }

  /**
   * El segmento de CARTUCHO vigente, o null (F3-I11).
   * @returns {?Object} Grupo del segmento de cartucho.
   */
  function _cartuchoDe() {
    return grupos.find(g => g.prop.tipo === 'cartucho') || null;
  }

  /**
   * El MECANISMO DE FIN como PROPIEDAD DEL CARTUCHO (F3-I11,
   * v12.5): ya NO viaja como segmento tipo 7 en la lista — era solo
   * la forma de manejarlo en el diseñador. Aquí se traduce al
   * campo «fin» del nivel superior del GWI: { mecanismo } o
   * { mecanismo: "contador", contador: N }. null = sin definir.
   * @returns {?Object} Configuración de fin, o null.
   */
  function _finDelCartucho() {
    const cart = _cartuchoDe();
    if (!cart) return null;
    const p = cart.prop;
    if (p.finJuego === null) return null;
    const fin = { mecanismo: p.finJuego };
    if (p.finJuego === 'contador') fin.contador = Number(p.finContador) || 1;
    return fin;
  }

  /**
   * La SECUENCIA como PROPIEDAD DEL CARTUCHO (duodécima iteración):
   * animación periódica de hasta 5 segmentos lanzados en orden,
   * uno por tick. Como el fin, viaja al nivel superior del GWI
   * (campo «secuencia»): { ticks: N, segmentos: [ids] }. null =
   * sin Secuencia.
   * @returns {?Object} Configuración de secuencia, o null.
   */
  function _secuenciaDelCartucho() {
    const cart = _cartuchoDe();
    if (!cart) return null;
    const p = cart.prop;
    const lista = [];
    for (const campo of CAMPOS_SECUENCIA) {
      if (p[campo] === null) continue;
      const id = _resolverEnlace(p[campo]);
      if (id) lista.push(id);
    }
    if (lista.length === 0) return null;
    return {
      ticks: Math.max(1, Number(p.secTicks) || 1),
      segmentos: lista
    };
  }
  /**
   * ESCRIBE la Secuencia en el PUENTE (corrección del 23-10-2026):
   * comunListas.fijarSecuencia, con lo que la ficha tiene AHORA. La
   * escribía solo baseDirector al cargar (json.secuencia): definir la
   * Secuencia en el editor y pulsar Start sin recargar dejaba el
   * puente con null — las animaciones no se lanzaban nunca. La llama
   * _reconstruir() (todo cambio de la ficha pasa por ahí: ticks,
   * elegir/quitar segmento, deshacer/rehacer y el replay de la carga).
   * @returns {void}
   */
  function _sincronizarSecuencia() {
    if (typeof comunListas !== 'undefined' &&
      typeof comunListas.fijarSecuencia === 'function') {
      comunListas.fijarSecuencia(_secuenciaDelCartucho());
    }
  }

  /**
   * Las PAUSAS como PROPIEDAD DEL CARTUCHO (F4-I2): las dos
   * velocidades de reloj, { simulador, externo }. null = el GWI
   * no lo declara (el Director mantiene su 500 histórico).
   * @returns {?Object} Configuración de pausas, o null.
   */
  function _pausasDelCartucho() {
    const cart = _cartuchoDe();
    if (!cart) return null;
    const p = cart.prop;
    if (p.pausaSim === null && p.pausaEsp === null) return null;
    return {
      simulador: (p.pausaSim === null) ? null : p.pausaSim,
      externo: (p.pausaEsp === null) ? null : p.pausaEsp
    };
  }

  /**
   * La ACELERACIÓN como PROPIEDAD DEL CARTUCHO (F4-I2):
   * { cada, resta, minimo }. Los tres juntos o nada: una
   * aceleración a medias es un error de verificación.
   * @returns {?Object} Configuración de aceleración, o null.
   */
  function _aceleracionDelCartucho() {
    const cart = _cartuchoDe();
    if (!cart) return null;
    const p = cart.prop;
    if (p.accCada === null && p.accResta === null && p.accMinimo === null) {
      return null;
    }
    return {
      cada: p.accCada || 1, resta: p.accResta || 0,
      minimo: p.accMinimo || 0
    };
  }

  /**
   * La política de RUTAS como PROPIEDAD DEL CARTUCHO (F4-I2):
   * { aumentarCada: N }. null = sin campo (máximo fijo en 1, la
   * regla histórica de lanzamiento).
   * @returns {?Object} Configuración de rutas, o null.
   */
  function _rutasDelCartucho() {
    const cart = _cartuchoDe();
    if (!cart) return null;
    const p = cart.prop;
    if (p.aumentarCada === null) return null;
    return { aumentarCada: Math.max(1, Number(p.aumentarCada) || 1) };
  }

  /**
   * ESCRIBE los campos del DIRECTOR en el PUENTE (F4-I2), igual
   * que sincronizarSecuencia: lo que la ficha tiene AHORA, visible
   * para el motor al instante, sin guardar ni recargar. La llama
   * _reconstruir() junto a la de la Secuencia.
   * @returns {void}
   */
  function _sincronizarDirector() {
    if (typeof comunListas === 'undefined') return;
    if (typeof comunListas.fijarPausas === 'function') {
      comunListas.fijarPausas(_pausasDelCartucho());
    }
    if (typeof comunListas.fijarAceleracion === 'function') {
      comunListas.fijarAceleracion(_aceleracionDelCartucho());
    }
    if (typeof comunListas.fijarRutas === 'function') {
      comunListas.fijarRutas(_rutasDelCartucho());
    }
  }


  /**
   * ASEGURA que existe el segmento de CARTUCHO (F3-I11): se crea
   * SIEMPRE al arrancar la edición si el cartucho no lo trae — es
   * imprescindible (un cartucho sin su ficha no puede ejecutarse) y
   * no tiene botón de creación. Nace como un ficticio SIN píxeles
   * y SIN presencia en el mapa (v12.5: la ficha NO se pinta — el
   * hueco de 16×16 podía caer sobre arte y molestar; se abre con un
   * clic en cualquier punto VACÍO del mapa). La caja (0,0,16×16)
   * es solo la que exige el alta del ficticio: nada la consulta.
   * El alta VIAJA en el historial (como toda pieza): el replay de
   * un GWI guardado debe recrearla, y sus propiedades (finJuego,
   * finContador) viajan en sus propias entradas.
   * @returns {boolean} true si lo creó, false si ya existía.
   */
  function _asegurarCartucho() {
    // ¿Ya hay alguno? Se mira en ficticios+props (aún sin grupos
    // reconstruidos): el replay de un GWI lo deja aquí.
    for (const f of ficticios) {
      const pf = props.get(f.id);
      if (pf && pf.tipo === 'cartucho') return false;
    }
    const LADO = 16;
    const x = 0, y = 0;             // sin presencia en el mapa: fija
    const id = _crearFicticio({ x: x, y: y, ancho: LADO, alto: LADO }, null);
    _propsDe(id).tipo = 'cartucho';
    _registrarCambios([{ altaFicticio: [id, x, y, LADO, LADO, null] },
    {
      segmento: id, tipo: 'cartucho',
      antes: { tipo: 'juego' }
    }]);
    return true;
  }

  /**
   * UNIR por ABSORCIÓN (F4-I9 v4, petición del usuario): unir N
   * grupos NO fusiona en un segmento existente — crea un segmento
   * NUEVO (ficticio con raíz negativa) que los ABSORBE, igual que
   * «Hacer dígito» agrupa sus barras y «Hacer contador» sus
   * dígitos: UN SOLO sistema para todos los casos. Los absorbidos
   * quedan marcados (inertes, ocultos, fuera del GWI; al generar
   * el cartucho del ESP se eliminan); la pieza nueva toma el
   * siguiente número libre, lleva la IMAGEN FUSIONADA (OR de
   * píxeles, criterio de la unión del extractor) y recibe:
   *   - el primer valor no nulo de las props de los absorbidos
   *     (tipo, orden, enlaces...), y
   *   - TODOS los enlaces externos que apuntaban a un absorbido.
   * Los enlaces que apuntaban DENTRO del conjunto absorbido no se
   * heredan (la cadena interna pierde sentido). TODO es UNA acción
   * atómica del historial, deshacible de un gesto.
   * @param {Array<Object>} lista - Grupos a unir (mismo tipo).
   * @returns {number} Id negativo de la pieza nueva.
   */
  function _unirGrupos(lista) {
    // Caja de nacimiento: envolvente de las cajas presentadas.
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    for (const g of lista) {
      const c = _cajaPresentable(g);
      x0 = Math.min(x0, c.x); y0 = Math.min(y0, c.y);
      x1 = Math.max(x1, c.x + c.ancho); y1 = Math.max(y1, c.y + c.alto);
    }
    const raices = lista.map(g => g.raiz);
    const id = _crearFicticio({ x: x0, y: y0, ancho: x1 - x0, alto: y1 - y0 },
      raices);
    const p = _propsDe(id);
    const enRaices = new Set(raices);
    const entradas = [{
      altaFicticio: [id, x0, y0, x1 - x0, y1 - y0,
        raices.slice()]
    }];
    // Merge de props: el PRIMER valor no nulo de cada campo gana
    // (mismo criterio que el merge de la unión clásica). Los
    // enlaces hacia dentro del conjunto absorbido NO se heredan.
    const fijados = new Set();
    for (const g of lista) {
      const pa = g.prop;
      for (const campo of CAMPOS_PROP) {
        const v = pa[campo];
        if (v === null || v === false || v === undefined) continue;
        if (fijados.has(campo)) continue;
        // Un enlace hacia DENTRO del conjunto no se hereda NI fija el campo:
        // con A→B→C, al unir A+B el «siguiente»→C de B debe poder pasar a la
        // pieza nueva (REVISION #19).
        if (TODOS_ENLACES.indexOf(campo) >= 0 && enRaices.has(v)) continue;
        fijados.add(campo);
        if (p[campo] === v) continue;
        const antes = {}; antes[campo] = p[campo];
        p[campo] = v;
        entradas.push({ segmento: id, [campo]: v, antes: antes });
      }
    }
    // Re-apuntado: todo enlace EXTERNO que referencie a un
    // absorbido pasa a apuntar a la pieza nueva (referencia viva).
    for (const [compRe, pr] of props.entries()) {
      if (compRe === id || enRaices.has(compRe)) continue;
      for (const campo of TODOS_ENLACES) {
        if (pr[campo] !== null && enRaices.has(pr[campo])) {
          console.warn('[autoría] enlace "' + campo + '" re-apuntado a la ' +
            'pieza nueva de la unión.');
          const viejo = pr[campo];
          pr[campo] = id;
          entradas.push({
            segmento: compRe, [campo]: id,
            antes: { [campo]: viejo }
          });
        }
      }
    }
    _registrarCambios(entradas);
    _reconstruir();
    return id;
  }

  /**
   * HACER DÍGITO (F4-I9 v3): con SIETE barras marcadas (las de un
   * «8» de 7 segmentos), clasifica cada barra por su GEOMETRÍA
   * (a–g) y crea un segmento FICTICIO de tipo dígito que las
   * agrupa: las siete dejan de ser manejables (no se pintan ni se
   * seleccionan en el mapa; clicar el «8» selecciona el dígito)
   * pero siguen viajando en el GWI como segmentos de juego (el
   * motor enciende cada barra por separado). TODO es UNA acción
   * atómica del historial (el alta, el tipo y los siete enlaces),
   * deshacible de un gesto. Requisitos: exactamente 7 marcados,
   * todos de tipo juego y geometría reconocible de «8».
   * @returns {void}
   */
  function _hacerDigito() {
    const lista = grupos.filter(g => marcados.has(g));
    if (lista.length !== 7) {
      baseDirector.avisarError('Hacer dígito necesita exactamente 7 barras ' +
        'marcadas (hay ' + lista.length + ').');
      return;
    }
    if (lista.some(g => g.prop.tipo !== 'juego')) {
      baseDirector.avisarError('Las siete barras deben ser de tipo juego ' +
        '(sin jugador, inicios ni contadores).');
      return;
    }
    // Ninguna barra puede pertenecer ya a OTRO dígito: compartirlas
    // entre contadores queda para otra iteración.
    for (const g of lista) {
      const dueno = _digitoDeBarra(g);
      if (dueno) {
        baseDirector.avisarError(_segId(g) + ' ya es barra del dígito ' +
          _segId(dueno) + ': las barras no se comparten.');
        return;
      }
    }
    const barras = _clasificarBarras(lista);
    if (!barras) {
      baseDirector.avisarError('La selección no parece un «8»: se necesitan ' +
        '3 barras horizontales (a, g, d) y 4 verticales sin ' +
        'ambigüedad (b, c a la derecha; f, e a la izquierda).');
      return;
    }
    // Caja de nacimiento del ficticio: envolvente de las siete.
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    for (const letra of LETRAS_BARRAS) {
      const b = barras[letra];
      x0 = Math.min(x0, b.x); y0 = Math.min(y0, b.y);
      x1 = Math.max(x1, b.x + b.ancho); y1 = Math.max(y1, b.y + b.alto);
    }
    const id = _crearFicticio({ x: x0, y: y0, ancho: x1 - x0, alto: y1 - y0 });
    const p = _propsDe(id);
    p.tipo = 'dígito';
    const entradas = [{ altaFicticio: [id, x0, y0, x1 - x0, y1 - y0] },
    {
      segmento: id, tipo: 'dígito',
      antes: { tipo: 'juego' }
    }];
    for (const letra of LETRAS_BARRAS) {
      const campo = 'barra_' + letra;
      p[campo] = barras[letra].raiz;
      entradas.push({
        segmento: id, [campo]: barras[letra].raiz,
        antes: { [campo]: null }
      });
    }
    _registrarCambios(entradas);
    _reconstruir();
    marcados = new Set();
    seleccion = _grupoDeComp(id) || null;
    _refrescar();
    _mostrarPanel();
    baseDirector.avisar('Dígito creado: ' + _segId(seleccion) +
      ' agrupa las siete barras (dejan de ser manejables).');
  }
  /**
   * HACER CONTADOR (F4-I9 v3): con 1 a 4 DÍGITOS marcados, crea un
   * segmento FICTICIO de tipo contador que agrupa el número: los
   * dígitos dejan de verse (solo se maneja el contador) pero
   * siguen viajando en el GWI — el motor enciende las barras
   * reales de cada posición. TODO es UNA acción atómica del
   * historial (tipo + enlaces), deshacible de un gesto. Los
   * dígitos no se comparten entre contadores.
   * @returns {void}
   */

  /**
   * HACER CONTADOR (F4-I9 v3): con 1 a 4 DÍGITOS marcados, crea un
   * segmento FICTICIO de tipo contador que los agrupa: los dígitos
   * dejan de ser visibles en el editor (clicar el número selecciona
   * el contador) pero siguen viajando en el GWI (el motor enciende
   * las barras reales de cada posición). digito_1 es el dígito de
   * las UNIDADES (el «8» más a la derecha) y digito_2..4 los demás,
   * hacia la izquierda. El contador interno se AUTOASIGNA al menor
   * de 1..4 que no use otro contador (el panel lo permite cambiar).
   * TODO es UNA acción atómica del historial, deshacible de un
   * gesto. Los dígitos no se comparten entre contadores.
   * @returns {void}
   */
  function _hacerContador() {
    const lista = grupos.filter(g => marcados.has(g));
    if (lista.length < 1 || lista.length > 4) {
      baseDirector.avisarError('Hacer contador necesita de 1 a 4 dígitos ' +
        'marcados (hay ' + lista.length + ').');
      return;
    }
    if (lista.some(g => g.prop.tipo !== 'dígito')) {
      baseDirector.avisarError('Sólo se agrupan segmentos de tipo dígito ' +
        '(usa «Hacer dígito» antes con cada «8»).');
      return;
    }
    // Ningún dígito puede estar ya en otro contador.
    for (const g of lista) {
      const dueno = _contadorDeDigito(g);
      if (dueno) {
        baseDirector.avisarError(_segId(g) + ' ya es dígito del contador ' +
          _segId(dueno) + ': los dígitos no se comparten.');
        return;
      }
    }
    // Unidades = el «8» presentado más a la derecha; los demás
    // crecen a la izquierda.
    lista.sort((a, b) => {
      const ca = _cajaPresentable(a), cb = _cajaPresentable(b);
      return (cb.x + cb.ancho) - (ca.x + ca.ancho);
    });
    // Caja de nacimiento del ficticio: envolvente de los dígitos.
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    for (const d of lista) {
      const c = _cajaPresentable(d);
      x0 = Math.min(x0, c.x); y0 = Math.min(y0, c.y);
      x1 = Math.max(x1, c.x + c.ancho); y1 = Math.max(y1, c.y + c.alto);
    }
    const id = _crearFicticio({ x: x0, y: y0, ancho: x1 - x0, alto: y1 - y0 });
    const p = _propsDe(id);
    p.tipo = 'contador';
    // Contador interno: el MENOR de 1..4 libre (nunca null: el
    // guardado no puede fallar por olvidarlo).
    const usados = new Set(
      grupos.filter(g => g.prop.tipo === 'contador')
        .map(g => Number(g.prop.contadorInterno))
        .filter(n => n >= 1 && n <= 4));
    let interno = 1;
    while (usados.has(interno) && interno < 4) interno++;
    p.contadorInterno = interno;
    const entradas = [{ altaFicticio: [id, x0, y0, x1 - x0, y1 - y0] },
    {
      segmento: id, tipo: 'contador',
      antes: { tipo: 'juego' }
    },
    {
      segmento: id, contadorInterno: interno,
      antes: { contadorInterno: null }
    }];
    for (let i = 0; i < lista.length; i++) {
      const campo = 'digito_' + (i + 1);
      p[campo] = lista[i].raiz;
      entradas.push({
        segmento: id, [campo]: lista[i].raiz,
        antes: { [campo]: null }
      });
    }
    _registrarCambios(entradas);
    _reconstruir();
    marcados = new Set();
    seleccion = _grupoDeComp(id) || null;
    _refrescar();
    _mostrarPanel();
    baseDirector.avisar('Contador creado: ' + _segId(seleccion) + ' agrupa ' +
      lista.length + ' dígito(s); usa el contador interno ' + interno +
      ' (cámbialo en su panel si no es el que querías).');
  }
  /**
   * SEPARAR un dígito o un contador (F4-I9 v3): disuelve el
   * FICTICIO en el sentido CONTRARIO al que se creó. El contador
   * desaparece y sus dígitos vuelven al mapa como segmentos
   * manejables; el dígito desaparece y sus barras reaparecen
   * igual. TODO es UNA acción atómica, deshacible como cualquier
   * otra (rehacer los revive tal cual estaban).
   * @returns {void}
   */

  function _separarAgrupado() {
    const g = seleccion;
    if (!g) return;
    // Solo los FICTICIOS se separan (F4-I9 v3): disuelve el grupo y
    // lo que agrupaba (barras del «8» o dígitos del número) vuelve
    // al mapa como segmentos manejables. TODO en UNA acción.
    if (g.raiz >= 0) return;
    const f = ficticios.find(x => x.id === g.raiz);
    if (!f) return;
    if (g.prop.tipo === 'dígito') {
      // Un dígito DENTRO de un contador no se separa: la referencia
      // del contador quedaría colgante. Sepárase el contador antes.
      const cont = _contadorDeDigito(g);
      if (cont) {
        baseDirector.avisarError(_segId(g) + ' es dígito del contador ' +
          _segId(cont) + ': separa primero el contador.');
        return;
      }
      // La baja se APLICA al estado vivo AQUÍ (el historial solo
      // registra: no es un replay) y el registro va DESPUÉS, con
      // los datos del ficticio tal como estaba (bug v3: se
      // registraba la baja pero nadie lo quitaba de «ficticios»,
      // así que separar no hacía NADA).
      const baja = [{
        bajaFicticio: [f.id, f.x, f.y, f.ancho, f.alto,
        f.miembros || null]
      }];
      ficticios = ficticios.filter(x => x.id !== f.id);
      _registrarCambios(baja);
      _reconstruir();
      seleccion = null;
      _refrescar();
      _mostrarPanel();
      baseDirector.avisar('Dígito separado: sus siete barras vuelven al ' +
        'mapa como segmentos manejables.');
    } else if (g.prop.tipo === 'contador') {
      // Igual que el dígito: baja APLICADA al estado vivo + registro
      // (bug v3: sin el filter, «Separar contador» no eliminaba el
      // ficticio y los dígitos seguían agrupados).
      const baja = [{
        bajaFicticio: [f.id, f.x, f.y, f.ancho, f.alto,
        f.miembros || null]
      }];
      ficticios = ficticios.filter(x => x.id !== f.id);
      _registrarCambios(baja);
      _reconstruir();
      seleccion = null;
      _refrescar();
      _mostrarPanel();
      baseDirector.avisar('Contador separado: sus dígitos vuelven al ' +
        'mapa como segmentos manejables.');
    } else if (f.miembros) {
      // Pieza de UNIÓN (v4): separar devuelve los ABSORBIDOS al
      // editor. Los enlaces EXTERNOS que apuntaban a la pieza no
      // pueden adivinar a cuál de los absorbidos volver: se anulan
      // (deshacer los restaura) y el aviso lo deja claro.
      const entradas = [];
      for (const [compRe, pr] of props.entries()) {
        if (compRe === f.id || f.miembros.indexOf(compRe) >= 0) continue;
        for (const campo of TODOS_ENLACES) {
          if (pr[campo] === f.id) {
            console.warn('[autoría] enlace "' + campo + '" de la pieza ' +
              'separada anulado.');
            const viejo = pr[campo];
            pr[campo] = null;
            entradas.push({
              segmento: compRe, [campo]: null,
              antes: { [campo]: viejo }
            });
          }
        }
      }
      entradas.unshift({
        bajaFicticio: [f.id, f.x, f.y, f.ancho, f.alto,
        f.miembros.slice()]
      });
      ficticios = ficticios.filter(x => x.id !== f.id);
      _registrarCambios(entradas);
      _reconstruir();
      seleccion = null;
      _refrescar();
      _mostrarPanel();
      baseDirector.avisar('Pieza separada: los ' + f.miembros.length +
        ' segmentos absorbidos vuelven al mapa como manejables ' +
        '(sus enlaces externos apuntaban a la pieza y quedan anulados).');
    }
  }
  /**
   * Ejecuta la elección pendiente sobre el destino clicado: enlace
   * (siguiente/dirección) o unir.
   * @param {Object} destino - Grupo clicado como destino.
   * @returns {void}
   */
  function _aplicarEleccion(destino) {
    const campo = eleccion.campo;
    const origen = eleccion.origen;
    eleccion = null;
    const idO = _segId(origen);
    const idD = _segId(destino);
    if (campo === 'unir') {
      // Tipos distintos NO se unen: casi siempre es un error del
      // autor. Se bloquea con error sin tocar nada: que cambie el
      // tipo de uno de los dos antes de unir.
      if (origen.prop.tipo !== destino.prop.tipo) {
        baseDirector.avisarError('No se pueden unir segmentos de tipos distintos (' +
          origen.prop.tipo + ' y ' + destino.prop.tipo +
          '): cambia el tipo de uno de los dos antes de unir.');
        _refrescar();
        return;
      }
      const noUnible = _motivoNoUnible([origen, destino]);   // F5-I15 (E7)
      if (noUnible) {
        baseDirector.avisarError(noUnible);
        _refrescar();
        return;
      }
      // ABSORCIÓN (v4): la unión crea una PIEZA NUEVA que absorbe a
      // los dos — mismo sistema que unirMarcados. La pieza nueva
      // hereda las props y los enlaces externos re-apuntados.
      const id = _unirGrupos([origen, destino]);
      seleccion = _grupoDeComp(id) || null;
      _refrescar();
      _mostrarPanel();
      baseDirector.avisar('Unidos ' + idO + ' y ' + idD + ' en la pieza nueva ' +
        _segId(seleccion) + ' (los originales quedan absorbidos).');
      return;
    }
    if (destino === origen) {
      baseDirector.avisarError('Un segmento no puede apuntar a sí mismo.');
      _refrescar();
      return;
    }
    // Colisiones (F3-I7): validación por campo ANTES de escribir.
    // La colisión solo apunta a un JUGADOR, y un jugador no puede ser
    // punto de colisión de varios elementos (regla cerrada en el
    // análisis: multi como ampliación futura). Los indicadores solo
    // apuntan a segmentos de contador (vida/muerte).
    // Direcciones del jugador: solo enlazan CON OTRO JUGADOR (la
    // red del jugador es de jugadores; un enlace a juego/contador
    // sería imposible de recorrer por el motor).
    if (ENLACES_JUGADOR.indexOf(campo) >= 0 &&
      destino.prop.tipo !== 'jugador') {
      baseDirector.avisarError('La dirección "' + campo + '" debe apuntar a ' +
        'un segmento de tipo jugador (' + idD + ' es ' +
        destino.prop.tipo + ').');
      _refrescar();
      return;
    }
    // Secuencia (duodécima iteración): sus segmentos solo son de
    // juego, inicio o adicional.
    if (CAMPOS_SECUENCIA.indexOf(campo) >= 0 &&
      destino.prop.tipo !== 'juego' && destino.prop.tipo !== 'inicio' &&
      destino.prop.tipo !== 'adicional') {
      baseDirector.avisarError('El segmento de la Secuencia debe ser de ' +
        'tipo juego, inicio o adicional (' + idD + ' es ' +
        destino.prop.tipo + ').');
      _refrescar();
      return;
    }
    // Acompañantes (13.ª iteración): el secundario NO forma parte
    // de NINGUNA red de enlaces — solo puede ser de tipo juego,
    // sin cadena propia ni que nadie lo apunte, sin colisión, y
    // sin ser principal de otro (no se encadenan acompañamientos).
    if (campo === 'mostrarJunto') {
      const pd = destino.prop;
      if (pd.tipo !== 'juego') {
        baseDirector.avisarError('El secundario «mostrar junto a» debe ser ' +
          'de tipo juego (' + idD + ' es ' + pd.tipo + ').');
        _refrescar(); return;
      }
      if (pd.siguiente !== null || pd.salvado !== null || pd.muerte !== null ||
        pd.colision !== null) {
        baseDirector.avisarError(idD + ' forma parte de una cadena o declara ' +
          'colisión: un secundario no pertenece a ninguna red de enlaces.');
        _refrescar(); return;
      }
      if (pd.mostrarJunto !== null) {
        baseDirector.avisarError(idD + ' ya es principal de otro secundario: ' +
          'no se encadenan acompañamientos.');
        _refrescar(); return;
      }
      if (pd.mostradoJunto !== null && _grupoDeComp(pd.mostradoJunto) !== origen) {
        baseDirector.avisarError(idD + ' ya es secundario de ' +
          _resolverEnlace(pd.mostradoJunto) + ': un secundario tiene ' +
          'un solo principal.');
        _refrescar(); return;
      }
      const duenoC = grupos.find(x => x !== origen &&
        ['siguiente', 'salvado', 'muerte'].some(c =>
          _grupoDeComp(x.prop[c]) === destino));
      if (duenoC) {
        baseDirector.avisarError(idD + ' es eslabón de la cadena de ' +
          _segId(duenoC) + ': un secundario no pertenece a ninguna ' +
          'red de enlaces.');
        _refrescar(); return;
      }
    }
    if (campo === 'colision') {
      if (destino.prop.tipo !== 'jugador') {
        baseDirector.avisarError('La colisión debe apuntar a un segmento de tipo ' +
          'jugador (' + idD + ' es ' + destino.prop.tipo + ').');
        _refrescar();
        return;
      }
      const dueno = grupos.find(x => x !== origen &&
        x.prop.colision !== null &&
        _grupoDeComp(x.prop.colision) === destino);
      if (dueno) {
        baseDirector.avisarError(idD + ' ya es el punto de colisión de ' +
          _segId(dueno) + ': un jugador no puede serlo de varios ' +
          'elementos.');
        _refrescar();
        return;
      }
    }
    const p = _propsDe(origen.raiz);
    // La cadena de un desenlace de colisión (F3-I7) enlaza con un
    // segmento de juego (p. ej. la animación de las aletas), de
    // vida/muerte (la presentación de un contador) o de inicio; a un
    // jugador no tiene sentido.
    if ((campo === 'salvado' || campo === 'muerte') && p.colision !== null &&
      destino.prop.tipo === 'jugador') {
      baseDirector.avisarError('El desenlace ' + campo + ' debe enlazar con un ' +
        'segmento de tipo juego, inicio o vida/muerte (' + idD + ' es ' +
        destino.prop.tipo + ').');
      _refrescar();
      return;
    }
    // Dígitos del contador (F4-I9): un contador solo enlaza con
    // segmentos de tipo dígito, y un dígito no se comparte entre
    // contadores; las barras de un dígito son de tipo juego y
    // tampoco se comparten entre dígitos.
    if (ENLACES_CONTADOR.indexOf(campo) >= 0) {
      if (destino.prop.tipo !== 'dígito') {
        baseDirector.avisarError('El contador debe enlazar con un segmento de ' +
          'tipo dígito (' + idD + ' es ' + destino.prop.tipo + ').');
        _refrescar();
        return;
      }
      for (const x of grupos) {
        if (x.prop.tipo === 'contador' && x !== origen) {
          for (const otra of ENLACES_CONTADOR) {
            if (_grupoDeComp(x.prop[otra]) === destino) {
              baseDirector.avisarError(idD + ' ya es dígito del contador ' +
                _segId(x) + ': los dígitos no se comparten.');
              _refrescar();
              return;
            }
          }
        }
      }
    }
    if (ENLACES_DIGITO.indexOf(campo) >= 0) {
      if (destino.prop.tipo !== 'juego') {
        baseDirector.avisarError('Las barras son segmentos de tipo juego (' +
          idD + ' es ' + destino.prop.tipo + ').');
        _refrescar();
        return;
      }
      for (const x of grupos) {
        if (x.prop.tipo === 'dígito' && x !== origen) {
          for (const otra of ENLACES_DIGITO) {
            if (_grupoDeComp(x.prop[otra]) === destino) {
              baseDirector.avisarError(idD + ' ya es la barra "' +
                otra.replace('barra_', '') + '" del dígito ' +
                _segId(x) + ': las barras no se comparten.');
              _refrescar();
              return;
            }
          }
        }
      }
    }
    if (p[campo] !== null) {
      console.warn('[autoría] ' + campo + ' de ' + idO + ' redefinido (antes: ' +
        _resolverEnlace(p[campo]) + ').');
    }
    const viejo = p[campo];
    p[campo] = destino.raiz;
    // INVERSAS AUTOMÁTICAS de las direcciones (duodécima
    // iteración): al marcar X.dirección = Y se escribe YA
    // Y.inverso = X en la MISMA acción atómica del historial
    // (deshacer/rehacer juntos). La redefinición retira el inverso
    // del destino ANTERIOR (si apuntaba de vuelta) y el inverso que
    // el nuevo destino tuviera hacia un tercero se anula también
    // (su enlace directo hacia el destino se retira): la red queda
    // coherente por los dos lados sin esperar a la verificación.
    const entradas = [{
      segmento: origen.raiz, [campo]: destino.raiz,
      antes: { [campo]: viejo }
    }];
    if (ENLACES_JUGADOR.indexOf(campo) >= 0) {
      const inv = INVERSO[campo];
      const pd = _propsDe(destino.raiz);
      const viejoInv = pd[inv];
      if (viejoInv !== origen.raiz) {
        if (viejo !== null) {
          const ant = _grupoDeComp(viejo);
          if (ant) {
            const pa = _propsDe(ant.raiz);
            if (pa[inv] === origen.raiz) {
              entradas.push({
                segmento: ant.raiz, [inv]: null,
                antes: { [inv]: origen.raiz }
              });
              pa[inv] = null;
            }
          }
        }
        if (viejoInv !== null) {
          const tercero = _grupoDeComp(viejoInv);
          if (tercero) {
            const pt = _propsDe(tercero.raiz);
            if (pt[campo] === destino.raiz) {
              entradas.push({
                segmento: tercero.raiz, [campo]: null,
                antes: { [campo]: destino.raiz }
              });
              pt[campo] = null;
            }
          }
        }
        entradas.push({
          segmento: destino.raiz, [inv]: origen.raiz,
          antes: { [inv]: viejoInv }
        });
        pd[inv] = origen.raiz;
      }
    }
    // ACOMPAÑANTES (13.ª iteración): al marcar A.mostrarJunto = B
    // se escribe YA B.mostradoJunto = A — misma acción atómica del
    // historial y misma coherencia de red que las inversas de las
    // direcciones (retirada del secundario del destino anterior y
    // del principal de un tercero que apuntara al nuevo secundario).
    if (campo === 'mostrarJunto') {
      const inv = 'mostradoJunto';
      const pdd = _propsDe(destino.raiz);
      const viejoInv = pdd[inv];
      if (viejoInv !== origen.raiz) {
        if (viejo !== null) {
          const ant = _grupoDeComp(viejo);
          if (ant && _propsDe(ant.raiz)[inv] === origen.raiz) {
            entradas.push({
              segmento: ant.raiz, [inv]: null,
              antes: { [inv]: origen.raiz }
            });
            _propsDe(ant.raiz)[inv] = null;
          }
        }
        if (viejoInv !== null) {
          const tercero = _grupoDeComp(viejoInv);
          if (tercero && _propsDe(tercero.raiz)[campo] === destino.raiz) {
            entradas.push({
              segmento: tercero.raiz, [campo]: null,
              antes: { [campo]: destino.raiz }
            });
            _propsDe(tercero.raiz)[campo] = null;
          }
        }
        entradas.push({
          segmento: destino.raiz, [inv]: origen.raiz,
          antes: { [inv]: viejoInv }
        });
        pdd[inv] = origen.raiz;
      }
    }
    _registrarCambios(entradas);
    // Reconstruir ANTES de refrescar: el enlace se escribió en la prop
    // del componente (fuente de verdad), pero la vista lee g.prop (la
    // copia fusionada que solo reconstruir actualiza). Sin esto, el
    // azul de relación no aparecía hasta que un cambio de tipo
    // reconstruyera (bug de "los colores no salen").
    _reconstruir();
    seleccion = _grupoDeComp(origen.raiz) || null;   // grupos nuevos tras reconstruir
    _refrescar();
    _mostrarPanel();
    baseDirector.avisar(idO + '.' + campo + ' = ' + idD + '.');
  }

  // ---- Panel de propiedades ----

  /**
   * Panel de propiedades del segmento seleccionado: título con su
   * número (ruta/contador), tipo, número con ↑/↓ (numerable),
   * enlaces del tipo (Elegir), unir y deshacer
   * unión.
   * @returns {void}
   */
  function _mostrarPanel() {
    const g = seleccion;
    const panel = _$('panelSegmento');
    panel.replaceChildren();
    // Selección MÚLTIPLE por recuadro: panel mínimo con el UNIR de
    // todos los marcados (un clic en el mapa los desmarca).
    if (marcados.size > 1) {
      panel.classList.remove('oculto');
      const n = marcados.size;
      const titulo = document.createElement('h3');
      titulo.textContent = n + ' segmentos marcados';
      panel.appendChild(titulo);
      const nota = document.createElement('div');
      nota.className = 'subPanel';
      nota.textContent = 'Todo lo que cortaba el recuadro (total o parcialmente). ' +
        'Un clic en el mapa desmarca.';
      panel.appendChild(nota);
      const fila = document.createElement('div');
      fila.className = 'filaProp';
      const et = document.createElement('label');
      et.textContent = 'Unión';
      const bUnir = document.createElement('button');
      bUnir.type = 'button';
      bUnir.textContent = 'Unir ' + n + ' segmentos';
      bUnir.addEventListener('click', _unirMarcados);
      fila.appendChild(et);
      fila.appendChild(bUnir);
      panel.appendChild(fila);
      // Hacer dígito (F4-I9): con exactamente 7 barras marcadas
      // clasifica la geometría del «8» y crea el segmento dígito.
      const filaDig = document.createElement('div');
      filaDig.className = 'filaProp';
      const etDig = document.createElement('label');
      etDig.textContent = 'Dígito';
      const bDig = document.createElement('button');
      bDig.type = 'button';
      bDig.textContent = 'Hacer dígito (7 barras)';
      bDig.title = 'Clasifica las siete barras marcadas como el «8» de un ' +
        'display de 7 segmentos (a–g) y crea un NUEVO segmento ' +
        'dígito que las agrupa (dejan de ser manejables).';
      bDig.addEventListener('click', _hacerDigito);
      filaDig.appendChild(etDig);
      filaDig.appendChild(bDig);
      panel.appendChild(filaDig);
      // Hacer contador (F4-I9): con 1 a 4 dígitos marcados agrupa
      // el número (unidades = el más a la derecha).
      const filaCon = document.createElement('div');
      filaCon.className = 'filaProp';
      const etCon = document.createElement('label');
      etCon.textContent = 'Contador';
      const bCon = document.createElement('button');
      bCon.type = 'button';
      bCon.textContent = 'Hacer contador (1-4 dígitos)';
      bCon.title = 'Agrupa los dígitos marcados en un NUEVO segmento de ' +
        'contador (dejan de verse: se maneja solo el contador); ' +
        'el de las unidades es digito_1.';
      bCon.addEventListener('click', _hacerContador);
      filaCon.appendChild(etCon);
      filaCon.appendChild(bCon);
      panel.appendChild(filaCon);
      return;
    }
    if (!g) {
      panel.classList.add('oculto');
      return;
    }
    panel.classList.remove('oculto');
    const p = _propsDe(g.raiz);

    const titulo = document.createElement('h3');
    titulo.textContent = _segId(g) + ' · ' + g.ancho + '×' + g.alto +
      ' · ' + g.spriteId +
      ((p.tipo === 'inicio') ? ' · INICIO DE RUTA ' + _numRuta(g) : '') +
      ((p.tipo === 'vida' || p.tipo === 'muerte') ?
        ' · ' + p.tipo.toUpperCase() + ' ' + _numContador(g) : '');
    panel.appendChild(titulo);

    // Segmento de CARTUCHO (F3-I11): panel PROPIO — la ficha de las
    // características del cartucho que no se definen de forma
    // gráfica. Hoy: el mecanismo de fin de partida; aquí irán
    // llegando los parámetros de fases posteriores. Nada de tipos,
    // enlaces ni uniones: no es arte.
    if (p.tipo === 'cartucho') {
      const sub = document.createElement('div');
      sub.className = 'subPanel';
      sub.textContent = 'Características del cartucho. No es arte: ' +
        'nunca se presenta en pantalla.';
      panel.appendChild(sub);

      // Mecanismo de fin: las opciones se ofrecen según lo que el
      // cartucho tiene (iconos solo si existe su familia; el
      // contador solo si NO hay iconos — excluyentes, no se
      // permite definir el contador de vidas con vida/muerte en
      // el cartucho).
      const hayVida = grupos.some(x => x.prop.tipo === 'vida' && !x.absorbido);
      const hayMuerte = grupos.some(x => x.prop.tipo === 'muerte' && !x.absorbido);
      const filaFin = document.createElement('div');
      filaFin.className = 'filaProp';
      const etFin = document.createElement('label');
      etFin.textContent = 'Mecanismo de fin';
      const selFin = document.createElement('select');
      const opciones = [['ninguno', '(sin definir)']];
      if (hayVida) opciones.push(['vida', 'Iconos de vida (se apagan al perder)']);
      if (hayMuerte) opciones.push(['muerte', 'Iconos de muerte (se encienden al morir)']);
      if (!hayVida && !hayMuerte) {
        opciones.push(['contador', 'Contador interno (termina al llegar a cero)']);
      }
      for (const [v, t] of opciones) {
        const op = document.createElement('option');
        op.value = v;
        op.textContent = t;
        selFin.appendChild(op);
      }
      selFin.value = (p.finJuego === null) ? 'ninguno' : p.finJuego;
      selFin.addEventListener('change', () => {
        const nuevo = (selFin.value === 'ninguno') ? null : selFin.value;
        const entradas = [{
          segmento: g.raiz, finJuego: nuevo,
          antes: { finJuego: p.finJuego }
        }];
        p.finJuego = nuevo;
        // Al dejar de ser «contador», su contador de fin sobra; al
        // SERLO, el contador interno arranca en 1 (nada sin definir).
        if (nuevo !== 'contador' && p.finContador !== null) {
          entradas.push({
            segmento: g.raiz, finContador: null,
            antes: { finContador: p.finContador }
          });
          p.finContador = null;
        }
        if (nuevo === 'contador' && p.finContador === null) {
          entradas.push({
            segmento: g.raiz, finContador: 1,
            antes: { finContador: null }
          });
          p.finContador = 1;
        }
        _registrarCambios(entradas);
        _reconstruir();
        seleccion = _grupoDeComp(g.raiz) || null;
        _refrescar();
        _mostrarPanel();
      });
      filaFin.appendChild(etFin);
      filaFin.appendChild(selFin);
      panel.appendChild(filaFin);
      if (hayVida || hayMuerte) {
        const nota = document.createElement('div');
        nota.className = 'subPanel';
        nota.textContent = 'Con segmentos de vida/muerte en el cartucho, ' +
          'el fin por contador no se ofrece: ambos sistemas ' +
          'son excluyentes.';
        panel.appendChild(nota);
      }

      // Contador interno del fin, solo con mecanismo «contador».
      if (p.finJuego === 'contador') {
        const filaCon = document.createElement('div');
        filaCon.className = 'filaProp';
        const etCon = document.createElement('label');
        etCon.textContent = 'Contador interno';
        const selCon = document.createElement('select');
        for (let n = 1; n <= 4; n++) {
          const op = document.createElement('option');
          op.value = String(n);
          op.textContent = String(n);
          selCon.appendChild(op);
        }
        selCon.value = String(Number(p.finContador) || 1);
        selCon.addEventListener('change', () => {
          const nuevo = Number(selCon.value);
          _registrarCambio(g.raiz, { finContador: nuevo },
            { finContador: p.finContador });
          p.finContador = nuevo;
          _reconstruir();
          seleccion = _grupoDeComp(g.raiz) || null;
          _refrescar();
          _mostrarPanel();
        });
        filaCon.appendChild(etCon);
        filaCon.appendChild(selCon);
        panel.appendChild(filaCon);
        const notaCon = document.createElement('div');
        notaCon.className = 'subPanel';
        notaCon.textContent = 'El contador elegido debe existir en pantalla ' +
          '(un contador descendente con ese número interno).';
        panel.appendChild(notaCon);
      }

      // SECUENCIA (duodécima iteración): animación periódica del
      // cartucho — hasta 5 segmentos (juego/inicio/adicional) que
      // se encienden EN ORDEN, uno por tick, y se relanza cada
      // «ticks» + lo que dure la animación.
      const subSec = document.createElement('div');
      subSec.className = 'subPanel';
      subSec.textContent = 'Secuencia (animación periódica): hasta 5 ' +
        'segmentos (juego/inicio/adicional) encendidos ' +
        'en orden, uno por tick.';
      panel.appendChild(subSec);
      {
        const filaT = document.createElement('div');
        filaT.className = 'filaProp';
        const etT = document.createElement('label');
        etT.textContent = 'Ticks entre lanzamientos';
        etT.title = 'Cada cuántos ticks se relanza la animación ' +
          '(el periodo real es esto más lo que dura).';
        const inpT = document.createElement('input');
        inpT.type = 'number';
        inpT.min = '1';
        inpT.max = '99';
        inpT.value = (p.secTicks === null) ? '' : String(p.secTicks);
        inpT.placeholder = 'sin Secuencia';
        inpT.addEventListener('change', () => {
          let nuevo = null;
          if (inpT.value !== '') {
            nuevo = Math.max(1, Math.floor(Number(inpT.value) || 0));
            if (nuevo > 99) {            // F5-I16 (R2): recorte por arriba, con aviso
              nuevo = 99;
              inpT.value = String(nuevo);
              baseDirector.avisar('Ticks entre lanzamientos limitados a 99.');
            }
          }
          if (nuevo === p.secTicks) return;
          const viejo = p.secTicks;
          p.secTicks = nuevo;
          _registrarCambio(g.raiz, { secTicks: nuevo },
            { secTicks: viejo });
          _reconstruir();
          seleccion = _grupoDeComp(g.raiz) || null;
          _refrescar();
          _mostrarPanel();
        });
        filaT.appendChild(etT);
        filaT.appendChild(inpT);
        panel.appendChild(filaT);
      }
      for (let k = 1; k <= 5; k++) {
        const campo = 'sec_' + k;
        const fila = document.createElement('div');
        fila.className = 'filaProp';
        const et = document.createElement('label');
        et.textContent = 'Segmento ' + k;
        const valor = document.createElement('span');
        valor.className = 'valor';
        valor.textContent = _resolverEnlace(p[campo]) || '—';
        const bElegir = document.createElement('button');
        bElegir.type = 'button';
        bElegir.textContent = 'Elegir';
        bElegir.addEventListener('click', () => {
          eleccion = { campo: campo, origen: g };
          _refrescarInfo();
          baseDirector.avisar('Pulsa en el mapa el segmento ' + k +
            ' de la Secuencia.');
        });
        fila.appendChild(et);
        fila.appendChild(valor);
        fila.appendChild(bElegir);
        if (p[campo] !== null) {
          const bQuitar = document.createElement('button');
          bQuitar.type = 'button';
          bQuitar.textContent = 'Quitar';
          bQuitar.addEventListener('click', () => {
            const viejo = p[campo];
            p[campo] = null;
            _registrarCambio(g.raiz, { [campo]: null },
              { [campo]: viejo });
            _reconstruir();
            seleccion = _grupoDeComp(g.raiz) || null;
            _refrescar();
            _mostrarPanel();
          });
          fila.appendChild(bQuitar);
        }
        panel.appendChild(fila);
      }

      // ---- F4-I2: la ficha del DIRECTOR (pausas, aceleración y
      // política de rutas). Los campos numéricos
      // comparten comportamiento: entero positivo, historial
      // (deshacer/rehacer) y refresco con reconstrucción, que
      // sincroniza el puente en vivo.
      const campoNumero = (etiqueta, campo, ayuda, minimo, maximo) => {
        const fila = document.createElement('div');
        fila.className = 'filaProp';
        const et = document.createElement('label');
        et.textContent = etiqueta;
        et.title = ayuda || '';
        const inp = document.createElement('input');
        inp.type = 'number';
        inp.min = String((minimo === undefined || minimo === null) ? 1 : minimo);
        inp.max = String(maximo || 9999);   // F5-I16: máximos prácticos por campo
        inp.value = (p[campo] === null) ? '' : String(p[campo]);
        inp.placeholder = 'sin definir';
        inp.addEventListener('change', () => {
          let nuevo = null;
          if (inp.value !== '') {
            nuevo = Math.max((minimo === undefined || minimo === null) ? 1 : minimo,
              Math.floor(Number(inp.value) || 0));
            if (maximo && nuevo > maximo) {   // F5-I16 (R3): recorte por arriba, con aviso
              nuevo = maximo;
              inp.value = String(nuevo);
              baseDirector.avisar(etiqueta + ': limitado a ' + maximo + '.');
            }
          }
          if (nuevo === p[campo]) return;
          const viejo = p[campo];
          p[campo] = nuevo;
          _registrarCambio(g.raiz, { [campo]: nuevo }, { [campo]: viejo });
          _reconstruir();
          seleccion = _grupoDeComp(g.raiz) || null;
          _refrescar();
          _mostrarPanel();
        });
        fila.appendChild(et);
        fila.appendChild(inp);
        panel.appendChild(fila);
      };

      // PAUSAS por plataforma (F4-I2).
      const subP = document.createElement('div');
      subP.className = 'subPanel';
      subP.textContent = 'Pausas del reloj (ms): la del simulador ' +
        '(PC) y la del sistema externo (ESP32). ' +
        'Sin valor: 500 ms, el histórico.';
      panel.appendChild(subP);
      campoNumero('Pausa simulador', 'pausaSim',
        'Milisegundos entre ticks en el simulador de PC.', 1, 999);
      campoNumero('Pausa externo', 'pausaEsp',
        'Milisegundos entre ticks en el ESP32.', 1, 999);

      // ACELERACIÓN (F4-I2): los tres valores o ninguno.
      const subA = document.createElement('div');
      subA.className = 'subPanel';
      subA.textContent = 'Aceleración: cada N ticks de partida la ' +
        'pausa baja unos ms hasta un mínimo. Sin ' +
        'valores: pausa fija toda la partida.';
      panel.appendChild(subA);
      campoNumero('Ticks entre reducciones', 'accCada',
        'Cada cuántos ticks de partida baja la pausa.', 1, 99);
      campoNumero('Reducción (ms)', 'accResta',
        'Cuántos ms baja la pausa en cada reducción.', 1, 999);
      campoNumero('Pausa mínima (ms)', 'accMinimo',
        'La pausa nunca baja de este valor.', 0, 999);

      // POLÍTICA DE RUTAS (F4-I2).
      const subR = document.createElement('div');
      subR.className = 'subPanel';
      subR.textContent = 'Política de rutas: cada N rutas lanzadas ' +
        'sube en 1 el máximo de rutas simultáneas ' +
        '(tope: las rutas del cartucho). Sin valor: ' +
        'una sola a la vez, la regla histórica.';
      panel.appendChild(subR);
      campoNumero('Nº para aumentar rutas', 'aumentarCada',
        'Cada cuántas rutas lanzadas sube el máximo de ' +
        'simultáneas.', 1, 99);

      return;
    }

    // Número por defecto + botones de subir/bajar para inicios y
    // contadores (vida/muerte): el número mostrado es la posición en
    // la familia (siempre 1..N, sin huecos ni duplicados); subir o
    // bajar INTERCAMBIA el orden con el vecino y renumera todo. Así
    // el autor corrige el orden sin poder romper la coherencia.
    if (p.tipo === 'inicio' || p.tipo === 'vida' || p.tipo === 'muerte') {
      const filaOrden = document.createElement('div');
      filaOrden.className = 'filaProp';
      const etOrden = document.createElement('label');
      etOrden.textContent = 'Nº de ' +
        ((p.tipo === 'inicio') ? 'ruta' : 'contador');
      const numSpan = document.createElement('span');
      numSpan.className = 'valor';
      numSpan.textContent = String(_numeroDe(g, p.tipo));
      const bSubir = document.createElement('button');
      bSubir.type = 'button';
      bSubir.textContent = '↑ Subir';
      bSubir.addEventListener('click', () => {
        if (!_moverNumero(g, -1)) {
          baseDirector.avisar('Ya es el primero de su ' +
            ((p.tipo === 'inicio') ? 'ruta' : 'contador') + '.');
          return;
        }
        _reconstruir();
        seleccion = _grupoDeComp(g.raiz) || null;
        _refrescar();
        _mostrarPanel();
      });
      const bBajar = document.createElement('button');
      bBajar.type = 'button';
      bBajar.textContent = '↓ Bajar';
      bBajar.addEventListener('click', () => {
        if (!_moverNumero(g, +1)) {
          baseDirector.avisar('Ya es el último de su ' +
            ((p.tipo === 'inicio') ? 'ruta' : 'contador') + '.');
          return;
        }
        _reconstruir();
        seleccion = _grupoDeComp(g.raiz) || null;
        _refrescar();
        _mostrarPanel();
      });
      filaOrden.appendChild(etOrden);
      filaOrden.appendChild(numSpan);
      filaOrden.appendChild(bSubir);
      filaOrden.appendChild(bBajar);
      panel.appendChild(filaOrden);
    }

    // Tipo: juego por defecto; jugador / contador / inicio como excepción
    const filaTipo = document.createElement('div');
    filaTipo.className = 'filaProp';
    const etTipo = document.createElement('label');
    etTipo.textContent = 'Tipo';
    const selTipo = document.createElement('select');
    for (const t of TIPOS) {
      const op = document.createElement('option');
      op.value = t;
      op.textContent = t;
      selTipo.appendChild(op);
    }
    selTipo.value = p.tipo || 'juego';
    selTipo.addEventListener('change', () => {
      // Un FICTICIO (F4-I9 v3) solo puede ser dígito o contador: no
      // tiene pixels propios y cambiarlo a juego/inicio/... dejaría
      // un segmento vacío en el mapa. Las piezas de UNIÓN (v4) sí
      // pueden ser de cualquier tipo: llevan su imagen fusionada.
      const fSel = ficticios.find(x => x.id === g.raiz);
      if (g.raiz < 0 && !(fSel && fSel.miembros) &&
        selTipo.value !== 'dígito' && selTipo.value !== 'contador') {
        baseDirector.avisarError('Un segmento ficticio (creado por ' +
          '«Hacer dígito»/«Hacer contador») solo puede ser dígito ' +
          'o contador: sepáralo primero si quieres otra cosa.');
        selTipo.value = p.tipo;
        return;
      }
      // F5-I15 (E7): una pieza de UNIÓN no puede pasar a dígito ni a
      // contador (F3-I10): esos tipos nacen solo de «Hacer dígito» y
      // «Hacer contador», con sus barras y dígitos, no de una unión.
      if (fSel && fSel.miembros &&
        (selTipo.value === 'dígito' || selTipo.value === 'contador')) {
        baseDirector.avisarError('Una pieza de unión no puede ser ' +
          selTipo.value + ': el dígito y el contador nacen de «Hacer ' +
          'dígito» y «Hacer contador».');
        selTipo.value = p.tipo;
        return;
      }
      const anterior = p.tipo;
      p.tipo = selTipo.value;
      // Enlaces excluyentes: al cambiar de tipo se descartan AQUÍ, en
      // el origen, los enlaces del tipo anterior (así no queda
      // información sobrante ni en memoria ni en el GWI). Los
      // descartes van en la MISMA operación del historial (null =
      // anulado): el deshacer futuro debe poder recomponerlos.
      const descartes = {};
      const previos = { tipo: anterior };
      if (anterior !== p.tipo) {
        // F5-I15 (E4): solo se descartan los campos que el tipo NUEVO no
        // usa (juego→inicio comparten siguiente/salvado/muerte/mostrarJunto:
        // antes se perdían todos al cambiar).
        const camposNuevos = _camposDe(p.tipo);
        for (const campo of _camposDe(anterior)) {
          if (camposNuevos.indexOf(campo) >= 0) continue;
          if (p[campo] !== null) {
            console.warn('[autoría] ' + _segId(g) + ' pasa a ' + p.tipo +
              ': se descarta su enlace "' + campo + '" (' +
              _resolverEnlace(p[campo]) + ').');
            previos[campo] = p[campo];
            descartes[campo] = null;
            p[campo] = null;
          }
        }
        // La marca de PRIMER JUGADOR es del tipo jugador: al dejar
        // de serlo, se descarta también (misma acción del historial).
        if (anterior === 'jugador' && p.primero) {
          console.warn('[autoría] ' + _segId(g) + ' pasa a ' + p.tipo +
            ': se descarta su marca de primer jugador.');
          previos.primero = p.primero;
          descartes.primero = null;
          p.primero = null;
        }
        // Las colisiones (F3-I7) son de los tipos de ruta (juego e
        // inicio): al dejar de serlo, se descartan la colisión y sus
        // contadores de desenlace. El inverso 'colisionDe' es del
        // jugador: al dejar de serlo, también (lo recalculará la
        // verificación).
        if (TIPOS_COLISION.indexOf(anterior) >= 0 &&
          TIPOS_COLISION.indexOf(p.tipo) < 0) {
          for (const campo of [...ENLACES_COLISION, ...CONTADORES_COLISION]) {
            if (p[campo] !== null) {
              console.warn('[autoría] ' + _segId(g) + ' pasa a ' + p.tipo +
                ': se descarta su "' + campo + '" (' +
                (_resolverEnlace(p[campo]) || p[campo]) + ').');
              previos[campo] = p[campo];
              descartes[campo] = null;
              p[campo] = null;
            }
          }
        }
        if (anterior === 'jugador' && p.colisionDe !== null) {
          console.warn('[autoría] ' + _segId(g) + ' pasa a ' + p.tipo +
            ': se descarta su inverso de colisión.');
          previos.colisionDe = p.colisionDe;
          descartes.colisionDe = null;
          p.colisionDe = null;
        }
        // Al dejar de ser CONTADOR (F4-I9) se restauran los valores
        // por defecto de sus propiedades (el enlace 'digito' ya lo
        // descarta el bucle de camposDe). Misma acción del historial.
        if (anterior === 'contador' && p.tipo !== 'contador') {
          if (p.contadorInterno !== null) {
            previos.contadorInterno = p.contadorInterno;
            descartes.contadorInterno = null;
            p.contadorInterno = null;
          }
          if (p.valorInicial !== 0) {
            previos.valorInicial = p.valorInicial;
            descartes.valorInicial = 0;
            p.valorInicial = 0;
          }
          if (p.direccion !== 'ascendente') {
            previos.direccion = p.direccion;
            descartes.direccion = 'ascendente';
            p.direccion = 'ascendente';
          }
          if (p.presentarCero !== true) {
            previos.presentarCero = p.presentarCero;
            descartes.presentarCero = true;
            p.presentarCero = true;
          }
        }
      }
      // ASOCIACIÓN AUTOMÁTICA DEL FIN (v12.6): al crear el PRIMER
      // segmento de vida/muerte, si la ficha del cartucho no tenía
      // mecanismo de fin, se asocia YA esa familia — lo normal es
      // que los iconos sean el fin; el autor solo tiene que tocar
      // la ficha para cambiarlo. Va en la MISMA acción atómica del
      // historial: deshacer el cambio de tipo revierte también la
      // asociación. Si el fin YA estaba definido (o es «contador»),
      // no se toca: manda lo que el autor puso a mano.
      const entradasAccion = [Object.assign({
        segmento: g.raiz,
        tipo: p.tipo
      }, descartes, { antes: previos })];
      const cart = _cartuchoDe();
      // OJO: se escribe en _propsDe(cart.raiz) — el MAPA de props es
      // la fuente de verdad; g.prop es una copia que _reconstruir()
      // re-fusiona y lo puesto ahí se perdería.
      const pCart = cart ? _propsDe(cart.raiz) : null;
      // Desasociación simétrica: si este era el ÚLTIMO de su familia
      // y el fin apuntaba a ella, se retira en la misma acción (un
      // fin sin familia es un error bloqueante en la verificación:
      // mejor no dejarlo colgando sin que el autor lo pida).
      if ((anterior === 'vida' || anterior === 'muerte') &&
        p.tipo !== anterior && pCart &&
        pCart.finJuego === anterior) {
        const quedan = grupos.some(x => x !== g && !x.absorbido && x.prop.tipo === anterior);
        if (!quedan) {
          pCart.finJuego = null;
          entradasAccion.push({
            segmento: cart.raiz, finJuego: null,
            antes: { finJuego: anterior }
          });
          baseDirector.avisar('Sin segmentos de ' + anterior +
            ': el fin de partida queda sin definir.');
        }
      }
      // Asociación: al crear el PRIMER segmento de vida/muerte, si la
      // ficha no tenía mecanismo de fin, se asocia YA esa familia.
      if ((p.tipo === 'vida' || p.tipo === 'muerte') &&
        anterior !== p.tipo && pCart &&
        pCart.finJuego === null) {
        pCart.finJuego = p.tipo;
        entradasAccion.push({
          segmento: cart.raiz, finJuego: p.tipo,
          antes: { finJuego: null }
        });
        baseDirector.avisar('Fin de partida asociado a los iconos de ' +
          p.tipo + ' (primer segmento de la familia).');
      }
      // F5-I15 (E4): si se descartó el «mostrar junto a», el SECUNDARIO
      // pierde su mostradoJunto (el enlace es simétrico) — misma acción.
      if (previos.mostrarJunto !== undefined) {
        const sec = _grupoDeComp(previos.mostrarJunto);
        if (sec && _propsDe(sec.raiz).mostradoJunto === g.raiz) {
          entradasAccion.push({
            segmento: sec.raiz, mostradoJunto: null,
            antes: { mostradoJunto: g.raiz }
          });
          _propsDe(sec.raiz).mostradoJunto = null;
        }
      }
      // INVERSAS AUTOMÁTICAS (duodécima iteración): al dejar de ser
      // jugador, los DESTINOS de sus direcciones pierden su inverso
      // si apuntaban de vuelta — misma acción atómica del cambio de
      // tipo (deshacer/rehacer los revierte juntos).
      if (anterior === 'jugador' && p.tipo !== 'jugador') {
        for (const campo of ENLACES_JUGADOR) {
          const viejoD = previos[campo];
          if (viejoD === undefined) continue;   // no lo tenía
          const dest = _grupoDeComp(viejoD);
          if (!dest) continue;
          const inv = INVERSO[campo];
          const pd = _propsDe(dest.raiz);
          if (pd[inv] === g.raiz) {
            entradasAccion.push({
              segmento: dest.raiz, [inv]: null,
              antes: { [inv]: g.raiz }
            });
            pd[inv] = null;
          }
        }
      }
      _registrarCambios(entradasAccion);
      _reconstruir();      // g.prop debe reflejar el cambio YA (pantalla/mapa)
      // _reconstruir() recrea los grupos: el g capturado por el panel
      // queda obsoleto. Re-localizamos el grupo por su componente raíz.
      seleccion = _grupoDeComp(g.raiz) || null;
      _refrescar();
      _mostrarPanel();
      // Traza de diagnóstico (temporal): si el color no cambia en
      // pantalla, esto dice si el problema es el repintado o el estado.
      console.info('[autoría] tipo cambiado a "' + p.tipo + '" en ' + _segId(g) +
        ' · color esperado: ' + COLOR_TIPO[p.tipo] +
        ' · pantalla redibujada: ' + (seleccion ? 'sí' : 'no'));
    });
    filaTipo.appendChild(etTipo);
    filaTipo.appendChild(selTipo);
    panel.appendChild(filaTipo);

    // Pieza de UNIÓN (v4): si el seleccionado es un ficticio con
    // absorbidos, ofrecer «Separar pieza» (el dígito y el contador
    // llevan el suyo propio más abajo).
    {
      const fSel = ficticios.find(x => x.id === g.raiz);
      if (g.raiz < 0 && fSel && fSel.miembros &&
        p.tipo !== 'dígito' && p.tipo !== 'contador') {
        const filaSep = document.createElement('div');
        filaSep.className = 'filaProp';
        const etSep = document.createElement('label');
        etSep.textContent = 'Agrupación';
        const bSep = document.createElement('button');
        bSep.type = 'button';
        bSep.textContent = 'Separar pieza';
        bSep.title = 'La pieza desaparece y los ' + fSel.miembros.length +
          ' segmentos absorbidos vuelven al editor como ' +
          'manejables.';
        bSep.addEventListener('click', _separarAgrupado);
        filaSep.appendChild(etSep);
        filaSep.appendChild(bSep);
        panel.appendChild(filaSep);
      }
    }

    // Marca de PRIMER JUGADOR (F3-I3): el segmento jugador con el
    // que la partida empieza. Solo puede haber UNO: marcar otro
    // quita la marca del anterior (prevalece el que se acaba de
    // marcar), y ambas cosas van en la MISMA acción atómica del
    // historial (el deshacer las revierte juntas). Sin ninguna
    // marca, el motor usa el primero que encuentre en la lista.
    if (p.tipo === 'jugador') {
      const filaPrimero = document.createElement('div');
      filaPrimero.className = 'filaProp';
      const etPrimero = document.createElement('label');
      etPrimero.textContent = 'Jugador inicial';
      const chk = document.createElement('input');
      chk.type = 'checkbox';
      chk.checked = !!p.primero;
      chk.title = 'El segmento jugador encendido al empezar la partida. ' +
        'Si no se marca ninguno, el motor usa el primero que encuentre.';
      chk.addEventListener('change', () => {
        if (chk.checked) {
          // Una sola marca: quitársela al que la tuviera (si es otro)
          // y ponérsela a este, en una acción atómica.
          const entradas = [];
          for (const otro of grupos) {
            if (otro !== g && otro.prop.tipo === 'jugador' && otro.prop.primero) {
              const pOtro = _propsDe(otro.raiz);
              entradas.push({
                segmento: otro.raiz, primero: null,
                antes: { primero: pOtro.primero }
              });
              pOtro.primero = null;
            }
          }
          entradas.push({
            segmento: g.raiz, primero: true,
            antes: { primero: p.primero }
          });
          p.primero = true;
          _registrarCambios(entradas);
          baseDirector.avisar('Primer jugador: ' + _segId(g) + '.');
        } else {
          _registrarCambio(g.raiz, { primero: null }, { primero: p.primero });
          p.primero = null;
          baseDirector.avisar('Sin marca de primer jugador: el motor usará ' +
            'el primero que encuentre.');
        }
        _reconstruir();
        seleccion = _grupoDeComp(g.raiz) || null;
        _refrescar();
        _mostrarPanel();
      });
      filaPrimero.appendChild(etPrimero);
      filaPrimero.appendChild(chk);
      panel.appendChild(filaPrimero);
    }

    // Los SEIS enlaces viven SIEMPRE en el panel; solo se activan los
    // que corresponden al tipo (disabled en los demás). Así el autor
    // ve el modelo completo sin re-dibujos y entiende qué enlaces
    // tiene cada tipo. Cambiar de tipo descarta los del otro (lo hace
    // reconstruir, con aviso en consola).
    const nombres = {
      siguiente: 'Siguiente', salvado: 'Al salvarse va a',
      muerte: 'Al morir va a',
      izquierda: 'Izquierda (botón IZQ)', derecha: 'Derecha (botón DER)',
      arriba: 'Arriba', abajo: 'Abajo',
      mostrarJunto: 'Mostrar junto a'
    };
    const activos = _camposDe(p.tipo);
    const grupoEtiqueta = (p.tipo === 'jugador') ? 'direcciones' : 'cadena';
    const subtitulo = document.createElement('div');
    subtitulo.className = 'subPanel';
    subtitulo.textContent = 'Enlaces de ' + grupoEtiqueta +
      ' (los demás desactivados para tipo ' + p.tipo + ')';
    panel.appendChild(subtitulo);

    for (const campo of [...ENLACES_JUEGO, ...ENLACES_JUGADOR]) {
      // En los tipos de ruta (juego/inicio), las cadenas de los
      // desenlaces (colisión positiva/negativa) se pintan ABAJO, en
      // el bloque de colisiones, tras «Colisión con jugador» y solo
      // activas con la colisión declarada (F3-I7).
      if ((campo === 'salvado' || campo === 'muerte') &&
        TIPOS_COLISION.indexOf(p.tipo) >= 0) continue;
      const activo = activos.includes(campo);
      const fila = document.createElement('div');
      fila.className = 'filaProp' + (activo ? '' : ' inactivo');
      const et = document.createElement('label');
      et.textContent = nombres[campo];
      const valor = document.createElement('span');
      valor.className = 'valor';
      valor.textContent = _resolverEnlace(p[campo]) || '—';
      const bElegir = document.createElement('button');
      bElegir.type = 'button';
      bElegir.textContent = 'Elegir';
      bElegir.disabled = !activo;
      bElegir.addEventListener('click', () => {
        if (!activo) return;
        eleccion = { campo: campo, origen: g };
        _refrescarInfo();
        baseDirector.avisar('Pulsa en el mapa el segmento «' + nombres[campo] +
          '» de ' + _segId(g) + '.');
      });
      fila.appendChild(et);
      fila.appendChild(valor);
      fila.appendChild(bElegir);
      if (activo && p[campo] !== null) {
        const bQuitar = document.createElement('button');
        bQuitar.type = 'button';
        bQuitar.textContent = 'Quitar';
        bQuitar.addEventListener('click', () => {
          const viejo = p[campo];
          p[campo] = null;
          // INVERSA AUTOMÁTICA (duodécima iteración): quitar una
          // dirección retira también el inverso del DESTINO si
          // apuntaba de vuelta — misma acción atómica.
          const entradasQ = [{
            segmento: g.raiz, [campo]: null,
            antes: { [campo]: viejo }
          }];
          if (ENLACES_JUGADOR.indexOf(campo) >= 0) {
            const dest = _grupoDeComp(viejo);
            if (dest) {
              const inv = INVERSO[campo];
              const pd = _propsDe(dest.raiz);
              if (pd[inv] === g.raiz) {
                entradasQ.push({
                  segmento: dest.raiz, [inv]: null,
                  antes: { [inv]: g.raiz }
                });
                pd[inv] = null;
              }
            }
          }
          // ACOMPAÑANTES (13.ª iteración): quitar el «mostrar junto
          // a» retira también el «mostrado junto a» del secundario
          // si apuntaba de vuelta — misma acción atómica.
          if (campo === 'mostrarJunto') {
            const dest = _grupoDeComp(viejo);
            if (dest && _propsDe(dest.raiz).mostradoJunto === g.raiz) {
              entradasQ.push({
                segmento: dest.raiz, mostradoJunto: null,
                antes: { mostradoJunto: g.raiz }
              });
              _propsDe(dest.raiz).mostradoJunto = null;
            }
          }
          _registrarCambios(entradasQ);
          // Igual que al crear el enlace: reconstruir para que g.prop
          // (lo que lee la vista) refleje el borrado YA.
          _reconstruir();
          seleccion = _grupoDeComp(g.raiz) || null;
          _refrescar();
          _mostrarPanel();
        });
        fila.appendChild(bQuitar);
      }
      panel.appendChild(fila);
    }

    // Secundario (13.ª iteración): «Mostrado junto a» — SOLO
    // lectura: lo escribe automáticamente el editor al marcar el
    // «Mostrar junto a» de su principal (como el inverso de una
    // dirección, nunca se elige a mano). El secundario se enciende
    // y se apaga SIEMPRE con su principal; y puede además salir
    // SOLO en una animación (la Secuencia del cartucho).
    if (p.mostradoJunto !== null) {
      const filaJunto = document.createElement('div');
      filaJunto.className = 'filaProp';
      const etJunto = document.createElement('label');
      etJunto.textContent = 'Mostrado junto a';
      etJunto.title = 'Se enciende y se apaga siempre con su principal ' +
        '(lo escribe el editor, como los inversos).';
      const vJunto = document.createElement('span');
      vJunto.className = 'valor';
      vJunto.textContent = _resolverEnlace(p.mostradoJunto) || '—';
      filaJunto.appendChild(etJunto);
      filaJunto.appendChild(vJunto);
      panel.appendChild(filaJunto);
    }

    // Colisiones (F3-I7). En un JUGADOR: solo lectura del inverso
    // (quién choca contra él; lo calcula la verificación). En juego /
    // inicio: declarar la colisión (elegir jugador en el mapa) y los
    // indicadores de contador por desenlace, activos SOLO si existe su
    // desenlace (indicar un contador para una muerte sin declarar no
    // tiene sentido). En vida/muerte no hay nada: no son puntos de
    // colisión.
    if (p.tipo === 'jugador') {
      const filaChoca = document.createElement('div');
      filaChoca.className = 'filaProp';
      const etChoca = document.createElement('label');
      etChoca.textContent = 'Le choca';
      etChoca.title = 'Segmento que declara su colisión contra este jugador ' +
        '(inverso calculado al verificar).';
      const vChoca = document.createElement('span');
      vChoca.className = 'valor';
      // Valor EN VIVO: quién apunta a este jugador por colisión en
      // este momento (no espera a la verificación, que es la que
      // fija colisionDe en el GWI).
      const chocaVivo = grupos.find(x =>
        x !== g && x.prop.colision !== null &&
        _grupoDeComp(x.prop.colision) === g);
      vChoca.textContent =
        (chocaVivo ? _segId(chocaVivo) : null) ||
        _resolverEnlace(p.colisionDe) || '—';
      filaChoca.appendChild(etChoca);
      filaChoca.appendChild(vChoca);
      panel.appendChild(filaChoca);
    } else if (TIPOS_COLISION.indexOf(p.tipo) >= 0) {
      const subCol = document.createElement('div');
      subCol.className = 'subPanel';
      subCol.textContent = 'Colisiones (positiva: jugador visible → salvado · ' +
        'negativa: sin jugador → muerte)';
      panel.appendChild(subCol);
      const nombreCol = 'Colisión con jugador';
      {
        const activo = true;
        const fila = document.createElement('div');
        fila.className = 'filaProp' + (activo ? '' : ' inactivo');
        const et = document.createElement('label');
        et.textContent = nombreCol;
        const valor = document.createElement('span');
        valor.className = 'valor';
        valor.textContent = _resolverEnlace(p.colision) || '—';
        const bElegir = document.createElement('button');
        bElegir.type = 'button';
        bElegir.textContent = 'Elegir';
        bElegir.disabled = !activo;
        bElegir.addEventListener('click', () => {
          if (!activo) return;
          eleccion = { campo: 'colision', origen: g };
          _refrescarInfo();
          baseDirector.avisar('Pulsa en el mapa el segmento «' + nombreCol +
            '» de ' + _segId(g) + '.');
        });
        fila.appendChild(et);
        fila.appendChild(valor);
        fila.appendChild(bElegir);
        if (activo && p.colision !== null) {
          const bQuitar = document.createElement('button');
          bQuitar.type = 'button';
          bQuitar.textContent = 'Quitar';
          bQuitar.addEventListener('click', () => {
            const viejo = p.colision;
            p.colision = null;
            _registrarCambio(g.raiz, { colision: null }, { colision: viejo });
            _reconstruir();
            seleccion = _grupoDeComp(g.raiz) || null;
            _refrescar();
            _mostrarPanel();
          });
          fila.appendChild(bQuitar);
        }
        panel.appendChild(fila);
      }
      // Cadenas de los desenlaces (F3-I7): colisión positiva
      // (salvado) y negativa (muerte), UBICADAS tras «Colisión con
      // jugador» y activas SOLO si la colisión está informada — sin
      // colisión declarada no hay decisión y los desenlaces no
      // existen todavía.
      const nombresDes = {
        salvado: 'Colisión positiva (va a)',
        muerte: 'Colisión negativa (va a)'
      };
      for (const campo of ['salvado', 'muerte']) {
        const activo = p.colision !== null;
        const fila = document.createElement('div');
        fila.className = 'filaProp' + (activo ? '' : ' inactivo');
        const et = document.createElement('label');
        et.textContent = nombresDes[campo];
        const valor = document.createElement('span');
        valor.className = 'valor';
        valor.textContent = _resolverEnlace(p[campo]) || '—';
        const bElegir = document.createElement('button');
        bElegir.type = 'button';
        bElegir.textContent = 'Elegir';
        bElegir.disabled = !activo;
        bElegir.addEventListener('click', () => {
          if (!activo) return;
          eleccion = { campo: campo, origen: g };
          _refrescarInfo();
          baseDirector.avisar('Pulsa en el mapa el segmento «' + nombresDes[campo] +
            '» de ' + _segId(g) + '.');
        });
        fila.appendChild(et);
        fila.appendChild(valor);
        fila.appendChild(bElegir);
        if (activo && p[campo] !== null) {
          const bQuitar = document.createElement('button');
          bQuitar.type = 'button';
          bQuitar.textContent = 'Quitar';
          bQuitar.addEventListener('click', () => {
            const viejo = p[campo];
            p[campo] = null;
            _registrarCambio(g.raiz, { [campo]: null }, { [campo]: viejo });
            _reconstruir();
            seleccion = _grupoDeComp(g.raiz) || null;
            _refrescar();
            _mostrarPanel();
          });
          fila.appendChild(bQuitar);
        }
        panel.appendChild(fila);
      }
      // Contadores de los desenlaces (F3-I7/F4-I9): QUÉ CONTADOR
      // INTERNO aumenta con la colisión positiva/negativa — cinco
      // valores: ninguno (null) o uno de los CUATRO contadores
      // internos genéricos (1-4; los tipos vida/muerte son la
      // presentación por iconos, sistema independiente del contador
      // numérico). El contador sube o baja según la dirección que su
      // segmento de contador declare. Activos SOLO con la colisión
      // declarada: hasta entonces no hay decisión que contar.
      const nombresCont = {
        salvadoContador: 'Contador si positiva',
        muerteContador: 'Contador si negativa'
      };
      const OPCIONES_CONTADOR = [
        { v: null, t: 'Ninguno' },
        { v: '1', t: 'Contador 1' },
        { v: '2', t: 'Contador 2' },
        { v: '3', t: 'Contador 3' },
        { v: '4', t: 'Contador 4' }
      ];
      for (const campo of CONTADORES_COLISION) {
        const activo = p.colision !== null;
        const fila = document.createElement('div');
        fila.className = 'filaProp' + (activo ? '' : ' inactivo');
        const et = document.createElement('label');
        et.textContent = nombresCont[campo];
        et.title = 'Contador interno que aumenta con este desenlace. Los ' +
          'segmentos vida/muerte son la presentación del contador; ' +
          'la animación (p. ej. las aletas) se enlaza con la cadena ' +
          'del desenlace.';
        const sel = document.createElement('select');
        sel.disabled = !activo;
        for (const op of OPCIONES_CONTADOR) {
          const o = document.createElement('option');
          o.value = op.v === null ? '' : op.v;
          o.textContent = op.t;
          sel.appendChild(o);
        }
        sel.value = p[campo] === null ? '' : p[campo];
        sel.addEventListener('change', () => {
          const nuevo = sel.value === '' ? null : sel.value;
          if (nuevo === p[campo]) return;
          const viejo = p[campo];
          p[campo] = nuevo;
          _registrarCambio(g.raiz, { [campo]: nuevo }, { [campo]: viejo });
          _reconstruir();
          seleccion = _grupoDeComp(g.raiz) || null;
          _refrescar();
          _mostrarPanel();
          baseDirector.avisar(_segId(g) + '.' + campo + ' = ' +
            (nuevo === null ? 'ninguno' : nuevo) + '.');
        });
        fila.appendChild(et);
        fila.appendChild(sel);
        panel.appendChild(fila);
      }
    }

    // Dígito (F4-I9 v3): sus siete barras a–g se eligen en el mapa
    // (normalmente las pone «Hacer dígito» de la selección múltiple;
    // aquí se pueden corregir a mano). Las barras son segmentos de
    // tipo juego: solo aportan su gráfico.
    if (p.tipo === 'dígito') {
      const subDig = document.createElement('div');
      subDig.className = 'subPanel';
      subDig.textContent = 'Barras del «8» (a–g, clasificadas por geometría)';
      panel.appendChild(subDig);
      for (const letra of LETRAS_BARRAS) {
        const campo = 'barra_' + letra;
        const fila = document.createElement('div');
        fila.className = 'filaProp';
        const et = document.createElement('label');
        et.textContent = 'Barra ' + letra;
        const valor = document.createElement('span');
        valor.className = 'valor';
        valor.textContent = _resolverEnlace(p[campo]) || '—';
        const bElegir = document.createElement('button');
        bElegir.type = 'button';
        bElegir.textContent = 'Elegir';
        bElegir.addEventListener('click', () => {
          eleccion = { campo: campo, origen: g };
          _refrescarInfo();
          baseDirector.avisar('Pulsa en el mapa la barra ' + letra +
            ' de ' + _segId(g) + '.');
        });
        fila.appendChild(et);
        fila.appendChild(valor);
        fila.appendChild(bElegir);
        if (p[campo] !== null) {
          const bQuitar = document.createElement('button');
          bQuitar.type = 'button';
          bQuitar.textContent = 'Quitar';
          bQuitar.addEventListener('click', () => {
            const viejo = p[campo];
            p[campo] = null;
            _registrarCambio(g.raiz, { [campo]: null }, { [campo]: viejo });
            _reconstruir();
            seleccion = _grupoDeComp(g.raiz) || null;
            _refrescar();
            _mostrarPanel();
          });
          fila.appendChild(bQuitar);
        }
        panel.appendChild(fila);
      }
      // Contador de UN dígito (F4-I9 v4.3): un dígito seleccionado
      // puede convertirse en contador sin marcar nada más — un
      // número de una sola posición es un contador legítimo (su
      // digito_1). Marca el propio dígito y delega en hacerContador.
      const filaHC = document.createElement('div');
      filaHC.className = 'filaProp';
      const etHC = document.createElement('label');
      etHC.textContent = 'Contador';
      const bHC = document.createElement('button');
      bHC.type = 'button';
      bHC.textContent = 'Hacer contador (solo este dígito)';
      bHC.title = 'Convierte este dígito en un contador de una sola ' +
        'posición (digito_1 = unidades).';
      bHC.addEventListener('click', () => {
        marcados = new Set([g]);
        _hacerContador();
      });
      filaHC.appendChild(etHC);
      filaHC.appendChild(bHC);
      panel.appendChild(filaHC);
      // Separar (F4-I9): disuelve el dígito, sus barras vuelven al
      // mapa como segmentos manejables (acción atómica deshacible).
      const filaSepD = document.createElement('div');
      filaSepD.className = 'filaProp';
      const etSepD = document.createElement('label');
      etSepD.textContent = 'Agrupación';
      const bSepD = document.createElement('button');
      bSepD.type = 'button';
      bSepD.textContent = 'Separar dígito';
      bSepD.title = 'Devuelve las siete barras al editor como segmentos ' +
        'manejables.';
      bSepD.addEventListener('click', _separarAgrupado);
      filaSepD.appendChild(etSepD);
      filaSepD.appendChild(bSepD);
      panel.appendChild(filaSepD);
    }
    // Contador (F4-I9 v3): un FICTICIO que agrupa los DÍGITOS de un
    // número (digito_1 = unidades, digito_2..4 hacia la izquierda)
    // y declara sus propiedades. Los dígitos dejan de ser visibles:
    // el número entero es esta pieza.
    if (p.tipo === 'contador') {
      const subCont = document.createElement('div');
      subCont.className = 'subPanel';
      subCont.textContent = 'Contador en pantalla (agrupa sus dígitos; ' +
        'digito_1 es el de las unidades)';
      panel.appendChild(subCont);
      // Los DÍGITOS del número (el 1 es el de las unidades).
      const subDigs = document.createElement('div');
      subDigs.className = 'subPanel';
      subDigs.textContent = 'Dígitos del número (1 = unidades)';
      panel.appendChild(subDigs);
      for (const campo of ENLACES_CONTADOR) {
        const fila = document.createElement('div');
        fila.className = 'filaProp';
        const et = document.createElement('label');
        const nDig = Number(campo.replace('digito_', ''));
        et.textContent = 'Dígito ' + nDig +
          (nDig === 1 ? ' (unidades)' :
            nDig === 2 ? ' (decenas)' :
              nDig === 3 ? ' (centenas)' : ' (millares)');
        const valor = document.createElement('span');
        valor.className = 'valor';
        valor.textContent = _resolverEnlace(p[campo]) || '—';
        const bElegir = document.createElement('button');
        bElegir.type = 'button';
        bElegir.textContent = 'Elegir';
        bElegir.addEventListener('click', () => {
          eleccion = { campo: campo, origen: g };
          _refrescarInfo();
          baseDirector.avisar('Pulsa en el mapa el DÍGITO de ' + _segId(g) + '.');
        });
        fila.appendChild(et);
        fila.appendChild(valor);
        fila.appendChild(bElegir);
        if (p[campo] !== null) {
          const bQuitar = document.createElement('button');
          bQuitar.type = 'button';
          bQuitar.textContent = 'Quitar';
          bQuitar.addEventListener('click', () => {
            const viejo = p[campo];
            p[campo] = null;
            _registrarCambio(g.raiz, { [campo]: null }, { [campo]: viejo });
            _reconstruir();
            seleccion = _grupoDeComp(g.raiz) || null;
            _refrescar();
            _mostrarPanel();
          });
          fila.appendChild(bQuitar);
        }
        panel.appendChild(fila);
      }
      { // Contador interno 1..4
        const fila = document.createElement('div');
        fila.className = 'filaProp';
        const et = document.createElement('label');
        et.textContent = 'Contador interno';
        const sel = document.createElement('select');
        for (let i = 1; i <= 4; i++) {
          const o = document.createElement('option');
          o.value = String(i);
          o.textContent = 'Contador ' + i;
          sel.appendChild(o);
        }
        sel.value = p.contadorInterno === null ? '1' : String(p.contadorInterno);
        sel.addEventListener('change', () => {
          const nuevo = Number(sel.value);
          if (nuevo === p.contadorInterno) return;
          const viejo = p.contadorInterno;
          p.contadorInterno = nuevo;
          _registrarCambio(g.raiz, { contadorInterno: nuevo },
            { contadorInterno: viejo });
          _reconstruir();
          seleccion = _grupoDeComp(g.raiz) || null;
          _refrescar();
          _mostrarPanel();
        });
        fila.appendChild(et);
        fila.appendChild(sel);
        panel.appendChild(fila);
      }
      { // Valor inicial
        const fila = document.createElement('div');
        fila.className = 'filaProp';
        const et = document.createElement('label');
        et.textContent = 'Valor inicial';
        et.title = 'Por defecto 0; en contadores de vidas, el adecuado.';
        const inp = document.createElement('input');
        inp.type = 'number';
        inp.min = '0';
        inp.max = '255';
        inp.value = String(p.valorInicial || 0);
        inp.addEventListener('change', () => {
          let nuevo = Math.max(0, Math.floor(Number(inp.value) || 0));
          if (nuevo > 255) {            // F5-I16 (R1): recorte por arriba, con aviso
            nuevo = 255;
            inp.value = String(nuevo);
            baseDirector.avisar('Valor inicial limitado a 255.');
          }
          if (nuevo === p.valorInicial) return;
          const viejo = p.valorInicial;
          p.valorInicial = nuevo;
          _registrarCambio(g.raiz, { valorInicial: nuevo },
            { valorInicial: viejo });
          _reconstruir();
          seleccion = _grupoDeComp(g.raiz) || null;
          _refrescar();
          _mostrarPanel();
        });
        fila.appendChild(et);
        fila.appendChild(inp);
        panel.appendChild(fila);
      }
      { // Tipo de cuenta
        const fila = document.createElement('div');
        fila.className = 'filaProp';
        const et = document.createElement('label');
        et.textContent = 'Tipo de cuenta';
        et.title = 'Ascendente indefinida; descendente hasta cero.';
        const sel = document.createElement('select');
        for (const d of ['ascendente', 'descendente']) {
          const o = document.createElement('option');
          o.value = d;
          o.textContent = d;
          sel.appendChild(o);
        }
        sel.value = p.direccion || 'ascendente';
        sel.addEventListener('change', () => {
          if (sel.value === p.direccion) return;
          const viejo = p.direccion;
          p.direccion = sel.value;
          _registrarCambio(g.raiz, { direccion: sel.value },
            { direccion: viejo });
          _reconstruir();
          seleccion = _grupoDeComp(g.raiz) || null;
          _refrescar();
          _mostrarPanel();
        });
        fila.appendChild(et);
        fila.appendChild(sel);
        panel.appendChild(fila);
      }
      { // Presentar el cero
        const fila = document.createElement('div');
        fila.className = 'filaProp';
        const et = document.createElement('label');
        et.textContent = 'Presentar el cero';
        et.title = 'Si el valor cero se presenta o la zona queda en blanco.';
        const chk = document.createElement('input');
        chk.type = 'checkbox';
        chk.checked = p.presentarCero !== false;
        chk.addEventListener('change', () => {
          const nuevo = !!chk.checked;
          if (nuevo === (p.presentarCero !== false)) return;
          const viejo = p.presentarCero;
          p.presentarCero = nuevo;
          _registrarCambio(g.raiz, { presentarCero: nuevo },
            { presentarCero: viejo });
          _reconstruir();
          seleccion = _grupoDeComp(g.raiz) || null;
          _refrescar();
          _mostrarPanel();
        });
        fila.appendChild(et);
        fila.appendChild(chk);
        panel.appendChild(fila);
      }
      { // Nº de dígitos: CUENTA automática, solo lectura (verificación)
        const fila = document.createElement('div');
        fila.className = 'filaProp';
        const et = document.createElement('label');
        et.textContent = 'Dígitos presenta';
        et.title = 'Cuenta automática de los dígitos agrupados; solo ' +
          'lectura (verificación de que se agrupó lo que se quería).';
        const valor = document.createElement('span');
        valor.className = 'valor';
        const nDigs = ENLACES_CONTADOR.filter(c => p[c] !== null).length;
        valor.textContent = String(nDigs);
        fila.appendChild(et);
        fila.appendChild(valor);
        panel.appendChild(fila);
      }
      // Separar (F4-I9 v3): disuelve el ficticio, sus dígitos vuelven.
      const filaSepC = document.createElement('div');
      filaSepC.className = 'filaProp';
      const etSepC = document.createElement('label');
      etSepC.textContent = 'Agrupación';
      const bSepC = document.createElement('button');
      bSepC.type = 'button';
      bSepC.textContent = 'Separar contador';
      bSepC.title = 'El contador desaparece: sus dígitos vuelven al ' +
        'mapa como segmentos manejables.';
      bSepC.addEventListener('click', _separarAgrupado);
      filaSepC.appendChild(etSepC);
      filaSepC.appendChild(bSepC);
      panel.appendChild(filaSepC);
    }

    // Unión con otro segmento (fusiona en una sola imagen). Un
    // DÍGITO o CONTADOR no se une con nada (v4.4): la pieza del «8»
    // o del número es indivisible — el botón ni se ofrece.
    if (p.tipo !== 'dígito' && p.tipo !== 'contador') {
      const filaUnir = document.createElement('div');
      filaUnir.className = 'filaProp';
      const etUnir = document.createElement('label');
      etUnir.textContent = 'Unión';
      const bUnir = document.createElement('button');
      bUnir.type = 'button';
      bUnir.textContent = 'Unir con… (elegir en el mapa)';
      bUnir.addEventListener('click', () => {
        eleccion = { campo: 'unir', origen: g };
        _refrescarInfo();
        baseDirector.avisar('Pulsa en el mapa el segmento a unir con ' + _segId(g) + '.');
      });
      filaUnir.appendChild(etUnir);
      filaUnir.appendChild(bUnir);
      panel.appendChild(filaUnir);
    }

    // Deshacer unión: si este grupo absorbió otras componentes, se
    // ofrece separarlas (quitar el par de uniones y reconstruir).
    if (g.miembros.length > 1) {
      const filaDes = document.createElement('div');
      filaDes.className = 'filaProp';
      const etDes = document.createElement('label');
      etDes.textContent = 'Unido';
      const bDes = document.createElement('button');
      bDes.type = 'button';
      bDes.textContent = 'Deshacer unión';
      bDes.addEventListener('click', () => {
        // Quita los pares que afectan a este grupo y reconstruye.
        // Cada par eliminado es una entrada "separar" de la MISMA
        // acción atómica (mismo nº, relacionados).
        const antes = uniones.map(par => par);
        uniones = uniones.filter(([a, b]) =>
          !(g.miembros.includes(a) || g.miembros.includes(b)));
        const eliminados = antes.filter(par => uniones.indexOf(par) < 0);
        console.info('[autoría] unión deshecha: ' + eliminados.length +
          ' par(es) eliminado(s).');
        _registrarCambios(eliminados.map(par => ({ separar: par })));
        _reconstruir();
        seleccion = null;
        _refrescar();
        _$('panelSegmento').classList.add('oculto');
        _$('panelSegmento').replaceChildren();
      });
      filaDes.appendChild(etDes);
      filaDes.appendChild(bDes);
      panel.appendChild(filaDes);
    }
  }

  // ---- Verificación y guardado ----

  /**
   * Llama a la verificación del diseñador (en baseCartucho desde
   * F5-I5: es el contrato de los formatos, no lógica del editor),
   * presenta sus hallazgos y, si todo lo bloqueante pasa, guarda el
   * GWI.
   * @returns {void}
   */
  function verificarYGuardar() {
    if (!base || grupos.length === 0) {
      baseDirector.avisarError('No hay nada que verificar: descompón la imagen primero.');
      return;
    }
    if (_cambiosSinAplicar()) return;        // F5-I17 (M12)
    // Por parámetro va lo que la verificación leía antes por
    // clausura: los grupos del editor, sus helpers y las constantes
    // de los enlaces. Los inversos que calcula se registran en el
    // historial del editor, como siempre.
    const hallazgos = baseCartucho.verificarCartucho(_ctxVerificacion());
    const errores = hallazgos.errores;
    const avisos = hallazgos.avisos;
    if (errores.length > 0) {
      for (const e of errores) console.error('[verificar] ' + e);
      baseDirector.avisarError('Definición incompleta: ' + errores.length +
        ' error(es) — mira la consola (F12). Primero: ' + errores[0]);
      return;
    }
    for (const a of avisos) console.warn('[verificar] ' + a);
    _guardarGWI(avisos.length);
  }

  /**
   * El contrato de la verificación del diseñador (F5-I5): los grupos
   * del editor, sus helpers y las constantes de los enlaces. Lo
   * usan LOS DOS botones de guardar («Verificar y Guardar» y
   * «Generar GWI+GWC», F5-I6): el par GWI+GWC sale siempre de la
   * MISMA verificación.
   * @returns {Object} El contexto que espera verificarCartucho.
   */
  function _ctxVerificacion() {
    return {
      grupos: grupos,
      propsDe: _propsDe, grupoDeComp: _grupoDeComp, segId: _segId,
      numRuta: _numRuta, resolverEnlace: _resolverEnlace,
      camposDe: _camposDe, reconstruir: _reconstruir,
      registrarCambio: _registrarCambio,
      registrarCambioDerivado: _registrarCambioDerivado,
      ENLACES_JUGADOR: ENLACES_JUGADOR, ENLACES_JUEGO: ENLACES_JUEGO,
      ENLACES_COLISION: ENLACES_COLISION, ENLACES_DIGITO: ENLACES_DIGITO,
      ENLACES_CONTADOR: ENLACES_CONTADOR,
      CONTADORES_COLISION: CONTADORES_COLISION,
      CAMPOS_SECUENCIA: CAMPOS_SECUENCIA, INVERSO: INVERSO
    };
  }

  /**
   * Aviso NO bloqueante de topes del GWC (F5-I6): se lanza al
   * descomponer la imagen y al guardar el GWI — el diseñador decide
   * si seguir; solo «Generar GWI+GWC» bloquea. Cuenta lo que VIAJA
   * (la misma cuenta del generador: sin fantasmas 99 ni absorbidos
   * por una unión).
   * @returns {void}
   */
  function _avisoTopes() {
    const json = {
      sprites: sprites.map(s => ({ id: s.id })),
      segmentos: segmentos(),
      secuencia: _secuenciaDelCartucho() || undefined
    };
    if (!baseCartucho.validarTopes(json)) {
      console.warn('[gwc] el cartucho supera el tope de 255 ' +
        'sprites/segmentos/secuencias del GWC.');
      baseDirector.avisar('Aviso: el cartucho supera el tope de 255 ' +
        'sprites/segmentos/secuencias del GWC: no se podrá generar ' +
        '(el botón «Generar GWI+GWC» lo bloqueará).');
    }
  }

  /**
   * Descarga el cartucho de ejecución GWC (F5-I6): <a> efímero con
   * object URL, como el ZIP del GWI (se revoca al terminar; el
   * navegador ya habrá iniciado la descarga).
   * @param {Uint8Array} bytes - El fichero GWC completo.
   * @returns {void}
   */
  /**
   * Nombre de fichero a partir del nombre del cartucho (F5-I17, M10):
   * saneado para el disco (inválidos de Windows a "_"), con el genérico
   * "cartucho" de salvavidas.
   * @param {string} nombre - El nombre del cartucho.
   * @param {string} extension - Con punto (p. ej. ".GWC").
   * @returns {string} Nombre de fichero completo.
   */
  function _nombreFichero(nombre, extension) {
    const limpio = String(nombre || '').replace(/[\\/:*?"<>|]/g, '_').trim() || 'cartucho';
    return limpio + extension;
  }

  /**
   * Descarga el fichero .gwc generado (F5-I17 M10: con el nombre del
   * cartucho, no el genérico).
   * @param {Uint8Array} bytes - El GWC ya montado.
   * @param {string} nombre - El nombre del cartucho.
   * @returns {void}
   */
  function _descargarGWC(bytes, nombre) {
    const blob = new Blob([bytes], { type: 'application/octet-stream' });
    const a = document.createElement('a');
    const url = URL.createObjectURL(blob);
    a.href = url;
    a.download = _nombreFichero(nombre, '.GWC');
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 5000);
  }

  /**
   * Descarga el GWS del setup vigente (F5-I17, M9/M11): con el GWC
   * sale también su setup (real o derivado del cartucho), para que la
   * carpeta de destino tenga todo lo necesario, con SU extensión
   * .GWS (los cartuchos la llevan en mayúsculas; la carga la acepta:
   * F5-I17 M11, por contenido da igual).
   * @param {Object} setup - El setupGWS en memoria.
   * @returns {void}
   */
  function _descargarGWS(setup) {
    if (!setup) return;
    const blob = new Blob([JSON.stringify(setup, null, 2)], { type: 'application/json' });
    basePack.descargarBlob(blob, _nombreFichero(setup.nombre, '.GWS'));
  }

  /**
   * El botón «Generar GWS+GWB+GWI+GWC» (F5-I6; F5-I17 M9 le añade el
   * GWS y el nombre): verifica el cartucho con la
   * MISMA función independiente que «Verificar y Guardar»
   * (bloqueante), comprueba los topes del GWC (bloqueantes aquí:
   * no se genera NINGUNO de los dos ficheros), genera el GWC
   * primero — baseCartucho.generarGWC sobre las mismas listas, con
   * la pantalla declarada del setup como destino y la geometría
   * extraída (img_s) como fuente, escalado vecino más cercano — y
   * guarda el GWI después con el CODIGO DEL PAR: la suma de
   * verificación del GWC recién generado (mismas listas = mismo
   * checksum: el par siempre cuadra y la ida y vuelta es byte a
   * byte). El par sale de una sola foto de memoria: siempre copia
   * uno del otro.
   * @returns {Promise<void>}
   */
  async function generarGWIyGWC() {
    try {
      await _generarPar();
    } catch (e) {
      console.error(e);
      baseDirector.avisarError('No se generó el par GWI+GWC: ' + e.message);
    }
  }

  /** El cuerpo de «Generar»: se monta todo en memoria y los ficheros se descargan al final (atomicidad del par). */
  async function _generarPar() {
    if (!base || grupos.length === 0) {
      baseDirector.avisarError('No hay nada que generar: descompón la imagen primero.');
      return;
    }
    if (_cambiosSinAplicar()) return;        // F5-I17 (M12)
    // F5-I10: los datos propios del cartucho (nombre, estilo,
    // resolución, imágenes y botones) salen de la FICHA de la pestaña
    // Cartucho: se verifican antes de generar NADA (los tres ficheros
    // salen de la misma foto de memoria).
    const ficha = baseFicha.verificar({ generar: true, mostrar: true });
    for (const a of ficha.avisos) console.warn('[ficha] ' + a);
    if (ficha.errores.length > 0) {
      for (const e of ficha.errores) console.error('[ficha] ' + e);
      baseDirector.avisarError('La ficha del cartucho tiene ' + ficha.errores.length +
        ' error(es): ' + ficha.errores[0] + ' (pestaña Cartucho).');
      return;
    }
    const imagenesFicha = baseFicha.imagenesEnMemoria();
    // 1. La verificación del diseñador, BLOQUEANTE (misma llamada y
    // misma presentación que «Verificar y Guardar»).
    const hallazgos = baseCartucho.verificarCartucho(_ctxVerificacion());
    if (hallazgos.errores.length > 0) {
      for (const e of hallazgos.errores) console.error('[verificar] ' + e);
      baseDirector.avisarError('Definición incompleta: ' + hallazgos.errores.length +
        ' error(es) — mira la consola (F12). Primero: ' + hallazgos.errores[0]);
      return;
    }
    for (const a of hallazgos.avisos) console.warn('[verificar] ' + a);
    // 2. Topes del GWC, BLOQUEANTES aquí (en descomponer y al
    // guardar el GWI son un aviso): no se genera NINGÚN fichero.
    const json = _montarGWI();
    if (!baseCartucho.validarTopes(json)) {
      console.error('[gwc] el cartucho supera el tope de 255 ' +
        'sprites/segmentos/secuencias del GWC: no se genera nada.');
      baseDirector.avisarError('El cartucho supera el tope de 255 ' +
        'sprites/segmentos/secuencias del GWC: no se genera nada. ' +
        'Reduce el cartucho y vuelve a generar.');
      return;
    }
    // 3. El GWC primero. La pantalla DECLARADA es la del setup (la
    // del hardware: el GWC es un build para un objetivo) y la fuente
    // es la geometría extraída de img_s (base): las máscaras y las
    // posiciones viajan escaladas a esa pantalla, lo que el
    // simulador pinta al vuelo.
    const pantallaSetup = baseDirector.pantallaDeSetup();
    if (!pantallaSetup) {
      baseDirector.avisarError('Sin setup cargado no hay pantalla declarada: ' +
        'el GWC no sabe a qué resolución escalar. Carga el ' +
        'setup de la máquina primero.');
      return;
    }
    const pantalla = {
      ancho: pantallaSetup.ancho, alto: pantallaSetup.alto,
      fuente: { ancho: base.ancho, alto: base.alto }
    };
    baseDirector.avisar('Generando GWC…');
    // A02: el fondo (img_f) viaja en el Bloque 5 del GWC, YA escalado a la
    // pantalla declarada (el ESP32 no reescala). Sin fondo en memoria, el
    // bloque no existe (como en la v1).
    const gwc = baseCartucho.generarGWC(json, sprites, pantalla, baseDirector.imagenFondo());
    // Espacio ahorrado por la deduplicación de sprites: los segmentos
    // que comparten imagen solo la escriben UNA vez (sin deduplicación,
    // cada segmento llevaría su copia). GWI: bytes del PNG real de cada
    // imagen compartida × sus referencias de más; GWC: bytes de la
    // máscara escalada, que los informa el propio generador. El
    // porcentaje se mide contra el cartucho SIN deduplicar (lo que
    // ocuparía con una copia de la imagen por segmento).
    let nDedup = 0;
    let ahorroGWI = 0;
    for (const sprite of sprites) {
      const usos = _usosDeSprite(sprite);
      if (usos < 2) continue;
      nDedup++;
      let bytes = sprite.ancho * sprite.alto;   // aproximación si no hay toBlob
      if (typeof sprite.imagen.toBlob === 'function') {
        const png = await new Promise(resolver => sprite.imagen.toBlob(resolver, 'image/png'));
        if (png) bytes = png.size;
      }
      ahorroGWI += (usos - 1) * bytes;
    }
    const pctGWI = (tamanoSinDedup) => tamanoSinDedup > 0
      ? Math.round((ahorroGWI / tamanoSinDedup) * 100) : 0;
    const pctGWC = gwc.bytes.length + gwc.ahorroSprites > 0
      ? Math.round((gwc.ahorroSprites / (gwc.bytes.length + gwc.ahorroSprites)) * 100) : 0;
    baseDirector.avisar(baseCartucho.estadistica(gwc));
    // F5-I20 (MA02) y F5-I21: ocupación de la memoria, solo informativa. La
    // memoria es la del Setup (solo se edita allí y es la que lleva el GWI);
    // sin memoria (o a 0) no hay texto. RAM usada = los DATOS del GWC (el
    // total MENOS el bloque del fondo: la imagen no se carga en RAM, irá a
    // FLASH); FLASH usada = el bloque del fondo (A02: la img_f escalada ya
    // viaja en el GWC). Los informativos
    // «Último GWC calculado» y «Último fondo» del Setup salen de aquí mismo.
    const setupMem = baseDirector.datosSetup();
    const memoriaSetup = baseCartucho.memoriaNoCero(setupMem ? setupMem.memoria : null);
    const bytesFondo = gwc.bloques.fondo;
    const bytesRAM = gwc.bytes.length - bytesFondo;
    const textoMemoria = baseCartucho.ocupacionMemoria(memoriaSetup || {}, bytesRAM, bytesFondo);
    baseSetup.informarUltimos({ gwc: bytesRAM, fondo: bytesFondo, memoria: memoriaSetup });
    const avisoMemoria = textoMemoria ? ' ' + textoMemoria : '';
    // 4. El GWI después, con el Código GWC del par: el código del
    // GWC recién generado (TEXTO «#HHHH#», visible igual que en la
    // cabecera del GWC) estampado en el JSON (montarGWI no lo pone:
    // «Verificar y Guardar» guarda sin codigoGWC, el GWI no lleva
    // sobras).
    json.codigoGWC = gwc.codigo;
    baseFicha.actualizarCodigoGWC(gwc.codigo);   // F5-I17 (M1): la ficha enseña el código nuevo
    // F5-I17 (M2): si el GWI cargado traía codigoGWC (#X#) y el código
    // nuevo del par es #Y# distinto, el GWC #X# de la carpeta queda
    // desfasado: aviso explícito con los dos códigos (si el GWI no
    // traía código, no hay nada que desparejar).
    const codigoAnterior = (typeof baseDirector !== 'undefined' && baseDirector.codigoGWCCargado)
      ? baseDirector.codigoGWCCargado() : null;
    const avisoPar = (codigoAnterior && codigoAnterior !== gwc.codigo)
      ? ' Atención: el GWC anterior (' + codigoAnterior + ') de la carpeta queda desfasado: sustitúyelo por el nuevo (' + gwc.codigo + ').'
      : '';
    if (avisoPar) console.warn('[par] ' + avisoPar.trim());
    baseDirector.avisar('Guardando GWI…');
    const tamGWI = await baseCartucho.guardarGWI(json, sprites,
      imagenesFicha.img_f, imagenesFicha.img_s,
      imagenesFicha.img_m, hallazgos.avisos.length);
    // El GWB después (F5-I10): los tres ficheros de la misma ficha, ya
    // verificada arriba, para que vayan de la mano.
    if (tamGWI) {
      _descargarGWC(gwc.bytes, json.nombre);   // el GWC se descarga SOLO cuando el GWI se ha guardado (sin GWC huérfano)
      // F5-I17 (M9): el GWC YA NO SE VA SOLO: con él sale el GWS del
      // setup vigente (real o derivado del cartucho), así la carpeta de
      // destino queda con TODO lo necesario (F5-I19: el GWC binario
      // necesita su setup al lado para poder volver a cargarse).
      const setup = (typeof baseDirector !== 'undefined') ? baseDirector.datosSetup() : null;
      if (setup) _descargarGWS(setup);
      const gwbOk = await baseFicha.guardar();
      if (gwbOk) baseDirector.avisar('Generados GWS, GWB, GWI y GWC (' + json.nombre + ').' + avisoPar + avisoMemoria);
    }
    // F5-I7: los dos tamaños del par, a la vista en el Editor
    // F5-I7+: la línea de deduplicación, DEBAJO de la de tamaños del
    // panel (informarTamanos la reparte; sin deduplicación, la línea
    // se queda vacía y el CSS la oculta).
    baseDirector.informarTamanos({
      gwi: tamGWI || null, gwc: gwc.bytes.length,
      deduplicacion: 'Deduplicadas ' + nDedup + ' imágenes, ahorro GWI ' +
        ahorroGWI + ' bytes (' + pctGWI((tamGWI || 0) + ahorroGWI) + '%), GWC ' +
        gwc.ahorroSprites + ' bytes (' + pctGWC + '%)',
      memoria: textoMemoria        // F5-I20: null = sin línea
    });
    // El canvas del aparato presenta el estado vigente, igual que
    // tras «Verificar y Guardar».
    if (tamGWI) {
      componerPantalla = true;
      pintarPantallaAutoria();
    }
  }

  /**
   * Monta el GWI completo con el estado vigente de la autoría: el
   * JSON del cartucho con sus sprites, segmentos e historial legible
   * (cambios con ids F01/F02… + contador). Desde la F5-I4 el fichero
   * ZIP lo escribe baseCartucho.guardarGWI, que recibe este objeto
   * YA montado junto a las imágenes en memoria: el editor conoce la
   * autoría, el módulo de cartuchos los ficheros. La serialización
   * compacta del JSON (formatearGWI) también vive en baseCartucho.
   * @param {?string} codigo - Código GWC del par (F5-I6): la suma de
   *        verificación del GWC como TEXTO visible «#HHHH#». SOLO lo
   *        estampa «Generar GWI+GWC» (recién calculada); sin él el
   *        GWI viaja SIN codigoGWC.
   * @returns {Object} GWI completo (tal como se guardaría).
   */
  function _montarGWI(codigo) {
    // Autoría persistente: el HISTORIAL CRONOLÓGICO es la única fuente
    // de verdad (sin redundancia): props (cambios de campos), uniones
    // (entradas "unir"/"separar") viajan
    // TODOS en la misma lista, en orden, con nº de acción continuado
    // y "relacionados" para agrupar las acciones atómicas.
    // Ids legibles (v4): los ficticios se guardan como F01, F02... en
    // el segmento, en altaFicticio/bajaFicticio y en los valores de
    // los enlaces que les apuntan (el replay los reconvierte).
    const idF = (v) => (typeof v === 'number' && v < 0)
      ? 'F' + String(-v).padStart(2, '0') : v;
    const cambiosLegibles = cambios.map(c => {
      const o = Object.assign({}, c);
      if (o.segmento !== undefined) o.segmento = idF(o.segmento);
      if (Array.isArray(o.altaFicticio)) {
        o.altaFicticio = o.altaFicticio.slice();
        o.altaFicticio[0] = idF(o.altaFicticio[0]);
      }
      if (Array.isArray(o.bajaFicticio)) {
        o.bajaFicticio = o.bajaFicticio.slice();
        o.bajaFicticio[0] = idF(o.bajaFicticio[0]);
      }
      if (o.antes && typeof o.antes === 'object') {
        o.antes = Object.assign({}, o.antes);
        for (const k of Object.keys(o.antes)) o.antes[k] = idF(o.antes[k]);
      }
      for (const campoE of TODOS_ENLACES) {
        if (o[campoE] !== undefined) o[campoE] = idF(o[campoE]);
      }
      return o;
    });
    const autoria = {
      cambios: cambiosLegibles,
      ultimoOp: ultimoOp
    };

    // F5-I10: nombre, estilo, resolución, imágenes y botones son los de
    // la FICHA de la pestaña Cartucho (completados con el setup).
    const ficha = baseFicha.datosCartucho();
    const segs = segmentos();
    const json = {
      tipo: 'GWI',
      version: 1,
      nombre: ficha.nombre || null,
      // F5-I17 (M13): descripción del cartucho (opcional): la de la
      // ficha; solo viaja si el usuario la escribió.
      ...(ficha.descripcion ? { descripcion: ficha.descripcion } : {}),
      estilo: ficha.estilo || null,
      // Resolución (obligatoria en el GWI, autosuficiente): la de la
      // ficha o, si está vacía, la del GWS en uso.
      resolucion: ficha.resolucion || null,
      // ColorFondo (F5-I14): solo viaja si no es el blanco por defecto.
      ...(ficha.colorFondo ? { ColorFondo: ficha.colorFondo } : {}),
      // Memoria del setup vigente (F5-I21; solo los subcampos ≠ 0): la ficha la trae de allí.
      ...(ficha.memoria ? { memoria: ficha.memoria } : {}),
      // Regla «combinar» (F3-I1): del GWB/GWI cargado (extras de la
      // ficha). El GWI la lleva SIEMPRE que esté activa: el GWC toma
      // su bit de Reglas del Bloque 0 de AQUÍ, no del GWB.
      ...(ficha.extras.combinar ? { combinar: true } : {}),
      // Código GWC del par (F5-I6): el código «#HHHH#» del GWC,
      // AUSENTE cuando no lo hay (el GWI no lleva sobras). Solo lo
      // estampa «Generar GWI+GWC», con el código del GWC recién
      // generado; «Verificar y Guardar» guarda sin codigoGWC.
      ...(codigo !== undefined && codigo !== null ?
        { codigoGWC: codigo } : {}),
      // Copia de imagenes y botones del GWB: el GWI es autónomo,
      // carga sin su GWB. img_s/img_f/img_m se copian TAL CUAL (cierre
      // de la F5-I9: el GWI declara todo lo que declara el GWB) y
      // guardarGWIEnDisco incluye en el ZIP cada una de las declaradas.
      imagenes: ficha.imagenes,
      botones: ficha.botones.length > 0 ? ficha.botones : undefined,
      // Mecanismo de fin de partida (F3-I11, v12.5): PROPIEDAD DEL
      // CARTUCHO, al nivel superior — no un segmento tipo 7.
      fin: _finDelCartucho() || undefined,
      // Secuencia (duodécima iteración): animación periódica del
      // cartucho, al nivel superior como el fin.
      secuencia: _secuenciaDelCartucho() || undefined,
      // F4-I2: los campos del Director al nivel superior, igual
      // que el fin y la Secuencia. Solo si están definidos: un
      // GWI sin ellos se comporta como siempre (500 ms, sin
      // acelerar, una ruta a la vez).
      pausas: _pausasDelCartucho() || undefined,
      aceleracion: _aceleracionDelCartucho() || undefined,
      rutas: _rutasDelCartucho() || undefined,
      sprites: sprites.map(s => ({
        id: s.id, ancho: s.ancho, alto: s.alto,
        fichero: 'segmentos/' + s.id + '.png'
      })),
      segmentos: segs,
      autoria: autoria
    };
    if (!ficha.imagenes.img_s) {
      console.warn('[guardar] la ficha no tiene img_s: ' +
        'el GWI no podrá re-editarse sin esa referencia.');
    }
    return json;
  }

  /**
   * F5-I17 (M12): «Generar pide Aplicar». Las dos fichas (Setup y
   * Cartucho) son BORRADORES hasta Aplicar (F5-I12); los botones del
   * Editor (Verificar y Guardar y Generar) trabajan SIEMPRE con los
   * datos aplicados. La ficha de Cartucho la cubre
   * baseFicha.verificar({generar:true}); aquí se ataja la del setup.
   * @returns {boolean} true si el setup tiene cambios sin aplicar (y el
   *   error ya se ha mostrado): no se genera ni guarda nada.
   */
  function _cambiosSinAplicar() {
    if (typeof baseSetup === 'undefined' || !baseSetup.hayCambios) return false;
    if (!baseSetup.hayCambios()) return false;
    baseDirector.avisarError('El setup tiene cambios sin aplicar: pulsa «Aplicar» (o «Guardar GWS») en la pestaña Setup antes de generar o guardar.');
    return true;
  }

  /**
   * Guarda el GWI en el DIRECTORIO PRINCIPAL del cartucho (el que
   * elige el usuario, donde ya viven img_f, img_s y el GWB): los
   * sprites se escriben junto a las imágenes de base en segmentos/ y
   * cartucho_gwi.json es un cartucho COMPLETO — copia imagenes y
   * botones de la FICHA del cartucho (F5-I10) — por lo que carga
   * de forma autónoma sin depender de su GWB. El fichero ZIP lo
   * escribe baseCartucho.guardarGWI (F5-I4); aquí queda la
   * verificación previa, el montaje del GWI y el repintado del
   * aparato con el estado vigente (fondo + segmentos en negro).
   * @param {number} nAvisos - Avisos de la verificación (informativo).
   * @returns {Promise<void>}
   */
  async function _guardarGWI(nAvisos) {
    // El GWI es un cartucho COMPLETO: copia estilo, pantalla y botones
    // del cartucho en edición (cartuchoActual). Sin ese cartucho en
    // memoria saldría un GWI con estilo null que NO cargaría. Bloqueo
    // explícito (nunca en silencio): recargar el GWB lo repone.
    // F5-I10: esos datos salen de la FICHA de la pestaña Cartucho, que
    // se verifica antes de escribir nada.
    const ficha = baseFicha.verificar({ generar: true, mostrar: true });
    for (const a of ficha.avisos) console.warn('[ficha] ' + a);
    if (ficha.errores.length > 0) {
      for (const e of ficha.errores) console.error('[ficha] ' + e);
      baseDirector.avisarError('La ficha del cartucho tiene ' + ficha.errores.length +
        ' error(es): ' + ficha.errores[0] + ' (pestaña Cartucho).');
      return;
    }
    const imagenesFicha = baseFicha.imagenesEnMemoria();
    // El módulo de cartuchos gestiona JSZip, los avisos de inicio y
    // fin, y el bloqueo del botón mientras el ZIP se escribe.
    const tamGWI = await baseCartucho.guardarGWI(_montarGWI(), sprites,
      imagenesFicha.img_f, imagenesFicha.img_s,
      imagenesFicha.img_m, nAvisos);
    if (tamGWI) {
      // F5-I7: el tamaño del GWI nuevo; el GWC anterior ya no es su
      // pareja, así que su tamaño deja de mostrarse.
      baseDirector.informarTamanos({ gwi: tamGWI, gwc: null, deduplicacion: null, memoria: null });
      // El canvas del aparato presenta el estado vigente tras
      // guardar: fondo + TODOS los segmentos en negro (look LCD).
      componerPantalla = true;
      pintarPantallaAutoria();
      // F5-I17 (M2): el GWI guardado a secas viaja SIN codigoGWC (F5-I6);
      // si el GWI cargado traía uno, el GWC de la carpeta queda
      // desparejado: aviso no bloqueante («Generar GWI+GWC» lo repara).
      const codigoAnterior = (typeof baseDirector !== 'undefined' && baseDirector.codigoGWCCargado)
        ? baseDirector.codigoGWCCargado() : null;
      if (codigoAnterior) {
        console.warn('[gwi] el GWI se guarda sin codigoGWC: el GWC ' + codigoAnterior +
          ' del destino queda desparejado.');
        baseDirector.avisar('GWI guardado SIN codigoGWC: el GWC del destino (' +
          codigoAnterior + ') queda desparejado; usa Generar GWI+GWC para mantener el par.');
        baseFicha.actualizarCodigoGWC(null);   // el guardado suelta el código: la ficha lo refleja
      }
      // Aviso de topes (F5-I6): al guardar el GWI es NO bloqueante
      // — el diseñador decide si seguir; «Generar GWI+GWC» bloquea.
      _avisoTopes();
    }
  }

  /**
   * Precarga la sección autoria de un GWI REPRODUCIENDO el historial
   * cronológico sobre el estado de nacimiento: props por componente,
   * uniones (entradas "unir" añaden el par, "separar" lo quita) y
   * uniones ("unir" añade el par, "separar" lo quita). Se llama
   * tras extraer la geometría y ANTES de reconstruir.
   * Compatibilidad: un GWI antiguo (sin "cambios") trae el estado
   * final en "props"/"uniones" y se carga como siempre.
   * @param {Object} aut - Sección autoria del GWI.
   * @returns {boolean} true si se cargó algo.
   */
  function cargarAutoria(aut) {
    if (!aut) return false;
    props = new Map();
    cambios = [];
    rehacibles = [];
    if (Array.isArray(aut.cambios)) {
      // Replay del historial: la MISMA lista que se guarda, aplicada
      // en orden sobre el estado de nacimiento (el contador viaja
      // en el GWI para que la numeración continúe entre guardados).
      _reproducirCambios(aut.cambios);
      if (typeof aut.ultimoOp === 'number') ultimoOp = aut.ultimoOp;
    } else {
      // Formato antiguo (estado final en dicts): compatibilidad con
      // GWI previos al historial. Sin ficticios (no existían).
      uniones = (aut.uniones || []).map(([a, b]) => [a, b]);
      ficticios = [];
      ficticioSeq = 0;
      for (const comp of Object.keys(aut.props || {})) {
        const p = _propPorDefecto();
        Object.assign(p, aut.props[comp]);
        props.set(Number(comp), p);
      }
      ultimoOp = 0;
    }
    return true;
  }

  /**
   * Verifica referencias colgantes en la autoría recién cargada:
   * tras reconstruir con la autoría del GWI, un enlace que no
   * resuelva a ningún grupo existente es un error del JSON — error
   * en consola y en la barra, nunca en silencio. Se llama tras la
   * reconstrucción inicial, no en cada refrescar.
   * @returns {number} Cantidad de referencias colgantes.
   */
  function _verificarReferencias() {
    let colgantes = 0;
    for (const g of grupos) {
      const p = _propsDe(g.raiz);
      for (const campo of [...TODOS_ENLACES, 'colisionDe']) {
        if (p[campo] !== null && !_grupoDeComp(p[campo])) {
          console.error('[autoría] ' + _segId(g) + '.' + campo +
            ' apunta a un segmento que no existe (referencia ' +
            'colgante del GWI).');
          colgantes++;
        }
      }
    }
    if (colgantes > 0) {
      baseDirector.avisarError(colgantes + ' referencia(s) colgante(s) en la autoría ' +
        'cargada — mira la consola (F12).');
    }
    return colgantes;
  }

  // ---- Arranque ----

  /**
   * Arranca la autoría: verifica B/N, extrae la geometría, guarda el
   * cartucho en edición, precarga autoria (si GWI), verifica
   * referencias al entrar y pinta todo.
   * @param {HTMLImageElement} imgS - Imagen de segmentos (img_s).
   * @param {Object} cartucho - JSON del cartucho original (GWB/GWI).
   * @param {?Object} autoria - Sección autoria (solo GWI).
   * @returns {boolean} true si arrancó bien.
   */
  function arrancar(imgS, cartucho, autoria) {
    const error = baseExtractor.verificarBN(imgS);
    if (error) {
      baseDirector.avisarError('Descomposición fallida: ' + error);
      return false;
    }
    const resultado = baseExtractor.extraerBN(imgS);
    if (resultado.ruido > 0) {
      console.warn('[extractor] ' + resultado.ruido + ' componente(s) de menos de ' +
        baseExtractor.UMBRAL_RUIDO + ' px descartada(s) como ruido.');
    }
    if (resultado.comps.length === 0) {
      baseDirector.avisarError('La imagen no tiene contenido negro: nada que descomponer.');
      return false;
    }
    base = resultado;
    seleccion = null;
    eleccion = null;
    if (autoria && cargarAutoria(autoria)) {
      componerPantalla = true;             // GWI: previsualización completa
      console.info('[autoría] precargada del GWI: ' + uniones.length +
        ' unión(es), ' + props.size + ' componente(s) con propiedades.');
    } else {
      uniones = [];
      ficticios = [];         // ficticios de otra sesión, fuera
      ficticioSeq = 0;
      props = new Map();
      cambios = [];         // historial de una sesión anterior, fuera
      ultimoOp = 0;         // (arrancar SIEMPRE parte de estado limpio)
      rehacibles = [];
      componerPantalla = false;            // GWB fresco: solo fondo
    }
    _asegurarCartucho();          // F3-I11: la ficha del cartucho SIEMPRE existe
    _reconstruir();
    if (autoria) _verificarReferencias();   // colgantes al entrar, aviso
    _refrescar();
    _$('panelSegmento').classList.add('oculto');
    _$('panelSegmento').replaceChildren();
    console.log('[autoría] ' + base.comps.length + ' componente(s), ' +
      sprites.length + ' sprite(s) único(s), ' + grupos.length + ' segmento(s)');
    listar();
    baseDirector.avisar('Imagen descompuesta: ' + grupos.length + ' segmento(s)' +
      (autoria ? ' (autoría precargada).' : ', todos de tipo juego por defecto. Pulsa en el mapa para editarlos.'));
    // Aviso de topes (F5-I6): al descomponer es NO bloqueante — el
    // diseñador decide si seguir con un cartucho que el GWC no podrá
    // llevar; «Generar GWI+GWC» lo bloqueará.
    _avisoTopes();
    return true;
  }

  /**
   * Limpia toda la autoría (al recargar cartucho o setup).
   * @returns {void}
   */
  function reset() {
    base = null;
    comunListas.limpiar();    // listas del cartucho anterior (puente), fuera
    uniones = [];
    props = new Map();
    cambios = [];             // historial anterior, fuera
    ultimoOp = 0;
    ficticios = [];           // ficticios de otra sesión, fuera
    ficticioSeq = 0;
    rehacibles = [];          // pila de rehacer anterior, fuera
    componerPantalla = false; // sin GWI en edición no hay previsualización
    grupos = [];
    sprites = [];
    indiceGrupo = new Map();
    seleccion = null;
    eleccion = null;
    marcados = new Set();    // selección múltiple anterior, fuera
    arrastre = null;         // recuadro en curso, fuera
    _$('zonaMapa').classList.add('oculto');
    _$('panelSegmento').classList.add('oculto');
    _$('panelSegmento').replaceChildren();
    _$('listaSegmentos').replaceChildren();      // lista del cartucho anterior, fuera
  }

  /**
   * F5-I17 (M3): número de ACCIONES de la autoría en curso, contadas
   * por bloques del historial (nº de acción distinto); el alta de la
   * ficha del cartucho NO cuenta (no es acción del autor, F5-I15 E5).
   * La usa baseDirector para el aviso «se descarta el historial (N
   * acciones)» al cargar un GWB sobre un GWI con autoría.
   * @returns {number} Acciones de la autoría (0 si no hay historial).
   */
  function numeroDeCambios() {
    if (cambios.length === 0) return 0;
    let acciones = 0;
    for (const n of new Set(cambios.map(c => c.n))) {
      if (!_esBloqueDeFicha(cambios.filter(c => c.n === n))) acciones++;
    }
    return acciones;
  }

  /**
   * Deja en memoria las listas de un GWI para el motor. Las
   * listas viven en comunListas (el puente de datos entre la
   * autoría y el juego, fichero propio): esta función es solo el
   * punto de escritura desde el flujo de carga.
   * @param {Array<Object>} sp - Lista sprites del GWI.
   * @param {Array<Object>} segs - Lista segmentos del GWI.
   * @returns {void}
   */
  function cargarListas(sp, segs) {
    comunListas.cargar(sp, segs);
  }

  /**
   * Cablea el clic del mapa de segmentos (lo llama el baseDirector al
   * inicializar).
   * @returns {void}
   */
  function inicializar() {
    _$('mapaSegmentos').addEventListener('pointerdown', _alPulsarMapa);
    _$('mapaSegmentos').addEventListener('pointermove', _alMoverMapa);
    _$('mapaSegmentos').addEventListener('pointerup', _alSoltarMapa);
  }

  return {
    arrancar: arrancar,
    verificarYGuardar: verificarYGuardar,
    generarGWIyGWC: generarGWIyGWC,
    deshacer: deshacer,
    rehacer: rehacer,
    cargarAutoria: cargarAutoria,
    cargarListas: cargarListas,
    pintarFondoAparato: pintarFondoAparato,
    pintarSegmentoAparato: pintarSegmentoAparato,
    pintarGWI: pintarGWI,
    repintarAparato: pintarPantallaAutoria,       // F5-I10: tras cambiar img_f en la ficha
    pintarListaSegmentos: pintarListaSegmentos,   // F5-I7
    resumen: resumen,                             // F5-I7: panel del Editor
    direccionesDeJugador: direccionesDeJugador,   // F5-I21: ¿cabe el juego en otro estilo?
    segmentos: segmentos,
    sprites: () => sprites,
    listar: listar,
    numeroDeCambios: numeroDeCambios,            // F5-I17 (M3): acciones de la autoría en curso
    dimensionesBase: () => base ? { ancho: base.ancho, alto: base.alto } : null,   // F5-I21: ventana de ajuste
    reset: reset,
    inicializar: inicializar
  };

})();
