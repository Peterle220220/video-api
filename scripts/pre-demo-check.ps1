# Pre-Demo Flight Check Script
# Chạy script này TRƯỚC KHI quay video để đảm bảo mọi thứ OK

param(
    [string]$ClusterName = "video-processing-cluster",
    [string]$Region = "ap-southeast-2",
    [string]$Domain = ""  # Fill in your domain e.g., "yourname.cab432.com"
)

$script:passCount = 0
$script:failCount = 0
$script:warnCount = 0

function Test-Check {
    param(
        [string]$Name,
        [scriptblock]$TestScript,
        [string]$SuccessMessage = "OK",
        [string]$FailureMessage = "FAILED"
    )
    
    Write-Host -NoNewline "  [ ] $Name... " -ForegroundColor White
    
    try {
        $result = & $TestScript
        if ($result) {
            Write-Host "`r  [✓]" -NoNewline -ForegroundColor Green
            Write-Host " $Name - $SuccessMessage" -ForegroundColor Green
            $script:passCount++
            return $true
        } else {
            Write-Host "`r  [✗]" -NoNewline -ForegroundColor Red
            Write-Host " $Name - $FailureMessage" -ForegroundColor Red
            $script:failCount++
            return $false
        }
    }
    catch {
        Write-Host "`r  [✗]" -NoNewline -ForegroundColor Red
        Write-Host " $Name - ERROR: $($_.Exception.Message)" -ForegroundColor Red
        $script:failCount++
        return $false
    }
}

function Test-Warning {
    param(
        [string]$Name,
        [scriptblock]$TestScript,
        [string]$WarningMessage = "WARNING"
    )
    
    Write-Host -NoNewline "  [ ] $Name... " -ForegroundColor White
    
    try {
        $result = & $TestScript
        if ($result) {
            Write-Host "`r  [✓]" -NoNewline -ForegroundColor Green
            Write-Host " $Name - OK" -ForegroundColor Green
            $script:passCount++
        } else {
            Write-Host "`r  [!]" -NoNewline -ForegroundColor Yellow
            Write-Host " $Name - $WarningMessage" -ForegroundColor Yellow
            $script:warnCount++
        }
    }
    catch {
        Write-Host "`r  [!]" -NoNewline -ForegroundColor Yellow
        Write-Host " $Name - $WarningMessage" -ForegroundColor Yellow
        $script:warnCount++
    }
}

Clear-Host
Write-Host "===========================================================" -ForegroundColor Cyan
Write-Host "         PRE-DEMO FLIGHT CHECK - CAB432 A3" -ForegroundColor Cyan
Write-Host "===========================================================" -ForegroundColor Cyan
Write-Host ""

# Section 1: AWS CLI & Credentials
Write-Host "[1] AWS CLI & Credentials" -ForegroundColor Yellow
Write-Host ""

Test-Check -Name "AWS CLI installed" -TestScript {
    $null -ne (Get-Command aws -ErrorAction SilentlyContinue)
}

Test-Check -Name "AWS credentials configured" -TestScript {
    $identity = aws sts get-caller-identity 2>$null
    $null -ne $identity
}

Write-Host ""

# Section 2: ECS Services
Write-Host "[2] ECS Services Status" -ForegroundColor Yellow
Write-Host ""

$services = @(
    "upload-service",
    "transcoding-service", 
    "auth-service",
    "sqs-worker"
)

foreach ($svc in $services) {
    Test-Check -Name "ECS Service: $svc" -TestScript {
        $result = aws ecs describe-services `
            --cluster $ClusterName `
            --services $svc `
            --region $Region `
            --query 'services[0].status' `
            --output text 2>$null
        $result -eq "ACTIVE"
    }
}

Write-Host ""

# Section 3: SQS Queues
Write-Host "[3] SQS Queues" -ForegroundColor Yellow
Write-Host ""

$queues = @(
    "video-transcoding-queue",
    "video-transcoding-dlq"
)

foreach ($queue in $queues) {
    Test-Check -Name "SQS Queue: $queue" -TestScript {
        $result = aws sqs list-queues --region $Region 2>$null | ConvertFrom-Json
        $result.QueueUrls -match $queue
    }
}

Test-Check -Name "DLQ configured on main queue" -TestScript {
    $queueUrl = aws sqs list-queues --region $Region --queue-name-prefix video-transcoding-queue --output text 2>$null
    if ($queueUrl) {
        $attrs = aws sqs get-queue-attributes `
            --queue-url $queueUrl `
            --attribute-names RedrivePolicy `
            --region $Region 2>$null | ConvertFrom-Json
        $null -ne $attrs.Attributes.RedrivePolicy
    } else {
        $false
    }
}

Write-Host ""

# Section 4: Auto-Scaling Configuration
Write-Host "[4] Auto-Scaling Configuration" -ForegroundColor Yellow
Write-Host ""

Test-Check -Name "Auto-scaling policy exists" -TestScript {
    $policies = aws application-autoscaling describe-scaling-policies `
        --service-namespace ecs `
        --region $Region 2>$null | ConvertFrom-Json
    $policies.ScalingPolicies.Count -gt 0
}

Test-Warning -Name "Scaling limits (min=1, max=3)" -TestScript {
    $targets = aws application-autoscaling describe-scalable-targets `
        --service-namespace ecs `
        --region $Region 2>$null | ConvertFrom-Json
    $target = $targets.ScalableTargets | Where-Object { $_.ServiceNamespace -eq "ecs" } | Select-Object -First 1
    if ($target) {
        ($target.MinCapacity -eq 1) -and ($target.MaxCapacity -ge 3)
    } else {
        $false
    }
} -WarningMessage "Check min=1, max=3 manually"

Write-Host ""

# Section 5: HTTPS & Certificate
Write-Host "[5] HTTPS & Certificate" -ForegroundColor Yellow
Write-Host ""

Test-Check -Name "ACM Certificate exists" -TestScript {
    $certs = aws acm list-certificates --region $Region 2>$null | ConvertFrom-Json
    $certs.CertificateSummaryList.Count -gt 0
}

Test-Check -Name "ALB exists" -TestScript {
    $albs = aws elbv2 describe-load-balancers --region $Region 2>$null | ConvertFrom-Json
    $albs.LoadBalancers.Count -gt 0
}

if ($Domain) {
    Test-Warning -Name "HTTPS accessible: https://$Domain" -TestScript {
        try {
            $response = Invoke-WebRequest -Uri "https://$Domain" -UseBasicParsing -TimeoutSec 10 -ErrorAction Stop
            $response.StatusCode -eq 200 -or $response.StatusCode -eq 301 -or $response.StatusCode -eq 302
        } catch {
            $false
        }
    } -WarningMessage "Check manually in browser"
} else {
    Write-Host "  [!] Domain not provided - skipping HTTPS check" -ForegroundColor Yellow
    Write-Host "      Run with -Domain parameter to test" -ForegroundColor Gray
}

Write-Host ""

# Section 6: Infrastructure as Code
Write-Host "[6] Infrastructure as Code" -ForegroundColor Yellow
Write-Host ""

Test-Check -Name "Terraform directory exists" -TestScript {
    Test-Path "infrastructure\terraform"
}

Test-Check -Name "Terraform state exists" -TestScript {
    Test-Path "infrastructure\terraform\terraform.tfstate"
}

Test-Warning -Name "Terraform initialized" -TestScript {
    Test-Path "infrastructure\terraform\.terraform"
}

Write-Host ""

# Section 7: Demo Scripts
Write-Host "[7] Demo Scripts & Tools" -ForegroundColor Yellow
Write-Host ""

Test-Check -Name "Load test script exists" -TestScript {
    Test-Path "scripts\test-transcoding-autoscaling.js"
}

Test-Check -Name "Node.js installed" -TestScript {
    $null -ne (Get-Command node -ErrorAction SilentlyContinue)
}

Test-Warning -Name "OBS Studio installed" -TestScript {
    Test-Path "C:\Program Files\obs-studio\bin\64bit\obs64.exe"
} -WarningMessage "Not found - install OBS or use alternative"

Write-Host ""

# Section 8: Scheduled Tasks / Container Orchestration
Write-Host "[8] Container Orchestration" -ForegroundColor Yellow
Write-Host ""

Test-Warning -Name "EventBridge rules exist" -TestScript {
    $rules = aws events list-rules --region $Region 2>$null | ConvertFrom-Json
    $rules.Rules.Count -gt 0
} -WarningMessage "Check manually if using scheduled tasks"

Test-Warning -Name "ECS service discovery configured" -TestScript {
    $namespaces = aws servicediscovery list-namespaces --region $Region 2>$null | ConvertFrom-Json
    $namespaces.Namespaces.Count -gt 0
} -WarningMessage "Optional - check if using service discovery"

Write-Host ""

# Summary
Write-Host "===========================================================" -ForegroundColor Cyan
Write-Host "                      SUMMARY" -ForegroundColor Cyan
Write-Host "===========================================================" -ForegroundColor Cyan
Write-Host ""

Write-Host "  Passed:   " -NoNewline
Write-Host "$script:passCount" -ForegroundColor Green

Write-Host "  Failed:   " -NoNewline
Write-Host "$script:failCount" -ForegroundColor Red

Write-Host "  Warnings: " -NoNewline
Write-Host "$script:warnCount" -ForegroundColor Yellow

Write-Host ""

if ($script:failCount -eq 0) {
    Write-Host "✓ ALL CRITICAL CHECKS PASSED!" -ForegroundColor Green
    Write-Host ""
    Write-Host "You are ready to record your demo video!" -ForegroundColor Green
    Write-Host ""
    if ($script:warnCount -gt 0) {
        Write-Host "Note: You have $script:warnCount warnings. Review them if needed." -ForegroundColor Yellow
    }
} else {
    Write-Host "✗ $script:failCount CRITICAL ISSUES FOUND!" -ForegroundColor Red
    Write-Host ""
    Write-Host "Please fix the failed checks before recording demo." -ForegroundColor Red
    Write-Host ""
}

Write-Host "===========================================================" -ForegroundColor Cyan
Write-Host ""

# Next steps
Write-Host "NEXT STEPS:" -ForegroundColor Cyan
Write-Host "  1. Review VIDEO_DEMO_10MIN_GUIDE.md" -ForegroundColor White
Write-Host "  2. Print DEMO_CHECKLIST.md" -ForegroundColor White
Write-Host "  3. Open AWS Console tabs from DEMO_QUICK_REFERENCE.md" -ForegroundColor White
Write-Host "  4. Practice once before recording" -ForegroundColor White
Write-Host "  5. Record your demo!" -ForegroundColor White
Write-Host ""

Write-Host "Good luck! 🚀" -ForegroundColor Green

