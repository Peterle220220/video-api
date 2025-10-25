# 🎥 HƯỚNG DẪN DEMO HOÀN CHỈNH - 24/24 MARKS

## 📋 Tổng Quan

Demo này sẽ chứng minh tất cả 24 marks:
- **Core Criteria (18 marks)**: Load balancer, Auto scaling, Event queue, Scheduled tasks, Logging
- **Additional Criteria (6 marks)**: Edge caching (CloudFront), Custom scaling metric (SQS queue depth)

---

## 🚀 PHẦN 1: CHUẨN BỊ VÀ DEPLOYMENT

### 1.1. Deploy CloudFront và Custom Metric Lambda

```powershell
# Chạy script deployment
cd E:\video\video-api
.\scripts\deploy-cloudfront-and-custom-metric.ps1
```

**Giải thích cho video:**
- Script này sẽ deploy Lambda function publish custom CloudWatch metrics
- Lambda chạy mỗi phút (via EventBridge) để tính `MessagesPerTask` = SQS Queue Depth / Running Tasks
- CloudFront distribution sẽ cache static assets tại edge locations (10-15 phút để deploy)

### 1.2. Verify Deployment

```powershell
.\scripts\verify-deployment.ps1
```

Kiểm tra:
- ✓ CloudFront distribution status: `Deployed`
- ✓ Lambda function: `n12122882-custom-scaling-metric`
- ✓ Custom metric đang được publish
- ✓ All ECS services running

---

## 🎬 PHẦN 2: DEMO CHO VIDEO (15-20 PHÚT)

### DEMO 1: Edge Caching với CloudFront (3 phút) 🌍

**Mục tiêu:** Chứng minh CloudFront cache static assets tại edge locations

```powershell
# 1. Lấy CloudFront URL
cd infrastructure/terraform
terraform output cloudfront_distribution_domain
# Output: d2sbwlm68f4i9p.cloudfront.net

# 2. Test request qua CloudFront
$cloudfrontUrl = "https://d2sbwlm68f4i9p.cloudfront.net"
Measure-Command { Invoke-WebRequest -Uri "$cloudfrontUrl/static/logo.png" }

# 3. So sánh với direct ALB request
$albUrl = "https://n12122882.cab432.com"
Measure-Command { Invoke-WebRequest -Uri "$albUrl/static/logo.png" }

# 4. Check CloudFront cache hit
Invoke-WebRequest -Uri "$cloudfrontUrl/static/logo.png" -Method Head | Select-Object -ExpandProperty Headers
# Tìm header: X-Cache: Hit from cloudfront
```

**Giải thích trong video:**
- Request đầu tiên: `X-Cache: Miss from cloudfront` (đi xuống origin - ALB)
- Request thứ 2+: `X-Cache: Hit from cloudfront` (served from edge, fast!)
- Static assets được cache 1 ngày (86400s)
- API responses không cache (default_ttl = 0)

**Show trong AWS Console:**
- CloudFront → Distributions → Show cache behaviors
- Point out: `/static/*` có TTL 86400s
- Point out: `/api/*` có TTL 0s (không cache)

---

### DEMO 2: Custom Scaling Metric - Phần Quan Trọng Nhất! (7 phút) 📊

**Mục tiêu:** Chứng minh auto scaling dựa trên custom metric (MessagesPerTask)

#### 2.1. Xem Lambda Function hoạt động

```powershell
# 1. Mở Lambda logs
aws logs tail /aws/lambda/n12122882-custom-scaling-metric --follow
```

**Show trong AWS Console:**
- Lambda → Functions → `n12122882-custom-scaling-metric`
- Show environment variables (TRANSCODING_QUEUE_URL, ECS_CLUSTER_NAME, etc.)
- Show code: Calculation logic `messagesPerTask = queueDepth / runningTasks`
- EventBridge → Rules → Show schedule `rate(1 minute)`

#### 2.2. Xem Custom Metric trong CloudWatch

**Show trong AWS Console:**
- CloudWatch → All Metrics → Custom Namespaces → `CAB432/CustomMetrics`
- Show 3 metrics:
  - `MessagesPerTask` - Đây là metric dùng cho scaling!
  - `QueueDepth` - Total messages in queue
  - `RunningTaskCount` - Current running tasks

#### 2.3. Chạy Test Auto Scaling

```powershell
# Chạy test script (sẽ send 15 messages vào queue)
.\scripts\test-custom-scaling.ps1 -MessageCount 15 -DurationMinutes 10
```

**Timeline trong video:**

**T+0 (Ban đầu):**
```
Current state:
  - Queue depth: 0 messages
  - Running tasks: 1
  - MessagesPerTask: 0
```

**T+1 (Send messages):**
```
Sending 15 messages to queue...
  ✓ Sent message 1/15
  ✓ Sent message 2/15
  ...
  ✓ All messages sent

Current state:
  - Queue depth: 15 messages
  - Running tasks: 1
  - MessagesPerTask: 15 (15/1 = 15)
```

**T+2 (Lambda detects và publish metric):**
```
Lambda log:
  Queue depth: 15 messages
  Running tasks: 1
  Messages per task: 15
  Published metric: MessagesPerTask = 15
```

**T+3 (Auto Scaling triggers):**
```
Scaling policy triggered!
  - Target: 5 messages per task
  - Current: 15 messages per task
  - Action: Scale OUT
  - New desired count: 3 tasks (15/5 = 3)

[10:30:00] Tasks: 1/3 | Queue: 15 messages
  ↗ Scaling out to 3 tasks!
```

**T+5-7 (Tasks start và process messages):**
```
[10:32:00] Tasks: 2/3 | Queue: 10 messages
[10:34:00] Tasks: 3/3 | Queue: 5 messages
  ✓ Successfully scaled to 3 tasks!
```

**T+8-10 (Queue depleted, scale in):**
```
[10:36:00] Tasks: 3/3 | Queue: 0 messages
[10:39:00] Tasks: 1/3 | Queue: 0 messages
  ↘ Scaling back down to 1 task!
  ✓ Test completed successfully!
```

**Show trong AWS Console (parallel với script):**
1. **ECS Console:**
   - Services → transcoding-service
   - Watch "Desired tasks" change from 1 → 3 → 1
   - Tasks tab: See new tasks starting

2. **CloudWatch Metrics:**
   - Graph showing `MessagesPerTask` spike from 0 → 15 → 5 → 0
   - Graph showing `RunningTaskCount` change from 1 → 3 → 1
   - **Point out:** Threshold line at 5.0 (target value)

3. **CloudWatch Alarms:**
   - Auto Scaling alarms in "In alarm" state khi scaling

4. **SQS Queue:**
   - Show messages being processed (15 → 10 → 5 → 0)

#### 2.4. Giải thích Scaling Logic

**Show trong Terraform code:**

```hcl
# autoscaling.tf lines 76-110
resource "aws_appautoscaling_policy" "transcoding_custom_metric_policy" {
  customized_metric_specification {
    metric_name = "MessagesPerTask"        # ← Custom metric
    namespace   = "CAB432/CustomMetrics"   # ← Our namespace
    statistic   = "Average"
  }
  
  target_value = 5.0  # ← Target: 5 messages per task
  
  # Fast response
  scale_in_cooldown  = 180 # 3 minutes
  scale_out_cooldown = 60  # 1 minute
}
```

**Giải thích cho marker:**
- ✅ **Custom metric**: `MessagesPerTask` (not standard CPU/Memory)
- ✅ **Published by Lambda**: Runs every minute via EventBridge
- ✅ **Dynamic calculation**: Adapts to queue depth AND running tasks
- ✅ **Better than CPU-based**: Proactive (scales BEFORE CPU spikes)
- ✅ **Smart scaling**: 
  - 15 messages + 1 task = 15 msg/task → Scale to 3 tasks
  - 0 messages = Scale down to 1 task

---

### DEMO 3: Load Balancer với Health Checks (2 phút) 🔄

```powershell
# 1. Xem ALB targets
aws elbv2 describe-target-health `
  --target-group-arn $(terraform output -raw transcoding_target_group_arn)

# 2. Xem health check configuration
```

**Show trong AWS Console:**
- EC2 → Target Groups → transcoding-tg
- Show healthy targets (3/3 during scale-out)
- Show health check: `/health` endpoint, 30s interval

**Giải thích:**
- ALB distributes traffic across healthy tasks only
- Automatic health checks ensure high availability
- Unhealthy tasks replaced automatically

---

### DEMO 4: Event Queue (SQS) và DLQ (3 phút) 📬

```powershell
# 1. Xem queues
aws sqs list-queues

# 2. Test DLQ functionality
.\scripts\test-dlq-fast.js

# 3. Xem DLQ messages
aws sqs receive-message `
  --queue-url https://sqs.ap-southeast-2.amazonaws.com/901444280953/transcoding-queue-dlq `
  --max-number-of-messages 10
```

**Show trong AWS Console:**
- SQS → Queues → Show both queues:
  - `transcoding-queue` (main)
  - `transcoding-queue-dlq` (dead letter)
- Point out redrive policy: 3 attempts

**Giải thích:**
- Messages retry 3 times before going to DLQ
- DLQ prevents message loss
- Can replay DLQ messages later

---

### DEMO 5: Scheduled Tasks (2 phút) ⏰

```powershell
# 1. Xem scheduled tasks status
.\scripts\check-scheduled-tasks-status.ps1

# 2. Run maintenance task manually (demo)
aws ecs run-task `
  --cluster n12122882-a3-cluster `
  --task-definition maintenance-task `
  --launch-type FARGATE `
  --network-configuration "awsvpcConfiguration={subnets=[subnet-xxx],securityGroups=[sg-xxx],assignPublicIp=ENABLED}"
```

**Show trong AWS Console:**
- ECS → Scheduled Tasks
- Show 2 tasks:
  - `maintenance-daily` - Runs every day at 2 AM
  - `log-cleanup-weekly` - Runs every Sunday at 3 AM
- EventBridge → Rules → Show schedules

**Giải thích:**
- Automated maintenance without manual intervention
- Runs on schedule via EventBridge
- Uses Fargate (serverless, no EC2 management)

---

### DEMO 6: Logging và Monitoring (2 phút) 📝

```powershell
# 1. Xem logs của custom metric Lambda
aws logs tail /aws/lambda/n12122882-custom-scaling-metric --since 10m

# 2. Xem logs của transcoding service
aws logs tail /ecs/n12122882-transcoding-service --since 10m

# 3. Xem CloudWatch metrics dashboard
```

**Show trong AWS Console:**
- CloudWatch → Log groups → Show all service logs
- CloudWatch → Metrics → Custom namespace `CAB432/CustomMetrics`
- Show graphs:
  - MessagesPerTask over time
  - QueueDepth over time
  - RunningTaskCount over time
  - CPU/Memory utilization

**Giải thích:**
- All services log to CloudWatch
- Custom metrics for scaling
- 7-day retention policy
- Can set up alarms on any metric

---

## 📊 PHẦN 3: DEMO ARCHITECTURE OVERVIEW (2 phút)

**Show diagram và explain flow:**

```
┌─────────────┐
│  CloudFront │ ← Edge Caching (Additional Criterion #1)
│   (CDN)     │    - Cache static assets at edge
└──────┬──────┘    - Reduce latency globally
       │
       ▼
┌─────────────┐
│     ALB     │ ← Load Balancer (Core Criterion #1)
│ (aws_lb)    │    - Health checks
└──────┬──────┘    - Distribute traffic
       │
       ├──────────┬──────────┬──────────┐
       ▼          ▼          ▼          ▼
    ┌────┐    ┌────┐    ┌────┐    ┌────┐
    │Web │    │Auth│    │Upld│    │Tran│
    │ECS │    │ECS │    │ECS │    │ECS │
    └────┘    └────┘    └────┘    └─┬──┘
                                     │
                                     │ Auto Scale (Core #2)
    ┌────────────────────────────────┤ + Custom Metric (Additional #2)
    │                                │
    │   ┌──────────────────┐         │
    │   │ Lambda (1 min)   │◄────────┤
    │   │ Custom Metric    │         │
    │   │ Publisher        │         │
    │   └────────┬─────────┘         │
    │            │                   │
    │            ▼                   │
    │   ┌──────────────────┐         │
    │   │   CloudWatch     │         │
    │   │ MessagesPerTask  │─────────┤
    │   └──────────────────┘         │
    │                                │
    ▼                                ▼
┌─────────┐                   ┌──────────┐
│   SQS   │ ← Event Queue    │SQS Worker│
│  Queue  │   (Core #3)       │   ECS    │
└─────────┘                   └──────────┘
    │
    │ Retry 3x
    ▼
┌─────────┐
│   DLQ   │
└─────────┘

        ┌──────────────────┐
        │  EventBridge     │ ← Scheduled Tasks (Core #4)
        │  Schedules       │    - Maintenance: Daily 2 AM
        └────────┬─────────┘    - Log Cleanup: Weekly
                 │
                 ▼
        ┌──────────────────┐
        │ Scheduled Tasks  │
        │  - Maintenance   │
        │  - Log Cleanup   │
        └──────────────────┘

        ┌──────────────────┐
        │  CloudWatch Logs │ ← Logging (Core #5)
        │   All Services   │    - 7 day retention
        └──────────────────┘
```

---

## ✅ MARKING CHECKLIST - 24/24

### Core Criteria (18 marks)

**1. Load Balancer (3 marks)** ✅
- [x] ALB distributing traffic to multiple services
- [x] Health checks on `/health` endpoints
- [x] HTTPS with ACM certificate
- **Demo:** Show ALB target groups, health status

**2. Auto Scaling (4 marks)** ✅
- [x] ECS Service Auto Scaling configured
- [x] Scales 1 → 3 → 1 tasks based on load
- [x] Scale-out cooldown: 60s, Scale-in: 180s
- **Demo:** Live scaling test (show in console + script output)

**3. Event Queue (4 marks)** ✅
- [x] SQS queue for transcoding jobs
- [x] Dead Letter Queue for failed messages
- [x] Retry policy: 3 attempts
- **Demo:** Send messages, show processing, DLQ

**4. Scheduled Tasks (4 marks)** ✅
- [x] Maintenance task - Daily at 2 AM
- [x] Log cleanup task - Weekly (Sunday 3 AM)
- [x] Triggered by EventBridge rules
- **Demo:** Show scheduled tasks, run manually

**5. Logging (3 marks)** ✅
- [x] All services log to CloudWatch
- [x] Log groups with 7-day retention
- [x] Lambda execution logs
- **Demo:** Show logs in CloudWatch console

### Additional Criteria (6 marks)

**6. Edge Caching (3 marks)** ✅
- [x] CloudFront distribution with ALB origin
- [x] Cache behaviors for static vs dynamic content
- [x] Static assets cached 1 day, API not cached
- **Demo:** 
  - Show CloudFront distribution
  - Test cache hit/miss headers
  - Compare latency CloudFront vs direct ALB

**7. Custom Scaling Metric (3 marks)** ✅
- [x] Lambda publishes custom CloudWatch metric
- [x] Metric: `MessagesPerTask` = Queue Depth / Running Tasks
- [x] Scaling policy uses custom metric (not CPU)
- [x] EventBridge triggers Lambda every minute
- **Demo:**
  - Show Lambda code và execution logs
  - Show custom metric in CloudWatch
  - Live test: Send 15 messages → Scale to 3 tasks
  - Explain why better than CPU-based

---

## 🎯 KEY POINTS TO EMPHASIZE IN VIDEO

### For CloudFront (Edge Caching):
1. "CloudFront distributes content globally với low latency"
2. "Static assets cached 24 hours tại edge locations"
3. "API responses không được cache (TTL=0) để ensure fresh data"
4. Show header `X-Cache: Hit from cloudfront` as proof

### For Custom Scaling Metric:
1. "Đây là custom metric KHÔNG phải CPU-based standard metric"
2. "Lambda function chạy every minute để calculate MessagesPerTask"
3. "Scaling PROACTIVE - scale trước khi CPU spike"
4. "Better scaling decisions: dựa trên workload (messages) chứ không phải resource usage"
5. Show calculation: `MessagesPerTask = QueueDepth / RunningTasks`
6. Show live scaling: 15 messages → 3 tasks (15/5=3)

### Architecture Highlights:
1. "Fully containerized với ECS Fargate - no EC2 management"
2. "Event-driven architecture với SQS"
3. "Automated operations với scheduled tasks"
4. "Comprehensive monitoring và logging"
5. "Production-ready với health checks, DLQ, auto scaling"

---

## 📝 SCRIPT ORDER FOR VIDEO

**Intro (1 min):**
- "Chào mọi người, hôm nay tôi sẽ demo hệ thống video processing đạt 24/24 marks"
- Show architecture diagram
- "Bao gồm 5 core criteria và 2 additional criteria"

**Demo CloudFront (3 min):**
- Show distribution in console
- Test cache headers
- Explain caching strategy

**Demo Custom Scaling (7 min):**
- Show Lambda function và code
- Show custom metric in CloudWatch
- Run scaling test
- Show scaling happen in real-time
- Explain calculation logic

**Demo Load Balancer (2 min):**
- Show ALB và target groups
- Show health checks

**Demo Event Queue (2 min):**
- Show SQS queues
- Show DLQ

**Demo Scheduled Tasks (2 min):**
- Show EventBridge rules
- Show scheduled tasks

**Demo Logging (2 min):**
- Show CloudWatch logs
- Show metrics

**Conclusion (1 min):**
- Recap 24 marks
- "Hệ thống production-ready, fully automated, highly available"

---

## 🔧 TROUBLESHOOTING

### If CloudFront not deployed yet:
```powershell
cd infrastructure/terraform
terraform apply -target=aws_cloudfront_distribution.main
```

### If Lambda not publishing metrics:
```powershell
# Check Lambda logs
aws logs tail /aws/lambda/n12122882-custom-scaling-metric --follow

# Check EventBridge rule is enabled
aws events describe-rule --name n12122882-custom-metric-schedule
```

### If scaling not working:
```powershell
# Check scaling policy
aws application-autoscaling describe-scaling-policies `
  --service-namespace ecs `
  --resource-id service/n12122882-a3-cluster/n12122882-transcoding-service

# Check CloudWatch metric exists
aws cloudwatch list-metrics --namespace CAB432/CustomMetrics
```

---

## 🎓 FINAL NOTES

**Time estimates:**
- Total demo: ~20 minutes
- Most important: Custom Scaling demo (7 min) - This is THE differentiator!
- CloudFront demo: Quick but important (3 min)

**Preparation before recording:**
- Run `deploy-cloudfront-and-custom-metric.ps1` at least 30 minutes before recording
- Ensure all services are running
- Test the scaling once before recording
- Have AWS Console open in multiple tabs
- Have PowerShell terminal ready

**During recording:**
- Speak clearly in Vietnamese (except commit messages)
- Show code when explaining Lambda/Terraform
- Show AWS Console for visual proof
- Let the scaling demo run in real-time (speed up video if needed)
- Emphasize "custom metric" vs "standard CPU metric"

Good luck! 🚀

