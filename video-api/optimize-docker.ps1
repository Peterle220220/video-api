# Script to optimize Docker for low-resource EC2 instances on Windows

Write-Host "🚀 Optimizing Docker for low-resource EC2..." -ForegroundColor Green

# Stop all containers first
Write-Host "📦 Stopping existing containers..." -ForegroundColor Yellow
docker-compose down

# Clean up Docker system to free memory
Write-Host "🧹 Cleaning up Docker system..." -ForegroundColor Yellow
docker system prune -f
docker volume prune -f

# Build with reduced parallelism
Write-Host "🔨 Building with optimized settings..." -ForegroundColor Yellow
$env:DOCKER_BUILDKIT = "1"
$env:COMPOSE_DOCKER_CLI_BUILD = "1"

# Build with limited resources
docker-compose build --parallel 1

Write-Host "✅ Optimization complete!" -ForegroundColor Green
Write-Host ""
Write-Host "📋 Optimized settings applied:" -ForegroundColor Cyan
Write-Host "  - API: 1 CPU, 1GB RAM limit"
Write-Host "  - Transcoder: 1.5 CPU, 2GB RAM limit"  
Write-Host "  - Transcribe: 0.5 CPU, 512MB RAM limit"
Write-Host "  - DLQ Handler: 0.25 CPU, 256MB RAM limit"
Write-Host "  - FFmpeg: ultrafast preset, 1 thread, CRF 28"
Write-Host "  - Load testing: Reduced to 2 VUs"
Write-Host ""
Write-Host "🚀 Starting optimized containers..." -ForegroundColor Green
docker-compose up -d

Write-Host "📊 Monitor resource usage with:" -ForegroundColor Cyan
Write-Host "  docker stats"
