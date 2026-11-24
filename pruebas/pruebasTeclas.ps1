# pruebas/pruebasTeclas.ps1 - Teclas del simulador (M4/M5/M6 de F5-I17)
# ================================================================================================
# Prepara Playwright si falta (ver _preparar.ps1) y lanza pruebas\pruebasTeclas.js. Termina con
# «RESULTADO: OK» o «RESULTADO: ERROR (detalle)» y codigo de salida 0 o 1.
# Se lanza con:  pruebas\Lanzar.bat teclas      (el .bat evita el bloqueo de scripts de PowerShell)
# -SinPreparar: no comprueba la instalacion (lo usa pruebasTodas.ps1, que ya la ha comprobado).
# ================================================================================================
param([switch]$SinPreparar)

if (-not $SinPreparar) { . "$PSScriptRoot\_preparar.ps1" }
node "$PSScriptRoot\pruebasTeclas.js"
exit $LASTEXITCODE
