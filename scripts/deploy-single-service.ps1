# ==================================================================================
# DEPLOY SINGLE SERVICE TO ECS
# ==================================================================================
# Script deploy một service cụ thể lên ECS
# Sử dụng: .\deploy-single-service.ps1 -ServiceName auth
# ==================================================================================

param(
    [Parameter(Mandatory=$true)]
    [ValidateSet("web", "auth", "transcoding", "upload", "sqs-worker")]
    [string]$ServiceName,
    
    [switch]$SkipBuild = $false,
    [switch]$SkipPush = $false,
    [switch]$OnlyDeploy = $false
)

$ErrorActionPreference = "Stop"

# Configuration
$AWS_REGION = "ap-southeast-2"
$AWS_ACCOUNT_ID = "901444280953"
$CLUSTER_NAME = "n12122882-a3-cluster"
$ECR_REGISTRY = "$AWS_ACCOUNT_ID.dkr.ecr.$AWS_REGION.amazonaws.com"

# Service configurations
$SERVICE_CONFIG = @{
    "web" = @{
        Name = "web"
        DockerContext = "web"
        Dockerfile = "web/Dockerfile"
        EcrRepo = "n12122882-cab432-a3-web"
        EcsService = "n12122882-cab432-a3-web-service"
    }
    "auth" = @{
        Name = "auth-service"
        DockerContext = "auth-service"
        Dockerfile = "auth-service/Dockerfile"
        EcrRepo = "n12122882-cab432-a3-auth-service"
        EcsService = "n12122882-cab432-a3-auth-service"
    }
    "transcoding" = @{
        Name = "transcoding-service"
        DockerContext = "transcoding-service"
        Dockerfile = "transcoding-service/Dockerfile"
        EcrRepo = "n12122882-cab432-a3-transcoding-service"
        EcsService = "n12122882-cab432-a3-transcoding-service"
    }
    "upload" = @{
        Name = "upload-service"
        DockerContext = "upload-service"
        Dockerfile = "upload-service/Dockerfile"
        EcrRepo = "n12122882-cab432-a3-upload-service"
        EcsService = "n12122882-cab432-a3-upload-service"
    }
    "sqs-worker" = @{
        Name = "sqs-worker"
        DockerContext = "sqs-worker"
        Dockerfile = "sqs-worker/Dockerfile"
        EcrRepo = "n12122882-cab432-a3-sqs-worker"
        EcsService = "n12122882-cab432-a3-sqs-worker-service"
    }
}

$service = $SERVICE_CONFIG[$ServiceName]
$imageTag = "$ECR_REGISTRY/$($service.EcrRepo):latest"

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  DEPLOYING: $($service.Name)" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Step 1: Login to ECR
if (-not $OnlyDeploy) {
    Write-Host "[1/4] 🔐 Logging in to ECR..." -ForegroundColor Yellow
    aws ecr get-login-password --region $AWS_REGION | docker login --username AWS --password-stdin $ECR_REGISTRY
    if ($LASTEXITCODE -ne 0) {
        Write-Host "❌ Failed to login to ECR" -ForegroundColor Red
        exit 1
    }
    Write-Host "✅ Successfully logged in to ECR" -ForegroundColor Green
    Write-Host ""
}

# Step 2: Build image
if (-not $OnlyDeploy -and -not $SkipBuild) {
    Write-Host "[2/4] 🏗️  Building Docker image..." -ForegroundColor Yellow
    Write-Host "Context: $($service.DockerContext)" -ForegroundColor Gray
    Write-Host "Dockerfile: $($service.Dockerfile)" -ForegroundColor Gray
    Write-Host "Tag: $imageTag" -ForegroundColor Gray
    Write-Host ""
    
    docker build -t $imageTag -f $service.Dockerfile $service.DockerContext
    if ($LASTEXITCODE -ne 0) {
        Write-Host "❌ Failed to build image" -ForegroundColor Red
        exit 1
    }
    Write-Host "✅ Successfully built image" -ForegroundColor Green
    Write-Host ""
}

# Step 3: Push image
if (-not $OnlyDeploy -and -not $SkipPush) {
    Write-Host "[3/4] 📤 Pushing Docker image to ECR..." -ForegroundColor Yellow
    docker push $imageTag
    if ($LASTEXITCODE -ne 0) {
        Write-Host "❌ Failed to push image" -ForegroundColor Red
        exit 1
    }
    Write-Host "✅ Successfully pushed image" -ForegroundColor Green
    Write-Host ""
}

# Step 4: Deploy to ECS
Write-Host "[4/4] 🚀 Deploying to ECS..." -ForegroundColor Yellow
Write-Host "Cluster: $CLUSTER_NAME" -ForegroundColor Gray
Write-Host "Service: $($service.EcsService)" -ForegroundColor Gray
Write-Host ""

aws ecs update-service --cluster $CLUSTER_NAME --service $service.EcsService --force-new-deployment --region $AWS_REGION | Out-Null

if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Failed to deploy to ECS" -ForegroundColor Red
    exit 1
}

Write-Host ""
Write-Host "========================================" -ForegroundColor Green
Write-Host "✅ DEPLOYMENT INITIATED!" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Green
Write-Host ""
Write-Host "📊 Check deployment status:" -ForegroundColor Cyan
Write-Host "   aws ecs describe-services --cluster $CLUSTER_NAME --services $($service.EcsService) --region $AWS_REGION" -ForegroundColor White
Write-Host ""
Write-Host "🔍 Test service health:" -ForegroundColor Cyan
switch ($ServiceName) {
    "web" { 
        Write-Host "   https://n12122882.cab432.com/" -ForegroundColor White 
    }
    "auth" { 
        Write-Host "   https://n12122882.cab432.com/api/auth/health" -ForegroundColor White
        Write-Host "   https://n12122882.cab432.com/api/auth/test" -ForegroundColor White
    }
    "transcoding" { 
        Write-Host "   https://n12122882.cab432.com/api/transcoding/health" -ForegroundColor White 
    }
    "upload" { 
        Write-Host "   https://n12122882.cab432.com/api/storage/health" -ForegroundColor White 
    }
    "sqs-worker" { 
        Write-Host "   (SQS Worker không có HTTP endpoint - kiểm tra CloudWatch Logs)" -ForegroundColor Yellow 
    }
}
Write-Host ""
Write-Host "⏱️  Deployment thường mất 2-5 phút" -ForegroundColor Yellow
Write-Host ""

