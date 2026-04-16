@echo off
title Foto Booth - Quitar inicio automatico
color 0A

echo.
echo  Quitando inicio automatico de Windows...
echo.

schtasks /delete /tn "FotoBooth" /f >nul 2>&1

if %ERRORLEVEL% EQU 0 (
  echo  Listo. Foto Booth ya no arranca automaticamente.
) else (
  echo  No habia tarea configurada.
)

echo.
pause
