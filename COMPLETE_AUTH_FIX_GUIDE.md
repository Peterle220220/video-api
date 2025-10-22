# Hướng Dẫn Khắc Phục Authentication Flow Toàn Bộ

## 🔍 Vấn Đề Được Xác Định

### 1. Module Not Found Error
```
Cannot find module '../../../shared/middleware/auth'
```

**Nguyên nhân:**
- Transcoding/Upload services không thể tìm shared middleware
- Dockerfile copy paths sai
- Build context không bao gồm shared directory

### 2. Token Không Được Truyền
**Quy trình:**
- User login vào auth service ✅
- Frontend lưu token vào localStorage ✅
- Frontend gửi request tới transcoding/upload APIs ❌
- Backend không nhận token hoặc không verify được

## ✅ Các Giải Pháp Đã Áp Dụng

### 1. Sửa Transcoding-Service Dockerfile

**File:** `transcoding-service/Dockerfile`

```dockerfile
FROM node:18-alpine

# Install FFmpeg
RUN apk add --no-cache ffmpeg

WORKDIR /app

# Copy package files từ transcoding-service directory
COPY ./transcoding-service/package.json ./
COPY ./transcoding-service/package-lock.json ./

# Install dependencies
RUN npm install --only=production

# Copy source code
COPY ./transcoding-service/src ./src

# Copy shared middleware
COPY ./shared ./shared

# Create non-root user
RUN addgroup -g 1001 -S nodejs
RUN adduser -S nodejs -u 1001

# Change ownership
RUN chown -R nodejs:nodejs /app
USER nodejs

# Expose port
EXPOSE 3002

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
    CMD node -e "require('http').get('http://localhost:3002/health', (res) => { process.exit(res.statusCode === 200 ? 0 : 1) })"

# Start the application
CMD ["npm", "start"]
```

**Thay đổi chính:**
- `COPY ./transcoding-service/package.json ./` - Copy package từ đúng directory
- `COPY ./transcoding-service/src ./src` - Copy src từ transcoding-service
- `COPY ./shared ./shared` - Copy shared middleware vào container

### 2. Sửa Upload-Service Dockerfile

**File:** `upload-service/Dockerfile`

```dockerfile
FROM node:18-alpine

WORKDIR /app

# Copy package files from upload-service
COPY ./upload-service/package.json ./
COPY ./upload-service/package-lock.json ./

# Install dependencies
RUN npm ci --only=production

# Copy source code
COPY ./upload-service/src ./src

# Copy shared middleware
COPY ./shared ./shared

# Create non-root user
RUN addgroup -g 1001 -S nodejs
RUN adduser -S nodejs -u 1001

# Change ownership
RUN chown -R nodejs:nodejs /app
USER nodejs

# Expose port
EXPOSE 3003

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
    CMD node -e "require('http').get('http://localhost:3003/health', (res) => { process.exit(res.statusCode === 200 ? 0 : 1) })"

# Start the application
CMD ["npm", "start"]
```

### 3. Cập Nhật Middleware Imports

**File:** `transcoding-service/src/routes/transcoding.js`
```javascript
const { authenticateToken } = require('../../shared/middleware/auth');
```

**File:** `upload-service/src/routes/storage.js`
```javascript
const { authenticateToken } = require('../../shared/middleware/auth');
```

**File:** `upload-service/src/routes/videos.js`
```javascript
const { authenticateToken } = require('../../shared/middleware/auth');
```

### 4. Cập Nhật docker-compose.yml

```yaml
# Transcoding Service
transcoding:
  build:
    context: .
    dockerfile: ./transcoding-service/Dockerfile
  # ... other config ...
  volumes:
    - ./shared:/app/shared:ro
  networks:
    - microservices-network

# Upload Service
upload:
  build:
    context: .
    dockerfile: ./upload-service/Dockerfile
  # ... other config ...
  volumes:
    - ./shared:/app/shared:ro
  networks:
    - microservices-network
```

**Thay đổi chính:**
- Build context từ `.` (root) thay vì `./service-name`
- Dockerfile path từ root directory
- Volume mount cho shared middleware

## 🔄 Token Flow Hoạt Động

### 1. Login Phase

```
Frontend (Login.jsx)
    ↓
POST http://localhost:3001/api/auth/login
  {
    username: "user",
    password: "password"
  }
    ↓
Auth Service validates with Cognito
    ↓
Response:
  {
    tokens: {
      idToken: "eyJhbGc...",
      accessToken: "eyJhbGc...",
      refreshToken: "eyJhbGc..."
    }
  }
    ↓
Frontend saves token:
  localStorage.setItem('token', tokens.idToken)
```

### 2. API Request with Token Phase

```
Frontend (Videos.jsx)
    ↓
transcodingApi.get('/api/transcoding/library')
    ↓
Axios interceptor (web/src/services/api.js):
  - Lấy token từ localStorage
  - Thêm vào header: Authorization: Bearer <token>
    ↓
Request:
  GET http://localhost:3002/api/transcoding/library
  Headers: {
    Authorization: "Bearer eyJhbGc..."
  }
    ↓
Transcoding Service:
  - Shared middleware (authenticateToken)
  - Parse token từ header
  - Gọi Auth Service để verify:
      GET http://localhost:3001/api/auth/profile
      Headers: { Authorization: "Bearer eyJhbGc..." }
    ↓
Auth Service:
  - Verify JWT với Cognito
  - Return user data:
      {
        success: true,
        user: {
          id: "cognito-uuid",
          username: "user",
          email: "user@example.com",
          groups: ["admin"]
        }
      }
    ↓
Transcoding Service:
  - Set req.user = user data
  - Tiếp tục xử lý request
  - Return library data
```

## 🚀 Cách Rebuild và Test

### Bước 1: Rebuild tất cả services

**Windows:**
```cmd
scripts\rebuild-all-with-auth.bat
```

**Linux/Mac:**
```bash
chmod +x scripts/rebuild-all-with-auth.sh
./scripts/rebuild-all-with-auth.sh
```

**Manual:**
```bash
docker-compose down
docker-compose build
docker-compose up -d
```

### Bước 2: Chờ services khởi động

```bash
# Kiểm tra logs
docker logs transcoding
docker logs auth
docker logs upload
```

### Bước 3: Test authentication flow

```bash
# Test script
node scripts/test-full-auth-flow.js

# Hoặc manual test
# 1. Check services
curl http://localhost:3001/health
curl http://localhost:3002/health
curl http://localhost:3003/health

# 2. Test transcoding without token (should fail)
curl http://localhost:3002/api/transcoding/library

# 3. Test with invalid token (should fail)
curl -H "Authorization: Bearer invalid" \
  http://localhost:3002/api/transcoding/library
```

### Bước 4: Test với valid token

```bash
# 1. Login để lấy token
TOKEN_RESPONSE=$(curl -s -X POST http://localhost:3001/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"testuser","password":"testpass"}')

TOKEN=$(echo $TOKEN_RESPONSE | jq -r '.tokens.idToken')

# 2. Sử dụng token gọi transcoding API
curl -H "Authorization: Bearer $TOKEN" \
  "http://localhost:3002/api/transcoding/library?page=1&limit=10"

# 3. Sử dụng token gọi upload API
curl -H "Authorization: Bearer $TOKEN" \
  -X POST http://localhost:3003/api/storage/presign-upload \
  -H "Content-Type: application/json" \
  -d '{"filename":"video.mp4","contentType":"video/mp4","fileSize":1000000}'
```

### Bước 5: Test Frontend

1. Mở browser: http://localhost:3000
2. Login với Cognito credentials
3. Nên redirect tới /videos page
4. Có thể:
   - Xem video library
   - Upload video
   - Edit video description
   - Transcode video

## 📊 Service Architecture

```
┌─────────────────────────────────────────────────────────┐
│                  Frontend (Port 3000)                    │
│  - React App                                           │
│  - Login.jsx: stores token in localStorage             │
│  - Videos.jsx: uses all APIs with token                │
│  - axios interceptors: add Authorization header        │
└──────────────┬──────────────────────────────────────────┘
               │
               │ HTTP Requests with Bearer Token
               │
      ┌────────┴────────┬────────────┬────────────┐
      ↓                 ↓            ↓            ↓
┌──────────────┐  ┌──────────────┐  ┌──────────────┐
│ Auth Service │  │ Transcoding  │  │Upload Service│
│  (Port 3001) │  │ (Port 3002)  │  │ (Port 3003)  │
├──────────────┤  ├──────────────┤  ├──────────────┤
│ /auth/login  │  │ /transcoding │  │ /storage     │
│ /auth/profile│  │ /jobs        │  │ /videos      │
│ /auth/test   │  │ /status      │  │              │
└──────┬───────┘  └──────┬───────┘  └──────┬───────┘
       │                 │                 │
       │                 │  shared/        │
       │                 │ middleware/     │
       │                 │  auth.js        │
       │                 │                 │
       └────────────────────────────────────┘
                      │
                      │ Verify Token
                      │ (internal call)
                      ↓
            ┌──────────────────────┐
            │ Cognito User Pool    │
            │ JWT Verification     │
            └──────────────────────┘
```

## ⚠️ Troubleshooting

### Error: "Cannot find module '../../../shared/middleware/auth'"

**Solution:**
```bash
docker-compose down
docker-compose build --no-cache
docker-compose up -d
```

### Error: "Access token required" with valid token

**Check:**
1. Token format: `Authorization: Bearer <token>` ✅
2. Auth service running: `curl http://localhost:3001/health` ✅
3. Check logs: `docker logs transcoding`

### Error: "Invalid token"

**Check:**
1. Token từ login response
2. Token không expired
3. Cognito configuration đúng

### Transcoding service starts but dies immediately

**Check logs:**
```bash
docker logs transcoding
```

**Common issues:**
- Shared middleware không được mount
- Package.json không được copy
- Build context sai

## 📝 Environment Variables

```bash
# AWS Configuration
AWS_REGION=ap-southeast-2
AWS_ACCESS_KEY_ID=your_key
AWS_SECRET_ACCESS_KEY=your_secret

# Cognito Configuration
COGNITO_USER_POOL_ID=ap-southeast-2_xxxxx
COGNITO_CLIENT_ID=1o00oog3qb82t1qgvi62lfv9fa
COGNITO_CLIENT_SECRET=your_secret

# S3 & DynamoDB
S3_BUCKET_NAME=your-bucket
DYNAMODB_TABLE_NAME=video-table

# Service URLs (for Docker)
AUTH_SERVICE_URL=http://auth:3001
TRANSCODING_SERVICE_URL=http://transcoding:3002
UPLOAD_SERVICE_URL=http://upload:3003

# Optional
SERVICE_AUTH_TOKEN=optional_token
```

## ✨ Kiểm Tra Hoàn Thành

- [ ] Tất cả services chạy
- [ ] Auth service verify token được
- [ ] Transcoding API nhận token
- [ ] Upload API nhận token
- [ ] Frontend login thành công
- [ ] Frontend gọi APIs với token
- [ ] Video library load được
- [ ] Upload video hoạt động
- [ ] Edit description hoạt động
- [ ] Transcode video hoạt động
