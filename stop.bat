@echo off
rem Shuts down the background Sniper Journal server.
rem Your journal is already saved - nothing is lost by stopping it.
setlocal
set "HERE=%~dp0"
if "%HERE:~-1%"=="\" set "HERE=%HERE:~0,-1%"
echo.
powershell -NoProfile -ExecutionPolicy Bypass -File "%HERE%\assets\stop.ps1"
echo.
pause
