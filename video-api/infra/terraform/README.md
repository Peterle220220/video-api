# Terraform IaC for Video API (A2)

This folder provisions AWS services used by the app (excluding EC2/Docker as per brief):
- S3 bucket for uploads/processed/meta
- DynamoDB single-table for videos/jobs
- Cognito User Pool + Admin group + App Client (secret)

## Prerequisites
- Terraform >= 1.5
- AWS CLI configured (aws configure) with access to your account

## Quick start
```bash
cd video-api/infra/terraform
terraform init
terraform validate
terraform plan -out tfplan
terraform apply -auto-approve tfplan
```

If resources already exist (common in class env), import them before apply:
```powershell
# Import existing S3 bucket
terraform import aws_s3_bucket.videos cab432-a2-n12122882

# Import existing DynamoDB table
terraform import aws_dynamodb_table.main cab432-a2-n12122882-metadata
```

If SSM parameters already exist or are empty, we configured overwrite=true and a non-empty default value for `aai_base` so apply will succeed.

If you don't have permission to import DynamoDB (AccessDenied on DescribeContinuousBackups), set `manage_ddb=false` to let Terraform skip managing the table and only read it:
```powershell
# Create a tfvars with manage_ddb=false
Set-Content -Path .\local.tfvars -Value "manage_ddb=false"

# Then plan/apply with the override
terraform plan -var-file=local.tfvars -out tfplan
terraform apply -auto-approve tfplan
```

## Useful variables
You can override via CLI or terraform.tfvars:
- aws_region (default ap-southeast-2)
- s3_bucket_name (default cab432-a2-n12122882)
- ddb_table_name (default cab432-a2-n12122882-metadata)
- cognito_user_pool_name, cognito_app_client_name

## Outputs -> App env
After apply, export envs for the app:
```bash
terraform output -json > outputs.json
```
On Windows PowerShell use the provided script:
```powershell
./export-env.ps1
```
This writes .env.iac one level up (project root).

## Destroy
```bash
terraform destroy -auto-approve
```

## Notes
- S3 CORS allows all origins for simplicity (demo). Tighten in prod.
- DynamoDB is on-demand billing; keys: qut-username (PK), sk (SK).
- Cognito enables optional TOTP; Admin group created for RBAC.
