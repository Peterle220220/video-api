variable "s3_bucket_name" {
  description = "S3 bucket for video storage"
  type        = string
  default     = "cab432-a2-n12122882"
}

resource "aws_s3_bucket" "videos" {
  bucket = var.s3_bucket_name
}

# In case bucket exists already and is owned by you, you can import it:
# terraform import aws_s3_bucket.videos <bucket-name>

resource "aws_s3_bucket_public_access_block" "videos" {
  bucket = aws_s3_bucket.videos.id

  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

resource "aws_s3_bucket_versioning" "videos" {
  bucket = aws_s3_bucket.videos.id

  versioning_configuration {
    status = "Enabled"
  }
}

resource "aws_s3_bucket_cors_configuration" "videos" {
  bucket = aws_s3_bucket.videos.id

  cors_rule {
    allowed_headers = ["*"]
    allowed_methods = ["GET", "PUT", "POST", "HEAD"]
    allowed_origins = ["*"]
    expose_headers  = ["ETag"]
    max_age_seconds = 3000
  }
}


