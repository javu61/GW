# R2. Revisión del código: solo lo pendiente — actualizado tras F5-I17

♠

## F5-I16. Cambios en el Texto 
- **Orden del tick (F3-I01, Memoria F3):** el código ya hace (0) limpieza, (1) entrada, (2) rutas (el comentario del motor ya está corregido); el texto de la Memoria F3 (l. 65-66) sigue con el orden antiguo. Texto nuevo propuesto en F5-I15a (l. 34-41), sin aplicar.
- **«combinar»:** la explicación de la Memoria F3 ya está actualizada con el texto de F5-I15a; quedan el «Hoy esta regla vive únicamente en el *setup*» de F4-I02 (l. 82) y los pasos diagonales de F3-I01 (l. 78) y F3-I02 (l. 87) — el código hace dos movimientos encadenados y `MOVER` solo tiene izquierda y derecha.
- **Cadenas por vida/muerte (F3-I08):** la cabecera del motor ya está corregida; quedan dos «atraviesa» en la Memoria F3 (l. 580 y 597, filas descriptivas de la tabla de pruebas) por revisar.
- **F5-I03:** planificaba `guardarGWC` y `estadistica` con el ahorro de deduplicación; se hizo distinto; anotarlo (aún no está en F5-I15a).
- **F3-I06 y F3-I10:** usan `salvadoIndicador`/`ColisionPositiva`; el código, `salvadoContador`/`muerteContador` con valores '1'-'4'. F3-I10 dice `seg_F01`, el código `F01`. Dígito y contador usan otro mecanismo de absorción, que no hereda ni re-apunta.
- **Memoria F1.tex (260-281):** presenta el XOR y la unión con fantasmas tipo 99; hoy el color se escribe directo y la unión crea una pieza F con `fusionadoPor`.
- **F1-I08:** dice que el JSDoc lleva `@iteracion` (l. 113); no aparece.
- **F1-I11:** se contradice sobre `DibujarSegmento` o funciones propias (l. 21 y 36; usa propias).
- **F1-I01:** dice «A y B arrancan… Solo se usa actualmente el botón A» (l. 17); hoy el arranque por defecto es el 8, R. (La validación de `puerto` con aviso quedó resuelta en F5-I16.)
- **C4-disenno (l. 195, 204 y 232):** dice que `tiempoEspera` lo cambia la máquina de estados según puntuación; lo cambia el director según los ticks.
- **Erratas F2-I02:** «parchute» (l. 111), «parachuite» (l. 112-114) y un `¢` suelto tras `\begin{figure}[H]` (l. 125).

