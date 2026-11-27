// pruebas/pruebasGenerales.js — Pruebas generales: GWC (CRC, lector) y ColorFondo
// ================================================================================================
// PROPÓSITO
//   Comprobaciones del formato GWC y del ColorFondo que no dependen de un cartucho concreto
//   (F5-I14). Las dos primeras montan su propio cartucho de laboratorio y no tocan nada; la
//   tercera carga cartuchos para ver la ficha y el pintado, y por eso sustituye el cartucho cargado.
//
// PRUEBAS (grupo «generales»)
//   G1 CRC y lector del GWC   Se genera y se lee; el CRC frente al cálculo independiente (vector
//                             «123456789» = 0x29B1) y detección de bytes intercambiados; errores
//                             claros del lector ante datos fuera de rango (con el CRC reparado, para
//                             que lo único que falle sea la validación).
//   G2 ColorFondo en el GWC   Fondo por defecto, viaje del ColorFondo, huella en el Código GWC, bit
//                             «combinar» en el Bloque 0 y tamaños de los Bloques 0 y 1.
//   G3 ColorFondo (ficha GWB) Destructiva: la ficha entrega el ColorFondo (el blanco no viaja) y un
//                             GWB sin img_f lo guarda y pinta el fondo con él.
//   G4 Bloque 5 Fondo (A02)   El fondo de img_f viaja como PNG YA escalado a la
//                             pantalla declarada (mismo registro que los sprites); sin fondo, el
//                             bloque no existe; el factor de escalado es declarada/img_f.
//
// FUNCIONES
//   _pruebaCrcYLector         Prueba «G1 CRC y lector del GWC».
//   _pruebaColorFondo         Prueba «G2 ColorFondo en el GWC».
//   _pruebaColorFondoFicha    Prueba «G3 ColorFondo (ficha y GWB)».
//   _pruebaFondoGWC           Prueba «G4 Bloque 5 Fondo (A02)».
//
// USO
//   Pestaña «Pruebas» (index.html por servidor local con GW_DEBUG) o, en consola:
//     pruebas\Lanzar.bat generales
// ================================================================================================
'use strict';

(function () {
  if (typeof Pruebas === 'undefined') return;     // en Node solo cuenta el lanzador del final

  function _pruebaCrcYLector() {
    const out = [];
    const ok = (n, c, x) => out.push([n, !!c, x === undefined ? '' : String(x)]);
    const { json: j, sprites, pantalla: pant } = Pruebas.util.cartuchoLaboratorio();

    const g0 = baseCartucho.generarGWC(j, sprites, pant);
    ok('G1: GWC genera y se lee', baseCartucho.leerGWC(g0.bytes).segmentos.length === 3);

    const b = g0.bytes.slice();
    let i1 = -1, i2 = -1;
    for (let i = 14; i < b.length && i2 < 0; i++)
      for (let k = i + 1; k < b.length; k++) if (b[i] !== b[k]) { i1 = i; i2 = k; break; }
    const t = b[i1]; b[i1] = b[i2]; b[i2] = t;
    let msg = ''; try { baseCartucho.leerGWC(b); } catch (e) { msg = e.message; }
    ok('G1: CRC detecta bytes intercambiados (la suma aditiva no)', /CRC/.test(msg), msg);

    ok('G1: fondo por defecto blanco', baseCartucho.leerGWC(g0.bytes).fondo === '#FFFFFF');
    ok('G1: CRC del test = CRC del módulo', g0.codigo === Pruebas.util.codigoCRC(g0.bytes), g0.codigo);
    ok('G1: vector 123456789 = 0x29B1',
      Pruebas.util.crc16(new TextEncoder().encode('123456789')) === 0x29B1);

    const reparar = (bytes) => {
      const txt = Pruebas.util.codigoCRC(bytes);
      for (let k = 0; k < 6; k++) bytes[4 + k] = txt.charCodeAt(k);
      return bytes;
    };
    const falla = (nombre, mut, re) => {
      const c = g0.bytes.slice(); mut(c); reparar(c);
      let m = ''; try { baseCartucho.leerGWC(c); } catch (e) { m = e.message; }
      ok(nombre, re.test(m), m || '(no falló)');
    };
    const dv = new DataView(g0.bytes.buffer);
    const dir = (n) => dv.getUint32(14 + 5 + 12 + n * 4, true);
    const regSeg0 = dir(3) + 5;
    falla('G1: sprite fuera de rango', c => { c[regSeg0 + 5] = 9; }, /sprite 9/);
    falla('G1: enlace fuera de rango', c => { c[regSeg0 + 6] = 50; }, /segmento 50/);
    const secIni = dir(4) + 5;
    falla('G1: Secuencia con segmento fuera de rango', c => { c[secIni + 1] = 77; },
      /Secuencia usa el segmento 77/);
    const cfgIni = dir(1) + 5;
    falla('G1: mecanismo de fin desconocido', c => { c[cfgIni + 12] = 9; c[cfgIni + 13] = 0; },
      /fin desconocido/);
    falla('G1: tabla de sprites que no cabe', c => { c[14 + 5 + 5] = 250; }, /sprite|segmento/);
    return out;
  }


  function _pruebaColorFondo() {
    const out = [];
    const ok = (n, c, x) => out.push([n, !!c, x === undefined ? '' : String(x)]);
    const { json: j, sprites, pantalla: pant } = Pruebas.util.cartuchoLaboratorio();

    const g0 = baseCartucho.generarGWC(j, sprites, pant);
    const g1 = baseCartucho.generarGWC(Object.assign({}, j, { ColorFondo: '#336699' }),
      sprites, pant);
    const l1 = baseCartucho.leerGWC(g1.bytes);
    ok('G2: ColorFondo viaja al GWC', l1.fondo === '#336699', l1.fondo);
    ok('G2: ColorFondo cambia el código del GWC', g0.codigo !== g1.codigo,
      g0.codigo + ' / ' + g1.codigo);
    // F5-I14 (P06): el bit «combinar» viaja en el Bloque 0 (36 bytes); el Bloque 1 mide 16.
    const gc = baseCartucho.generarGWC(Object.assign({}, j, { combinar: true }), sprites, pant);
    ok('G2: combinar viaja en el Bloque 0',
      baseCartucho.leerGWC(gc.bytes).combinar === true && baseCartucho.leerGWC(g0.bytes).combinar === false);
    const dv = new DataView(g0.bytes.buffer);
    ok('G2: Bloque 0 de 36 bytes y Bloque 1 de 16 bytes',
      dv.getUint32(14 + 1, true) === 36 && dv.getUint32(14 + 5 + 36 + 1, true) === 16);
    return out;
  }


  async function _pruebaColorFondoFicha(opc) {
    const U = Pruebas.util;
    const out = [];
    const ok = (n, c, x) => out.push([n, !!c, x === undefined ? '' : String(x)]);
    // La ficha entrega el ColorFondo; el blanco no viaja.
    baseFicha.poblar({ colorFondo: '#336699' });
    const ficha = { e: baseFicha.estado().colorFondo, d: baseFicha.datosCartucho().colorFondo };
    ok('G3: la ficha entrega ColorFondo', ficha.e === '#336699' && ficha.d === '#336699', JSON.stringify(ficha));
    baseFicha.poblar({ colorFondo: '#ffffff' });
    ok('G3: blanco no viaja', baseFicha.estado().colorFondo === null);

    // Un GWB sin img_f y con ColorFondo: el canvas se pinta de ese color.
    await U.cargarEn('ficheroCartucho', [U.fichero('setup2.json', await U.traerBytes('pruebas/cartuchos/setup2.json'))], 500);
    const c = document.createElement('canvas'); c.width = 40; c.height = 30;
    const g = c.getContext('2d'); g.fillStyle = '#fff'; g.fillRect(0, 0, 40, 30);
    const png = await new Promise(r => c.toBlob(r, 'image/png'));
    const json = { tipo: 'GWB', version: 1, nombre: 'cf', estilo: '2', ColorFondo: '#336699',
      imagenes: { img_s: 'img_s.png' }, botones: [] };
    const zip = new JSZip();
    zip.file('cartucho_GWB.json', JSON.stringify(json));
    zip.file('img_s.png', await png.arrayBuffer());
    const bytes = await zip.generateAsync({ type: 'uint8array' });
    await U.cargarEn('ficheroCartucho', [U.fichero('cf.zip', bytes)], 1500);
    const pintado = { cf: baseDirector.colorFondo(), ficha: baseFicha.estado().colorFondo };
    ok('G3: GWB sin img_f guarda el ColorFondo', pintado.cf === '#336699' && pintado.ficha === '#336699', JSON.stringify(pintado));
    return out;
  }

  function _pruebaFondoGWC() {
    const out = [];
    const ok = (n, c, x) => out.push([n, !!c, x === undefined ? '' : String(x)]);
    const { json: j, sprites, pantalla: pant } = Pruebas.util.cartuchoLaboratorio();
    const dirFondo = (gwc) => new DataView(gwc.bytes.buffer).getUint32(14 + 5 + 12 + 5 * 4, true);
    const esPNG = (b) => !!b && b.length > 24 && b[0] === 0x89 && b[1] === 0x50 &&
      b[2] === 0x4E && b[3] === 0x47 && b[4] === 0x0D && b[5] === 0x0A &&
      b[6] === 0x1A && b[7] === 0x0A;
    const dimsIHDR = (b) => ({
      ancho: (b[16] << 24) | (b[17] << 16) | (b[18] << 8) | b[19],
      alto: (b[20] << 24) | (b[21] << 16) | (b[22] << 8) | b[23]
    });

    // 1) Sin fondo: el Bloque 5 no existe y su dirección del Bloque 0 va a nulo.
    const g0 = baseCartucho.generarGWC(j, sprites, pant);
    ok('G4: sin fondo, el Bloque 5 no existe (dirección a nulo)',
      dirFondo(g0) === 0xFFFFFFFF && g0.bloques.fondo === 0 &&
      baseCartucho.leerGWC(g0.bytes).fondoImagen === null, dirFondo(g0));

    // 2) Con fondo del tamaño declarado: el Bloque 5 viaja con los bytes PNG
    //    de la img_f (formato PROVISIONAL, F6 lo cambiará por el del ESP32).
    const fondo = document.createElement('canvas');
    fondo.width = 320; fondo.height = 240;
    const gg = fondo.getContext('2d');
    gg.fillStyle = '#FFFFFF'; gg.fillRect(0, 0, 320, 240);
    gg.fillStyle = '#000'; gg.fillRect(10, 10, 40, 20);
    const g1 = baseCartucho.generarGWC(j, sprites, pant, fondo);
    const l1 = baseCartucho.leerGWC(g1.bytes);
    const d1 = l1.fondoImagen && dimsIHDR(l1.fondoImagen.bytes);
    ok('G4: con fondo, el Bloque 5 viaja con un PNG a la resolución declarada',
      dirFondo(g1) !== 0xFFFFFFFF && !!l1.fondoImagen && esPNG(l1.fondoImagen.bytes) &&
      d1.ancho === 320 && d1.alto === 240,
      l1.fondoImagen ? (l1.fondoImagen.bytes.length + ' bytes, ' + d1.ancho + 'x' + d1.alto) : '(sin fondo)');
    ok('G4: el tamaño del bloque es el del PNG más la cabecera del bloque',
      !!l1.fondoImagen && g1.bloques.fondo === 5 + l1.fondoImagen.bytes.length,
      g1.bloques.fondo + ' vs ' + (l1.fondoImagen ? 5 + l1.fondoImagen.bytes.length : '?'));
    ok('G4: el fondo entra bajo el CRC y en la estadística',
      g1.codigo !== g0.codigo && g1.bytes.length > g0.bytes.length &&
      baseCartucho.estadistica(g1).includes('Fondo ' + g1.bloques.fondo),
      baseCartucho.estadistica(g1));

    // 3) Fondo en tamaño ORIGINAL distinto de la declarada (un GWB descompuesto):
    //    el generador lo escala A la declarada antes de empaquetar el PNG
    //    (la fuente del escalado es la propia img_f, nunca img_s).
    const fondo2 = document.createElement('canvas');
    fondo2.width = 160; fondo2.height = 120;
    const gg2 = fondo2.getContext('2d');
    gg2.fillStyle = '#FFFFFF'; gg2.fillRect(0, 0, 160, 120);
    gg2.fillStyle = '#000'; gg2.fillRect(10, 10, 20, 10);
    const f2 = baseCartucho.leerGWC(baseCartucho.generarGWC(j, sprites, pant, fondo2).bytes).fondoImagen;
    const d2 = f2 && dimsIHDR(f2.bytes);
    ok('G4: fondo más pequeño que la declarada se escala A la declarada',
      !!f2 && esPNG(f2.bytes) && d2.ancho === 320 && d2.alto === 240,
      f2 ? (d2.ancho + 'x' + d2.alto) : '(sin fondo)');
    return out;
  }

  Pruebas.registrar([
    { id: 'crcLector', grupo: 'generales', nombre: 'G1 CRC y lector del GWC', ejecutar: () => _pruebaCrcYLector() },
    { id: 'colorFondo', grupo: 'generales', nombre: 'G2 ColorFondo en el GWC', ejecutar: () => _pruebaColorFondo() },
    { id: 'colorFondoFicha', grupo: 'generales', nombre: 'G3 ColorFondo (ficha y GWB)', destructiva: true,
      ejecutar: (o) => _pruebaColorFondoFicha(o) },
    { id: 'fondoGWC', grupo: 'generales', nombre: 'G4 Bloque 5 Fondo (A02)', ejecutar: () => _pruebaFondoGWC() }
  ]);
})();

if (typeof require !== 'undefined' && typeof module !== 'undefined' && require.main === module)
  require('./lanzador.js').lanzar('generales');
