@echo off
title Sniper Journal - Installer
cd /d "%~dp0"

set "HERE=%~dp0"
if "%HERE:~-1%"=="\" set "HERE=%HERE:~0,-1%"

echo.
echo   ============================================
echo     SNIPER JOURNAL - INSTALLER
echo   ============================================
echo.
echo   This sets everything up once. It takes a few minutes.
echo.

rem ------------------------------------------------------------------
rem  Windows marks every file that came from the internet. Clearing the
rem  mark here means this is the last security warning you ever see for
rem  this app: the launcher and the desktop icon will open straight away.
rem ------------------------------------------------------------------
echo   Clearing the "downloaded from the internet" mark...
powershell -NoProfile -ExecutionPolicy Bypass -File "%HERE%\assets\unblock.ps1" -Root "%HERE%"
echo.

where node >nul 2>nul
if errorlevel 1 (
  echo   ------------------------------------------------------------
  echo   Node.js is not installed, and the app needs it to run.
  echo.
  echo   1. Go to https://nodejs.org
  echo   2. Download the LTS version and install it with the defaults
  echo   3. Run this installer again
  echo   ------------------------------------------------------------
  echo.
  pause
  exit /b 1
)

echo   Installing components...
echo.
call npm install
if errorlevel 1 (
  echo.
  echo   Install failed. Check your internet connection and run this again.
  echo.
  pause
  exit /b 1
)

echo.
echo   Preparing the app...
echo.
call npm run build
if errorlevel 1 (
  echo.
  echo   Build failed. Nothing was damaged - run this installer again.
  echo.
  pause
  exit /b 1
)

echo.
echo   Adding a shortcut to your desktop...
powershell -NoProfile -ExecutionPolicy Bypass -File "%HERE%\assets\make-shortcut.ps1" -Root "%HERE%"
if errorlevel 1 echo   You can add one later by running create-shortcut.bat.

echo.
echo   Setting it to start with Windows...
powershell -NoProfile -ExecutionPolicy Bypass -File "%HERE%\assets\autostart.ps1" -Root "%HERE%"
if errorlevel 1 echo   You can turn this on later with autostart-on.bat.

echo.
echo   Starting it now...
start "" wscript.exe "%HERE%\assets\open-app.vbs"

echo.
echo   ============================================
echo     READY
echo   ============================================
echo.
echo   Sniper Journal now runs quietly in the background and
echo   starts with Windows. There is no black window to keep
echo   open, and nothing to close.
echo.
echo   ONE LAST STEP, worth doing once:
echo.
echo     In the Chrome window that just opened, click the
echo     three dots at the top right, choose Cast save and
echo     share, then Install page as app.
echo.
echo   That gives Sniper Journal its own window with no
echo   address bar, and its own icon in the Start menu.
echo.
echo   Your journal is saved in the "data" folder next to
echo   this file. Nothing leaves this computer.
echo.
echo   Other things in this folder, if you ever need them:
echo     stop.bat            shut the app down
echo     autostart-off.bat   stop it starting with Windows
echo     create-shortcut.bat put the desktop icon back
echo.
pause
exit /b 0
