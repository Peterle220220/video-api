# Log Cleanup Task

Weekly scheduled ECS Fargate task for CloudWatch logs management.

## Features

- Sets retention policies on log groups (30 days)
- Deletes empty log streams older than 7 days
- Removes very old log streams (>60 days)
- Calculates and reports storage savings
- Logs cleanup metrics to CloudWatch

## Schedule

Runs weekly via EventBridge rule: `rate(7 days)`

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
.\scripts\test-scheduled-tasks.ps1 -Task log-cleanup
```

## View Logs

```bash
aws logs tail /ecs/cab432-a3-log-cleanup --follow
```

## Environment Variables

- `AWS_REGION` - AWS region

