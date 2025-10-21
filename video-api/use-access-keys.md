# Sử dụng AWS Access Keys thay vì SSO

## Vấn đề
SSO role `AWSReservedSSO_CAB432-STUDENT_f2baa6a2ba3c79c9` không có quyền DynamoDB.

## Giải pháp: Sử dụng AWS Access Keys

### Bước 1: Tạo Access Keys
1. Đăng nhập AWS Console
2. Vào IAM → Users → [Your User] → Security credentials
3. Tạo Access Key mới
4. Lưu Access Key ID và Secret Access Key

### Bước 2: Cấu hình credentials
```bash
# Cách 1: Environment variables
export AWS_ACCESS_KEY_ID=your_access_key_here
export AWS_SECRET_ACCESS_KEY=your_secret_key_here
export AWS_REGION=ap-southeast-2

# Cách 2: AWS credentials file
# Tạo file ~/.aws/credentials
[default]
aws_access_key_id = your_access_key_here
aws_secret_access_key = your_secret_key_here
region = ap-southeast-2
```

### Bước 3: Cấp quyền DynamoDB
Tạo IAM policy với quyền DynamoDB:

```json
{
    "Version": "2012-10-17",
    "Statement": [
        {
            "Effect": "Allow",
            "Action": [
                "dynamodb:Query",
                "dynamodb:GetItem",
                "dynamodb:PutItem",
                "dynamodb:UpdateItem",
                "dynamodb:DeleteItem",
                "dynamodb:Scan"
            ],
            "Resource": [
                "arn:aws:dynamodb:ap-southeast-2:901444280953:table/cab432-a2-n12122882-metadata",
                "arn:aws:dynamodb:ap-southeast-2:901444280953:table/cab432-a2-n12122882-metadata/index/*"
            ]
        }
    ]
}
```

### Bước 4: Test
```bash
# Test DynamoDB access
aws dynamodb describe-table --table-name cab432-a2-n12122882-metadata

# Test application
npm start
```

## Lưu ý
- Access Keys có quyền cao hơn SSO
- Đảm bảo bảo mật Access Keys
- Có thể cần liên hệ admin để cấp quyền SSO
