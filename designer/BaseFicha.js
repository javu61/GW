'use strict';

// BaseFicha.js
// ==================================================
//
// PROPÓSITO
//   La pestaña «Cartucho» (F5-I10/F5-I12): la ficha del cartucho, FUENTE
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
//     elegido (incluido el trío de sistema A/B/R, 6-7-8), con «Usado» e «id».
//
// SEPARACIÓN
//   No conoce al descomponedor: solo pinta y guarda el estado de la
//   ficha en el DOM y en variables propias. El director la rellena
//   (poblar, ponerImagen), le dice cuándo bloquear img_s
//   (bloquearImgS) y se suscribe a los cambios de imagen
//   (alCambiarImagen). La ficha se construye UNA vez y conserva lo
//   escrito entre visitas.
//
// FUNCIONES
//  Pantalla
//   pintar             Construye la ficha (la primera vez) en el contenedor.
//   reiniciar          Deja la ficha en blanco.
//   poblar             Rellena campos, botones e imágenes desde una carga.
//   ponerImagen        Pone (o quita) una imagen sin avisar al director.
//   bloquearImgS       Bloquea/desbloquea cargar y borrar img_s.
//   alCambiarImagen    Registra quién se entera de los cambios del usuario.
//  Lectura
//   estado             Lee los datos de la ficha tal cual (sin completar).
//   datosCartucho      Datos para guardar GWI/GWC (completados con el setup).
//   imagenesEnMemoria  Las tres imágenes {img_s, img_f, img_m}.
//   botonesDelEstilo   Números de botón posibles de un estilo.
//  Verificación y GWB
//   verificar          Comprueba que la ficha esté completa y correcta.
//   guardar            Verifica y, si todo está bien, genera cartucho_GWB.
//  Internas
//   asegurar, estiloEfectivo, montarGWB, pintarMensajes, pixelesNoBN,
//   crearTarjetaImagen, cargarImagen, colocarImagen, vaciarImagen,
//   refrescarBotonesImagen, miniaturaDe, pintarTablaBotones, campo.

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
  let idsBoton = {};              // número → {usado, id} (sobrevive al cambio de estilo)
  let cuerpoBotones = null;
  let mensajes = null;            // zona de errores/avisos
  let extras = {};                // combinar/etiquetas del GWB cargado (se conservan al guardar)
  let imgSBloqueada = false;      // con segmentos en memoria no se cambia img_s
  let alCambiar = null;           // (clave, imagen|null) tras un cambio del usuario

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
  function estiloEfectivo() {
    if (campos.estilo && campos.estilo.value) return campos.estilo.value;
    const delSetup = (typeof BaseDirector !== 'undefined' && BaseDirector.estiloDeSetup)
      ? BaseDirector.estiloDeSetup() : null;
    return delSetup || '';
  }

  /** Crea un elemento con clase y texto opcionales. */
  function el(etiqueta, clase, texto) {
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
  function campo(padre, caption, control, nota) {
    const etiqueta = el('label', 'fichaCaption', caption);
    padre.appendChild(etiqueta);
    const celda = el('div', 'fichaCampo');
    celda.appendChild(control);
    if (nota) celda.appendChild(el('span', 'fichaNota', nota));
    padre.appendChild(celda);
    return control;
  }

  function entrada(tipo, extra) {
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
  function crearTarjetaImagen(def) {
    const tarjeta = el('div', 'fichaImagen');
    tarjeta.appendChild(el('h4', null, def.titulo +
      (def.obligatoria ? ' *' : '')));
    const marco = el('div', 'fichaMarco');
    const miniatura = el('img', 'fichaMiniatura oculto');
    miniatura.alt = def.titulo;
    const vacio = el('span', 'fichaVacio', 'Sin imagen');
    marco.append(miniatura, vacio);
    const info = el('div', 'fichaNota', def.ayuda);
    const fichero = entrada('file', { accept: 'image/png' });
    fichero.className = 'oculto';
    const cargar = el('button', null, 'Cargar…');
    cargar.type = 'button';
    const borrar = el('button', null, 'Borrar');
    borrar.type = 'button';
    borrar.disabled = true;
    const acciones = el('div', 'fichaAcciones');
    acciones.append(cargar, borrar);
    tarjeta.append(marco, info, acciones, fichero);

    imagenes[def.clave] = {
      img: null, nombre: null, url: null,
      ui: { miniatura, vacio, info, cargar, borrar, ayuda: def.ayuda }
    };

    cargar.addEventListener('click', () => fichero.click());
    fichero.addEventListener('change', () => {
      if (fichero.files && fichero.files[0]) cargarImagen(def.clave, fichero.files[0]);
      fichero.value = '';            // permite volver a elegir el mismo fichero
    });
    borrar.addEventListener('click', () => {
      vaciarImagen(def.clave);
      if (alCambiar) alCambiar(def.clave, null);
    });
    return tarjeta;
  }

  /**
   * Miniatura (data URL) de una imagen ya cargada: no depende de la
   * object URL de origen, que el director puede revocar.
   * @param {HTMLImageElement} img - Imagen cargada.
   * @returns {string} Data URL PNG.
   */
  function miniaturaDe(img) {
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
  function refrescarBotonesImagen(clave) {
    const d = imagenes[clave];
    if (!d) return;
    const bloqueada = clave === 'img_s' && imgSBloqueada;
    d.ui.cargar.disabled = bloqueada;
    d.ui.borrar.disabled = bloqueada || !d.img;
    d.ui.cargar.title = bloqueada
      ? 'Hay segmentos en memoria: img_s no se puede cambiar (carga otro GWB).' : '';
    d.ui.borrar.title = d.ui.cargar.title;
  }

  /**
   * Muestra una imagen ya cargada en su tarjeta.
   * @param {string} clave - 'img_s', 'img_f' o 'img_m'.
   * @param {HTMLImageElement} img - Imagen cargada.
   * @param {string} nombre - Nombre a mostrar.
   * @param {?string} url - Object URL propia (se libera al sustituirla).
   * @returns {void}
   */
  function colocarImagen(clave, img, nombre, url) {
    const datos = imagenes[clave];
    liberar(clave);
    datos.img = img;
    datos.nombre = nombre;
    datos.url = url || null;
    datos.ui.miniatura.src = miniaturaDe(img);
    datos.ui.miniatura.classList.remove('oculto');
    datos.ui.vacio.classList.add('oculto');
    datos.ui.info.textContent = nombre + ' — ' +
      img.naturalWidth + '×' + img.naturalHeight + ' px';
    refrescarBotonesImagen(clave);
  }

  /**
   * Carga un fichero PNG elegido por el usuario en la tarjeta, lo
   * muestra y avisa del cambio.
   * @param {string} clave - 'img_s', 'img_f' o 'img_m'.
   * @param {File} fichero - El PNG elegido.
   * @returns {void}
   */
  function cargarImagen(clave, fichero) {
    const url = URL.createObjectURL(fichero);
    const img = new Image();
    img.onload = () => {
      colocarImagen(clave, img, fichero.name, url);
      if (alCambiar) alCambiar(clave, img);
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
  function liberar(clave) {
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
  function vaciarImagen(clave) {
    const datos = imagenes[clave];
    liberar(clave);
    datos.img = null;
    datos.nombre = null;
    datos.ui.miniatura.removeAttribute('src');
    datos.ui.miniatura.classList.add('oculto');
    datos.ui.vacio.classList.remove('oculto');
    datos.ui.info.textContent = datos.ui.ayuda;
    refrescarBotonesImagen(clave);
  }

  // ---------------- Botones ----------------

  /**
   * Repinta la tabla de botones según el estilo elegido, conservando lo
   * ya escrito para cada número.
   * @returns {void}
   */
  function pintarTablaBotones() {
    // Guarda lo escrito antes de reconstruir.
    for (const fila of cuerpoBotones.querySelectorAll('tr[data-numero]')) {
      idsBoton[fila.dataset.numero] = {
        usado: fila.querySelector('input[type=checkbox]').checked,
        id: fila.querySelector('input[type=text]').value
      };
    }
    cuerpoBotones.textContent = '';
    const numeros = botonesDelEstilo(estiloEfectivo());
    if (numeros.length === 0) {
      const tr = el('tr');
      const td = el('td', 'fichaNota', 'Elige un estilo (o carga un setup) para ver los botones posibles.');
      td.colSpan = 3;
      tr.appendChild(td);
      cuerpoBotones.appendChild(tr);
      return;
    }
    for (const n of numeros) {
      const previo = idsBoton[String(n)] || { usado: false, id: '' };
      const tr = el('tr');
      tr.dataset.numero = String(n);
      const tdUsado = el('td');
      const usado = entrada('checkbox');
      usado.checked = previo.usado;
      tdUsado.appendChild(usado);
      const tdNumero = el('td', null, String(n) +
        (NOMBRE_SISTEMA[n] ? ' (' + NOMBRE_SISTEMA[n] + ')' : ''));
      const tdId = el('td');
      const id = entrada('text', { value: previo.id, placeholder: 'id lógico (IZQ, DER, Start…)' });
      id.disabled = !usado.checked;
      usado.addEventListener('change', () => { id.disabled = !usado.checked; });
      tdId.appendChild(id);
      tr.append(tdUsado, tdNumero, tdId);
      cuerpoBotones.appendChild(tr);
    }
  }

  // ---------------- Construcción ----------------

  /** Construye toda la ficha dentro de `contenedor`. */
  function construir(contenedor) {
    contenedor.textContent = '';

    // Datos del GWB
    const datos = el('section', 'fichaSeccion');
    datos.appendChild(el('h3', null, 'Datos del GWB'));
    const rejilla = el('div', 'fichaRejilla');
    campos.nombre = campo(rejilla, 'Nombre', entrada('text', { placeholder: 'Nombre del cartucho' }));
    const estilo = document.createElement('select');
    for (const [valor, texto] of [['', '(sin definir)'], ['2', '2 botones'],
    ['4', '4 botones'], ['5', '5 botones']]) {
      const o = document.createElement('option');
      o.value = valor; o.textContent = texto;
      estilo.appendChild(o);
    }
    campos.estilo = campo(rejilla, 'Estilo', estilo,
      'Opcional: si falta, se usa el del setup cargado.');
    const par = el('div', 'fichaPar');
    campos.ancho = entrada('number', { min: 1, step: 1, placeholder: 'ancho' });
    campos.alto = entrada('number', { min: 1, step: 1, placeholder: 'alto' });
    par.append(campos.ancho, el('span', null, '×'), campos.alto);
    campo(rejilla, 'Resolución', par,
      'Opcional: si falta, se usa la pantalla del setup cargado.');
    datos.appendChild(rejilla);
    contenedor.appendChild(datos);

    // Imágenes
    const seccionImg = el('section', 'fichaSeccion');
    seccionImg.appendChild(el('h3', null, 'Imágenes'));
    const fila = el('div', 'fichaImagenes');
    for (const def of IMAGENES) fila.appendChild(crearTarjetaImagen(def));
    seccionImg.appendChild(fila);
    seccionImg.appendChild(el('p', 'fichaNota', '* obligatoria para guardar el GWB.'));
    contenedor.appendChild(seccionImg);

    // Botones
    const seccionBot = el('section', 'fichaSeccion');
    seccionBot.appendChild(el('h3', null, 'Botones'));
    const tabla = el('table', 'fichaTabla');
    const cabecera = el('thead');
    const trCab = el('tr');
    for (const t of ['Usado', 'Botón', 'Id']) trCab.appendChild(el('th', null, t));
    cabecera.appendChild(trCab);
    cuerpoBotones = el('tbody');
    tabla.append(cabecera, cuerpoBotones);
    seccionBot.appendChild(tabla);
    seccionBot.appendChild(el('p', 'fichaNota',
      'Los botones 6, 7 y 8 son el trío de sistema A/B/R (presente en todos los estilos).'));
    contenedor.appendChild(seccionBot);

    // Guardado: mensajes de verificación y botón
    mensajes = el('div', 'fichaMensajes');
    const guardarBtn = el('button', null, 'Verificar y guardar GWB');
    guardarBtn.type = 'button';
    guardarBtn.title = 'Comprueba la ficha y genera cartucho_gwb.zip';
    guardarBtn.addEventListener('click', async () => {
      guardarBtn.disabled = true;           // evita guardados solapados
      try { await guardar(); } finally { guardarBtn.disabled = false; }
    });
    const pie = el('div', 'fichaAcciones');
    pie.appendChild(guardarBtn);
    contenedor.append(mensajes, pie);

    campos.estilo.addEventListener('change', pintarTablaBotones);
    pintarTablaBotones();
  }

  // ---------------- Verificación y guardado ----------------

  /** Muestra errores (rojo) y avisos (ámbar) bajo la ficha. */
  function pintarMensajes(errores, avisos) {
    mensajes.textContent = '';
    if (errores.length > 0) {
      mensajes.appendChild(el('strong', 'fichaError', 'La ficha tiene errores:'));
    }
    const lista = el('ul');
    for (const t of errores) lista.appendChild(el('li', 'fichaError', t));
    for (const t of avisos) lista.appendChild(el('li', 'fichaAviso', 'Aviso: ' + t));
    if (lista.children.length > 0) mensajes.appendChild(lista);
  }

  /**
   * Cuántos píxeles de la imagen NO son blanco o negro puros (solo
   * canales RGB). 0 = blanco y negro. Sirve para avisar de
   * antialiasing en img_s.
   * @param {HTMLImageElement} img - Imagen.
   * @returns {number} Píxeles que no son blanco/negro puros.
   */
  function pixelesNoBN(img) {
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
    asegurar();
    const e = estado();
    const delSetup = (typeof BaseDirector !== 'undefined' && BaseDirector.estiloDeSetup)
      ? BaseDirector.estiloDeSetup() : null;
    const pantalla = (typeof BaseDirector !== 'undefined' && BaseDirector.pantallaDeSetup)
      ? BaseDirector.pantallaDeSetup() : null;

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
        ') difiere de la del setup (' + pantalla.ancho + '×' + pantalla.alto + ')' +
        (opt.generar ? ': el GWC se genera a la pantalla del setup (escalar a la ' +
          'resolución de la ficha queda pendiente).' : '.'));
    }

    // Imágenes: img_s obligatoria. Los tamaños pueden diferir (img_s
    // grande para trabajar cómodo): el GWC las escala al generarse.
    const s = e.imagenes.img_s, f = e.imagenes.img_f;
    if (!s) {
      errores.push('Falta img_s (obligatoria: de ella se extrae la geometría).');
    } else {
      if (f && (s.imagen.naturalWidth !== f.imagen.naturalWidth ||
        s.imagen.naturalHeight !== f.imagen.naturalHeight)) {
        avisos.push('img_s (' + s.imagen.naturalWidth + '×' + s.imagen.naturalHeight +
          ') e img_f (' + f.imagen.naturalWidth + '×' + f.imagen.naturalHeight +
          ') miden distinto (se escalarán al generar el GWC).');
      }
      if (e.resolucion && (s.imagen.naturalWidth !== e.resolucion.ancho ||
        s.imagen.naturalHeight !== e.resolucion.alto)) {
        avisos.push('img_s mide ' + s.imagen.naturalWidth + '×' + s.imagen.naturalHeight +
          ' y la resolución declarada es ' + e.resolucion.ancho + '×' + e.resolucion.alto + '.');
      }
      const raros = pixelesNoBN(s.imagen);
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
    if (e.botones.length === 0) avisos.push('El cartucho no declara botones: se usarán los del setup.');
    // Validación del contrato del GWB (la misma que al cargarlo). El
    // mapa de ficheros se monta aquí con las imágenes en memoria.
    if (errores.length === 0) {
      const json = montarGWB();
      const mapa = new Map(Object.values(json.imagenes).map(n => [n, true]));
      const fallo = BaseCartucho.validarGWB(json, mapa, json.estilo || delSetup);
      if (fallo) errores.push('Validación del GWB: ' + fallo);
    }
    if (opt.mostrar) pintarMensajes(errores, avisos);
    return { errores: errores, avisos: avisos };
  }

  /**
   * Monta el objeto GWB desde la ficha (ya verificada).
   * @returns {Object} GWB listo para serializar.
   */
  function montarGWB() {
    const e = estado();
    const json = { tipo: 'GWB', version: 1, nombre: e.nombre };
    if (e.estilo) json.estilo = e.estilo;
    if (e.resolucion) json.resolucion = e.resolucion;
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
    asegurar();
    const { errores } = verificar({ mostrar: true });
    if (errores.length > 0) {
      BaseDirector.avisarError('El GWB no se guarda: ' + errores.length +
        (errores.length === 1 ? ' error' : ' errores') + ' en la ficha.');
      return false;
    }
    const e = estado();
    const tamano = await BaseCartucho.guardarGWB(montarGWB(),
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
      construir(contenedor);
      refrescarBotonesImagen('img_s');
    } else {
      pintarTablaBotones();           // el setup pudo cambiar desde la última visita
    }
  }

  /**
   * Construye la ficha si aún no existe (el director puede poblarla
   * antes de que el usuario abra la pestaña).
   * @returns {void}
   */
  function asegurar() {
    if (!raiz) pintar(document.getElementById('fichaCartucho'));
  }

  /**
   * Lee la ficha tal cual está (sin completar con el setup).
   * @returns {{nombre:string, estilo:?string, resolucion:?Object,
   *   imagenes:Object, botones:Array}} Datos de la ficha.
   */
  function estado() {
    asegurar();
    pintarTablaBotones();             // vuelca lo escrito en idsBoton
    const ancho = parseInt(campos.ancho.value, 10);
    const alto = parseInt(campos.alto.value, 10);
    const imgs = {};
    for (const d of IMAGENES) {
      imgs[d.clave] = imagenes[d.clave].img
        ? { imagen: imagenes[d.clave].img, nombre: imagenes[d.clave].nombre } : null;
    }
    const botones = botonesDelEstilo(estiloEfectivo())
      .filter(n => idsBoton[String(n)] && idsBoton[String(n)].usado)
      .map(n => ({ numero: n, id: idsBoton[String(n)].id.trim() }));
    return {
      nombre: campos.nombre.value.trim(),
      estilo: campos.estilo.value || null,
      resolucion: (ancho > 0 && alto > 0) ? { ancho: ancho, alto: alto } : null,
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
    asegurar();
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
    asegurar();
    for (const d of IMAGENES) vaciarImagen(d.clave);
    idsBoton = {};
    extras = {};
    campos.nombre.value = '';
    campos.estilo.value = '';
    campos.ancho.value = '';
    campos.alto.value = '';
    cuerpoBotones.textContent = '';
    pintarTablaBotones();
    if (mensajes) mensajes.textContent = '';
  }

  /**
   * Rellena la ficha desde una carga (GWS, GWB o GWI). Solo toca lo que
   * viene definido; el director llama antes a reiniciar().
   * @param {{nombre:?string, estilo:?(string|number), resolucion:?Object,
   *   botones:?Array<{numero:(string|number), id:?string}>,
   *   imagenes:?Object, extras:?Object}} d - Datos a mostrar.
   * @returns {void}
   */
  function poblar(d) {
    asegurar();
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
    if (d.botones !== undefined) {
      idsBoton = {};
      for (const b of d.botones || []) {
        idsBoton[String(b.numero)] = { usado: true, id: b.id ? String(b.id) : '' };
      }
      cuerpoBotones.textContent = '';   // que no pise lo recién cargado
    }
    pintarTablaBotones();
    if (d.imagenes) {
      for (const [clave, img] of Object.entries(d.imagenes)) {
        if (img && imagenes[clave]) ponerImagen(clave, img, clave + '.png');
      }
    }
    if (d.extras) extras = Object.assign({}, d.extras);
    if (mensajes) mensajes.textContent = '';
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
    asegurar();
    if (!imagenes[clave]) return;
    if (img) colocarImagen(clave, img, nombre || clave + '.png', null);
    else vaciarImagen(clave);
  }

  /**
   * Bloquea o desbloquea Cargar y Borrar de img_s (con segmentos en
   * memoria, los segmentos salen de ella).
   * @param {boolean} bloquear - true para bloquear.
   * @returns {void}
   */
  function bloquearImgS(bloquear) {
    imgSBloqueada = !!bloquear;
    if (raiz) refrescarBotonesImagen('img_s');
  }

  /**
   * Registra quién se entera de los cambios de imagen hechos por el
   * usuario (Cargar o Borrar).
   * @param {function(string, ?HTMLImageElement):void} fn - Recibe la
   *        clave y la imagen nueva (null si se borró).
   * @returns {void}
   */
  function alCambiarImagen(fn) {
    alCambiar = fn;
  }

  return {
    pintar: pintar,
    reiniciar: reiniciar,
    poblar: poblar,
    ponerImagen: ponerImagen,
    bloquearImgS: bloquearImgS,
    alCambiarImagen: alCambiarImagen,
    estado: estado,
    datosCartucho: datosCartucho,
    imagenesEnMemoria: imagenesEnMemoria,
    verificar: verificar,
    guardar: guardar,
    botonesDelEstilo: botonesDelEstilo
  };

})();
