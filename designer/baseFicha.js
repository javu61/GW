'use strict';

// baseFicha.js
// ====================================================================================================
// PROPÓSITO
//   La pestaña «Cartucho» (F5-I10): la ficha del cartucho, FUENTE
//   ÚNICA de sus datos (nombre, estilo, resolución, imágenes; F5-I21:
//   los botones YA NO se editan aquí — los cartuchos los llevan con
//   los nombres de campo y los datos de la pestaña Setup). Todo lo que
//   se carga la rellena (poblar) y todo lo que se guarda sale de ella:
//   el GWB directamente y el GWI/GWC a través de datosCartucho. Con
//   segmentos en memoria la imagen img_s se bloquea (los segmentos
//   salen de ella).
//
// QUÉ MUESTRA
//   - Datos del cartucho: nombre, estilo y resolución (ancho × alto). En
//     un GWB estilo y resolución son OPCIONALES (si faltan, manda el
//     GWS); en el GWI/GWC se completan con los del setup cargado.
//   - Imágenes: una tarjeta por img_s (obligatoria), img_f e img_m
//     (opcionales) con miniatura, nombre, tamaño y los botones
//     «Cargar…» y «Borrar».
//   - Botones (F5-I21): ya no se muestran ni se editan en la ficha.
//     Los cartuchos (GWB, GWI) siguen llevándolos, pero con los nombres
//     de campo y los datos del Setup (numero, puerto, tecla,
//     textoPantalla): se cambian en la pestaña Setup (columna «Texto
//     Pantalla»).
//   - Memoria (F5-I20, MA02): «RAM (KB)» y «FLASH (KB)», opcionales (vacío = 0):
//     si el cartucho las declara mandan sobre las del setup al informar de
//     la ocupación; se escriben en el GWB/GWI solo si no son 0.
//
// SEPARACIÓN
//   No conoce al descomponedor: solo pinta y guarda el estado de la
//   ficha en el DOM y en variables propias. El director la rellena
//   (poblar, ponerImagen) y consulta si hay cambios sin aplicar
//   (hayCambios); la ficha es un BORRADOR hasta que se pulsa Aplicar.
//   Se construye UNA vez y conserva lo escrito entre visitas.
//
// FUNCIONES
//  Pantalla
//    pintar             Construye la ficha (la primera vez) en el contenedor.
//    reiniciar          Deja la ficha en blanco.
//    poblar             Rellena campos e imágenes desde una carga.
//    ponerImagen        Pone (o quita) una imagen sin avisar al director.
//    actualizarCodigoGWC F5-I17 (M1): refresca el «Código GWC» de solo lectura.
//  Lectura
//    estado             Lee los datos de la ficha tal cual (sin completar).
//    datosCartucho      Datos para guardar GWI/GWC (completados con el setup).
//    imagenesEnMemoria  Las tres imágenes {img_s, img_f, img_m}.
//  Aplicar (F5-I12)
//    hayCambios         ¿Hay cambios sin aplicar (borrador)?
//    marcarAplicado     Da la ficha por aplicada (apaga el aviso).
//    ficherosGWB        Los ficheros del GWB de la ficha, en memoria.
//  Verificación y GWB
//    verificar          Comprueba que la ficha esté completa y correcta.
//    guardar            Verifica y, si todo está bien, genera cartucho_GWB.
//  Internas
//    _marcarCambios      _asegurar               _crearElemento
//    _montarGWB              _pintarMensajes
//    _pixelesNoBN        _crearTarjetaImagen     _cargarImagen           
//    _colocarImagen      _vaciarImagen           _refrescarBotonesImagen
//    _miniaturaDe        _botonesDelSetup        _campo
//    _memoriaDelSetup
//    _entrada            _esColor            _liberar                _construir
// ====================================================================================================

const baseFicha = (function () {

  // F5-I21: la ficha del Cartucho ya no define botones: los que viajan
  // en el GWB y el GWI son los del Setup (ver _botonesDelSetup).

  const COLOR_BLANCO = '#ffffff';  // ColorFondo por defecto (no viaja en el cartucho)

  const IMAGENES = [
    {
      clave: 'img_s', titulo: 'Segmentos (img_s)', obligatoria: true,
      ayuda: 'Blanco y negro; de ella se extrae la geometría.'
    },
    {
      clave: 'img_f', titulo: 'Fondo (img_f)', obligatoria: false,
      ayuda: 'Fondo fijo de la pantalla.'
    },
    {
      clave: 'img_m', titulo: 'Portada (img_m)', obligatoria: false,
      ayuda: 'Imagen de portada del cartucho.'
    }
  ];

  let raiz = null;                // contenedor ya construido
  let campos = {};                // nombre, estilo, ancho, alto
  let imagenes = {};              // clave → {img, nombre, url, ui:{...}}
  let mensajes = null;            // zona de errores/avisos
  let extras = {};                // combinar/etiquetas del GWB cargado (se conservan al guardar)
  let sucio = false;              // F5-I12: hay cambios sin aplicar (la ficha es un borrador)
  let avisoCambios = null;        // línea «cambios sin aplicar»

  /** Crea un elemento con clase y texto opcionales.  
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

 /** Añade una fila «caption + control (+ nota)» a la rejilla. 
   * @param {HTMLElement} padre - Elemento donde se añade la fila.
   * @param {string} caption - Texto de la etiqueta.
   * @param {HTMLElement} control - Control (input, select, textarea...).
   * @param {string} [nota] - Nota opcional.
   * @param {boolean} [multilinea=false] - true si el control es multilinea, por defecto es false.
   * @returns {HTMLElement} El control añadido.
  */
  function _campo(padre, caption, control, nota, multilinea = false) {
    const lbl = _crearElemento('div', 'fichaCaption', caption);
    const celda = _crearElemento('div', 'fichaCampo');

    if (multilinea) {
      // Si no pasas un control o pasas un input normal, creamos un textarea
      if (!control || control.tagName !== 'TEXTAREA') {
        control = _crearElemento('textarea');
      }
      control.rows = 3;
      lbl.classList.add('multilinea');   // Clase extra por si quieres alinear arriba
      celda.classList.add('multilinea'); // Clase extra para que ocupe más ancho si quieres
    }

    celda.appendChild(control);
    if (nota) celda.appendChild(_crearElemento('span', 'fichaNota', nota));

    padre.appendChild(lbl);
    padre.appendChild(celda);
    return control;
  }

  /** ¿Es un color «#RRGGBB»? */
  function _esColor(v) {
    return typeof v === 'string' && /^#[0-9A-Fa-f]{6}$/.test(v);
  }

  function _entrada(tipo, extra) {
    const i = document.createElement('input');
    i.type = tipo;
    if (extra) Object.assign(i, extra);
    return i;
  }

  // ---------------- Imágenes ----------------

  /**
   * Construye la tarjeta de una imagen: miniatura, datos y botones.
   * @param {{clave:string,titulo:string,obligatoria:boolean,ayuda:string}} def
   * @returns {HTMLElement} La tarjeta.
   */
  function _crearTarjetaImagen(def) {
    const tarjeta = _crearElemento('div', 'fichaImagen');
    tarjeta.appendChild(_crearElemento('h4', null, def.titulo +
      (def.obligatoria ? ' *' : '')));
    const marco = _crearElemento('div', 'fichaMarco');
    const miniatura = _crearElemento('img', 'fichaMiniatura oculto');
    miniatura.alt = def.titulo;
    const vacio = _crearElemento('span', 'fichaVacio', 'Sin imagen');
    marco.append(miniatura, vacio);
    const info = _crearElemento('div', 'fichaNota', def.ayuda);
    const fichero = _entrada('file', { accept: 'image/png' });
    fichero.className = 'oculto';
    const cargar = _crearElemento('button', null, 'Cargar…');
    cargar.type = 'button';
    const borrar = _crearElemento('button', null, 'Borrar');
    borrar.type = 'button';
    borrar.disabled = true;
    const acciones = _crearElemento('div', 'fichaAcciones');
    acciones.append(cargar, borrar);
    tarjeta.append(marco, info, acciones, fichero);

    imagenes[def.clave] = {
      img: null, nombre: null, url: null,
      ui: { miniatura, vacio, info, cargar, borrar, ayuda: def.ayuda }
    };

    cargar.addEventListener('click', () => fichero.click());
    fichero.addEventListener('change', () => {
      if (fichero.files && fichero.files[0]) _cargarImagen(def.clave, fichero.files[0]);
      fichero.value = '';            // permite volver a elegir el mismo fichero
    });
    borrar.addEventListener('click', () => {
      _vaciarImagen(def.clave);
      _marcarCambios(true);
    });
    return tarjeta;
  }

  /**
   * Miniatura (data URL) de una imagen ya cargada: no depende de la
   * object URL de origen, que el director puede revocar.
   * @param {HTMLImageElement} img - Imagen cargada.
   * @returns {string} Data URL PNG.
   */
  function _miniaturaDe(img) {
    const c = document.createElement('canvas');
    c.width = img.naturalWidth; c.height = img.naturalHeight;
    c.getContext('2d').drawImage(img, 0, 0);
    return c.toDataURL('image/png');
  }

  /**
   * Habilita/deshabilita Cargar y Borrar de una tarjeta: Borrar solo
   * con imagen, y en img_s ambos se bloquean si hay segmentos.
   * @param {string} clave - 'img_s', 'img_f' o 'img_m'.
   * @returns {void}
   */
  function _refrescarBotonesImagen(clave) {
    const d = imagenes[clave];
    if (!d) return;
    d.ui.borrar.disabled = !d.img;
  }

  /**
   * Muestra una imagen ya cargada en su tarjeta.
   * @param {string} clave - 'img_s', 'img_f' o 'img_m'.
   * @param {HTMLImageElement} img - Imagen cargada.
   * @param {string} nombre - Nombre a mostrar.
   * @param {?string} url - Object URL propia (se libera al sustituirla).
   * @returns {void}
   */
  function _colocarImagen(clave, img, nombre, url) {
    const datos = imagenes[clave];
    _liberar(clave);
    datos.img = img;
    datos.nombre = nombre;
    datos.url = url || null;
    datos.ui.miniatura.src = _miniaturaDe(img);
    datos.ui.miniatura.classList.remove('oculto');
    datos.ui.vacio.classList.add('oculto');
    datos.ui.info.textContent = nombre + ' — ' +
      img.naturalWidth + '×' + img.naturalHeight + ' px';
    _refrescarBotonesImagen(clave);
  }

  /**
   * Carga un fichero PNG elegido por el usuario en la tarjeta, lo
   * muestra y avisa del cambio.
   * @param {string} clave - 'img_s', 'img_f' o 'img_m'.
   * @param {File} fichero - El PNG elegido.
   * @returns {void}
   */
  function _cargarImagen(clave, fichero) {
    const url = URL.createObjectURL(fichero);
    const img = new Image();
    img.onload = () => {
      _colocarImagen(clave, img, fichero.name, url);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      if (typeof baseDirector !== 'undefined') {
        baseDirector.avisarError('No se pudo leer la imagen ' + fichero.name + '.');
      }
    };
    img.src = url;
  }

  /** Libera la URL de objeto de una imagen cargada (si la hay). */
  function _liberar(clave) {
    const datos = imagenes[clave];
    if (datos.url) URL.revokeObjectURL(datos.url);
    datos.url = null;
  }

  /**
   * Quita la imagen de una tarjeta (sin avisar al director). Guardar un
   * GWB sin img_s es un error, pero se avisa al guardar, no aquí.
   * @param {string} clave - 'img_s', 'img_f' o 'img_m'.
   * @returns {void}
   */
  function _vaciarImagen(clave) {
    const datos = imagenes[clave];
    _liberar(clave);
    datos.img = null;
    datos.nombre = null;
    datos.ui.miniatura.removeAttribute('src');
    datos.ui.miniatura.classList.add('oculto');
    datos.ui.vacio.classList.remove('oculto');
    datos.ui.info.textContent = datos.ui.ayuda;
    _refrescarBotonesImagen(clave);
  }

  // ---------------- Botones (F5-I21) ----------------

  /**
   * F5-I21: los botones que viajan en los cartuchos (GWB y GWI) son los
   * del SETUP, con sus nombres de campo y sus datos (numero, puerto,
   * tecla y textoPantalla — el «Texto Pantalla»). En la ficha NO se editan: se
   * cambian en la pestaña Setup y el Aplicar de ésta los pone en
   * marcha. Copia profunda para que nadie toque el setup en memoria.
   * @returns {Array} Los botones del setup cargado ([] si no hay setup).
   */
  function _botonesDelSetup() {
    return (typeof baseDirector !== 'undefined' && baseDirector.botonesDeSetup)
      ? baseDirector.botonesDeSetup() : [];
  }

  // ---------------- Construcción ----------------

  /**
   * F5-I21: enlace a la pestaña natural del dato (la pestaña Setup, hoy
   * el único caso): lo muestra el campo de solo lectura. Lo pinta el
   * director vía su export pestanna.
   * @param {HTMLElement} control - El control o fila del campo de solo
   *        lectura (su celda recibe el enlace).
   * @returns {void}
   */
  function _enlacePestanaNatural(control) {
    const celda = control.parentElement;
    if (!celda) return;
    const boton = document.createElement('button');
    boton.type = 'button';
    boton.textContent = 'Se cambia en Setup';
    boton.className = 'fichaNota';
    boton.style.display = 'inline-block';
    boton.style.marginTop = '4px';
    boton.addEventListener('click', () => {
      if (typeof baseDirector !== 'undefined' && baseDirector.pestanna) {
        baseDirector.pestanna('vistaSetup');
      }
    });
    celda.appendChild(boton);
  }

  /** Construye toda la ficha dentro de `contenedor`. */
  function _construir(contenedor) {
    contenedor.textContent = '';

    // Datos del GWB
    const datos = _crearElemento('section', 'fichaSeccion');
    datos.appendChild(_crearElemento('h3', null, 'Datos del GWB'));
    const rejilla = _crearElemento('div', 'fichaRejilla');
    campos.nombre = _campo(rejilla, 'Nombre del Cartucho', _entrada('text', { placeholder: 'Nombre del cartucho' }));
    // F5-I17 (M13): descripción del cartucho (opcional), mismo significado
    // que en el GWS; viaja a nivel superior en GWB y GWI (el GWC no lleva
    // textos). Su uso en pantalla llegará con el selector de máquinas.
    campos.descripcion = _campo(rejilla,
      'Descripción del Cartucho',
      _entrada('text', { placeholder: 'Para qué es esta máquina' }),
      'informativa',
      true);
    const estilo = document.createElement('select');
    for (const [valor, texto] of [['', '(sin definir)'], ['2', '2 botones'],
    ['4', '4 botones'], ['5', '5 botones']]) {
      const o = document.createElement('option');
      o.value = valor; o.textContent = texto;
      estilo.appendChild(o);
    }
    // F5-I21: estilo y resolución SOLO se editan en su pestaña natural
    // (Setup); aquí se muestran de solo lectura, con el aviso y el
    // acceso a la pestaña donde se editan.
    estilo.disabled = true;
    campos.estilo = _campo(rejilla, 'Estilo', estilo,
      'Solo lectura: se cambia en Setup.');
    _enlacePestanaNatural(estilo);
    const par = _crearElemento('div', 'fichaPar');
    campos.ancho = _entrada('number', { min: 1, step: 1, placeholder: 'ancho', readOnly: true });
    campos.alto = _entrada('number', { min: 1, step: 1, placeholder: 'alto', readOnly: true });
    par.append(campos.ancho, _crearElemento('span', null, '×'), campos.alto);
    _campo(rejilla, 'Resolución', par,
      'Solo lectura: se cambia en Setup.');
    _enlacePestanaNatural(par);
    campos.colorFondo = _entrada('color', { value: COLOR_BLANCO });
    _campo(rejilla, 'Color de fondo', campos.colorFondo,
      'Se usa si no hay img_f (blanco por defecto).');
    // F5-I17 (M1): el Código GWC del par, visible (solo lectura):
    // «---» si el GWI cargado no lo trae; se refresca al generar.
    campos.codigoGWC = _entrada('text', { value: '---', readOnly: true });
    campos.codigoGWC.style.width = '6em';
    _campo(rejilla, 'Código GWC', campos.codigoGWC,
      'Solo lectura: el código #HHHH# del par (lo estampa Generar GWI+GWC).');
    datos.appendChild(rejilla);
    contenedor.appendChild(datos);

    // Imágenes
    const seccionImg = _crearElemento('section', 'fichaSeccion');
    seccionImg.appendChild(_crearElemento('h3', null, 'Imágenes'));
    const fila = _crearElemento('div', 'fichaImagenes');
    for (const def of IMAGENES) fila.appendChild(_crearTarjetaImagen(def));
    seccionImg.appendChild(fila);
    seccionImg.appendChild(_crearElemento('p', 'fichaNota', '* obligatoria para guardar el GWB.'));
    contenedor.appendChild(seccionImg);

    // F5-I21: sin sección de botones: se editan en la pestaña Setup y
    // viajan a los cartuchos con los datos de aquélla.

    // Mensajes de verificación (los botones Aplicar y Guardar GWB están
    // en la pestaña, F5-I12) y el aviso de cambios sin aplicar.
    mensajes = _crearElemento('div', 'fichaMensajes');
    avisoCambios = _crearElemento('p', 'fichaAviso oculto',
      'Hay cambios sin aplicar: pulsa Aplicar para que pasen al editor y al simulador.');
    contenedor.insertBefore(avisoCambios, contenedor.firstChild);
    contenedor.appendChild(mensajes);
    // Toda edición del usuario (escribir, elegir, marcar, cargar o borrar
    // una imagen) deja la ficha como borrador hasta el siguiente Aplicar.
    const marcar = () => _marcarCambios(true);
    contenedor.addEventListener('input', marcar);
    contenedor.addEventListener('change', marcar);

  }

  // ---------------- Verificación y guardado ----------------

  /** Muestra errores (rojo) y avisos (ámbar) bajo la ficha. */
  function _pintarMensajes(errores, avisos) {
    mensajes.textContent = '';
    if (errores.length > 0) {
      mensajes.appendChild(_crearElemento('strong', 'fichaError', 'La ficha tiene errores:'));
    }
    const lista = _crearElemento('ul');
    for (const t of errores) lista.appendChild(_crearElemento('li', 'fichaError', t));
    for (const t of avisos) lista.appendChild(_crearElemento('li', 'fichaAviso', 'Aviso: ' + t));
    if (lista.children.length > 0) mensajes.appendChild(lista);
  }

  /**
   * Cuántos píxeles de la imagen NO son blanco o negro puros (solo
   * canales RGB). 0 = blanco y negro. Sirve para avisar de
   * antialiasing en img_s.
   * @param {HTMLImageElement} img - Imagen.
   * @returns {number} Píxeles que no son blanco/negro puros.
   */
  function _pixelesNoBN(img) {
    const c = document.createElement('canvas');
    c.width = img.naturalWidth; c.height = img.naturalHeight;
    const g = c.getContext('2d', { willReadFrequently: true });
    g.drawImage(img, 0, 0);
    const d = g.getImageData(0, 0, c.width, c.height).data;
    let n = 0;
    for (let i = 0; i < d.length; i += 4) {
      const r = d[i], gg = d[i + 1], b = d[i + 2];
      if (!((r === 0 && gg === 0 && b === 0) || (r === 255 && gg === 255 && b === 255))) n++;
    }
    return n;
  }

  /**
   * Comprueba que la ficha esté completa y sea correcta.
   * @param {{generar:boolean, mostrar:boolean}} [opciones] - generar:
   *        comprobaciones de GWI/GWC (el estilo del cartucho no puede
   *        pedir más botones que la máquina); mostrar: pinta los
   *        hallazgos en la ficha.
   * @returns {{errores:string[], avisos:string[]}} Los hallazgos.
   */
  function verificar(opciones) {
    const opt = opciones || {};
    const errores = [], avisos = [];
    _asegurar();
    const e = estado();
    const delSetup = (typeof baseDirector !== 'undefined' && baseDirector.estiloDeSetup)
      ? baseDirector.estiloDeSetup() : null;
    const pantalla = (typeof baseDirector !== 'undefined' && baseDirector.pantallaDeSetup)
      ? baseDirector.pantallaDeSetup() : null;

    // F5-I12: el GWI/GWC salen de lo APLICADO; con la ficha en borrador
    // se pide aplicar antes (así lo generado es lo que hay en memoria).
    if (opt.generar && sucio) {
      errores.push('La ficha del cartucho tiene cambios sin aplicar: pulsa Aplicar en la pestaña Cartucho antes de generar.');
    }
    if (e.nombre === '') errores.push('Falta el nombre del cartucho.');

    // Estilo (opcional): si no está, tiene que haber setup que lo dé.
    const estilo = e.estilo || delSetup;
    if (!estilo) {
      errores.push('No hay estilo: elígelo en la ficha o carga un setup.');
    } else if (e.estilo && delSetup && Number(e.estilo) > Number(delSetup)) {
      // Un cartucho de MENOS botones se juega en una máquina con más; al
      // revés no. Para generar GWI/GWC es un error; para el GWB, un aviso.
      const msg = 'El cartucho es de estilo ' + e.estilo + ' y el setup cargado de estilo ' +
        delSetup + ' (menos botones): no se podría jugar.';
      if (opt.generar) errores.push(msg); else avisos.push(msg);
    }

    // Resolución (opcional): las dos medidas o ninguna.
    const aN = campos.ancho.value.trim(), lN = campos.alto.value.trim();
    if ((aN === '') !== (lN === '')) {
      errores.push('La resolución necesita ancho y alto (o ninguno de los dos).');
    } else if (aN !== '' && !e.resolucion) {
      errores.push('La resolución debe ser de enteros positivos.');
    } else if (e.resolucion && pantalla &&
      (pantalla.ancho !== e.resolucion.ancho || pantalla.alto !== e.resolucion.alto)) {
      avisos.push('La resolución de la ficha (' + e.resolucion.ancho + '×' + e.resolucion.alto +
        ') es informativa y difiere de la del setup (' + pantalla.ancho + '×' + pantalla.alto +
        '): manda la del setup, y el GWI/GWC se generan a esa pantalla.');
    }

    // Imágenes: img_s obligatoria. Los tamaños pueden diferir (img_s
    // grande para trabajar cómodo): el GWC escala al generarse y img_f
    // se escala al tamaño del setup al guardar el GWI (el GWB la conserva).
    const s = e.imagenes.img_s, f = e.imagenes.img_f;
    if (!s) {
      errores.push('Falta img_s (obligatoria: de ella se extrae la geometría).');
    } else {
      if (f && (s.imagen.naturalWidth !== f.imagen.naturalWidth ||
        s.imagen.naturalHeight !== f.imagen.naturalHeight)) {
        avisos.push('img_s (' + s.imagen.naturalWidth + '×' + s.imagen.naturalHeight +
          ') e img_f (' + f.imagen.naturalWidth + '×' + f.imagen.naturalHeight +
          ') miden distinto (img_f se escalará al tamaño del setup en el GWI; el GWB la conserva).');
      }
      if (e.resolucion && (s.imagen.naturalWidth !== e.resolucion.ancho ||
        s.imagen.naturalHeight !== e.resolucion.alto)) {
        avisos.push('img_s mide ' + s.imagen.naturalWidth + '×' + s.imagen.naturalHeight +
          ' y la resolución declarada es ' + e.resolucion.ancho + '×' + e.resolucion.alto + '.');
      }
      const raros = _pixelesNoBN(s.imagen);
      if (raros > 0) {
        avisos.push('img_s no es blanco y negro puro (' + raros + ' píxeles con otros ' +
          'colores; ¿antialiasing?): la carga la rechazará.');
      }
    }

    // F5-I21: la ficha ya no declara botones ni memoria (los botones son
    // los del setup, verificados al aplicar el GWS, y la memoria también
    // es la del setup): nada más que validar aquí.
    // Validación del contrato del GWB (la misma que al cargarlo). El
    // mapa de ficheros se monta aquí con las imágenes en memoria.
    if (errores.length === 0) {
      const json = _montarGWB();
      const mapa = new Map(Object.values(json.imagenes).map(n => [n, true]));
      const fallo = baseCartucho.validarGWB(json, mapa, json.estilo || delSetup);
      if (fallo) errores.push('Validación del GWB: ' + fallo);
    }
    if (opt.mostrar) _pintarMensajes(errores, avisos);
    return { errores: errores, avisos: avisos };
  }

  /**
   * Marca (o desmarca) la ficha como borrador con cambios sin aplicar
   * y muestra u oculta el aviso (F5-I12).
   * @param {boolean} hay - true si hay cambios sin aplicar.
   * @returns {void}
   */
  function _marcarCambios(hay) {
    sucio = !!hay;
    if (avisoCambios) avisoCambios.classList.toggle('oculto', !sucio);
  }

  /**
   * Indica si la ficha tiene cambios sin aplicar (F5-I12).
   * @returns {boolean} true si el borrador difiere de lo aplicado.
   */
  function hayCambios() {
    return sucio;
  }

  /**
   * Los ficheros de un GWB en memoria a partir de lo que hay en la
   * ficha (F5-I12): cartucho_GWB.json y las imágenes img_s/img_f/img_m
   * .png. Es lo que Aplicar entrega al núcleo de carga, de modo que un
   * cartucho creado en la ficha y uno cargado de disco son
   * indistinguibles. No verifica: antes hay que llamar a verificar().
   * @returns {Promise<File[]>} Los ficheros del GWB.
   */
  async function ficherosGWB() {
    _asegurar();
    const json = _montarGWB();
    const ficheros = [new File([JSON.stringify(json, null, 2)], 'cartucho_GWB.json',
      { type: 'application/json' })];
    const imgs = imagenesEnMemoria();
    for (const clave of Object.keys(json.imagenes)) {
      const blob = await baseCartucho.imagenBlob(imgs[clave]);
      ficheros.push(new File([blob], json.imagenes[clave], { type: 'image/png' }));
    }
    return ficheros;
  }

  /**
   * Monta el objeto GWB desde la ficha (ya verificada).
   * @returns {Object} GWB listo para serializar.
   */
  function _montarGWB() {
    const e = estado();
    const json = { tipo: 'GWB', version: 1, nombre: e.nombre };
    if (e.descripcion) json.descripcion = e.descripcion;    // F5-I17 (M13)
    if (e.estilo) json.estilo = e.estilo;
    if (e.colorFondo) json.ColorFondo = e.colorFondo;
    json.imagenes = { img_s: 'img_s.png' };
    if (e.imagenes.img_f) json.imagenes.img_f = 'img_f.png';
    if (e.imagenes.img_m) json.imagenes.img_m = 'img_m.png';
    // F5-I21: el GWB es SOLO las imágenes de partida (+ estilo y
    // ColorFondo): SIN resolucion, SIN memoria y SIN botones. Esos datos
    // viajan en el GWI (autosuficiente) y en el setup (GWS); al cargar un
    // GWB salen del setup vigente o del derivado.
    for (const k of ['combinar', 'etiquetas']) {
      if (extras[k] !== undefined) json[k] = extras[k];
    }
    return json;
  }

  /**
   * Verifica la ficha y, si es correcta, genera cartucho_gwb.zip. El
   * mapa de ficheros para validarGWB se monta aquí con las imágenes
   * en memoria (las que se guardarán).
   * @returns {Promise<boolean>} true si se guardó.
   */
  async function guardar() {
    _asegurar();
    const { errores } = verificar({ mostrar: true });
    if (errores.length > 0) {
      baseDirector.avisarError('El GWB no se guarda: ' + errores.length +
        (errores.length === 1 ? ' error' : ' errores') + ' en la ficha.');
      return false;
    }
    const e = estado();
    const tamano = await baseCartucho.guardarGWB(_montarGWB(),
      e.imagenes.img_f ? e.imagenes.img_f.imagen : null,
      e.imagenes.img_s.imagen,
      e.imagenes.img_m ? e.imagenes.img_m.imagen : null);
    return tamano > 0;
  }

  /**
   * Muestra la ficha. La primera vez la construye en blanco; después
   * conserva lo escrito.
   * @param {HTMLElement} contenedor - El div de la ficha.
   * @returns {void}
   */
  function pintar(contenedor) {
    if (raiz !== contenedor) {
      raiz = contenedor;
      campos = {}; imagenes = {};
      _construir(contenedor);
      _refrescarBotonesImagen('img_s');
    }
  }

  /**
   * Construye la ficha si aún no existe (el director puede poblarla
   * antes de que el usuario abra la pestaña).
   * @returns {void}
   */
  function _asegurar() {
    if (!raiz) pintar(document.getElementById('fichaCartucho'));
  }

  /**
   * La memoria del setup vigente (solo los subcampos ≠ 0), que es la que
   * viaja en el GWI generado (F5-I21: la memoria solo se edita en Setup;
   * el GWB ya no la lleva).
   * @returns {?{RAM:number, FLASH:number}} La memoria, o null si no hay.
   */
  function _memoriaDelSetup() {
    const setup = (typeof baseDirector !== 'undefined' && baseDirector.datosSetup)
      ? baseDirector.datosSetup() : null;
    return setup ? baseCartucho.memoriaNoCero(setup.memoria) : null;
  }

  /**
   * Lee la ficha tal cual está (sin completar con el setup). Los
   * botones no son de la ficha (F5-I21): los del cartucho los da
   * _botonesDelSetup.
   * @returns {{nombre:string, estilo:?string, resolucion:?Object,
   *   colorFondo:?string, imagenes:Object}} Datos de la ficha.
   */
  function estado() {
    _asegurar();
    const ancho = parseInt(campos.ancho.value, 10);
    const alto = parseInt(campos.alto.value, 10);
    const imgs = {};
    for (const d of IMAGENES) {
      imgs[d.clave] = imagenes[d.clave].img
        ? { imagen: imagenes[d.clave].img, nombre: imagenes[d.clave].nombre } : null;
    }
    return {
      nombre: campos.nombre.value.trim(),
      descripcion: campos.descripcion.value.trim(),   // F5-I17 (M13)
      estilo: campos.estilo.value || null,
      resolucion: (ancho > 0 && alto > 0) ? { ancho: ancho, alto: alto } : null,
      // Solo viaja si no es el blanco por defecto (los defaults no viajan).
      colorFondo: campos.colorFondo.value.toLowerCase() === COLOR_BLANCO
        ? null : campos.colorFondo.value.toUpperCase(),
      imagenes: imgs
    };
  }

  /**
   * Datos de la ficha para guardar el GWI/GWC: lo de la ficha,
   * completado con el setup cuando falta (estilo y resolución son
   * obligatorios en el GWI). Los nombres de imagen son los del fichero
   * que se escribe (img_s.png, img_f.png, img_m.png).
   * @returns {{nombre:string, descripcion:?string, estilo:string,
   *   resolucion:?Object, imagenes:Object, imgs:Object, botones:Array,
   *   extras:Object}} botones: los del setup (F5-I21).
   */
  function datosCartucho() {
    const e = estado();
    const delSetup = (typeof baseDirector !== 'undefined' && baseDirector.estiloDeSetup)
      ? baseDirector.estiloDeSetup() : null;
    const pantalla = (typeof baseDirector !== 'undefined' && baseDirector.pantallaDeSetup)
      ? baseDirector.pantallaDeSetup() : null;
    const nombres = {};
    for (const d of IMAGENES) if (e.imagenes[d.clave]) nombres[d.clave] = d.clave + '.png';
    return {
      nombre: e.nombre,
      descripcion: e.descripcion || null,             // F5-I17 (M13)
      estilo: e.estilo || delSetup,
      resolucion: e.resolucion || pantalla,
      colorFondo: e.colorFondo,
      memoria: _memoriaDelSetup(),                    // F5-I21: la del setup (solo se edita allí)
      imagenes: nombres,
      imgs: imagenesEnMemoria(),
      botones: _botonesDelSetup(),          // F5-I21: los del setup
      extras: Object.assign({}, extras)
    };
  }

  /**
   * Las tres imágenes de la ficha (null si no hay).
   * @returns {{img_s:?HTMLImageElement, img_f:?HTMLImageElement,
   *   img_m:?HTMLImageElement}} Imágenes en memoria.
   */
  function imagenesEnMemoria() {
    _asegurar();
    const o = {};
    for (const d of IMAGENES) o[d.clave] = imagenes[d.clave].img;
    return o;
  }

  /**
   * Deja la ficha en blanco (el director lo llama antes de poblar una
   * carga nueva).
   * @returns {void}
   */
  function reiniciar() {
    _asegurar();
    for (const d of IMAGENES) _vaciarImagen(d.clave);
    extras = {};
    campos.nombre.value = '';
    campos.descripcion.value = '';                     // F5-I17 (M13)
    campos.estilo.value = '';
    campos.ancho.value = '';
    campos.alto.value = '';
    campos.colorFondo.value = COLOR_BLANCO;
    campos.codigoGWC.value = '---';
    if (mensajes) mensajes.textContent = '';
    _marcarCambios(false);
  }

  /**
   * Rellena la ficha desde una carga (GWS, GWB o GWI). Solo toca lo que
   * viene definido; el director llama antes a reiniciar().
   * @param {{nombre:?string, descripcion:?string, estilo:?(string|number),
   *   resolucion:?Object, colorFondo:?string,
   *   imagenes:?Object, extras:?Object}} d - Datos a mostrar
   *   (F5-I21: sin botones, que ya no son de la ficha).
   * @returns {void}
   */
  function poblar(d) {
    _asegurar();
    if (d.nombre !== undefined) campos.nombre.value = d.nombre || '';
    if (d.descripcion !== undefined) campos.descripcion.value = d.descripcion || '';   // F5-I17 (M13)
    if (d.estilo !== undefined) {
      const v = d.estilo === null ? '' : String(d.estilo);
      campos.estilo.value = v;
      if (campos.estilo.value !== v) campos.estilo.value = '';   // valor no listado
    }
    if (d.resolucion !== undefined) {
      const r = d.resolucion;
      campos.ancho.value = r && r.ancho ? r.ancho : '';
      campos.alto.value = r && r.alto ? r.alto : '';
    }
    if (d.colorFondo !== undefined) {
      campos.colorFondo.value = _esColor(d.colorFondo) ? d.colorFondo.toLowerCase() : COLOR_BLANCO;
    }
    if (d.codigoGWC !== undefined) campos.codigoGWC.value = d.codigoGWC || '---';
    if (d.imagenes) {
      for (const [clave, img] of Object.entries(d.imagenes)) {
        if (img && imagenes[clave]) ponerImagen(clave, img, clave + '.png');
      }
    }
    if (d.extras) extras = Object.assign({}, d.extras);
    if (mensajes) mensajes.textContent = '';
    _marcarCambios(false);        // lo cargado es lo aplicado
  }

  /**
   * Pone (o quita, con null) una imagen en su tarjeta desde el
   * director (p. ej. la portada, que carga después, sin bloquear).
   * No avisa de cambio: es la ficha reflejando lo cargado.
   * @param {string} clave - 'img_s', 'img_f' o 'img_m'.
   * @param {?HTMLImageElement} img - Imagen o null.
   * @param {string} [nombre] - Nombre a mostrar (por defecto clave.png).
   * @returns {void}
   */
  function ponerImagen(clave, img, nombre) {
    _asegurar();
    if (!imagenes[clave]) return;
    if (img) _colocarImagen(clave, img, nombre || clave + '.png', null);
    else _vaciarImagen(clave);
  }

  /**
   * Refresca el campo de solo lectura «Código GWC» (F5-I17, M1): lo
   * llama el editor al generar el par (el código del GWC recién
   * montado) y tras un guardado que suelta el código. No avisa de
   * cambio: la ficha refleja el estado del cartucho en memoria.
   * @param {?string} codigo - Código #HHHH#, o null para «---».
   * @returns {void}
   */
  function actualizarCodigoGWC(codigo) {
    _asegurar();
    campos.codigoGWC.value = codigo || '---';
  }

  return {
    pintar: pintar,
    reiniciar: reiniciar,
    poblar: poblar,
    ponerImagen: ponerImagen,
    actualizarCodigoGWC: actualizarCodigoGWC,   // F5-I17 (M1)
    estado: estado,
    datosCartucho: datosCartucho,
    imagenesEnMemoria: imagenesEnMemoria,
    verificar: verificar,
    guardar: guardar,
    hayCambios: hayCambios,
    marcarAplicado: () => _marcarCambios(false),
    ficherosGWB: ficherosGWB
  };

})();
