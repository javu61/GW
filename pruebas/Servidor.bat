@echo off
rem ============================================================================
rem Servidor.bat - Sirve el proyecto por http y abre index.html en el navegador.
rem   Servidor.bat [puerto]        (por defecto 8080; si esta ocupado, prueba los siguientes)
rem Las cargas de cartuchos y las pruebas que leen ficheros del proyecto (G3 y
rem todas las de la pestana Pruebas que cargan) necesitan http: abrir index.html
rem con doble clic (file://) no vale.
rem Requiere Node.js: si "node" no se reconoce en el PATH, busca el ejecutable
rem en las ubicaciones de instalacion habituales.
rem ============================================================================
setlocal
set "NODE_EXE="
where node >nul 2>nul && set "NODE_EXE=node"
if not defined NODE_EXE if exist "%ProgramFiles%\nodejs\node.exe" set "NODE_EXE=%ProgramFiles%\nodejs\node.exe"
if not defined NODE_EXE if exist "%ProgramFiles(x86)%\nodejs\node.exe" set "NODE_EXE=%ProgramFiles(x86)%\nodejs\node.exe"
if not defined NODE_EXE if exist "%LOCALAPPDATA%\Programs\nodejs\node.exe" set "NODE_EXE=%LOCALAPPDATA%\Programs\nodejs\node.exe"
if not defined NODE_EXE if exist "%USERPROFILE%\scoop\shims\node.exe" set "NODE_EXE=%USERPROFILE%\scoop\shims\node.exe"
if not defined NODE_EXE (
  echo No se encontro Node.js: instalalo desde https://nodejs.org o anadelo al PATH.
  echo Las pruebas de consola (pruebas\Lanzar.bat) tambien lo necesitan.
  pause
  exit /b 1
)
"%NODE_EXE%" "%~dp0servidor.js" %1
