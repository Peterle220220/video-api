## Kịch bản quay video (≤ 8 phút)

Lưu ý chung:
- Mục tiêu là TRÌNH DIỄN tính năng, nói ngắn gọn, không giải thích dài.
- Quay màn hình độ phân giải cao, mở sẵn tab AWS Console và ứng dụng web.
- Mỗi phân đoạn: nêu rất ngắn “dịch vụ” và “dữ liệu” rồi thao tác ngay.
- Sử dụng tài khoản test; có thể cắt bớt thời gian chờ upload/encode.

---

### 0) Khởi động (10–15s)
- Nói: “Đây là ứng dụng Video API. Em sẽ demo theo đúng thứ tự rubric.”
- Hiện browser: `Videos` trang chính (web client).
- Mở tab Network DevTools sẵn (để phần Pre-signed URL).

---

### 1) Core – First data persistence service: S3 (45–60s)
- Nói: “S3 dùng để lưu file video.”
- AWS Console → S3 → mở bucket `cab432-a2-n12122882`.
  - Mở folder `uploads/` và `processed/` (nếu có sẵn dữ liệu mẫu).
- Quay sang web client:
  - Chọn 1 file ngắn để upload.
  - Nhấn Upload (ứng dụng sẽ gọi presign và PUT trực tiếp lên S3).
- Quay lại S3 Console, refresh `uploads/` để thấy object mới xuất hiện.

Ghi chú thao tác ứng dụng (không đọc to, chỉ để nhớ):
- Web gọi `POST /api/storage/presign-upload` và PUT lên URL presign.
- Backend: `video-api/src/routes/storage.js`, `s3Service.presignUpload()`.

---

### 2) Core – Second data persistence service: DynamoDB (45–60s)
- Nói: “DynamoDB dùng để lưu metadata video và job.”
- AWS Console → DynamoDB → Tables → mở bảng `cab432-a2-n12122882-metadata`.
- Ở web client, sau khi upload, nhấn “Start transcoding” (hoặc việc này tự thực hiện nếu luồng đã tích hợp sau upload). Việc này tạo record video/job.
- Trở lại DynamoDB → Explore items:
  - Lọc theo partition key `qut-username = n12122882@qut.edu.au`.
  - Cho thấy item có `sk` bắt đầu bằng `VIDEO#…` (video) và `JOB#…` (job) xuất hiện/được cập nhật.

Ghi chú code:
- `video-api/src/services/db/dynamoService.js` (`putVideo`, `putJob`, `getJob`).
- `video-api/src/routes/transcoding.js` (bắt đầu job và cập nhật).

---

### 3) Additional – Third data service: Secrets Manager (30–40s)
- Nói: “Secrets Manager lưu API key cho AssemblyAI.”
- AWS Console → Secrets Manager → mở secret `cab432-a2-n12122882/ASSEMBLYAI_API_KEY`.
  - Chỉ mở trang chi tiết, KHÔNG hiển thị giá trị.
- Mở code nhanh: `video-api/src/services/external/assemblyAIService.js` (hàm `assertApiKey` lấy secret và cache vào env).

---

### 4) Additional – S3 Pre‑signed URLs (45–60s)
- Nói: “Upload/Download file video dùng Pre‑signed URL.”
- Trên web client, mở DevTools → Network.
  - Thực hiện upload file ngắn lần nữa (hoặc dùng file khác):
    - Thấy request `POST /api/storage/presign-upload` trả về `uploadUrl`.
    - Thấy tiếp request `PUT https://s3…` với header `Content-Type`.
  - Sau khi transcoding xong (có thể dùng video đã sẵn sàng), mở mục xem video:
    - Bấm play một bản `720p`/`480p`. Trong Network sẽ thấy `GET` tới URL đã presign.

Ghi chú code:
- Frontend: `web/src/pages/Videos.jsx` (dòng gọi `presignUpload` và `fetch(uploadUrl, {...})`).
- Backend: `video-api/src/routes/storage.js`, `s3Service.presignDownload()`.

---

### 5) Additional – In‑memory cache (Memcached) (45–60s)
- Nói: “Memcached dùng cache cho dữ liệu S3 head/json, giảm truy cập lặp.”
- Mở code: `video-api/src/services/cache/memcached.js` và `s3Service.js`:
  - Chỉ nhanh vào `withCache(...)` ở `headObject()` và `getObjectJson()`.
- Demo tương tác:
  - Gọi API two times (ví dụ mở trang Library hoặc metadata 1 video hai lần liên tiếp),
  - Lần sau nhanh hơn (nếu có log/metrics). Nếu có CLI trên EC2, chạy `memcflush` trước rồi F5 để thấy cache miss → hit. Nếu không, chỉ nêu nhanh cơ chế và cho thấy mã nguồn tích hợp cache.

---

### 6) Core – Authentication với Cognito (60–75s)
- Nói: “Dùng Cognito cho đăng ký, xác thực email, đăng nhập.”
- AWS Console → Cognito → User pools → mở pool `video-api-a2-n12122882` (tên có thể khác theo môi trường).
- Web client → Register:
  - Tạo user mới `demo_user_xxx` (email thật để nhận code).
- Sau khi nhận code (có thể cắt dựng), Confirm trên web.
- Trở lại User pool → Users: thấy user trạng thái `CONFIRMED`/email verified.
- Web → Login bằng user vừa tạo → chuyển vào `Videos`.

Ghi chú code:
- Backend: `video-api/src/routes/auth.js`, `services/external/cognitoService.js`, middleware `auth.js`.
- Frontend: `web/src/pages/Register.jsx`, `web/src/pages/Login.jsx`.

---

### 7) Additional – Cognito multi‑factor authentication (45–60s)
- Nói: “Đăng nhập với MFA (TOTP).”
- Với user đã login (có accessToken trong `localStorage:cognitoTokens`), gọi API associate TOTP (có thể qua Postman hoặc UI tùy bạn):
  - Backend endpoints: `/api/auth/mfa/totp/associate` → trả `otpauthUri`.
  - Quét QR bằng Authenticator app, rồi `/api/auth/mfa/totp/verify` để enable.
- Đăng xuất, đăng nhập lại:
  - Thấy bước `mfaRequired` trên `Login.jsx`, nhập code 6 số → vào app.

---

### 8) Additional – Cognito groups (30–45s)
- Nói: “Nhóm Admin có quyền xóa video.”
- AWS Console → Cognito → Groups: `Admin`.
- Thêm user vào group `Admin`.
- Web → thử gọi API xóa 1 video (ví dụ nút Delete nếu UI có, hoặc dùng Postman `DELETE /api/transcoding/videos/:videoId`).
  - Thành công khi user thuộc group Admin; nếu bỏ user khỏi group, gọi lại sẽ 403.
- Code tham chiếu: `video-api/src/middleware/auth.js` (`isAdmin` đọc `cognito:groups`).

---

### 9) Core – DNS với Route53 (20–30s)
- Nói: “Truy cập app qua subdomain tùy chỉnh.”
- Mở trình duyệt đến `https://n12122882.cab432.com` (hoặc domain/thông số môi trường của bạn). Nếu app chạy cổng khác, nêu rõ cổng.
- Lướt qua 1–2 trang để chứng minh hoạt động bình thường.

---

### 10) Additional – Parameter Store (45–60s)
- Nói: “SSM Parameter Store lưu cấu hình runtime (FFmpeg, AAI base).”
- AWS Console → Parameter Store:
  - Mở `/n12122882/video_api/aai_base` và `/n12122882/video_api/ffmpeg_config`.
- Mở code: `video-api/src/server.js` → phần `loadRuntimeParameters()` và `loadRuntimeParametersJson()`.
  - Chỉ nhanh cách map giá trị vào `process.env` như `FFMPEG_PRESET`, `DEFAULT_RESOLUTIONS`…

---

### 11) Kết thúc (10–15s)
- Nói: “Các tiêu chí còn lại (Statelessness, IaC) đã mô tả trong tài liệu phản hồi.”
- Nhấn mạnh: “Đã trình diễn S3, DynamoDB, Secrets Manager, Pre‑signed URLs, Cache, Cognito (đăng ký, xác thực, MFA, Groups), Route53, Parameter Store.”
- Kết thúc quay.

---

Phụ lục tham chiếu nhanh (không cần đọc trong video):
- S3: `video-api/src/services/storage/s3Service.js`, `video-api/src/routes/storage.js`.
- DynamoDB: `video-api/src/services/db/dynamoService.js`, `video-api/src/routes/transcoding.js`.
- Secrets Manager: `video-api/src/services/external/assemblyAIService.js`.
- Cache: `video-api/src/services/cache/memcached.js`, dùng trong `s3Service.headObject/getObjectJson`.
- Cognito: `video-api/src/services/external/cognitoService.js`, `video-api/src/routes/auth.js`, `video-api/src/middleware/auth.js`, web `Login.jsx`, `Register.jsx`.
- Parameter Store: `video-api/src/server.js`, Terraform `infra/terraform/ssm.tf`.
- Route53/DNS: dùng domain/subdomain đã cấu hình (trình diễn truy cập web).
