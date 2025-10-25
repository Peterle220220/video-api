# Monitor Auto-Scaling Demo Script
# Chạy script này trong terminal riêng khi đang demo auto-scaling

param(
    [string]$ClusterName = "video-processing-cluster",
    [string]$ServiceName = "transcoding-service",
    [string]$Region = "ap-southeast-2"
)

Write-Host "==================================================" -ForegroundColor Cyan
Write-Host "   AUTO-SCALING MONITOR - DEMO HELPER" -ForegroundColor Cyan
Write-Host "==================================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Cluster: $ClusterName" -ForegroundColor Yellow
Write-Host "Service: $ServiceName" -ForegroundColor Yellow
Write-Host "Region: $Region" -ForegroundColor Yellow
Write-Host ""
Write-Host "Press Ctrl+C to stop monitoring" -ForegroundColor Gray
Write-Host ""

$iteration = 0

while ($true) {
    $iteration++
    $timestamp = Get-Date -Format "HH:mm:ss"
    
    Write-Host "[$timestamp] Iteration $iteration" -ForegroundColor White
    Write-Host "----------------------------------------" -ForegroundColor Gray
    
    try {
        # Get ECS Service details
        $service = aws ecs describe-services `
            --cluster $ClusterName `
            --services $ServiceName `
            --region $Region `
            --query 'services[0]' `
            --output json | ConvertFrom-Json
        
        $desiredCount = $service.desiredCount
        $runningCount = $service.runningCount
        $pendingCount = $service.pendingCount
        
        # Color coding based on status
        $color = "White"
        if ($runningCount -eq 1) { $color = "Green" }
        elseif ($runningCount -eq 2) { $color = "Yellow" }
        elseif ($runningCount -ge 3) { $color = "Red" }
        
        Write-Host "  Desired Tasks: " -NoNewline
        Write-Host "$desiredCount" -ForegroundColor $color
        
        Write-Host "  Running Tasks: " -NoNewline
        Write-Host "$runningCount" -ForegroundColor $color
        
        Write-Host "  Pending Tasks: " -NoNewline
        Write-Host "$pendingCount" -ForegroundColor Cyan
        
        # Check for recent events
        $events = $service.events | Select-Object -First 3
        if ($events) {
            Write-Host "`n  Recent Events:" -ForegroundColor Magenta
            foreach ($event in $events) {
                $eventTime = $event.createdAt
                $eventMsg = $event.message
                Write-Host "    - $eventMsg" -ForegroundColor Gray
            }
        }
        
        # Status indicator
        Write-Host "`n  Status: " -NoNewline
        if ($runningCount -eq 1 -and $pendingCount -eq 0) {
            Write-Host "✓ STABLE (1 task)" -ForegroundColor Green
            Write-Host "  Action: Ready to start load test" -ForegroundColor Green
        }
        elseif ($runningCount -eq 3 -and $pendingCount -eq 0) {
            Write-Host "✓ SCALED OUT (3 tasks)" -ForegroundColor Red
            Write-Host "  Action: Ready to stop load test" -ForegroundColor Red
        }
        elseif ($pendingCount -gt 0) {
            Write-Host "⟳ SCALING..." -ForegroundColor Yellow
            Write-Host "  Action: Wait..." -ForegroundColor Yellow
        }
        elseif ($runningCount -eq 2) {
            Write-Host "⟳ SCALING IN PROGRESS (2 tasks)" -ForegroundColor Yellow
            Write-Host "  Action: Wait..." -ForegroundColor Yellow
        }
        else {
            Write-Host "● Running ($runningCount tasks)" -ForegroundColor White
        }
        
    }
    catch {
        Write-Host "  ERROR: Could not fetch service details" -ForegroundColor Red
        Write-Host "  $($_.Exception.Message)" -ForegroundColor Red
    }
    
    Write-Host ""
    Write-Host "==================================================" -ForegroundColor Gray
    Write-Host ""
    
    # Wait 15 seconds before next check
    Start-Sleep -Seconds 15
}

