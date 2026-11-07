@echo off
title Zikaron3D - Expo Dev Server
echo ========================================================
echo   Restarting Zikaron3D Expo Dev Server (with Tunnel)...
echo ========================================================
cd /d "%~dp0"

echo [1/2] Terminating any stale Metro processes on port 8081...
for /f "tokens=5" %%a in ('netstat -aon ^| findstr :8081') do (
    taskkill /F /PID %%a >nul 2>&1
)

echo [2/2] Launching Expo with Tunnel and clean cache...
npx expo start --tunnel -c

pause
