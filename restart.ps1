Write-Host "========================================================" -ForegroundColor Cyan
Write-Host "  Restarting Zikaron3D Expo Dev Server (with Tunnel)..." -ForegroundColor Cyan
Write-Host "========================================================" -ForegroundColor Cyan

Set-Location -Path $PSScriptRoot

Write-Host "[1/2] Terminating any stale Metro processes on port 8081..." -ForegroundColor Yellow
$processes = Get-NetTCPConnection -LocalPort 8081 -ErrorAction SilentlyContinue | Select-Object -ExpandProperty OwningProcess -Unique
if ($processes) {
    foreach ($procId in $processes) {
        Stop-Process -Id $procId -Force -ErrorAction SilentlyContinue
    }
}

Write-Host "[2/2] Launching Expo with Tunnel and clean cache..." -ForegroundColor Green
npx expo start --tunnel -c
