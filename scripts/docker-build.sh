#!/bin/bash

echo "🐳 Building Video API Microservices with Docker Compose"
echo "======================================================"

# Set environment variables
export AWS_REGION=ap-southeast-2
export AWS_ACCESS_KEY_ID=ASIA5DYSEEJ4QHYJLKMQ
export AWS_SECRET_ACCESS_KEY=zyq30lRvNmB7egwzjrM7WtgTfxTPj+THOpTssLdL
export COGNITO_USER_POOL_ID=ap-southeast-2_wgTgFFTuB
export COGNITO_CLIENT_ID=1o00oog3qb82t1qgvi62lfv9fa
export S3_BUCKET_NAME=cab432-a2-n12122882
export DYNAMODB_TABLE_NAME=cab432-a2-n12122882-metadata
export ASSEMBLY_AI_API_KEY=420c9f6d29f742e587313b9764794f45
export AAI_API_BASE=https://api.assemblyai.com/v2
export SQS_TRANSCODING_QUEUE_URL=https://sqs.ap-southeast-2.amazonaws.com/901444280953/transcoding-queue
export SQS_UPLOAD_QUEUE_URL=https://sqs.ap-southeast-2.amazonaws.com/901444280953/upload-queue
export SQS_STORAGE_QUEUE_URL=https://sqs.ap-southeast-2.amazonaws.com/901444280953/storage-queue
export SQS_NOTIFICATIONS_QUEUE_URL=https://sqs.ap-southeast-2.amazonaws.com/901444280953/notifications-queue

echo "📋 Environment variables set"

# Stop any existing containers
echo "🛑 Stopping existing containers..."
docker-compose down

# Remove old images to force rebuild
echo "🗑️ Removing old images..."
docker-compose down --rmi all

# Build and start services
echo "🔨 Building and starting services..."
docker-compose up --build -d

# Wait for services to start
echo "⏳ Waiting for services to start..."
sleep 10

# Show status
echo "📊 Service Status:"
docker-compose ps

echo ""
echo "🌐 Access URLs:"
echo "=============="
echo "🔗 Web Application: http://localhost:3000"
echo "🔗 Nginx Load Balancer: http://localhost:80"
echo "🔗 Auth Service: http://localhost:3001"
echo "🔗 Transcoding Service: http://localhost:3002"
echo "🔗 Upload Service: http://localhost:3003"
echo ""
echo "📋 Useful Commands:"
echo "=================="
echo "• View logs: docker-compose logs -f"
echo "• Stop services: docker-compose down"
echo "• Restart: docker-compose restart"
echo "• Scale services: docker-compose up --scale transcoding=3"
echo ""
echo "🎉 Build complete! Services are running."
