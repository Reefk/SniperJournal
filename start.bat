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
  echo   Node.js is not installed. Get the LTS version from
  echo   https://nodejs.org, then run INSTALLER.bat once.
  echo.
  pause
  exit /b 1
)

if not exist "node_modules\" (
  echo   This copy has not been set up yet.
  echo   Close this window and double-click INSTALLER.bat first.
  echo.
  pause
  exit /b 1
)

if not exist ".next\BUILD_ID" (
  echo   Preparing the app...
  echo.
  call npm run build
  if errorlevel 1 (
    echo.
    echo   Build failed. Try running INSTALLER.bat again.
    echo.
    pause
    exit /b 1
  )
  echo.
)

echo   Opening at http://localhost:3000
echo   Your journal is saved in the "data" folder next to this file.
echo.
echo   Keep this window open while you use the app.
echo   Close it when you are finished.
echo.

start "" http://localhost:3000
call npm run start

pause
