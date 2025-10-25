# 📄 DEMO CHEAT SHEET - IN RA & ĐỂ BÊN CẠNH

## ⏱️ TIMELINE (10 phút)

| Thời gian | Nội dung | Thời lượng |
|-----------|----------|------------|
| 0:00-1:30 | Microservices + ECS | 90s |
| 1:30-2:30 | Load Distribution (SQS) | 60s |
| 2:30-3:30 | Dead Letter Queue | 60s |
| 3:30-4:30 | Communication (ALB) | 60s |
| 4:30-7:00 | **Auto Scaling** ⚠️ | 150s |
| 7:00-8:00 | HTTPS + Certificate | 60s |
| 8:00-9:00 | Container Orchestration | 60s |
| 9:00-10:00 | Infrastructure as Code | 60s |

---

## 📍 CHECKLIST NHANH

### Trước khi BẤM RECORD:
- [ ] 7 tabs AWS Console mở sẵn
- [ ] Browser 100% zoom, hide bookmarks
- [ ] Notifications TẮT (Win + A)
- [ ] Desktop clean
- [ ] Script sẵn sàng: `test-transcoding-autoscaling.js`

### Trong lúc quay:
- [ ] Nói rõ ràng, không nhanh
- [ ] Zoom in khi show text quan trọng
- [ ] Navigate smooth, không vội
- [ ] **PAUSE** khi đợi auto-scaling

### Sau khi quay:
- [ ] Edit phần auto-scaling (cut waiting)
- [ ] Check duration ≤ 10:00
- [ ] Test play video
- [ ] Upload + CLICK SUBMIT

---

## 🎬 SCRIPT ĐỌC

### 1️⃣ Microservices (1:30)
*"Hệ thống có 4 microservices deploy trên ECS:"*
- Upload Service - xử lý upload
- Transcoding Service - CPU intensive task
- Auth Service - xác thực
- SQS Worker - consume messages

### 2️⃣ Load Distribution (60s)
*"SQS queue phân phối transcoding jobs đến nhiều workers"*

### 3️⃣ Dead Letter Queue (60s)
*"Messages fail 3 lần → vào DLQ → system monitoring xử lý"*

### 4️⃣ Communication (60s)
*"ALB route traffic theo path với listener rules"*

### 5️⃣ Auto Scaling (150s)
*"Demonstrate scaling: 1→3→1 tasks"*
- Initial: 1 task
- Run load → 3 tasks [EDIT]
- Stop load → 1 task [EDIT]

### 6️⃣ HTTPS (60s)
*"HTTPS với ACM certificate qua ALB"*
Show: 🔒 https://ap-southeast-2.console.aws.amazon.com/acm/home?region=ap-southeast-2#/certificates/c7ffeaea-2181-43b7-b68d-a8eb021aed77

### 7️⃣ Container Orchestration (60s)
*"Rolling update, circuit breaker, scheduled tasks"*

### 8️⃣ Infrastructure as Code (60s)
*"Terraform quản lý tất cả resources"*
Run: `terraform state list`

---

## 🔗 QUICK URLs

### Console Tabs:
1. ECS Clusters
2. SQS Queues
3. ECS Service (transcoding)
4. CloudWatch
5. ACM Certificates
6. Load Balancers
7. EventBridge

### Commands:
```powershell
cd E:\video\video-api
node scripts/test-transcoding-autoscaling.js
cd infrastructure/terraform
terraform state list
```

---

## ⚠️ QUAN TRỌNG

### Auto-Scaling Section:
1. Show: 1 task running ✅
2. Run: Load test script ✅
3. **PAUSE RECORDING** ⏸️
4. Wait 5-10 min for 3 tasks
5. **RESUME** ▶️
6. Show: 3 tasks + metrics ✅
7. Stop load test ✅
8. **PAUSE RECORDING** ⏸️
9. Wait 10-15 min for scale down
10. **RESUME** ▶️
11. Show: 1 task ✅

### Zoom In When:
- Browser HTTPS lock icon
- Certificate "Issued" status
- ECS Tasks count
- Terraform output

### Don't Forget:
- Nói tiếng Việt (theo yêu cầu)
- Show > Tell
- Professional appearance
- No personal info visible

---

## 🚨 IF SOMETHING FAILS

### Services not running:
```powershell
aws ecs update-service --cluster video-processing-cluster --service [service-name] --force-new-deployment --region ap-southeast-2
```

### Auto-scaling not working:
- Lower CPU target to 50%
- Check CloudWatch alarms
- Ensure load test actually generates load

### HTTPS not working:
- Check certificate = "Issued"
- Check ALB listener on port 443
- Check Route53 CNAME

---

## ✅ FINAL CHECK

- [ ] Video < 10:00 minutes
- [ ] All sections covered
- [ ] Text readable (quality good)
- [ ] Audio clear
- [ ] Edited auto-scaling (cut waits)
- [ ] Tested playback
- [ ] **SUBMITTED** (not just uploaded!)

---

**🎯 BẠN LÀM ĐƯỢC! GOOD LUCK! 🚀**

---

*Print this page and keep next to you while recording!*

