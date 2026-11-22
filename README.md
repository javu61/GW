# GW
Game &amp; Watch: Proyecto de creación de un sistema para juegos del tipo WG en un ESP32

NOTA: El fichero cartucho_GWC.gwc es el único binario y no se debe tocar, igual que los empaquetados 
      y los de imágenes *.png, pero para el resto todos los ficheros de texto y de fuentes deben usar
      convención de fin de línea de Windows CR+LF.

Tipos de Cartucho:
GWS: Setup, el de la máquina final (pantalla y botones)
GWB: Base, imágenes de partida y botones a usar
GWI: Intermedio, todo lo necesario para el juego, en formato legible + imágenes
GWC: Compacto, el único binario preparado para la carga en el ESP32


Directorio  GW Memoria        : Memoria del proyecto
Directorio  GW Iteraciones    : Diario del desarrollo

Fichero     Index.html        : Carga del entorno
Directorio  designer          : Módulos javaScript
  Ficheros    Base*           : Editor de cartuchos
  Ficheros    Juego*          : Emulador para ejecutar el juego
  Fichero     ComunListas.js  : Enlace entre módulos Base y Juego
  Fichero     estilos.css     : CSS del sistema
  Fichero     jszip.min.js    : módulo de manejo de ZIP estándar
Ficheros    setup*.js         : Configuración de la máquina base
Directorio  cartucho          : Cartucho GWB sin comprimir
Ficheros    cartucho*         : Datos de los cartuchos creados
Directorio  pruebas           : Pruebas en Node (consola) y del navegador (pestaña 
                                pruebas, visible solo con GW_DEBUG, el módulo es 
                                pruebas/pruebas.js)

ORDEN DE CARGA DE LOS MÓDULOS:
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
