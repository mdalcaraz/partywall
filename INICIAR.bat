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
where cloudflared >nul 2>&1
if %ERRORLEVEL% EQU 0 (
  echo  Iniciando tunel Cloudflare...
  start "CF Tunnel" /min cloudflared tunnel run fotobooth
  timeout /t 4 /nobreak >nul
  echo  Tunel activo.
) else (
  echo  [AVISO] cloudflared no instalado - corriendo solo en LAN
)

echo.
echo  Iniciando servidor...
echo.

:: ── Servidor en segundo plano ──────────────────────────────────────────
set TUNNEL_URL=https://fotoevento.topdjgroup.com
start "Fotobooth Server" /min cmd /c "node server.js & pause"

:: Esperar que el servidor levante
echo  Esperando servidor...
:wait_loop
timeout /t 1 /nobreak >nul
curl -s http://localhost:3000/api/photos >nul 2>&1
if %ERRORLEVEL% NEQ 0 goto wait_loop

echo  Servidor listo.
echo.

:: ── Abrir browsers ────────────────────────────────────────────────────
echo  Abriendo pantallas...

:: Admin (ventana normal)
start "" "http://localhost:3000/admin"

:: Display (ventana separada — el operario la arrastra al proyector)
start "" "http://localhost:3000/display"

echo.
echo  ==========================================
echo   TODO LISTO
echo.
echo   Admin:     http://localhost:3000/admin
echo   Proyector: http://localhost:3000/display
echo   Invitados: %TUNNEL_URL%/guest
echo.
echo   Arrastra la ventana del proyector
echo   a la pantalla del proyector y
echo   presiona F11 para pantalla completa.
echo  ==========================================
echo.
echo  Esta ventana se puede minimizar.
echo  Para detener todo, cierra esta ventana.
echo.

:: Mantener viva esta ventana (si se cierra, el operario sabe que algo fallo)
:keepalive
timeout /t 30 /nobreak >nul
curl -s http://localhost:3000/api/photos >nul 2>&1
if %ERRORLEVEL% NEQ 0 (
  color 0C
  echo.
  echo  [!] El servidor se cayo. Reiniciando...
  color 0A
  start "Fotobooth Server" /min cmd /c "node server.js & pause"
  timeout /t 3 /nobreak >nul
)
goto keepalive
