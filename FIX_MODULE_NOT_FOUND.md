# Khắc phục lỗi "Cannot find module './apiClient'"

## Vấn đề

```
Error: Cannot find module './apiClient'
Require stack:
- /app/shared/middleware/auth.js
- /app/src/routes/videos.js
- /app/src/server.js
```

## Nguyên nhân

1. **Đường dẫn require sai** trong `shared/middleware/auth.js`:
   - Đang dùng: `require('./apiClient')`
   - Đúng phải là: `require('../services/apiClient')`

2. **Thiếu dependency axios** trong `transcoding-service/package.json`
   - Shared middleware cần axios để gọi auth service
   - Transcoding service không có axios trong dependencies

## Giải pháp đã áp dụng

### 1. Sửa đường dẫn trong shared/middleware/auth.js

```javascript
// Trước
const { serviceCommunication } = require('./apiClient');

// Sau
const { serviceCommunication } = require('../services/apiClient');
```

### 2. Thêm axios vào transcoding-service/package.json

```json
"dependencies": {
  "axios": "^1.11.0",
  // ... other dependencies
}
```

## Cấu trúc thư mục Shared

```
shared/
├── middleware/
│   └── auth.js          (require('../services/apiClient'))
└── services/
    ├── apiClient.js     (requires axios)
    └── sqsService.js
```

## Cách rebuild services

### Windows:
```cmd
scripts\rebuild-services.bat
```

### Linux/Mac:
```bash
chmod +x scripts/rebuild-services.sh
./scripts/rebuild-services.sh
```

### Manual:
```bash
# Stop services
docker-compose down

# Remove old images
docker rmi video-api-transcoding video-api-upload video-api-auth

# Rebuild with no cache
docker-compose build --no-cache

# Start services
docker-compose up -d

# Check logs
docker logs transcoding
docker logs upload
docker logs auth
```

## Kiểm tra kết quả

### 1. Kiểm tra services có chạy không:
```bash
curl http://localhost:3001/health  # Auth
curl http://localhost:3002/health  # Transcoding
curl http://localhost:3003/health  # Upload
```

### 2. Kiểm tra logs không có lỗi:
```bash
docker logs transcoding --tail 50
docker logs upload --tail 50
```

### 3. Test authentication:
```bash
node scripts/test-authentication-flow.js
```

## Troubleshooting

### Nếu vẫn gặp lỗi "Cannot find module"

1. **Kiểm tra shared folder có được mount không:**
   ```bash
   docker exec transcoding ls -la /app/shared
   docker exec transcoding ls -la /app/shared/middleware
   docker exec transcoding ls -la /app/shared/services
   ```

2. **Kiểm tra axios có được cài không:**
   ```bash
   docker exec transcoding npm list axios
   ```

3. **Rebuild từ đầu:**
   ```bash
   docker-compose down -v
   docker-compose build --no-cache
   docker-compose up -d
   ```

### Nếu gặp lỗi "Cannot find module 'axios'"

1. **Xóa node_modules và rebuild:**
   ```bash
   docker-compose down
   rm -rf transcoding-service/node_modules
   rm -rf upload-service/node_modules
   docker-compose build --no-cache
   docker-compose up -d
   ```

2. **Kiểm tra package.json có axios không:**
   ```bash
   cat transcoding-service/package.json | grep axios
   cat upload-service/package.json | grep axios
   ```

## Các file đã được sửa

1. `shared/middleware/auth.js` - Sửa đường dẫn require
2. `transcoding-service/package.json` - Thêm axios dependency
3. `scripts/rebuild-services.bat` - Script rebuild cho Windows
4. `scripts/rebuild-services.sh` - Script rebuild cho Linux/Mac

## Lưu ý quan trọng

1. **Luôn rebuild với --no-cache** sau khi thay đổi package.json
2. **Kiểm tra logs** sau khi start services
3. **Shared folder phải được mount đúng** trong docker-compose.yml
4. **Tất cả services cần axios** vì shared middleware sử dụng nó

## Dependency Tree

```
transcoding-service/upload-service
└── shared/middleware/auth.js
    └── shared/services/apiClient.js
        └── axios (phải có trong package.json của mỗi service)
```

Authentication giữa các services bây giờ sẽ hoạt động đúng cách!
