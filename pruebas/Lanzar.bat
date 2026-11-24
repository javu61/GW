@echo off
rem ============================================================================
rem Lanzar.bat - Lanza una prueba de consola por su nombre.
rem   Lanzar.bat motor | director | editor | generales | gwi_gwc | teclas | todas
rem Se puede llamar desde cualquier carpeta (usa su propia ruta). Prepara
rem Playwright si falta, lanza la prueba y termina con RESULTADO: OK o
rem RESULTADO: ERROR y el codigo de salida 0 o 1.
rem ============================================================================
setlocal
chcp 65001 >nul
set "F="
if /i "%~1"=="motor"     set "F=pruebasMotor.ps1"
if /i "%~1"=="director"  set "F=pruebasDirector.ps1"
if /i "%~1"=="editor"    set "F=pruebasEditor.ps1"
if /i "%~1"=="generales" set "F=pruebasGenerales.ps1"
if /i "%~1"=="gwi_gwc"   set "F=pruebasGWI_GWC.ps1"
if /i "%~1"=="teclas"    set "F=pruebasTeclas.ps1"
if /i "%~1"=="todas"     set "F=pruebasTodas.ps1"
if not defined F goto ayuda

powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0%F%"
exit /b %ERRORLEVEL%

:ayuda
echo Uso: Lanzar.bat ^<prueba^>
echo   motor      Motor de estados
echo   director   Director (carga de cartuchos)
echo   editor     Editor (E1-E9)
echo   generales  GWC (CRC, lector) y ColorFondo
echo   gwi_gwc    Equivalencia entre GWI y GWC
echo   teclas     Teclas del simulador (cursores y defaults por estilo)
echo   todas      Todas, una detras de otra
exit /b 1
