# ========================================================================================================
# Script: Test Custom Scaling Metric
# Purpose: Test the custom scaling metric by generating load via SQS messages
# ========================================================================================================

param(
    [Parameter(Mandatory=$false)]
    [int]$MessageCount = 15,
    
    [Parameter(Mandatory=$false)]
    [int]$DurationMinutes = 10
)

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Custom Scaling Metric Test" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

$QueueUrl = "https://sqs.ap-southeast-2.amazonaws.com/901444280953/transcoding-queue"
$ServiceName = "n12122882-cab432-a3-transcoding-service"
$ClusterName = "n12122882-a3-cluster"

Write-Host "Configuration:" -ForegroundColor Yellow
Write-Host "  Queue: transcoding-queue" -ForegroundColor Gray
Write-Host "  Messages to send: $MessageCount" -ForegroundColor Gray
Write-Host "  Test duration: $DurationMinutes minutes" -ForegroundColor Gray
Write-Host "  Expected scaling: 1 → 3 → 1 tasks" -ForegroundColor Gray
Write-Host ""

Write-Host "Step 1: Check initial state..." -ForegroundColor Yellow
$service = aws ecs describe-services --cluster $ClusterName --services $ServiceName --query 'services[0]' | ConvertFrom-Json
$initialTaskCount = $service.runningCount
Write-Host "  Current task count: $initialTaskCount" -ForegroundColor Green
Write-Host ""

Write-Host "Step 2: Sending $MessageCount messages to queue..." -ForegroundColor Yellow
for ($i = 1; $i -le $MessageCount; $i++) {
    $message = @{
        videoId = "test-scaling-$i"
        s3Key = "test/video-$i.mp4"
        timestamp = (Get-Date).ToString("o")
    } | ConvertTo-Json
    
    aws sqs send-message --queue-url $QueueUrl --message-body $message | Out-Null
    Write-Host "  ✓ Sent message $i/$MessageCount" -ForegroundColor Gray
}
Write-Host "  ✓ All messages sent" -ForegroundColor Green
Write-Host ""

Write-Host "Step 3: Monitoring scaling behavior..." -ForegroundColor Yellow
Write-Host "  Note: Custom metric updates every minute via Lambda" -ForegroundColor Gray
Write-Host "  Expected behavior:" -ForegroundColor Gray
Write-Host "    - Lambda publishes MessagesPerTask metric" -ForegroundColor Gray
Write-Host "    - Target: 5 messages per task" -ForegroundColor Gray
Write-Host "    - With 15 messages, should scale to 3 tasks (15/5=3)" -ForegroundColor Gray
Write-Host ""

$startTime = Get-Date
$endTime = $startTime.AddMinutes($DurationMinutes)
$maxTasksSeen = $initialTaskCount
$scaledOut = $false

while ((Get-Date) -lt $endTime) {
    $service = aws ecs describe-services --cluster $ClusterName --services $ServiceName --query 'services[0]' | ConvertFrom-Json
    $currentTasks = $service.runningCount
    $desiredTasks = $service.desiredCount
    
    # Get queue depth
    $queueAttrs = aws sqs get-queue-attributes --queue-url $QueueUrl --attribute-names ApproximateNumberOfMessages | ConvertFrom-Json
    $queueDepth = [int]$queueAttrs.Attributes.ApproximateNumberOfMessages
    
    $timestamp = (Get-Date).ToString("HH:mm:ss")
    $elapsed = [math]::Round(((Get-Date) - $startTime).TotalMinutes, 1)
    
    Write-Host "  [$timestamp] Tasks: $currentTasks/$desiredTasks | Queue: $queueDepth messages | Elapsed: $elapsed min" -ForegroundColor Cyan
    
    if ($currentTasks -gt $maxTasksSeen) {
        $maxTasksSeen = $currentTasks
        Write-Host "    ↗ Scaled out to $currentTasks tasks!" -ForegroundColor Green
    }
    
    if ($currentTasks -ge 3 -and -not $scaledOut) {
        $scaledOut = $true
        Write-Host "    ✓ Successfully scaled to 3 tasks!" -ForegroundColor Green
        Write-Host "    Stopping message generation to allow scale-in..." -ForegroundColor Yellow
    }
    
    if ($scaledOut -and $currentTasks -eq 1) {
        Write-Host "    ↘ Scaled back down to 1 task!" -ForegroundColor Green
        Write-Host "    ✓ Test completed successfully!" -ForegroundColor Green
        break
    }
    
    Start-Sleep -Seconds 30
}

Write-Host ""
Write-Host "========================================" -ForegroundColor Green
Write-Host "Test Summary" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Green
Write-Host "  Initial tasks: $initialTaskCount" -ForegroundColor White
Write-Host "  Max tasks seen: $maxTasksSeen" -ForegroundColor White
Write-Host "  Final tasks: $currentTasks" -ForegroundColor White
Write-Host "  Scaling successful: $scaledOut" -ForegroundColor White
Write-Host ""

Write-Host "View CloudWatch metrics:" -ForegroundColor Cyan
Write-Host "  aws cloudwatch get-metric-statistics --namespace CAB432/CustomMetrics --metric-name MessagesPerTask --start-time (Get-Date).AddMinutes(-30).ToString('o') --end-time (Get-Date).ToString('o') --period 60 --statistics Average" -ForegroundColor Gray
Write-Host ""

