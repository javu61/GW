// JuegoMotorGrafico — el que presenta la pantalla (la pieza real).
// ====================================================================================================
// Motor gráfico REAL (Fase 2): composición pura con REPINTADO
// COMPLETO por estado. Dos instrucciones, como definió el
// análisis (F2-I1):
//   - inicializar(): presenta el FONDO FIJO solo (la máquina queda
//     operativa antes de que empiece el juego). Lo llama el
//     JuegoDirector al arrancar, justo después de limpiar.
//   - tick(): la presentación de cada tick — pinta el fondo y,
//     encima, TODOS los segmentos con visible=true, en negro
//     puro, en su posición y con la escala del aparato. Como el
//     fondo se repinta entero en cada tick, un segmento que se
//     apaga desaparece SIN RASTRO y sin parpadeo.
//
// Etapas INCONEXAS (decisión de diseño): este fichero NO usa nada
// de la autoría (nada de Base*). Los datos del cartucho le
// llegan por el PUENTE ComunListas (fichero propio, común a las
// dos etapas): el fondo (ComunListas.fondo) y la lista de
// segmentos (ComunListas.segmentos), cuyos objetos llevan su
// imagen (seg.imagen) colgada por la carga. El DIBUJO también es
// propio: las funciones locales de abajo (equivalentes a las de
// la Fase 1, sin compartirlas). La escala del aparato vive como
// propiedad del canvas (canvas.escalaX/Y), donde la dejó la
// carga del cartucho. Es LECTOR PURO: nunca altera la lista.
//
// Este mismo contrato —la lista es el estado, presentar =
// componer fondo + visibles— es el que consumirán las vías de
// hardware futuras.
//
// Diagnóstico con llave: los mensajes solo aparecen si la
// variable global GW_DEBUG (index.html) está activa.
//
// Script clásico (sin módulos, compatible file://). Carga tras
// JuegoMotorEstados.js y antes de JuegoDirector.js.
// ====================================================================================================

var JuegoMotorGrafico = (function () {
  'use strict';

  /**
   * ¿Está la depuración activa? Llave global GW_DEBUG (index.html).
   * @returns {boolean} true si hay que escribir diagnóstico.
   * @since 2.6
   */
  function _debug() {
    return typeof GW_DEBUG !== 'undefined' && GW_DEBUG;
  }

  /**
   * Píxeles de una imagen (canvas o PNG) como ImageData.
   * @param {HTMLImageElement|HTMLCanvasElement} imagen - Imagen.
   * @returns {ImageData} Píxeles de la imagen.
   * @since 2.7
   */
  function _pixelesDe(imagen) {
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
   * Presenta el FONDO FIJO: base blanca opaca (LCD apagado) y
   * encima el arte del cartucho (img_f), estirado para llenar el
   * canvas siempre. El fondo viene del puente ComunListas.
   * @returns {void}
   * @since 2.7
   */
  function _pintarFondo() {
    const canvas = document.getElementById('pantalla');
    const ctx = canvas.getContext('2d');
    ctx.imageSmoothingEnabled = false;
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    const imgF = (typeof ComunListas !== 'undefined') ? ComunListas.fondo() : null;
    if (imgF) ctx.drawImage(imgF, 0, 0, canvas.width, canvas.height);
  }

  /**
   * Presenta un SEGMENTO encendido: silueta en NEGRO PURO directo
   * (el LCD siempre dibuja negro), en su posición escalada al
   * canvas, muestreo por vecino más cercano, caja destino
   * recortada al lienzo. Los píxeles blancos del sprite son
   * transparentes (solo se escribe la silueta). La escala por eje
   * vive en el canvas (escalaX/escalaY), donde la dejó la carga.
   * @param {HTMLCanvasElement} canvas - Canvas de la pantalla.
   * @param {number} x - Posición x del segmento (espacio img_s).
   * @param {number} y - Posición y del segmento.
   * @param {HTMLImageElement} imagen - Sprite del segmento.
   * @returns {void}
   * @since 2.7
   */
  function _pintarSegmento(canvas, x, y, imagen) {
    const escX = canvas.escalaX, escY = canvas.escalaY;
    if (!(escX > 0) || !(escY > 0)) {
      if (_debug()) console.warn('motor gráfico: escala sin fijar, no se pinta el segmento.');
      return;
    }
    const pix = _pixelesDe(imagen);                  //La imagen
    const p = pix.data;                             //Imagen en sí
    const sw = pix.width, sh = pix.height;          //Tamaño de la imagen
    const xf = x * escX, yf = y * escY;             //Tamaño de la imagen escalada

    //Máximo y mínimo de la caja destino, recortada al canvas      
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
   * INICIALIZA la pantalla: presenta el FONDO FIJO solo (arte
   * del cartucho, sin segmentos). Lo llama el JuegoDirector al
   * arrancar; sin cartucho cargado queda la base blanca (LCD
   * apagado) y se avisa (con depuración).
   * @returns {void}
   * @since 2.6
   */
  function inicializar() {
    _pintarFondo();
    if (_debug()) {
      const imgF = (typeof ComunListas !== 'undefined') ? ComunListas.fondo() : null;
      if (!imgF) {
        console.warn('motor gráfico: sin cartucho cargado, pantalla en blanco (LCD apagado)');
      } else {
        console.log('motor gráfico: inicializado (fondo en pantalla)');
      }
    }
  }

  /**
   * PRESENTA el estado actual: repintado completo — fondo y,
   * encima, todos los segmentos encendidos (visible=true) en
   * negro puro. Lee la lista del puente; nunca la escribe.
   * @returns {void}
   * @since 2.6
   */
  function tick() {
    const canvas = document.getElementById('pantalla');
    const segs = (typeof ComunListas !== 'undefined') ? ComunListas.segmentos() : [];
    _pintarFondo();
    let presentados = 0;
    let sinImagen = 0;
    for (const seg of segs) {
      if (!seg.visible) continue;            // lector puro: solo los encendidos
      if (!seg.imagen) { sinImagen++; continue; }
      _pintarSegmento(canvas, seg.x, seg.y, seg.imagen);
      presentados++;
    }
    if (_debug()) {
      console.log('motor gráfico: ' + presentados + ' segmento(s) presentado(s)' +
        (sinImagen ? ' — ¡ojo! ' + sinImagen + ' visible(s) sin imagen' : ''));
    }
  }

  return { 
    inicializar: inicializar, 
    tick: tick 
  };
})();