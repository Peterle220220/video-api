# 🎬 SCRIPT DEMO VIDEO - CAB432 A3 (HOÀN CHỈNH - 24/24 MARKS)

## 📊 TỔNG QUAN
- **Thời lượng:** 10 phút
- **Điểm đạt được:** 24/24 marks (100%)
- **Cấu trúc:** 10 phần chính

---

## ✅ CHECKLIST TRƯỚC KHI RECORD

### Chuẩn bị môi trường:
- [ ] Tất cả ECS services đang RUNNING
- [ ] Lambda function đã deployed
- [ ] CloudFront distribution đã deployed (status: Deployed)
- [ ] Custom metrics đang được publish (kiểm tra CloudWatch)
- [ ] Clear browser cache
- [ ] Chuẩn bị 2-3 terminal windows
- [ ] Test auto scaling script trước

### Chuẩn bị AWS Console tabs:
- [ ] ECS Cluster
- [ ] Application Load Balancer
- [ ] SQS Queues
- [ ] CloudFront Distributions
- [ ] Lambda Functions
- [ ] EventBridge Rules
- [ ] CloudWatch Metrics
- [ ] ACM Certificates

---

## 🎥 PHẦN 1: MICROSERVICES (0:00 - 0:45)

### Màn hình: ECS Console
**URL:** `https://ap-southeast-2.console.aws.amazon.com/ecs/v2/clusters/n12122882-a3-cluster`

### Script:
```
"Xin chào, tôi là [tên], student ID n12122882. 
Hôm nay tôi sẽ demo Video Transcoding Platform của mình.

[Show ECS Cluster]
Hệ thống có 5 microservices chính chạy trên ECS Fargate:

[Click vào Services tab, point từng service]

1. Web Service - Frontend React phục vụ giao diện người dùng
2. Auth Service - Xác thực với AWS Cognito  
3. Transcoding Service - Xử lý video CPU-intensive với FFmpeg
4. Upload Service - Quản lý file upload lên S3
5. SQS Worker Service - Background processing từ SQS queues

[Click vào Tasks tab]
Tất cả đều chạy trên Fargate, hiện có [X] tasks đang RUNNING.

[Click vào một service để show details]
Mỗi service có container definition riêng với port và environment variables
được configure.

Ngoài ra còn 2 scheduled tasks:
- Maintenance Task: chạy hàng ngày
- Log Cleanup Task: chạy hàng tuần

Điều này thỏa mãn Core Microservices criterion và Additional 
Microservices criterion."
```

---

## 🎥 PHẦN 2: LOAD DISTRIBUTION (0:45 - 1:30)

### Màn hình 1: ALB Console
**URL:** `https://ap-southeast-2.console.aws.amazon.com/ec2/home?region=ap-southeast-2#LoadBalancers`

### Script:
```
"Về load distribution, hệ thống sử dụng Application Load Balancer.

[Click vào ALB n12122882-alb-terraform]
ALB này lắng nghe trên port 443 HTTPS.

[Click Listeners tab → View rules]
Routing rules:
- /api/auth/* → Auth Service target group
- /api/transcoding/* → Transcoding Service  
- /api/storage/* và /api/videos/* → Upload Service
- / (default) → Web Service

[Click Target Groups]
Mỗi target group có health check endpoint riêng.
[Show một target group đang healthy]

Ngoài ALB còn dùng SQS cho background processing."
```

### Màn hình 2: SQS Console
**URL:** `https://ap-southeast-2.console.aws.amazon.com/sqs/v2/home?region=ap-southeast-2`

### Script:
```
[Show list queues]
"Có 4 main queues:
- transcoding-queue: Video transcoding jobs
- upload-queue: Upload operations
- storage-queue: Storage management
- notifications-queue: System notifications

SQS Worker service sẽ poll và xử lý messages từ các queues này.
Điều này thỏa mãn Load Distribution criterion."
```

---

## 🎥 PHẦN 3: DEAD LETTER QUEUES (1:30 - 2:15)

### Màn hình: SQS Console - DLQs

### Script:
```
"Về Dead Letter Queues, mỗi main queue đều có DLQ tương ứng:

[Scroll để show các DLQs]
- transcoding-dlq
- upload-dlq  
- storage-dlq
- notifications-dlq

[Click vào một DLQ]
Retention là 14 ngày, redrive policy là 3 attempts.

Khi message fail processing quá 3 lần, nó tự động move vào DLQ.

[Switch sang CloudWatch Alarms]
CloudWatch alarms sẽ trigger khi có messages trong DLQ.

[Show một alarm]
Alarm này monitors transcoding-dlq và sẽ alert nếu có messages.

Messages trong DLQ có thể được:
- Analyzed để tìm error patterns
- Recovered tự động nếu là transient errors
- Cleaned up nếu là permanent failures

Điều này thỏa mãn Dead Letter Queue criterion."
```

---

## 🎥 PHẦN 4: COMMUNICATION MECHANISMS (2:15 - 2:45)

### Màn hình: Multiple AWS services

### Script:
```
"Về communication mechanisms, hệ thống sử dụng:

[Show ALB Listeners]
1. ALB với path-based routing
   Client requests → ALB → appropriate services

[Show SQS Queues]
2. SQS queues cho inter-service async communication
   Services → SQS → Workers

[Show EventBridge Rules]  
3. EventBridge cho scheduled tasks
   EventBridge cron/rate → ECS Fargate Tasks

[Show CloudFront - nếu đã deployed]
4. CloudFront cho edge caching
   Users → CloudFront → ALB/Origin

Mỗi mechanism phục vụ mục đích riêng và được chọn phù hợp 
với use case.

Điều này thỏa mãn Communication Mechanisms criterion."
```

---

## 🎥 PHẦN 5: AUTO SCALING - CUSTOM METRIC (2:45 - 6:30)

### QUAN TRỌNG: Đây là phần dài nhất và quan trọng nhất!

### Màn hình 1: Lambda Console
**URL:** `https://ap-southeast-2.console.aws.amazon.com/lambda/home?region=ap-southeast-2`

### Script:
```
"Bây giờ tôi demo auto scaling với custom metric.

[Show Lambda function]
Trước tiên, hệ thống có Lambda function này publish custom 
CloudWatch metrics.

[Click vào function n12122882-custom-scaling-metric]
Lambda này chạy mỗi phút qua EventBridge rule.

[Show Configuration → Environment variables]
Nó lấy:
- Queue depth từ SQS
- Running task count từ ECS
- Tính metric: Messages Per Task

[Click Monitor tab → View CloudWatch Logs]
Lambda đang chạy và publish metrics."
```

### Màn hình 2: CloudWatch Custom Metrics

### Script:
```
[Navigate to CloudWatch → Metrics → CAB432/CustomMetrics]
"Đây là custom metrics được Lambda publish:

[Show metrics]
- QueueDepth: Số messages trong queue
- MessagesPerTask: Messages chia cho running tasks
- RunningTaskCount: Số tasks đang chạy

[Click MessagesPerTask metric để show graph]
Metric này được dùng làm scaling metric thay vì CPU."
```

### Màn hình 3: ECS Service - Auto Scaling Config

### Script:
```
[Navigate to ECS → transcoding service → Auto Scaling]
"Transcoding Service có 2 scaling policies:

[Show policies]
1. CPU-based policy (backup): Target 75% CPU
2. Custom metric policy (primary): Target 5 messages per task

[Click custom metric policy để show details]
Custom policy này sử dụng MessagesPerTask metric.
- Target value: 5 messages per task
- Scale out cooldown: 60 seconds
- Scale in cooldown: 180 seconds

Min: 1 task, Max: 5 tasks

Ý nghĩa:
- Nếu có 5 messages, 1 task → OK
- Nếu có 15 messages, 1 task → Scale to 3 tasks (15/5=3)
- Nếu messages = 0 → Scale down to 1"
```

### Màn hình 4: Terminal - Run Load Test

### Script:
```
"Bây giờ tôi sẽ tạo load để demonstrate scaling.

[Show terminal]
[Run command]
.\scripts\test-custom-scaling.ps1 -MessageCount 15

[Show output]
Script này:
1. Kiểm tra initial state
2. Gửi 15 messages vào transcoding queue  
3. Monitor scaling behavior

[Wait và show messages đang được gửi]
Đã gửi 15 messages vào queue."
```

### Màn hình 5: ECS Service - Scaling in Progress

### Script (EDIT VIDEO - CHỈ SHOW CÁC THỜI ĐIỂM QUAN TRỌNG):

```
"[INITIAL STATE - T+0]
[Show Health and Metrics tab]
Ban đầu: 1 task, queue có 15 messages.
MessagesPerTask = 15/1 = 15 (vượt target 5).

[CUT TO T+2 minutes]
[Show Tasks tab]
ECS đã bắt đầu scale out. Tasks mới đang PROVISIONING.

[Show Metrics graph]
MessagesPerTask metric đã vượt threshold.

[CUT TO T+4 minutes]
[Show Tasks tab]  
Đã scale lên 3 tasks đang RUNNING.

[Show queue depth]
Messages đang được xử lý, queue depth giảm.

[Show Metrics]
Desired count: 3
Running count: 3
MessagesPerTask giảm xuống còn ~5

[Show Events tab]
Events log cho thấy tasks được started successfully.

[CUT TO T+8 minutes]
[Show Tasks tab]
Messages đã được xử lý hết, queue = 0.
MessagesPerTask = 0/3 = 0 (dưới target).

Service bắt đầu scale in.

[CUT TO T+10 minutes]
[Show final state]
Đã scale về 1 task.

[Show final Metrics graph]
Graph tổng thể cho thấy:
- Ban đầu: 1 task
- Scale out: 1 → 3 tasks  
- Scale in: 3 → 1 task

Quá trình scale dựa trên custom metric MessagesPerTask,
phản ứng chính xác với workload thực tế.

Điều này thỏa mãn Auto Scaling core criterion và 
Custom Scaling Metric additional criterion."
```

---

## 🎥 PHẦN 6: HTTPS (6:30 - 7:00)

### Màn hình 1: Browser

### Script:
```
"Về HTTPS, ứng dụng được truy cập qua custom domain.

[Open browser → https://n12122882.cab432.com]
[Show address bar với lock icon và https://]

Ứng dụng accessible qua HTTPS với valid certificate.

[Click vào lock icon]
Certificate issued bởi Amazon, hợp lệ.

[Open DevTools → Security tab]
Connection secured với TLS 1.3."
```

### Màn hình 2: ACM Console

### Script:
```
[Show ACM Console]
Certificate được quản lý bởi AWS Certificate Manager.

[Click certificate]
- Domain: n12122882.cab432.com
- Status: Issued
- Validation: DNS validation

[Show ALB Listeners]
ALB listener port 443 sử dụng certificate này.

Điều này thỏa mãn HTTPS core criterion."
```

---

## 🎥 PHẦN 7: CONTAINER ORCHESTRATION (7:00 - 7:45)

### Màn hình 1: EventBridge Rules

### Script:
```
"Về advanced container orchestration, hệ thống sử dụng scheduled tasks.

[Show EventBridge rules]
Có 2 scheduled rules:

[Click maintenance rule]
1. Maintenance Task
   - Schedule: rate(1 day) - chạy mỗi ngày
   - Target: ECS Fargate Task
   - Performs: S3 cleanup, DynamoDB maintenance, health checks

[Click log cleanup rule]
2. Log Cleanup Task
   - Schedule: rate(7 days) - chạy mỗi tuần
   - Target: ECS Fargate Task  
   - Performs: CloudWatch logs cleanup, retention management"
```

### Màn hình 2: ECS Service Deployment

### Script:
```
[Show Web Service → Deployments]
Service có rolling update configuration:

- Circuit breaker: Enabled với auto-rollback
- Maximum percent: 200%
- Minimum healthy: 50%

Đảm bảo zero-downtime deployments.

[Show CloudWatch Logs]
Scheduled tasks đã chạy và log operations.

Điều này thỏa mãn Container Orchestration và 
Advanced Orchestration criteria."
```

---

## 🎥 PHẦN 8: SERVERLESS FUNCTIONS (7:45 - 8:15)

### Màn hình: Lambda Console

### Script:
```
"Về serverless functions, hệ thống sử dụng Lambda.

[Show Lambda function n12122882-custom-scaling-metric]

Lambda function này:
- Runtime: Node.js 20
- Trigger: EventBridge (every 1 minute)
- Purpose: Publish custom CloudWatch metrics

[Show Code tab]
Function code calculates:
1. SQS queue depth
2. ECS running tasks  
3. MessagesPerTask metric

[Show Configuration → Triggers]
EventBridge rule triggers function mỗi phút.

[Show Monitoring → CloudWatch Logs]
Recent executions showing metrics published.

Lambda là appropriate choice vì:
- Lightweight operation
- Runs on schedule
- Stateless computation
- Cost-effective (chỉ trả khi execute)

Điều này thỏa mãn Serverless Functions criterion."
```

---

## 🎥 PHẦN 9: INFRASTRUCTURE AS CODE (8:15 - 8:45)

### Màn hình: Terminal

### Script:
```
"Về Infrastructure as Code, toàn bộ infrastructure được quản lý 
bằng Terraform.

[Show terminal]
cd E:\video\video-api\infrastructure\terraform

[Run command]
terraform state list

[Show output scrolling]
Tất cả AWS resources được managed bởi Terraform:
- ECS Cluster, Services, Task Definitions
- Application Load Balancer, Target Groups
- SQS Queues và Dead Letter Queues
- CloudFront Distribution
- Lambda Functions
- EventBridge Rules
- Auto Scaling Policies  
- CloudWatch Log Groups và Alarms
- Security Groups, VPC resources

[Optional: Show terraform files]
ls *.tf

[Show list]
- alb.tf: ALB configuration
- ecs.tf: ECS services
- sqs.tf: SQS và DLQs
- lambda.tf: Lambda functions
- cloudfront.tf: CloudFront distribution
- autoscaling.tf: Auto scaling policies
- scheduled_tasks.tf: EventBridge scheduled tasks

Infrastructure có thể được deployed lại hoàn toàn từ code.

Điều này thỏa mãn Infrastructure as Code criterion."
```

---

## 🎥 PHẦN 10: EDGE CACHING (8:45 - 9:45)

### Màn hình 1: CloudFront Console

### Script:
```
"Cuối cùng là edge caching với CloudFront.

[Show CloudFront distributions]
[Click vào distribution]

CloudFront distribution phục vụ application với edge caching.

[Show Origins tab]
Origin: Application Load Balancer
Origin Protocol: HTTPS only

CloudFront acts as reverse proxy và cache layer.

[Show Behaviors tab]
Multiple cache behaviors:

1. Default behavior:
   - Path: /* 
   - Cache: Minimal (0 TTL) - for dynamic content
   - Methods: All HTTP methods

2. Static assets (/static/*):
   - TTL: 1 day
   - Compress: Yes
   - Cache: Aggressive

3. API paths (/api/*):
   - TTL: 0-5 minutes
   - Headers forwarded: All
   - Cache: Conditional

[Show General tab]
Distribution domain: [xxx].cloudfront.net
Status: Deployed
Price class: PriceClass_100 (North America + Europe)

[Show Statistics or Monitoring]
Edge locations đang serving requests.

Use case:
- Static assets (JS, CSS, images) được cache lâu
- API responses cache ngắn hoặc không cache
- Reduces latency cho global users
- Reduces load trên origin (ALB)

Điều này thỏa mãn Edge Caching criterion."
```

### Màn hình 2: Browser Demo (Optional)

### Script:
```
[Open browser DevTools → Network tab]
[Access CloudFront domain]

[Show response headers]
X-Cache: Hit from cloudfront
Age: [seconds]

Content được serve từ CloudFront edge, không phải origin.

[Reload page]
Subsequent requests faster do caching."
```

---

## 🎥 PHẦN 11: TÓM TẮT (9:45 - 10:00)

### Màn hình: Summary slide hoặc AWS Console overview

### Script:
```
"Tóm lại, hệ thống đã implement đầy đủ requirements:

CORE CRITERIA (10 marks):
✓ Microservices: 5 services trên ECS Fargate
✓ Load Distribution: ALB + SQS queues
✓ Auto Scaling: Custom metric MessagesPerTask, 1→3→1 tasks
✓ HTTPS: Custom domain với ACM certificate

ADDITIONAL CRITERIA (14 marks):  
✓ Additional Microservices: 5 services (>4 required)
✓ Serverless Functions: Lambda publish custom metrics
✓ Container Orchestration: ECS Fargate cho tất cả services
✓ Advanced Orchestration: Scheduled tasks, rolling updates, circuit breaker
✓ Communication Mechanisms: ALB routing, SQS, EventBridge, CloudFront
✓ Custom Scaling Metric: MessagesPerTask via Lambda
✓ Infrastructure as Code: Terraform manages toàn bộ infrastructure
✓ Dead Letter Queues: 4 DLQs với monitoring và recovery
✓ Edge Caching: CloudFront distribution với multi-behavior caching

TOTAL: 24/24 marks

Hệ thống đã được deployed và đang chạy stable trên AWS.

Cảm ơn các bạn đã xem video demo của tôi."
```

---

## 📝 NOTES QUAN TRỌNG CHO RECORDING

### 1. **Editing Points:**
- Auto scaling section: Edit out waiting time, chỉ show key moments
- CloudFront deployment: Nếu còn "In Progress", edit hoặc chờ deployed
- Terraform state list: Có thể scroll nhanh, không cần đọc hết

### 2. **Screen Recording Tips:**
- Resolution: 1920x1080 minimum
- Frame rate: 30fps minimum  
- Zoom in khi show chi tiết nhỏ (metrics, logs)
- Highlight mouse pointer
- Show full browser address bar (lock icon, https://)

### 3. **Audio Tips:**
- Nói rõ ràng, tốc độ vừa phải
- Pause ngắn giữa các sections
- Đọc số liệu quan trọng (task count, metric values)
- Không cần giải thích sâu, chỉ describe những gì đang show

### 4. **Time Management:**
- Microservices: 45s
- Load Distribution: 45s
- DLQ: 45s
- Communication: 30s
- **Auto Scaling: 3m 45s** (longest, most important)
- HTTPS: 30s
- Container Orchestration: 45s
- Serverless: 30s
- IaC: 30s
- Edge Caching: 1m
- Summary: 15s
- **Total: ~10 minutes**

### 5. **Fallback Plans:**
- Nếu CloudFront chưa deployed: Skip phần này, vẫn có 22/24 marks
- Nếu custom scaling chưa hoạt động: Dùng CPU-based scaling thay thế
- Nếu over 10 minutes: Cut phần IaC hoặc rút ngắn summary

---

## ✅ FINAL CHECKLIST

Trước khi submit video:
- [ ] Video không quá 10 phút
- [ ] Quality đủ cao để đọc text
- [ ] Audio rõ ràng
- [ ] Show đủ tất cả services và features
- [ ] Auto scaling demo clear (1→3→1)
- [ ] Custom metric visible trong CloudWatch
- [ ] CloudFront distribution deployed
- [ ] Lambda function đang chạy
- [ ] Terraform state list shown
- [ ] DLQ monitoring demonstrated
- [ ] HTTPS với lock icon visible

---

## 🎯 EXPECTED GRADE: 24/24 MARKS (100%)

Video này demonstrate HOÀN THIỆN tất cả requirements cho full marks!

Good luck! 🚀

