# Maintenance Task

Daily scheduled ECS Fargate task for system maintenance operations.

## Features

- Cleans up temporary S3 files older than 7 days
- Updates stale DynamoDB records
- Checks ECS cluster health
- Logs custom CloudWatch metrics
- Verifies S3 bucket structure

## Schedule

Runs daily via EventBridge rule: `rate(1 day)`

## Build and Deploy

```powershell
# Deploy all services including scheduled tasks
.\scripts\deploy-all-services.ps1

# Or deploy scheduled tasks only
.\scripts\deploy-scheduled-tasks.ps1
```

## Test Manually

```powershell
# Run the task manually
.\scripts\test-scheduled-tasks.ps1 -Task maintenance
```

## View Logs

```bash
aws logs tail /ecs/cab432-a3-maintenance --follow
```

## Environment Variables

- `AWS_REGION` - AWS region
- `S3_BUCKET_NAME` - S3 bucket for cleanup
- `DYNAMODB_TABLE_NAME` - DynamoDB table for metadata
- `ECS_CLUSTER_NAME` - ECS cluster name

