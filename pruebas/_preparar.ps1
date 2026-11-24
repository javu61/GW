# pruebas/_preparar.ps1 - Prepara el entorno de las pruebas de consola (se ejecuta con ". .\_preparar.ps1")
# ================================================================================================
# QUE HACE (es idempotente: si ya esta todo, solo tarda un instante)
#   1. Comprueba que Node.js esta instalado.
#   2. Instala Playwright de forma global (npm i -g playwright) si falta.
#   3. Define NODE_PATH con la carpeta global de npm, para que Node encuentre Playwright.
#   4. Descarga el navegador Chromium que usa Playwright (la primera vez tarda).
#   5. Pone la consola en UTF-8 para que se lean bien los acentos.
# Si algo falla, escribe «RESULTADO: ERROR (motivo)» y termina con codigo 1.
# NO se lanza solo: lo llaman los scripts pruebas*.ps1.
# ================================================================================================

[Console]::OutputEncoding = [System.Text.Encoding]::UTF8

function Terminar-ConError($motivo) {
    Write-Host "RESULTADO: ERROR ($motivo)"
    exit 1
}

if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
    Terminar-ConError 'Node.js no esta instalado: descargalo de https://nodejs.org'
}

$raizNpm = (npm root -g).Trim()
if (-not (Test-Path (Join-Path $raizNpm 'playwright'))) {
    Write-Host 'Instalando Playwright (solo la primera vez)...'
    npm i -g playwright
    if ($LASTEXITCODE -ne 0) { Terminar-ConError 'no se pudo instalar Playwright con npm i -g playwright' }
}
$env:NODE_PATH = $raizNpm

node (Join-Path $raizNpm 'playwright\cli.js') install chromium
if ($LASTEXITCODE -ne 0) { Terminar-ConError 'no se pudo instalar el navegador Chromium de Playwright' }
