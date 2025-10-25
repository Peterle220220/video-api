# 🚀 QUICK REFERENCE - DEMO VIDEO

## 🔗 AWS CONSOLE URLs (Mở sẵn trong tabs)

### Tab 1: ECS Clusters
```
https://ap-southeast-2.console.aws.amazon.com/ecs/v2/clusters
```

### Tab 2: SQS Queues
```
https://ap-southeast-2.console.aws.amazon.com/sqs/v3/home
```

### Tab 3: ECS Transcoding Service (Thay YOUR_CLUSTER)
```
https://ap-southeast-2.console.aws.amazon.com/ecs/v2/clusters/video-processing-cluster/services/transcoding-service
```

### Tab 4: CloudWatch Metrics
```
https://ap-southeast-2.console.aws.amazon.com/cloudwatch/home?region=ap-southeast-2#dashboards:
```

### Tab 5: Certificate Manager
```
https://ap-southeast-2.console.aws.amazon.com/acm/home?region=ap-southeast-2#/certificates/list
```

### Tab 6: Load Balancers
```
https://ap-southeast-2.console.aws.amazon.com/ec2/home?region=ap-southeast-2#LoadBalancers:
```

### Tab 7: EventBridge Rules (Scheduled Tasks)
```
https://ap-southeast-2.console.aws.amazon.com/events/home?region=ap-southeast-2#/rules
```

---

## 💻 TERMINAL COMMANDS (Copy & Paste)

### Chuẩn bị môi trường
```powershell
# Navigate to project
cd E:\video\video-api

# Check AWS credentials
aws sts get-caller-identity
```

### Check Infrastructure
```powershell
# List ECS services
aws ecs list-services --cluster video-processing-cluster --region ap-southeast-2

# List SQS queues
aws sqs list-queues --region ap-southeast-2

# Check DLQ messages
aws sqs get-queue-attributes `
  --queue-url https://sqs.ap-southeast-2.amazonaws.com/ACCOUNT/video-transcoding-dlq `
  --attribute-names ApproximateNumberOfMessages
```

### Demo Auto-Scaling
```powershell
# QUAN TRỌNG: Run load test
node scripts/test-transcoding-autoscaling.js

# Monitor trong terminal khác
aws ecs describe-services `
  --cluster video-processing-cluster `
  --services transcoding-service `
  --query 'services[0].desiredCount' `
  --region ap-southeast-2
```

### Terraform Commands
```powershell
# Navigate to terraform
cd infrastructure/terraform

# List all managed resources
terraform state list

# Show specific resource
terraform state show aws_ecs_service.transcoding_service
```

---

## 📝 SCRIPT READING (Đọc trong video)

### Opening (5 giây)
```
"Xin chào, tôi sẽ demo kiến trúc microservices video processing trên AWS."
```

### Microservices (15 giây)
```
"Hệ thống có 4 microservices: Upload Service xử lý upload, 
Transcoding Service thực hiện transcode video, 
Auth Service xác thực user, và SQS Worker consume messages."
```

### Load Distribution (10 giây)
```
"Upload service gửi transcoding jobs vào SQS queue, 
và nhiều worker instances consume messages từ queue."
```

### DLQ (15 giây)
```
"Messages fail sau 3 lần retry sẽ được chuyển vào Dead Letter Queue. 
System có monitoring để xử lý các messages này."
```

### Communication (10 giây)
```
"Application Load Balancer route traffic đến các services 
dựa trên path và target groups."
```

### Auto Scaling (30 giây)
```
"Bây giờ tôi demonstrate auto scaling. 
[Show 1 task] Ban đầu có 1 task running.
[Run script] Tôi chạy load test.
[Show 3 tasks] Service đã scale lên 3 tasks.
[Stop load] Tôi dừng load test.
[Show 1 task] Service scale down về 1 task."
```

### HTTPS (15 giây)
```
"Application accessible qua HTTPS với custom domain. 
Certificate được issue bởi ACM và attach vào ALB."
```

### Container Orchestration (15 giây)
```
"ECS service có rolling update với circuit breaker enabled, 
và có scheduled tasks chạy định kỳ cho maintenance."
```

### Infrastructure as Code (15 giây)
```
"Toàn bộ infrastructure được manage bằng Terraform. 
Đây là danh sách tất cả resources được deploy."
```

### Closing (5 giây)
```
"Cảm ơn, đây là demo ứng dụng video processing trên AWS."
```

---

## 🎯 TIMELINE CHÍNH XÁC (Giây)

| Time | Section | Duration |
|------|---------|----------|
| 0:00 | Opening | 5s |
| 0:05 | Show ECS Clusters | 30s |
| 0:35 | Show 4 Services Details | 60s |
| 1:35 | SQS Queue & Load Distribution | 45s |
| 2:20 | DLQ Configuration | 25s |
| 2:45 | DLQ Messages | 25s |
| 3:10 | ALB & Routing | 45s |
| 3:55 | Target Groups | 35s |
| 4:30 | **Auto-Scaling Start** | |
| 4:30 | Show Initial State (1 task) | 30s |
| 5:00 | Run Load Test | 15s |
| 5:15 | [EDIT CUT] → Show 3 Tasks | 60s |
| 6:15 | Show Metrics & Events | 30s |
| 6:45 | Stop Load | 15s |
| 7:00 | [EDIT CUT] → Show 1 Task | 45s |
| 7:45 | HTTPS in Browser | 20s |
| 8:05 | Certificate Manager | 20s |
| 8:25 | ALB Listener Config | 15s |
| 8:40 | ECS Deployment Config | 25s |
| 9:05 | Scheduled Tasks | 20s |
| 9:25 | Terraform Files | 20s |
| 9:45 | Terraform State List | 15s |
| 10:00 | END | |

---

## ⚡ KEYBOARD SHORTCUTS

### OBS Studio
- `Start Recording`: (custom shortcut)
- `Stop Recording`: (custom shortcut)  
- `Pause Recording`: (custom shortcut)

### Browser
- `F11`: Fullscreen
- `Ctrl + Tab`: Next tab
- `Ctrl + Shift + Tab`: Previous tab
- `Ctrl + L`: Focus address bar
- `Ctrl + +/-`: Zoom in/out
- `F5`: Refresh

### Windows
- `Win + D`: Show desktop
- `Win + L`: Lock screen
- `Alt + Tab`: Switch windows
- `Win + G`: Game bar (alternative recording)

---

## 🎨 VISUAL CHECKLIST

### Màu sắc AWS Console
- ✅ Green: Healthy, Running, Active
- 🟡 Orange: Warning, Updating
- ❌ Red: Error, Stopped, Failed

### Điểm cần ZOOM IN
- 🔍 Certificate status "Issued"
- 🔍 Browser address bar HTTPS
- 🔍 ECS Tasks count (1 → 3 → 1)
- 🔍 CloudWatch metrics values
- 🔍 Terraform state list output

---

## 📊 SUCCESS METRICS

Sau khi xem lại video, check:
- [ ] Tất cả text đọc được (zoom in đủ)
- [ ] Audio rõ ràng, không echo
- [ ] Navigation smooth, không jerky
- [ ] Timing chính xác ≤ 10:00
- [ ] Không có info nhạy cảm visible
- [ ] Professional appearance

---

## 🚨 COMMON MISTAKES

### ❌ KHÔNG LÀM
1. Nói quá nhiều, giải thích dài dòng
2. Navigate AWS console quá chậm
3. Không zoom in khi show text
4. Quên pause recording khi waiting
5. Show password, API keys, emails
6. Recording với tab other website visible

### ✅ NÊN LÀM  
1. Chuẩn bị kỹ, practice 2-3 lần
2. Show > Tell (Hình ảnh quan trọng hơn lời)
3. Zoom in khi cần
4. Edit video professional
5. Check timing trước khi submit
6. Test video playback trước submit

---

## 📱 EMERGENCY NUMBERS

**Nếu gặp technical issue trong giờ chót:**
- Teaching team email: cab432@qut.edu.au
- Check Canvas announcements
- Check Teams channel

---

**YOU GOT THIS! 💪 CỨ TỰ TIN MÀ LÀM! 🚀**

