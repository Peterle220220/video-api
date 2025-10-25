# 📅 ECS Scheduled Tasks Guide

## Overview

This guide documents the implementation of **ECS Scheduled Tasks** as part of the **Advanced Container Orchestration** requirement for CAB432 Assignment 3.

The system includes two scheduled tasks that run automatically via EventBridge:
1. **Maintenance Task** - Runs daily
2. **Log Cleanup Task** - Runs weekly

## Architecture

### EventBridge + ECS Integration

```
EventBridge Rule (Cron/Rate)
    ↓
ECS Fargate Task (Scheduled)
    ↓
CloudWatch Logs
```

### Task Schedule

| Task | Frequency | Schedule Expression | Purpose |
|------|-----------|---------------------|---------|
| Maintenance | Daily | `rate(1 day)` | System maintenance & cleanup |
| Log Cleanup | Weekly | `rate(7 days)` | CloudWatch logs cleanup |

## 🔧 Maintenance Task

### Purpose
Runs daily automated maintenance operations to keep the system healthy and efficient.

### Operations Performed

1. **S3 Cleanup**
   - Removes temporary files older than 7 days
   - Cleans up orphaned uploads
   - Verifies bucket structure

2. **DynamoDB Maintenance**
   - Identifies stale "processing" records (>1 hour old)
   - Updates stale records to "error" status
   - Prevents stuck processing states

3. **ECS Health Check**
   - Reports cluster status
   - Monitors running/pending tasks
   - Tracks active services

4. **Metrics Logging**
   - Logs custom CloudWatch metrics
   - Tracks maintenance operations
   - Provides operational visibility

5. **System Verification**
   - Verifies S3 bucket folder structure
   - Ensures required directories exist
   - Creates missing folders if needed

### Configuration

**Task Definition**: `n12122882-cab432-maintenance`

**Resources**:
- CPU: 256 (0.25 vCPU)
- Memory: 512 MB
- Launch Type: FARGATE

**Environment Variables**:
```bash
AWS_REGION=ap-southeast-2
S3_BUCKET_NAME=cab432-a2-n12122882
DYNAMODB_TABLE_NAME=cab432-a2-n12122882-metadata
ECS_CLUSTER_NAME=n12122882-a3-cluster
```

**CloudWatch Log Group**: `/ecs/cab432-a3-maintenance`

### EventBridge Rule

**Name**: `n12122882-cab432-maintenance-schedule`
**Schedule**: `rate(1 day)` (runs every 24 hours)
**Target**: ECS Task on Fargate

## 🧹 Log Cleanup Task

### Purpose
Runs weekly to manage CloudWatch logs and reduce storage costs.

### Operations Performed

1. **Log Group Discovery**
   - Identifies all ECS-related log groups
   - Filters CAB432 project logs
   - Lists log groups requiring cleanup

2. **Retention Policy Management**
   - Sets 30-day retention on log groups
   - Updates groups without retention policies
   - Ensures consistent retention across logs

3. **Log Stream Cleanup**
   - Removes empty log streams older than 7 days
   - Deletes very old streams (>60 days)
   - Processes streams in batches to avoid rate limits

4. **Storage Analysis**
   - Calculates total log storage
   - Estimates storage freed
   - Reports impact in human-readable format

5. **Metrics Logging**
   - Tracks cleanup operations
   - Reports streams deleted
   - Logs storage savings

### Configuration

**Task Definition**: `n12122882-cab432-log-cleanup`

**Resources**:
- CPU: 256 (0.25 vCPU)
- Memory: 512 MB
- Launch Type: FARGATE

**Environment Variables**:
```bash
AWS_REGION=ap-southeast-2
```

**CloudWatch Log Group**: `/ecs/cab432-a3-log-cleanup`

### EventBridge Rule

**Name**: `n12122882-cab432-log-cleanup`
**Schedule**: `rate(7 days)` (runs every 7 days)
**Target**: ECS Task on Fargate

## 🚀 Deployment

### Prerequisites

1. AWS CLI configured with appropriate credentials
2. Docker installed and running
3. ECR repositories created
4. Terraform initialized

### Step 1: Build and Deploy Docker Images

```powershell
# Navigate to project root
cd E:\video\video-api

# Run deployment script
.\scripts\deploy-scheduled-tasks.ps1
```

This script:
- Logs into ECR
- Builds Docker images for both tasks
- Pushes images to ECR
- Updates ECS task definitions via Terraform

### Step 2: Verify EventBridge Rules

```bash
# List EventBridge rules
aws events list-rules --name-prefix "n12122882-cab432"

# Describe maintenance rule
aws events describe-rule --name n12122882-cab432-maintenance-schedule

# Describe log cleanup rule
aws events describe-rule --name n12122882-cab432-log-cleanup
```

### Step 3: Check ECS Task Definitions

```bash
# List task definitions
aws ecs list-task-definitions --family-prefix n12122882-cab432

# Describe maintenance task
aws ecs describe-task-definition --task-definition n12122882-cab432-maintenance

# Describe log cleanup task
aws ecs describe-task-definition --task-definition n12122882-cab432-log-cleanup
```

## 🧪 Testing

### Manual Task Execution

Run scheduled tasks manually for testing:

```powershell
# Test both tasks
.\scripts\test-scheduled-tasks.ps1 -Task both

# Test maintenance task only
.\scripts\test-scheduled-tasks.ps1 -Task maintenance

# Test log cleanup task only
.\scripts\test-scheduled-tasks.ps1 -Task log-cleanup
```

### View Task Logs

```bash
# View maintenance logs
aws logs tail /ecs/cab432-a3-maintenance --follow

# View log cleanup logs
aws logs tail /ecs/cab432-a3-log-cleanup --follow
```

### Check Task Status

```bash
# List running tasks
aws ecs list-tasks --cluster n12122882-a3-cluster --desired-status RUNNING

# Describe specific task
aws ecs describe-tasks --cluster n12122882-a3-cluster --tasks <task-arn>
```

## 📊 Monitoring

### CloudWatch Metrics

Both tasks publish custom metrics to CloudWatch:

**Maintenance Task Metrics** (Namespace: `CAB432/Maintenance`):
- `MaintenanceTaskRun` - Count of executions
- Custom metrics for cleanup operations

**Log Cleanup Task Metrics** (Namespace: `CAB432/LogCleanup`):
- `LogCleanupTaskRun` - Count of executions
- `LogStreamsDeleted` - Number of streams deleted
- `LogGroupsProcessed` - Number of log groups processed
- `StorageFreed` - Bytes of storage freed

### View Metrics

```bash
# List available metrics
aws cloudwatch list-metrics --namespace CAB432/Maintenance
aws cloudwatch list-metrics --namespace CAB432/LogCleanup

# Get metric statistics
aws cloudwatch get-metric-statistics \
  --namespace CAB432/Maintenance \
  --metric-name MaintenanceTaskRun \
  --start-time 2024-01-01T00:00:00Z \
  --end-time 2024-12-31T23:59:59Z \
  --period 86400 \
  --statistics Sum
```

## 🎥 Demo Video Script

### Scene 1: EventBridge Rules

**Show**: AWS EventBridge Console
- Navigate to Rules
- Show `n12122882-cab432-maintenance-schedule`
- Highlight schedule expression: `rate(1 day)`
- Show target: ECS Task

**Script**:
> "First, let me show you the scheduled tasks. We have two EventBridge rules set up. The maintenance task runs daily using a rate expression of 1 day."

### Scene 2: Task Definitions

**Show**: ECS Console → Task Definitions
- Show `n12122882-cab432-maintenance`
- Show `n12122882-cab432-log-cleanup`
- Highlight Fargate launch type
- Show environment variables

**Script**:
> "Both tasks are defined as ECS Fargate tasks. The maintenance task has access to S3, DynamoDB, and ECS APIs through IAM roles. The log cleanup task focuses on CloudWatch Logs management."

### Scene 3: Manual Trigger

**Show**: PowerShell terminal

```powershell
.\scripts\test-scheduled-tasks.ps1 -Task both
```

**Script**:
> "For the demo, I'll manually trigger both tasks using our test script. In production, these run automatically on their schedules."

### Scene 4: Task Execution

**Show**: ECS Console → Cluster → Tasks
- Show tasks transitioning from PENDING to RUNNING
- Highlight task details
- Show network configuration

**Script**:
> "Here we can see both tasks starting up. They're running on Fargate in our VPC with public IP assignment for AWS API access."

### Scene 5: CloudWatch Logs

**Show**: CloudWatch Logs Console
- Open `/ecs/cab432-a3-maintenance`
- Show live log stream
- Highlight key operations:
  - S3 cleanup
  - DynamoDB maintenance
  - Health checks
  - Metrics logging

**Script**:
> "The maintenance task is performing several operations: cleaning up temporary S3 files, checking for stale DynamoDB records, verifying cluster health, and logging metrics to CloudWatch."

### Scene 6: Log Cleanup Output

**Show**: CloudWatch Logs for log cleanup task
- Show log group discovery
- Show retention policy updates
- Show stream cleanup operations
- Show storage impact calculation

**Script**:
> "The log cleanup task discovers all ECS log groups, sets retention policies, removes old log streams, and reports the storage impact."

### Scene 7: Custom Metrics

**Show**: CloudWatch Metrics Console
- Navigate to Custom Namespaces
- Show `CAB432/Maintenance`
- Show `CAB432/LogCleanup`
- Display metric graphs

**Script**:
> "Both tasks publish custom metrics to CloudWatch for monitoring. We can track execution counts, cleanup operations, and storage savings over time."

## 🏆 Advanced Container Orchestration Features

This implementation demonstrates three advanced ECS features:

### 1. ✅ Scheduled Tasks (EventBridge Integration)
- Tasks launched automatically on schedule
- Integration with EventBridge for event-driven architecture
- Cron and rate-based scheduling

### 2. ✅ Task Lifecycle Management
- Fargate launch type for serverless execution
- Automatic task termination after completion
- CloudWatch Logs integration for observability

### 3. ✅ IAM Role Integration
- Task execution role for ECR and CloudWatch access
- Task role for AWS service access (S3, DynamoDB, ECS, CloudWatch)
- Least-privilege permissions

## 📝 Terraform Resources

Key Terraform resources defined:

```hcl
# EventBridge Rules
aws_cloudwatch_event_rule.maintenance_schedule
aws_cloudwatch_event_rule.log_cleanup_schedule

# EventBridge Targets
aws_cloudwatch_event_target.ecs_scheduled_task
aws_cloudwatch_event_target.log_cleanup_task

# ECS Task Definitions
aws_ecs_task_definition.maintenance
aws_ecs_task_definition.log_cleanup

# CloudWatch Log Groups
aws_cloudwatch_log_group.maintenance
aws_cloudwatch_log_group.log_cleanup
```

## 🔍 Troubleshooting

### Task Not Starting

**Check**:
1. EventBridge rule is enabled
2. IAM role has necessary permissions
3. Task definition is active (latest revision)
4. Network configuration is correct

**Command**:
```bash
aws events describe-rule --name n12122882-cab432-maintenance-schedule
```

### Task Fails to Complete

**Check**:
1. CloudWatch logs for error messages
2. IAM permissions for AWS services
3. Network connectivity (security groups)
4. Resource availability (CPU/memory)

**Command**:
```bash
aws logs tail /ecs/cab432-a3-maintenance --since 1h
```

### No Logs Appearing

**Check**:
1. CloudWatch log group exists
2. Task has awslogs log driver configured
3. Execution role has CloudWatch Logs permissions

**Command**:
```bash
aws logs describe-log-groups --log-group-name-prefix "/ecs/cab432-a3"
```

## 📚 Additional Resources

- [ECS Scheduled Tasks Documentation](https://docs.aws.amazon.com/AmazonECS/latest/developerguide/scheduled_tasks.html)
- [EventBridge Schedule Expressions](https://docs.aws.amazon.com/eventbridge/latest/userguide/eb-create-rule-schedule.html)
- [ECS Task IAM Roles](https://docs.aws.amazon.com/AmazonECS/latest/developerguide/task-iam-roles.html)

## 🎯 Assessment Criteria Mapping

**Advanced Container Orchestration (2 marks)**

This implementation provides:

1. ✅ **Tasks launched in response to events or on a schedule**
   - Maintenance task: Daily schedule via EventBridge
   - Log cleanup task: Weekly schedule via EventBridge
   
2. ✅ **Additional orchestration features**:
   - Fargate serverless execution
   - CloudWatch integration for logging and metrics
   - IAM role-based security
   - Automatic task lifecycle management

---

**Created**: 2024
**Author**: n12122882
**Course**: CAB432 - Cloud Computing

