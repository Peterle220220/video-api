# Khắc phục lỗi Authentication giữa các Services

## Vấn đề đã được khắc phục

### 1. Lỗi Module Not Found
- **Lỗi:** `Cannot find module '../../../shared/middleware/auth'`
- **Nguyên nhân:** Đường dẫn import không đúng trong container
- **Giải pháp:** Sửa đường dẫn từ `../../../shared/middleware/auth` thành `../../shared/middleware/auth`

### 2. Lỗi Token không được truyền
- **Lỗi:** `"Invalid or expired token"` khi gọi API transcoding/upload sau khi đăng nhập
- **Nguyên nhân:** Các services sử dụng middleware authentication riêng thay vì shared middleware
- **Giải pháp:** Cập nhật tất cả services sử dụng shared middleware để verify token với auth service

## Cấu trúc Authentication mới

```
Client Request
    ↓
Transcoding/Upload Service
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

## Các thay đổi đã thực hiện

### 1. Cập nhật Shared Middleware
```javascript
// shared/middleware/auth.js
const authenticateToken = async (req, res, next) => {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) return res.status(401).json({ error: 'Access token required' });

    const response = await serviceCommunication.auth.verifyToken(token);
    if (!response?.success) return res.status(401).json({ error: 'Invalid token' });

    req.user = response.user;
    next();
};
```

### 2. Cập nhật Transcoding Service
- Import shared middleware: `require('../../shared/middleware/auth')`
- Sử dụng `authenticateToken` middleware cho tất cả protected routes

### 3. Cập nhật Upload Service
- Import shared middleware: `require('../../shared/middleware/auth')`
- Sử dụng `authenticateToken` middleware cho tất cả protected routes

### 4. Cập nhật Docker Configuration
- Thêm volume mounts cho shared middleware trong tất cả services
- Cập nhật Dockerfile để không copy shared folder (được mount qua volume)

## Cách sử dụng

### 1. Khởi động lại services

**Windows:**
```cmd
scripts\fix-all-services-auth.bat
```

**Linux/Mac:**
```bash
./scripts/fix-all-services-auth.sh
```

### 2. Test authentication

```bash
node scripts/test-authentication-flow.js
```

### 3. Sử dụng trong ứng dụng

**Frontend (React):**
```javascript
// Token được tự động thêm vào requests qua interceptor
const response = await transcodingApi.get('/api/transcoding/library?page=1&limit=10');
```

**Backend (Service-to-service):**
```javascript
// Gọi API transcoding từ service khác
const response = await transcodingClient.get('/api/transcoding/library?page=1&limit=10');
```

## API Endpoints được bảo vệ

### Auth Service (không cần token)
- `GET /health`
- `GET /api/auth/test`
- `POST /api/auth/login`
- `POST /api/auth/register`
- `POST /api/auth/confirm`

### Auth Service (cần token)
- `GET /api/auth/profile`

### Transcoding Service (cần token)
- `POST /api/transcoding/start`
- `GET /api/transcoding/jobs`
- `GET /api/transcoding/status/:jobId`
- `GET /api/transcoding/library`
- `GET /api/transcoding/videos/:videoId/transcoded`
- `GET /api/transcoding/metadata/:videoId/:resolution`
- `DELETE /api/transcoding/videos/:videoId`

### Upload Service (cần token)
- `POST /api/storage/presign-upload`
- `POST /api/storage/process-assemblyai`
- `GET /api/videos/:videoId`

## Troubleshooting

### Nếu gặp lỗi "Module not found"
1. **Kiểm tra volume mount:**
   ```bash
   docker exec transcoding ls -la /app/shared
   docker exec upload ls -la /app/shared
   ```

2. **Rebuild services:**
   ```bash
   docker-compose down
   docker-compose build transcoding upload
   docker-compose up -d transcoding upload
   ```

### Nếu gặp lỗi "Invalid or expired token"
1. **Kiểm tra auth service có chạy không:**
   ```bash
   curl http://localhost:3001/health
   ```

2. **Kiểm tra token có hợp lệ không:**
   ```bash
   curl -H "Authorization: Bearer YOUR_TOKEN" \
     http://localhost:3001/api/auth/profile
   ```

3. **Kiểm tra logs:**
   ```bash
   docker logs transcoding
   docker logs upload
   docker logs auth
   ```

### Nếu gặp lỗi network
1. **Kiểm tra services có thể giao tiếp với nhau:**
   ```bash
   docker exec transcoding curl http://auth:3001/health
   docker exec upload curl http://auth:3001/health
   ```

## Lưu ý quan trọng

1. **Token phải được gửi trong header:** `Authorization: Bearer <token>`
2. **Auth service phải chạy trước các services khác**
3. **Shared middleware phải được mount đúng cách qua volume**
4. **Tất cả API endpoints đều cần authentication trừ health check và public auth endpoints**

## Testing

Để test đầy đủ authentication flow:

1. **Khởi động services** (như hướng dẫn ở trên)
2. **Test authentication** (như hướng dẫn ở trên)
3. **Test với token thực:**
   - Đăng nhập qua frontend để lấy token
   - Gọi API transcoding/upload với token
   - Xác nhận các API hoạt động đúng

Authentication system bây giờ đã được thống nhất và hoạt động đúng cách giữa tất cả các services!
