#!/bin/bash

# Script to start the video-api with proper AWS credentials
echo "Starting video-api with AWS credentials..."

# Check if AWS credentials are available
if [ -z "$AWS_ACCESS_KEY_ID" ] && [ -z "$AWS_SECRET_ACCESS_KEY" ]; then
    echo "⚠️  AWS credentials not found in environment variables"
    echo "Please set AWS_ACCESS_KEY_ID and AWS_SECRET_ACCESS_KEY"
    echo "Or ensure ~/.aws/credentials file exists"
fi

# Set default region if not set
export AWS_REGION=${AWS_REGION:-ap-southeast-2}
export AWS_DEFAULT_REGION=${AWS_DEFAULT_REGION:-ap-southeast-2}

echo "Using AWS Region: $AWS_REGION"

# Test AWS credentials
echo "Testing AWS credentials..."
node test-aws-credentials.js

if [ $? -eq 0 ]; then
    echo "✅ AWS credentials test passed"
    echo "Starting application..."
    npm start
else
    echo "❌ AWS credentials test failed"
    echo "Please check your AWS configuration"
    exit 1
fi
