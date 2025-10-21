#!/usr/bin/env pwsh

Write-Host "🐳 Building Video API Microservices with Docker Compose" -ForegroundColor Cyan
Write-Host "======================================================" -ForegroundColor Cyan

# Set environment variables
$env:AWS_REGION = "ap-southeast-2"
$env:AWS_ACCESS_KEY_ID = "ASIA5DYSEEJ4QHYJLKMQ"
$env:AWS_SECRET_ACCESS_KEY = "zyq30lRvNmB7egwzjrM7WtgTfxTPj+THOpTssLdL"
$env:COGNITO_USER_POOL_ID = "ap-southeast-2_wgTgFFTuB"
$env:COGNITO_CLIENT_ID = "1o00oog3qb82t1qgvi62lfv9fa"
$env:S3_BUCKET_NAME = "cab432-a2-n12122882"
$env:DYNAMODB_TABLE_NAME = "cab432-a2-n12122882-metadata"
$env:ASSEMBLY_AI_API_KEY = "420c9f6d29f742e587313b9764794f45"
$env:AAI_API_BASE = "https://api.assemblyai.com/v2"
$env:SQS_TRANSCODING_QUEUE_URL = "https://sqs.ap-southeast-2.amazonaws.com/901444280953/transcoding-queue"
$env:SQS_UPLOAD_QUEUE_URL = "https://sqs.ap-southeast-2.amazonaws.com/901444280953/upload-queue"
$env:SQS_STORAGE_QUEUE_URL = "https://sqs.ap-southeast-2.amazonaws.com/ORDERS/901444280953/storage-queue"
$env:SQS_NOTIFICATIONS_QUEUE_URL = "https://sqs.ap-southeast-2.amazonaws.com/901444280953/notifications-queue"

Write-Host "📋 Environment variables set" -ForegroundColor Green

# Stop any existing containers
Write-Host "🛑 Stopping existing containers..." -ForegroundColor Yellow
docker-compose down

# Remove old images to force rebuild
Write-Host "🗑️ Removing old images..." -ForegroundColor Yellow
docker-compose down --rmi all

# Build and start services
Write-Host "🔨 Building and starting services..." -ForegroundColor Yellow
docker-compose up --build -d

# Wait for services to start
Write-Host "⏳ Waiting for services to start..." -ForegroundColor Yellow
Start-Sleep -Seconds 10

# Show status
Write-Host "📊 Service Status:" -ForegroundColor Green
docker-compose ps

Write-Host ""
Write-Host "🌐 Access URLs:" -ForegroundColor Cyan
Write-Host "==============" -ForegroundColor Cyan
Write-Host "🔗 Web Application: http://localhost:3000" -ForegroundColor White
Write-Host "🔗 Nginx Load Balancer: http://localhost:80" -ForegroundColor White
Write-Host "🔗 Auth Service: http://localhost:3001" -ForegroundColor White
Write-Host "🔗 Transcoding Service: http://localhost:3002" -ForegroundColor White
Write-Host "🔗 Upload Service: http://localhost:3003" -ForegroundColor White
Write-Host ""
Write-Host "📋 Useful Commands:" -ForegroundColor Cyan
Write-Host "==================" -ForegroundColor Cyan
Write-Host "• View logs: docker-compose logs -f" -ForegroundColor White
Write-Host "• Stop services: docker-compose down" -ForegroundColor White
Write-Host "• Restart: docker-compose restart" -ForegroundColor White
Write-Host "• Scale services: docker-compose up --scale transcoding=3" -ForegroundColor White
Write-Host ""
Write-Host "🎉 Build complete! Services are running." -ForegroundColor Green
