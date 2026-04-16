@echo off
title Foto Booth - Configurar inicio automatico
color 0A

echo.
echo  ==========================================
echo   Configurar inicio automatico en Windows
echo  ==========================================
echo.
echo  Esto hace que Foto Booth arranque solo
echo  cuando se enciende la PC.
echo.
pause

:: Crear una tarea en el Programador de tareas de Windows
:: Se ejecuta al iniciar sesion, con ventana minimizada

set TASK_NAME=FotoBooth
set BAT_PATH=%~dp0INICIAR.bat

:: Eliminar tarea previa si existe
schtasks /delete /tn "%TASK_NAME%" /f >nul 2>&1

:: Crear la tarea nueva
schtasks /create ^
  /tn "%TASK_NAME%" ^
  /tr "\"%BAT_PATH%\"" ^
  /sc onlogon ^
  /delay 0000:10 ^
  /rl highest ^
  /f >nul

if %ERRORLEVEL% EQU 0 (
  color 0A
  echo.
  echo  Listo! Foto Booth arrancara automaticamente
  echo  10 segundos despues de iniciar sesion.
  echo.
  echo  Para desactivar el inicio automatico,
  echo  ejecuta QUITAR_INICIO_WINDOWS.bat
) else (
  color 0C
  echo.
  echo  Error al crear la tarea.
  echo  Intenta ejecutar este archivo como Administrador.
  echo  (Click derecho - Ejecutar como administrador)
)

echo.
pause
