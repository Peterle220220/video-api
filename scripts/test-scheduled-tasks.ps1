# ============================================================================
# Test Scheduled Tasks Script
# 
# This script manually triggers the scheduled tasks for testing/demo purposes
# ============================================================================

param(
    [string]$Region = "ap-southeast-2",
    [string]$ClusterName = "n12122882-a3-cluster",
    [ValidateSet("maintenance", "log-cleanup", "both")]
    [string]$Task = "both"
)

$ErrorActionPreference = "Stop"

Write-Host "============================================" -ForegroundColor Cyan
Write-Host "🧪 TESTING ECS SCHEDULED TASKS" -ForegroundColor Cyan
Write-Host "============================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Region: $Region" -ForegroundColor White
Write-Host "Cluster: $ClusterName" -ForegroundColor White
Write-Host "Task to test: $Task" -ForegroundColor White
Write-Host ""

# Get existing security group and subnets
Write-Host "📋 Getting network configuration..." -ForegroundColor Yellow
$securityGroup = "sg-032bd1ff8cf77dbb9"
$subnets = @(
    "subnet-0f1e9df93e15d6b91",
    "subnet-09cdb5e7e63963ad6"
)

Write-Host "✅ Using Security Group: $securityGroup" -ForegroundColor Green
Write-Host "✅ Using Subnets: $($subnets -join ', ')" -ForegroundColor Green
Write-Host ""

function Run-ScheduledTask {
    param(
        [string]$TaskName,
        [string]$TaskDefinition,
        [string]$DisplayName
    )
    
    Write-Host "============================================" -ForegroundColor Cyan
    Write-Host "🚀 Running: $DisplayName" -ForegroundColor Cyan
    Write-Host "============================================" -ForegroundColor Cyan
    Write-Host "Task Definition: $TaskDefinition" -ForegroundColor White
    Write-Host ""
    
    # Run the task
    Write-Host "Starting ECS task..." -ForegroundColor Yellow
    
    $networkConfig = @{
        awsvpcConfiguration = @{
            subnets = $subnets
            securityGroups = @($securityGroup)
            assignPublicIp = "ENABLED"
        }
    } | ConvertTo-Json -Compress -Depth 10
    
    try {
        $result = aws ecs run-task `
            --cluster $ClusterName `
            --task-definition $TaskDefinition `
            --launch-type FARGATE `
            --network-configuration $networkConfig `
            --region $Region | ConvertFrom-Json
        
        if ($result.tasks -and $result.tasks.Count -gt 0) {
            $taskArn = $result.tasks[0].taskArn
            $taskId = $taskArn.Split('/')[-1]
            
            Write-Host "✅ Task started successfully!" -ForegroundColor Green
            Write-Host "   Task ARN: $taskArn" -ForegroundColor White
            Write-Host "   Task ID: $taskId" -ForegroundColor White
            Write-Host ""
            
            # Wait for task to reach running state
            Write-Host "⏳ Waiting for task to reach RUNNING state..." -ForegroundColor Yellow
            $maxWaitTime = 60  # seconds
            $elapsedTime = 0
            $taskStatus = "PENDING"
            
            while ($taskStatus -ne "RUNNING" -and $taskStatus -ne "STOPPED" -and $elapsedTime -lt $maxWaitTime) {
                Start-Sleep -Seconds 5
                $elapsedTime += 5
                
                $taskInfo = aws ecs describe-tasks `
                    --cluster $ClusterName `
                    --tasks $taskArn `
                    --region $Region | ConvertFrom-Json
                
                if ($taskInfo.tasks -and $taskInfo.tasks.Count -gt 0) {
                    $taskStatus = $taskInfo.tasks[0].lastStatus
                    Write-Host "   Status: $taskStatus" -ForegroundColor Cyan
                }
            }
            
            if ($taskStatus -eq "RUNNING") {
                Write-Host "✅ Task is now RUNNING" -ForegroundColor Green
                Write-Host ""
                Write-Host "📊 View logs in CloudWatch:" -ForegroundColor Yellow
                Write-Host "   Log Group: /ecs/cab432-a3-$TaskName" -ForegroundColor White
                Write-Host "   Log Stream: ecs/$TaskName/$taskId" -ForegroundColor White
                Write-Host ""
                Write-Host "🔗 Direct link to CloudWatch logs:" -ForegroundColor Yellow
                $logGroupName = "/ecs/cab432-a3-$TaskName"
                $encodedLogGroup = [System.Web.HttpUtility]::UrlEncode($logGroupName)
                Write-Host "   https://$Region.console.aws.amazon.com/cloudwatch/home?region=$Region#logsV2:log-groups/log-group/$encodedLogGroup" -ForegroundColor Cyan
            } elseif ($taskStatus -eq "STOPPED") {
                Write-Host "✅ Task completed and stopped" -ForegroundColor Green
            }
            
            return @{
                Success = $true
                TaskArn = $taskArn
                TaskId = $taskId
                LogGroup = "/ecs/cab432-a3-$TaskName"
            }
        } else {
            Write-Host "❌ Failed to start task" -ForegroundColor Red
            if ($result.failures) {
                Write-Host "Failures:" -ForegroundColor Red
                $result.failures | ForEach-Object {
                    Write-Host "  - $($_.reason)" -ForegroundColor Red
                }
            }
            return @{ Success = $false }
        }
    } catch {
        Write-Host "❌ Error running task: $_" -ForegroundColor Red
        return @{ Success = $false }
    }
}

# Run the requested tasks
$results = @()

if ($Task -eq "maintenance" -or $Task -eq "both") {
    $result = Run-ScheduledTask -TaskName "maintenance" -TaskDefinition "n12122882-cab432-maintenance" -DisplayName "Maintenance Task"
    $results += $result
    if ($Task -eq "both") {
        Write-Host ""
        Start-Sleep -Seconds 2
    }
}

if ($Task -eq "log-cleanup" -or $Task -eq "both") {
    $result = Run-ScheduledTask -TaskName "log-cleanup" -TaskDefinition "n12122882-cab432-log-cleanup" -DisplayName "Log Cleanup Task"
    $results += $result
}

# Summary
Write-Host ""
Write-Host "============================================" -ForegroundColor Cyan
Write-Host "📋 TEST SUMMARY" -ForegroundColor Cyan
Write-Host "============================================" -ForegroundColor Cyan

$successCount = ($results | Where-Object { $_.Success }).Count
$totalCount = $results.Count

Write-Host "Tasks executed: $totalCount" -ForegroundColor White
Write-Host "Successful: $successCount" -ForegroundColor $(if ($successCount -eq $totalCount) { "Green" } else { "Yellow" })
Write-Host ""

if ($successCount -gt 0) {
    Write-Host "✅ Tasks are running!" -ForegroundColor Green
    Write-Host ""
    Write-Host "📊 To view logs, use:" -ForegroundColor Yellow
    foreach ($result in $results | Where-Object { $_.Success }) {
        Write-Host "   aws logs tail $($result.LogGroup) --follow --region $Region" -ForegroundColor White
    }
}

Write-Host ""
Write-Host "🔗 View in AWS Console:" -ForegroundColor Yellow
Write-Host "   ECS Cluster: https://$Region.console.aws.amazon.com/ecs/v2/clusters/$ClusterName/tasks?region=$Region" -ForegroundColor Cyan
Write-Host "   EventBridge Rules: https://$Region.console.aws.amazon.com/events/home?region=$Region#/rules" -ForegroundColor Cyan
Write-Host ""

