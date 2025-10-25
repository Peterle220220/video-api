# 🚀 Scheduled Tasks Quick Start

## Tóm tắt

Đã thiết lập **2 ECS Scheduled Tasks** để đáp ứng yêu cầu **Advanced Container Orchestration**:

### ✅ Maintenance Task (Daily)
- **Lịch**: Chạy mỗi ngày (rate: 1 day)
- **Chức năng**: 
  - Dọn dẹp temporary files trong S3
  - Cập nhật stale records trong DynamoDB
  - Kiểm tra ECS cluster health
  - Log metrics vào CloudWatch

### ✅ Log Cleanup Task (Weekly)
- **Lịch**: Chạy mỗi tuần (rate: 7 days)
- **Chức năng**:
  - Set retention policies cho log groups
  - Xóa empty/old log streams
  - Tiết kiệm storage costs
  - Báo cáo storage freed

## 📦 Cấu trúc Files

```
maintenance-task/
├── Dockerfile
├── package.json
├── src/
│   └── maintenance.js    # Script chính
└── README.md

log-cleanup-task/
├── Dockerfile
├── package.json
├── src/
│   └── cleanup.js        # Script chính
└── README.md

infrastructure/terraform/
├── scheduled_tasks.tf    # EventBridge + Task Definitions
├── variables.tf          # Updated với image URIs
└── terraform.tfvars      # Updated với image URIs

scripts/
├── deploy-scheduled-tasks.ps1       # Deploy scheduled tasks
├── test-scheduled-tasks.ps1         # Manual trigger cho demo
├── check-scheduled-tasks-status.ps1 # Kiểm tra status
└── deploy-all-services.ps1          # Updated với scheduled tasks
```

## 🚀 Cách Deploy

### Bước 1: Build và Deploy Docker Images

```powershell
# Từ thư mục gốc project
cd E:\video\video-api

# Deploy tất cả (bao gồm scheduled tasks)
.\scripts\deploy-all-services.ps1

# Hoặc chỉ deploy scheduled tasks
.\scripts\deploy-scheduled-tasks.ps1
```

### Bước 2: Verify Deployment

```powershell
# Kiểm tra status
.\scripts\check-scheduled-tasks-status.ps1
```

## 🧪 Test cho Video Demo

### Manual Trigger

```powershell
# Test cả 2 tasks
.\scripts\test-scheduled-tasks.ps1 -Task both

# Hoặc test từng task riêng
.\scripts\test-scheduled-tasks.ps1 -Task maintenance
.\scripts\test-scheduled-tasks.ps1 -Task log-cleanup
```

### View Logs

```bash
# View maintenance logs
aws logs tail /ecs/cab432-a3-maintenance --follow

# View log cleanup logs
aws logs tail /ecs/cab432-a3-log-cleanup --follow
```

## 🎥 Video Demo Script

### Scene 1: EventBridge Rules (30s)
```
1. Mở AWS Console → EventBridge → Rules
2. Show rule: n12122882-cab432-maintenance-schedule
   - Schedule: rate(1 day)
   - Target: ECS Task
3. Show rule: n12122882-cab432-log-cleanup
   - Schedule: rate(7 days)
   - Target: ECS Task
```

**Script nói**:
> "We have two EventBridge rules. The maintenance task runs daily, and the log cleanup task runs weekly. Both automatically trigger ECS Fargate tasks."

### Scene 2: Task Definitions (30s)
```
1. Mở ECS Console → Task Definitions
2. Show: n12122882-cab432-maintenance
   - Fargate launch type
   - Environment variables
3. Show: n12122882-cab432-log-cleanup
```

**Script nói**:
> "Both tasks are defined as Fargate tasks with their respective Docker images and environment configurations."

### Scene 3: Manual Trigger (1 min)
```
1. Mở PowerShell
2. Run: .\scripts\test-scheduled-tasks.ps1 -Task both
3. Show tasks starting
```

**Script nói**:
> "For the demo, I'll manually trigger both tasks. In production, these run automatically on their schedules."

### Scene 4: Monitor Execution (1 min)
```
1. Show ECS Console → Cluster → Tasks
2. Tasks chuyển từ PENDING → RUNNING → STOPPED
3. Show task details
```

**Script nói**:
> "Here we can see both tasks executing. They perform their operations and then terminate automatically."

### Scene 5: CloudWatch Logs (1.5 min)
```
1. Mở CloudWatch → Log Groups
2. Open /ecs/cab432-a3-maintenance
3. Show logs:
   - S3 cleanup operations
   - DynamoDB checks
   - Health monitoring
   - Metrics logging
4. Open /ecs/cab432-a3-log-cleanup
5. Show logs:
   - Log group discovery
   - Retention policy updates
   - Stream cleanup
   - Storage impact
```

**Script nói**:
> "The maintenance task cleans up temporary files, checks for stale records, and monitors cluster health. The log cleanup task manages our CloudWatch logs, setting retention policies and removing old streams to reduce costs."

### Scene 6: Metrics (30s)
```
1. CloudWatch → Metrics
2. Show custom namespaces:
   - CAB432/Maintenance
   - CAB432/LogCleanup
3. Show metric graphs
```

**Script nói**:
> "Both tasks publish custom metrics so we can track their operations over time."

## 📋 Assessment Criteria

**Advanced Container Orchestration (2 marks)** ✅

Đã implement:
1. ✅ **Tasks launched on a schedule** - 2 scheduled tasks via EventBridge
2. ✅ **Additional features**:
   - Fargate serverless execution
   - CloudWatch logging integration
   - Custom metrics
   - IAM role-based security
   - Automatic lifecycle management

## 🔗 Quick Links

**AWS Console**:
- EventBridge Rules: https://ap-southeast-2.console.aws.amazon.com/events/home?region=ap-southeast-2#/rules
- ECS Cluster: https://ap-southeast-2.console.aws.amazon.com/ecs/v2/clusters/n12122882-a3-cluster
- CloudWatch Logs: https://ap-southeast-2.console.aws.amazon.com/cloudwatch/home?region=ap-southeast-2#logsV2:log-groups

**Documentation**:
- Full Guide: `SCHEDULED_TASKS_GUIDE.md`
- Maintenance Task: `maintenance-task/README.md`
- Log Cleanup Task: `log-cleanup-task/README.md`

## 🐛 Troubleshooting

### Tasks không chạy?
```powershell
# Check EventBridge rules
aws events describe-rule --name n12122882-cab432-maintenance-schedule

# Check task definitions
aws ecs describe-task-definition --task-definition n12122882-cab432-maintenance
```

### Không thấy logs?
```powershell
# List log groups
aws logs describe-log-groups --log-group-name-prefix "/ecs/cab432-a3"

# View logs
aws logs tail /ecs/cab432-a3-maintenance --follow
```

## ✅ Checklist

Trước khi record video, verify:

- [ ] ECR repos tồn tại cho cả 2 tasks
- [ ] Docker images đã được push
- [ ] Task definitions đã updated
- [ ] EventBridge rules đang ENABLED
- [ ] CloudWatch log groups đã tạo
- [ ] IAM roles có đủ permissions
- [ ] Test script chạy thành công

---

**Tạo bởi**: Automated setup script
**Ngày**: 2024
**Course**: CAB432 Assignment 3

