'use strict';

// baseGenerador.js
// ====================================================================================================
// PROPÓSITO
//   La pestaña «Generador» (F6-I03): prepara la generación de lo que necesita
//   cada sistema de destino. En esta iteración solo trae la pantalla: los
//   selectores de Destino (Mega / ESP) y Etapa (Prueba / Completa) y el botón
//   «Generar», que todavía no genera nada (su contenido llega en F6-I04).
//
// QUÉ MUESTRA
//   - Destino: para qué sistema se genera (Mega = Arduino Mega, ESP = ESP32).
//   - Etapa: qué se genera (Prueba = los cartuchos y el programa de la prueba
//     de la fase; Completa = el juego entero para el aparato).
//   - Un único botón «Generar»: en F6-I04 hará el trabajo según Destino y
//     Etapa; por ahora avisa de que no tiene contenido.
//
// SEPARACIÓN
//   No conoce al director ni a los generadores de cartuchos: solo pinta la
//   ficha y guarda la elección del usuario. Se construye UNA vez y conserva
//   la selección entre visitas, igual que las fichas de Setup y Cartucho.
//
// FUNCIONES
//  Pantalla
//    pintar     Construye la ficha (la primera vez) en el contenedor.
//  Lectura
//    estado     La selección vigente { destino, etapa } (null sin ficha).
//  Internas
//    _crearElemento   _campo   _lleno
// ====================================================================================================

const baseGenerador = (function () {

  let raiz = null;          // la ficha, construida una vez
  let selDestino = null;    // el select de destino
  let selEtapa = null;      // el select de etapa
  let nota = null;          // la línea informativa bajo el botón

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
   * Construye la ficha (la primera vez) en el contenedor.
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

    const fila = _crearElemento('div', 'fichaAcciones');
    const btn = _crearElemento('button', null, 'Generar');
    btn.id = 'btnGeneradorGenerar';
    btn.title = 'Genera lo que necesita el destino y la etapa elegidos';
    btn.addEventListener('click', () => {
      if (nota) nota.textContent = 'El botón «Generar» aún no tiene contenido: su trabajo llega en la F6-I04.';
    });
    fila.appendChild(btn);
    raiz.appendChild(fila);

    nota = _crearElemento('p', 'fichaNota',
      'Prepara la generación para el destino y la etapa elegidos. En esta iteración solo está la pantalla.');
    nota.id = 'genNota';
    raiz.appendChild(nota);
    contenedor.appendChild(raiz);
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
