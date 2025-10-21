#!/bin/bash

# Script to optimize Docker for low-resource EC2 instances

echo "🚀 Optimizing Docker for low-resource EC2..."

# Stop all containers first
echo "📦 Stopping existing containers..."
docker-compose down

# Clean up Docker system to free memory
echo "🧹 Cleaning up Docker system..."
docker system prune -f
docker volume prune -f

# Build with reduced parallelism
echo "🔨 Building with optimized settings..."
export DOCKER_BUILDKIT=1
export COMPOSE_DOCKER_CLI_BUILD=1

# Build with limited resources
docker-compose build --parallel 1 --memory 2g

echo "✅ Optimization complete!"
echo ""
echo "📋 Optimized settings applied:"
echo "  - API: 1 CPU, 1GB RAM limit"
echo "  - Transcoder: 1.5 CPU, 2GB RAM limit"  
echo "  - Transcribe: 0.5 CPU, 512MB RAM limit"
echo "  - DLQ Handler: 0.25 CPU, 256MB RAM limit"
echo "  - FFmpeg: ultrafast preset, 1 thread, CRF 28"
echo "  - Load testing: Reduced to 2 VUs"
echo ""
echo "🚀 Starting optimized containers..."
docker-compose up -d

echo "📊 Monitor resource usage with:"
echo "  docker stats"
