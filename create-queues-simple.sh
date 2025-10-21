#!/bin/bash

# Simple SQS queue creation script
AWS_REGION="ap-southeast-2"

echo "🚀 Creating SQS queues..."

# Create dead letter queue first
echo "📦 Creating dead-letter-queue..."
aws sqs create-queue \
    --queue-name dead-letter-queue \
    --region $AWS_REGION

# Create storage queue
echo "📦 Creating storage-queue..."
aws sqs create-queue \
    --queue-name storage-queue \
    --region $AWS_REGION

# Create transcoding queue
echo "📦 Creating transcoding-queue..."
aws sqs create-queue \
    --queue-name transcoding-queue \
    --region $AWS_REGION

# Create notification queue
echo "📦 Creating notification-queue..."
aws sqs create-queue \
    --queue-name notification-queue \
    --region $AWS_REGION

echo "✅ All queues created!"

# Get queue URLs
echo "📋 Queue URLs:"
aws sqs list-queues --region $AWS_REGION
