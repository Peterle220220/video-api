#!/usr/bin/env pwsh
# Script to rebuild and deploy sqs-worker service
# Usage: .\rebuild-sqs-worker.ps1

param(
    [string]$Region = "ap-southeast-2",
    [string]$AccountId = "901444280953",
    [string]$ServiceName = "n12122882-cab432-a3-sqs-worker-service",
    [string]$ClusterName = "n12122882-a3-cluster"
)

$ErrorActionPreference = "Stop"

Write-Host "==================================" -ForegroundColor Cyan
Write-Host "Rebuild & Deploy SQS Worker" -ForegroundColor Cyan
Write-Host "==================================" -ForegroundColor Cyan
Write-Host ""

$ECRRepo = "$AccountId.dkr.ecr.$Region.amazonaws.com/n12122882-cab432-a3-sqs-worker"
$ImageTag = "latest"
$FullImageUri = "${ECRRepo}:${ImageTag}"

# Step 1: Login to ECR
Write-Host "[1/5] Logging in to ECR..." -ForegroundColor Yellow
try {
    aws ecr get-login-password --region $Region | docker login --username AWS --password-stdin "$AccountId.dkr.ecr.$Region.amazonaws.com"
    Write-Host "✅ Successfully logged in to ECR" -ForegroundColor Green
} catch {
    Write-Host "❌ Failed to login to ECR: $_" -ForegroundColor Red
    exit 1
}

Write-Host ""

# Step 2: Build Docker image
Write-Host "[2/5] Building Docker image..." -ForegroundColor Yellow
Write-Host "Working directory: $(Get-Location)" -ForegroundColor Gray

try {
    # Change to sqs-worker directory
    Push-Location -Path "$PSScriptRoot\..\sqs-worker"
    
    docker build -t n12122882-cab432-a3-sqs-worker:$ImageTag .
    
    if ($LASTEXITCODE -ne 0) {
        throw "Docker build failed"
    }
    
    Write-Host "✅ Successfully built Docker image" -ForegroundColor Green
    
    Pop-Location
} catch {
    Write-Host "❌ Failed to build Docker image: $_" -ForegroundColor Red
    Pop-Location
    exit 1
}

Write-Host ""

# Step 3: Tag image
Write-Host "[3/5] Tagging image..." -ForegroundColor Yellow
try {
    docker tag n12122882-cab432-a3-sqs-worker:$ImageTag $FullImageUri
    Write-Host "✅ Successfully tagged image as $FullImageUri" -ForegroundColor Green
} catch {
    Write-Host "❌ Failed to tag image: $_" -ForegroundColor Red
    exit 1
}

Write-Host ""

# Step 4: Push to ECR
Write-Host "[4/5] Pushing image to ECR..." -ForegroundColor Yellow
try {
    docker push $FullImageUri
    
    if ($LASTEXITCODE -ne 0) {
        throw "Docker push failed"
    }
    
    Write-Host "✅ Successfully pushed image to ECR" -ForegroundColor Green
} catch {
    Write-Host "❌ Failed to push image: $_" -ForegroundColor Red
    exit 1
}

Write-Host ""

# Step 5: Update ECS service
Write-Host "[5/5] Updating ECS service..." -ForegroundColor Yellow
try {
    # Force new deployment to pick up the new image
    aws ecs update-service `
        --cluster $ClusterName `
        --service $ServiceName `
        --force-new-deployment `
        --region $Region `
        --output json | Out-Null
    
    Write-Host "✅ Successfully triggered service update" -ForegroundColor Green
    Write-Host ""
    Write-Host "⏳ Waiting for service to stabilize..." -ForegroundColor Yellow
    
    # Wait for service to become stable
    aws ecs wait services-stable `
        --cluster $ClusterName `
        --services $ServiceName `
        --region $Region
    
    Write-Host "✅ Service is now stable!" -ForegroundColor Green
    
} catch {
    Write-Host "⚠️  Service update triggered but failed to wait for stability: $_" -ForegroundColor Yellow
    Write-Host "Please check the ECS console to verify deployment status" -ForegroundColor Yellow
}

Write-Host ""
Write-Host "==================================" -ForegroundColor Cyan
Write-Host "Deployment Complete!" -ForegroundColor Cyan
Write-Host "==================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Next steps:" -ForegroundColor Yellow
Write-Host "1. Check service status: aws ecs describe-services --cluster $ClusterName --services $ServiceName --region $Region" -ForegroundColor White
Write-Host "2. View logs: Go to CloudWatch Logs > /ecs/n12122882-cab432-a3-sqs-worker" -ForegroundColor White
Write-Host ""

