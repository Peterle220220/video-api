# 🚀 Hướng Dẫn Deploy Services Lên ECS

## 📋 Mục Lục
- [Vấn Đề Gặp Phải](#-vấn-đề-gặp-phải)
- [Giải Pháp](#-giải-pháp)
- [Cách Deploy](#-cách-deploy)
- [Kiểm Tra Deployment](#-kiểm-tra-deployment)
- [Troubleshooting](#-troubleshooting)

---

## 🔍 Vấn Đề Gặp Phải

### 1. **Không truy cập được `n12122882.cab432.com:3001/health`**

**Nguyên nhân:**
- ALB (Application Load Balancer) chỉ lắng nghe trên port 443 (HTTPS) và 80 (HTTP)
- Port 3001, 3002, 3003 là **internal ports** giữa ALB và ECS containers
- Không thể truy cập trực tiếp vào các ports này từ internet

**Cách truy cập đúng:**
```
❌ SAI:   http://n12122882.cab432.com:3001/health
✅ ĐÚNG:  https://n12122882.cab432.com/api/auth/health

❌ SAI:   http://n12122882.cab432.com:3002/health  
✅ ĐÚNG:  https://n12122882.cab432.com/api/transcoding/health

❌ SAI:   http://n12122882.cab432.com:3003/health
✅ ĐÚNG:  https://n12122882.cab432.com/api/storage/health
```

### 2. **Health Check Endpoint Không Khớp**

**Vấn đề ban đầu:**
- ALB Target Groups tìm endpoint: `/api/auth/health`, `/api/transcoding/health`, `/api/storage/health`
- Nhưng các services chỉ có endpoint `/health` ở root level
- Kết quả: Health checks failed → Services không healthy → Không thể truy cập

**Đã fix:**
- ✅ Thêm health check endpoint vào mỗi service route:
  - `auth-service/src/routes/auth.js` → thêm `GET /health`
  - `transcoding-service/src/routes/transcoding.js` → thêm `GET /health`
  - `upload-service/src/routes/storage.js` → thêm `GET /health`

---

## 🛠️ Giải Pháp

### Architecture Overview

```
Internet
    ↓
CloudFront (HTTPS) → ALB (port 443)
                      ↓
    ┌─────────────────┼─────────────────┐
    ↓                 ↓                  ↓
Web Service    Auth Service    Transcoding Service    Upload Service
(port 3000)     (port 3001)       (port 3002)         (port 3003)
    ↑                 ↑                  ↑                 ↑
    └─────────────────┴──────────────────┴─────────────────┘
              ECS Cluster (Private Network)
```

### ALB Routing Rules

| Path Pattern        | Target Service       | Container Port |
|---------------------|---------------------|----------------|
| `/api/auth/*`       | auth-service        | 3001           |
| `/api/transcoding/*`| transcoding-service | 3002           |
| `/api/storage/*`    | upload-service      | 3003           |
| `/api/videos/*`     | upload-service      | 3003           |
| `/` (default)       | web                 | 3000           |

---

## 🚀 Cách Deploy

### Option 1: Deploy Tất Cả Services (Recommended)

```powershell
# Deploy tất cả services cùng lúc
cd E:\video\video-api
.\scripts\deploy-all-services.ps1
```

**Script sẽ thực hiện:**
1. ✅ Login vào ECR
2. ✅ Build Docker images cho tất cả services
3. ✅ Push images lên ECR
4. ✅ Trigger deployment cho tất cả ECS services

**Thời gian:** ~10-15 phút (tùy tốc độ mạng)

---

### Option 2: Deploy Từng Service Riêng Lẻ

```powershell
# Deploy chỉ auth service
.\scripts\deploy-single-service.ps1 -ServiceName auth

# Deploy chỉ transcoding service  
.\scripts\deploy-single-service.ps1 -ServiceName transcoding

# Deploy chỉ upload service
.\scripts\deploy-single-service.ps1 -ServiceName upload

# Deploy chỉ web service
.\scripts\deploy-single-service.ps1 -ServiceName web

# Deploy chỉ sqs-worker
.\scripts\deploy-single-service.ps1 -ServiceName sqs-worker
```

**Thời gian mỗi service:** ~3-5 phút

---

### Option 3: Chỉ Deploy (Không Build)

Nếu bạn đã build và push images rồi, chỉ muốn trigger deployment:

```powershell
# Deploy tất cả (skip build & push)
.\scripts\deploy-all-services.ps1 -OnlyDeploy

# Deploy một service
.\scripts\deploy-single-service.ps1 -ServiceName auth -OnlyDeploy
```

---

### Option 4: Deploy Thủ Công (Manual)

#### Bước 1: Build Docker Image

```powershell
# Auth Service
docker build -t 901444280953.dkr.ecr.ap-southeast-2.amazonaws.com/n12122882-cab432-a3-auth-service:latest -f auth-service/Dockerfile auth-service

# Transcoding Service
docker build -t 901444280953.dkr.ecr.ap-southeast-2.amazonaws.com/n12122882-cab432-a3-transcoding-service:latest -f transcoding-service/Dockerfile transcoding-service

# Upload Service
docker build -t 901444280953.dkr.ecr.ap-southeast-2.amazonaws.com/n12122882-cab432-a3-upload-service:latest -f upload-service/Dockerfile upload-service

# Web Service
docker build -t 901444280953.dkr.ecr.ap-southeast-2.amazonaws.com/n12122882-cab432-a3-web:latest -f web/Dockerfile web

# SQS Worker
docker build -t 901444280953.dkr.ecr.ap-southeast-2.amazonaws.com/n12122882-cab432-a3-sqs-worker:latest -f sqs-worker/Dockerfile sqs-worker
```

#### Bước 2: Login vào ECR

```powershell
aws ecr get-login-password --region ap-southeast-2 | docker login --username AWS --password-stdin 901444280953.dkr.ecr.ap-southeast-2.amazonaws.com
```

#### Bước 3: Push Images

```powershell
docker push 901444280953.dkr.ecr.ap-southeast-2.amazonaws.com/n12122882-cab432-a3-auth-service:latest
docker push 901444280953.dkr.ecr.ap-southeast-2.amazonaws.com/n12122882-cab432-a3-transcoding-service:latest
docker push 901444280953.dkr.ecr.ap-southeast-2.amazonaws.com/n12122882-cab432-a3-upload-service:latest
docker push 901444280953.dkr.ecr.ap-southeast-2.amazonaws.com/n12122882-cab432-a3-web:latest
docker push 901444280953.dkr.ecr.ap-southeast-2.amazonaws.com/n12122882-cab432-a3-sqs-worker:latest
```

#### Bước 4: Deploy lên ECS

```powershell
aws ecs update-service --cluster n12122882-a3-cluster --service n12122882-cab432-a3-auth-service --force-new-deployment
aws ecs update-service --cluster n12122882-a3-cluster --service n12122882-cab432-a3-transcoding-service --force-new-deployment  
aws ecs update-service --cluster n12122882-a3-cluster --service n12122882-cab432-a3-upload-service --force-new-deployment
aws ecs update-service --cluster n12122882-a3-cluster --service n12122882-cab432-a3-web-service --force-new-deployment
aws ecs update-service --cluster n12122882-a3-cluster --service n12122882-cab432-a3-sqs-worker-service --force-new-deployment
```

---

## 🔍 Kiểm Tra Deployment

### 1. Kiểm Tra Status Qua AWS CLI

```powershell
# List tất cả services
aws ecs list-services --cluster n12122882-a3-cluster --region ap-southeast-2

# Check status của một service cụ thể
aws ecs describe-services --cluster n12122882-a3-cluster --services n12122882-cab432-a3-auth-service --region ap-southeast-2

# Xem tasks đang chạy
aws ecs list-tasks --cluster n12122882-a3-cluster --region ap-southeast-2
```

### 2. Kiểm Tra Health Endpoints

```powershell
# Test auth service
curl https://n12122882.cab432.com/api/auth/health
curl https://n12122882.cab432.com/api/auth/test

# Test transcoding service
curl https://n12122882.cab432.com/api/transcoding/health

# Test upload service  
curl https://n12122882.cab432.com/api/storage/health

# Test web
curl https://n12122882.cab432.com/
```

**Expected Response:**
```json
{
  "status": "OK",
  "service": "auth-service",
  "timestamp": "2025-10-24T...",
  "uptime": 123.456
}
```

### 3. Kiểm Tra Qua AWS Console

1. Mở ECS Console:
   ```
   https://ap-southeast-2.console.aws.amazon.com/ecs/v2/clusters/n12122882-a3-cluster/services
   ```

2. Click vào từng service để xem:
   - **Deployments**: Deployment status (PRIMARY, ACTIVE)
   - **Tasks**: Số tasks đang chạy (1/1 RUNNING)
   - **Health**: Target health trong ALB target group
   - **Logs**: CloudWatch logs

3. Check Target Groups:
   ```
   https://ap-southeast-2.console.aws.amazon.com/ec2/home?region=ap-southeast-2#TargetGroups:
   ```
   - Tất cả targets phải là **healthy**

### 4. Xem CloudWatch Logs

```powershell
# Auth service logs
aws logs tail /ecs/cab432-a3-auth --follow --region ap-southeast-2

# Transcoding service logs
aws logs tail /ecs/cab432-a3-transcoding --follow --region ap-southeast-2

# Upload service logs
aws logs tail /ecs/cab432-a3-upload --follow --region ap-southeast-2

# SQS Worker logs
aws logs tail /ecs/cab432-a3-sqs-worker --follow --region ap-southeast-2
```

---

## 🐛 Troubleshooting

### Service Không Healthy

**Triệu chứng:**
- Target group shows "unhealthy"
- Service không thể truy cập được

**Kiểm tra:**

1. **Xem logs của service:**
   ```powershell
   aws logs tail /ecs/cab432-a3-auth --follow --region ap-southeast-2
   ```

2. **Check health check path:**
   ```powershell
   aws elbv2 describe-target-health --target-group-arn <target-group-arn>
   ```

3. **Check security group:**
   - Security group phải cho phép traffic từ ALB vào container ports

### Deployment Stuck

**Triệu chứng:**
- Deployment ở trạng thái "IN_PROGRESS" quá lâu (>10 phút)

**Giải pháp:**

```powershell
# Stop deployment cũ
aws ecs update-service --cluster n12122882-a3-cluster --service <service-name> --desired-count 0
# Wait 1 minute
Start-Sleep -Seconds 60
# Start lại
aws ecs update-service --cluster n12122882-a3-cluster --service <service-name> --desired-count 1 --force-new-deployment
```

### Image Pull Error

**Triệu chứng:**
- Task failed with "CannotPullContainerError"

**Giải pháp:**

1. Check ECR login:
   ```powershell
   aws ecr get-login-password --region ap-southeast-2 | docker login --username AWS --password-stdin 901444280953.dkr.ecr.ap-southeast-2.amazonaws.com
   ```

2. Verify image exists:
   ```powershell
   aws ecr describe-images --repository-name n12122882-cab432-a3-auth-service --region ap-southeast-2
   ```

3. Re-push image nếu cần:
   ```powershell
   docker push 901444280953.dkr.ecr.ap-southeast-2.amazonaws.com/n12122882-cab432-a3-auth-service:latest
   ```

### Port Conflicts

**Lỗi:** Container không start được do port đã được dùng

**Giải pháp:**
- ECS Fargate tự động quản lý ports, không cần lo lắng về conflicts
- Nếu vẫn gặp lỗi, check task definition có đúng port mapping không

### 403 Forbidden

**Nguyên nhân:**
- CloudFront caching responses
- CORS issues

**Giải pháp:**

1. Invalidate CloudFront cache:
   ```powershell
   aws cloudfront create-invalidation --distribution-id <dist-id> --paths "/*"
   ```

2. Check CORS headers trong service

---

## 📊 Monitoring

### CloudWatch Metrics

```powershell
# CPU Utilization
aws cloudwatch get-metric-statistics --namespace AWS/ECS --metric-name CPUUtilization --dimensions Name=ServiceName,Value=n12122882-cab432-a3-auth-service Name=ClusterName,Value=n12122882-a3-cluster --start-time 2025-10-24T00:00:00Z --end-time 2025-10-24T23:59:59Z --period 3600 --statistics Average

# Memory Utilization  
aws cloudwatch get-metric-statistics --namespace AWS/ECS --metric-name MemoryUtilization --dimensions Name=ServiceName,Value=n12122882-cab432-a3-auth-service Name=ClusterName,Value=n12122882-a3-cluster --start-time 2025-10-24T00:00:00Z --end-time 2025-10-24T23:59:59Z --period 3600 --statistics Average
```

### Container Insights

Vào ECS Console → Cluster → Container Insights để xem:
- CPU usage
- Memory usage
- Network metrics
- Task count

---

## 🎯 Best Practices

### 1. Rollback Strategy

Nếu deployment có vấn đề, rollback về version trước:

```powershell
# Get previous task definition revision
aws ecs describe-services --cluster n12122882-a3-cluster --services n12122882-cab432-a3-auth-service --query 'services[0].deployments[1].taskDefinition' --output text

# Update service to use old task definition
aws ecs update-service --cluster n12122882-a3-cluster --service n12122882-cab432-a3-auth-service --task-definition <old-task-def-arn>
```

### 2. Zero-Downtime Deployment

ECS services đã được cấu hình với:
- `deployment_maximum_percent = 200%` → Cho phép chạy thêm tasks mới
- `deployment_minimum_healthy_percent = 50%` → Giữ ít nhất 50% tasks cũ
- Circuit breaker enabled → Tự động rollback nếu fail

### 3. Health Check Best Practices

- Health check interval: 30s
- Timeout: 5s
- Healthy threshold: 2 consecutive successes
- Unhealthy threshold: 2 consecutive failures

---

## 📝 Notes

1. **Thời gian deployment:** 2-5 phút per service
2. **Zero-downtime:** Rolling update được enable
3. **Auto-rollback:** Circuit breaker sẽ tự động rollback nếu deployment fail
4. **Logs retention:** CloudWatch logs kept for 7 days (có thể config)

---

## 🔗 Useful Links

- **ECS Console:** https://ap-southeast-2.console.aws.amazon.com/ecs/v2/clusters/n12122882-a3-cluster
- **ECR Console:** https://ap-southeast-2.console.aws.amazon.com/ecr/repositories
- **CloudWatch Logs:** https://ap-southeast-2.console.aws.amazon.com/cloudwatch/home?region=ap-southeast-2#logsV2:log-groups
- **Target Groups:** https://ap-southeast-2.console.aws.amazon.com/ec2/home?region=ap-southeast-2#TargetGroups
- **Web App:** https://n12122882.cab432.com/

---

## ✅ Quick Checklist

Sau khi deploy, check:

- [ ] Tất cả services đang ACTIVE trong ECS Console
- [ ] Tất cả tasks đang RUNNING (1/1)
- [ ] Target groups show "healthy"
- [ ] Health endpoints trả về 200 OK
- [ ] Web app có thể truy cập và login
- [ ] CloudWatch logs không có errors
- [ ] CloudFront distribution đang enabled

---

**Chúc bạn deploy thành công! 🎉**


