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
echo   ============================================
echo     READY
echo   ============================================
echo.
echo   From now on, open the app with the Sniper Journal
echo   icon on your desktop. You will not need this
echo   installer again.
echo.
echo   Your journal is saved in the "data" folder, next
echo   to this file. Nothing leaves this computer.
echo.
pause

start "" "%HERE%\start.bat"
exit /b 0
