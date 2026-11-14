@echo off
setlocal EnableDelayedExpansion
title FireHarmony
cd /d "%~dp0"

echo ============================================
echo   FireHarmony - local start (Windows)
echo ============================================
echo.

REM --- 1) Node.js must be installed
where node >nul 2>&1
if errorlevel 1 (
  echo [ERROR] Node.js is not installed.
  echo         Download it from https://nodejs.org ^(LTS version^), install,
  echo         then double-click this file again.
  echo.
  pause
  exit /b 1
)
for /f "delims=" %%v in ('node --version') do echo [OK] Node.js %%v

REM --- 2) Install server dependencies (first run only)
if not exist "server\node_modules" (
  echo [...] Installing dependencies, first run takes a minute...
  pushd server
  call npm install --no-fund --no-audit
  if errorlevel 1 (
    popd
    echo [ERROR] npm install failed. Check your internet connection.
    pause
    exit /b 1
  )
  popd
  echo [OK] Dependencies installed
) else (
  echo [OK] Dependencies already installed
)

REM --- 3) API key for live NASA FIRMS data
if not exist "server\.env" (
  echo.
  echo Live satellite data needs a free NASA FIRMS key.
  echo Get one here: https://firms.modaps.eosdis.nasa.gov/api/map_key/
  echo ^(Leave empty to run in demo mode with synthetic data.^)
  echo.
  set /p FIRMSKEY="Paste your FIRMS key and press Enter: "
  (
    echo FIRMS_MAP_KEY=!FIRMSKEY!
    echo PORT=3000
  ) > "server\.env"
  if "!FIRMSKEY!"=="" (
    echo [OK] Demo mode: no key saved, the app will show synthetic data
  ) else (
    echo [OK] Key saved to server\.env
  )
) else (
  echo [OK] server\.env found
)

REM --- 4) Open the browser once the server is up
start "FireHarmony opener" /min cmd /c "timeout /t 3 /nobreak >nul & start """" http://localhost:3000 & exit"

echo.
echo --------------------------------------------
echo   FireHarmony is starting...
echo   App:  http://localhost:3000
echo   Map:  http://localhost:3000/map.html
echo   Stop: close this window or press Ctrl+C
echo --------------------------------------------
echo.

node server\index.js

echo.
echo Server stopped.
pause
