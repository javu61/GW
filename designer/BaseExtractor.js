'use strict';

/*
 * BaseExtractor.js
 * ==================================================
 *
 * PROPÓSITO
 *   Extraer los segmentos elementales desde la imagen de segmentos
 *   (img_s) de un cartucho: la GEOMETRÍA pura, sin lógica alguna.
 *   La imagen es estrictamente blanco y negro: blanco = fondo (se
 *   ignora), negro = contenido; una componente conexa negra
 *   (conectividad 8) = un segmento elemental. Cualquier otro color
 *   es error bloqueante (verificarBN).
 *
 * SEPARACIÓN
 *   La geometría se dibuja, la lógica se señala: aquí no hay roles
 *   (tipo, uniones, secuencias, salidas, bifurcaciones, indicadores);
 *   los asigna el autor en el mapa de objetos de BaseDescomponer.
 *   La reagrupación (uniones de componentes) es aparte de la
 *   extracción: extraerBN no aplica ninguna unión, las recibe
 *   reagrupar ya decididas. Se carga antes que BaseGraficos.js,
 *   BaseDescomponer.js y BaseDirector.js.
 *
 * FUNCIONES
 *
 *  Utilidades
 *   hex            Color → '#RRGGBB' (para el mensaje de intrusos).
 *   leerImagen     Imagen en memoria → píxeles (canvas, RGBA).
 *   componentes    Componentes conexas de una máscara (conectividad
 *                  8) con caja y lista de píxeles.
 *   crearUnionFind Estructura unir/buscar para las reagrupaciones.
 *
 *  API pública
 *   verificarBN    img → null si es B/N puro, o mensaje con los
 *                  colores intrusos (bloqueante, máximo 8 en el
 *                  mensaje, ordenado por píxeles).
 *   extraerBN      img → base = { ancho, alto, comps, indicePixel,
 *                  ruido }: componentes elementales y mapa
 *                  píxel → componente; el ruido (< 4 px) se
 *                  descarta contando con aviso.
 *   reagrupar      (base, uniones) → { sprites, grupos }: fusiona
 *                  por pares de índices (union-find), sprites únicos
 *                  por huella EXACTA (dimensiones + píxeles, nada de
 *                  «casi iguales»), orden determinista arriba-abajo
 *                  e izquierda-derecha, sprites numerados img_NNN por
 *                  primera aparición. Las uniones con índices
 *                  inexistentes avisan y se ignoran.
 */

const BaseExtractor = (() => {

  const UMBRAL_RUIDO = 4;   // componentes menores: ruido descartado

  /* ---------------- Utilidades ---------------- */

  function hex(r, g, b) {
    const h = (v) => v.toString(16).padStart(2, '0').toUpperCase();
    return '#' + h(r) + h(g) + h(b);
  }

  /* Lee la imagen a un canvas y devuelve {datos, ancho, alto}. */
  function leerImagen(img) {
    const c = document.createElement('canvas');
    c.width = img.naturalWidth;
    c.height = img.naturalHeight;
    const ctx = c.getContext('2d');
    ctx.drawImage(img, 0, 0);
    return {
      datos: ctx.getImageData(0, 0, c.width, c.height),
      ancho: c.width,
      alto: c.height
    };
  }

  /* Componentes conexas de una máscara (conectividad 8). */
  function componentes(mascara, ancho, alto) {
    const etiquetas = new Int32Array(mascara.length);
    const lista = [];
    for (let i = 0; i < mascara.length; i++) {
      if (!mascara[i] || etiquetas[i]) continue;
      const comp = { x: ancho, y: alto, x2: -1, y2: -1, superficie: 0, pixeles: [] };
      const indice = lista.length + 1;
      etiquetas[i] = indice;
      const pila = [i];
      while (pila.length > 0) {
        const p = pila.pop();
        const px = p % ancho, py = (p / ancho) | 0;
        comp.superficie++;
        comp.pixeles.push(p);
        if (px < comp.x) comp.x = px;
        if (px > comp.x2) comp.x2 = px;
        if (py < comp.y) comp.y = py;
        if (py > comp.y2) comp.y2 = py;
        for (let dy = -1; dy <= 1; dy++) {
          for (let dx = -1; dx <= 1; dx++) {
            if (dx === 0 && dy === 0) continue;
            const nx = px + dx, ny = py + dy;
            if (nx < 0 || ny < 0 || nx >= ancho || ny >= alto) continue;
            const q = ny * ancho + nx;
            if (mascara[q] && !etiquetas[q]) {
              etiquetas[q] = indice;
              pila.push(q);
            }
          }
        }
      }
      comp.ancho = comp.x2 - comp.x + 1;
      comp.alto = comp.y2 - comp.y + 1;
      lista.push(comp);
    }
    return lista;
  }

  function crearUnionFind(n) {
    const padre = new Int32Array(n);
    for (let i = 0; i < n; i++) padre[i] = i;
    function buscar(i) {
      while (padre[i] !== i) { padre[i] = padre[padre[i]]; i = padre[i]; }
      return i;
    }
    return {
      buscar: buscar,
      unir: function (a, b) {
        a = buscar(a); b = buscar(b);
        if (a !== b) { if (b < a) { const t = a; a = b; b = t; } padre[b] = a; }
      }
    };
  }

  /* ---------------- Verificación B/N ---------------- */

  /* Devuelve null si TODOS los píxeles son blanco o negro puros, o un
   * mensaje con los colores intrusos encontrados (bloqueante). */
  function verificarBN(img) {
    const { datos, ancho, alto } = leerImagen(img);
    const d = datos.data;
    const intrusos = new Map();      // color -> píxeles
    for (let i = 0; i < ancho * alto; i++) {
      const r = d[i * 4], g = d[i * 4 + 1], b = d[i * 4 + 2];
      if ((r === 255 && g === 255 && b === 255) ||
        (r === 0 && g === 0 && b === 0)) continue;
      const color = hex(r, g, b);
      intrusos.set(color, (intrusos.get(color) || 0) + 1);
    }
    if (intrusos.size === 0) return null;
    const lista = Array.from(intrusos, ([color, px]) => color + ' (' + px + ' px)');
    lista.sort((a, b) => parseInt(b.match(/\((\d+)/)[1]) - parseInt(a.match(/\((\d+)/)[1]));
    return 'la imagen debe ser estrictamente blanco y negro. Colores intrusos: ' +
      lista.slice(0, 8).join(', ') +
      (lista.length > 8 ? ' y ' + (lista.length - 8) + ' más.' : '.');
  }

  /* ---------------- Extracción (geometría) ---------------- */

  /* Extrae las componentes negras elementales y el mapa píxel→compo-
   * nente. No aplica ninguna unión: la reagrupación es aparte. */
  function extraerBN(img) {
    const { datos, ancho, alto } = leerImagen(img);
    const n = ancho * alto;
    const d = datos.data;
    const mascara = new Uint8Array(n);
    for (let i = 0; i < n; i++) {
      const r = d[i * 4], g = d[i * 4 + 1], b = d[i * 4 + 2];
      if (r === 0 && g === 0 && b === 0) mascara[i] = 1;
    }
    const indicePixel = new Int32Array(n).fill(-1);
    const comps = [];
    let ruido = 0;
    for (const comp of componentes(mascara, ancho, alto)) {
      if (comp.superficie < UMBRAL_RUIDO) {
        ruido++;
        continue;
      }
      const idx = comps.length;
      comps.push(comp);
      for (const p of comp.pixeles) indicePixel[p] = idx;
    }
    return { ancho: ancho, alto: alto, comps: comps, indicePixel: indicePixel, ruido: ruido };
  }

  /* ---------------- Reagrupación (uniones + sprites) ---------------- */

  /* Fusiona las componentes según las uniones dadas (pares de índices
   * de componente) y produce sprites únicos y grupos ordenados de
   * forma determinista. Las uniones con índices inexistentes avisan
   * y se ignoran. */
  function reagrupar(base, uniones) {
    const uf = crearUnionFind(base.comps.length);
    for (const [a, b] of (uniones || [])) {
      if (a < 0 || b < 0 || a >= base.comps.length || b >= base.comps.length) {
        console.warn('[extractor] unión con un segmento que no existe: ' + a + ' - ' + b);
        continue;
      }
      uf.unir(a, b);
    }

    // Miembros por raíz
    const porRaiz = new Map();
    for (let i = 0; i < base.comps.length; i++) {
      const r = uf.buscar(i);
      if (!porRaiz.has(r)) porRaiz.set(r, []);
      porRaiz.get(r).push(i);
    }

    // Cajas de cada grupo (para el orden determinista)
    const gruposBrutos = [];
    for (const miembros of porRaiz.values()) {
      let minX = base.ancho, minY = base.alto, maxX = 0, maxY = 0;
      for (const i of miembros) {
        const c = base.comps[i];
        if (c.x < minX) minX = c.x;
        if (c.y < minY) minY = c.y;
        if (c.x + c.ancho - 1 > maxX) maxX = c.x + c.ancho - 1;
        if (c.y + c.alto - 1 > maxY) maxY = c.y + c.alto - 1;
      }
      gruposBrutos.push({
        miembros: miembros,
        raiz: Math.min(...miembros),
        x: minX, y: minY,
        ancho: maxX - minX + 1, alto: maxY - minY + 1
      });
    }
    // Orden: arriba-abajo, a igual altura izquierda-derecha
    gruposBrutos.sort((a, b) => (a.y - b.y) || (a.x - b.x));

    // Sprites únicos por huella (dimensiones + mapa de píxeles):
    // "casi iguales" NO se fusionan.
    const sprites = [];
    const vistas = new Map();
    const ancho = base.ancho;
    for (const g of gruposBrutos) {
      const mapaBits = new Uint8Array(g.ancho * g.alto);
      for (const i of g.miembros) {
        const c = base.comps[i];
        for (const p of c.pixeles) {
          const sx = (p % ancho) - g.x;
          const sy = ((p / ancho) | 0) - g.y;
          mapaBits[sy * g.ancho + sx] = 1;
        }
      }
      let huella = g.ancho + 'x' + g.alto;
      for (let i = 0; i < mapaBits.length; i++) huella += mapaBits[i] ? '1' : '0';
      let sprite = vistas.get(huella);
      if (!sprite) {
        const canvas = document.createElement('canvas');
        canvas.width = g.ancho;
        canvas.height = g.alto;
        const ctx = canvas.getContext('2d');
        const idd = ctx.createImageData(g.ancho, g.alto);
        const dd = idd.data;
        for (let i = 0; i < mapaBits.length; i++) {
          const j = i * 4;
          if (mapaBits[i]) { dd[j] = 0; dd[j + 1] = 0; dd[j + 2] = 0; dd[j + 3] = 255; }
          else { dd[j] = 255; dd[j + 1] = 255; dd[j + 2] = 255; dd[j + 3] = 255; }
        }
        ctx.putImageData(idd, 0, 0);
        sprite = {
          id: 'img_' + String(sprites.length).padStart(3, '0'),
          ancho: g.ancho, alto: g.alto, imagen: canvas
        };
        vistas.set(huella, sprite);
        sprites.push(sprite);
      }
      g.spriteId = sprite.id;
      g.sprite = sprite;
    }
    return { sprites: sprites, grupos: gruposBrutos };
  }

  return {
    UMBRAL_RUIDO: UMBRAL_RUIDO,
    verificarBN: verificarBN,
    extraerBN: extraerBN,
    reagrupar: reagrupar
  };

})();