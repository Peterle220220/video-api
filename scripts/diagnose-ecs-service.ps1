#!/usr/bin/env pwsh
# Script to diagnose ECS service issues
# Usage: .\diagnose-ecs-service.ps1

param(
    [string]$ServiceName = "n12122882-cab432-a3-sqs-worker-service",
    [string]$ClusterName = "n12122882-a3-cluster",
    [string]$Region = "ap-southeast-2"
)

Write-Host "==================================" -ForegroundColor Cyan
Write-Host "ECS Service Diagnostic Tool" -ForegroundColor Cyan
Write-Host "==================================" -ForegroundColor Cyan
Write-Host ""

# 1. Check service status
Write-Host "[1] Checking Service Status..." -ForegroundColor Yellow
aws ecs describe-services `
    --cluster $ClusterName `
    --services $ServiceName `
    --region $Region `
    --query 'services[0].{Status:status,DesiredCount:desiredCount,RunningCount:runningCount,PendingCount:pendingCount,TaskDefinition:taskDefinition}' `
    --output table

Write-Host ""

# 2. Get recent service events
Write-Host "[2] Recent Service Events (Last 10)..." -ForegroundColor Yellow
aws ecs describe-services `
    --cluster $ClusterName `
    --services $ServiceName `
    --region $Region `
    --query 'services[0].events[:10].[createdAt,message]' `
    --output table

Write-Host ""

# 3. List tasks and their status
Write-Host "[3] Current Tasks..." -ForegroundColor Yellow
$tasks = aws ecs list-tasks `
    --cluster $ClusterName `
    --service-name $ServiceName `
    --region $Region `
    --query 'taskArns' `
    --output json | ConvertFrom-Json

if ($tasks -and $tasks.Count -gt 0) {
    Write-Host "Found $($tasks.Count) tasks" -ForegroundColor Green
    
    # Describe each task
    foreach ($taskArn in $tasks) {
        Write-Host "`nTask: $taskArn" -ForegroundColor Cyan
        
        aws ecs describe-tasks `
            --cluster $ClusterName `
            --tasks $taskArn `
            --region $Region `
            --query 'tasks[0].{LastStatus:lastStatus,DesiredStatus:desiredStatus,CPU:cpu,Memory:memory,StoppedReason:stoppedReason}' `
            --output table
        
        # Get stop reason if task is stopped
        $taskDetails = aws ecs describe-tasks `
            --cluster $ClusterName `
            --tasks $taskArn `
            --region $Region | ConvertFrom-Json
        
        if ($taskDetails.tasks[0].lastStatus -eq "STOPPED") {
            Write-Host "`nStopped Reason:" -ForegroundColor Red
            Write-Host $taskDetails.tasks[0].stoppedReason -ForegroundColor Red
            
            if ($taskDetails.tasks[0].containers[0].reason) {
                Write-Host "`nContainer Reason:" -ForegroundColor Red
                Write-Host $taskDetails.tasks[0].containers[0].reason -ForegroundColor Red
            }
        }
        
        if ($taskDetails.tasks[0].lastStatus -eq "PENDING") {
            Write-Host "`nTask is PENDING. Checking details..." -ForegroundColor Yellow
            Write-Host "CPU: $($taskDetails.tasks[0].cpu)" -ForegroundColor Yellow
            Write-Host "Memory: $($taskDetails.tasks[0].memory)" -ForegroundColor Yellow
            
            # Check if there are any stopped containers
            if ($taskDetails.tasks[0].containers) {
                Write-Host "`nContainer Details:" -ForegroundColor Yellow
                $taskDetails.tasks[0].containers | ForEach-Object {
                    Write-Host "  Name: $($_.name)" -ForegroundColor White
                    Write-Host "  Status: $($_.lastStatus)" -ForegroundColor White
                    if ($_.reason) {
                        Write-Host "  Reason: $($_.reason)" -ForegroundColor Red
                    }
                }
            }
        }
    }
} else {
    Write-Host "No tasks found" -ForegroundColor Red
}

Write-Host ""

# 4. Check task definition
Write-Host "[4] Task Definition Details..." -ForegroundColor Yellow
$taskDefArn = aws ecs describe-services `
    --cluster $ClusterName `
    --services $ServiceName `
    --region $Region `
    --query 'services[0].taskDefinition' `
    --output text

if ($taskDefArn) {
    aws ecs describe-task-definition `
        --task-definition $taskDefArn `
        --region $Region `
        --query 'taskDefinition.{Family:family,CPU:cpu,Memory:memory,NetworkMode:networkMode,RequiresCompatibilities:requiresCompatibilities}' `
        --output table
}

Write-Host ""

# 5. Check CloudWatch Logs
Write-Host "[5] Recent CloudWatch Logs (Last 50 messages)..." -ForegroundColor Yellow
$logGroup = "/ecs/n12122882-cab432-a3-sqs-worker"

try {
    $streams = aws logs describe-log-streams `
        --log-group-name $logGroup `
        --region $Region `
        --order-by LastEventTime `
        --descending `
        --max-items 5 `
        --query 'logStreams[*].logStreamName' `
        --output json | ConvertFrom-Json
    
    if ($streams -and $streams.Count -gt 0) {
        Write-Host "Found $($streams.Count) recent log streams" -ForegroundColor Green
        
        foreach ($stream in $streams) {
            Write-Host "`nLog Stream: $stream" -ForegroundColor Cyan
            aws logs get-log-events `
                --log-group-name $logGroup `
                --log-stream-name $stream `
                --region $Region `
                --limit 20 `
                --query 'events[*].[timestamp,message]' `
                --output table
        }
    } else {
        Write-Host "No log streams found" -ForegroundColor Yellow
    }
} catch {
    Write-Host "Error reading logs: $_" -ForegroundColor Red
}

Write-Host ""

# 6. Check cluster capacity
Write-Host "[6] Cluster Capacity..." -ForegroundColor Yellow
aws ecs describe-clusters `
    --clusters $ClusterName `
    --region $Region `
    --include STATISTICS `
    --query 'clusters[0].{RegisteredContainerInstances:registeredContainerInstancesCount,RunningTasks:runningTasksCount,PendingTasks:pendingTasksCount,ActiveServices:activeServicesCount}' `
    --output table

Write-Host ""
Write-Host "==================================" -ForegroundColor Cyan
Write-Host "Diagnostic Complete" -ForegroundColor Cyan
Write-Host "==================================" -ForegroundColor Cyan

