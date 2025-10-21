# Hướng dẫn tạo SQS Queues cho Video API

## 🎯 Cần tạo 2 queues:

1. **upload-queue** - Xử lý file upload
2. **notifications-queue** - Thông báo hệ thống

## 📋 Bước 1: Truy cập AWS SQS Console

1. Đăng nhập AWS Console: https://console.aws.amazon.com/
2. Tìm kiếm "SQS" hoặc truy cập: https://console.aws.amazon.com/sqs/
3. Đảm bảo chọn region: **ap-southeast-2 (Sydney)**

## 📋 Bước 2: Tạo upload-queue

### 2.1. Tạo queue chính
1. Click **"Create queue"**
2. Chọn **"Standard"** queue type
3. **Queue name**: `upload-queue`
4. **Configuration**:
   - **Visibility timeout**: `300 seconds` (5 phút)
   - **Message retention period**: `14 days`
   - **Receive message wait time**: `20 seconds` (Long polling)
   - **Delivery delay**: `0 seconds`

### 2.2. Tạo Dead Letter Queue (DLQ)
1. Tạo queue mới: **"upload-queue-dlq"**
2. **Configuration**:
   - **Visibility timeout**: `300 seconds`
   - **Message retention period**: `14 days`
   - **Receive message wait time**: `20 seconds`

### 2.3. Cấu hình DLQ cho upload-queue
1. Vào **upload-queue** → **Configuration** → **Dead-letter queue**
2. **Enable dead-letter queue**: ✅
3. **Dead-letter queue**: Chọn `upload-queue-dlq`
4. **Maximum receives**: `3` (sau 3 lần retry sẽ chuyển vào DLQ)

## 📋 Bước 3: Tạo notifications-queue

### 3.1. Tạo queue chính
1. Click **"Create queue"**
2. Chọn **"Standard"** queue type
3. **Queue name**: `notifications-queue`
4. **Configuration**:
   - **Visibility timeout**: `60 seconds` (1 phút)
   - **Message retention period**: `14 days`
   - **Receive message wait time**: `20 seconds` (Long polling)
   - **Delivery delay**: `0 seconds`

### 3.2. Tạo Dead Letter Queue (DLQ)
1. Tạo queue mới: **"notifications-queue-dlq"**
2. **Configuration**:
   - **Visibility timeout**: `60 seconds`
   - **Message retention period**: `14 days`
   - **Receive message wait time**: `20 seconds`

### 3.3. Cấu hình DLQ cho notifications-queue
1. Vào **notifications-queue** → **Configuration** → **Dead-letter queue**
2. **Enable dead-letter queue**: ✅
3. **Dead-letter queue**: Chọn `notifications-queue-dlq`
4. **Maximum receives**: `3`

## 📋 Bước 4: Cấu hình Access Policy (Optional)

### 4.1. Upload Queue Policy
```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Principal": {
        "AWS": "arn:aws:iam::901444280953:root"
      },
      "Action": [
        "sqs:SendMessage",
        "sqs:ReceiveMessage",
        "sqs:DeleteMessage",
        "sqs:GetQueueAttributes"
      ],
      "Resource": "arn:aws:sqs:ap-southeast-2:901444280953:upload-queue"
    }
  ]
}
```

### 4.2. Notifications Queue Policy
```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Principal": {
        "AWS": "arn:aws:iam::901444280953:root"
      },
      "Action": [
        "sqs:SendMessage",
        "sqs:ReceiveMessage",
        "sqs:DeleteMessage",
        "sqs:GetQueueAttributes"
      ],
      "Resource": "arn:aws:sqs:ap-southeast-2:901444280953:notifications-queue"
    }
  ]
}
```

## 📋 Bước 5: Test Queues

Sau khi tạo xong, test với:

```bash
# Kiểm tra status
npm run manage-sqs status

# Test gửi message
npm run manage-sqs send upload upload_processing
npm run manage-sqs send notifications notification

# Test nhận message
npm run manage-sqs receive upload
npm run manage-sqs receive notifications
```

## 🎯 Tại sao cần Dead Letter Queue?

### ✅ Lợi ích của DLQ:
1. **Error Handling**: Capture failed messages
2. **Debugging**: Xem messages bị lỗi
3. **Monitoring**: Track failed processing
4. **Retry Logic**: Automatic retry với exponential backoff
5. **Data Loss Prevention**: Không mất messages quan trọng

### 📊 Cấu hình DLQ cho Video API:
- **Maximum receives**: 3 (retry 3 lần trước khi vào DLQ)
- **Visibility timeout**: Đủ thời gian xử lý
- **Message retention**: 14 ngày để debug

## 🔧 Cấu hình nâng cao:

### Access Patterns:
- **Upload Queue**: High throughput, short processing time
- **Notifications Queue**: Low latency, immediate processing

### Monitoring:
- CloudWatch metrics cho queue depth
- DLQ alerts khi có messages failed
- Processing time monitoring

## ✅ Checklist hoàn thành:

- [ ] upload-queue created
- [ ] upload-queue-dlq created  
- [ ] notifications-queue created
- [ ] notifications-queue-dlq created
- [ ] DLQ configured for both queues
- [ ] Access policies set (optional)
- [ ] Test queues working
- [ ] Monitor DLQ for failed messages
