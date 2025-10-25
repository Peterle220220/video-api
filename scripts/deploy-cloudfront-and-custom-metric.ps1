# ========================================================================================================
# Script: Deploy CloudFront and Custom Scaling Metric
# Purpose: Build Lambda function and deploy CloudFront + Custom Metric infrastructure
# ========================================================================================================

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "CloudFront & Custom Metric Deployment" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

$ErrorActionPreference = "Stop"

# Navigate to terraform directory
$TerraformDir = "E:\video\video-api\infrastructure\terraform"
$LambdaDir = "$TerraformDir\lambda_custom_metric"

Write-Host "Step 1: Installing Lambda dependencies..." -ForegroundColor Yellow
if (Test-Path $LambdaDir) {
    Push-Location $LambdaDir
    
    Write-Host "  - Running npm install..." -ForegroundColor Gray
    npm install --production
    
    if ($LASTEXITCODE -ne 0) {
        Write-Host "✗ Failed to install npm packages" -ForegroundColor Red
        Pop-Location
        exit 1
    }
    
    Write-Host "  ✓ Lambda dependencies installed" -ForegroundColor Green
    Pop-Location
} else {
    Write-Host "✗ Lambda directory not found: $LambdaDir" -ForegroundColor Red
    exit 1
}

Write-Host ""
Write-Host "Step 2: Initializing Terraform..." -ForegroundColor Yellow
Push-Location $TerraformDir

terraform init -upgrade
if ($LASTEXITCODE -ne 0) {
    Write-Host "✗ Terraform init failed" -ForegroundColor Red
    Pop-Location
    exit 1
}

Write-Host "  ✓ Terraform initialized" -ForegroundColor Green
Write-Host ""

Write-Host "Step 3: Planning Terraform changes..." -ForegroundColor Yellow
terraform plan -out=tfplan
if ($LASTEXITCODE -ne 0) {
    Write-Host "✗ Terraform plan failed" -ForegroundColor Red
    Pop-Location
    exit 1
}

Write-Host "  ✓ Terraform plan created" -ForegroundColor Green
Write-Host ""

Write-Host "Step 4: Applying Terraform changes..." -ForegroundColor Yellow
Write-Host "  This will create:" -ForegroundColor Gray
Write-Host "    - CloudFront distribution (takes 10-15 minutes)" -ForegroundColor Gray
Write-Host "    - Lambda function for custom metrics" -ForegroundColor Gray
Write-Host "    - EventBridge rule (triggers Lambda every minute)" -ForegroundColor Gray
Write-Host "    - Custom scaling policy using MessagesPerTask metric" -ForegroundColor Gray
Write-Host ""

$confirmation = Read-Host "  Continue with deployment? (yes/no)"
if ($confirmation -ne "yes") {
    Write-Host "  Deployment cancelled" -ForegroundColor Yellow
    Pop-Location
    exit 0
}

terraform apply tfplan
if ($LASTEXITCODE -ne 0) {
    Write-Host "✗ Terraform apply failed" -ForegroundColor Red
    Pop-Location
    exit 1
}

Write-Host "  ✓ Terraform applied successfully" -ForegroundColor Green
Pop-Location

Write-Host ""
Write-Host "========================================" -ForegroundColor Green
Write-Host "✓ Deployment Completed Successfully!" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Green
Write-Host ""

Write-Host "Next steps:" -ForegroundColor Cyan
Write-Host "1. Wait 10-15 minutes for CloudFront distribution to deploy" -ForegroundColor White
Write-Host "2. Run: .\scripts\verify-deployment.ps1" -ForegroundColor White
Write-Host "3. Test custom scaling: .\scripts\test-custom-scaling.ps1" -ForegroundColor White
Write-Host ""

# Get outputs
Write-Host "Getting deployment information..." -ForegroundColor Yellow
Push-Location $TerraformDir
Write-Host ""
terraform output
Pop-Location

