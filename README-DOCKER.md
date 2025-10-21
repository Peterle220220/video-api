# 🐳 Docker Compose Setup Guide

## **HƯỚNG DẪN BUILD VÀ CHẠY BẰNG DOCKER COMPOSE**

### **📋 Yêu cầu:**
- Docker Desktop đã được cài đặt
- Docker Compose đã được cài đặt
- Port 3000, 3001, 3002, 3003, 80 đã được giải phóng

### **🚀 CÁCH BUILD VÀ CHẠY:**

#### **Cách 1: Sử dụng Batch Script (Windows)**
```bash
# Chạy script batch
scripts\build-docker.bat
```

#### **Cách 2: Sử dụng PowerShell Script**
```bash
# Chạy script PowerShell
.\scripts\docker-build.ps1
```

#### **Cách 3: Sử dụng npm scripts**
```bash
# Build và chạy tất cả services
npm run docker-build

# Chạy services (không build)
npm run docker-start

# Dừng services
npm run docker-stop

# Xem logs
npm run docker-logs

# Xem status containers
npm run docker-ps
```

#### **Cách 4: Sử dụng Docker Compose trực tiếp**
```bash
# Set environment variables (Windows)
set AWS_REGION=ap-southeast-2
set AWS_ACCESS_KEY_ID=ASIA5DYSEEJ4QHYJLKMQ
set AWS_SECRET_ACCESS_KEY=zyq30lRvNmB7egwzjrM7WtgTfxTPj+THOpTssLdL
set COGNITO_USER_POOL_ID=ap-southeast-2_wgTgFFTuB
set COGNITO_CLIENT_ID=1o00oog3qb82t1qgvi62lfv9fa
set S3_BUCKET_NAME=cab432-a2-n12122882
set DYNAMODB_TABLE_NAME=cab432-a2-n12122882-metadata
set ASSEMBLY_AI_API_KEY=420c9f6d29f742e587313b9764794f45
set AAI_API_BASE=https://api.assemblyai.com/v2
set SQS_TRANSCODING_QUEUE_URL=https://sqs.ap-southeast-2.amazonaws.com/901444280953/transcoding-queue
set SQS_UPLOAD_QUEUE_URL=https://sqs.ap-southeast-2.amazonaws.com/901444280953/upload-queue
set SQS_STORAGE_QUEUE_URL=https://sqs.ap-southeast-2.amazonaws.com/901444280953/storage-queue
set SQS_NOTIFICATIONS_QUEUE_URL=https://sqs.ap-southeast-2.amazonaws.com/901444280953/notifications-queue

# Build và chạy
docker-compose up --build -d
```

### **🌐 TRUY CẬP SAU KHI BUILD:**

- **Web Application**: http://localhost:3000
- **Nginx Load Balancer**: http://localhost:80
- **Auth Service**: http://localhost:3001
- **Transcoding Service**: http://localhost:3002
- **Upload Service**: http://localhost:3003

### **📊 QUẢN LÝ SERVICES:**

```bash
# Xem logs của tất cả services
docker-compose logs -f

# Xem logs của service cụ thể
docker-compose logs -f auth
docker-compose logs -f transcoding
docker-compose logs -f upload
docker-compose logs -f sqs-worker

# Restart service
docker-compose restart auth

# Scale transcoding service (3 instances)
docker-compose up --scale transcoding=3

# Xem resource usage
docker stats

# Xem status containers
docker-compose ps

# Stop tất cả services
docker-compose down

# Stop và xóa volumes
docker-compose down -v
```

### **🔧 CẤU TRÚC SERVICES:**

1. **Web Service** (Port 3000): React frontend
2. **Auth Service** (Port 3001): Authentication và authorization
3. **Transcoding Service** (Port 3002): Video transcoding
4. **Upload Service** (Port 3003): File upload và AssemblyAI
5. **SQS Worker**: Background processing
6. **Nginx** (Port 80): Load balancer và reverse proxy

### **⚠️ LƯU Ý:**

- Đảm bảo AWS credentials hợp lệ
- SQS queues phải được tạo trước
- S3 bucket và DynamoDB table phải tồn tại
- Cognito User Pool phải được cấu hình đúng

### **🐛 TROUBLESHOOTING:**

#### **Lỗi "InvalidClientTokenId":**
- Kiểm tra AWS credentials
- Đảm bảo credentials chưa hết hạn

#### **Lỗi "QueueDoesNotExist":**
- Tạo SQS queues trong AWS Console
- Kiểm tra queue URLs trong environment variables

#### **Lỗi "Container không start":**
```bash
# Xem logs chi tiết
docker-compose logs <service-name>

# Restart service
docker-compose restart <service-name>

# Rebuild service
docker-compose up --build <service-name>
```

#### **Port conflicts:**
```bash
# Kiểm tra port đang sử dụng
netstat -an | findstr :3000
netstat -an | findstr :3001
netstat -an | findstr :3002
netstat -an | findstr :3003
netstat -an | findstr :80

# Stop process sử dụng port
taskkill /PID <PID> /F
```

### **📈 MONITORING:**

```bash
# Xem resource usage
docker stats

# Xem disk usage
docker system df

# Clean up unused resources
docker system prune -a
```

### **🎯 TESTING:**

```bash
# Test health endpoints
curl http://localhost:3001/health
curl http://localhost:3002/health
curl http://localhost:3003/health

# Test API endpoints
curl http://localhost:3001/api/auth/health
curl http://localhost:3002/api/transcoding/health
curl http://localhost:3003/api/storage/health
```
