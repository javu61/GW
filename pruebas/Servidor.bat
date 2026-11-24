@echo off
rem ============================================================================
rem Servidor.bat - Sirve el proyecto por http y abre index.html en el navegador.
rem   Servidor.bat [puerto]        (por defecto 8080; si esta ocupado, prueba los siguientes)
rem Las cargas de cartuchos y las pruebas que leen ficheros del proyecto (G3 y
rem todas las de la pestana Pruebas que cargan) necesitan http: abrir index.html
rem con doble clic (file://) no vale.
rem ============================================================================
setlocal
node "%~dp0servidor.js" %1
