# PowerShell script to fix DynamoDB permissions
Write-Host "🔧 Fixing DynamoDB permissions..." -ForegroundColor Green

# Check if AWS CLI is configured
try {
    $identity = aws sts get-caller-identity 2>$null
    if ($LASTEXITCODE -eq 0) {
        Write-Host "✅ AWS CLI configured" -ForegroundColor Green
        Write-Host "Current identity: $identity" -ForegroundColor Cyan
    } else {
        Write-Host "❌ AWS CLI not configured. Please run 'aws configure' first" -ForegroundColor Red
        exit 1
    }
} catch {
    Write-Host "❌ AWS CLI not found. Please install AWS CLI first" -ForegroundColor Red
    exit 1
}

# Check DynamoDB table access
Write-Host "🔍 Checking DynamoDB table access..." -ForegroundColor Cyan
try {
    $tableInfo = aws dynamodb describe-table --table-name cab432-a2-n12122882-metadata 2>$null
    if ($LASTEXITCODE -eq 0) {
        Write-Host "✅ DynamoDB table exists and is accessible" -ForegroundColor Green
    } else {
        Write-Host "❌ Cannot access DynamoDB table" -ForegroundColor Red
        Write-Host "This indicates a permissions issue" -ForegroundColor Yellow
    }
} catch {
    Write-Host "❌ Error checking DynamoDB table" -ForegroundColor Red
}

# Create DynamoDB policy
$policyContent = @"
{
    "Version": "2012-10-17",
    "Statement": [
        {
            "Effect": "Allow",
            "Action": [
                "dynamodb:Query",
                "dynamodb:GetItem",
                "dynamodb:PutItem",
                "dynamodb:UpdateItem",
                "dynamodb:DeleteItem",
                "dynamodb:Scan"
            ],
            "Resource": [
                "arn:aws:dynamodb:ap-southeast-2:901444280953:table/cab432-a2-n12122882-metadata",
                "arn:aws:dynamodb:ap-southeast-2:901444280953:table/cab432-a2-n12122882-metadata/index/*"
            ]
        }
    ]
}
"@

$policyContent | Out-File -FilePath "dynamodb-policy.json" -Encoding UTF8
Write-Host "📝 Created DynamoDB policy: dynamodb-policy.json" -ForegroundColor Green

Write-Host "`n🔧 Solutions:" -ForegroundColor Yellow
Write-Host "1. Use AWS Access Keys instead of SSO:" -ForegroundColor White
Write-Host "   - Create Access Keys in AWS Console" -ForegroundColor Gray
Write-Host "   - Set environment variables:" -ForegroundColor Gray
Write-Host "     `$env:AWS_ACCESS_KEY_ID = 'your_key'" -ForegroundColor Gray
Write-Host "     `$env:AWS_SECRET_ACCESS_KEY = 'your_secret'" -ForegroundColor Gray

Write-Host "`n2. Contact AWS administrator to attach the policy to your SSO role" -ForegroundColor White
Write-Host "   - Policy file: dynamodb-policy.json" -ForegroundColor Gray

Write-Host "`n3. Test the application:" -ForegroundColor White
Write-Host "   npm start" -ForegroundColor Gray
