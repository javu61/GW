C:\Users\JoseAntonio\Desktop\___GW___\pruebas>Lanzar.bat todas

######## motor
== M0 orden del tick
OK    el paso del jugador ocurre
OK    las banderas del paso SOBREVIVEN al tick (limpieza antes de la entrada)
OK    el tick siguiente deja las banderas limpias
== M1 secundarios
OK    M1: con un secundario nunca hay más rutas en pantalla que el máximo (1)
OK    M1: nRutasVivas coincide con las rutas visibles y no es negativo
== M2 iconos
OK    M2a: tras iniciar, el secundario del icono coincide con su principal
OK    M2b: el secundario del icono se enciende en el mismo tick que su principal
== M3 barrido
OK    M3a: dos rutas seguidas en la cadena avanzan las dos, con la lista en cualquier orden
OK    M3b: la ruta que llega a un final donde otra muere sobrevive, con la lista en cualquier orden
OK    M3c: dos rutas que confluyen dan el mismo resultado con la lista en cualquier orden y el contador exacto
== M4 colisión, secuencia y congelación
OK    M4a: la colisión se decide el mismo tick: el punto no queda encendido y la cadena nace
OK    M4b: sigue habiendo lanzamientos de ruta (no se atasca el contador)
OK    M4b: nunca hay «vivas» sin una ruta que las justifique
OK    M4c: tras nacer el desenlace, otra ruta de la misma pasada no avanza
OK    M4c (lista invertida): tras nacer el desenlace, otra ruta de la misma pasada no avanza
== M5 jugador
OK    M0 orden del tick: tras mover, el jugador nuevo queda con la bandera «cambiar»
RESULTADO: OK

######## director
== D5 GWC sin máquina (requiere página recién cargada)
OK    D5: un GWC sin máquina previa NO carga con el error claro
OK    D5: no hay cartucho en memoria
== D6 carga sin setup (F5-I19)
OK    D6: un GWB con estilo carga SIN setup y crea la máquina
OK    D6: las pestañas Setup y Cartucho quedan disponibles
OK    D6: #estado avisa que el setup es derivado del cartucho
OK    D6: un GWI también carga sin setup y trae su autoría
== D1 GWC tras GWI
OK    D1 (previo): con el GWI cargado hay autoría y Guardar/Generar activos
OK    D1: tras cargar el GWC el cartucho es el GWC
OK    D1: tras cargar el GWC no quedan Guardar/Generar ni Editor de la autoría del GWI
== D3 cartucho incompatible
OK    D3 (previo): el GWB bueno carga
OK    D3: el cartucho incompatible no carga y el anterior sigue siendo el cartucho
OK    D3: la botonera sigue como la del cartucho anterior
OK    D3: el editor sigue disponible con el cartucho anterior
== D2 GWB que no descompone
OK    D2: un GWB cuya img_s no descompone no deja Guardar/Generar ni Editor habilitados
== D4 GWB sobre autoría
OK    D4 (previo): el GWI cargado tiene autoría y Guardar activo
OK    D4: recargar el MISMO GWI no avisa de historial
OK    D4: cargar un GWB sobre un GWI con autoría avisa del historial descartado
OK    D4 (previo): el GWB ahora es el cartucho en memoria
== D7 cambio de máquina en caliente (F5-I19)
OK    D7 (previo): la máquina es la del setup2 (maquina-2)
OK    D7: el cartucho nuevo está cargado
OK    D7: la máquina se re-ajusta en caliente (esqueleto del estilo 4)
OK    D7: el lienzo toma la resolución del cartucho
OK    D7: la botonera es la del estilo 4
FALLO D7: img_s del cartucho cargado y autoría disponible  -> {"tipo":"GWB","nombre":"Estilo4","imgS":true,"guardar":false,"generar":false,"pesEditor":false}
OK    D7: #estado avisa del setup derivado
== D8 botón Limpiar de la Carga (F5-I19)
OK    D8 (previo): hay máquina y la pestaña Simulador está habilitada
OK    D8: #estado queda en «Sin setup cargado.»
OK    D8: no queda cartucho en memoria
OK    D8: la máquina queda oculta
OK    D8: la vista delante es la Carga
OK    D8: Cartucho y Simulador se deshabilitan
OK    D8: repetir Limpiar sin nada cargado no rompe (idempotente)
== D9 aplicar propaga datos comunes y confirma (F5-I20)
OK    D9 (previo): el GWS cargó y no hay cartucho
OK    D9: el nombre del setup llega a la ficha de Cartucho
FALLO D9: la memoria del setup (RAM/FLASH) llega a la ficha de Cartucho
OK    D9: el ColorFondo del setup llega a la ficha de Cartucho
OK    D9: estilo y resolución siguen llegando (como antes)
OK    D9: la memoria del GWB pasa al setup derivado (subcampo a subcampo)
OK    D9 (previo): hay cartucho (Parachute) antes de aplicar
FALLO D9: aplicar setup con cartucho pide confirmación
FALLO D9: cancelar conserva el cartucho (y avisa de NO aplicado)  -> Setup aplicado: Parachute (el cartucho y su autoría siguen en memoria).
FALLO D9: confirmar aplica el setup (cartucho fuera)  -> {"tipo":"GWB","nombre":"Parachute","imgS":true,"guardar":true,"generar":true,"pesEditor":true}
FALLO D9: tras aplicar de nuevo la ficha recibe los datos comunes  -> {"nombre":"Parachute","descripcion":"","estilo":"2","resolucion":{"ancho":320,"alto":240},"colorFondo":null,"imagenes":{"img_s":{"imagen":{},"nombre":"img_s.png"},"img_f":{"imagen":{},"nombre":"img_f.png"},"img_m":{"imagen":{},"nombre":"img_m.png"}}}
FALLO D9: con GW_DEBUG no se pide confirmación (las suites corren solas)  -> {"tipo":"GWB","nombre":"Parachute","imgS":true,"guardar":true,"generar":true,"pesEditor":true}
== D10 ajuste de resolución (F5-I21)
OK    D10 (previo): el GWI cargó con juego en memoria
FALLO D10: ajustar a la misma resolución no toca nada
OK    D10: ajustar a 640×480 se aplica
FALLO D10: las posiciones se reescalan con el redondeo del GWC (×2 entero)  -> ["seg_000",114,6]
OK    D10: la autoría queda intacta (mismas acciones)
OK    D10: el setup declara la nueva resolución
OK    D10: la pantalla del aparato mide lo nuevo
OK    D10: fuera de rango (200×200) se rechaza sin tocar nada
OK    D10: la ventana abre con factor de escala y efecto sobre los segmentos
OK    D10: la ventana tiene Cancelar y Ajustar resolución
OK    D10: cancelar cierra y conserva
OK    D10: fuera de rango la ventana deshabilita «Ajustar resolución»
FALLO D10: vuelta a 320×240 exacta (factor entero en ambas direcciones)
RESULTADO: ERROR (10 fallo(s))

######## editor
== Editor (E1-E9)
OK    E2: tras cargar un GWI el historial no guarda ids «F01» (son raíces numéricas)
OK    E2: guardar el historial cargado reproduce el del GWI (ida y vuelta)
OK    E2: deshacer el alta de una pieza F cargada la quita de verdad
OK    E3: presentarCero=false viaja en el segmento del contador del GWI
OK    E3: presentarCero=false sobrevive a recargar el historial
OK    E1: al unir, sec_1 y sec_2 pasan a apuntar a la pieza nueva
OK    E1: tras unir no quedan referencias colgantes de la Secuencia
OK    E4: juego→inicio conserva siguiente, salvado y «mostrar junto a» (los usa el tipo nuevo)
OK    E4: inicio→adicional conserva siguiente y descarta salvado y mostrarJunto
OK    E4: al descartar mostrarJunto se limpia el mostradoJunto del secundario
OK    E5: tras deshacer todo, la ficha del cartucho sigue existiendo
OK    E5: el historial conserva el alta de la ficha (no se deshace)
OK    E6: tras unir 2 inicios las rutas son 1..N-1 sin huecos ni repetidos
OK    E6: los absorbidos no llevan número de ruta
OK    E7: unir dos dígitos marcados no crea ninguna pieza
OK    E7: una pieza de unión no puede pasar a dígito
OK    E8: un PNG con fondo transparente pasa la verificación B/N
OK    E8: del PNG transparente sale solo el cuadrado negro (1 componente de 3×3)
OK    E9 (previo): la verificación calculó el inverso B.izquierda = A
OK    E9: el primer Ctrl+Z tras Verificar deshace la última acción del autor (A.derecha)
OK    E9: el GWI guarda el inverso derivado marcado «auto»
OK    E9: rehacer devuelve la acción del autor y su inverso derivado
OK    E9: y se lleva con ella los inversos derivados (B.izquierda), sin dejar acciones invisibles
== E10 ajuste de resolución (F5-I21)
OK    E10: ajustar a 640×480 se aplica
FALLO E10: los sprites reescalados siguen en blanco y negro puro  -> 94 sprites
FALLO E10: round-trip 320→640→320 exacto (dimensiones y posiciones)
OK    E10: la autoría sobrevive al ajuste
RESULTADO: ERROR (2 fallo(s))

######## generales
== G1 CRC y lector del GWC
OK    G1: GWC genera y se lee
OK    G1: CRC detecta bytes intercambiados (la suma aditiva no)
OK    G1: fondo por defecto blanco
OK    G1: CRC del test = CRC del módulo
OK    G1: vector 123456789 = 0x29B1
OK    G1: sprite fuera de rango
OK    G1: enlace fuera de rango
OK    G1: Secuencia con segmento fuera de rango
OK    G1: mecanismo de fin desconocido
OK    G1: tabla de sprites que no cabe
== G2 ColorFondo en el GWC
OK    G2: ColorFondo viaja al GWC
OK    G2: ColorFondo cambia el código del GWC
OK    G2: combinar viaja en el Bloque 0
OK    G2: Bloque 0 de 36 bytes y Bloque 1 de 16 bytes
== G3 ColorFondo (ficha y GWB)
OK    G3: la ficha entrega ColorFondo
OK    G3: blanco no viaja
OK    G3: GWB sin img_f guarda el ColorFondo
RESULTADO: OK

######## gwi_gwc
== C1 equivalencia (datos)
OK    C1: equivalencia de datos
== C2 equivalencia (variante)
OK    C2: equivalencia de datos (variante)
== C3 equivalencia (juego)
OK    datos iguales
OK    juego (semilla 1): 48 ticks con el GWI, 48 con el GWC
OK    juego (semilla 6699): 37 ticks con el GWI, 37 con el GWC
OK    juego (semilla 48879): 32 ticks con el GWI, 32 con el GWC
OK    juego (semilla 32767): 37 ticks con el GWI, 37 con el GWC
OK    juego (semilla 4660): 32 ticks con el GWI, 32 con el GWC
== C4 equivalencia (completa)
OK    datos iguales
OK    juego (semilla 1): 38 ticks con el GWI, 38 con el GWC
OK    juego (semilla 6699): 37 ticks con el GWI, 37 con el GWC
OK    juego (semilla 48879): 32 ticks con el GWI, 32 con el GWC
OK    juego (semilla 32767): 33 ticks con el GWI, 33 con el GWC
OK    juego (semilla 4660): 33 ticks con el GWI, 33 con el GWC
== C5 par: ficha codigoGWC
FALLO C5: el GWI cargado muestra su codigoGWC en la ficha de Cartucho  -> 320 (esperado #EE6F#)
== C6 par: guardar despareja
FALLO C6: guardar el GWI a secas avisa de que el GWC del destino queda desparejado  -> GWI guardado SIN codigoGWC: el GWC del destino (#EE6F#) queda desparejado; usa Generar GWI+GWC para mantener el par.
FALLO C6: la ficha de Cartucho vuelve a «---» al soltar el código  -> 320
== C7 par: generar desfasado
FALLO C7 (previo): el GWI cargado mantiene su codigoGWC declarado en la ficha  -> 320
OK    C7: generar avisa de que el GWC anterior queda desfasado (los dos códigos)
OK    C7: la ficha muestra el codigoGWC NUEVO del par
== C8 memoria: porcentaje al generar
OK    C8: con memoria en el setup, el aviso final trae la RAM con su porcentaje
OK    C8: FLASH sale con 0 KB y 0 % (aún no se cuenta el fondo)
OK    C8: la línea del panel (informarTamanos) trae también la ocupación
OK    C8: la RAM del cartucho manda sobre la del setup
OK    C8: la FLASH que el cartucho no declara se toma del setup
OK    C8: memoria ausente → sin porcentaje en el aviso final
OK    C8: memoria ausente → sin línea de memoria en el panel
OK    C8: memoria a 0 → sin porcentaje en el aviso final
OK    C8: memoria a 0 → sin línea de memoria en el panel
== C9 ajuste de resolución (F5-I21)
OK    C9: ajustar a 640×480 se aplica
FALLO C9: los sprites miden lo mismo que da el escalar del GWC  -> 125 divergencias
FALLO C9: las posiciones de los segmentos son el redondeo del generador
RESULTADO: ERROR (6 fallo(s))

######## teclas
== T1 tecla cursor y rechazos
OK    T1: un GWS con tecla «cursor-izquierda» se carga
OK    T1: el botón con cursor-izquierda lleva la pista «←» y la flecha del PC lo pulsa y suelta
OK    T1: tecla mal escrita «cursorziq» NO carga
OK    T1: tecla dígito «1» NO carga (retirada en F5-I17)
== T2 teclas por defecto por estilo
OK    T2: estilo 2 sin teclas — 0/4 cursores izq/der (pista «←») y trío A/B/R con 1/2/3
OK    T2: estilo 5 sin teclas — cruceta 0-3 con los cuatro cursores y el 4 con la letra Z
== T3 teclas del cartucho
OK    T3: el GWB con teclas propias carga
OK    T3: mandan las teclas del cartucho (0 → M, 4 → cursor-arriba) y el 6 sin tecla cae al setup (Z)
OK    T3: el dígito «2» como tecla del botón 6 (trío A/B/R) carga
OK    T3: el botón 6 queda con la tecla «2» del cartucho
OK    T3: el dígito «1» en un botón fuera del trío NO carga
OK    T3: tecla dígito «5» en el cartucho NO carga
OK    T3: tecla repetida en el cartucho NO carga
RESULTADO: OK

######## RESUMEN
  motor      OK
  director   ERROR
  editor     ERROR
  generales  OK
  gwi_gwc    ERROR
  teclas     OK
RESULTADO: ERROR (fallan: director, editor, gwi_gwc)