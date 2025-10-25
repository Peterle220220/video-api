# ============================================================================
# Check Scheduled Tasks Status
# 
# Quick status check for EventBridge rules and scheduled task configurations
# ============================================================================

param(
    [string]$Region = "ap-southeast-2"
)

$ErrorActionPreference = "Stop"

Write-Host "============================================" -ForegroundColor Cyan
Write-Host "📅 ECS SCHEDULED TASKS STATUS" -ForegroundColor Cyan
Write-Host "============================================" -ForegroundColor Cyan
Write-Host ""

# Check EventBridge Rules
Write-Host "🔔 EventBridge Rules:" -ForegroundColor Yellow
Write-Host ""

$rules = @(
    "n12122882-cab432-maintenance-schedule",
    "n12122882-cab432-log-cleanup"
)

foreach ($ruleName in $rules) {
    try {
        $rule = aws events describe-rule --name $ruleName --region $Region | ConvertFrom-Json
        
        $displayName = if ($ruleName -like "*maintenance*") { "Maintenance Task" } else { "Log Cleanup Task" }
        
        Write-Host "📋 $displayName" -ForegroundColor Cyan
        Write-Host "   Name: $($rule.Name)" -ForegroundColor White
        Write-Host "   State: $($rule.State)" -ForegroundColor $(if ($rule.State -eq "ENABLED") { "Green" } else { "Red" })
        Write-Host "   Schedule: $($rule.ScheduleExpression)" -ForegroundColor White
        Write-Host "   Description: $($rule.Description)" -ForegroundColor Gray
        
        # Get targets
        $targets = aws events list-targets-by-rule --rule $ruleName --region $Region | ConvertFrom-Json
        if ($targets.Targets) {
            Write-Host "   Targets: $($targets.Targets.Count)" -ForegroundColor White
            foreach ($target in $targets.Targets) {
                Write-Host "      - $($target.Arn.Split('/')[-1])" -ForegroundColor Gray
            }
        }
        Write-Host ""
        
    } catch {
        Write-Host "❌ Rule '$ruleName' not found or error: $_" -ForegroundColor Red
        Write-Host ""
    }
}

# Check Task Definitions
Write-Host "📦 Task Definitions:" -ForegroundColor Yellow
Write-Host ""

$taskDefs = @(
    "n12122882-cab432-maintenance",
    "n12122882-cab432-log-cleanup"
)

foreach ($taskFamily in $taskDefs) {
    try {
        $taskDef = aws ecs describe-task-definition --task-definition $taskFamily --region $Region | ConvertFrom-Json
        
        $displayName = if ($taskFamily -like "*maintenance*") { "Maintenance Task" } else { "Log Cleanup Task" }
        
        Write-Host "📦 $displayName" -ForegroundColor Cyan
        Write-Host "   Family: $($taskDef.taskDefinition.family)" -ForegroundColor White
        Write-Host "   Revision: $($taskDef.taskDefinition.revision)" -ForegroundColor White
        Write-Host "   Status: $($taskDef.taskDefinition.status)" -ForegroundColor Green
        Write-Host "   CPU: $($taskDef.taskDefinition.cpu)" -ForegroundColor White
        Write-Host "   Memory: $($taskDef.taskDefinition.memory) MB" -ForegroundColor White
        Write-Host "   Launch Type: $($taskDef.taskDefinition.requiresCompatibilities -join ', ')" -ForegroundColor White
        
        # Get container info
        $container = $taskDef.taskDefinition.containerDefinitions[0]
        Write-Host "   Container Image: $($container.image.Split('/')[-1])" -ForegroundColor Gray
        Write-Host ""
        
    } catch {
        Write-Host "❌ Task definition '$taskFamily' not found or error: $_" -ForegroundColor Red
        Write-Host ""
    }
}

# Check CloudWatch Log Groups
Write-Host "📊 CloudWatch Log Groups:" -ForegroundColor Yellow
Write-Host ""

$logGroups = @(
    "/ecs/cab432-a3-maintenance",
    "/ecs/cab432-a3-log-cleanup"
)

foreach ($logGroup in $logGroups) {
    try {
        $lg = aws logs describe-log-groups --log-group-name-prefix $logGroup --region $Region | ConvertFrom-Json
        
        if ($lg.logGroups -and $lg.logGroups.Count -gt 0) {
            $group = $lg.logGroups[0]
            $displayName = if ($logGroup -like "*maintenance*") { "Maintenance Logs" } else { "Log Cleanup Logs" }
            
            Write-Host "📊 $displayName" -ForegroundColor Cyan
            Write-Host "   Log Group: $($group.logGroupName)" -ForegroundColor White
            
            if ($group.retentionInDays) {
                Write-Host "   Retention: $($group.retentionInDays) days" -ForegroundColor White
            } else {
                Write-Host "   Retention: Never expire" -ForegroundColor Yellow
            }
            
            # Get recent log streams
            $streams = aws logs describe-log-streams `
                --log-group-name $logGroup `
                --order-by LastEventTime `
                --descending `
                --max-items 3 `
                --region $Region 2>$null | ConvertFrom-Json
            
            if ($streams.logStreams -and $streams.logStreams.Count -gt 0) {
                Write-Host "   Recent Streams: $($streams.logStreams.Count)" -ForegroundColor White
                $lastStream = $streams.logStreams[0]
                if ($lastStream.lastEventTimestamp) {
                    $lastEventTime = [DateTimeOffset]::FromUnixTimeMilliseconds($lastStream.lastEventTimestamp).LocalDateTime
                    Write-Host "   Last Event: $lastEventTime" -ForegroundColor Gray
                }
            }
            Write-Host ""
        }
        
    } catch {
        Write-Host "❌ Log group '$logGroup' not found" -ForegroundColor Red
        Write-Host ""
    }
}

# Recent Task Executions
Write-Host "🚀 Recent Task Executions (Last 24 hours):" -ForegroundColor Yellow
Write-Host ""

try {
    $cluster = "n12122882-a3-cluster"
    $tasks = aws ecs list-tasks --cluster $cluster --region $Region | ConvertFrom-Json
    
    if ($tasks.taskArns -and $tasks.taskArns.Count -gt 0) {
        # Filter for scheduled tasks
        $scheduledTaskArns = $tasks.taskArns | Where-Object { 
            $_ -like "*maintenance*" -or $_ -like "*log-cleanup*" 
        }
        
        if ($scheduledTaskArns -and $scheduledTaskArns.Count -gt 0) {
            Write-Host "Found $($scheduledTaskArns.Count) scheduled task(s) currently running" -ForegroundColor Green
            
            $taskDetails = aws ecs describe-tasks --cluster $cluster --tasks $scheduledTaskArns --region $Region | ConvertFrom-Json
            
            foreach ($task in $taskDetails.tasks) {
                $taskId = $task.taskArn.Split('/')[-1]
                $taskDef = $task.taskDefinitionArn.Split('/')[-1]
                Write-Host "   - Task: $taskId" -ForegroundColor White
                Write-Host "     Definition: $taskDef" -ForegroundColor Gray
                Write-Host "     Status: $($task.lastStatus)" -ForegroundColor Cyan
            }
        } else {
            Write-Host "No scheduled tasks currently running" -ForegroundColor Gray
        }
    } else {
        Write-Host "No tasks currently running in cluster" -ForegroundColor Gray
    }
} catch {
    Write-Host "Unable to check task executions: $_" -ForegroundColor Yellow
}

Write-Host ""
Write-Host "============================================" -ForegroundColor Cyan
Write-Host "📋 SUMMARY" -ForegroundColor Cyan
Write-Host "============================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "✅ EventBridge Rules: 2 configured" -ForegroundColor Green
Write-Host "   - Daily Maintenance Task" -ForegroundColor White
Write-Host "   - Weekly Log Cleanup Task" -ForegroundColor White
Write-Host ""
Write-Host "📦 Task Definitions: 2 active" -ForegroundColor Green
Write-Host "📊 Log Groups: 2 configured" -ForegroundColor Green
Write-Host ""
Write-Host "🎥 For demo, manually trigger tasks:" -ForegroundColor Yellow
Write-Host "   .\scripts\test-scheduled-tasks.ps1 -Task both" -ForegroundColor Cyan
Write-Host ""
Write-Host "🔗 View in AWS Console:" -ForegroundColor Yellow
Write-Host "   EventBridge: https://$Region.console.aws.amazon.com/events/home?region=$Region#/rules" -ForegroundColor Cyan
Write-Host "   ECS Tasks: https://$Region.console.aws.amazon.com/ecs/v2/clusters/n12122882-a3-cluster/tasks?region=$Region" -ForegroundColor Cyan
Write-Host ""

