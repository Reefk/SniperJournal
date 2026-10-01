@echo off
rem Stops Sniper Journal from starting with Windows. The app itself stays
rem installed - open it with the desktop icon whenever you want it.
setlocal
set "HERE=%~dp0"
if "%HERE:~-1%"=="\" set "HERE=%HERE:~0,-1%"
echo.
powershell -NoProfile -ExecutionPolicy Bypass -File "%HERE%\assets\autostart.ps1" -Root "%HERE%" -Disable
echo.
pause
