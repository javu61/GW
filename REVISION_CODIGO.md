# R1. Revision del código para los test

Los js de las pruebas están en la carpeta pruebas. Son:

- pruebas.js  
- pruebasDirector.js 
- pruebasEditor.js
- pruebasGenerales.js
- pruebasGWI_GWC.js
- pruebasMotor.js

La pestaña de test debe incluir el máximo posible de botones que las lancen.

Para las pruebas que no son posible desde un botón, hay que generar un script para lanzarlos, y añadir en la pantalla la lista de los scripts desarrollados, una lista con el comando que se debe usar para lanzarlo. Hay que usar un script que haga dos temas, primero el npm i -g playwright y luego el test, preferentemente el scripot será de PowerShell. La lista debe permitir copiar una linea, pegarla en un CMD y que lance el test, o bien definir ademas de la prueba en PowerShell un fichero .bat que lo lance. Lo importante es que sea copiar una línea, pegarla en CMD o en PowerShell y que se lance el test, con resultado OK o Error y descripción del mismo. Si es necesario disponer de varios cartuchos se pueden poner en el directorio de pruebas para tenerlos siempre disponibles, y no depender de otros, esto se pueden generar con datos de prueba sin importar que realmente lancen un juego completo.

Index.html se lanza desde el servidor local no con file. 

Sobre los botones Hay que tener Una sola copia: la lógica de la prueba está en un fichero que carga la pestaña y da el botón. El script de Node es solo un lanzador que abre la página con Playwright, pulsa el botón y lee el resultado. Si cambias una prueba, cambia en un solo sitio.


# R2. Revisión del código: solo lo pendiente — 22-11-2026

Depurado tras F5-I15. Se han eliminado los puntos resueltos (#1-5, 7, 12, 14-17, 19, 28-32 y el código muerto ya retirado).
Leyenda: **[C]** confirmado en el código; **[S]** seguro según el revisor; **[P]** posible / a comprobar ejecutando.
Los puntos de código de las secciones 1.1-1.3 están descritos para su implementación en `F5-I15. Revisión del motor y del editor.tex`; los cambios de texto, en F5-I16.

## 1. Errores pendientes

### 1.1 Motor de estados (`JuegoMotorEstados.js`)
| # | Problema | Arreglo |
|---|---|---|
| 6 | **[C]** Los secundarios de «mostrar junto a» (tipo juego, sin `siguiente`) no se excluyen en `esCadena`/`esDeRuta`: el barrido los apaga como fin de ruta y `muereRuta` resta 1 a `nRutasVivas` cada tick → contador negativo → se lanzan más rutas de las permitidas. | Excluirlos (están en `mapaComp`). |
| 8 | **[S]** `sincronizarAcompanantes` va antes de `sincronizarIconos`: el secundario de un icono va un tick tarde y no se pinta en el tick final; `iniciar()` tampoco lo ejecuta. | Invertir el orden y llamarlo en `iniciar`. |
| 9 | **[S]** El barrido depende del orden de la lista: si dos rutas van seguidas en la misma cadena o confluyen, una desaparece y `nRutasVivas` se queda con una de más. | Barrido en dos fases (calcular destinos → aplicar). |
| 10 | **[P]** (a) Punto de colisión que se enciende y apaga en el mismo tick (nunca se ve); (b) rutas que entran en segmentos de la Secuencia desaparecen sin `muereRuta`; (c) la congelación no corta el barrido en curso. | Reproducir cada caso con una prueba antes de tocar. |

### 1.2 Director / carga (`BaseDirector.js`)
| # | Problema | Arreglo |
|---|---|---|
| 11 | **[S]** Cargar un GWC tras un GWI deja la autoría del GWI y Guardar/Generar activos; `imgF` pasa a ser un canvas y `imagenBlob` lee `naturalWidth` → lienzo 0×0 → ZIP sin imagen. Tampoco llama a `aplicarBotonesCartucho`. | Limpiar la autoría al cargar un GWC y refrescar la botonera. |
| 13 | **[S]** `procesarCartucho` limpia y asigna `cartucho=json` **antes** de comprobar la compatibilidad: si falla, queda estado a medias. | Comprobar primero (como ya hace el GWC). |

### 1.3 Editor (`BaseDescomponer.js`, `BaseExtractor.js`, `BaseCartucho.js`)
| # | Dónde | Problema |
|---|---|---|
| 18 | `BaseDescomponer.js` ~227 | **[C]** `sec_1..sec_5` no están en `TODOS_ENLACES`: al unir no se re-apuntan, al separar no se anulan y `verificarReferencias` no los revisa. |
| 20 | `BaseDescomponer.js` ~844, 873-892 | **[S]** Deshacer tras cargar un GWI con piezas F: el historial guarda ids «F01» sin convertir → deshacer no hace nada y queda desalineado. |
| 21 | `BaseDescomponer.js` ~1155, 1474, 4281 | **[S]** «Presentar el cero = false» no llega al GWI: `reconstruir` se salta los `false`. |
| 22 | `BaseDescomponer.js` ~3505 | **[S]** Cambiar de tipo descarta todos los campos del tipo anterior, también los que el nuevo usa (juego→inicio pierde siguiente/salvado/muerte/mostrarJunto); no limpia `mostradoJunto` del secundario. |
| 23 | `BaseDescomponer.js` ~2425 | **[S]** El alta de la ficha del cartucho es deshacible: el primer Ctrl+Z tras cargar un GWB la borra. |
| 24 | `BaseDescomponer.js` varios | **[S]** Los absorbidos cuentan en familias y numeración de rutas (unir 2 inicios da «3 rutas»); `refrescarInfo` numera por orden de `grupos`, no por `orden`. |
| 25 | `BaseDescomponer.js` ~2197, 3488 | **[S]** Se pueden unir dos dígitos o dos contadores, y cambiar a dígito/contador una pieza de unión. F3-I10 lo prohíbe. |
| 26 | `BaseExtractor.js` ~139 | **[P]** Se ignora el canal alfa: un PNG transparente (0,0,0,0) se toma como negro. |
| 27 | `BaseCartucho.js` | **[P]** La verificación registra los inversos como acciones sueltas del historial: los primeros Ctrl+Z tras «Verificar» deshacen cálculos invisibles. |

### 1.4 Menores de interfaz y datos
- **Rangos de la UI (P10):** ajustar el `max` de los `input` a los rangos del GWC (valorInicial y ticks de Secuencia ≤ 255; pausas y aceleración ≤ 65534). La verificación ya bloquea.
- **Par desequilibrado (P11):** avisar al generar si el par GWI/GWC del destino está desequilibrado y mostrar `codigoGWC` en la ficha.
- **`#infoMensaje`** conserva errores viejos (el `#infoEstadistica` ya no existe).

## 2. Texto frente a código (corrección de la Memoria; propuestas en F5-I16)
- **Orden del tick (F3-I01, Memoria F3, C4-disenno):** el código ya hace (0) limpieza, (1) entrada, (2) rutas; el texto y el comentario del motor («TRES cosas») siguen con el orden antiguo.
- **«combinar»:** hay tres versiones en el texto (F4-I02: setup; F4-I03: casilla/`teclado.combinar`; código: propiedad del cartucho, bit 0 del byte de reglas del Bloque 0 del GWC). F3-I01/I02 describen un movimiento diagonal; el código hace dos movimientos encadenados y `MOVER` solo tiene izquierda y derecha. El I99 describe la ampliación «Combinación por ejes» como si no existiera la regla.
- **Pausas y velocidades desde el setup (F4):** el código nunca las lee del setup; la aceleración resta milisegundos fijos, no es «proporcional».
- **Buffer de pulsaciones (F3-I02):** el texto cita `JuegoMotorEstados.pulsar`; la cola está en `ComunListas` (`encolar`) y la vacía el motor (`_aplicarEntrada`).
- **Variedad de rutas (F3-I08):** el texto dice «regenerar si hay saturación»; el código quita la candidata y genera una sola vez.
- **Cadenas por vida/muerte (F3-I08 y cabecera del motor):** dicen que el barrido las atraviesa; la cadena aterriza y cuenta.
- **F3-I11 sin documentar:** aterrizaje en la familia; vida = contador interno 1 y muerte = 2 (choca con `salvadoContador='1'` como puntuación en Parachute); conversión de `'vida'`/`'muerte'` antiguos.
- **F3-I06 y F3-I10:** usan `salvadoIndicador`/`ColisionPositiva`; el código, `salvadoContador`/`muerteContador` con valores '1'-'4'. F3-I10 dice `seg_F01`, el código `F01`. Dígito y contador usan otro mecanismo de absorción, que no hereda ni re-apunta.
- **Formato GWC (F5-I02):** comprobar que el texto refleja el código (orden de contadores tras los 20 enlaces; contador interno 0xFF; direcciones relativas al contenido; tamaño = contenido; enlace ausente 0xFF; aceleración ausente 0xFFFF; códigos de fin 1/2/3; campo `codigoGWC`; Bloque 0 de 36 bytes con ColorFondo y reglas; Bloque 1 de **8** valores; CRC-16; alineación impar del Bloque 1 → `struct` packed en C).
- **F5-I03:** planificaba `guardarGWC` y `estadistica` con el ahorro de deduplicación; se hizo distinto; anotarlo.
- **A7-anexo.tex:** se quedó en la fase 4 (sin `BaseCartucho.js`, «GWC sin procesar (futuro)», faltan `procesarGWC`, `fabricarSprite`, `fabricarFondoColor`).
- **Memoria F1.tex (260-281):** presenta el XOR y la unión con fantasmas tipo 99; hoy el color se escribe directo y la unión crea una pieza F con `fusionadoPor`.
- **F1-I08:** dice que el JSDoc lleva `@iteracion`; no aparece.
- **F1-I11:** se contradice sobre `DibujarSegmento` o funciones propias (usa propias).
- **F1-I01:** dice «A y B arrancan» (el Start por defecto es el 8, R) y que `puerto` se valida con aviso (no se valida).
- **C4-disenno:** dice que `tiempoEspera` lo cambia la máquina de estados según puntuación; lo cambia el director según los ticks.
- **Erratas:** Memoria `capitulo5/F4.tex` termina a mitad de frase (l. 163 «…de la Secuencia:»); F2-I02: nombres antiguos (`DirectorJuego`, `directorjuego.js`), «parchute», «parachuite» y un `¢` suelto tras `\begin{figure}[H]`.

### Hecho en el código y no documentado
- Pulsar Start a mitad de partida la reinicia.
- Un GWI cargado desde la pestaña Simulador no salta al Editor.
- Ctrl+Z puede borrar la ficha del cartucho (#23).
- Las piezas de unión pueden cambiar a cualquier tipo (#25).
- Los números F se saltan tras deshacer.
- «Deshacer unión» solo aparece con GWI antiguos.
- `entrantesDe` también marca en magenta a quien declara colisión.

## 3. Simplificación y legibilidad (P09)

1. **Funciones gigantes:** `BaseDescomponer.mostrarPanel` (~1300 líneas → `panelMarcados`, `panelCartucho`, `panelOrden`, `panelTipo`, `panelEnlaces`, `panelColision`, `panelDigito`, `panelContador`, `panelUnion`); `aplicarEleccion` (279); manejador del selector de tipo (~175); `JuegoMotorEstados.tick` (que sea una lista de llamadas), `iniciar` (110), `decidirColision` (100), `prepararContadores` (80); `BaseDirector.procesarCartucho` (110), `generarGWIyGWC` (75), `montarGWI` (80).
2. **Patrones repetidos:** `filaEnlace(...)` (6×); `confirmar(g, entradas)` (19×); `encender(seg, v)` en el motor (~6×); `escribirInverso`/`retirarInverso` (4 sitios); `publicarEnPuente(cfg)` (7 llamadas `ComunListas.fijar*` en `procesarCartucho` y `procesarGWC`); `accionarBoton(numero)` (Start/pulsar duplicado); `tomarFichero(id)` (4 `alSeleccionar*`); `envolvente(cajas)` (6×); `aplicarAlta`/`aplicarBaja` (3 sitios); `_descargarGWC` copia una descarga genérica y `_validarCabeceraGWC` repite la suma de verificación.
3. **GWC: una sola tabla de layout por registro** `[{campo, bytes, escala, nulo}]` con escritor y lector con cursor (`DataView`) y aserción `Σbytes === 32`; sirve de especificación para el .tex y el C del ESP32.
4. **Guardas defensivas innecesarias:** `typeof ComunListas/JuegoDirector/BaseDirector !== 'undefined'` por todas partes (el orden de carga lo fija `index.html`) y enums de respaldo que copian `ComunListas.tipos`.
5. **Portabilidad al ESP32 (motor):** ids de texto → índices al cargar (`_indiceDe` busca linealmente); bits por segmento en lugar de mapas por id; quitar `sort`/`filter` del tick (calcular en `iniciar`); `'ascendente'/'descendente'` → booleano; en el motor gráfico `_pixelesDe` crea un canvas por segmento en cada tick: guardar siluetas al cargar.
6. **Pintado duplicado:** el aparato tiene su copia de `DibujarFondo`/`DibujarSegmento`; unificar en `BaseGraficos.pintarSprite(...)` o recortar BaseGraficos.
7. **Código muerto o sobrante (comprobado 22-11):**
   - **BaseDirector:** parte de dibujo de `mostrarSprites` (siempre con `[]`), variables privadas `sprites`/`segmentos`, `ESTILOS.*.descripcion`, exports `pestanna` e `imagenBlob`.
   - **BaseCartucho:** exports `leerGWB`, `leerGWI`, `leerJSON`, `escalar`, `indiceDe`, `bloque`; `cargarDelMapa` (lógica copiada en BaseDirector); `'GWC'` en `TIPOS_CARTUCHO` (acepta un .json de tipo GWC); `json.img_s` en la raíz.
   - **BaseDescomponer:** parámetro `codigo` de `montarGWI`; `dx`/`dy` (restos de «Posicionar»); compatibilidad con GWI antiguos (`uniones`, `{unir}`, tipo 99, «Deshacer unión»): aislar o retirar.
   - **JuegoMotorEstados:** `splice` de `iniciar` sin efecto; `pruebaAleatorios`, `jugadorActual`, `rutasVivas`, `congelada`, `estadoRutas` y `MOVER` exportados sin uso (`estadoRutas` y `BasePACK.verificarPACK` se dejan: API del Anexo A).
   - **JuegoDirector:** 14 líneas de prueba comentadas en `arrancar`, `pausaVigente` y la comprobación redundante `ticks > 0`.
8. **Comentarios:** mezclan historial («23-10», «F4-I9», «v12.5», `@since`) con la explicación; dejar el **qué** y el **por qué**, la historia al LaTeX (P17: cabeceras PROPÓSITO/SEPARACIÓN/FUNCIONES de los Juego*.js). Desactualizados: motor («nace un tick tras morir», «interrumpida con cada colisión», `rutasVivas` «0 o 1», errata «ATRIZA»); BaseCartucho («GWC > GWI > GWB», «little-endian» aplicado a RGB); BaseDirector (comentario de `imagenBlob`, «único miembro público», «combinar viene del setup», «pantalla en blanco» pinta gris); BaseDescomponer (JSDoc duplicados en ~542-580 y ~2583-2593, frases cortadas en ~743, 1114, 1135-1141, 4706). **BaseGraficos.js:** mojibake («INVERSIíN», «píºblica») y 26 guiones blandos U+00AD.
9. **Pestañas / accesibilidad:** faltan `role="tablist"/"tab"` y `aria-selected`; no hay `:focus-visible`; los botones de la máquina solo responden a `pointerdown` (sin Enter/Espacio); `mostrarPestanna` sobrescribe `className` (mejor `classList.toggle` o `data-vista`); el nombre se escribe de tres formas: `pestanna`, `pestanaVista`, `#pestanas`.
