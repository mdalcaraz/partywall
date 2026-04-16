@echo off
title Foto Booth - DEV
color 0B
cls

echo.
echo  ==========================================
echo   FOTO BOOTH - Modo desarrollo
echo  ==========================================
echo.
echo  [1] Sin tunel    (solo localhost)
echo  [2] Tunel rapido (URL publica random, sin cuenta)
echo  [3] Tunel fijo   (fotoevento.topdjgroup.com)
echo.
set /p OPCION="Elegir opcion (1/2/3): "

:: Servidor backend
start "Backend :3000" cmd /k "cd /d %~dp0 && node server.js"
timeout /t 2 /nobreak >nul

:: Vite dev server
start "Frontend :5173" cmd /k "cd /d %~dp0client && npm run dev"
timeout /t 3 /nobreak >nul

if "%OPCION%"=="2" (
  echo.
  echo  Iniciando tunel rapido...
  start "CF Tunnel" cmd /k "cloudflared tunnel --url http://localhost:3000"
  echo  Busca la URL https://....trycloudflare.com en la ventana del tunel
  echo  y usala como TUNNEL_URL en el servidor.
)

if "%OPCION%"=="3" (
  echo.
  echo  Iniciando tunel fijo...
  set TUNNEL_URL=https://fotoevento.topdjgroup.com
  start "CF Tunnel" cmd /k "cloudflared tunnel run fotobooth"
  timeout /t 4 /nobreak >nul
)

:: Abrir browser
start "" "http://localhost:5173"

echo.
echo  ==========================================
echo  Backend:   http://localhost:3000
echo  Frontend:  http://localhost:5173
if "%OPCION%"=="3" echo  Publico:   https://fotoevento.topdjgroup.com
echo  ==========================================
echo.
echo  Cerra las ventanas negras para detener.
echo.
pause
