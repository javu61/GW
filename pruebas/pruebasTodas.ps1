# pruebas/pruebasTodas.ps1 - Lanza todas las pruebas de consola, una detras de otra
# ================================================================================================
# Prepara Playwright una sola vez (ver _preparar.ps1), lanza cada grupo con su script
# (-SinPreparar) y al final escribe un resumen. Tarda unos minutos (las de juego son lentas).
# Termina con «RESULTADO: OK» si todos pasan, o «RESULTADO: ERROR (...)» y codigo 1.
# Se lanza con:  pruebas\Lanzar.bat todas
# ================================================================================================
. "$PSScriptRoot\_preparar.ps1"

$scripts = [ordered]@{
    'motor'     = 'pruebasMotor.ps1'
    'director'  = 'pruebasDirector.ps1'
    'editor'    = 'pruebasEditor.ps1'
    'generales' = 'pruebasGenerales.ps1'
    'gwi_gwc'   = 'pruebasGWI_GWC.ps1'
}
$codigos = [ordered]@{}
foreach ($g in $scripts.Keys) {
    Write-Host ''
    Write-Host "######## $g"
    & (Join-Path $PSScriptRoot $scripts[$g]) -SinPreparar
    $codigos[$g] = $LASTEXITCODE
}

Write-Host ''
Write-Host '######## RESUMEN'
$malos = @()
foreach ($g in $codigos.Keys) {
    if ($codigos[$g] -eq 0) { Write-Host ("  {0,-10} OK" -f $g) }
    else { Write-Host ("  {0,-10} ERROR" -f $g); $malos += $g }
}
if ($malos.Count -eq 0) { Write-Host 'RESULTADO: OK'; exit 0 }
Write-Host ('RESULTADO: ERROR (fallan: ' + ($malos -join ', ') + ')')
exit 1
