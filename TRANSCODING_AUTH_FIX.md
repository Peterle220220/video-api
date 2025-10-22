# Khắc phục lỗi Authentication trong Transcoding Service

## Vấn đề
Lỗi: `"Invalid or expired token"` khi gọi API `http://localhost:3002/api/transcoding/library?page=1&limit=10`

## Nguyên nhân
1. **Transcoding service sử dụng middleware authentication riêng** thay vì shared middleware
2. **Token không được verify đúng cách** giữa các services
3. **Shared middleware không được mount** vào transcoding service

## Giải pháp đã áp dụng

### 1. Cập nhật transcoding service sử dụng shared middleware
- Thay đổi import từ `../middleware/auth` thành `../../../shared/middleware/auth`
- Shared middleware gọi auth service để verify token thay vì verify trực tiếp

### 2. Cập nhật Docker configuration
- Thêm volume mount cho shared middleware: `./shared:/app/shared:ro`
- Cập nhật build context để bao gồm shared directory
- Cập nhật Dockerfile để copy shared middleware

### 3. Cập nhật docker-compose.yml
```yaml
transcoding:
  build:
    context: .
    dockerfile: ./transcoding-service/Dockerfile
  volumes:
    - ./shared:/app/shared:ro
```

## Cách sử dụng

### Bước 1: Rebuild transcoding service

**Windows:**
```cmd
scripts\fix-transcoding-auth.bat
```

**Linux/Mac:**
```bash
./scripts/fix-transcoding-auth.sh
```

**Hoặc manual:**
```bash
docker-compose down transcoding
docker-compose build transcoding
docker-compose up -d transcoding
```

### Bước 2: Test authentication

```bash
# Test với script
node scripts/test-transcoding-auth.js

# Test manual
curl http://localhost:3002/health
curl http://localhost:3002/api/transcoding/library?page=1&limit=10
```

### Bước 3: Test với token hợp lệ

1. **Login để lấy token:**
```bash
curl -X POST http://localhost:3001/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"your_username","password":"your_password"}'
```

2. **Sử dụng token để gọi transcoding API:**
```bash
curl -H "Authorization: Bearer YOUR_TOKEN_HERE" \
  http://localhost:3002/api/transcoding/library?page=1&limit=10
```

## Kiểm tra kết quả

### ✅ Các endpoint hoạt động đúng:
- `GET /health` - Không cần auth
- `GET /api/transcoding/library` - Cần auth token
- `POST /api/transcoding/start` - Cần auth token
- Tất cả endpoints khác đều cần auth token

### ✅ Authentication flow:
1. Client gửi request với `Authorization: Bearer <token>`
2. Transcoding service gọi shared middleware
3. Shared middleware gọi auth service để verify token
4. Auth service trả về user data nếu token hợp lệ
5. Request được xử lý với user context

## Troubleshooting

### Nếu vẫn gặp lỗi "Invalid or expired token":
1. **Kiểm tra auth service có chạy không:**
   ```bash
   curl http://localhost:3001/health
   ```

2. **Kiểm tra transcoding service có chạy không:**
   ```bash
   curl http://localhost:3002/health
   ```

3. **Kiểm tra logs:**
   ```bash
   docker logs transcoding
   docker logs auth
   ```

4. **Kiểm tra token có hợp lệ không:**
   ```bash
   curl -H "Authorization: Bearer YOUR_TOKEN" \
     http://localhost:3001/api/auth/profile
   ```

### Nếu gặp lỗi "Module not found":
1. **Kiểm tra shared middleware có được mount không:**
   ```bash
   docker exec transcoding ls -la /app/shared
   ```

2. **Rebuild container:**
   ```bash
   docker-compose down transcoding
   docker-compose build transcoding
   docker-compose up -d transcoding
   ```

## Lưu ý quan trọng

1. **Token phải được gửi trong header Authorization:** `Bearer <token>`
2. **Auth service phải chạy trước transcoding service**
3. **Shared middleware phải được mount đúng cách**
4. **Tất cả API endpoints đều cần authentication trừ health check**

## Cấu trúc Authentication

```
Client Request
    ↓
Transcoding Service
    ↓
Shared Middleware (authenticateToken)
    ↓
Auth Service (/api/auth/profile)
    ↓
Cognito JWT Verification
    ↓
User Data returned
    ↓
Request processed with user context
```
