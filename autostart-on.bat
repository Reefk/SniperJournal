@echo off
rem Makes Sniper Journal start quietly whenever you sign in to Windows.
setlocal
set "HERE=%~dp0"
if "%HERE:~-1%"=="\" set "HERE=%HERE:~0,-1%"
echo.
powershell -NoProfile -ExecutionPolicy Bypass -File "%HERE%\assets\autostart.ps1" -Root "%HERE%"
echo.
pause
