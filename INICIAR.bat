@echo off
title Foto Booth
color 0A
cls

echo.
echo  ==========================================
echo   FOTO BOOTH - Iniciando...
echo  ==========================================
echo.

:: Verificar que node existe
where node >nul 2>&1
if %ERRORLEVEL% NEQ 0 (
  color 0C
  echo  [ERROR] Node.js no encontrado.
  echo  Ejecuta INSTALAR.bat primero.
  pause & exit /b 1
)

:: Verificar que el build de React existe
if not exist "public\index.html" (
  color 0C
  echo  [ERROR] No se encontro el build de React.
  echo  Ejecuta INSTALAR.bat primero.
  pause & exit /b 1
)

:: ── Tunnel Cloudflare ──────────────────────────────────────────────────
if exist "cloudflared.exe" (
  echo  Iniciando tunel Cloudflare...
  start "CF Tunnel" /min cloudflared.exe tunnel --config CLOUDFLARE_CONFIG.yml run
  timeout /t 5 /nobreak >nul
  echo  Tunel activo - fotobooth.topdjgroup.com
) else (
  echo  [AVISO] cloudflared.exe no encontrado - corriendo solo en LAN
)

echo.
echo  Iniciando servidor...
echo.

:: ── Servidor ──────────────────────────────────────────────────────────
start "Fotobooth Server" /min cmd /c "node server.js & pause"

:: Esperar que el servidor levante
echo  Esperando servidor...
:wait_loop
timeout /t 1 /nobreak >nul
curl -s http://localhost:3000/fotobooth/api/qr >nul 2>&1
if %ERRORLEVEL% NEQ 0 goto wait_loop

echo  Servidor listo.
echo.

:: ── Abrir browsers ────────────────────────────────────────────────────
echo  Abriendo pantallas...
start "" "http://localhost:3000/fotobooth/admin"
start "" "http://localhost:3000/fotobooth/display"

echo.
echo  ==========================================
echo   TODO LISTO
echo.
echo   Admin:     http://localhost:3000/fotobooth/admin
echo   Proyector: http://localhost:3000/fotobooth/display
echo   Invitados: https://fotobooth.topdjgroup.com/fotobooth/guest
echo.
echo   Arrastra la ventana del proyector
echo   a la pantalla del proyector y
echo   presiona F11 para pantalla completa.
echo  ==========================================
echo.
echo  Esta ventana se puede minimizar.
echo  Para detener todo, cierra esta ventana.
echo.

:: ── Watchdog ──────────────────────────────────────────────────────────
:keepalive
timeout /t 30 /nobreak >nul
curl -s http://localhost:3000/fotobooth/api/qr >nul 2>&1
if %ERRORLEVEL% NEQ 0 (
  color 0C
  echo.
  echo  [!] El servidor se cayo. Reiniciando...
  color 0A
  start "Fotobooth Server" /min cmd /c "node server.js & pause"
  timeout /t 3 /nobreak >nul
)
goto keepalive
