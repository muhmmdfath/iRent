param([ValidateSet('backend', 'frontend')][string]$App = 'frontend')
$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path $PSScriptRoot -Parent
$localNode = Join-Path $env:LOCALAPPDATA 'iRent/runtime/node_modules/node/bin'
if (Test-Path (Join-Path $localNode 'node.exe')) {
    $env:PATH = "$localNode;$env:PATH"
}
Set-Location (Join-Path $projectRoot $App)
& npm.cmd run dev
exit $LASTEXITCODE
