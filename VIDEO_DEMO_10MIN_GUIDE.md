# HƯỚNG DẪN DEMO VIDEO 10 PHÚT - CAB432 ASSIGNMENT 3

## Chuẩn bị trước khi quay

### 1. Mở sẵn các tab AWS Console
- **Tab 1**: ECS Clusters (để show microservices)
- **Tab 2**: SQS Queues (để show load distribution và DLQ)
- **Tab 3**: ECS Service - Auto Scaling tab (để show auto scaling)
- **Tab 4**: CloudWatch Metrics (custom metric nếu có)
- **Tab 5**: Certificate Manager + ALB/API Gateway
- **Tab 6**: ECS Service Details (container orchestration features)
- **Tab 7**: Terraform/CloudFormation (IaC)

### 2. Chuẩn bị test scripts
- Có sẵn script test auto-scaling
- Có file video để upload test
- Browser mở app với HTTPS

---

## KỊCH BẢN DEMO 10 PHÚT

### **Phút 0:00 - 1:30: MICROSERVICES + ECS (Core + Additional)**

**Nói**: "Xin chào, tôi sẽ demo kiến trúc microservices của ứng dụng video processing trên AWS."

1. **Show ECS Clusters** (30s)
   - Chỉ vào cluster đang chạy
   - Nói: "Hệ thống có 4 microservices chính"

2. **Show từng ECS Service** (60s)
   - **Upload Service**: "Service này xử lý việc upload video lên S3"
   - **Transcoding Service**: "Service này thực hiện transcode video, đây là CPU-intensive task"
   - **Auth Service**: "Service xác thực người dùng với Cognito"
   - **SQS Worker**: "Worker này consume messages từ SQS queue"
   
   Mỗi service click vào show:
   - Task đang running
   - Container configuration

---

### **Phút 1:30 - 2:30: LOAD DISTRIBUTION (Core)** SQS

**Nói**: "Hệ thống sử dụng SQS để phân phối load cho transcoding tasks"

1. **Show SQS Console** (30s)
   - Show queue: `video-transcoding-queue`
   - Show attributes: Messages available, In flight

2. **Show kiến trúc** (30s)
   - Upload service → gửi message vào queue
   - SQS Worker instances consume messages
   - Mỗi message chỉ được xử lý bởi 1 worker

---

### **Phút 2:30 - 3:30: DEAD LETTER QUEUE (Additional)**

**Nói**: "Hệ thống có DLQ để xử lý messages bị lỗi"

1. **Show DLQ Configuration** (20s)
   - Click vào main queue → show Dead Letter Queue tab
   - Show: Max receive count = 3

2. **Show DLQ có messages** (40s)
   - Click vào DLQ queue
   - Show messages bị failed (nếu có)
   - Nói: "Messages fail sau 3 lần retry sẽ vào DLQ"

3. **Show DLQ Processing** (30s)
   - Show CloudWatch Logs hoặc script monitoring DLQ
   - Nói: "System có worker riêng để xử lý hoặc alert về messages trong DLQ"

---

### **Phút 3:30 - 4:30: COMMUNICATION MECHANISMS (Additional)**

**Nói**: "Ngoài SQS, hệ thống sử dụng thêm các communication mechanisms khác"

1. **Show Application Load Balancer** (30s)
   - Show ALB trong EC2 console
   - Show Listeners với routing rules
   - Nói: "ALB route requests đến các services dựa trên path"

2. **Show Target Groups** (30s)
   - Show target groups cho từng service
   - Show health checks

3. **Optional: API Gateway hoặc EventBridge** (30s)
   - Nếu có, show configuration
   - Giải thích use case

---

### **Phút 4:30 - 7:00: AUTO SCALING + CUSTOM METRIC (Core + Additional)**

**Quan trọng nhất - cần edit video này cẩn thận**

**Nói**: "Bây giờ tôi sẽ demonstrate auto scaling của transcoding service"

1. **Show Initial State** (30s)
   - Vào ECS Service → Health and metrics tab
   - Show: Currently 1 task running
   - Show CloudWatch metrics: CPU utilization thấp
   - **CHỤP SCREENSHOT hoặc ghi lại thời gian**

2. **Start Load Test** (15s)
   - Show terminal
   - Nói: "Tôi sẽ chạy load test script"
   - Run: `node scripts/test-transcoding-autoscaling.js`
   - Show script đang gửi nhiều transcoding requests

3. **[EDIT VIDEO] Show Scaling Out** (60s)
   - **Cut đến khi có 2-3 tasks**
   - Show ECS Service:
     - Events tab: "service XXX has started 2 tasks"
     - Health and metrics: 3 tasks running
     - CPU utilization tăng lên
   - Nói: "Sau vài phút, service đã scale từ 1 lên 3 tasks"

4. **[OPTIONAL] Show Custom Metric** (30s)
   - Nếu dùng custom metric, show CloudWatch metric
   - Show Lambda function implementing custom metric
   - Nói: "Hệ thống dùng custom metric [tên metric] thay vì chỉ CPU"

5. **Stop Load** (15s)
   - Show terminal: Stop script hoặc đã finish
   - Nói: "Tôi đã dừng load test"

6. **[EDIT VIDEO] Show Scaling In** (45s)
   - **Cut đến khi về 1 task**
   - Show ECS Service:
     - Events tab: "service XXX has stopped 2 tasks"  
     - Health and metrics: 1 task running
     - CPU utilization giảm
   - Nói: "Service đã scale down về 1 task khi không còn load"

---

### **Phút 7:00 - 8:00: HTTPS (Core)**

**Nói**: "Ứng dụng được serve qua HTTPS với custom domain"

1. **Show Application in Browser** (20s)
   - Mở browser
   - Navigate đến: `https://[your-subdomain].cab432.com`
   - **Zoom in vào address bar** - show:
     - 🔒 lock icon
     - `https://`
     - Domain name

2. **Show Certificate in ACM** (20s)
   - Show AWS Certificate Manager
   - Show certificate status: "Issued"
   - Show domain: `*.cab432.com` hoặc specific subdomain

3. **Show ALB/API Gateway Config** (20s)
   - Show ALB Listener trên port 443
   - Show certificate được attach
   - Nói: "ALB sử dụng certificate này để terminate SSL"

---

### **Phút 8:00 - 9:00: CONTAINER ORCHESTRATION FEATURES (Additional)**

**Nói**: "ECS service có các advanced features"

1. **Rolling Updates** (25s)
   - Show ECS Service → Deployments tab
   - Show deployment configuration:
     - Minimum healthy percent
     - Maximum percent
     - Deployment circuit breaker enabled
   - Nói: "Service hỗ trợ rolling update với circuit breaker"

2. **Service Discovery** (20s)
   - Show Cloud Map namespace (nếu có)
   - Hoặc show service được reference bởi service khác
   - Nói: "Services có thể discover nhau through service discovery"

3. **Scheduled Tasks** (15s)
   - Show CloudWatch Events Rule hoặc EventBridge
   - Show scheduled task: log-cleanup hoặc maintenance
   - Nói: "Có scheduled tasks chạy định kỳ cho maintenance"

---

### **Phút 9:00 - 10:00: INFRASTRUCTURE AS CODE (Additional)**

**Nói**: "Toàn bộ infrastructure được quản lý bằng Terraform"

1. **Show Terraform Files** (20s)
   - Show VS Code hoặc file explorer
   - Show các file `.tf`: `ecs.tf`, `alb.tf`, `sqs.tf`, etc.

2. **Show Terraform State** (20s)
   - Open terminal
   - Run: `cd infrastructure/terraform`
   - Run: `terraform state list`
   - Show danh sách resources được manage

3. **Show Deployed Resources** (20s)
   - Nói: "Tất cả resources bạn thấy đều được deploy bằng Terraform"
   - Có thể show 1 resource trong console
   - Show tags có "ManagedBy: Terraform"

---

## KẾT THÚC (10s)

**Nói**: "Cảm ơn, đây là demo của ứng dụng video processing với microservices architecture trên AWS ECS."

---

## TIPS QUAN TRỌNG

### Editing Video
- **Auto-scaling section**: Đây là phần DUY NHẤT cần edit vì mất 10-15 phút
- Các phần khác show real-time
- Dùng OBS Studio hoặc Zoom để record
- Edit bằng DaVinci Resolve (free) hoặc Adobe Premiere

### Time Management
- Nếu quá 10 phút, cắt bớt phần giải thích
- Quan trọng nhất: Show được functionality, không cần nói nhiều
- Speed up video ở phần navigate AWS console (1.2x-1.5x)

### Common Mistakes
- ❌ Không zoom in khi show text nhỏ
- ❌ Navigate AWS console quá chậm
- ❌ Giải thích quá nhiều thay vì show
- ✅ Chuẩn bị sẵn tất cả tabs
- ✅ Practice 2-3 lần trước khi record chính thức
- ✅ Show > Tell

### Checklist Before Recording
- [ ] Tất cả services đang running
- [ ] SQS queues có DLQ configured
- [ ] Auto-scaling configured đúng (1 min → 3 max)
- [ ] HTTPS working với certificate
- [ ] Load test script ready
- [ ] Terraform state có resources
- [ ] Close các tabs không cần thiết
- [ ] Set browser zoom 100%
- [ ] Hide bookmark bar cho clean UI

---

## CẤU TRÚC VIDEO FILE

```
00:00 - 01:30 → Microservices + ECS
01:30 - 02:30 → Load Distribution  
02:30 - 03:30 → Dead Letter Queue
03:30 - 04:30 → Communication Mechanisms
04:30 - 07:00 → Auto Scaling + Custom Metric [EDITED]
07:00 - 08:00 → HTTPS
08:00 - 09:00 → Container Orchestration
09:00 - 10:00 → Infrastructure as Code
```

---

## SCRIPT DEMO NHANH (Copy & Paste)

### Terminal Commands Chuẩn Bị
```bash
# 1. Check ECS services
aws ecs list-services --cluster video-processing-cluster

# 2. Check SQS queues  
aws sqs list-queues

# 3. Start load test
cd E:\video\video-api
node scripts/test-transcoding-autoscaling.js

# 4. Check terraform state
cd infrastructure/terraform
terraform state list
```

### Browser URLs Chuẩn Bị
```
1. https://console.aws.amazon.com/ecs/v2/clusters
2. https://console.aws.amazon.com/sqs/v2/home
3. https://console.aws.amazon.com/cloudwatch
4. https://console.aws.amazon.com/acm
5. https://console.aws.amazon.com/ec2/v2/home#LoadBalancers
6. https://[your-app].cab432.com
```

Chúc bạn demo tốt! 🎬

