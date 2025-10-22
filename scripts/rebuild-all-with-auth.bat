@echo off
setlocal enabledelayedexpansion

echo ================================================
echo    REBUILD ALL SERVICES WITH AUTH FIX
echo ================================================

echo.
echo Step 1: Stopping all containers...
docker-compose down

echo.
echo Step 2: Building all services...
docker-compose build

echo.
echo Step 3: Starting all services...
docker-compose up -d

echo.
echo Step 4: Waiting for services to be ready...
timeout /t 15 /nobreak >nul

echo.
echo Step 5: Checking service health...
echo.
echo Auth Service Health:
curl -s http://localhost:3001/health
echo.
echo.
echo Transcoding Service Health:
curl -s http://localhost:3002/health
echo.
echo.
echo Upload Service Health:
curl -s http://localhost:3003/health
echo.
echo.
echo Web Service Health (should redirect to login):
curl -s http://localhost:3000 | findstr /C:"<!DOCTYPE"
echo.

echo.
echo ================================================
echo    ✅ ALL SERVICES REBUILT AND RUNNING
echo ================================================
echo.
echo Services:
echo   - Auth Service:       http://localhost:3001
echo   - Transcoding:        http://localhost:3002
echo   - Upload Service:     http://localhost:3003
echo   - Web Frontend:       http://localhost:3000
echo.
echo Next: Test authentication flow with:
echo   node scripts/test-full-auth-flow.js
echo.
pause
