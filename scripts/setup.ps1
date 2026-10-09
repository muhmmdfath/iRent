$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path $PSScriptRoot -Parent
Set-Location $projectRoot
$localRuntime = Join-Path $env:LOCALAPPDATA 'iRent/runtime'
$localNode = Join-Path $localRuntime 'node_modules/node/bin'
if (!(Test-Path (Join-Path $localNode 'node.exe'))) {
    & npm.cmd install --prefix $localRuntime node@24 --no-save
    if ($LASTEXITCODE -ne 0) { throw 'Instalasi Node 24 gagal.' }
}
$env:PATH = "$localNode;$env:PATH"
& node scripts/setup-env.cjs
if ($LASTEXITCODE -ne 0) { throw 'Pembuatan environment gagal.' }
& docker compose up -d --wait postgres
if ($LASTEXITCODE -ne 0) { throw 'PostgreSQL gagal start. Pastikan Docker Desktop berjalan.' }
try {
    Set-Location (Join-Path $projectRoot 'backend')
    foreach ($task in @('ci', 'run db:deploy', 'run build', 'run db:seed')) {
        $npmArguments = $task.Split(' ')
        & npm.cmd @npmArguments
        if ($LASTEXITCODE -ne 0) { throw "Backend: npm $task gagal." }
    }
    Set-Location (Join-Path $projectRoot 'frontend')
    & npm.cmd ci
    if ($LASTEXITCODE -ne 0) { throw 'Instalasi frontend gagal.' }
    & npm.cmd run build
    if ($LASTEXITCODE -ne 0) { throw 'Build frontend gagal.' }
} finally {
    Set-Location $projectRoot
}
Write-Host 'Setup selesai. Jalankan scripts/dev.ps1 backend dan scripts/dev.ps1 frontend di dua terminal.'
