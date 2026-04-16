@echo off
title Foto Booth LAN - Setup
color 0A

echo.
echo  ==========================================
echo   FOTO BOOTH LAN - Instalacion
echo  ==========================================
echo.

:: Verificar Node.js
where node >nul 2>&1
if %ERRORLEVEL% NEQ 0 (
  echo  [ERROR] Node.js no esta instalado.
  echo  Descargalo en: https://nodejs.org
  echo.
  pause
  exit /b 1
)

for /f "tokens=*" %%v in ('node -v') do set NODE_VERSION=%%v
echo  Node.js encontrado: %NODE_VERSION%
echo.

echo  [1/3] Instalando dependencias del servidor...
npm install
if %ERRORLEVEL% NEQ 0 (
  echo  [ERROR] Fallo npm install (servidor)
  pause
  exit /b 1
)

echo.
echo  [2/3] Instalando dependencias del cliente React...
cd client
npm install
if %ERRORLEVEL% NEQ 0 (
  echo  [ERROR] Fallo npm install (cliente)
  pause
  exit /b 1
)

echo.
echo  [3/3] Compilando React...
npm run build
if %ERRORLEVEL% NEQ 0 (
  echo  [ERROR] Fallo el build de React
  pause
  exit /b 1
)
cd ..

echo.
echo  ==========================================
echo   Instalacion completa!
echo   Ejecuta INICIAR.bat para arrancar.
echo  ==========================================
echo.
pause
