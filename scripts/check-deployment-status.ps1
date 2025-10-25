# Check ECS Deployment Status
param(
    [int]$IntervalSeconds = 30,
    [int]$MaxRetries = 10
)

$CLUSTER = "n12122882-a3-cluster"
$REGION = "ap-southeast-2"

$SERVICES = @(
    "n12122882-cab432-a3-web-service",
    "n12122882-cab432-a3-auth-service",
    "n12122882-cab432-a3-transcoding-service",
    "n12122882-cab432-a3-upload-service",
    "n12122882-cab432-a3-sqs-worker-service"
)

function Check-ServiceStatus {
    Write-Host "`n========================================" -ForegroundColor Cyan
    Write-Host "ECS SERVICES STATUS" -ForegroundColor Cyan
    Write-Host "========================================`n" -ForegroundColor Cyan
    
    $allHealthy = $true
    
    foreach ($service in $SERVICES) {
        $shortName = $service -replace "n12122882-cab432-a3-", "" -replace "-service", ""
        
        $result = aws ecs describe-services `
            --cluster $CLUSTER `
            --services $service `
            --region $REGION `
            --query 'services[0].{Running:runningCount,Desired:desiredCount,Status:status,Rollout:deployments[0].rolloutState}' `
            --output json | ConvertFrom-Json
        
        $status = "OK"
        $color = "Green"
        
        if ($result.Running -lt $result.Desired) {
            $status = "DEPLOYING"
            $color = "Yellow"
            $allHealthy = $false
        }
        
        if ($result.Status -ne "ACTIVE") {
            $status = "ERROR"
            $color = "Red"
            $allHealthy = $false
        }
        
        Write-Host "$shortName : " -NoNewline
        Write-Host "$status " -ForegroundColor $color -NoNewline
        Write-Host "($($result.Running)/$($result.Desired) running, Rollout: $($result.Rollout))"
    }
    
    return $allHealthy
}

function Test-HealthEndpoints {
    Write-Host "`n========================================" -ForegroundColor Cyan
    Write-Host "HEALTH ENDPOINTS" -ForegroundColor Cyan
    Write-Host "========================================`n" -ForegroundColor Cyan
    
    $endpoints = @{
        "Web" = "https://n12122882.cab432.com/"
        "Auth" = "https://n12122882.cab432.com/api/auth/health"
        "Transcoding" = "https://n12122882.cab432.com/api/transcoding/health"
        "Upload" = "https://n12122882.cab432.com/api/storage/health"
    }
    
    foreach ($name in $endpoints.Keys) {
        $url = $endpoints[$name]
        Write-Host "$name : " -NoNewline
        
        try {
            $response = Invoke-WebRequest -Uri $url -UseBasicParsing -TimeoutSec 5 -ErrorAction Stop
            if ($response.StatusCode -eq 200) {
                Write-Host "HEALTHY" -ForegroundColor Green
            } else {
                Write-Host "Status $($response.StatusCode)" -ForegroundColor Yellow
            }
        } catch {
            Write-Host "UNAVAILABLE" -ForegroundColor Red
        }
    }
}

# Main loop
$retry = 0
do {
    Clear-Host
    Write-Host "Checking deployment status... (Attempt $($retry + 1)/$MaxRetries)" -ForegroundColor Cyan
    Write-Host "Time: $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')`n" -ForegroundColor Gray
    
    $allHealthy = Check-ServiceStatus
    Test-HealthEndpoints
    
    if ($allHealthy) {
        Write-Host "`nAll services are HEALTHY!" -ForegroundColor Green
        break
    }
    
    $retry++
    if ($retry -lt $MaxRetries) {
        Write-Host "`nWaiting $IntervalSeconds seconds before next check..." -ForegroundColor Yellow
        Start-Sleep -Seconds $IntervalSeconds
    }
} while ($retry -lt $MaxRetries)

if (-not $allHealthy) {
    Write-Host "`nSome services are still deploying after $MaxRetries checks." -ForegroundColor Yellow
    Write-Host "Check AWS Console for details:" -ForegroundColor Yellow
    Write-Host "https://ap-southeast-2.console.aws.amazon.com/ecs/v2/clusters/$CLUSTER/services" -ForegroundColor White
}


