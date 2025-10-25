# ---------------------------------------------------------------------------------------------------------------------
# CLOUDFRONT DISTRIBUTION
# This file defines the CloudFront distribution to serve the application via edge caching
# with low latency and high transfer speeds.
# This satisfies the "Edge caching" additional criterion.
# ---------------------------------------------------------------------------------------------------------------------

# CloudFront Distribution with ALB as origin
# Using ALB allows us to cache both static and dynamic content with appropriate cache behaviors
resource "aws_cloudfront_distribution" "main" {
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

  enabled         = true
  is_ipv6_enabled = true
  comment         = "CloudFront distribution for ${var.project_name} - caching ALB content"
  
  # Note: Not using custom domain alias to avoid us-east-1 certificate requirement
  # CloudFront will provide its own domain (xxx.cloudfront.net)

  # Default cache behavior - optimized for web application
  default_cache_behavior {
    allowed_methods  = ["DELETE", "GET", "HEAD", "OPTIONS", "PATCH", "POST", "PUT"]
    cached_methods   = ["GET", "HEAD", "OPTIONS"]
    target_origin_id = "ALB-${var.project_name}"

    forwarded_values {
      query_string = true
      headers      = ["Host", "Authorization", "Accept", "Accept-Language", "Content-Type"]

      cookies {
        forward = "all"
      }
    }

    viewer_protocol_policy = "redirect-to-https"
    min_ttl                = 0
    default_ttl            = 0      # Don't cache by default
    max_ttl                = 86400
    compress               = true
  }

  # Cache behavior for static assets (CSS, JS, images)
  ordered_cache_behavior {
    path_pattern     = "/static/*"
    allowed_methods  = ["GET", "HEAD", "OPTIONS"]
    cached_methods   = ["GET", "HEAD", "OPTIONS"]
    target_origin_id = "ALB-${var.project_name}"

    forwarded_values {
      query_string = false
      headers      = ["Origin", "Access-Control-Request-Method", "Access-Control-Request-Headers"]

      cookies {
        forward = "none"
      }
    }

    viewer_protocol_policy = "redirect-to-https"
    min_ttl                = 0
    default_ttl            = 86400  # 1 day for static assets
    max_ttl                = 31536000 # 1 year
    compress               = true
  }

  # Cache behavior for API responses (short TTL)
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
