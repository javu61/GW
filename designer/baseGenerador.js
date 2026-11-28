'use strict';

// baseGenerador.js
// ====================================================================================================
// PROPÓSITO
//   La pestaña «Generador» (F6-I03): prepara la generación de lo que necesita
//   cada sistema de destino. La ficha trae los selectores de Destino (Mega /
//   ESP) y Etapa (Prueba / Completa); el botón «Generar» vive en la barra
//   superior, como en el resto de pestañas.
//
// QUÉ GENERA (F6-I04)
//   Mega + Prueba: la primera prueba del Mega (F6-I02), en DOS ficheros:
//     - <cartucho>_gwc.h: el GWC completo como array const uint8_t GWC[]
//       PROGMEM (la vía recomendada para cargarlo en el Mega, F6-I02),
//       SIN el bloque del fondo (la prueba va con fondo liso).
//     - <cartucho>_prueba_mega.ino: el programa de la prueba: valida el
//       GWC (cabecera y CRC), lo parsea (bloques 0, 2 y 3), pinta el
//       fondo liso (ColorFondo) y los segmentos como tiras horizontales
//       de la máscara, y recorre la Secuencia del cartucho como constante
//       (F6-I02), con las medidas del director (micros() y RAM libre).
//   Cualquier otra combinación todavía no tiene contenido: el botón avisa
//   «Nada que generar en este momento» y no genera nada.
//
// SEPARACIÓN
//   El GWC lo monta baseDescomponer.prepararGWC (las mismas comprobaciones
//   que «Generar GWI+GWC», sin estampar nada en el par del Editor); aquí
//   solo se da forma de texto C y se descarga (basePack.descargarBlob).
//   La ficha se construye UNA vez y conserva la selección entre visitas.
//
// FUNCIONES
//  Pantalla
//    pintar     Construye la ficha (la primera vez) y cablea el botón.
//  Lectura
//    estado     La selección vigente { destino, etapa } (null sin ficha).
//  Generación
//    (el botón) Mega + Prueba: .h con el GWC + .ino con la prueba.
//  Internas
//    _crearElemento   _campo   _lleno   _identificador   _textoH
//    _textoIno        _alGenerar
// ====================================================================================================

const baseGenerador = (function () {

  let raiz = null;          // la ficha, construida una vez
  let selDestino = null;    // el select de destino
  let selEtapa = null;      // el select de etapa
  let nota = null;          // la línea informativa de la ficha

  const DESTINOS = [['mega', 'Mega'], ['esp', 'ESP']];
  const ETAPAS = [['prueba', 'Prueba'], ['completa', 'Completa']];

  /**
   * Crea un elemento con clase y texto opcionales.
   * @param {string} etiqueta - Nombre de la etiqueta.
   * @param {string} [clase] - Clase CSS.
   * @param {string} [texto] - Texto a poner como contenido.
   * @returns {HTMLElement} El elemento creado.
   */
  function _crearElemento(etiqueta, clase, texto) {
    const e = document.createElement(etiqueta);
    if (clase) e.className = clase;
    if (texto !== undefined) e.textContent = texto;
    return e;
  }

  /**
   * Añade una fila «caption + control (+ nota)» a la rejilla.
   * @param {HTMLElement} padre - Elemento donde se añade la fila.
   * @param {string} caption - Texto de la etiqueta.
   * @param {HTMLElement} control - Control (select).
   * @param {string} [notaTexto] - Nota opcional junto al control.
   * @returns {void}
   */
  function _campo(padre, caption, control, notaTexto) {
    padre.appendChild(_crearElemento('div', 'fichaCaption', caption));
    const celda = _crearElemento('div', 'fichaCampo');
    celda.appendChild(control);
    if (notaTexto) celda.appendChild(_crearElemento('span', 'fichaNota', notaTexto));
    padre.appendChild(celda);
  }

  /**
   * Llena un select con las opciones [valor, texto].
   * @param {HTMLSelectElement} select - El select a llenar.
   * @param {Array<string[]>} opciones - Pares valor/texto.
   * @returns {void}
   */
  function _lleno(select, opciones) {
    for (const [valor, texto] of opciones) {
      const o = document.createElement('option');
      o.value = valor;
      o.textContent = texto;
      select.appendChild(o);
    }
  }

  /**
   * El nombre del cartucho como identificador C: letras, dígitos y
   * subrayado (los espacios y el resto, a subrayado).
   * @param {string} nombre - El nombre del cartucho.
   * @returns {string} El identificador saneado (nunca vacío).
   */
  function _identificador(nombre) {
    const id = String(nombre || '').replace(/[^A-Za-z0-9]+/g, '_')
      .replace(/^_+|_+$/g, '').replace(/_{2,}/g, '_');
    return id || 'cartucho';
  }

  /**
   * El GWC como fichero de cabecera: array PROGMEM + su tamaño (F6-I02).
   * @param {Object} gwc - El resultado de baseCartucho.generarGWC.
   * @param {string} base - Identificador C del cartucho.
   * @returns {string} El texto del .h.
   */
  function _textoH(gwc, base) {
    const lineas = [];
    lineas.push('// ' + base + ' - GWC de prueba para el Mega (F6-I04), generado por el Designer.');
    lineas.push('// CRC ' + gwc.codigo + ' - ' + gwc.nSprites + ' sprite(s) - ' +
      gwc.nSegmentos + ' segmento(s) - ' + gwc.bytes.length + ' bytes.');
    lineas.push('// Sin el bloque del fondo: la prueba del Mega va con fondo liso (F6-I02).');
    lineas.push('');
    lineas.push('#include <avr/pgmspace.h>');
    lineas.push('');
    lineas.push('#define GWC_TAM ' + gwc.bytes.length);
    lineas.push('');
    lineas.push('const uint8_t GWC[] PROGMEM = {');
    const bytes = gwc.bytes;
    for (let i = 0; i < bytes.length; i += 12) {
      const fila = [];
      for (let j = i; j < Math.min(i + 12, bytes.length); j++) {
        fila.push('0x' + bytes[j].toString(16).padStart(2, '0').toUpperCase());
      }
      lineas.push('  ' + fila.join(', ') + (i + 12 < bytes.length ? ',' : ''));
    }
    lineas.push('};');
    return lineas.join('\n') + '\n';
  }

  /**
   * El programa de la prueba del Mega (F6-I02): fondo liso, segmentos como
   * tiras horizontales y la Secuencia como constante.
   * @param {Object} p - Lo que devuelve baseDescomponer.prepararGWC.
   * @param {string} base - Identificador C del cartucho.
   * @returns {string} El texto del .ino.
   */
  function _textoIno(p, base) {
    const secuencia = (p.secuencia.length > 0) ? p.secuencia : [0];
    const lineas = [];
    lineas.push('// Prueba del Mega (F6-I04) - cartucho: ' + (p.json.nombre || base));
    lineas.push('// Generado por el Designer: pestaña Generador, Destino Mega + Etapa Prueba.');
    lineas.push('// Es la prueba de F6-I02: fondo liso (ColorFondo), segmentos pintados como');
    lineas.push('// tiras horizontales de la máscara y la Secuencia del cartucho como constante.');
    lineas.push('// El GWC viaja en ' + base + '_gwc.h y se valida (cabecera y CRC) al arrancar.');
    lineas.push('// Bibliotecas: Adafruit_GFX y MCUFRIEND_kbv (el shield TFT del Mega, F6-I01).');
    lineas.push('');
    lineas.push('#include <Adafruit_GFX.h>');
    lineas.push('#include <MCUFRIEND_kbv.h>');
    lineas.push('#include "' + base + '_gwc.h"');
    lineas.push('');
    lineas.push('MCUFRIEND_kbv tft;');
    lineas.push('');
    lineas.push('// ---------- Constantes de la prueba ----------');
    lineas.push('const uint16_t PAUSA_MS = 500;      // pausa entre iteraciones (F6-I02)');
    lineas.push('const uint8_t  TICKS = ' + Math.max(1, Math.min(255, p.ticks)) + ';            // iteraciones por paso de la Secuencia');
    lineas.push('');
    lineas.push('// ---------- La Secuencia del cartucho (F6-I02: constante) ----------');
    lineas.push('// Índices de SEGMENTO del GWC, en el orden de la Secuencia.');
    lineas.push('const uint8_t SECUENCIA[] = { ' + secuencia.join(', ') + ' };');
    lineas.push('const uint8_t SECUENCIA_N = ' + p.secuencia.length + ';');
    lineas.push('');
    lineas.push('// ---------- Colores (RGB565) ----------');
    lineas.push('const uint16_t NEGRO = 0x0000;');
    lineas.push('uint16_t colorFondo = 0xFFFF;');
    lineas.push('');
    lineas.push('// ---------- Lectura del GWC en la flash del Mega (PROGMEM) ----------');
    lineas.push('uint8_t byteEn(unsigned int i) { return pgm_read_byte(&GWC[i]); }');
    lineas.push('uint16_t u16En(unsigned int i) { return byteEn(i) | ((uint16_t)byteEn(i + 1) << 8); }');
    lineas.push('uint32_t u32En(unsigned int i) { return u16En(i) | ((uint32_t)u16En(i + 2) << 16); }');
    lineas.push('');
    lineas.push('const unsigned int TAM_CABECERA = 14;         // "GWC1" + CRC "#HHHH#" + tamaño');
    lineas.push('const unsigned int TAM_CABECERA_BLOQUE = 5;   // tipo (1) + tamaño del contenido (4)');
    lineas.push('');
    lineas.push('// CRC-16/CCITT-FALSE sobre el cuerpo (desde el byte TAM_CABECERA)');
    lineas.push('uint16_t crcCuerpo() {');
    lineas.push('  uint16_t crc = 0xFFFF;');
    lineas.push('  for (unsigned int i = TAM_CABECERA; i < GWC_TAM; i++) {');
    lineas.push('    crc ^= (uint16_t)byteEn(i) << 8;');
    lineas.push('    for (uint8_t b = 0; b < 8; b++)');
    lineas.push('      crc = (crc & 0x8000) ? (uint16_t)((crc << 1) ^ 0x1021) : (uint16_t)(crc << 1);');
    lineas.push('  }');
    lineas.push('  return crc;');
    lineas.push('}');
    lineas.push('');
    lineas.push('// ---------- El GWC parseado (solo va a RAM lo imprescindible) ----------');
    lineas.push('struct Sprite   { uint16_t ancho, alto; unsigned int registro; };');
    lineas.push('struct Segmento { uint8_t tipo; uint16_t x, y; uint8_t sprite; };');
    lineas.push('');
    lineas.push('#define MAX_ELEMENTOS 255');
    lineas.push('Sprite sprites[MAX_ELEMENTOS];');
    lineas.push('Segmento segmentos[MAX_ELEMENTOS];');
    lineas.push('uint8_t nSprites = 0, nSegmentos = 0;');
    lineas.push('uint16_t anchoPantalla = 320, altoPantalla = 240;');
    lineas.push('');
    lineas.push('// La cabecera "GWC1", el CRC del cuerpo y el tamaño declarado.');
    lineas.push('bool validarCartucho() {');
    lineas.push('  if (GWC_TAM < TAM_CABECERA + TAM_CABECERA_BLOQUE) return false;');
    lineas.push('  if (byteEn(0) != \'G\' || byteEn(1) != \'W\' || byteEn(2) != \'C\' || byteEn(3) != \'1\') return false;');
    lineas.push('  const char *hex = "0123456789ABCDEF";');
    lineas.push('  uint16_t crc = crcCuerpo();');
    lineas.push('  for (uint8_t i = 0; i < 4; i++) {          // los 4 dígitos de "#HHHH#"');
    lineas.push('    if ((char)byteEn(5 + i) != hex[(crc >> (12 - 4 * i)) & 0xF]) return false;');
    lineas.push('  }');
    lineas.push('  return u32En(10) == GWC_TAM;');
    lineas.push('}');
    lineas.push('');
    lineas.push('// Recorre los bloques y rellena las tablas (el Bloque 5, si existiera, se ignora).');
    lineas.push('bool parsearCartucho() {');
    lineas.push('  uint8_t r = 255, g = 255, b = 255;');
    lineas.push('  unsigned int dirSprites = 0, dirSegmentos = 0;');
    lineas.push('  unsigned int posicion = TAM_CABECERA;');
    lineas.push('  while (posicion + TAM_CABECERA_BLOQUE <= GWC_TAM) {');
    lineas.push('    uint8_t tipo = byteEn(posicion);');
    lineas.push('    uint32_t tam = u32En(posicion + 1);');
    lineas.push('    unsigned int contenido = posicion + TAM_CABECERA_BLOQUE;');
    lineas.push('    if (contenido + tam > GWC_TAM) return false;');
    lineas.push('    if (tipo == 0) {                         // Datos Generales');
    lineas.push('      anchoPantalla = u16En(contenido + 1);');
    lineas.push('      altoPantalla = u16En(contenido + 3);');
    lineas.push('      nSprites = byteEn(contenido + 5);');
    lineas.push('      nSegmentos = byteEn(contenido + 6);');
    lineas.push('      r = byteEn(contenido + 8); g = byteEn(contenido + 9); b = byteEn(contenido + 10);');
    lineas.push('      dirSprites = u32En(contenido + 20);    // direcciones absolutas (Bloque 0)');
    lineas.push('      dirSegmentos = u32En(contenido + 24);');
    lineas.push('    }');
    lineas.push('    posicion = contenido + tam;');
    lineas.push('  }');
    lineas.push('  colorFondo = tft.color565(r, g, b);');
    lineas.push('  if (dirSprites == 0 || dirSegmentos == 0) return false;');
    lineas.push('  unsigned int contenidoSprites = dirSprites + TAM_CABECERA_BLOQUE;');
    lineas.push('  for (uint8_t i = 0; i < nSprites; i++) {   // tabla de direcciones + máscaras');
    lineas.push('    unsigned int registro = contenidoSprites + u32En(contenidoSprites + 4 * i);');
    lineas.push('    sprites[i].ancho = u16En(registro);');
    lineas.push('    sprites[i].alto = u16En(registro + 2);');
    lineas.push('    sprites[i].registro = registro;');
    lineas.push('  }');
    lineas.push('  unsigned int contenidoSegmentos = dirSegmentos + TAM_CABECERA_BLOQUE;');
    lineas.push('  for (uint8_t i = 0; i < nSegmentos; i++) { // registros fijos de 32 bytes');
    lineas.push('    unsigned int registro = contenidoSegmentos + 32 * i;');
    lineas.push('    segmentos[i].tipo = byteEn(registro);');
    lineas.push('    segmentos[i].x = u16En(registro + 1);');
    lineas.push('    segmentos[i].y = u16En(registro + 3);');
    lineas.push('    segmentos[i].sprite = byteEn(registro + 5);');
    lineas.push('  }');
    lineas.push('  return true;');
    lineas.push('}');
    lineas.push('');
    lineas.push('// ---------- Motor gráfico de fondo liso (F6-I02) ----------');
    lineas.push('void pantallaTira(int16_t x, int16_t y, int16_t longitud, uint16_t color) {');
    lineas.push('  tft.fillRect(x, y, longitud, 1, color);');
    lineas.push('}');
    lineas.push('');
    lineas.push('void pintarFondo() { tft.fillScreen(colorFondo); }');
    lineas.push('');
    lineas.push('// Pinta (o borra) un segmento: recorre la máscara de su sprite por filas y');
    lineas.push('// pinta cada tira de unos consecutivos con UNA sola orden (F6-I02).');
    lineas.push('void pintarSegmento(uint8_t i, uint16_t color) {');
    lineas.push('  if (i >= nSegmentos) return;');
    lineas.push('  uint8_t s = segmentos[i].sprite;');
    lineas.push('  if (s >= nSprites) return;');
    lineas.push('  unsigned int registro = sprites[s].registro;');
    lineas.push('  uint16_t ancho = u16En(registro), alto = u16En(registro + 2);');
    lineas.push('  unsigned int datos = registro + 4;');
    lineas.push('  uint16_t filaBytes = (ancho + 7) / 8;');
    lineas.push('  int16_t x0 = segmentos[i].x, y0 = segmentos[i].y;');
    lineas.push('  for (uint16_t fy = 0; fy < alto; fy++) {');
    lineas.push('    int16_t run = -1;');
    lineas.push('    for (uint16_t fx = 0; fx <= ancho; fx++) {');
    lineas.push('      bool uno = false;');
    lineas.push('      if (fx < ancho) {');
    lineas.push('        uno = byteEn(datos + (unsigned int)fy * filaBytes + fx / 8) & (0x80 >> (fx & 7));');
    lineas.push('      }');
    lineas.push('      if (uno && run < 0) run = fx;');
    lineas.push('      else if (!uno && run >= 0) {');
    lineas.push('        pantallaTira(x0 + run, y0 + fy, fx - run, color);');
    lineas.push('        run = -1;');
    lineas.push('      }');
    lineas.push('    }');
    lineas.push('  }');
    lineas.push('}');
    lineas.push('');
    lineas.push('// ---------- Estado y marcas (como el simulador) ----------');
    lineas.push('bool visible[MAX_ELEMENTOS];');
    lineas.push('bool cambio[MAX_ELEMENTOS];');
    lineas.push('');
    lineas.push('void mgFijarSegmento(uint8_t i, bool v) { visible[i] = v; cambio[i] = true; }');
    lineas.push('');
    lineas.push('void mgPresentar() {');
    lineas.push('  for (uint8_t i = 0; i < nSegmentos; i++) {');
    lineas.push('    if (!cambio[i]) continue;');
    lineas.push('    pintarSegmento(i, visible[i] ? NEGRO : colorFondo);');
    lineas.push('    cambio[i] = false;');
    lineas.push('  }');
    lineas.push('}');
    lineas.push('');
    lineas.push('// ---------- Motor de juego mínimo (andamiaje de F6-I02) ----------');
    lineas.push('uint8_t cursor = 0;');
    lineas.push('uint8_t esperando = 0;');
    lineas.push('');
    lineas.push('void meIniciar() {');
    lineas.push('  pintarFondo();');
    lineas.push('  cursor = 0;');
    lineas.push('  esperando = 0;');
    lineas.push('  if (SECUENCIA_N == 0) {');
    lineas.push('    Serial.println(F("Sin Secuencia en el cartucho: no hay recorrido."));');
    lineas.push('    return;');
    lineas.push('  }');
    lineas.push('  mgFijarSegmento(SECUENCIA[0], true);');
    lineas.push('  mgPresentar();');
    lineas.push('}');
    lineas.push('');
    lineas.push('void meTick() {');
    lineas.push('  if (SECUENCIA_N < 2) return;');
    lineas.push('  if (++esperando < TICKS) return;           // TICKS iteraciones por paso');
    lineas.push('  esperando = 0;');
    lineas.push('  mgFijarSegmento(SECUENCIA[cursor], false);');
    lineas.push('  cursor = (cursor + 1) % SECUENCIA_N;       // al llegar al final, vuelve a empezar');
    lineas.push('  mgFijarSegmento(SECUENCIA[cursor], true);');
    lineas.push('}');
    lineas.push('');
    lineas.push('// ---------- Director: bucle, medidas y pausa (F6-I02) ----------');
    lineas.push('unsigned long minimo = 0, acumulado = 0, maximo = 0;');
    lineas.push('unsigned long iteraciones = 0;');
    lineas.push('');
    lineas.push('unsigned long freeRam() {');
    lineas.push('  extern int __heap_start, *__brkval;');
    lineas.push('  int v;');
    lineas.push('  return (unsigned long)&v - (__brkval ? (unsigned long)__brkval : (unsigned long)&__heap_start);');
    lineas.push('}');
    lineas.push('');
    lineas.push('void setup() {');
    lineas.push('  Serial.begin(9600);');
    lineas.push('  uint16_t id = tft.readID();');
    lineas.push('  if (id == 0xD3D3) id = 0x9486;             // shield de solo escritura: ID fijo');
    lineas.push('  tft.begin(id);');
    lineas.push('  // La resolución del GWC es la del setup: debe coincidir con la pantalla (F6-I02).');
    lineas.push('  tft.setRotation(anchoPantalla > altoPantalla ? 1 : 0);');
    lineas.push('  if (!validarCartucho()) {');
    lineas.push('    Serial.println(F("GWC no valido: revisa el .h"));');
    lineas.push('    while (1) {}');
    lineas.push('  }');
    lineas.push('  if (!parsearCartucho()) {');
    lineas.push('    Serial.println(F("GWC no se interpreta"));');
    lineas.push('    while (1) {}');
    lineas.push('  }');
    lineas.push('  Serial.print(F("Cartucho: "));');
    lineas.push('  Serial.print(nSprites);');
    lineas.push('  Serial.print(F(" sprites, "));');
    lineas.push('  Serial.print(nSegmentos);');
    lineas.push('  Serial.print(F(" segmentos, pantalla "));');
    lineas.push('  Serial.print(anchoPantalla);');
    lineas.push('  Serial.print(F("x"));');
    lineas.push('  Serial.println(altoPantalla);');
    lineas.push('  minimo = ~0L;');
    lineas.push('  meIniciar();');
    lineas.push('}');
    lineas.push('');
    lineas.push('void loop() {');
    lineas.push('  unsigned long t0 = micros();');
    lineas.push('  meTick();');
    lineas.push('  mgPresentar();');
    lineas.push('  unsigned long t = micros() - t0;');
    lineas.push('  if (t < minimo) minimo = t;');
    lineas.push('  acumulado += t;');
    lineas.push('  if (t > maximo) maximo = t;');
    lineas.push('  iteraciones++;');
    lineas.push('  if (iteraciones % 20 == 0) {               // resumen cada 20 iteraciones (F6-I02)');
    lineas.push('    Serial.print(F("iter "));');
    lineas.push('    Serial.print(iteraciones);');
    lineas.push('    Serial.print(F("  us min/med/max: "));');
    lineas.push('    Serial.print(minimo);');
    lineas.push('    Serial.print(F("/"));');
    lineas.push('    Serial.print(acumulado / 20);');
    lineas.push('    Serial.print(F("/"));');
    lineas.push('    Serial.print(maximo);');
    lineas.push('    Serial.print(F("  RAM libre: "));');
    lineas.push('    Serial.println(freeRam());');
    lineas.push('    acumulado = 0;');
    lineas.push('    minimo = ~0L;');
    lineas.push('    maximo = 0;');
    lineas.push('  }');
    lineas.push('  delay(PAUSA_MS);');
    lineas.push('}');
    return lineas.join('\n') + '\n';
  }

  /**
   * El clic del botón «Generar»: Mega + Prueba genera los DOS ficheros de
   * la prueba (F6-I04); cualquier otra combinación avisa y no genera nada.
   * @returns {void}
   */
  function _alGenerar() {
    if (!nota) return;
    const destino = selDestino ? selDestino.value : null;
    const etapa = selEtapa ? selEtapa.value : null;
    if (destino !== 'mega' || etapa !== 'prueba') {
      nota.textContent = 'Nada que generar en este momento: solo Mega + Prueba tiene contenido (F6-I04).';
      return;
    }
    let p;
    try {
      p = baseDescomponer.prepararGWC({ conFondo: false });
    } catch (e) {
      console.error(e);
      baseDirector.avisarError('No se generó la prueba del Mega: ' + e.message);
      return;
    }
    if (!p) return;                          // cambios sin aplicar: ya se avisó
    const id = _identificador(p.json.nombre || 'cartucho');
    const nombreH = id + '_gwc.h';
    const nombreIno = id + '_prueba_mega.ino';
    basePack.descargarBlob(new Blob([_textoH(p.gwc, id)], { type: 'text/plain' }), nombreH);
    basePack.descargarBlob(new Blob([_textoIno(p, id)], { type: 'text/plain' }), nombreIno);
    baseDirector.avisar('Generados ' + nombreH + ' y ' + nombreIno +
      ' (prueba del Mega): ' + baseCartucho.estadistica(p.gwc));
    nota.textContent = 'Generados ' + nombreH + ' y ' + nombreIno +
      ': el .ino en una carpeta con SU MISMO nombre y el .h a su lado.';
  }

  /**
   * Construye la ficha (la primera vez) en el contenedor y cablea el botón
   * «Generar» de la barra (F6-I04), que vive en index.html.
   * @param {HTMLElement} contenedor - El #fichaGenerador de la vista.
   * @returns {void}
   */
  function pintar(contenedor) {
    if (!contenedor) return;
    if (raiz && raiz.parentNode === contenedor) return;   // ya construida
    contenedor.innerHTML = '';
    raiz = _crearElemento('div', 'fichaSeccion');
    raiz.appendChild(_crearElemento('h3', null, 'Generador'));

    const rejilla = _crearElemento('div', 'fichaRejilla');
    selDestino = document.createElement('select');
    selDestino.id = 'genDestino';
    _lleno(selDestino, DESTINOS);
    _campo(rejilla, 'Destino', selDestino, 'El sistema para el que se genera.');
    selEtapa = document.createElement('select');
    selEtapa.id = 'genEtapa';
    _lleno(selEtapa, ETAPAS);
    _campo(rejilla, 'Etapa', selEtapa, 'Prueba: los cartuchos y el programa de la prueba. Completa: el juego entero.');
    raiz.appendChild(rejilla);

    nota = _crearElemento('p', 'fichaNota',
      'Prepara la generación para el destino y la etapa elegidos. Mega + Prueba genera la primera prueba del Mega (F6-I02).');
    nota.id = 'genNota';
    raiz.appendChild(nota);
    contenedor.appendChild(raiz);

    const btn = document.getElementById('btnGeneradorGenerar');
    if (btn) btn.addEventListener('click', _alGenerar);
  }

  /**
   * La selección vigente de la ficha.
   * @returns {{destino:string, etapa:string}|null} Los valores, o null si la ficha no está construida.
   */
  function estado() {
    if (!selDestino || !selEtapa) return null;
    return { destino: selDestino.value, etapa: selEtapa.value };
  }

  return {
    pintar: pintar,
    estado: estado
  };

})();
