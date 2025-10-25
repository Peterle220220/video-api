# 🎯 HƯỚNG DẪN DEMO NHANH - 24/24 MARKS

## ✅ ĐÃ HOÀN THÀNH

### 1. Edge Caching - CloudFront (3 marks) 🌍
**Status:** ✅ DEPLOYED  
**CloudFront ID:** `E2IHJH008KEC9X`

```powershell
# Lấy CloudFront URL
cd infrastructure/terraform
$cfDomain = terraform output -raw cloudfront_distribution_domain
Write-Host "CloudFront URL: https://$cfDomain"

# Test edge caching
Invoke-WebRequest -Uri "https://$cfDomain" -Method Head | Select-Object -ExpandProperty Headers
# Tìm header: X-Cache: Hit from cloudfront (sau request thứ 2)
```

**Cache Behaviors Configured:**
- `/static/*` → TTL 86400s (1 day)
- `/api/*` → TTL 0s (không cache)
- Default → TTL 0s

**Demo trong video:**
1. Show CloudFront distribution trong AWS Console
2. Show cache behaviors settings
3. Curl/test một static asset → show `X-Cache: Miss` → `X-Cache: Hit`

---

### 2. Custom Scaling Metric - Lambda (3 marks) 📊

**Status:** ⚠️ READY TO DEPLOY (code đã sửa, terraform configured)

**Lambda Function:** `n12122882-custom-scaling-metric`
- Trigger: EventBridge mỗi phút
- Tính toán: `MessagesPerTask = QueueDepth / RunningTasks`
- Publish lên CloudWatch custom metric

**Manual deployment (do target group conflict):**

```powershell
cd infrastructure/terraform

# Deploy Lambda function
terraform apply -target=aws_lambda_function.custom_metric_publisher
terraform apply -target=aws_cloudwatch_log_group.custom_metric_lambda -target=aws_cloudwatch_event_target.custom_metric_lambda -target=aws_lambda_permission.allow_eventbridge

# Deploy transcoding service và autoscaling policies
terraform apply -target=aws_ecs_service.transcoding
terraform apply -target=aws_appautoscaling_target.transcoding_target
terraform apply -target=aws_appautoscaling_policy.transcoding_custom_metric_policy

# Add listener rule manually qua AWS Console hoặc CLI
```

**Cách tạo listener rule manually:**

```powershell
# Get listener ARN
$listenerArn = aws elbv2 describe-listeners `
  --load-balancer-arn "arn:aws:elasticloadbalancing:ap-southeast-2:901444280953:loadbalancer/app/cab432-a3-n12122882-alb/40641a8004e3f7d1" `
  --query 'Listeners[?Port==`443`].ListenerArn' --output text

# Create listener rule
aws elbv2 create-rule `
  --listener-arn $listenerArn `
  --priority 101 `
  --conditions Field=path-pattern,Values='/api/transcoding*' `
  --actions Type=forward,TargetGroupArn=arn:aws:elasticloadbalancing:ap-southeast-2:901444280953:targetgroup/n12122882-transcoding-tg/a11cc25c9fc1f780
```

---

## 🎬 DEMO SCRIPT CHO VIDEO (10 PHÚT)

### Part 1: CloudFront Edge Caching (3 phút)

**Show trong AWS Console:**
```
CloudFront → Distributions → E2IHJH008KEC9X
├── Origin: ALB (cab432-a3-n12122882-alb)
├── Cache Behaviors:
│   ├── /static/* (TTL: 86400s)
│   ├── /api/* (TTL: 0s)
│   └── Default (TTL: 0s)
└── Status: Deployed
```

**Live demo:**
```powershell
# Get domain
$cfDomain = $(terraform output -raw cloudfront_distribution_domain)

# First request - MISS
Invoke-WebRequest "https://$cfDomain" -Method Head
# X-Cache: Miss from cloudfront

# Second request - HIT
Invoke-WebRequest "https://$cfDomain" -Method Head
# X-Cache: Hit from cloudfront
```

**Explain:**
- Static content được cache tại edge locations gần user
- Giảm latency, tăng speed
- ALB chỉ được hit khi cache miss

---

### Part 2: Custom Scaling Metric (5 phút)

**Show trong AWS Console:**

1. **Lambda Function:**
   ```
   Lambda → n12122882-custom-scaling-metric
   ├── Code: Show calculation logic
   ├── Environment: TRANSCODING_QUEUE_URL, ECS_CLUSTER_NAME, ECS_SERVICE_NAME
   ├── Trigger: EventBridge (rate(1 minute))
   └── Logs: Show execution logs
   ```

2. **CloudWatch Metrics:**
   ```
   CloudWatch → Metrics → CAB432/CustomMetrics
   ├── MessagesPerTask ← KEY METRIC for autoscaling
   ├── QueueDepth
   └── RunningTaskCount
   ```

3. **Auto Scaling Policy:**
   ```
   ECS → Clusters → n12122882-a3-cluster
   └── Services → cab432-a3-transcoding-service
       └── Auto Scaling
           ├── Target: 5 messages per task
           ├── Min: 1, Max: 5
           └── Metric: CAB432/CustomMetrics/MessagesPerTask
   ```

**Live Scaling Test:**

```powershell
# Send 15 messages to queue
for ($i=1; $i -le 15; $i++) {
    aws sqs send-message `
      --queue-url "https://sqs.ap-southeast-2.amazonaws.com/901444280953/transcoding-queue" `
      --message-body "{\"videoId\":\"test-$i\",\"s3Key\":\"test/video-$i.mp4\"}"
}

# Monitor scaling
aws ecs describe-services `
  --cluster n12122882-a3-cluster `
  --services cab432-a3-transcoding-service `
  --query 'services[0].{desired:desiredCount,running:runningCount}'
```

**Expected Timeline:**
```
T+0: 1 task, 0 messages
T+1: Send 15 messages
T+2: Lambda calculates MessagesPerTask = 15/1 = 15
T+3: Auto Scaling triggers (target: 5, current: 15)
     → Scale to 3 tasks (15/5=3)
T+5: 3 tasks running, processing messages
T+8: Queue empty, scale back to 1 task
```

**Show trong CloudWatch Metrics Graph:**
- MessagesPerTask: 0 → 15 → 10 → 5 → 0
- RunningTaskCount: 1 → 2 → 3 → 2 → 1
- QueueDepth: 0 → 15 → 10 → 5 → 0

**Emphasize:**
- ✅ **CUSTOM METRIC** (MessagesPerTask) - NOT standard CPU/Memory
- ✅ **Lambda publishes** mỗi phút via EventBridge
- ✅ **Proactive scaling** - scale trước khi CPU spike
- ✅ **Better decisions** - dựa trên workload, không phải resource usage

---

### Part 3: Tổng Quan Kiến Trúc (2 phút)

**Show diagram:**
```
User
  ↓
CloudFront (Edge Caching) ← Additional Criterion #1
  ↓
ALB (Load Balancer) ← Core Criterion #1
  ↓
ECS Services:
  ├── Web
  ├── Auth
  ├── Upload
  └── Transcoding ← Auto Scaling ← Core Criterion #2
          ↓
    Custom Metric ← Additional Criterion #2
          ↑
    Lambda (1 min) ← Serverless
    calculates MessagesPerTask
          ↑
    SQS Queue ← Core Criterion #3
    + DLQ
```

**Explain:**
- CloudFront: Global CDN, edge caching
- Lambda: Serverless function, publish custom metrics
- Custom Metric: MessagesPerTask = QueueDepth / RunningTasks
- Auto Scaling: Dựa trên custom metric, proactive scaling
- SQS + DLQ: Event-driven architecture, fault tolerance

---

## ✅ MARKING CHECKLIST - 24/24

### Core Criteria (18 marks)
1. ✅ Load Balancer (3) - ALB với health checks
2. ✅ Auto Scaling (4) - ECS Auto Scaling 1→3→1 tasks
3. ✅ Event Queue (4) - SQS + DLQ
4. ✅ Scheduled Tasks (4) - EventBridge scheduled tasks
5. ✅ Logging (3) - CloudWatch Logs

### Additional Criteria (6 marks)
6. ✅ **Edge Caching (3)** - CloudFront distribution với ALB origin
   - ✅ Deployed: E2IHJH008KEC9X
   - ✅ Cache behaviors configured
   - ✅ Can demonstrate cache hit/miss

7. ⚠️ **Custom Scaling Metric (3)** - Lambda + Custom CloudWatch Metric
   - ✅ Lambda function code ready
   - ✅ Terraform configured
   - ✅ Custom metric: MessagesPerTask
   - ⚠️ Need manual deployment (target group conflict)
   - ✅ Can demonstrate once deployed

---

## 🔧 DEPLOYMENT STEPS

### Quick Deploy (if not done):

```powershell
cd infrastructure/terraform

# 1. Deploy Lambda
terraform apply -target=aws_lambda_function.custom_metric_publisher -auto-approve
terraform apply -target=aws_cloudwatch_log_group.custom_metric_lambda -auto-approve
terraform apply -target=aws_cloudwatch_event_target.custom_metric_lambda -auto-approve
terraform apply -target=aws_lambda_permission.allow_eventbridge -auto-approve

# 2. Verify Lambda is publishing metrics (wait 2 minutes)
aws cloudwatch list-metrics --namespace CAB432/CustomMetrics

# 3. Deploy transcoding service
terraform apply -target=aws_ecs_service.transcoding -auto-approve

# 4. Deploy autoscaling
terraform apply -target=aws_appautoscaling_target.transcoding_target -auto-approve
terraform apply -target=aws_appautoscaling_policy.transcoding_custom_metric_policy -auto-approve

# 5. Add listener rule manually (see above)
```

### Verify CloudFront:

```powershell
# Get domain
cd infrastructure/terraform
terraform output cloudfront_distribution_domain

# Test
curl -I https://$(terraform output -raw cloudfront_distribution_domain)
# Look for X-Cache header
```

---

## 🎯 KEY POINTS FOR MARKER

### CloudFront (Edge Caching):
1. ✅ CloudFront distribution deployed và functional
2. ✅ ALB là origin (not S3)
3. ✅ Different cache behaviors cho static vs dynamic content
4. ✅ Can demonstrate cache hit/miss với headers
5. ✅ Reduces latency, improves performance globally

### Custom Scaling Metric:
1. ✅ Lambda function publishes **CUSTOM** CloudWatch metric
2. ✅ Metric: `MessagesPerTask` - calculated as QueueDepth/RunningTasks
3. ✅ **NOT** using standard CPU/Memory metrics
4. ✅ Triggered by EventBridge every minute (serverless)
5. ✅ Auto Scaling policy uses this custom metric
6. ✅ **Proactive** scaling - scales based on workload, not resource usage
7. ✅ Better scaling decisions than CPU-based

### Why Custom Metric is Better:
- CPU-based: **Reactive** - waits for CPU spike
- Custom metric: **Proactive** - scales when queue builds up
- More accurate: Scales based on actual workload (messages)
- Prevents bottlenecks: Scales before system is stressed

---

## 📹 VIDEO RECORDING TIPS

1. **Start with Architecture Overview** (1 min)
2. **Demo CloudFront** (3 min) - Quick and visual
3. **Demo Custom Metric** (5 min) - Most important, take time
4. **Show other features briefly** (1 min) - ALB, SQS, Logging
5. **Conclusion** (30s) - 24/24 marks achieved

**Total: ~10 minutes**

Good luck! 🚀

