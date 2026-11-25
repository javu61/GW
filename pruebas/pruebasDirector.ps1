# pruebas/pruebasDirector.ps1 - Pruebas del director del editor (carga de cartuchos)
# ================================================================================================
# Prepara Playwright si falta (ver _preparar.ps1) y lanza pruebas\pruebasDirector.js. Termina con
# «RESULTADO: OK» o «RESULTADO: ERROR (detalle)» y codigo de salida 0 o 1.
# Se lanza con:  pruebas\Lanzar.bat director     (el .bat evita el bloqueo de scripts de PowerShell)
# -SinPreparar: no comprueba la instalacion (lo usa pruebasTodas.ps1, que ya la ha comprobado).
# ================================================================================================
param([switch]$SinPreparar)

if (-not $SinPreparar) { . "$PSScriptRoot\_preparar.ps1" }
node "$PSScriptRoot\pruebasDirector.js"
exit $LASTEXITCODE
