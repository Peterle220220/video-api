# ==================================================================================
# DEPLOY ALL SERVICES TO ECS
# ==================================================================================
# Script này sẽ build, push Docker images và deploy tất cả services lên ECS
# ==================================================================================

param(
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
$SERVICES = @(
    @{
        Name = "web"
        DockerContext = "web"
        Dockerfile = "web/Dockerfile"
        EcrRepo = "n12122882-cab432-a3-web"
        EcsService = "n12122882-cab432-a3-web-service"
    },
    @{
        Name = "auth-service"
        DockerContext = "auth-service"
        Dockerfile = "auth-service/Dockerfile"
        EcrRepo = "n12122882-cab432-a3-auth-service"
        EcsService = "n12122882-cab432-a3-auth-service"
    },
    @{
        Name = "transcoding-service"
        DockerContext = "transcoding-service"
        Dockerfile = "transcoding-service/Dockerfile"
        EcrRepo = "n12122882-cab432-a3-transcoding-service"
        EcsService = "n12122882-cab432-a3-transcoding-service"
    },
    @{
        Name = "upload-service"
        DockerContext = "upload-service"
        Dockerfile = "upload-service/Dockerfile"
        EcrRepo = "n12122882-cab432-a3-upload-service"
        EcsService = "n12122882-cab432-a3-upload-service"
    },
    @{
        Name = "sqs-worker"
        DockerContext = "sqs-worker"
        Dockerfile = "sqs-worker/Dockerfile"
        EcrRepo = "n12122882-cab432-a3-sqs-worker"
        EcsService = "n12122882-cab432-a3-sqs-worker-service"
    }
)

# Scheduled Tasks (no ECS service, just task definitions)
$SCHEDULED_TASKS = @(
    @{
        Name = "maintenance-task"
        DockerContext = "maintenance-task"
        Dockerfile = "maintenance-task/Dockerfile"
        EcrRepo = "n12122882-cab432-a3-maintenance-task"
        TaskDefinition = "n12122882-cab432-maintenance"
    },
    @{
        Name = "log-cleanup-task"
        DockerContext = "log-cleanup-task"
        Dockerfile = "log-cleanup-task/Dockerfile"
        EcrRepo = "n12122882-cab432-a3-log-cleanup-task"
        TaskDefinition = "n12122882-cab432-log-cleanup"
    }
)

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  DEPLOY ALL SERVICES TO ECS" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Step 1: Login to ECR
if (-not $OnlyDeploy) {
    Write-Host "[1/4] Logging in to ECR..." -ForegroundColor Yellow
    aws ecr get-login-password --region $AWS_REGION | docker login --username AWS --password-stdin $ECR_REGISTRY
    if ($LASTEXITCODE -ne 0) {
        Write-Host "Failed to login to ECR" -ForegroundColor Red
        exit 1
    }
    Write-Host "Successfully logged in to ECR" -ForegroundColor Green
    Write-Host ""
}

# Step 2: Build and Push Images
if (-not $OnlyDeploy) {
    # Build and push services
    foreach ($service in $SERVICES) {
        $serviceName = $service.Name
        $imageTag = "$ECR_REGISTRY/$($service.EcrRepo):latest"
        
        Write-Host "========================================" -ForegroundColor Cyan
        Write-Host "Processing: $serviceName" -ForegroundColor Cyan
        Write-Host "========================================" -ForegroundColor Cyan
        
        # Build image
        if (-not $SkipBuild) {
            Write-Host "[2/5] Building Docker image for $serviceName..." -ForegroundColor Yellow
            docker build -t $imageTag -f $service.Dockerfile $service.DockerContext
            if ($LASTEXITCODE -ne 0) {
                Write-Host "Failed to build $serviceName" -ForegroundColor Red
                exit 1
            }
            Write-Host "Successfully built $serviceName" -ForegroundColor Green
            Write-Host ""
        }
        
        # Push image
        if (-not $SkipPush) {
            Write-Host "[3/5] Pushing Docker image for $serviceName..." -ForegroundColor Yellow
            docker push $imageTag
            if ($LASTEXITCODE -ne 0) {
                Write-Host "Failed to push $serviceName" -ForegroundColor Red
                exit 1
            }
            Write-Host "Successfully pushed $serviceName" -ForegroundColor Green
            Write-Host ""
        }
    }
    
    # Build and push scheduled tasks
    Write-Host "========================================" -ForegroundColor Cyan
    Write-Host "Processing Scheduled Tasks" -ForegroundColor Cyan
    Write-Host "========================================" -ForegroundColor Cyan
    
    foreach ($task in $SCHEDULED_TASKS) {
        $taskName = $task.Name
        $imageTag = "$ECR_REGISTRY/$($task.EcrRepo):latest"
        
        Write-Host "Processing: $taskName" -ForegroundColor Yellow
        
        # Build image
        if (-not $SkipBuild) {
            docker build -t $imageTag -f $task.Dockerfile $task.DockerContext
            if ($LASTEXITCODE -ne 0) {
                Write-Host "Failed to build $taskName" -ForegroundColor Red
                exit 1
            }
            Write-Host "Built $taskName" -ForegroundColor Green
        }
        
        # Push image
        if (-not $SkipPush) {
            docker push $imageTag
            if ($LASTEXITCODE -ne 0) {
                Write-Host "Failed to push $taskName" -ForegroundColor Red
                exit 1
            }
            Write-Host "Pushed $taskName" -ForegroundColor Green
        }
    }
    Write-Host ""
}

# Step 3: Deploy Services to ECS
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "[4/5] Deploying services to ECS..." -ForegroundColor Yellow
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

foreach ($service in $SERVICES) {
    $serviceName = $service.Name
    $ecsService = $service.EcsService
    
    Write-Host "Deploying $serviceName ($ecsService)..." -ForegroundColor Yellow
    aws ecs update-service --cluster $CLUSTER_NAME --service $ecsService --force-new-deployment --region $AWS_REGION | Out-Null
    
    if ($LASTEXITCODE -ne 0) {
        Write-Host "Failed to deploy $serviceName" -ForegroundColor Red
        exit 1
    }
    
    Write-Host "$serviceName deployment initiated" -ForegroundColor Green
}

Write-Host ""

# Step 4: Update Scheduled Task Definitions
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "[5/5] Updating scheduled task definitions..." -ForegroundColor Yellow
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Note: Scheduled tasks will use the new images on their next run." -ForegroundColor Yellow
Write-Host "To manually trigger scheduled tasks now, run:" -ForegroundColor Cyan
Write-Host "   .\scripts\test-scheduled-tasks.ps1 -Task both" -ForegroundColor White
Write-Host ""

Write-Host "========================================" -ForegroundColor Green
Write-Host "ALL DEPLOYMENTS INITIATED!" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Green
Write-Host ""
Write-Host "📋 Services Deployed:" -ForegroundColor Cyan
Write-Host "   - Web Frontend" -ForegroundColor White
Write-Host "   - Auth Service" -ForegroundColor White
Write-Host "   - Transcoding Service" -ForegroundColor White
Write-Host "   - Upload Service" -ForegroundColor White
Write-Host "   - SQS Worker" -ForegroundColor White
Write-Host ""
Write-Host "📅 Scheduled Tasks Updated:" -ForegroundColor Cyan
Write-Host "   - Maintenance Task (runs daily)" -ForegroundColor White
Write-Host "   - Log Cleanup Task (runs weekly)" -ForegroundColor White
Write-Host ""
Write-Host "To check deployment status:" -ForegroundColor Cyan
Write-Host "   aws ecs list-services --cluster $CLUSTER_NAME --region $AWS_REGION" -ForegroundColor White
Write-Host ""
Write-Host "To check service health:" -ForegroundColor Cyan
Write-Host "   https://n12122882.cab432.com/" -ForegroundColor White
Write-Host "   https://n12122882.cab432.com/api/auth/health" -ForegroundColor White
Write-Host "   https://n12122882.cab432.com/api/transcoding/health" -ForegroundColor White
Write-Host "   https://n12122882.cab432.com/api/storage/health" -ForegroundColor White
Write-Host ""
Write-Host "Deployment takes 2-5 minutes. Monitor in AWS Console:" -ForegroundColor Yellow
Write-Host "   https://ap-southeast-2.console.aws.amazon.com/ecs/v2/clusters/$CLUSTER_NAME/services" -ForegroundColor White
Write-Host ""
