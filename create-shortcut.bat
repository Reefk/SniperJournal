@echo off
rem Puts a "Sniper Journal" shortcut on the desktop, pointing at this folder.
rem Run it any time: after moving the folder, or if you deleted the shortcut.
setlocal

set "HERE=%~dp0"
if "%HERE:~-1%"=="\" set "HERE=%HERE:~0,-1%"

echo.
powershell -NoProfile -ExecutionPolicy Bypass -File "%HERE%\assets\make-shortcut.ps1" -Root "%HERE%"

if errorlevel 1 (
  echo.
  echo   You can also make one by hand:
  echo   right-click start.bat, then "Send to", then "Desktop (create shortcut)".
)

echo.
pause
