'use strict';

// baseSetup.js
// ================================================================================================
// PROPÓSITO
//   La pestaña «Setup» (F5-I12): la ficha del setup (GWS), con los
//   datos de la máquina: nombre, descripción, estilo, resolución y la
//   tabla de botones (número, puerto, tecla y texto de pantalla;
//   F5-I21: el campo «textoPantalla» es el que viaja a los cartuchos).
//   Sirve para crear un GWS desde cero o para ver y retocar el que se
//   ha cargado.
//
// BORRADOR
//   Lo que se escribe en la ficha NO afecta al resto del programa hasta
//   que se pulsa Aplicar (o Guardar GWS, que guarda y aplica). Cargar un
//   GWS rellena la ficha y lo aplica el director. Un aviso indica que
//   hay cambios sin aplicar.
//
// SEPARACIÓN
//   No aplica nada ni conoce al director salvo para validar: la
//   verificación reutiliza baseDirector.validarSetup (las mismas
//   reglas que al cargar un GWS), así un GWS creado aquí se puede
//   cargar siempre. Es el director quien llama a poblar y quien
//   aplica el JSON que devuelve leer.
//
// MEMORIA (F5-I20, MA02; F5-I21)
//   «RAM (KB)» y «FLASH (KB)» son opcionales (vacío = 0 = no declarada) y
//   viajan como «memoria» {RAM, FLASH} en la raíz del GWS, subcampo a
//   subcampo y solo si no son 0. Son informativos: se usan al generar el GWC.
//   Solo se editan AQUÍ (F5-I21): la pestaña Cartucho ya no los tiene, y los
//   cartuchos generados (GWB/GWI) llevan los del Setup. Debajo hay UN
//   informativo de solo lectura, «Último GWC calculado», con los datos en
//   RAM y, si hay, el fondo en FLASH; se rellena SOLO al generar el GWC
//   (informarUltimos) o al cargar un cartucho, y sus BYTES se guardan
//   dentro de «memoria» como «ultimoGWC» y «ultimoGWCimg» (F5-I21): así
//   sobreviven a Aplicar y viajan en el GWS y en los cartuchos.
//
// FUNCIONES
//   Pantalla
//     pintar             Construye la ficha (la primera vez) en el contenedor.
//     reiniciar          Deja la ficha en blanco.
//     poblar             Rellena la ficha desde un GWS ya leído (y la da por aplicada).
//   Lectura
//     leer               Construye el JSON del GWS con lo que hay en la ficha.
//     verificar          Valida la ficha con las reglas del director.
//     guardar            Verifica y descarga el GWS (.json, sin los informativos del último GWC: F5-I21).
//   Aplicar
//     hayCambios         ¿Hay cambios sin aplicar (borrador)?
//     marcarAplicado     Da la ficha por aplicada (apaga el aviso).
//     fijarResolucion    Pone ancho y alto (solo lectura) tras el ajuste de resolución (F5-I21).
//     informarUltimos    Rellena el informativo «Último GWC calculado»: datos en RAM y fondo en FLASH (F5-I21, A02).
//     botonesDelEstilo   Números de botón posibles de un estilo.
//   Internas
//     _asegurar              _crearElemento      _campo
//     _descargar             _marcarCambios      _nombreFichero    
//     _pintarTablaBotones    _pintarMensajes     _entrada
//     _teclaDeFila           _construir          _limpiarUltimos
//     _pintarUltimos
// ====================================================================================================

const baseSetup = (function () {

  const GWS_TIPO = 'GWS';
  const GWS_VERSION = '1';

  const TRIO_SISTEMA = [6, 7, 8];
  const NOMBRE_SISTEMA = { 6: 'A', 7: 'B', 8: 'R' };
  // F5-I17 (M5): los cuatro nombres de cursor admitidos como tecla
  // (misma lista cerrada que valida baseDirector.validarSetup).
  const CURSORES_GWS = ['cursor-izquierda', 'cursor-derecha', 'cursor-arriba', 'cursor-abajo'];
  const BOTONES_POR_ESTILO = {
    '2': [0, 4, ...TRIO_SISTEMA],
    '4': [0, 1, 4, 5, ...TRIO_SISTEMA],
    '5': [0, 1, 2, 3, 4, ...TRIO_SISTEMA]
  };

  let raiz = null;                // contenedor ya construido
  let campos = {};                // nombre, descripcion, estilo, ancho, alto (F5-I21: solo lectura), ram, flash
  let datosBoton = {};            // número → {puerto, tecla, textoPantalla} (sobrevive al cambio de estilo)
  let cuerpoBotones = null;
  let mensajes = null;
  let avisoCambios = null;
  let sucio = false;
  let ultimoGWC = 0;              // bytes de DATOS del Último GWC calculado (F5-I21)
  let ultimoGWCimg = 0;           // bytes del BLOQUE del fondo de ese GWC (A02)

  /**
   * Números de botón posibles de un estilo (incluido el trío A/B/R).
   * @param {string} estilo - '2', '4' o '5'.
   * @returns {number[]} Los números (vacío si el estilo no es válido).
   */
  function botonesDelEstilo(estilo) {
    return (BOTONES_POR_ESTILO[estilo] || []).slice();
  }

  /** Crea un elemento con clase y texto opcionales. 
   * @param {string} etiqueta - Nombre de la etiqueta.
   * @param {string} [clase] - Clase CSS opcional.
   * @param {string} [texto] - Texto opcional.
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


  /** Crea un input con atributos. 
   * @param {string} tipo - El tipo de input.
   * @param {Object} extra - Atributos adicionales para el input.
   * @returns {HTMLInputElement} El elemento input creado.
  */
  function _entrada(tipo, extra) {
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
  function _marcarCambios(hay) {
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
   * F5-I17 (M5): la tecla efectiva de una fila de la tabla: el nombre
   * de cursor elegido en la lista, o la letra de la casilla cuando la
   * lista está en «tecla». Sin tecla, ''.
   * @param {HTMLTableRowElement} tr - Fila del botón.
   * @returns {string} La tecla tal como va al JSON del GWS.
   */
  function _teclaDeFila(tr) {
    const lista = tr.querySelector('.colTeclaLista');
    if (!lista) return '';
    if (lista.value !== 'tecla') return lista.value;
    const letra = tr.querySelector('.colTeclaLetra');
    return letra ? letra.value : '';
  }

  /**
   * Vuelca a datosBoton lo escrito en la tabla (para que sobreviva al cambio de estilo) 
   * y la vuelve a pintar con los botones del estilo elegido.
   * @returns {void}
   */
  function _pintarTablaBotones() {
    for (const tr of cuerpoBotones.querySelectorAll('tr[data-numero]')) {
      const q = (c) => tr.querySelector('.' + c).value;
      // F5-I21: el «Texto Pantalla» del botón viaja como "textoPantalla".
      datosBoton[tr.dataset.numero] = { puerto: q('colPuerto'), tecla: _teclaDeFila(tr), textoPantalla: q('colTextoPantalla') };
    }
    cuerpoBotones.textContent = '';
    const numeros = botonesDelEstilo(campos.estilo.value);
    if (numeros.length === 0) {
      const tr = _crearElemento('tr');
      const td = _crearElemento('td', 'fichaVacio', 'Elige un estilo para ver los botones.');
      td.colSpan = 4;
      tr.appendChild(td);
      cuerpoBotones.appendChild(tr);
      return;
    }
    for (const n of numeros) {
      const d = datosBoton[String(n)] || { puerto: '', tecla: '', textoPantalla: '' };
      const tr = _crearElemento('tr');
      tr.dataset.numero = String(n);
      const tdN = _crearElemento('td', null, String(n) + (NOMBRE_SISTEMA[n] ? ' (' + NOMBRE_SISTEMA[n] + ')' : ''));
      const puerto = _entrada('number', {
        className: 'colPuerto', min: 0, step: 1,
        max: baseCartucho.MAX_PUERTO_GWS, value: d.puerto
      });
      puerto.addEventListener('change', () => {
        if (puerto.value === '') return;
        const ajustado = baseCartucho.limitarValor(Number(puerto.value),
          baseCartucho.MAX_PUERTO_GWS, 0);
        if (typeof ajustado === 'number' && ajustado !== Number(puerto.value)) {
          puerto.value = String(ajustado);
          baseDirector.avisar('El puerto del botón ' + tr.dataset.numero +
            ' limitado a ' + ajustado + '.');
        }
      });
      // F5-I17 (M5): la tecla se elige en una lista cerrada (los cuatro
      // cursores y «Propia»); al elegir «Propia» aparece la casilla de
      // letra (A..Z, o 1/2/3 solo en el trío A/B/R). Ya no se teclea el
      // nombre a mano.
      const lista = _crearElemento('select', 'colTeclaLista');
      for (const [valor, texto] of [['', '(sin tecla)'], ...CURSORES_GWS.map(c => [c, c]),
      ['tecla', 'Propia (letra)']]) {
        const o = document.createElement('option');
        o.value = valor; o.textContent = texto;
        lista.appendChild(o);
      }
      const nombre = String(d.tecla || '').trim().toLowerCase();
      if (CURSORES_GWS.includes(nombre)) lista.value = nombre;
      else if (/^[a-zA-Z]$/.test(nombre) ||
        (/^[1-3]$/.test(nombre) && NOMBRE_SISTEMA[n])) lista.value = 'tecla';
      else lista.value = '';
      const tecla = _entrada('text', {
        className: 'colTeclaLetra', maxLength: 1,
        value: lista.value === 'tecla' ? String(d.tecla || '').toUpperCase() : ''
      });
      tecla.classList.toggle('oculto', lista.value !== 'tecla');
      tecla.placeholder = NOMBRE_SISTEMA[n] ? 'A..Z o 1-3' : 'A..Z';
      lista.addEventListener('change', () => {
        tecla.classList.toggle('oculto', lista.value !== 'tecla');
        if (lista.value !== 'tecla') tecla.value = '';
      });
      const textoPantalla = _entrada('text', { className: 'colTextoPantalla', value: d.textoPantalla });
      textoPantalla.style.minWidth = '8em';
      const tdPuerto = _crearElemento('td');
      tdPuerto.appendChild(puerto);
      const tdTecla = _crearElemento('td');
      tdTecla.append(lista, tecla);
      const tdTexto = _crearElemento('td');
      tdTexto.appendChild(textoPantalla);
      tr.append(tdPuerto, tdTecla, tdTexto);
      tr.insertBefore(tdN, tr.firstChild);
      cuerpoBotones.appendChild(tr);
    }
  }

  /**
   * Construye la ficha dentro del contenedor.
   * @param {HTMLElement} contenedor - Elemento donde se construye.
   * @returns {void}
   */
  function _construir(contenedor) {
    contenedor.textContent = '';
    avisoCambios = _crearElemento('p', 'fichaAviso oculto', 'Hay cambios sin aplicar: pulsa Aplicar o Guardar GWS para ponerlos en marcha.');
    contenedor.appendChild(avisoCambios);

    const datos = _crearElemento('section', 'fichaSeccion');
    datos.appendChild(_crearElemento('h3', null, 'Datos del GWS'));
    const rejilla = _crearElemento('div', 'fichaRejilla');
    campos.nombre = _campo(rejilla,
      'Nombre del Setup',
      _entrada('text', { placeholder: 'Nombre de la máquina' }),
      'También da nombre al fichero .json.');
    campos.descripcion = _campo(rejilla,
      'Descripción del Setup',
      _entrada('text', { placeholder: 'Opcional: la máquina y su manejo' }),
      'Informativa',
      true);
    const estilo = document.createElement('select');
    for (const [valor, texto] of [['', '(elige estilo)'], ['2', '2 botones'], ['4', '4 botones'], ['5', '5 botones']]) {
      const o = document.createElement('option');
      o.value = valor; o.textContent = texto;
      estilo.appendChild(o);
    }
    campos.estilo = _campo(rejilla, 'Estilo', estilo);
    const par = _crearElemento('div', 'fichaPar');
    // F5-I21: el ancho y el alto NO se editan a mano; se cambian con el
    // botón «Ajustar resolución» (su ventana muestra los valores actuales,
    // los nuevos, el factor de escala y si afecta a los segmentos).
    campos.ancho = _entrada('number', { min: 1, max: baseCartucho.PANTALLA_MAX.ancho, step: 1, placeholder: 'ancho', readOnly: true });
    campos.alto = _entrada('number', { min: 1, max: baseCartucho.PANTALLA_MAX.alto, step: 1, placeholder: 'alto', readOnly: true });
    par.append(campos.ancho, _crearElemento('span', null, '×'), campos.alto);
    const btnAjustar = document.createElement('button');
    btnAjustar.type = 'button';
    btnAjustar.textContent = 'Ajustar resolución';
    btnAjustar.title = 'Ventana de ajuste (F5-I21): valores actuales, nuevos, factor de escala y si afecta a los segmentos.';
    par.appendChild(btnAjustar);
    _campo(rejilla, 'Resolución', par, 'Se cambia con el botón, no a mano.');
    // F5-I20 (MA02): memoria del hardware, opcional (vacío = 0).
    campos.ram = _entrada('number', { min: 0, step: 1, placeholder: 'KB' });
    campos.flash = _entrada('number', { min: 0, step: 1, placeholder: 'KB' });
    _campo(rejilla, 'RAM (KB)', campos.ram, 'Opcional: la RAM del ESP; sirve para mostrar la ocupación al generar el GWC. Solo se edita aquí.');
    _campo(rejilla, 'FLASH (KB)', campos.flash, 'Opcional: la FLASH del ESP (el fondo viaja en el GWC, A02). Solo se edita aquí.');
    // F5-I21: informativo de solo lectura, junto a las memorias con las que
    // se compara. Como TEXTO (no input): no debe parecer editable. Los datos
    // van a RAM y el fondo (Bloque 5, A02) a FLASH: los trae en un solo texto.
    campos.ultimoGWC = _crearElemento('span', 'fichaInformativo', '—');
    _campo(rejilla, 'Último GWC calculado', campos.ultimoGWC,
      'Solo informativo: se rellena al generar un GWC (puede quedar desfasado si después se toca el juego). Datos en RAM y, si hay, Fondo en FLASH.');
    datos.appendChild(rejilla);
    contenedor.appendChild(datos);

    const seccionBot = _crearElemento('section', 'fichaSeccion');
    seccionBot.appendChild(_crearElemento('h3', null, 'Botones'));
    const tabla = _crearElemento('table', 'fichaTabla');
    const cab = _crearElemento('thead');
    const trCab = _crearElemento('tr');
    // F5-I21: la columna «Alias» se llama «Texto Pantalla»: es el texto
    // que se ve en el botón de la máquina y el que viaja a los cartuchos.
    for (const t of ['Botón', 'Puerto', 'Tecla', 'Texto Pantalla']) trCab.appendChild(_crearElemento('th', null, t));
    cab.appendChild(trCab);
    cuerpoBotones = _crearElemento('tbody');
    tabla.append(cab, cuerpoBotones);
    seccionBot.appendChild(tabla);
    seccionBot.appendChild(_crearElemento('p', 'fichaNota',
      'Puerto: pin del botón en la máquina real. Tecla: cursor o letra del teclado del PC para probar en el simulador ' +
      '(elige en la lista; «Propia (letra)» abre la casilla A..Z). Sin tecla se usa la de por defecto del estilo. ' +
      'Texto Pantalla: el texto que se ve en el botón de la máquina y el que viaja en los cartuchos (F5-I21). ' +
      'Los botones 6, 7 y 8 son el trío de sistema A/B/R (presente en todos los estilos).'));
    contenedor.appendChild(seccionBot);

    mensajes = _crearElemento('div', 'fichaMensajes');
    contenedor.appendChild(mensajes);

    campos.estilo.addEventListener('change', _pintarTablaBotones);
    // F5-I21: el botón de ajuste abre la ventana del director. Los campos
    // ancho/alto son de SOLO LECTURA y ya no disparan eventos de teclado;
    // la verificación de la resolución sigue corriendo al aplicar y al
    // guardar (todo pasa por verificar) y la ventana valida ANTES.
    btnAjustar.addEventListener('click', () => {
      if (typeof baseDirector !== 'undefined' && baseDirector.ajustarResolucion) {
        baseDirector.ajustarResolucion();
      }
    });
    contenedor.addEventListener('input', () => _marcarCambios(true));
    contenedor.addEventListener('change', () => _marcarCambios(true));
    _pintarTablaBotones();
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
      _construir(c);
    }
  }

  /** Garantiza que la ficha esté construida. 
   * @returns {void}
   */
  function _asegurar() {
    if (!raiz) pintar();
  }

  /**
   * Deja la ficha en blanco.
   * @returns {void}
   */
  function reiniciar() {
    _asegurar();
    datosBoton = {};
    campos.nombre.value = '';
    campos.descripcion.value = '';
    campos.estilo.value = '';
    campos.ancho.value = '';
    campos.alto.value = '';
    campos.ram.value = '';
    campos.flash.value = '';
    _limpiarUltimos();
    _pintarTablaBotones();
    mensajes.textContent = '';
    _marcarCambios(false);
  }

  /**
   * Rellena la ficha desde un GWS ya leído y la da por aplicada.
   * @param {Object} json - El GWS (nombre, descripcion, estilo, resolucion, botones).
   * @returns {void}
   */
  function poblar(json) {
    _asegurar();
    reiniciar();
    campos.nombre.value = json.nombre || '';
    campos.descripcion.value = json.descripcion || '';
    campos.estilo.value = String(json.estilo);
    if (json.resolucion) {
      campos.ancho.value = json.resolucion.ancho;
      campos.alto.value = json.resolucion.alto;
    }
    const mem = (json.memoria && typeof json.memoria === 'object') ? json.memoria : {};
    campos.ram.value = mem.RAM ? mem.RAM : '';       // F5-I20: el GWS cargado
    campos.flash.value = mem.FLASH ? mem.FLASH : '';
    // F5-I21: un setup o cartucho nuevo RESTAURA los informativos de su
    // «memoria» (ultimoGWC/ultimoGWCimg); si no trae, sin «último» calculado.
    ultimoGWC = mem.ultimoGWC > 0 ? mem.ultimoGWC : 0;
    ultimoGWCimg = mem.ultimoGWCimg > 0 ? mem.ultimoGWCimg : 0;
    _pintarUltimos(mem.RAM > 0 ? mem.RAM : 0, mem.FLASH > 0 ? mem.FLASH : 0);
    for (const b of json.botones || []) {
      datosBoton[String(b.numero)] = {
        puerto: b.puerto === undefined ? '' : String(b.puerto),
        tecla: b.tecla || '',
        // F5-I21: campo "textoPantalla"; los GWS antiguos traían "alias".
        textoPantalla: b.textoPantalla || b.alias || ''
      };
    }
    _pintarTablaBotones();
    _marcarCambios(false);
  }

  /**
   * Construye el GWS con lo que hay en la ficha (sin validar). Un botón
   * entra si tiene puerto, tecla o textoPantalla; el puerto es un número.
   * @returns {Object} El JSON del GWS.
   */
  function leer() {
    _asegurar();
    _pintarTablaBotones();             // vuelca lo escrito en datosBoton
    const json = { tipo: GWS_TIPO, version: GWS_VERSION, nombre: campos.nombre.value.trim() };
    const desc = campos.descripcion.value.trim();
    if (desc !== '') json.descripcion = desc;
    json.estilo = campos.estilo.value;
    json.resolucion = {
      ancho: parseInt(campos.ancho.value, 10),
      alto: parseInt(campos.alto.value, 10)
    };
    // F5-I20: memoria subcampo a subcampo y solo si no es 0. Un valor no
    // válido (negativo, decimal) viaja tal cual: revisarValores lo avisa
    // y lo trata como 0 (verificar), sin bloquear.
    const memoria = {};
    for (const [k, campo] of [['RAM', campos.ram], ['FLASH', campos.flash]]) {
      const t = campo.value.trim();
      if (t !== '' && Number(t) !== 0) memoria[k] = Number(t);
    }
    // F5-I21: los informativos del Último GWC viajan DENTRO de «memoria»
    // (BYTES, no KB): sobreviven a Aplicar y viajan en el GWI; el GWB y
    // el GWS guardados van SIN ellos (solo la memoria del aparato).
    if (ultimoGWC > 0) memoria.ultimoGWC = ultimoGWC;
    if (ultimoGWCimg > 0) memoria.ultimoGWCimg = ultimoGWCimg;
    if (Object.keys(memoria).length > 0) json.memoria = memoria;
    json.botones = [];
    for (const n of botonesDelEstilo(campos.estilo.value)) {
      const d = datosBoton[String(n)];
      if (!d) continue;
      const b = { numero: String(n) };
      if (String(d.puerto).trim() !== '') b.puerto = Number(d.puerto);
      const teclaFila = d.tecla.trim();
      if (teclaFila !== '') {
        // F5-I17 (M5): los cursores en minúscula (nombre canónico); las
        // letras, en mayúscula como siempre.
        b.tecla = CURSORES_GWS.includes(teclaFila.toLowerCase())
          ? teclaFila.toLowerCase() : teclaFila.toUpperCase();
      }
      if (d.textoPantalla.trim() !== '') b.textoPantalla = d.textoPantalla.trim();
      json.botones.push(b);
    }
    return json;
  }

  /** Muestra errores (rojo) y avisos (ámbar) bajo la ficha. 
   * @param {string[]} errores - Mensajes de error.    
   * @param {string[]} avisos - Mensajes de aviso.
   * @returns {void}
   */
  function _pintarMensajes(errores, avisos) {
    mensajes.textContent = '';
    for (const [lista, clase, titulo] of [[errores, 'fichaError', 'Errores'], [avisos, 'fichaAviso', 'Avisos']]) {
      if (lista.length === 0) continue;
      const bloque = _crearElemento('div', clase, titulo + ':');
      const ul = _crearElemento('ul');
      for (const m of lista) ul.appendChild(_crearElemento('li', null, m));
      bloque.appendChild(ul);
      mensajes.appendChild(bloque);
    }
  }

  /**
   * Verifica la ficha con las MISMAS reglas que al cargar un GWS
   * (baseDirector.validarSetup), más las comprobaciones propias de
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
      const fallo = baseDirector.validarSetup(json);
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
    // F5-I16: límites asentados al verificar (y por tanto al guardar y
    // al aplicar): puertos fuera de rango se limitan; la resolución
    // fuera de 320×240..1024×600 es ERROR bloqueante (M5) — la pesca
    // validarSetup, que verificar llama aquí arriba.
    avisos.push(...baseCartucho.revisarValores('GWS', json));
    if (opt.mostrar) _pintarMensajes(errores, avisos);
    return { errores: errores, avisos: avisos, json: json };
  }

  /**
   * Nombre de fichero válido a partir del nombre del setup.
   * F5-I17 (M11): el GWS usa SU extensión, .GWS (los cartuchos la
   * llevan en mayúsculas; el .json sigue aceptado en la carga por
   * compatibilidad).
   * @param {string} nombre - Nombre del setup.
   * @returns {string} P. ej. «setup_ESP32 GW 4 botones.GWS».
   */
  function _nombreFichero(nombre) {
    const limpio = nombre.replace(/[\\/:*?"<>|]/g, '_').trim() || 'setup';
    return limpio + '.GWS';
  }

  /**
   * Descarga un texto como fichero.
   * @param {string} nombre - Nombre del fichero.
   * @param {string} texto - Contenido.
   * @returns {void}
   */
  function _descargar(nombre, texto) {
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
    // F5-I21: el GWS guardado define la MÁQUINA: su memoria es solo la
    // del aparato (RAM/FLASH), SIN los informativos del último GWC
    // (viajan en el GWI; en memoria del módulo se conservan para que
    // Aplicar no los pierda y la vista siga enseñándolos).
    const sinUltimos = baseCartucho.memoriaSinUltimos(r.json.memoria);
    const copia = Object.assign({}, r.json);
    if (sinUltimos) copia.memoria = sinUltimos; else delete copia.memoria;
    _descargar(_nombreFichero(r.json.nombre), JSON.stringify(copia, null, 2));
    return r.json;
  }

  /**
   * Vacía el informativo «Último GWC calculado» (F5-I21) y OLVIDA sus bytes
   * (reiniciar lo usa): hasta que se genera un GWC no dice nada.
   * @returns {void}
   */
  function _limpiarUltimos() {
    ultimoGWC = 0;
    ultimoGWCimg = 0;
    if (campos.ultimoGWC) campos.ultimoGWC.textContent = '—';
  }

  /**
   * Pinta el informativo «Último GWC calculado» desde los bytes guardados
   * en el módulo: «x KB (y %) · Fondo f KB (g %)» con la RAM y la FLASH
   * declaradas; sin datos, «—» (F5-I21, A02).
   * @param {number} ramKB - RAM declarada (0 = sin dato).
   * @param {number} flashKB - FLASH declarada (0 = sin dato).
   * @returns {void}
   */
  function _pintarUltimos(ramKB, flashKB) {
    if (!campos.ultimoGWC) return;               // la ficha aún no se ha pintado
    if (ultimoGWC <= 0 && ultimoGWCimg <= 0) {
      campos.ultimoGWC.textContent = '—';
      return;
    }
    let texto = baseCartucho.textoUsoMemoria(ultimoGWC, ramKB);
    if (ultimoGWCimg > 0)
      texto += ' · Fondo ' + baseCartucho.textoUsoMemoria(ultimoGWCimg, flashKB);
    campos.ultimoGWC.textContent = texto;
  }

  /**
   * Guarda los bytes del Último GWC calculado (los DATOS usados de RAM, SIN
   * el bloque del fondo: la imagen no se carga en RAM; y el bloque del
   * fondo, que irá a FLASH, A02) y pinta el informativo con UN solo texto
   * (F5-I21): «x KB (y %) · Fondo f KB (g %)» con la memoria declarada. Es
   * la misma función que escribe el porcentaje de la generación (F5-I20):
   * baseCartucho.textoUsoMemoria.
   * @param {{gwc:number, fondo:number, memoria:?{RAM:number, FLASH:number}}} d -
   *        Bytes de datos del GWC (sin el fondo) y del fondo, y la memoria
   *        declarada (o null).
   * @returns {void}
   */
  function informarUltimos(d) {
    ultimoGWC = (d && d.gwc > 0) ? d.gwc : 0;
    ultimoGWCimg = (d && d.fondo > 0) ? d.fondo : 0;
    const mem = (d && d.memoria) || {};
    _pintarUltimos(mem.RAM > 0 ? mem.RAM : 0, mem.FLASH > 0 ? mem.FLASH : 0);
  }

  /**
   * Pone el ancho y el alto de la ficha (solo lectura) tras un ajuste de
   * resolución (F5-I21), sin tocar el resto de campos ni el borrador.
   * @param {{ancho:number, alto:number}} r - La resolución vigente.
   * @returns {void}
   */
  function fijarResolucion(r) {
    if (!campos.ancho) return;
    campos.ancho.value = r.ancho;
    campos.alto.value = r.alto;
  }

  return {
    pintar: pintar,
    fijarResolucion: fijarResolucion,
    informarUltimos: informarUltimos,
    reiniciar: reiniciar,
    poblar: poblar,
    leer: leer,
    verificar: verificar,
    guardar: guardar,
    hayCambios: hayCambios,
    marcarAplicado: () => _marcarCambios(false),
    botonesDelEstilo: botonesDelEstilo
  };

})();
