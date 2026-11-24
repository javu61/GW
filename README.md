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
Directorio  pruebas           : Pruebas (ver PRUEBAS más abajo)

PRUEBAS:
  Una prueba, un sitio: la lógica de cada prueba está en un solo fichero y se lanza
  de dos formas con el MISMO código: el botón de la pestaña «Pruebas» (visible solo con
  GW_DEBUG) o un comando de consola. index.html debe abrirse por servidor local (http).

  Ficheros de pruebas (directorio pruebas):
    pruebas.js           Ejecutor: catálogo, botones y panel «Desde consola»
    lanzador.js          Lanzador de Node + Playwright (lo usan los de abajo)
    pruebasMotor.js      Motor de estados                         (botón + comando)
    pruebasDirector.js   Carga de cartuchos; sustituye el cartucho cargado (botón + comando)
    pruebasEditor.js     Editor E1-E9                              (SOLO comando)
    pruebasGenerales.js  GWC (CRC, lector) y ColorFondo            (botón + comando)
    pruebasGWI_GWC.js    Equivalencia GWI-GWC, datos y partidas    (botón + comando)
    cartuchos            Cartuchos propios de las pruebas (setup2/4, GWI, GWB)
    Lanzar.bat           Lanza una prueba por su nombre
    *.ps1                Scripts de PowerShell que llama Lanzar.bat; _preparar.ps1
                         instala Playwright (npm i -g playwright) y el navegador si faltan

  Comandos (copiar una línea y pegarla en CMD o PowerShell, en la carpeta del proyecto;
  la primera vez instala Playwright, necesita Node.js):
    pruebas\Lanzar.bat motor
    pruebas\Lanzar.bat director
    pruebas\Lanzar.bat editor
    pruebas\Lanzar.bat generales
    pruebas\Lanzar.bat gwi_gwc
    pruebas\Lanzar.bat todas
  Cada una termina con «RESULTADO: OK» o «RESULTADO: ERROR (detalle)» y código de salida
  0 o 1. Las pruebas de juego (gwi_gwc) tardan; «todas» tarda unos minutos.

  Opciones de gwi_gwc (variables de entorno, en PowerShell: $env:SEMILLAS="1,6699"):
    SEMILLAS=1,6699  TICKS=400  SIN_PULSAR=1
    GRABAR=fichero   guarda las partidas jugadas
    COMPARAR=fichero las compara con las guardadas (red de seguridad del motor)


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
