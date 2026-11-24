'use strict';

// BaseFicha.js
// ====================================================================================================
// PROPÓSITO
//   La pestaña «Cartucho» (F5-I10): la ficha del cartucho, FUENTE
//   ÚNICA de sus datos (nombre, estilo, resolución, imágenes y botones).
//   Todo lo que se carga la rellena (poblar) y todo lo que se guarda
//   sale de ella: el GWB directamente y el GWI/GWC a través de
//   datosCartucho. Con segmentos en memoria la imagen img_s se bloquea
//   (los segmentos salen de ella).
//
// QUÉ MUESTRA
//   - Datos del cartucho: nombre, estilo y resolución (ancho × alto). En
//     un GWB estilo y resolución son OPCIONALES (si faltan, manda el
//     GWS); en el GWI/GWC se completan con los del setup cargado.
//   - Imágenes: una tarjeta por img_s (obligatoria), img_f e img_m
//     (opcionales) con miniatura, nombre, tamaño y los botones
//     «Cargar…» y «Borrar».
//   - Botones: la tabla de los botones posibles según el estilo
//     elegido (incluido el trío de sistema A/B/R, 6-7-8), con «Usado»,
//     «id» y «Tecla» (F5-I17, M7: el mismo desplegable que el setup).
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
//    poblar             Rellena campos, botones e imágenes desde una carga.
//    ponerImagen        Pone (o quita) una imagen sin avisar al director.
//    actualizarCodigoGWC F5-I17 (M1): refresca el «Código GWC» de solo lectura.
//  Lectura
//    estado             Lee los datos de la ficha tal cual (sin completar).
//    datosCartucho      Datos para guardar GWI/GWC (completados con el setup).
//    imagenesEnMemoria  Las tres imágenes {img_s, img_f, img_m}.
//    botonesDelEstilo   Números de botón posibles de un estilo.
//  Aplicar (F5-I12)
//    hayCambios         ¿Hay cambios sin aplicar (borrador)?
//    marcarAplicado     Da la ficha por aplicada (apaga el aviso).
//    ficherosGWB        Los ficheros del GWB de la ficha, en memoria.
//  Verificación y GWB
//    verificar          Comprueba que la ficha esté completa y correcta.
//    guardar            Verifica y, si todo está bien, genera cartucho_GWB.
//  Internas
//    _marcarCambios      _asegurar               _crearElemento
//    _estiloEfectivo     _montarGWB              _pintarMensajes
//    _pixelesNoBN        _crearTarjetaImagen     _cargarImagen           
//    _colocarImagen      _vaciarImagen           _refrescarBotonesImagen
//    _miniaturaDe        _pintarTablaBotones     _campo
//    _teclaDeFicha
//    _entrada            _esColor            _liberar                _construir
// ====================================================================================================

const BaseFicha = (function () {

  // Botones posibles por estilo: los de juego del estilo más el trío
  // de sistema A/B/R (6-7-8, GAME A / GAME B / TIME), que existe en
  // todos los estilos y también se puede definir. Ver ESTILOS en
  // BaseDirector.
  const TRIO_SISTEMA = [6, 7, 8];
  const NOMBRE_SISTEMA = { 6: 'A', 7: 'B', 8: 'R' };
  const BOTONES_POR_ESTILO = {
    '2': [0, 4, ...TRIO_SISTEMA],
    '4': [0, 1, 4, 5, ...TRIO_SISTEMA],
    '5': [0, 1, 2, 3, 4, ...TRIO_SISTEMA]
  };

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
  let idsBoton = {};              // número → {usado, id, tecla} (sobrevive al cambio de estilo)

  // F5-I17 (M7): los cuatro nombres de cursor admitidos como tecla (los
  // mismos valores que el GWS; la validación común vive en BaseDirector).
  const CURSORES = ['cursor-izquierda', 'cursor-derecha',
    'cursor-arriba', 'cursor-abajo'];
  let cuerpoBotones = null;
  let mensajes = null;            // zona de errores/avisos
  let extras = {};                // combinar/etiquetas del GWB cargado (se conservan al guardar)
  let sucio = false;              // F5-I12: hay cambios sin aplicar (la ficha es un borrador)
  let avisoCambios = null;        // línea «cambios sin aplicar»

  /**
   * Números de botón de juego posibles de un estilo.
   * @param {string} estilo - '2', '4' o '5'.
   * @returns {number[]} Los números (vacío si el estilo no es válido).
   */
  function botonesDelEstilo(estilo) {
    return (BOTONES_POR_ESTILO[estilo] || []).slice();
  }

  /**
   * Estilo con el que se define la tabla de botones: el de la ficha o,
   * si está en blanco, el del setup cargado.
   * @returns {string} '2', '4', '5' o '' si no hay ninguno.
   */
  function _estiloEfectivo() {
    if (campos.estilo && campos.estilo.value) return campos.estilo.value;
    const delSetup = (typeof BaseDirector !== 'undefined' && BaseDirector.estiloDeSetup)
      ? BaseDirector.estiloDeSetup() : null;
    return delSetup || '';
  }

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

  /**
   * Fila «caption + campo» de la rejilla de datos.
   * @param {HTMLElement} padre - Rejilla.
   * @param {string} caption - Texto del caption.
   * @param {HTMLElement} control - Input o select.
   * @param {string} [nota] - Aclaración al lado del campo.
   * @returns {HTMLElement} El control.
   */
  function _campo(padre, caption, control, nota) {
    const etiqueta = _crearElemento('label', 'fichaCaption', caption);
    padre.appendChild(etiqueta);
    const celda = _crearElemento('div', 'fichaCampo');
    celda.appendChild(control);
    if (nota) celda.appendChild(_crearElemento('span', 'fichaNota', nota));
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
      if (typeof BaseDirector !== 'undefined') {
        BaseDirector.avisarError('No se pudo leer la imagen ' + fichero.name + '.');
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

  // ---------------- Botones ----------------

  /**
   * F5-I17 (M7): la tecla efectiva de una fila de la tabla: el nombre de
   * cursor elegido en la lista, o la letra de la casilla cuando la lista
   * está en «Propia». Sin tecla, ''.
   * @param {HTMLElement} tr - Fila de la tabla de botones.
   * @returns {string} La tecla tal como va al JSON del GWB/GWI.
   */
  function _teclaDeFicha(tr) {
    const lista = tr.querySelector('.colTeclaLista');
    if (!lista) return '';
    if (lista.value !== 'tecla') return lista.value;
    const letra = tr.querySelector('.colTeclaLetra');
    return letra ? letra.value : '';
  }

  /**
   * Repinta la tabla de botones según el estilo elegido, conservando lo
   * ya escrito para cada número.
   * @returns {void}
   */
  function _pintarTablaBotones() {
    // Guarda lo escrito antes de reconstruir.
    for (const fila of cuerpoBotones.querySelectorAll('tr[data-numero]')) {
      idsBoton[fila.dataset.numero] = {
        usado: fila.querySelector('input[type=checkbox]').checked,
        id: fila.querySelector('.colId').value,
        tecla: _teclaDeFicha(fila)
      };
    }
    cuerpoBotones.textContent = '';
    const numeros = botonesDelEstilo(_estiloEfectivo());
    if (numeros.length === 0) {
      const tr = _crearElemento('tr');
      const td = _crearElemento('td', 'fichaNota', 'Elige un estilo (o carga un setup) para ver los botones posibles.');
      td.colSpan = 4;
      tr.appendChild(td);
      cuerpoBotones.appendChild(tr);
      return;
    }
    for (const n of numeros) {
      const previo = idsBoton[String(n)] || { usado: false, id: '', tecla: '' };
      const tr = _crearElemento('tr');
      tr.dataset.numero = String(n);
      const tdUsado = _crearElemento('td');
      const usado = _entrada('checkbox');
      usado.checked = previo.usado;
      tdUsado.appendChild(usado);
      const tdNumero = _crearElemento('td', null, String(n) +
        (NOMBRE_SISTEMA[n] ? ' (' + NOMBRE_SISTEMA[n] + ')' : ''));
      const tdId = _crearElemento('td');
      const id = _entrada('text', { className: 'colId', value: previo.id,
        placeholder: 'id lógico (IZQ, DER, Start…)' });
      id.disabled = !usado.checked;
      tdId.appendChild(id);
      // F5-I17 (M7): la tecla se elige en la misma lista cerrada que el
      // setup (los cuatro cursores y «Propia»), con casilla de letra aparte;
      // solo editable si el botón está Usado.
      const lista = _crearElemento('select', 'colTeclaLista');
      for (const [valor, texto] of [['', '(sin tecla)'],
        ...CURSORES.map(c => [c, c]), ['tecla', 'Propia (letra)']]) {
        const o = document.createElement('option');
        o.value = valor; o.textContent = texto;
        lista.appendChild(o);
      }
      const nombreTecla = String(previo.tecla || '').trim().toLowerCase();
      if (CURSORES.includes(nombreTecla)) lista.value = nombreTecla;
      else if (/^[a-zA-Z]$/.test(nombreTecla) ||
        (/^[1-3]$/.test(nombreTecla) && NOMBRE_SISTEMA[n])) lista.value = 'tecla';
      else lista.value = '';
      const letra = _entrada('text', { className: 'colTeclaLetra', maxLength: 1,
        value: lista.value === 'tecla' ? String(previo.tecla || '').toUpperCase() : '' });
      letra.classList.toggle('oculto', lista.value !== 'tecla');
      letra.placeholder = NOMBRE_SISTEMA[n] ? 'A..Z o 1-3' : 'A..Z';
      lista.addEventListener('change', () => {
        letra.classList.toggle('oculto', lista.value !== 'tecla');
        if (lista.value !== 'tecla') letra.value = '';
      });
      const tdTecla = _crearElemento('td');
      tdTecla.append(lista, letra);
      usado.addEventListener('change', () => {
        id.disabled = !usado.checked;
        lista.disabled = !usado.checked;
        letra.disabled = !usado.checked;
      });
      lista.disabled = !usado.checked;
      letra.disabled = !usado.checked;
      tr.append(tdUsado, tdNumero, tdId, tdTecla);
      cuerpoBotones.appendChild(tr);
    }
  }

  // ---------------- Construcción ----------------

  /** Construye toda la ficha dentro de `contenedor`. */
  function _construir(contenedor) {
    contenedor.textContent = '';

    // Datos del GWB
    const datos = _crearElemento('section', 'fichaSeccion');
    datos.appendChild(_crearElemento('h3', null, 'Datos del GWB'));
    const rejilla = _crearElemento('div', 'fichaRejilla');
    campos.nombre = _campo(rejilla, 'Nombre', _entrada('text', { placeholder: 'Nombre del cartucho' }));
    const estilo = document.createElement('select');
    for (const [valor, texto] of [['', '(sin definir)'], ['2', '2 botones'],
    ['4', '4 botones'], ['5', '5 botones']]) {
      const o = document.createElement('option');
      o.value = valor; o.textContent = texto;
      estilo.appendChild(o);
    }
    campos.estilo = _campo(rejilla, 'Estilo', estilo,
      'Opcional: si falta, se usa el del setup cargado.');
    const par = _crearElemento('div', 'fichaPar');
    campos.ancho = _entrada('number', { min: 1, step: 1, placeholder: 'ancho' });
    campos.alto = _entrada('number', { min: 1, step: 1, placeholder: 'alto' });
    par.append(campos.ancho, _crearElemento('span', null, '×'), campos.alto);
    _campo(rejilla, 'Resolución', par,
      'Opcional: si falta, se usa la pantalla del setup cargado.');
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

    // Botones
    const seccionBot = _crearElemento('section', 'fichaSeccion');
    seccionBot.appendChild(_crearElemento('h3', null, 'Botones'));
    const tabla = _crearElemento('table', 'fichaTabla');
    const cabecera = _crearElemento('thead');
    const trCab = _crearElemento('tr');
    for (const t of ['Usado', 'Botón', 'Id', 'Tecla']) trCab.appendChild(_crearElemento('th', null, t));
    cabecera.appendChild(trCab);
    cuerpoBotones = _crearElemento('tbody');
    tabla.append(cabecera, cuerpoBotones);
    seccionBot.appendChild(tabla);
    seccionBot.appendChild(_crearElemento('p', 'fichaNota',
      'Tecla: letra o cursor del teclado del PC para el simulador (misma lista que el setup; la del cartucho manda sobre la del setup). ' +
      'Los botones 6, 7 y 8 son el trío de sistema A/B/R (presente en todos los estilos).'));
    contenedor.appendChild(seccionBot);

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

    campos.estilo.addEventListener('change', _pintarTablaBotones);
    _pintarTablaBotones();
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
    const delSetup = (typeof BaseDirector !== 'undefined' && BaseDirector.estiloDeSetup)
      ? BaseDirector.estiloDeSetup() : null;
    const pantalla = (typeof BaseDirector !== 'undefined' && BaseDirector.pantallaDeSetup)
      ? BaseDirector.pantallaDeSetup() : null;

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

    // Botones: ids no vacíos y sin repetir (sin distinguir mayúsculas).
    const vistos = new Set();
    for (const b of e.botones) {
      if (b.id === '') { errores.push('El botón ' + b.numero + ' está marcado como usado y no tiene id.'); continue; }
      const clave = b.id.toLowerCase();
      if (vistos.has(clave)) errores.push('El id «' + b.id + '» está repetido.');
      vistos.add(clave);
    }
    // F5-I17 (M8): las teclas del cartucho, la misma regla que el GWS:
    // letra A..Z o nombre de cursor (el dígito 1/2/3 solo en el trío
    // A/B/R), sin repetir entre las declaradas.
    const teclasVistas = new Set();
    for (const b of e.botones) {
      if (b.tecla === undefined) continue;
      const valida = (typeof BaseDirector !== 'undefined' && BaseDirector.teclaValida)
        ? BaseDirector.teclaValida(b.tecla, b.numero) : true;
      if (!valida) {
        errores.push('La tecla «' + b.tecla + '» del botón ' + b.numero +
          ' no es válida: letra A..Z, un nombre de cursor o el dígito 1/2/3' +
          ' solo en el trío de sistema A/B/R.');
        continue;
      }
      if (teclasVistas.has(b.tecla.toLowerCase())) {
        errores.push('La tecla «' + b.tecla + '» está repetida (botón ' + b.numero + ').');
      }
      teclasVistas.add(b.tecla.toLowerCase());
    }
    if (e.botones.length === 0) avisos.push('El cartucho no declara botones: se usarán los del setup.');
    // Validación del contrato del GWB (la misma que al cargarlo). El
    // mapa de ficheros se monta aquí con las imágenes en memoria.
    if (errores.length === 0) {
      const json = _montarGWB();
      const mapa = new Map(Object.values(json.imagenes).map(n => [n, true]));
      const fallo = BaseCartucho.validarGWB(json, mapa, json.estilo || delSetup);
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
      const blob = await BaseCartucho.imagenBlob(imgs[clave]);
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
    if (e.estilo) json.estilo = e.estilo;
    if (e.resolucion) json.resolucion = e.resolucion;
    if (e.colorFondo) json.ColorFondo = e.colorFondo;
    json.imagenes = { img_s: 'img_s.png' };
    if (e.imagenes.img_f) json.imagenes.img_f = 'img_f.png';
    if (e.imagenes.img_m) json.imagenes.img_m = 'img_m.png';
    json.botones = e.botones;
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
      BaseDirector.avisarError('El GWB no se guarda: ' + errores.length +
        (errores.length === 1 ? ' error' : ' errores') + ' en la ficha.');
      return false;
    }
    const e = estado();
    const tamano = await BaseCartucho.guardarGWB(_montarGWB(),
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
      campos = {}; imagenes = {}; idsBoton = {};
      _construir(contenedor);
      _refrescarBotonesImagen('img_s');
    } else {
      _pintarTablaBotones();           // el setup pudo cambiar desde la última visita
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
   * Lee la ficha tal cual está (sin completar con el setup).
   * @returns {{nombre:string, estilo:?string, resolucion:?Object,
   *   colorFondo:?string, imagenes:Object, botones:Array}} Datos de la ficha.
   */
  function estado() {
    _asegurar();
    _pintarTablaBotones();             // vuelca lo escrito en idsBoton
    const ancho = parseInt(campos.ancho.value, 10);
    const alto = parseInt(campos.alto.value, 10);
    const imgs = {};
    for (const d of IMAGENES) {
      imgs[d.clave] = imagenes[d.clave].img
        ? { imagen: imagenes[d.clave].img, nombre: imagenes[d.clave].nombre } : null;
    }
    const botones = botonesDelEstilo(_estiloEfectivo())
      .filter(n => idsBoton[String(n)] && idsBoton[String(n)].usado)
      .map(n => {
        const d = idsBoton[String(n)];
        const b = { numero: n, id: d.id.trim() };
        const t = String(d.tecla || '').trim();
        // F5-I17 (M7): la tecla viaja normalizada (cursor en minúsculas,
        // letra en mayúsculas); un botón sin tecla no escribe el campo.
        if (t) {
          b.tecla = (typeof BaseDirector !== 'undefined' && BaseDirector.normalizarTecla)
            ? BaseDirector.normalizarTecla(t) : t;
        }
        return b;
      });
    return {
      nombre: campos.nombre.value.trim(),
      estilo: campos.estilo.value || null,
      resolucion: (ancho > 0 && alto > 0) ? { ancho: ancho, alto: alto } : null,
      // Solo viaja si no es el blanco por defecto (los defaults no viajan).
      colorFondo: campos.colorFondo.value.toLowerCase() === COLOR_BLANCO
        ? null : campos.colorFondo.value.toUpperCase(),
      imagenes: imgs,
      botones: botones
    };
  }

  /**
   * Datos de la ficha para guardar el GWI/GWC: lo de la ficha,
   * completado con el setup cuando falta (estilo y resolución son
   * obligatorios en el GWI). Los nombres de imagen son los del fichero
   * que se escribe (img_s.png, img_f.png, img_m.png).
   * @returns {{nombre:string, estilo:string, resolucion:?Object,
   *   imagenes:Object, imgs:Object, botones:Array, extras:Object}}
   */
  function datosCartucho() {
    const e = estado();
    const delSetup = (typeof BaseDirector !== 'undefined' && BaseDirector.estiloDeSetup)
      ? BaseDirector.estiloDeSetup() : null;
    const pantalla = (typeof BaseDirector !== 'undefined' && BaseDirector.pantallaDeSetup)
      ? BaseDirector.pantallaDeSetup() : null;
    const nombres = {};
    for (const d of IMAGENES) if (e.imagenes[d.clave]) nombres[d.clave] = d.clave + '.png';
    return {
      nombre: e.nombre,
      estilo: e.estilo || delSetup,
      resolucion: e.resolucion || pantalla,
      colorFondo: e.colorFondo,
      imagenes: nombres,
      imgs: imagenesEnMemoria(),
      botones: e.botones,
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
    idsBoton = {};
    extras = {};
    campos.nombre.value = '';
    campos.estilo.value = '';
    campos.ancho.value = '';
    campos.alto.value = '';
    campos.colorFondo.value = COLOR_BLANCO;
    campos.codigoGWC.value = '---';
    cuerpoBotones.textContent = '';
    _pintarTablaBotones();
    if (mensajes) mensajes.textContent = '';
    _marcarCambios(false);
  }

  /**
   * Rellena la ficha desde una carga (GWS, GWB o GWI). Solo toca lo que
   * viene definido; el director llama antes a reiniciar().
   * @param {{nombre:?string, estilo:?(string|number), resolucion:?Object,
   *   colorFondo:?string, botones:?Array<{numero:(string|number), id:?string}>,
   *   imagenes:?Object, extras:?Object}} d - Datos a mostrar.
   * @returns {void}
   */
  function poblar(d) {
    _asegurar();
    if (d.nombre !== undefined) campos.nombre.value = d.nombre || '';
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
    if (d.botones !== undefined) {
      idsBoton = {};
      for (const b of d.botones || []) {
        idsBoton[String(b.numero)] = { usado: true, id: b.id ? String(b.id) : '',
          tecla: (b.tecla !== undefined && b.tecla !== null) ? String(b.tecla) : '' };
      }
      cuerpoBotones.textContent = '';   // que no pise lo recién cargado
    }
    _pintarTablaBotones();
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
    ficherosGWB: ficherosGWB,
    botonesDelEstilo: botonesDelEstilo
  };

})();
