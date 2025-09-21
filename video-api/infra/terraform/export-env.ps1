# Export Terraform outputs to ../.env.iac for the app
param(
    [string]$OutputPath = "..\\..\\.env.iac"
)

$ErrorActionPreference = "Stop"

Write-Host "Reading terraform outputs..."
$json = terraform output -json | ConvertFrom-Json

$kv = @{}
$kv["AWS_REGION"] = $json.aws_region.value
$kv["S3_BUCKET"] = $json.s3_bucket_name.value
$kv["DDB_TABLE"] = $json.ddb_table_name.value
$kv["COGNITO_USER_POOL_ID"] = $json.cognito_user_pool_id.value
$kv["COGNITO_CLIENT_ID"] = $json.cognito_app_client_id.value
$kv["COGNITO_CLIENT_SECRET"] = $json.cognito_app_client_secret.value
$kv["COGNITO_JWKS_URI"] = $json.cognito_jwks_uri.value

$content = ($kv.GetEnumerator() | ForEach-Object { "{0}={1}" -f $_.Key, $_.Value }) -join "`n"

$fullPath = Resolve-Path -Path $OutputPath -ErrorAction SilentlyContinue
if (-not $fullPath) {
    $dir = Split-Path -Path $OutputPath
    if (-not (Test-Path $dir)) { New-Item -ItemType Directory -Path $dir | Out-Null }
    $fullPath = $OutputPath
}

Set-Content -Path $fullPath -Value $content -Encoding UTF8
Write-Host "Wrote env file to $fullPath"
