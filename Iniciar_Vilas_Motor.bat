@echo off
setlocal EnableExtensions
cd /d "%~dp0"
chcp 65001 >nul
title Vilas Motor - Sistema de Gestion de Flota

echo ============================================================
echo   VILAS MOTOR - SISTEMA DE GESTION DE FLOTA Y MANTENIMIENTO
echo ============================================================
echo.

where node >nul 2>&1
if errorlevel 1 (
    echo [ERROR] No se encontro Node.js instalado en este equipo.
    echo Descarga e instala Node.js LTS desde: https://nodejs.org/
    echo.
    pause
    exit /b 1
)

where npm >nul 2>&1
if errorlevel 1 (
    echo [ERROR] No se encontro npm en el PATH del sistema.
    echo Reinstala Node.js desde: https://nodejs.org/
    echo.
    pause
    exit /b 1
)

if not exist "node_modules\.bin\tsx.cmd" (
    echo [1/2] Instalando dependencias por primera vez...
    echo       Esto puede tardar unos minutos.
    echo.
    call npm install
    if errorlevel 1 (
        echo.
        echo [ERROR] Fallo la instalacion de dependencias.
        pause
        exit /b 1
    )
    echo.
)

set "PORT=3000"

netstat -ano | findstr /R /C:":3000 .*LISTENING" >nul 2>&1
if not errorlevel 1 (
    echo El servidor ya esta ejecutandose en http://localhost:3000
    echo Abriendo el navegador...
    start "" "http://localhost:3000"
    timeout /t 3 >nul
    exit /b 0
)

echo [2/2] Iniciando servidor de Vilas Motor en http://localhost:3000 ...
echo.
echo   Credenciales demo:
echo     Admin:         admin@vilasmotor.cl / VilasAdmin2026!
echo     Planificacion: planificacion@vilasmotor.cl / VilasPlan2026!
echo     Tecnico:       tecnico@vilasmotor.cl / VilasTec2026!
echo.
echo   IMPORTANTE: Manten esta ventana abierta mientras uses el sistema.
echo   Presiona Ctrl+C o cierra esta ventana para detener el servidor.
echo ============================================================
echo.

where powershell >nul 2>&1
if not errorlevel 1 (
    start "" /b powershell -NoProfile -ExecutionPolicy Bypass -Command "for($i=0;$i -lt 40;$i++){try{$c=New-Object System.Net.Sockets.TcpClient('127.0.0.1',3000);$c.Close();Start-Process 'http://localhost:3000';exit 0}catch{Start-Sleep -Milliseconds 500}};Start-Process 'http://localhost:3000'" >nul 2>&1
) else (
    start "" /b cmd /c "timeout /t 4 /nobreak >nul & start "" http://localhost:3000"
)

call npm run dev
if errorlevel 1 (
    echo.
    echo [ERROR] El servidor se detuvo con un error.
    pause
    exit /b 1
)

endlocal
