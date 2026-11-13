//
// BaseGraficos.js
// ==================================================
//
// PROPÓSITO
//   El dibujo del MAPA DE TRABAJO del diseñador: el fondo (img_f) y
//   los segmentos presentados con el color de su tipo o de sus
//   relaciones, sobre el lienzo del mapa.
//
// SEPARACIÓN
//   Presentación del mapa de trabajo, NO del aparato: la pantalla del
//   aparato la compone BaseDescomponer (fondo + segmentos en negro
//   puro), y el simulador tiene su propio dibujo (JuegoMotorGrafico).
//   Este módulo no interpreta la autoría: solo recibe una lista
//   residente de segmentos y una imagen de fondo, y las presenta.
//
// PRINCIPIO
//   Un segmento no sabe qué hay debajo de él: el color se ESCRIBE
//   DIRECTO (negro puro en modo LCD, color del tipo en el
//   diseñador). Sin XOR no hay auto-borrado: para quitar un
//   segmento se repinta el fondo y los restantes (el mapa se
//   repinta entero siempre). No hay estado interno: quien llama ya
//   sabe si el segmento está encendido. La misma arquitectura en
//   las tres plataformas (diseñador, simulador y futuro ESP32); el
//   ESP32 no heredará este código, pero sí el diseño.
//
// FUNCIONES
//   fijarFondo        La imagen de fondo (img_f) para DibujarFondo.
//   fijarSegmentos    La lista residente de segmentos.
//   escalaDe          Escala por eje del canvas destino.
//   pixelesDe         Píxeles de un sprite (canvas o PNG).
//   DibujarFondo      El fondo estirado al canvas, sobre blanco
//                     opaco (base siempre visible).
//   DibujarSegmento   Un segmento estirado por eje (vecino más
//                     cercano): negro puro o color del tipo.
//
// Carga DESPUÉS de BaseExtractor.js y ANTES de BaseDescomponer.js y
// BaseDirector.js.

var BaseGraficos = (function () {
  'use strict';

  // Color de presentación LCD: NEGRO puro. El LCD real SIEMPRE dibuja
  // sus segmentos en negro sobre el arte impreso de la pantalla, venga
  // del color que venga el fondo (el arte está en una capa fí­sica
  // aparte). El XOR con blanco (la versión anterior) solo daba negro
  // sobre hueco blanco puro: sobre arte en color el segmento salí­a
  // como INVERSIíN del fondo (claro sobre mar oscuro, oscuro sobre
  // cielo), no negro. Escribir directo elimina el auto-borrado de la
  // doble llamada: para quitar un segmento se repinta el fondo y los
  // demás (el editor siempre repinta completo; el motor usará doble
  // buffer). El color "tí­pico" (true) lo trae cada segmento en su
  // lista (color de su tipo; solo lo usa el diseñador).
  var COLOR_PRESENTAR = [0, 0, 0];

  var fondo = null;        // imagen de fondo actual (img_f)
  var segmentos = [];      // lista residente: {x, y, imagen, color?}

  // ---------- Estado (lo fija quien carga el cartucho) ----------

  /**
   * Fija la imagen de fondo (img_f) que usarán DibujarFondo y el
   * cálculo de escala. La llama el Director al cargar el cartucho.
   * @param {?HTMLImageElement} imagen - Imagen de fondo (img_f), o null
   *        si el cartucho no tiene fondo (opcional, punto 8 de la Fase 5).
   * @returns {void}
   */
  function fijarFondo(imagen) {
    fondo = imagen;
  }

  /**
   * Fija la lista residente de segmentos. Cada elemento debe traer
   * posición (x, y), imagen y (opcional, diseñador) el color de su
   * tipo. La llena la extracción (diseñador) o la carga del GWI
   * (simulador): desde aquí­ ambas son lo mismo.
   * @param {Array<{x:number, y:number, imagen:object, color:?Array<number>}>} lista
   * @returns {void}
   */
  function fijarSegmentos(lista) {
    segmentos = lista || [];
  }

  // ---------- Utilidades internas ----------

  /**
   * Escala del canvas POR EJE, en unidades de img_s: las coordenadas
   * de los segmentos viven en el espacio de la imagen de segmentos
   * (que puede NO medir lo mismo que img_f: cada una se estira AL
   * VUELO a la resolución real que declara el setup). Prioridad:
   * (1) canvas.escalaX/escalaY (el aparato: quien pinta los fija a
   * partir de img_s); (2) canvas.escala uniforme (el mapa de trabajo,
   * escala entera); (3) deducción del ancho del fondo (legado).
   * Devuelve un factor por eje porque el estirado no tiene por quí©
   * ser proporcional (img_s y pantalla pueden aspect distinto).
   * @param {HTMLCanvasElement} donde - Canvas destino.
   * @returns {{x:number, y:number}} Factor de escala por eje.
   */
  function escalaDe(donde) {
    if (donde.escalaX && donde.escalaY) return { x: donde.escalaX, y: donde.escalaY };
    if (donde.escala) return { x: donde.escala, y: donde.escala };
    if (fondo && fondo.naturalWidth) {
      return { x: donde.width / fondo.naturalWidth, y: donde.height / fondo.naturalHeight };
    }
    return { x: 1, y: 1 };
  }

  /**
   * Lee los pí­xeles de una imagen (sea canvas del diseñador o PNG
   * cargado del GWI) como ImageData; para los PNG pasa por un canvas
   * temporal. Procesar-al-dibujar: se calcula en cada presentación.
   * @param {object} imagen - Canvas o Image del sprite.
   * @returns {ImageData} Pí­xeles del sprite.
   */
  function pixelesDe(imagen) {
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

  // ---------- Presentación ----------

  /**
   * Dibuja el fondo de la pantalla (img_f) estirado para llenar el
   * canvas, como en la máquina real (el arte fijo está detrás del
   * cristal lí­quido). Antes de dibujar rellena el canvas de BLANCO
   * OPACO: si img_f tiene pí­xeles transparentes (tí­pico en PNG de
   * artwork), sin esto el canvas quedarí­a con alfa 0 y los XOR de
   * los segmentos escribirí­an RGB invisibles (bug de "los segmentos
   * no aparecen en el aparato"). El blanco es además el color real
   * del LCD apagado. Sin fondo fijado (cartucho sin img_f, opcional
   * desde el punto 8 de la Fase 5) queda el blanco y no hay aviso.
   * @param {HTMLCanvasElement} donde - Canvas en el que se dibuja.
   * @returns {void}
   */
  function DibujarFondo(donde) {
    if (!fondo) {
      // Sin fondo fijado: cartucho sin img_f (opcional desde el punto 8
      // de la Fase 5) o sin cartucho. La base blanca ya queda pintada
      // abajo (es el color real del LCD apagado): no es un aviso.
    }
    const ctx = donde.getContext('2d');
    ctx.imageSmoothingEnabled = false;
    ctx.fillStyle = '#FFFFFF';               // base opaca, siempre
    ctx.fillRect(0, 0, donde.width, donde.height);
    if (fondo) ctx.drawImage(fondo, 0, 0, donde.width, donde.height);
  }

  /**
   * Dibuja un segmento: los pí­xeles oscuros del sprite se ESCRIBEN
   * con el color elegido sobre lo que haya debajo; los pí­xeles
   * blancos son transparentes y no tocan nada. Igual que el fondo,
   * el segmento se ESTIRA AL VUELO a la resolución del canvas (la
   * del setup): la escala es POR EJE y puede ser fraccionaria e
   * incluso menor que 1 (img_s a más resolución que la pantalla).
   *
   * El bucle recorre los pí­xeles DEL DESTINO (no del sprite) dentro
   * de la caja destino recortada al canvas: cada pí­xel del canvas
   * muestrea el pí­xel del sprite que le corresponde por proximidad
   * (vecino más cercano por eje). Así­ cualquier escala funciona sin
   * perder pí­xeles en los bordes; con escala entera el resultado es
   * el mismo bloque nín de siempre.
   *
   * Con tipico=false (modo LCD) el segmento se escribe en NEGRO
   * puro, venga del color que venga el fondo: en la máquina real el
   * arte fijo está impreso en una capa fí­sica aparte y el cristal
   * lí­quido siempre dibuja negro encima. SIN auto-borrado: no hay
   * XOR que cancele con una segunda llamada; para quitar un
   * segmento hay que repintar el fondo y los segmentos restantes
   * (el editor repinta siempre completo; el motor de juego usará
   * doble buffer). No hay estado interno: quien llama ya sabe si el
   * segmento está encendido.
   *
   * Con tipico=true (solo diseñador) el color del tipo se ESCRIBE
   * sobre el fondo, sin XOR: es una ayuda visual del mapa de trabajo,
   * no presentación; no necesita auto-borrado (el mapa se repinta
   * entero), y no pasará al ESP32.
   *
   * @param {HTMLCanvasElement} donde - Canvas en el que se dibuja.
   * @param {number} n - Posición en la lista de segmentos: de ahí­
   *   salen la imagen y su posición.
   * @param {boolean} [tipico=false] - false: NEGRO puro directo (modo
   *   LCD, simulador y ESP32); true: escribir el color del tipo del
   *   segmento (vista de trabajo del diseñador).
   * @returns {void}
   */
  function DibujarSegmento(donde, n, tipico) {
    const seg = segmentos[n];
    if (!seg) {
      console.warn('[motor] DibujarSegmento: no hay segmento ' + n + ' en la lista.');
      return;
    }
    // Sin guard de fondo: el segmento no usa el fondo (escribe directo
    // sobre el canvas); el fondo del cartucho es opcional desde el
    // punto 8 de la Fase 5 y null es un estado válido.
    const escribir = tipico && seg.color;    // diseñador: color del tipo
    const rgb = escribir ? seg.color : COLOR_PRESENTAR;

    const esc = escalaDe(donde);
    if (!(esc.x > 0) || !(esc.y > 0)) {
      console.warn('[motor] escala no positiva (' + esc.x + 'x' + esc.y + '): no se pinta.');
      return;
    }
    const pix = pixelesDe(seg.imagen);
    const p = pix.data;
    const sw = pix.width, sh = pix.height;
    // Caja destino en pí­xeles del canvas: posición estirada por eje,
    // bordes redondeados al pí­xel (cualquier escala, fraccionaria o <1)
    const xf = seg.x * esc.x, yf = seg.y * esc.y;
    const wf = sw * esc.x, hf = sh * esc.y;
    const x0 = Math.max(0, Math.round(xf));
    const y0 = Math.max(0, Math.round(yf));
    const x1 = Math.min(donde.width, Math.round(xf + wf));
    const y1 = Math.min(donde.height, Math.round(yf + hf));
    if (x1 <= x0 || y1 <= y0) return;       // fuera del canvas, nada
    const wTot = x1 - x0, hTot = y1 - y0;

    const ctx = donde.getContext('2d');
    const idd = ctx.getImageData(x0, y0, wTot, hTot);
    const d = idd.data;
    const cr = rgb[0], cg = rgb[1], cb = rgb[2];
    for (let dy = 0; dy < hTot; dy++) {
      // Pí­xel del sprite que cubre esta fila del canvas (clamp a los
      // lí­mites: el redondeo de los bordes puede asomar 1 pí­xel fuera)
      const sy = Math.min(sh - 1, Math.max(0, Math.floor((y0 + dy - yf) / esc.y)));
      for (let dx = 0; dx < wTot; dx++) {
        const sx = Math.min(sw - 1, Math.max(0, Math.floor((x0 + dx - xf) / esc.x)));
        const i = (sy * sw + sx) * 4;
        if (p[i] + p[i + 1] + p[i + 2] >= 384) continue;   // blanco: transparente
        const j = (dy * wTot + dx) * 4;
        // Alfa siempre opaco: el canvas puede tener alfa 0 si el
        // fondo traí­a transparencia; sin esto el pí­xel escrito
        // serí­a invisible aunque el RGB sea correcto.
        d[j + 3] = 255;
        // Escritura DIRECTA del color (negro en modo LCD, color del
        // tipo en el diseñador): sin XOR no hay auto-borrado â quitar
        // un segmento = repintar fondo y restantes (ver JSDoc).
        d[j]     = cr;
        d[j + 1] = cg;
        d[j + 2] = cb;
      }
    }
    ctx.putImageData(idd, x0, y0);
  }

  // API píºblica
  return {
    fijarFondo: fijarFondo,
    fijarSegmentos: fijarSegmentos,
    DibujarFondo: DibujarFondo,
    DibujarSegmento: DibujarSegmento
  };

})();