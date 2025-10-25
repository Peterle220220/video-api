variable "s3_bucket_name" {
  description = "S3 bucket for video storage"
  type        = string
  default     = "cab432-a2-n12122882"
}

# Bucket for video uploads
# This will be integrated with the Lambda function trigger
resource "aws_s3_bucket" "uploads" {
  bucket = "cab432-a3-n12122882-uploads"

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
  bucket = "cab432-a3-n12122882-webapp"

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

# Note: CloudFront uses ALB as origin (not S3 directly)
# Therefore no special S3 bucket policy needed for CloudFront access
# The webapp bucket is currently not in active use as content is served via ECS containers


