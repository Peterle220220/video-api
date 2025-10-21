# PowerShell script to start the video-api with proper AWS credentials
Write-Host "Starting video-api with AWS credentials..." -ForegroundColor Green

# Check if AWS credentials are available
if (-not $env:AWS_ACCESS_KEY_ID -and -not $env:AWS_SECRET_ACCESS_KEY) {
    Write-Host "⚠️  AWS credentials not found in environment variables" -ForegroundColor Yellow
    Write-Host "Please set AWS_ACCESS_KEY_ID and AWS_SECRET_ACCESS_KEY" -ForegroundColor Yellow
    Write-Host "Or ensure ~/.aws/credentials file exists" -ForegroundColor Yellow
}

# Set default region if not set
if (-not $env:AWS_REGION) {
    $env:AWS_REGION = "ap-southeast-2"
}
if (-not $env:AWS_DEFAULT_REGION) {
    $env:AWS_DEFAULT_REGION = "ap-southeast-2"
}

Write-Host "Using AWS Region: $env:AWS_REGION" -ForegroundColor Cyan

# Test AWS credentials
Write-Host "Testing AWS credentials..." -ForegroundColor Cyan
node test-aws-credentials.js

if ($LASTEXITCODE -eq 0) {
    Write-Host "✅ AWS credentials test passed" -ForegroundColor Green
    Write-Host "Starting application..." -ForegroundColor Green
    npm start
} else {
    Write-Host "❌ AWS credentials test failed" -ForegroundColor Red
    Write-Host "Please check your AWS configuration" -ForegroundColor Red
    exit 1
}
