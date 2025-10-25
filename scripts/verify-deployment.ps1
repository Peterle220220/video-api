# ========================================================================================================
# Script: Verify CloudFront and Custom Metric Deployment
# Purpose: Verify that CloudFront and Lambda are deployed correctly
# ========================================================================================================

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Deployment Verification" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

$ErrorActionPreference = "Continue"

# Check CloudFront Distribution
Write-Host "1. Checking CloudFront Distribution..." -ForegroundColor Yellow
$distributions = aws cloudfront list-distributions --query "DistributionList.Items[?Comment=='CloudFront distribution for cab432-a3 - caching ALB content']" | ConvertFrom-Json

if ($distributions -and $distributions.Count -gt 0) {
    $dist = $distributions[0]
    Write-Host "  ✓ CloudFront Distribution Found" -ForegroundColor Green
    Write-Host "    ID: $($dist.Id)" -ForegroundColor Gray
    Write-Host "    Domain: $($dist.DomainName)" -ForegroundColor Gray
    Write-Host "    Status: $($dist.Status)" -ForegroundColor Gray
    Write-Host "    Enabled: $($dist.Enabled)" -ForegroundColor Gray
    
    if ($dist.Status -eq "Deployed") {
        Write-Host "    ✓ Distribution is fully deployed" -ForegroundColor Green
    } else {
        Write-Host "    ⚠ Distribution status: $($dist.Status) (may take 10-15 minutes)" -ForegroundColor Yellow
    }
} else {
    Write-Host "  ✗ CloudFront Distribution not found" -ForegroundColor Red
}

Write-Host ""

# Check Lambda Function
Write-Host "2. Checking Lambda Function..." -ForegroundColor Yellow
$lambdaName = "n12122882-custom-scaling-metric"
$lambda = aws lambda get-function --function-name $lambdaName 2>$null | ConvertFrom-Json

if ($lambda) {
    Write-Host "  ✓ Lambda Function Found" -ForegroundColor Green
    Write-Host "    Name: $($lambda.Configuration.FunctionName)" -ForegroundColor Gray
    Write-Host "    Runtime: $($lambda.Configuration.Runtime)" -ForegroundColor Gray
    Write-Host "    Status: $($lambda.Configuration.State)" -ForegroundColor Gray
    Write-Host "    Last Modified: $($lambda.Configuration.LastModified)" -ForegroundColor Gray
} else {
    Write-Host "  ✗ Lambda Function not found" -ForegroundColor Red
}

Write-Host ""

# Check EventBridge Rule
Write-Host "3. Checking EventBridge Rule..." -ForegroundColor Yellow
$ruleName = "n12122882-custom-metric-schedule"
$rule = aws events describe-rule --name $ruleName 2>$null | ConvertFrom-Json

if ($rule) {
    Write-Host "  ✓ EventBridge Rule Found" -ForegroundColor Green
    Write-Host "    Name: $($rule.Name)" -ForegroundColor Gray
    Write-Host "    Schedule: $($rule.ScheduleExpression)" -ForegroundColor Gray
    Write-Host "    State: $($rule.State)" -ForegroundColor Gray
} else {
    Write-Host "  ✗ EventBridge Rule not found" -ForegroundColor Red
}

Write-Host ""

# Check Auto Scaling Policies
Write-Host "4. Checking Auto Scaling Policies..." -ForegroundColor Yellow
$policies = aws application-autoscaling describe-scaling-policies --service-namespace ecs --query "ScalingPolicies[?contains(ResourceId, 'n12122882-cab432-a3-transcoding-service')]" | ConvertFrom-Json

if ($policies) {
    Write-Host "  ✓ Found $($policies.Count) scaling policies" -ForegroundColor Green
    foreach ($policy in $policies) {
        Write-Host "    - $($policy.PolicyName)" -ForegroundColor Gray
        if ($policy.TargetTrackingScalingPolicyConfiguration.CustomizedMetricSpecification) {
            $metric = $policy.TargetTrackingScalingPolicyConfiguration.CustomizedMetricSpecification
            Write-Host "      Type: Custom Metric" -ForegroundColor Cyan
            Write-Host "      Metric: $($metric.MetricName)" -ForegroundColor Cyan
            Write-Host "      Namespace: $($metric.Namespace)" -ForegroundColor Cyan
            Write-Host "      Target: $($policy.TargetTrackingScalingPolicyConfiguration.TargetValue)" -ForegroundColor Cyan
        } else {
            Write-Host "      Type: CPU-based" -ForegroundColor Gray
        }
    }
} else {
    Write-Host "  ✗ No scaling policies found" -ForegroundColor Red
}

Write-Host ""

# Test Lambda Invocation
Write-Host "5. Testing Lambda Function..." -ForegroundColor Yellow
Write-Host "  Invoking Lambda manually..." -ForegroundColor Gray
$invokeResult = aws lambda invoke --function-name $lambdaName --payload '{}' lambda-response.json 2>&1

if ($LASTEXITCODE -eq 0) {
    Write-Host "  ✓ Lambda invoked successfully" -ForegroundColor Green
    
    if (Test-Path lambda-response.json) {
        $response = Get-Content lambda-response.json | ConvertFrom-Json
        Write-Host "    Response:" -ForegroundColor Gray
        Write-Host "      $($response | ConvertTo-Json -Compress)" -ForegroundColor Gray
        Remove-Item lambda-response.json
    }
} else {
    Write-Host "  ✗ Lambda invocation failed" -ForegroundColor Red
}

Write-Host ""

# Check CloudWatch Metrics
Write-Host "6. Checking CloudWatch Custom Metrics..." -ForegroundColor Yellow
Start-Sleep -Seconds 5
$metrics = aws cloudwatch list-metrics --namespace "CAB432/CustomMetrics" | ConvertFrom-Json

if ($metrics.Metrics) {
    Write-Host "  ✓ Found $($metrics.Metrics.Count) custom metrics" -ForegroundColor Green
    foreach ($metric in $metrics.Metrics) {
        Write-Host "    - $($metric.MetricName)" -ForegroundColor Gray
    }
} else {
    Write-Host "  ⚠ No custom metrics found yet (Lambda may not have run)" -ForegroundColor Yellow
    Write-Host "    Wait 1-2 minutes and check again" -ForegroundColor Gray
}

Write-Host ""
Write-Host "========================================" -ForegroundColor Green
Write-Host "Verification Complete" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Green
Write-Host ""

Write-Host "Next Steps:" -ForegroundColor Cyan
Write-Host "1. Test CloudFront: Access your app via CloudFront domain" -ForegroundColor White
Write-Host "2. Test Custom Scaling: .\scripts\test-custom-scaling.ps1" -ForegroundColor White
Write-Host "3. View Lambda logs: aws logs tail /aws/lambda/$lambdaName --follow" -ForegroundColor White
Write-Host ""

