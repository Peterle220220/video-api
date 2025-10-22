@echo off
echo ========================================
echo Fixing Transcoding Service Authentication
echo ========================================

echo.
echo 1. Stopping existing transcoding container...
docker stop transcoding 2>nul
docker rm transcoding 2>nul

echo.
echo 2. Building transcoding service with shared middleware...
docker-compose build transcoding

echo.
echo 3. Starting transcoding service...
docker-compose up -d transcoding

echo.
echo 4. Waiting for service to start...
timeout /t 10 /nobreak >nul

echo.
echo 5. Testing health endpoint...
curl -s http://localhost:3002/health

echo.
echo 6. Testing transcoding library endpoint (should require auth)...
curl -s http://localhost:3002/api/transcoding/library?page=1&limit=10

echo.
echo ========================================
echo Transcoding service should now use shared authentication
echo Test with valid token from auth service
echo ========================================
