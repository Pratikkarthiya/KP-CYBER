@echo off
title KP CYBER Live Portal Supervisor
color 0A

echo =======================================================
echo          KP CYBER SERVICE PROVIDER PORTAL
echo   With YouPI-PG Gateway & Cloudflare Live Tunnel
echo =======================================================
echo.

cd /d "%~dp0"

echo [1/3] Starting YouPI-PG Gateway Services...
start "YouPI Gateway" cmd /c "cd youpi-pg-repo && node scripts/start.js"

timeout /t 3 /nobreak >nul

echo [2/3] Starting KP Cyber Web Server...
start "KP Cyber Server" cmd /c "node server.js"

timeout /t 3 /nobreak >nul

echo [3/3] Starting Cloudflare Live Tunnel...
echo.
echo Tunnel is connecting... Your live HTTPS URL will appear below:
echo.
.\cloudflared.exe tunnel --url http://localhost:3000

pause
