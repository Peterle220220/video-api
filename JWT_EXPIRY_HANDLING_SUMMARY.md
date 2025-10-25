# JWT Expiry Handling - Tóm tắt sửa lỗi

## Vấn đề
Khi JWT token hết hạn, hệ thống không trả về status code 401 một cách nhất quán, khiến web frontend không thể detect được token hết hạn để signout user.

## Giải pháp đã thực hiện

### 1. ✅ Thêm endpoint `/verify` vào Auth Service
**File:** `auth-service/src/routes/auth.js`

- Thêm endpoint `POST /api/auth/verify` để các service khác có thể verify JWT token
- Xử lý `TokenExpiredError` và trả về 401 với message "Token expired"
- Trả về thông tin user khi token hợp lệ

```javascript
// Verify JWT token endpoint for other services
router.post('/verify', async (req, res) => {
    try {
        const { token } = req.body;
        if (!token) {
            return res.status(400).json({ 
                success: false, 
                error: 'Token is required' 
            });
        }

        const decoded = await verifyJwt(token);
        // ... xử lý user data ...
        
        return res.json({
            success: true,
            user: { /* user data */ }
        });
    } catch (error) {
        // Check if it's a JWT expired error
        if (error.name === 'TokenExpiredError') {
            return res.status(401).json({ 
                success: false, 
                error: 'Token expired' 
            });
        }
        
        return res.status(401).json({ 
            success: false, 
            error: 'Invalid token' 
        });
    }
});
```

### 2. ✅ Sửa middleware auth trong Video API
**File:** `video-api/src/middleware/auth.js`

- Thêm xử lý `TokenExpiredError` để trả về 401 thay vì 403
- Phân biệt giữa token expired (401) và invalid token (403)

```javascript
} catch (e) {
    // Check if it's a JWT expired error
    if (e.name === 'TokenExpiredError') {
        return res.status(401).json({ error: 'Token expired' });
    }
    return res.status(403).json({ error: 'Invalid token' });
}
```

### 3. ✅ Kiểm tra các service khác
Các service sau đã có xử lý JWT expiry đúng cách:
- ✅ `transcoding-service/src/middleware/auth.js` - Đã có xử lý TokenExpiredError
- ✅ `upload-service/src/middleware/auth.js` - Đã có xử lý TokenExpiredError  
- ✅ `shared/middleware/auth.js` - Đã có xử lý token expired
- ✅ `sqs-worker/shared/middleware/auth.js` - Đã có xử lý token expired

### 4. ✅ Tạo script test
**File:** `scripts/test-jwt-expiry.js`

- Script để test JWT expiry handling trên tất cả services
- Tạo expired JWT token và test các endpoints
- Kiểm tra response status code và error message

## Kết quả

### Trước khi sửa:
- ❌ Video API trả về 403 cho expired token
- ❌ Auth service không có endpoint `/verify`
- ❌ Không nhất quán trong xử lý JWT expiry

### Sau khi sửa:
- ✅ Tất cả services trả về 401 cho expired token
- ✅ Auth service có endpoint `/verify` để verify token
- ✅ Web frontend có thể detect expired token và signout user
- ✅ Nhất quán trong xử lý JWT expiry across all services

## Cách test

```bash
# Chạy script test
node scripts/test-jwt-expiry.js
```

Script sẽ test:
- Auth Service `/verify` endpoint
- Video API với expired token
- Transcoding Service với expired token  
- Upload Service với expired token

## Lưu ý cho Web Frontend

Web frontend nên:
1. Check response status code 401
2. Check error message "Token expired" 
3. Tự động signout user khi detect expired token
4. Redirect về login page

```javascript
// Example frontend handling
if (response.status === 401 && response.error === 'Token expired') {
    // Signout user
    localStorage.removeItem('token');
    window.location.href = '/login';
}
```
