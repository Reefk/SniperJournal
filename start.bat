@echo off
rem The visible launcher. You normally will not need this: the app runs in the
rem background and starts with Windows. Use it when you want to watch what the
rem server is doing, or to run the app without the background service.
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

rem If the background copy is already serving, just open it.
powershell -NoProfile -Command "try { Invoke-WebRequest -UseBasicParsing -Uri 'http://127.0.0.1:3000' -TimeoutSec 3 | Out-Null; exit 0 } catch { exit 1 }" >nul 2>nul
if not errorlevel 1 (
  echo   Sniper Journal is already running in the background.
  echo   Opening it...
  start "" http://localhost:3000
  echo.
  echo   To watch the server instead, run stop.bat first, then this again.
  echo.
  pause
  exit /b 0
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
echo   Keep this window open while you use the app.
echo.

start "" http://localhost:3000
call npm run start

pause
