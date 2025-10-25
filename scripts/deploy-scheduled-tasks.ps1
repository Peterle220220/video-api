# ============================================================================
# Deploy Scheduled Tasks Script
# 
# This script builds and deploys the maintenance and log cleanup tasks
# to ECR and updates ECS scheduled tasks
# ============================================================================

param(
    [string]$Region = "ap-southeast-2",
    [string]$AccountId = "901444280953"
)

$ErrorActionPreference = "Stop"

Write-Host "============================================" -ForegroundColor Cyan
Write-Host "DEPLOYING ECS SCHEDULED TASKS" -ForegroundColor Cyan
Write-Host "============================================" -ForegroundColor Cyan
Write-Host ""

# Configuration
$services = @(
    @{
        Name = "maintenance-task"
        RepoName = "n12122882-cab432-a3-maintenance-task"
        Path = "maintenance-task"
    },
    @{
        Name = "log-cleanup-task"
        RepoName = "n12122882-cab432-a3-log-cleanup-task"
        Path = "log-cleanup-task"
    }
)

# Get the script directory (project root)
$scriptDir = Split-Path -Parent $PSScriptRoot

# Step 1: Login to ECR
Write-Host "Step 1: Logging in to ECR..." -ForegroundColor Yellow
try {
    aws ecr get-login-password --region $Region | docker login --username AWS --password-stdin "$AccountId.dkr.ecr.$Region.amazonaws.com"
    Write-Host "Successfully logged in to ECR" -ForegroundColor Green
} catch {
    Write-Host "Failed to login to ECR: $_" -ForegroundColor Red
    exit 1
}

Write-Host ""

# Step 2: Build and push images
foreach ($service in $services) {
    Write-Host "============================================" -ForegroundColor Cyan
    Write-Host "Building: $($service.Name)" -ForegroundColor Cyan
    Write-Host "============================================" -ForegroundColor Cyan
    
    $imageName = "$AccountId.dkr.ecr.$Region.amazonaws.com/$($service.RepoName):latest"
    $servicePath = Join-Path $scriptDir $service.Path
    
    # Check if service directory exists
    if (-not (Test-Path $servicePath)) {
        Write-Host "Service directory not found: $servicePath" -ForegroundColor Red
        continue
    }
    
    # Build Docker image
    Write-Host "Building Docker image..." -ForegroundColor Yellow
    try {
        Set-Location $servicePath
        docker build -t $imageName .
        Write-Host "Docker image built successfully" -ForegroundColor Green
    } catch {
        Write-Host "Failed to build image: $_" -ForegroundColor Red
        Set-Location $scriptDir
        continue
    }
    
    # Push to ECR
    Write-Host "Pushing image to ECR..." -ForegroundColor Yellow
    try {
        docker push $imageName
        Write-Host "Image pushed to ECR: $imageName" -ForegroundColor Green
    } catch {
        Write-Host "Failed to push image: $_" -ForegroundColor Red
    }
    
    Set-Location $scriptDir
    Write-Host ""
}

# Step 3: Update ECS task definitions
Write-Host "============================================" -ForegroundColor Cyan
Write-Host "Updating ECS Task Definitions" -ForegroundColor Cyan
Write-Host "============================================" -ForegroundColor Cyan

$terraformPath = Join-Path $scriptDir "infrastructure"
$terraformPath = Join-Path $terraformPath "terraform"
Set-Location $terraformPath

Write-Host "Running terraform apply to update task definitions..." -ForegroundColor Yellow
try {
    terraform apply -auto-approve -target=aws_ecs_task_definition.maintenance -target=aws_ecs_task_definition.log_cleanup
    Write-Host "Task definitions updated successfully" -ForegroundColor Green
} catch {
    Write-Host "Note: You may need to run terraform apply manually" -ForegroundColor Yellow
}

Set-Location $scriptDir

Write-Host ""
Write-Host "============================================" -ForegroundColor Cyan
Write-Host "DEPLOYMENT COMPLETE" -ForegroundColor Cyan
Write-Host "============================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Next Steps:" -ForegroundColor Yellow
Write-Host "1. Verify scheduled tasks in ECS console" -ForegroundColor White
Write-Host "2. Check EventBridge rules are enabled" -ForegroundColor White
Write-Host "3. Run manual test with test-scheduled-tasks.ps1" -ForegroundColor White
Write-Host ""
