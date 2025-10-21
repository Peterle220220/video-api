@echo off
echo 🐳 Building Video API Microservices with Docker Compose
echo ======================================================

REM Set environment variables
set AWS_REGION=ap-southeast-2
set AWS_ACCESS_KEY_ID=ASIA5DYSEEJ4QHYJLKMQ
set AWS_SECRET_ACCESS_KEY=zyq30lRvNmB7egwzjrM7WtgTfxTPj+THOpTssLdL
set COGNITO_USER_POOL_ID=ap-southeast-2_wgTgFFTuB
set COGNITO_CLIENT_ID=1o00oog3qb82t1qgvi62lfv9fa
set S3_BUCKET_NAME=cab432-a2-n12122882
set DYNAMODB_TABLE_NAME=cab432-a2-n12122882-metadata
set ASSEMBLY_AI_API_KEY=420c9f6d29f742e587313b9764794f45
set AAI_API_BASE=https://api.assemblyai.com/v2
set SQS_TRANSCODING_QUEUE_URL=https://sqs.ap-southeast-2.amazonaws.com/901444280953/transcoding-queue
set SQS_UPLOAD_QUEUE_URL=https://sqs.ap-southeast-2.amazonaws.com/901444280953/upload-queue
set SQS_STORAGE_QUEUE_URL=https://sqs.ap-southeast-2.amazonaws.com/901444280953/storage-queue
set SQS_NOTIFICATIONS_QUEUE_URL=https://sqs.ap-southeast-2.amazonaws.com/901444280953/notifications-queue

echo 📋 Environment variables set

REM Stop any existing containers
echo 🛑 Stopping existing containers...
docker-compose down

REM Build and start services
echo 🔨 Building and starting services...
docker-compose up --build -d

REM Wait for services to start
echo ⏳ Waiting for services to start...
timeout /t 10 /nobreak > nul

REM Show status
echo 📊 Service Status:
docker-compose ps

echo.
echo 🌐 Access URLs:
echo ==============
echo 🔗 Web Application: http://localhost:3000
echo 🔗 Nginx Load Balancer: http://localhost:80
echo 🔗 Auth Service: http://localhost:3001
echo 🔗 Transcoding Service: http://localhost:3002
echo 🔗 Upload Service: http://localhost:3003
echo.
echo 📋 Useful Commands:
echo ==================
echo • View logs: docker-compose logs -f
echo • Stop services: docker-compose down
echo • Restart: docker-compose restart
echo • Scale services: docker-compose up --scale transcoding=3
echo.
echo 🎉 Build complete! Services are running.
pause
