# ✅ CHECKLIST DEMO VIDEO - PRINT & CHECK

## 📋 TRƯỚC KHI QUAY (30 phút trước)

### Infrastructure Check
- [ ] Tất cả ECS services đang **RUNNING** (check console)
- [ ] SQS queues tồn tại và có DLQ configured
- [ ] Auto-scaling group configured: min=1, max=3, desired=1
- [ ] ALB/API Gateway có certificate và đang healthy
- [ ] HTTPS domain accessible: `https://n12122882.cab432.com`
- [ ] CloudWatch có metrics data

### Script & Tools Check  
- [ ] `scripts/test-transcoding-autoscaling.js` đã test - chạy được
- [ ] OBS Studio hoặc Zoom recording setup sẵn
- [ ] Screen resolution: 1920x1080 (Full HD)
- [ ] Microphone test - audio rõ ràng

### Browser Setup
- [ ] Chrome/Firefox đã login AWS Console
- [ ] Đóng tất cả tabs không cần thiết
- [ ] Mở sẵn 7 tabs theo thứ tự:
  1. [ ] ECS Clusters
  2. [ ] SQS Queues  
  3. [ ] ECS Service (transcoding-service)
  4. [ ] CloudWatch Metrics/Dashboard
  5. [ ] Certificate Manager
  6. [ ] ALB/API Gateway
  7. [ ] Application URL (https://n12122882.cab432.com)

- [ ] Browser zoom = 100%
- [ ] Hide bookmark bar (Ctrl+Shift+B)
- [ ] Fullscreen mode ready (F11)

### VS Code / File Explorer
- [ ] Mở folder `infrastructure/terraform`
- [ ] Terminal sẵn sàng ở correct path
- [ ] Git bash hoặc PowerShell tested

### Desktop Cleanup
- [ ] Close Slack, Discord, email, etc.
- [ ] Disable notifications (Windows: Win+A → Focus Assist)
- [ ] Hide desktop icons (right-click → View → uncheck)
- [ ] Taskbar auto-hide enabled

---

## 🎬 TRONG QUAA TRÌNH QUAY

### Phút 0-2: Microservices + Load Distribution
- [ ] Show 4 ECS services rõ ràng
- [ ] Click vào từng service, show tasks running
- [ ] Show SQS queue names và attributes

### Phút 2-4: DLQ + Communication
- [ ] Show DLQ configuration (max receive = 3)
- [ ] Show ALB listeners và target groups
- [ ] Zoom in khi show text quan trọng

### Phút 4-7: Auto Scaling (QUAN TRỌNG NHẤT)
- [ ] Recording đang chạy
- [ ] Show initial state: 1 task, low CPU
- [ ] Run load test script
- [ ] **PAUSE RECORDING** - đợi scale out (5-10 phút)
- [ ] **RESUME** - show 3 tasks running, Events tab
- [ ] Show CloudWatch metrics tăng
- [ ] **PAUSE** - đợi scale in (10-15 phút)  
- [ ] **RESUME** - show về 1 task

### Phút 7-8: HTTPS
- [ ] Address bar rõ ràng: 🔒 https:// domain
- [ ] Show certificate trong ACM: "Issued" status
- [ ] Show ALB listener 443 với certificate

### Phút 8-9: Container Orchestration
- [ ] Show deployment configuration
- [ ] Show scheduled tasks trong EventBridge
- [ ] Show service discovery (nếu có)

### Phút 9-10: Infrastructure as Code
- [ ] Show terraform files trong editor
- [ ] Run `terraform state list` 
- [ ] Show output rõ ràng

---

## 🎞️ SAU KHI QUAY

### Video Editing
- [ ] Trim phần đầu/cuối thừa
- [ ] Edit phần auto-scaling (cut waiting time)
- [ ] Check total duration ≤ 10:00
- [ ] Export: MP4, H.264, 1080p, 30fps

### Video Quality Check
- [ ] Text rõ ràng, đọc được
- [ ] Audio clear, không noise
- [ ] No personal info visible (email, phone, etc.)
- [ ] Cursor movements smooth, không quá nhanh

### Before Upload
- [ ] File size < 500MB (Canvas limit thường là 500MB)
- [ ] Filename: `CAB432_A3_Demo_[StudentID].mp4`
- [ ] Test play video một lần cuối

---

## ⚠️ TROUBLESHOOTING

### Nếu Services Không Running
```bash
# Check service status
aws ecs describe-services --cluster video-processing-cluster --services transcoding-service

# Force new deployment
aws ecs update-service --cluster video-processing-cluster --service transcoding-service --force-new-deployment
```

### Nếu Auto-Scaling Không Trigger
- Check: ECS Service → Auto Scaling tab → Policy tồn tại
- Check: CloudWatch → Alarms → Alarm state
- Check: Load test script đang gửi requests liên tục
- Giải pháp: Giảm target CPU từ 70% → 50%

### Nếu HTTPS Không Work
- Check: Certificate status = "Issued"
- Check: ALB listener có rule cho domain
- Check: Route53 CNAME đúng

### Nếu Video Quá 10 Phút
- Cut phần giải thích dài
- Speed up navigation (1.2x-1.5x)
- Remove phần redundant

---

## 📞 EMERGENCY CONTACTS

- Unit Coordinator: (check Canvas)
- Teaching Team Email: cab432@qut.edu.au
- AWS Account Issues: cab432@qut.edu.au

---

## 🎯 FINAL CHECK

Trước khi submit:
- [ ] Video ≤ 10:00 minutes
- [ ] All required sections covered
- [ ] Video quality good (text readable)
- [ ] Audio quality good
- [ ] File uploaded successfully
- [ ] **CLICKED SUBMIT BUTTON** ⚠️ (Không chỉ upload!)

---

**Good luck! 🍀 Bạn làm được! 💪**

