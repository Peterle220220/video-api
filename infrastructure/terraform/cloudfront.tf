# ---------------------------------------------------------------------------------------------------------------------
# CLOUDFRONT DISTRIBUTION
# This file defines the CloudFront distribution to serve the application via edge caching
# with low latency and high transfer speeds.
# This satisfies the "Edge caching" additional criterion.
# 
# Architecture:
# - Static content (React app) is cached from S3 with long TTL (1 day - 1 year)
# - API requests are forwarded to ALB with minimal/no caching
# This provides optimal performance for static assets while keeping dynamic data fresh.
# ---------------------------------------------------------------------------------------------------------------------

# Origin Access Identity for S3 bucket access
resource "aws_cloudfront_origin_access_identity" "webapp_oai" {
  comment = "OAI for ${var.project_name} webapp S3 bucket"
}

# CloudFront Distribution with dual origins: S3 for static content, ALB for APIs
resource "aws_cloudfront_distribution" "main" {
  # Origin 1: S3 bucket for static React application files
  # These are cached at edge locations worldwide for fast access
  origin {
    domain_name = aws_s3_bucket.webapp.bucket_regional_domain_name
    origin_id   = "S3-${var.project_name}-webapp"

    s3_origin_config {
      origin_access_identity = aws_cloudfront_origin_access_identity.webapp_oai.cloudfront_access_identity_path
    }
  }

  # Origin 2: ALB for dynamic API requests
  # API calls are forwarded to backend services with minimal caching
  origin {
    domain_name = aws_lb.main.dns_name
    origin_id   = "ALB-${var.project_name}"

    custom_origin_config {
      http_port              = 80
      https_port             = 443
      origin_protocol_policy = "https-only"
      origin_ssl_protocols   = ["TLSv1.2"]
    }

    custom_header {
      name  = "X-CloudFront-Origin"
      value = "cloudfront-${var.project_name}"
    }
  }

  enabled             = true
  is_ipv6_enabled     = true
  comment             = "CloudFront distribution for ${var.project_name} - S3 static content + ALB API"
  default_root_object = "index.html"
  
  # Note: Not using custom domain alias to avoid us-east-1 certificate requirement
  # CloudFront will provide its own domain (xxx.cloudfront.net)

  # PRIORITY 1: API requests go to ALB (no caching for dynamic data)
  ordered_cache_behavior {
    path_pattern     = "/api/*"
    allowed_methods  = ["DELETE", "GET", "HEAD", "OPTIONS", "PATCH", "POST", "PUT"]
    cached_methods   = ["GET", "HEAD", "OPTIONS"]
    target_origin_id = "ALB-${var.project_name}"

    forwarded_values {
      query_string = true
      headers      = ["*"]

      cookies {
        forward = "all"
      }
    }

    viewer_protocol_policy = "redirect-to-https"
    min_ttl                = 0
    default_ttl            = 0      # Don't cache API by default
    max_ttl                = 300    # Max 5 minutes for API responses
    compress               = true
  }

  # PRIORITY 2: React static assets with hashed filenames (long cache)
  # React builds files like main.abc123.js, main.xyz789.css
  ordered_cache_behavior {
    path_pattern     = "/static/*"
    allowed_methods  = ["GET", "HEAD", "OPTIONS"]
    cached_methods   = ["GET", "HEAD", "OPTIONS"]
    target_origin_id = "S3-${var.project_name}-webapp"

    forwarded_values {
      query_string = false
      headers      = []

      cookies {
        forward = "none"
      }
    }

    viewer_protocol_policy = "redirect-to-https"
    min_ttl                = 86400      # 1 day minimum
    default_ttl            = 604800     # 7 days default
    max_ttl                = 31536000   # 1 year max
    compress               = true
  }

  # DEFAULT: All other requests (HTML, favicon, etc.) from S3
  # Serves index.html and other root-level files
  default_cache_behavior {
    allowed_methods  = ["GET", "HEAD", "OPTIONS"]
    cached_methods   = ["GET", "HEAD", "OPTIONS"]
    target_origin_id = "S3-${var.project_name}-webapp"

    forwarded_values {
      query_string = false
      headers      = []

      cookies {
        forward = "none"
      }
    }

    viewer_protocol_policy = "redirect-to-https"
    min_ttl                = 0
    default_ttl            = 3600      # 1 hour for HTML files
    max_ttl                = 86400     # 1 day max
    compress               = true
  }

  # Custom error responses for SPA routing
  # Redirects 404/403 to index.html to support React Router
  custom_error_response {
    error_code         = 404
    response_code      = 200
    response_page_path = "/index.html"
    error_caching_min_ttl = 300
  }

  custom_error_response {
    error_code         = 403
    response_code      = 200
    response_page_path = "/index.html"
    error_caching_min_ttl = 300
  }

  # Price class - use only North America and Europe edge locations for cost optimization
  price_class = "PriceClass_100"

  restrictions {
    geo_restriction {
      restriction_type = "none"
    }
  }

  # Use default CloudFront certificate (*.cloudfront.net)
  viewer_certificate {
    cloudfront_default_certificate = true
    minimum_protocol_version       = "TLSv1.2_2021"
  }

  tags = {
    qut-username = var.qut_username
    purpose      = "assessment"
  }
}

# Output the CloudFront domain name
output "cloudfront_distribution_domain" {
  description = "The domain name of the CloudFront distribution"
  value       = aws_cloudfront_distribution.main.domain_name
}

output "cloudfront_distribution_id" {
  description = "The ID of the CloudFront distribution"
  value       = aws_cloudfront_distribution.main.id
}
