#!/bin/bash

# Set AWS region
AWS_REGION="ap-southeast-2"

echo "🚀 Creating SQS queues for Video Processing Microservices..."

# 1. Create dead-letter-queue first
echo "📦 Creating dead-letter-queue..."
aws sqs create-queue \
    --queue-name dead-letter-queue \
    --region $AWS_REGION \
    --attributes '{
        "VisibilityTimeoutSeconds": "30",
        "MessageRetentionPeriod": "1209600"
    }'

# Get dead letter queue URL
DLQ_URL=$(aws sqs get-queue-url --queue-name dead-letter-queue --region $AWS_REGION --query 'QueueUrl' --output text)
echo "✅ Dead letter queue created: $DLQ_URL"

# 2. Create storage-queue
echo "📦 Creating storage-queue..."
aws sqs create-queue \
    --queue-name storage-queue \
    --region $AWS_REGION \
    --attributes '{
        "VisibilityTimeoutSeconds": "30",
        "MessageRetentionPeriod": "1209600",
        "ReceiveMessageWaitTimeSeconds": "20",
        "RedrivePolicy": "{\"deadLetterTargetArn\":\"arn:aws:sqs:'$AWS_REGION':$(aws sts get-caller-identity --query Account --output text):dead-letter-queue\",\"maxReceiveCount\":3}"
    }'

# 3. Create transcoding-queue
echo "📦 Creating transcoding-queue..."
aws sqs create-queue \
    --queue-name transcoding-queue \
    --region $AWS_REGION \
    --attributes '{
        "VisibilityTimeoutSeconds": "300",
        "MessageRetentionPeriod": "1209600",
        "ReceiveMessageWaitTimeSeconds": "20",
        "RedrivePolicy": "{\"deadLetterTargetArn\":\"arn:aws:sqs:'$AWS_REGION':$(aws sts get-caller-identity --query Account --output text):dead-letter-queue\",\"maxReceiveCount\":3}"
    }'

# 4. Create notification-queue
echo "📦 Creating notification-queue..."
aws sqs create-queue \
    --queue-name notification-queue \
    --region $AWS_REGION \
    --attributes '{
        "VisibilityTimeoutSeconds": "30",
        "MessageRetentionPeriod": "1209600",
        "ReceiveMessageWaitTimeSeconds": "20",
        "RedrivePolicy": "{\"deadLetterTargetArn\":\"arn:aws:sqs:'$AWS_REGION':$(aws sts get-caller-identity --query Account --output text):dead-letter-queue\",\"maxReceiveCount\":3}"
    }'

echo "✅ All SQS queues created successfully!"

# Get all queue URLs
echo "📋 Queue URLs:"
echo "storage-queue: $(aws sqs get-queue-url --queue-name storage-queue --region $AWS_REGION --query 'QueueUrl' --output text)"
echo "transcoding-queue: $(aws sqs get-queue-url --queue-name transcoding-queue --region $AWS_REGION --query 'QueueUrl' --output text)"
echo "notification-queue: $(aws sqs get-queue-url --queue-name notification-queue --region $AWS_REGION --query 'QueueUrl' --output text)"
echo "dead-letter-queue: $DLQ_URL"
