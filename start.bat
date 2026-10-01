@echo off
title Sniper Journal
cd /d "%~dp0"

echo.
echo   ============================================
echo     SNIPER JOURNAL
echo   ============================================
echo.

where node >nul 2>nul
if errorlevel 1 (
  echo   Node.js is not installed.
  echo.
  echo   Install the LTS version from https://nodejs.org
  echo   then double-click this file again.
  echo.
  pause
  exit /b 1
)

if not exist "node_modules\" (
  echo   First run: installing components. This takes a few minutes.
  echo.
  call npm install
  if errorlevel 1 (
    echo.
    echo   Install failed. Check your internet connection and try again.
    pause
    exit /b 1
  )
  echo.
)

if not exist ".next\BUILD_ID" (
  echo   Preparing the app...
  echo.
  call npm run build
  if errorlevel 1 (
    echo.
    echo   Build failed.
    pause
    exit /b 1
  )
  echo.
)

echo   Starting at http://localhost:3000
echo   Your journal is saved in the "data" folder next to this file.
echo.
echo   Keep this window open while you use the app.
echo   Close it when you are finished.
echo.

start "" http://localhost:3000
call npm run start

pause
