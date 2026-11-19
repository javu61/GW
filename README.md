# GW
Game &amp; Watch: Proyecto de creación de un sistema para juegos del tipo WG en un ESP32

Fichero  Index.html      : Carga del entorno
Ficheros Base*           : Editor de cartuchos
Ficheros Juego*          : Emulador para ejecutar el juego
Directorio GW Memoria    : Memoria del proyecto
Directorio GW Iteraciones: Diario del desarrollo
Ficheros setup*.js       : Configuración de la máquina
Ficheros cartucho*       : Datos de los cartuchos creados
Directorio cartucho      : Cartucho GWB sin comprimir


ORDEN DE CAGA DE LOS MODULOS:
  <script src="designer/jszip.min.js"></script>
  <script src="designer/ComunListas.js"></script>
  <script src="designer/BaseExtractor.js"></script>
  <script src="designer/BaseGraficos.js"></script>
  <script src="designer/BaseDescomponer.js"></script>
  <script src="designer/BasePack.js"></script>            <!-- Manejo de ficheros comprimidos -->
  <script src="designer/BaseCartucho.js"></script>        <!-- Manejo de Cartuchos -->
  <script src="designer/BaseFicha.js"></script>           <!-- La ficha de la pestaña Cartucho (no depende de nadie). --> 
  <script src="designer/BaseDirector.js"></script>
  <script src="designer/JuegoMotorEstados.js"></script>
  <script src="designer/JuegoMotorGrafico.js"></script>
  <script src="designer/JuegoDirector.js"></script>

El fichero cartucho_GWC.gwc es el único binario y no se debe tocar, igual que los empaquetados y los de imágenes *.png, pero para el resto todos los ficheros de texto y de fuentes deben usar convención de fin de línea de Windows CR+LF.