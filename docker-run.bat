@echo off
setlocal EnableDelayedExpansion
title FireHarmony - Docker
cd /d "%~dp0"

echo ============================================
echo   FireHarmony - Docker build and run
echo ============================================
echo.

where docker >nul 2>&1
if errorlevel 1 (
  echo [ERROR] Docker is not installed or not running.
  echo         Install Docker Desktop: https://www.docker.com/products/docker-desktop/
  echo         Make sure it is started, then double-click this file again.
  echo.
  pause
  exit /b 1
)
echo [OK] Docker found

REM --- reuse the key from server\.env if it exists, otherwise ask
set "FIRMSKEY="
if exist "server\.env" (
  for /f "tokens=1,* delims==" %%a in ('findstr /b "FIRMS_MAP_KEY=" "server\.env"') do set "FIRMSKEY=%%b"
)
if not defined FIRMSKEY (
  echo.
  echo Live satellite data needs a free NASA FIRMS key:
  echo https://firms.modaps.eosdis.nasa.gov/api/map_key/
  echo ^(Leave empty for demo mode with synthetic data.^)
  set /p FIRMSKEY="Paste your FIRMS key and press Enter: "
)

echo.
echo [...] Building image fireharmony:latest ...
docker build -t fireharmony:latest .
if errorlevel 1 (
  echo [ERROR] docker build failed.
  pause
  exit /b 1
)

REM --- replace a previous container with the same name
docker rm -f fireharmony >nul 2>&1

echo [...] Starting container on http://localhost:3000 ...
docker run -d --name fireharmony -p 3000:3000 -e FIRMS_MAP_KEY=%FIRMSKEY% fireharmony:latest
if errorlevel 1 (
  echo [ERROR] docker run failed.
  pause
  exit /b 1
)

start "FireHarmony opener" /min cmd /c "timeout /t 3 /nobreak >nul & start """" http://localhost:3000 & exit"

echo.
echo --------------------------------------------
echo   FireHarmony is running in Docker:
echo   App:  http://localhost:3000
echo   Map:  http://localhost:3000/map.html
echo   Stop: docker stop fireharmony
echo --------------------------------------------
pause
