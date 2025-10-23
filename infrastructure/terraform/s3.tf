variable "s3_bucket_name" {
  description = "S3 bucket for video storage"
  type        = string
  default     = "cab432-a2-n12122882"
}

# Bucket for video uploads
# This will be integrated with the Lambda function trigger
resource "aws_s3_bucket" "uploads" {
  bucket = "cab432-a3-${var.qut_username}-uploads"

  tags = {
    Name         = "cab432-a3-${var.qut_username}-uploads"
    qut-username = var.qut_username
    purpose      = "assessment"
  }
}

resource "aws_s3_bucket_public_access_block" "uploads_public_access_block" {
  bucket = aws_s3_bucket.uploads.id

  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

# Bucket for hosting the static React web application
# This will be the origin for the CloudFront distribution
resource "aws_s3_bucket" "webapp" {
  bucket = "cab432-a3-${var.qut_username}-webapp"

  tags = {
    Name         = "cab432-a3-${var.qut_username}-webapp"
    qut-username = var.qut_username
    purpose      = "assessment"
  }
}

resource "aws_s3_bucket_website_configuration" "webapp_config" {
  bucket = aws_s3_bucket.webapp.id

  index_document {
    suffix = "index.html"
  }

  error_document {
    key = "index.html"
  }
}

resource "aws_s3_bucket_public_access_block" "webapp_public_access_block" {
  bucket = aws_s3_bucket.webapp.id

  block_public_acls       = false
  block_public_policy     = false
  ignore_public_acls      = false
  restrict_public_buckets = false
}

# Policy to allow CloudFront to access the webapp S3 bucket
# This uses an Origin Access Identity to ensure the bucket is only accessible via CloudFront
resource "aws_s3_bucket_policy" "webapp_policy" {
  bucket = aws_s3_bucket.webapp.id
  policy = jsonencode({
    Version = "2012-10-17",
    Statement = [
      {
        Sid       = "AllowCloudFront"
        Effect    = "Allow",
        Principal = {
          AWS = aws_cloudfront_origin_access_identity.default.iam_arn
        },
        Action   = "s3:GetObject",
        Resource = "${aws_s3_bucket.webapp.arn}/*"
      }
    ]
  })
}


