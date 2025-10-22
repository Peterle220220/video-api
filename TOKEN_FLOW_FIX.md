# Khắc phục Token Flow giữa Auth, Transcoding, và Upload Services

## Vấn đề

1. **Module not found error**: `Cannot find module '../../../shared/middleware/auth'`
2. **Token không được truyền** từ login auth → transcoding/upload APIs

## Nguyên nhân

1. **Dockerfile copy path không đúng** - package.json và shared middleware không được copy vào container đúng cách
2. **Frontend đã có token interceptor** nhưng backend không nhận token vì shared middleware không được mount

## Giải pháp đã áp dụng

### 1. Sửa Dockerfile transcoding-service

```dockerfile
# Copy package files từ transcoding-service directory
COPY ./transcoding-service/package.json ./
COPY ./transcoding-service/package-lock.json ./

# Install dependencies
RUN npm install --only=production

# Copy source code
COPY ./transcoding-service/src ./src

# Copy shared middleware
COPY ./shared ./shared
```

### 2. Sửa đường dẫn import trong transcoding.js

```javascript
// From:
const { authenticateToken } = require('../../../shared/middleware/auth');

// To:
const { authenticateToken } = require('../../shared/middleware/auth');
```

### 3. Cập nhật docker-compose.yml

```yaml
transcoding:
  build:
    context: .
    dockerfile: ./transcoding-service/Dockerfile
  volumes:
    - ./shared:/app/shared:ro
```

## Token Flow Chi Tiết

### 1. Login Flow

```
Frontend (Login.jsx)
    ↓
POST /api/auth/login (authApi)
    ↓
Auth Service validates credentials with Cognito
    ↓
Returns: { tokens: { idToken, accessToken, refreshToken } }
    ↓
Frontend saves: localStorage.setItem('token', tokens.idToken)
```

### 2. API Request Flow (with Token)

```
Frontend (Videos.jsx)
    ↓
GET /api/transcoding/library (transcodingApi)
    ↓
transcodingApi interceptor adds header:
    Authorization: Bearer <token_from_localStorage>
    ↓
Transcoding Service
    ↓
Shared Middleware (authenticateToken)
    ↓
Calls Auth Service: GET /api/auth/profile (with token in header)
    ↓
Auth Service verifies JWT with Cognito
    ↓
Returns: { success: true, user: { id, username, email, groups } }
    ↓
req.user = user data
    ↓
Route handler processes request
```

## Cấu trúc Services

```
┌─────────────────────────────────────────────────────────┐
│                   Frontend (Web)                         │
│  - Login.jsx stores token in localStorage              │
│  - Videos.jsx uses transcodingApi with token           │
│  - axios interceptors add Authorization header         │
└────────────┬────────────────────────────────────────────┘
             │ Bearer token
             ↓
┌─────────────────────────────────────────────────────────┐
│              Transcoding Service :3002                   │
│  - /api/transcoding/library                            │
│  - Uses shared/middleware/auth                         │
│  - authenticateToken middleware                        │
└────────────┬────────────────────────────────────────────┘
             │ Forward token to Auth Service
             ↓
┌─────────────────────────────────────────────────────────┐
│               Auth Service :3001                        │
│  - /api/auth/profile                                  │
│  - Verifies JWT with Cognito                          │
│  - Returns user data                                  │
└─────────────────────────────────────────────────────────┘
```

## Cách Test

### 1. Build và start services

```bash
docker-compose down
docker-compose build
docker-compose up -d
```

### 2. Test Auth Service

```bash
curl http://localhost:3001/health
curl http://localhost:3001/api/auth/test
```

### 3. Test Transcoding Service with Token

```bash
TOKEN="your_token_here"
curl -H "Authorization: Bearer $TOKEN" \
  "http://localhost:3002/api/transcoding/library?page=1&limit=10"
```

### 4. Test Frontend

1. Open browser http://localhost:3000
2. Login with Cognito credentials
3. Should redirect to /videos page
4. Can use all APIs with token
