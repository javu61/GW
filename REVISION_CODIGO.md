# Revisión del código frente a la Memoria y las Iteraciones — 06-11-2026

Revisión solo de lectura: no se ha modificado ningún fichero. Leyenda: **[C]** confirmado leyendo el código; **[S]** seguro según el revisor; **[P]** posible / a comprobar ejecutando.
Las pestañas de `index.html` no se marcan como discrepancia documental (aún no están en el LaTeX).

## Estado a 20-11-2026 (tras F5-I10, F5-I11 y F5-I12)

Solo se marcan los puntos comprobados contra el código actual. Lo no citado aquí sigue **pendiente** tal como se describe más abajo.

| # | Estado | Cómo |
|---|---|---|
| 1 | Resuelto | La función de fin de partida (F5-I10) vuelve a habilitar pestañas y botones (`actualizarPestanas`); los botones de carga se deshabilitan solo durante la partida. |
| 2 | Resuelto | `alPulsarTecla` solo actúa en la pestaña Simulador, ignora Ctrl/Alt/Meta y los campos de texto. |
| 3 | Resuelto | `aleatorio` usa los bits altos del LCG: `(estadoLCG >>> 8) % max`. **Actualizar F3-I04.** |
| 4 | Resuelto en la verificación | Error bloqueante si `valorInicial` o los ticks de la Secuencia pasan de 255, o si pausas y aceleración pasan de 65534. Pendiente: ajustar el `max` de los `input` de la UI. |
| 5 | Resuelto | `generarGWIyGWC` tiene `try/catch` y el GWC se descarga solo cuando el GWI se ha guardado. |
| 7 | Resuelto | `desenlaceMuerte = desenlaceMuerte \|\| !positiva`. |
| 14 | Resuelto | `buscarBotonPorTecla` recorre los botones y ya no usa un selector CSS. |
| 15 | Resuelto | `tick()` captura la excepción, termina la partida y avisa. |
| 16 | Resuelto | `setup2.json` ya usa los botones 0 y 4; en `setup5.json` el botón 3 pasa a la tecla S. |
| 19 | Resuelto | `fijados.add(campo)` va después de descartar los enlaces internos. |
| 31 | Resuelto (F5-I13) | El GWC no se comportaba como el GWI: rutas, pausas, orden de iconos y `combinar`. Ahora lo no declarado viaja como nulo y hay una prueba de equivalencia (`pruebas/equivalenciaGWC.js`). |
| 29 | Resuelto (F5-I13) | El `contador` de vida y muerte viaja en el byte «valor inicial u orden» del registro de segmento. |
| 30 | Resuelto (F5-I14) | El lector del GWC valida índices de sprite, enlaces, Secuencia, tabla de sprites y código de fin (error claro, no TypeError ni «contador» por defecto). |
| 28 | Resuelto (F5-I14) | CRC-16/CCITT-FALSE en lugar de la suma aditiva (`_crc16`), compartido por generador y lector. |
| 32 | Resuelto (F5-I15) | El tick borraba las banderas `cambiar` DESPUÉS de la entrada, contra la Memoria F2: las marcas del paso del jugador se perdían (el repintado selectivo del ESP32 no pintaría el movimiento; nada del navegador lee `cambiar` aún). Ahora la limpieza es el paso (0) del `tick()` y la entrada el (1); la PRUEBA 5 «Orden del tick (F5-I15)» de la pestaña Pruebas verifica el contrato. |

**Código muerto eliminado:** `avisarEtiquetas`, `BLOQUE_FONDO_GWC`, `cartuchoActual`, `segmentosEnMemoria`, y el bloqueo de img_s de la ficha (`bloquearImgS`, `alCambiarImagen`), que F5-I12 sustituye por el botón Aplicar.

**Convención de nombres (F5-I12):** las funciones locales de cada módulo llevan `_` delante; solo las exportadas por el `return` del módulo no. Los motores y la ficha no exportan nada con `_`.

**Siguen pendientes, por prioridad:** 6, 8, 9 y 10 (motor de estados); 11-13, 17; 18, 20-27 (editor); las erratas y discrepancias de la sección 2; las funciones gigantes y los patrones repetidos de la sección 3. Las exportaciones sin uso (p. ej. `JuegoMotorEstados.estadoRutas`, `BasePACK.verificarPACK`) se han dejado porque forman parte de la API documentada en el Anexo A.

---

## 1. Errores (prioridad de arreglo)

### Críticos — rompen el uso normal
| # | Dónde | Problema | Arreglo propuesto |
|---|---|---|---|
| 1 | `BaseDirector.js:1108-1121` `jugar()` | **[C]** Tras Start se ocultan Cargar Setup/Cartucho/GWI/GWC, panel de estado y pestañas Editor/Sprites, y **nada los vuelve a mostrar** (ni al terminar la partida). Solo se sale recargando la página. Contradice F1-I01 («en cualquier momento se puede volver a cargar un setup»). | `salirDeJuego()` al terminar la partida o botón «Salir»; al cargar/cambiar de pestaña, `JuegoDirector.detener()`. |
| 2 | `BaseDirector.js:1025` `alPulsarTecla` | **[C]** No filtra Ctrl/Alt/Meta, autorepetición ni foco en `input`. Con los setup de ejemplo la Z es el botón A = Start del Parachute → **Ctrl+Z en el Editor deshace y arranca la partida** (→ bloqueo #1). Escribir en los campos numéricos del panel también pulsa botones. | `if (ev.ctrlKey‖ev.altKey‖ev.metaKey‖ev.repeat‖ev.target.closest('input,select,textarea')) return;` |
| 3 | `JuegoDirector.js:44-48` `aleatorio` | **[C]** LCG con a y c impares → el bit 0 alterna; `estado % max` con 2 candidatas da siempre 0,1,0,1. Con 2 rutas (o 3 con la regla de variedad) el juego es totalmente predecible. | `return (estadoLCG >>> 8) % max;` (bits altos). Actualizar F3-I04. |
| 4 | `BaseCartucho.js:1568` + `BaseDescomponer.js:4221` | **[C]** `valorInicial` admite 9999 en la UI pero el GWC lo escribe en 1 byte (`& 0xFF`): 300 → 44 sin aviso. Igual: ticks de la Secuencia (UI 999, se recorta a 255) y campos de 16 bits (pausas 70000 → 4464). | Validar rangos en la verificación (bloqueante) y ajustar `max` de los `input`; o ampliar el campo. |
| 5 | `BaseDescomponer.js:4544-4556` `generarGWIyGWC` | **[C]** Descarga el GWC **antes** de guardar el GWI y sin `try/catch`: si JSZip falla queda un GWC huérfano (contra la atomicidad del par de F5-I06) y la excepción no llega a la barra. | Montar ZIP y GWC en memoria, y descargar los dos al final dentro de `try/catch` con `avisarError`. |

### Motor de estados (Fase 3)
| # | Dónde | Problema |
|---|---|---|
| 6 | `JuegoMotorEstados.js:163-189, 1578-1597` | **[C]** Los secundarios de «mostrar junto a» (tipo juego, sin `siguiente`) **no se excluyen** en `esCadena`/`esDeRuta`: el barrido los apaga como fin de ruta y `muereRuta` resta 1 a `nRutasVivas` cada tick → contador negativo → se lanzan más rutas de las permitidas. Arreglo: excluirlos (están en `mapaComp`). |
| 7 | `JuegoMotorEstados.js:1361` | **[C]** `desenlaceMuerte = !positiva` sobrescribe: una colisión negativa y otra positiva en el mismo tick anulan la suspensión de la Secuencia. Arreglo: `desenlaceMuerte = desenlaceMuerte \|\| !positiva`. |
| 8 | `JuegoMotorEstados.js:1697-1703` | **[S]** `sincronizarAcompanantes` va antes de `sincronizarIconos`: el secundario de un icono va un tick tarde y no se pinta en el tick final; `iniciar()` tampoco lo ejecuta. |
| 9 | `JuegoMotorEstados.js:1582-1659` | **[S]** El barrido depende del orden de la lista: si dos rutas van seguidas en la misma cadena o confluyen, una desaparece y `nRutasVivas` se queda con una de más. Arreglo: barrido en dos fases (calcular destinos → aplicar). |
| 10 | varios | **[P]** Punto de colisión que se enciende y apaga en el mismo tick (nunca se ve); rutas que entran en segmentos de la Secuencia desaparecen sin `muereRuta`; la congelación no corta el barrido en curso. |

### Director / carga (Fase 4)
| # | Dónde | Problema |
|---|---|---|
| 11 | `BaseDirector.js:849-852` `procesarGWC` | **[S]** Cargar un GWC tras un GWI deja la autoría del GWI y Guardar/Generar activos; `imgF` pasa a ser un canvas y `imagenBlob` lee `naturalWidth` → lienzo 0×0 → ZIP sin imagen. Tampoco llama a `aplicarBotonesCartucho` (la botonera depende de lo cargado antes). |
| 12 | `BaseDirector.js:973-998` | **[S]** `descomponerImagen` ignora el `false` de `BaseDescomponer.arrancar` y habilita los botones igualmente. |
| 13 | `BaseDirector.js:680-693` | **[S]** `procesarCartucho` limpia y asigna `cartucho=json` **antes** de comprobar la compatibilidad: si falla, queda estado a medias. Hacer la comprobación primero (como ya hace el GWC). |
| 14 | `BaseDirector.js:1017` | **[S]** `ev.key` sin escapar en `querySelector`: `"` o `\` lanzan SyntaxError. |
| 15 | `JuegoDirector.js:53-115` | **[P]** Una excepción en `tick()` para el reloj pero `enMarcha()` sigue diciendo true. `try/catch` → `detener()` + `avisarError`. |
| 16 | `setup2.json`, `setup5.json` | **[S]** setup2 declara los botones 0 y 1, pero el estilo 2 usa 0 y 4 (el 4 queda sin puerto). setup5 repite la tecla X en los botones 3 y 7. |
| 17 | `#infoEstadistica` | **[S]** Nadie lo escribe (`informarEstadistica` sin llamadas): la línea fija anunciada en index/CSS nunca aparece. `#infoMensaje` conserva errores viejos. |

### Editor (Fase 1)
| # | Dónde | Problema |
|---|---|---|
| 18 | `BaseDescomponer.js:227-233` | **[C]** `sec_1..sec_5` no están en `TODOS_ENLACES`, aunque su comentario dice que están todos: al unir no se re-apuntan (la Secuencia sigue encendiendo un absorbido oculto), al separar no se anulan y `verificarReferencias` no los revisa. |
| 19 | `BaseDescomponer.js:2478-2480` `unirGrupos` | **[C]** El campo se marca como fijado **antes** de mirar si apunta dentro del conjunto: con A→B→C, unir A+B pierde el `siguiente`→C y corta la ruta. Mover `fijados.add` después del `continue`. |
| 20 | `BaseDescomponer.js:844, 873-892` | **[S]** Deshacer tras cargar un GWI con piezas F: el historial guarda ids «F01» sin convertir → deshacer no hace nada y el historial queda desalineado. |
| 21 | `BaseDescomponer.js:1155, 1474, 4281` | **[S]** «Presentar el cero = false» no llega al GWI: `reconstruir` se salta los `false`. |
| 22 | `BaseDescomponer.js:3505-3515` | **[S]** Cambiar de tipo descarta **todos** los campos del tipo anterior, también los que el nuevo usa (juego→inicio pierde siguiente/salvado/muerte/mostrarJunto). Además no limpia `mostradoJunto` del secundario. |
| 23 | `BaseDescomponer.js:2425` | **[S]** El alta de la ficha del cartucho es una acción deshacible: el primer Ctrl+Z tras cargar un GWB la borra (F3-I11 dice que existe siempre). |
| 24 | `BaseDescomponer.js:1231-1356, 1497, 3166, 3600` | **[S]** Los segmentos absorbidos cuentan en las familias y en la numeración de rutas (unir 2 inicios da «3 rutas»); `refrescarInfo` numera por orden de `grupos`, no por `orden`. |
| 25 | `BaseDescomponer.js:2197-2219, 3488` | **[S]** Se pueden unir dos dígitos o dos contadores, y cambiar a dígito/contador una pieza de unión (la pieza desaparece del mapa). F3-I10 lo prohíbe. |
| 26 | `BaseExtractor.js:139-164` | **[P]** Se ignora el canal alfa: un PNG transparente (0,0,0,0) se toma como negro. |
| 27 | BaseCartucho 701/942/980 | **[P]** La verificación registra los inversos como acciones sueltas del historial: los primeros Ctrl+Z tras «Verificar» deshacen cálculos invisibles. |

### Formato GWC (Fase 5)
| # | Dónde | Problema |
|---|---|---|
| 28 | `BaseCartucho.js:1671` | **[C]** La suma de verificación es aditiva mod 65536: no detecta bytes o registros intercambiados. La cabecera (l. 52) dice «CRC» y F5-I06 promete probabilidad de error despreciable. Propuesta: CRC-16/CCITT. |
| 29 | registro de segmento | **[RESUELTO en F5-I13]** **[S]** El campo `contador` de los segmentos vida/muerte no viaja en el GWC; el motor ordena la familia por él (`JuegoMotorEstados.js:980`). Comprobar que tras un GWC el orden de iconos sigue bien. |
| 30 | lector GWC (1838-1951) | **[P]** No valida índices de sprite/segmento ni tamaños de tabla (TypeError en vez de error claro); `FIN_GWC_INV[x] \|\| 'contador'` disfraza códigos corruptos. |
| 31 | `BaseCartucho.js` (`_montarConfiguracion` y `_leerConfiguracionGWC`) | **[RESUELTO en F5-I13]** **[C]** El GWC y el GWI no juegan igual: un GWI sin `rutas` no aumenta nunca el máximo de rutas simultáneas (1, la regla histórica), pero el generador escribe `aumentarCada = 1` cuando falta, y el lector lo devuelve como `rutas: {aumentarCada: 1}`. Con el GWC el máximo sube en cada lanzamiento y salen varias rutas a la vez. Comprobado: tras cargar el GWC `ComunListas.rutasDeCartucho()` da `{aumentarCada: 1}`; tras cargar el GWI, `null`. | Escribir 0xFFFF (nulo) cuando el GWI no declara `rutas.aumentarCada` y devolver `rutas: null` al leerlo (como ya se hace con la aceleración). Los GWC generados hasta ahora hay que regenerarlos. Revisar a la vez `pausas.externo` (el GWC escribe 500 si falta). **Principio:** un GWC cargado debe dar exactamente la misma partida que el GWI del que sale; añadir una prueba que compare los dos. |

---

## 2. Código frente a documentación

### El .tex dice una cosa y el código hace otra
- **Orden del tick (F3-I01, Memoria F3:64-66; C4-disenno).** El documento dice «entrada al empezar el tick, después borrar banderas». El código borra las banderas **después** de la entrada (1542-1550) y su propio comentario lo admite. Hoy no se nota porque el motor gráfico repinta todo, pero con el repintado selectivo de C4 (ESP32) **no se pintarían los movimientos del jugador**.
- **«combinar».** Hay tres versiones:
  - F4-I02: vive en el setup.
  - F4-I03: «casilla Combinar» / `teclado.combinar`.
  - Código: lo lee del cartucho (`BaseDirector.js:712`) y lo fuerza a `false` en el GWC.
  - Además, F3-I01/I02 describen un solo movimiento diagonal y el código hace dos movimientos encadenados; `MOVER` solo tiene izquierda y derecha.
- **Pausas y velocidades desde el setup (F4).** El código nunca las lee del setup. La aceleración resta milisegundos fijos, no es «proporcional».
- **Buffer de pulsaciones (F3-I02).** El documento cita `JuegoMotorEstados.pulsar` y dice «el motor es el único que toca el buffer». En el código no existe esa función: la cola está en `ComunListas` y la vacía el director.
- **Variedad de rutas (F3-I08).** El documento dice «regenerar si hay saturación». El código quita la candidata y genera una sola vez.
- **Cadenas por vida/muerte (F3-I08).** El documento y la cabecera del motor dicen que el barrido las atraviesa. En realidad la cadena aterriza y cuenta.
- **F3-I11 sin documentar:**
  - aterrizaje en la familia;
  - vida = contador interno 1 y muerte = 2, lo que choca con usar `salvadoContador='1'` como puntuación en Parachute;
  - conversión de los valores antiguos `'vida'`/`'muerte'`.
- **F3-I06 y F3-I10.** Usan `salvadoIndicador`/`ColisionPositiva`; el código usa `salvadoContador`/`muerteContador` con valores '1'-'4'. F3-I10 dice `seg_F01` y el código usa `F01`.
- **F3-I10, unión.** El documento habla de un único sistema de absorción. Dígito y contador usan otro mecanismo, que no hereda ni re-apunta.
- **Formato GWC (F5-I02) frente a `BaseCartucho.js`.** El fichero real sigue lo que hace el código, así que lo que hay que corregir es el .tex:
  - **Orden:** los contadores van detrás de los 20 enlaces, no entre ellos.
  - **Contador interno:** en el resto de segmentos vale 0xFF, no 0.
  - **Direcciones de sprites:** son relativas al contenido del bloque, no al fichero.
  - **Tamaño del bloque:** es el del contenido; el propio .tex se contradice en esto.
  - **Enlace ausente:** es 0xFF (1 byte), no 0xFFFF como dice F5-I01.
  - **Aceleración ausente:** se escribe como 0xFFFF; no está documentado.
  - **Códigos de fin 1/2/3:** no están documentados.
  - **Campo `codigo`:** en el código se llama `codigoGWC`.
  - **Alineación:** el Bloque 1 empieza en un byte impar, así que en C hará falta un struct `packed`. Conviene decirlo en el texto y no solo en una nota al pie.
- **F5-I03.** Planificaba `guardarGWC` y `estadistica` con el ahorro de la deduplicación. Se hizo de otra forma; anotarlo, porque I99 ya lo recoge como pendiente.
- **A7-anexo.tex** (lista de funciones):
  - Se quedó en la fase 4: no incluye `BaseCartucho.js` y sitúa funciones en el módulo antiguo.
  - Dice «GWC sin procesar (futuro)».
  - Le faltan `procesarGWC`, `fabricarSprite` y `fabricarFondoColor`.
- **Memoria F1.tex (260-281).** Sigue presentando el XOR y la unión con fantasmas tipo 99. Hoy el color se escribe directamente y la unión crea una pieza F nueva con `fusionadoPor`.
- **F1-I08.** Dice que el JSDoc lleva `@iteracion`, pero no aparece ninguna vez.
- **F1-I11.** Se contradice sobre si el aparato usa `DibujarSegmento` o funciones propias. Usa funciones propias.
- **F1-I01.** Dice «A y B arrancan»; el Start por defecto es el 8 (R). También dice que `puerto` se valida con aviso, y no se valida.
- **C4-disenno.** Dice que el `tiempoEspera` lo cambia la máquina de estados según la puntuación. En el código lo cambia el director según los ticks.
- **Erratas:**
  - Memoria `capitulo5/F4.tex` termina a mitad de frase (l. 163: «…de la Secuencia:»).
  - F2-I02: nombres de fichero antiguos (`DirectorJuego`, `directorjuego.js`), «parchute» y «parachuite», y un `¢` suelto tras `\begin{figure}[H]`.

### Hecho en el código y no documentado
- Pulsar Start a mitad de partida la reinicia.
- `jugar()` oculta toda la interfaz.
- Un GWI cargado desde la pestaña Simulador no salta al Editor.
- Ctrl+Z puede borrar la ficha del cartucho.
- Las piezas de unión pueden cambiar a cualquier tipo.
- Los números F se saltan tras deshacer.
- El botón «Deshacer unión» solo aparece con GWI antiguos.
- `entrantesDe` también marca en magenta a quien declara colisión.

---

## 3. Simplificación y legibilidad (por impacto)

1. **Funciones gigantes. Partirlas por responsabilidades:**
   - `BaseDescomponer.mostrarPanel` (3072-4376, **~1300 líneas**): partir en `panelMarcados`, `panelCartucho`, `panelOrden`, `panelTipo`, `panelEnlaces`, `panelColision`, `panelDigito`, `panelContador` y `panelUnion`.
   - `aplicarEleccion` (279 líneas).
   - El manejador del selector de tipo (~175).
   - `JuegoMotorEstados.tick` (190): que se lea como una lista de 10 llamadas.
   - `iniciar` (110), `decidirColision` (100), `prepararContadores` (80).
   - `BaseDirector.procesarCartucho` (110), `generarGWIyGWC` (75), `montarGWI` (80).
2. **Patrones repetidos que piden una función:**
   - Fila «Elegir/Quitar» del panel, repetida 6 veces: sustituir por `filaEnlace(...)`.
   - `registrarCambio; reconstruir(); seleccion=…; refrescar(); mostrarPanel();`, repetido 19 veces: sustituir por `confirmar(g, entradas)`.
   - «Apagar actual, encender siguiente, `cambiar=true`» en el motor, repetido ~6 veces: sustituir por `encender(seg, v)`.
   - Escritura y retirada de inversos (direcciones y mostrarJunto, en 4 sitios): `escribirInverso` y `retirarInverso`.
   - Las siete llamadas `ComunListas.fijar*`, repetidas en `procesarCartucho` y `procesarGWC`: `publicarEnPuente(cfg)`.
   - Start o pulsar, duplicado (353-358 y 1034-1040): `accionarBoton(numero)`.
   - Las cuatro funciones `alSeleccionar*` repiten lo mismo: `tomarFichero(id)`.
   - Cálculo de envolvente, repetido 6 veces: `envolvente(cajas)`.
   - Alta y baja de ficticios, en 3 sitios: `aplicarAlta`/`aplicarBaja`.
   - `descargarGWC` copia `descargarBlob`, y `validarCabeceraGWC` repite `sumaDeVerificacion`.
3. **GWC: una sola tabla de layout por registro.** Hoy el registro de segmento se describe dos veces, al escribir y al leer, con offsets mágicos. Con una tabla `[{campo, bytes, escala, nulo}]`, más un escritor y un lector con cursor (`DataView`) y la aserción `Σbytes === 32`, se eliminan las asimetrías y queda una especificación que se puede copiar al .tex y al C del ESP32.
4. **Guardas defensivas innecesarias.** `typeof ComunListas/JuegoDirector/BaseDirector !== 'undefined'` aparece por todas partes, aunque `index.html` fija el orden de carga, y se usa de forma incoherente. Además hay enums de respaldo que copian `ComunListas.tipos`. Quitarlo todo.
5. **Portabilidad al ESP32 (motor):**
   - Resolver los ids de texto a índices al cargar; hoy `indiceDe` hace búsquedas lineales en cada paso.
   - Sustituir los mapas por id por bits por segmento.
   - Quitar `sort`/`filter` del tick (inicios, familias): calcularlos en `iniciar`.
   - Convertir `'ascendente'`/`'descendente'` en booleano.
   - En el motor gráfico, `pixelesDe` crea un canvas por segmento en cada tick: guardar las siluetas al cargar.
6. **Pintado duplicado.** El aparato tiene su propia copia de `DibujarFondo`/`DibujarSegmento`, y la parte de BaseGraficos que la duplica no la usa nadie. Unificarlo en `BaseGraficos.pintarSprite(...)` o recortar BaseGraficos.
7. **Código muerto o sobrante:**
   - **BaseDirector:** `avisarEtiquetas`, la parte de dibujo de `mostrarSprites` (siempre se llama con `[]`), las variables privadas `sprites`/`segmentos`, `ESTILOS.*.descripcion` y los exports `pestanna`, `informarEstadistica` e `imagenBlob`.
   - **BaseCartucho:**
     - `BLOQUE_FONDO_GWC`: sin uso.
     - Exports `leerGWB`, `leerGWI`, `leerJSON`, `escalar`, `indiceDe` y `bloque`.
     - `cargarDelMapa`: su lógica está copiada en `BaseDirector.js:740`; o se usa allí o se borra.
     - `'GWC'` en `TIPOS_CARTUCHO`: con eso se acepta un .json de tipo GWC.
     - `json.img_s` en el nivel raíz.
   - **BaseDescomponer:**
     - `segmentosEnMemoria`.
     - El parámetro `codigo` de `montarGWI`.
     - `dx`/`dy`: restos de «Posicionar».
     - El código de compatibilidad con GWI antiguos (`uniones`, `{unir}`, tipo 99, «Deshacer unión»): aislarlo en un bloque o retirarlo.
   - **JuegoMotorEstados:** el `splice` de `iniciar` (1427-1429) no hace nada; `pruebaAleatorios`, `jugadorActual`, `rutasVivas`, `congelada`, `estadoRutas` y `MOVER` se exportan sin uso.
   - **JuegoDirector:** 14 líneas de prueba comentadas en `arrancar`, `pausaVigente` y la comprobación redundante `ticks > 0`.
8. **Comentarios:**
   - Ocupan más de la mitad de algunos ficheros y mezclan historial («23-10», «F4-I9», «duodécima iteración», «v12.5», `@since 12.5`) con la explicación. Dejar en el código el **qué** y el **por qué**, y llevar la historia al LaTeX.
   - Desactualizados:
     - Motor de estados: «TRES cosas», «nace un tick tras morir», «interrumpida con cada colisión», `rutasVivas` «0 o 1» y la errata «ATRIZA».
     - BaseCartucho: «CRC», «GWC > GWI > GWB» y «little-endian» aplicado a RGB.
     - BaseDirector: el comentario de `imagenBlob`, «único miembro público», «combinar viene del setup» y «pantalla en blanco» (pinta gris).
     - BaseDescomponer: JSDoc duplicados o descolocados en 542-580 y 2583-2593, y frases cortadas en 743, 1114, 1135-1141 y 4706.
   - Codificación de BaseGraficos.js: mojibake («INVERSIíN», «píºblica») y 26 guiones blandos U+00AD invisibles.
9. **Pestañas (nuevo).**
   - Funcionan, salvo el bloqueo #1.
   - Accesibilidad:
     - faltan `role="tablist"/"tab"` y `aria-selected`;
     - no hay estilo `:focus-visible`;
     - los botones de la máquina solo responden a `pointerdown`, así que no se pueden usar con Enter o Espacio.
   - `mostrarPestanna` sobrescribe `className`; mejor `classList.toggle` o atributos `data-vista`.
   - El nombre aparece escrito de tres formas: `pestanna`, `pestanaVista` y `#pestanas`.
