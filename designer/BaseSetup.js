'use strict';

// BaseSetup.js
// ==================================================
//
// PROPÓSITO
//   La pestaña «Setup» (F5-I12): la ficha del setup (GWS), con los
//   datos de la máquina: nombre, descripción, estilo, resolución y la
//   tabla de botones (número, puerto, tecla y alias). Sirve para crear
//   un GWS desde cero o para ver y retocar el que se ha cargado.
//
// BORRADOR
//   Lo que se escribe en la ficha NO afecta al resto del programa hasta
//   que se pulsa Aplicar (o Guardar GWS, que guarda y aplica). Cargar un
//   GWS rellena la ficha y lo aplica el director. Un aviso indica que
//   hay cambios sin aplicar.
//
// SEPARACIÓN
//   No aplica nada ni conoce al director salvo para validar: la
//   verificación reutiliza BaseDirector.validarSetup (las mismas
//   reglas que al cargar un GWS), así un GWS creado aquí se puede
//   cargar siempre. Es el director quien llama a poblar y quien
//   aplica el JSON que devuelve leer.
//
// FUNCIONES
//  Pantalla
//   pintar             Construye la ficha (la primera vez) en el contenedor.
//   reiniciar          Deja la ficha en blanco.
//   poblar             Rellena la ficha desde un GWS ya leído (y la da por aplicada).
//  Lectura
//   leer               Construye el JSON del GWS con lo que hay en la ficha.
//   verificar          Valida la ficha con las reglas del director.
//   guardar            Verifica y descarga el GWS (.json).
//  Aplicar
//   hayCambios         ¿Hay cambios sin aplicar (borrador)?
//   marcarAplicado     Da la ficha por aplicada (apaga el aviso).
//   botonesDelEstilo   Números de botón posibles de un estilo.
//  Internas
//   asegurar, el, campo, marcarCambios, pintarTablaBotones,
//   pintarMensajes, nombreFichero, descargar.

const BaseSetup = (function () {

  const GWS_TIPO = 'GWS';
  const GWS_VERSION = '1';

  const TRIO_SISTEMA = [6, 7, 8];
  const NOMBRE_SISTEMA = { 6: 'A', 7: 'B', 8: 'R' };
  const BOTONES_POR_ESTILO = {
    '2': [0, 4, ...TRIO_SISTEMA],
    '4': [0, 1, 4, 5, ...TRIO_SISTEMA],
    '5': [0, 1, 2, 3, 4, ...TRIO_SISTEMA]
  };

  let raiz = null;                // contenedor ya construido
  let campos = {};                // nombre, descripcion, estilo, ancho, alto
  let datosBoton = {};            // número → {puerto, tecla, alias} (sobrevive al cambio de estilo)
  let cuerpoBotones = null;
  let mensajes = null;
  let avisoCambios = null;
  let sucio = false;

  /**
   * Números de botón posibles de un estilo (incluido el trío A/B/R).
   * @param {string} estilo - '2', '4' o '5'.
   * @returns {number[]} Los números (vacío si el estilo no es válido).
   */
  function botonesDelEstilo(estilo) {
    return (BOTONES_POR_ESTILO[estilo] || []).slice();
  }

  /** Crea un elemento con clase y texto opcionales. */
  function el(etiqueta, clase, texto) {
    const e = document.createElement(etiqueta);
    if (clase) e.className = clase;
    if (texto !== undefined) e.textContent = texto;
    return e;
  }

  //++
  // /** Añade una fila «caption + control (+ nota)» a la rejilla. */
  // function campo(padre, caption, control, nota) {
  //   padre.appendChild(el('div', 'fichaCaption', caption));
  //   const celda = el('div', 'fichaCampo');
  //   celda.appendChild(control);
  //   if (nota) celda.appendChild(el('span', 'fichaNota', nota));
  //   padre.appendChild(celda);
  //   return control;
  // }

/** Añade una fila «caption + control (+ nota)» a la rejilla. */
function campo(padre, caption, control, nota, multilinea = false) {
  const lbl = el('div', 'fichaCaption', caption);
  const celda = el('div', 'fichaCampo');

  if (multilinea) {
    // Si no pasas un control o pasas un input normal, creamos un textarea
    if (!control || control.tagName !== 'TEXTAREA') {
      control = el('textarea');
    }
    control.rows = 3;
    lbl.classList.add('multilinea');   // Clase extra por si quieres alinear arriba
    celda.classList.add('multilinea'); // Clase extra para que ocupe más ancho si quieres
  }

  celda.appendChild(control);
  if (nota) celda.appendChild(el('span', 'fichaNota', nota));

  padre.appendChild(lbl);
  padre.appendChild(celda);
  return control;
}


  /** Crea un input con atributos. */
  function entrada(tipo, extra) {
    const i = document.createElement('input');
    i.type = tipo;
    Object.assign(i, extra || {});
    return i;
  }

  /**
   * Marca (o desmarca) la ficha como borrador con cambios sin aplicar.
   * @param {boolean} hay - true si hay cambios sin aplicar.
   * @returns {void}
   */
  function marcarCambios(hay) {
    sucio = !!hay;
    if (avisoCambios) avisoCambios.classList.toggle('oculto', !sucio);
  }

  /**
   * Indica si la ficha tiene cambios sin aplicar.
   * @returns {boolean} true si hay cambios sin aplicar.
   */
  function hayCambios() {
    return sucio;
  }

  /**
   * Vuelca a datosBoton lo escrito en la tabla (para que sobreviva al
   * cambio de estilo) y la vuelve a pintar con los botones del estilo
   * elegido.
   * @returns {void}
   */
  function pintarTablaBotones() {
    for (const tr of cuerpoBotones.querySelectorAll('tr[data-numero]')) {
      const q = (c) => tr.querySelector('.' + c).value;
      datosBoton[tr.dataset.numero] = { puerto: q('colPuerto'), tecla: q('colTecla'), alias: q('colAlias') };
    }
    cuerpoBotones.textContent = '';
    const numeros = botonesDelEstilo(campos.estilo.value);
    if (numeros.length === 0) {
      const tr = el('tr');
      const td = el('td', 'fichaVacio', 'Elige un estilo para ver los botones.');
      td.colSpan = 4;
      tr.appendChild(td);
      cuerpoBotones.appendChild(tr);
      return;
    }
    for (const n of numeros) {
      const d = datosBoton[String(n)] || { puerto: '', tecla: '', alias: '' };
      const tr = el('tr');
      tr.dataset.numero = String(n);
      const tdN = el('td', null, String(n) + (NOMBRE_SISTEMA[n] ? ' (' + NOMBRE_SISTEMA[n] + ')' : ''));
      const puerto = entrada('number', { className: 'colPuerto', min: 0, step: 1, value: d.puerto });
      const tecla = entrada('text', { className: 'colTecla', maxLength: 1, value: d.tecla });
      tecla.style.width = '3em';
      const alias = entrada('text', { className: 'colAlias', value: d.alias });
      alias.style.minWidth = '8em';
      for (const c of [puerto, tecla, alias]) {
        const td = el('td');
        td.appendChild(c);
        tr.appendChild(td);
      }
      tr.insertBefore(tdN, tr.firstChild);
      cuerpoBotones.appendChild(tr);
    }
  }

  /**
   * Construye la ficha dentro del contenedor.
   * @param {HTMLElement} contenedor - Elemento donde se construye.
   * @returns {void}
   */
  function construir(contenedor) {
    contenedor.textContent = '';
    avisoCambios = el('p', 'fichaAviso oculto', 'Hay cambios sin aplicar: pulsa Aplicar o Guardar GWS para ponerlos en marcha.');
    contenedor.appendChild(avisoCambios);

    const datos = el('section', 'fichaSeccion');
    datos.appendChild(el('h3', null, 'Datos del GWS'));
    const rejilla = el('div', 'fichaRejilla');
    campos.nombre = campo(rejilla, 'Nombre', entrada('text', { placeholder: 'Nombre de la máquina' }), 'También da nombre al fichero .json.');
    campos.descripcion = campo(rejilla, 'Descripción', entrada('text', { placeholder: 'Opcional: la máquina y su manejo' }),'Informativa', true);
    const estilo = document.createElement('select');
    for (const [valor, texto] of [['', '(elige estilo)'], ['2', '2 botones'], ['4', '4 botones'], ['5', '5 botones']]) {
      const o = document.createElement('option');
      o.value = valor; o.textContent = texto;
      estilo.appendChild(o);
    }
    campos.estilo = campo(rejilla, 'Estilo', estilo);
    const par = el('div', 'fichaPar');
    campos.ancho = entrada('number', { min: 1, step: 1, placeholder: 'ancho' });
    campos.alto = entrada('number', { min: 1, step: 1, placeholder: 'alto' });
    par.append(campos.ancho, el('span', null, '×'), campos.alto);
    campo(rejilla, 'Resolución', par, 'Píxeles de la pantalla.');
    datos.appendChild(rejilla);
    contenedor.appendChild(datos);

    const seccionBot = el('section', 'fichaSeccion');
    seccionBot.appendChild(el('h3', null, 'Botones'));
    const tabla = el('table', 'fichaTabla');
    const cab = el('thead');
    const trCab = el('tr');
    for (const t of ['Botón', 'Puerto', 'Tecla', 'Alias']) trCab.appendChild(el('th', null, t));
    cab.appendChild(trCab);
    cuerpoBotones = el('tbody');
    tabla.append(cab, cuerpoBotones);
    seccionBot.appendChild(tabla);
    seccionBot.appendChild(el('p', 'fichaNota',
      'Puerto: pin del botón en la máquina real. Tecla: letra del teclado para probar en el simulador. ' +
      'Los botones 6, 7 y 8 son el trío de sistema A/B/R (presente en todos los estilos).'));
    contenedor.appendChild(seccionBot);

    mensajes = el('div', 'fichaMensajes');
    contenedor.appendChild(mensajes);

    campos.estilo.addEventListener('change', pintarTablaBotones);
    contenedor.addEventListener('input', () => marcarCambios(true));
    contenedor.addEventListener('change', () => marcarCambios(true));
    pintarTablaBotones();
  }

  /**
   * Construye la ficha si aún no existe.
   * @param {HTMLElement} [contenedor] - Contenedor (por defecto #fichaSetup).
   * @returns {void}
   */
  function pintar(contenedor) {
    const c = contenedor || document.getElementById('fichaSetup');
    if (raiz !== c) {
      raiz = c;
      campos = {}; datosBoton = {};
      construir(c);
    }
  }

  /** Garantiza que la ficha esté construida. */
  function asegurar() {
    if (!raiz) pintar();
  }

  /**
   * Deja la ficha en blanco.
   * @returns {void}
   */
  function reiniciar() {
    asegurar();
    datosBoton = {};
    campos.nombre.value = '';
    campos.descripcion.value = '';
    campos.estilo.value = '';
    campos.ancho.value = '';
    campos.alto.value = '';
    pintarTablaBotones();
    mensajes.textContent = '';
    marcarCambios(false);
  }

  /**
   * Rellena la ficha desde un GWS ya leído y la da por aplicada.
   * @param {Object} json - El GWS (nombre, descripcion, estilo, resolucion, botones).
   * @returns {void}
   */
  function poblar(json) {
    asegurar();
    reiniciar();
    campos.nombre.value = json.nombre || '';
    campos.descripcion.value = json.descripcion || '';
    campos.estilo.value = String(json.estilo);
    if (json.resolucion) {
      campos.ancho.value = json.resolucion.ancho;
      campos.alto.value = json.resolucion.alto;
    }
    for (const b of json.botones || []) {
      datosBoton[String(b.numero)] = {
        puerto: b.puerto === undefined ? '' : String(b.puerto),
        tecla: b.tecla || '',
        alias: b.alias || ''
      };
    }
    pintarTablaBotones();
    marcarCambios(false);
  }

  /**
   * Construye el GWS con lo que hay en la ficha (sin validar). Un botón
   * entra si tiene puerto, tecla o alias; el puerto es un número.
   * @returns {Object} El JSON del GWS.
   */
  function leer() {
    asegurar();
    pintarTablaBotones();             // vuelca lo escrito en datosBoton
    const json = { tipo: GWS_TIPO, version: GWS_VERSION, nombre: campos.nombre.value.trim() };
    const desc = campos.descripcion.value.trim();
    if (desc !== '') json.descripcion = desc;
    json.estilo = campos.estilo.value;
    json.resolucion = {
      ancho: parseInt(campos.ancho.value, 10),
      alto: parseInt(campos.alto.value, 10)
    };
    json.botones = [];
    for (const n of botonesDelEstilo(campos.estilo.value)) {
      const d = datosBoton[String(n)];
      if (!d) continue;
      const b = { numero: String(n) };
      if (String(d.puerto).trim() !== '') b.puerto = Number(d.puerto);
      if (d.tecla.trim() !== '') b.tecla = d.tecla.trim().toUpperCase();
      if (d.alias.trim() !== '') b.alias = d.alias.trim();
      json.botones.push(b);
    }
    return json;
  }

  /** Muestra errores (rojo) y avisos (ámbar) bajo la ficha. */
  function pintarMensajes(errores, avisos) {
    mensajes.textContent = '';
    for (const [lista, clase, titulo] of [[errores, 'fichaError', 'Errores'], [avisos, 'fichaAviso', 'Avisos']]) {
      if (lista.length === 0) continue;
      const bloque = el('div', clase, titulo + ':');
      const ul = el('ul');
      for (const m of lista) ul.appendChild(el('li', null, m));
      bloque.appendChild(ul);
      mensajes.appendChild(bloque);
    }
  }

  /**
   * Verifica la ficha con las MISMAS reglas que al cargar un GWS
   * (BaseDirector.validarSetup), más las comprobaciones propias de
   * un setup nuevo: nombre, puertos y teclas sin repetir.
   * @param {{mostrar:boolean}} [opciones] - mostrar: pinta los mensajes bajo la ficha.
   * @returns {{errores:string[], avisos:string[], json:Object}} Resultado.
   */
  function verificar(opciones) {
    const opt = opciones || {};
    const errores = [], avisos = [];
    const json = leer();
    if (json.nombre === '') errores.push('Falta el nombre.');
    if (json.estilo === '') {
      errores.push('Falta elegir el estilo (2, 4 o 5 botones).');
    } else {
      const fallo = BaseDirector.validarSetup(json);
      if (fallo) errores.push(fallo.charAt(0).toUpperCase() + fallo.slice(1));
      const puertos = new Set(), teclas = new Set();
      for (const b of json.botones) {
        if (b.puerto !== undefined) {
          if (!Number.isInteger(b.puerto) || b.puerto < 0) {
            errores.push('El puerto del botón ' + b.numero + ' debe ser un entero positivo.');
          } else if (puertos.has(b.puerto)) {
            errores.push('El puerto ' + b.puerto + ' está repetido.');
          }
          puertos.add(b.puerto);
        }
        if (b.tecla !== undefined) {
          if (teclas.has(b.tecla)) errores.push('La tecla ' + b.tecla + ' está repetida.');
          teclas.add(b.tecla);
        }
      }
      // Todos los botones del estilo (trío A/B/R incluido) necesitan puerto
      // (lo usa la máquina real); sin tecla se usa la de por defecto.
      for (const n of botonesDelEstilo(json.estilo)) {
        const b = json.botones.find(x => x.numero === String(n));
        if (!b || b.puerto === undefined) errores.push('Falta el puerto del botón ' + n + '.');
        else if (b.tecla === undefined) avisos.push('El botón ' + n + ' no tiene tecla: se usará la de por defecto.');
      }
    }
    if (opt.mostrar) pintarMensajes(errores, avisos);
    return { errores: errores, avisos: avisos, json: json };
  }

  /**
   * Nombre de fichero válido a partir del nombre del setup.
   * @param {string} nombre - Nombre del setup.
   * @returns {string} P. ej. «setup_ESP32 GW 4 botones.json».
   */
  function nombreFichero(nombre) {
    const limpio = nombre.replace(/[\\/:*?"<>|]/g, '_').trim() || 'setup';
    return limpio + '.json';
  }

  /**
   * Descarga un texto como fichero.
   * @param {string} nombre - Nombre del fichero.
   * @param {string} texto - Contenido.
   * @returns {void}
   */
  function descargar(nombre, texto) {
    const url = URL.createObjectURL(new Blob([texto], { type: 'application/json' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = nombre;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  /**
   * Verifica la ficha y, si es correcta, descarga el GWS (.json único).
   * No aplica: de eso se encarga el director con el JSON devuelto.
   * @returns {?Object} El GWS guardado, o null si hay errores.
   */
  function guardar() {
    const r = verificar({ mostrar: true });
    if (r.errores.length > 0) return null;
    descargar(nombreFichero(r.json.nombre), JSON.stringify(r.json, null, 2));
    return r.json;
  }

  return {
    pintar: pintar,
    reiniciar: reiniciar,
    poblar: poblar,
    leer: leer,
    verificar: verificar,
    guardar: guardar,
    hayCambios: hayCambios,
    marcarAplicado: () => marcarCambios(false),
    botonesDelEstilo: botonesDelEstilo
  };

})();
