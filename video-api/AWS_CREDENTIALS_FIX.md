# Khắc phục lỗi AWS Credentials

## Vấn đề
Lỗi `CredentialsProviderError: Could not load credentials from any providers` xảy ra khi AWS SDK không thể tìm thấy credentials.

## Giải pháp đã áp dụng

### 1. Cập nhật cấu hình AWS (src/config/aws.js)
- Thêm import `fromEnv` từ `@aws-sdk/credential-providers`
- Sử dụng `fromEnv()` để load credentials từ environment variables
- Cấu hình cả S3Client và DynamoDBClient với credential provider

### 2. Cập nhật Docker Compose (docker-compose.yml)
- Uncomment các AWS credentials environment variables
- Mount AWS credentials từ host: `~/.aws:/home/node/.aws:ro`

### 3. Scripts hỗ trợ
- `test-aws-credentials.js`: Test AWS credentials
- `start-with-credentials.sh`: Script bash để start với credentials
- `start-with-credentials.ps1`: Script PowerShell cho Windows

## Cách sử dụng

### Phương pháp 1: Environment Variables
```bash
export AWS_ACCESS_KEY_ID=your_access_key
export AWS_SECRET_ACCESS_KEY=your_secret_key
export AWS_REGION=ap-southeast-2
npm start
```

### Phương pháp 2: AWS Credentials File
Đảm bảo file `~/.aws/credentials` tồn tại:
```ini
[default]
aws_access_key_id = your_access_key
aws_secret_access_key = your_secret_key
region = ap-southeast-2
```

### Phương pháp 3: Docker với credentials
```bash
# Mount credentials vào container
docker-compose up
```

## Test credentials
```bash
node test-aws-credentials.js
```

## Lưu ý
- Đảm bảo AWS credentials có quyền truy cập DynamoDB và S3
- Region phải khớp với cấu hình trong docker-compose.yml
- Nếu sử dụng Docker, credentials sẽ được mount từ host
