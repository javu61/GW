# GW
Game &amp; Watch: Proyecto de creación de un sistema para juegos del tipo WG en un ESP32

NOTA: El fichero cartucho_GWC.gwc es el único binario y no se debe tocar, igual que los empaquetados 
      y los de imágenes *.png, pero para el resto todos los ficheros de texto y de fuentes deben usar
      convención de fin de línea de Windows CR+LF. Los nombres de ficheros deben ir en camelCase.

# Tipos de Cartucho:
GWS: Setup, el de la máquina final (pantalla y botones)
GWB: Base, imágenes de partida y botones a usar
GWI: Intermedio, todo lo necesario para el juego, en formato legible + imágenes
GWC: Compacto, el único binario preparado para la carga en el ESP32

# Estructura de ficheros
Directorio  GW Memoria        : Memoria del proyecto
Directorio  GW Iteraciones    : Diario del desarrollo

Fichero     index.html        : Carga del entorno
Directorio  designer          : Módulos javaScript
  Ficheros    base*           : Editor de cartuchos
  Ficheros    juego*          : Emulador para ejecutar el juego
  Fichero     comunListas.js  : Enlace entre módulos Base y Juego
  Fichero     estilos.css     : CSS del sistema
  Fichero     jszip.min.js    : módulo de manejo de ZIP estándar
Ficheros    setup*.js         : Configuración de la máquina base
Directorio  cartucho          : Cartucho GWB sin comprimir
Ficheros    cartucho*         : Datos de los cartuchos creados
Directorio  pruebas           : Pruebas (ver PRUEBAS más abajo)

# PRUEBAS:
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
    lanzar.bat           Lanza una prueba por su nombre
    *.ps1                Scripts de PowerShell que llama lanzar.bat; _preparar.ps1
                         instala Playwright (npm i -g playwright) y el navegador si faltan

  Comandos (copiar una línea y pegarla en CMD o PowerShell, parado en la carpeta
  pruebas del proyecto, donde está este lanzar.bat; la primera vez instala
  Playwright, necesita Node.js):
    lanzar.bat motor
    lanzar.bat director
    lanzar.bat editor
    lanzar.bat generales
    lanzar.bat gwi_gwc
    lanzar.bat todas
  Cada una termina con «RESULTADO: OK» o «RESULTADO: ERROR (detalle)» y código de salida
  0 o 1. Las pruebas de juego (gwi_gwc) tardan; «todas» tarda unos minutos.

  Opciones de gwi_gwc (variables de entorno, en PowerShell: $env:SEMILLAS="1,6699"):
    SEMILLAS=1,6699  TICKS=400  SIN_PULSAR=1
    GRABAR=fichero   guarda las partidas jugadas
    COMPARAR=fichero las compara con las guardadas (red de seguridad del motor)


# ORDEN DE CARGA DE LOS MÓDULOS:
  <script src="designer/jszip.min.js"></script>
  <script src="designer/comunListas.js"></script>
  <script src="designer/baseExtractor.js"></script>
  <script src="designer/baseGraficos.js"></script>
  <script src="designer/baseDescomponer.js"></script>
  <script src="designer/basePACK.js"></script>            <!-- Manejo de ficheros comprimidos -->
  <script src="designer/baseCartucho.js"></script>        <!-- Manejo de Cartuchos -->
  <script src="designer/baseFicha.js"></script>           <!-- La ficha de la pestaña Cartucho (no depende de nadie). --> 
  <script src="designer/baseDirector.js"></script>
  <script src="designer/juegoMotorEstados.js"></script>
  <script src="designer/juegoMotorGrafico.js"></script>
  <script src="designer/juegoDirector.js"></script>
