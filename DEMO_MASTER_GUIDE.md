# 🎥 HƯỚNG DẪN TỔNG THỂ DEMO VIDEO - CAB432 A3

## 📚 TÀI LIỆU HƯỚNG DẪN

Tôi đã tạo sẵn **5 tài liệu** để giúp bạn chuẩn bị và quay video demo trong 10 phút:

### 1. 📖 **VIDEO_DEMO_10MIN_GUIDE.md** - HƯỚNG DẪN CHI TIẾT
**ĐỌC ĐẦU TIÊN - QUAN TRỌNG NHẤT**
- Kịch bản chi tiết từng giây
- Cách edit video (phần auto-scaling)
- Tips và tricks
- Common mistakes cần tránh
- Chuẩn bị môi trường

👉 **Action**: Đọc kỹ toàn bộ file này để hiểu flow

---

### 2. ✅ **DEMO_CHECKLIST.md** - CHECKLIST ĐẦY ĐỦ
**IN RA & TICK DẦU MỖI BƯỚC**
- Checklist trước khi quay (30 phút trước)
- Checklist trong lúc quay
- Checklist sau khi quay
- Troubleshooting guide

👉 **Action**: In ra và check từng mục một

---

### 3. ⚡ **DEMO_QUICK_REFERENCE.md** - THAM KHẢO NHANH
**MỞ TRÊN MÀN HÌNH THỨ 2**
- AWS Console URLs (copy & paste)
- Terminal commands
- Script đọc trong video
- Timeline chính xác đến giây
- Keyboard shortcuts

👉 **Action**: Mở sẵn để tham khảo khi cần

---

### 4. 📄 **DEMO_CHEAT_SHEET.md** - BẢNG TÓM TẮT 1 TRANG
**IN RA & ĐỂ BÊN CẠNH KHI QUAY**
- Timeline tóm tắt
- Script ngắn gọn
- Commands quan trọng
- Điểm cần zoom in
- Emergency fixes

👉 **Action**: In ra, để bên laptop khi quay video

---

### 5. 🛠️ **Scripts Hỗ Trợ**

#### `scripts/pre-demo-check.ps1`
**CHẠY TRƯỚC KHI QUAY ĐỂ KIỂM TRA**
```powershell
cd E:\video\video-api
.\scripts\pre-demo-check.ps1 -Domain "yourname.cab432.com"
```
Kiểm tra:
- ECS services running
- SQS queues configured
- Auto-scaling policy
- Certificate & HTTPS
- Terraform state
- Demo scripts

#### `scripts/monitor-demo-autoscaling.ps1`
**CHẠY TRONG TERMINAL RIÊNG KHI DEMO AUTO-SCALING**
```powershell
cd E:\video\video-api
.\scripts\monitor-demo-autoscaling.ps1
```
Real-time monitoring:
- Desired/Running/Pending tasks count
- Recent events
- Status indicator (when to record)

---

## 🎯 QUY TRÌNH THỰC HIỆN (Step by Step)

### BƯỚC 1: CHUẨN BỊ (1-2 ngày trước)
1. ✅ Đọc toàn bộ `VIDEO_DEMO_10MIN_GUIDE.md`
2. ✅ Đọc assignment requirements (đã có)
3. ✅ Hiểu rõ 8 sections cần demo
4. ✅ Install OBS Studio (nếu chưa có)

### BƯỚC 2: KIỂM TRA HỆ THỐNG (1 ngày trước)
1. ✅ Chạy pre-flight check:
```powershell
.\scripts\pre-demo-check.ps1 -Domain "yourname.cab432.com"
```

2. ✅ Fix tất cả issues (nếu có)
3. ✅ Test load test script:
```powershell
node scripts/test-transcoding-autoscaling.js
```

4. ✅ Confirm auto-scaling works:
   - Scale out: 1 → 3 tasks
   - Scale in: 3 → 1 tasks

### BƯỚC 3: PRACTICE (Ngày trước hoặc sáng sớm)
1. ✅ Practice run 1: Theo script, không record
2. ✅ Check timing (có thể sẽ > 10 phút lần đầu)
3. ✅ Practice run 2: Record thử, xem lại
4. ✅ Điều chỉnh speed và script

### BƯỚC 4: CHUẨN BỊ QUAY CHÍNH THỨC (30 phút trước)
1. ✅ Chạy `DEMO_CHECKLIST.md` - tick tất cả items
2. ✅ Mở 7 AWS Console tabs
3. ✅ Setup OBS Studio:
   - Scene: Desktop capture
   - Audio: Microphone
   - Settings: 1920x1080, 30fps, H.264
4. ✅ Dọn dẹp desktop
5. ✅ Tắt notifications
6. ✅ In `DEMO_CHEAT_SHEET.md` để bên cạnh

### BƯỚC 5: QUAY VIDEO (2-3 giờ - bao gồm waiting time)

#### Phần 1-4: Quay liên tục (4.5 phút)
1. ▶️ Start recording
2. 🎬 Demo sections 1-4 (Microservices → Communication)
3. ⏸️ Giữ recording

#### Phần 5: Auto-Scaling (với edit)
4. 🎬 Show initial state (1 task)
5. 🎬 Start load test
6. ⏸️ **PAUSE recording** 
7. ⏰ Wait 5-10 minutes (monitor với script)
8. ▶️ **RESUME recording**
9. 🎬 Show 3 tasks + metrics
10. 🎬 Stop load test
11. ⏸️ **PAUSE recording**
12. ⏰ Wait 10-15 minutes
13. ▶️ **RESUME recording**
14. 🎬 Show 1 task

#### Phần 6-8: Quay tiếp (3 phút)
15. 🎬 Demo HTTPS
16. 🎬 Demo Container Orchestration
17. 🎬 Demo Infrastructure as Code
18. ⏹️ Stop recording

### BƯỚC 6: EDIT VIDEO (1-2 giờ)
1. ✅ Import video vào editor (DaVinci Resolve free)
2. ✅ Cut phần waiting trong auto-scaling
3. ✅ Ensure smooth transitions
4. ✅ Check total time ≤ 10:00
5. ✅ Export: MP4, H.264, 1920x1080, 30fps

### BƯỚC 7: QUALITY CHECK
1. ✅ Play entire video
2. ✅ Check text readable
3. ✅ Check audio clear
4. ✅ Check timing
5. ✅ Check no personal info visible

### BƯỚC 8: SUBMIT
1. ✅ Go to Canvas → CAB432 A03: Cloud project (Video)
2. ✅ Upload video file
3. ✅ **CLICK SUBMIT BUTTON** ⚠️ (quan trọng!)
4. ✅ Confirm submission successful

---

## ⏰ TIME ESTIMATE

| Activity | Time Required |
|----------|---------------|
| Đọc tài liệu | 1-2 hours |
| Pre-flight check & fixes | 2-4 hours |
| Practice runs (2x) | 1 hour |
| Preparation | 30 mins |
| Recording (with waits) | 2-3 hours |
| Video editing | 1-2 hours |
| Quality check & upload | 30 mins |
| **TOTAL** | **8-13 hours** |

💡 **Tip**: Làm trong 2 ngày:
- **Ngày 1**: Đọc docs + Pre-flight check + Practice
- **Ngày 2**: Record + Edit + Submit

---

## 📋 SECTIONS DEMO (Theo Assignment Requirements)

Bạn đã bỏ **Edge Caching** và **Serverless**, nên demo 8 sections:

### ✅ Core Criteria (6 marks)
1. ✅ **Microservices** (3 marks) - 4 services on ECS
2. ✅ **Load Distribution** (2 marks) - SQS queue
3. ✅ **Auto Scaling** (3 marks) - 1→3→1 tasks
4. ✅ **HTTPS** (2 marks) - ACM + ALB + custom domain

### ✅ Additional Criteria (8 marks)
5. ✅ **Additional Microservices** (2 marks) - 4 total (đã có)
6. ✅ **Container Orchestration (ECS)** (2 marks) - ECS services
7. ✅ **Advanced ECS Features** (2 marks) - Rolling updates, scheduled tasks
8. ✅ **Communication Mechanisms** (2 marks) - ALB routing
9. ✅ **Dead Letter Queue** (2 marks) - SQS DLQ
10. ✅ **Infrastructure as Code** (2 marks) - Terraform

**Tổng potential**: 10 marks (Core) + 12 marks (Additional) = 22 marks (cần 14)
**Bạn có thể đạt**: 10 + 12 = 22/14 marks ✅

---

## 🎓 DEMO REQUIREMENTS CHECKLIST

### Video Requirements (từ assignment)
- [x] ≤ 10 minutes
- [x] Screen capture (high quality)
- [x] Show functionality (not just explain)
- [x] Follow structure in specification
- [x] Demonstrate working features

### Core Demonstrations
- [x] Show each microservice deployed on AWS
- [x] Show load distribution mechanism (SQS)
- [x] Demonstrate auto-scaling: 1→3→1 (with metrics)
- [x] Show HTTPS with lock icon + certificate

### Additional Demonstrations  
- [x] Show DLQ messages appearing
- [x] Show ALB/communication mechanisms
- [x] Show ECS container orchestration features
- [x] Show terraform state/resources

---

## 🚨 TROUBLESHOOTING COMMON ISSUES

### Issue: Auto-scaling không trigger
**Solutions:**
1. Lower CPU target từ 70% → 50%
2. Check CloudWatch alarm state
3. Increase load test intensity
4. Check ECS service có auto-scaling policy

### Issue: Services không running
**Solution:**
```powershell
aws ecs update-service --cluster video-processing-cluster --service [service-name] --force-new-deployment --region ap-southeast-2
```

### Issue: HTTPS không work
**Solutions:**
1. Check certificate status = "Issued"
2. Check ALB listener port 443
3. Check Route53 CNAME record
4. Wait 5-10 minutes for DNS propagation

### Issue: Video quá 10 phút
**Solutions:**
1. Cut explanations (show > tell)
2. Speed up AWS console navigation (1.2x)
3. Tighten editing trong auto-scaling section
4. Remove redundant information

### Issue: DLQ không có messages
**Solution:**
1. Manually create failing job
2. Modify worker để force failure
3. Check queue redrive policy configured

---

## 💡 PRO TIPS

### Recording
1. 🎤 **Audio**: Dùng external mic nếu có (quality tốt hơn)
2. 🖥️ **Display**: 1920x1080 resolution cho clear text
3. ⌨️ **Shortcuts**: Learn OBS shortcuts cho pause/resume nhanh
4. 🎬 **Multiple takes**: OK để quay lại sections nếu cần

### Editing
1. ✂️ **Cuts**: Clean cuts khi pause/resume
2. ⏱️ **Transitions**: Simple cuts, không cần fancy transitions
3. 🎵 **Audio**: Maintain consistent volume
4. 📊 **Timing**: Export với exact 10:00 or slightly under

### Presentation
1. 👀 **Zoom in**: Khi show text quan trọng
2. 🖱️ **Cursor**: Move cursor smooth, không nervous
3. 🗣️ **Speaking**: Clear và moderate pace
4. 😊 **Confidence**: Bạn biết system của mình, tự tin!

---

## 📞 SUPPORT RESOURCES

### Assignment Resources
- Assignment specification: Canvas
- Submission page: Canvas → A03: Cloud project (Video)
- Teaching team: cab432@qut.edu.au

### Technical Resources
- AWS Console: https://console.aws.amazon.com
- OBS Studio: https://obsproject.com
- DaVinci Resolve (free): https://www.blackmagicdesign.com/products/davinciresolve

### Your Documentation
- Architecture docs: Check your repo
- Terraform code: `infrastructure/terraform/`
- Service configs: Each service folder

---

## ✅ FINAL CHECKLIST BEFORE SUBMIT

- [ ] Video duration ≤ 10:00
- [ ] All 8 sections demonstrated
- [ ] Auto-scaling clearly shown (1→3→1)
- [ ] HTTPS with 🔒 visible
- [ ] Text readable throughout
- [ ] Audio clear throughout
- [ ] No personal information visible
- [ ] File size reasonable (< 500MB)
- [ ] Tested playback works
- [ ] Uploaded to Canvas
- [ ] **SUBMIT button clicked** ⚠️

---

## 🎊 YOU'RE READY!

Bạn có đầy đủ:
- ✅ Chi tiết hướng dẫn từng bước
- ✅ Scripts tự động check
- ✅ Checklist đầy đủ
- ✅ Quick reference
- ✅ Troubleshooting guide

**Bây giờ chỉ cần execute! 💪**

---

## 📝 QUICK START (TL;DR)

```powershell
# 1. Pre-flight check
cd E:\video\video-api
.\scripts\pre-demo-check.ps1 -Domain "yourname.cab432.com"

# 2. Print cheat sheet
# Open DEMO_CHEAT_SHEET.md và in ra

# 3. Practice
# Làm theo VIDEO_DEMO_10MIN_GUIDE.md

# 4. Record
# Dùng OBS Studio, follow DEMO_CHECKLIST.md

# 5. Edit & Submit
# Edit auto-scaling section, submit to Canvas
```

---

**CHÚC BẠN DEMO THÀNH CÔNG! 🚀🎥**

*Remember: Show > Tell | Quality > Speed | Confidence > Perfection*

