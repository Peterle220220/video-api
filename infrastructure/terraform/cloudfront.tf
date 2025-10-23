# ---------------------------------------------------------------------------------------------------------------------
# CLOUDFRONT DISTRIBUTION
# This file defines the CloudFront distribution to serve the static web application
# with low latency and high transfer speeds.
# This satisfies the "Edge caching" additional criterion.
# ---------------------------------------------------------------------------------------------------------------------

# Create an Origin Access Identity (OAI) to restrict direct S3 bucket access.
# This ensures that users access the content only through CloudFront.
resource "aws_cloudfront_origin_access_identity" "default" {
  comment = "OAI for ${var.project_name} webapp"
}

resource "aws_cloudfront_distribution" "s3_distribution" {
  origin {
    domain_name = aws_s3_bucket.webapp.bucket_regional_domain_name
    origin_id   = "S3-${aws_s3_bucket.webapp.id}"

    s3_origin_config {
      origin_access_identity = aws_cloudfront_origin_access_identity.default.cloudfront_access_identity_path
    }
  }

  enabled             = true
  is_ipv6_enabled     = true
  comment             = "CloudFront distribution for ${var.project_name} webapp"
  default_root_object = "index.html"

  # Use the custom domain name
  aliases = [var.domain_name]

  default_cache_behavior {
    allowed_methods  = ["GET", "HEAD", "OPTIONS"]
    cached_methods   = ["GET", "HEAD"]
    target_origin_id = "S3-${aws_s3_bucket.webapp.id}"

    forwarded_values {
      query_string = false
      cookies {
        forward = "none"
      }
    }

    viewer_protocol_policy = "redirect-to-https"
    min_ttl                = 0
    default_ttl            = 3600
    max_ttl                = 86400
  }

  # Custom error response for SPAs (like React) to handle client-side routing
  custom_error_response {
    error_caching_min_ttl = 300
    error_code            = 403
    response_code         = 200
    response_page_path    = "/index.html"
  }

  custom_error_response {
    error_caching_min_ttl = 300
    error_code            = 404
    response_code         = 200
    response_page_path    = "/index.html"
  }

  restrictions {
    geo_restriction {
      restriction_type = "none" # No geo-restrictions by default
    }
  }

  viewer_certificate {
    acm_certificate_arn      = var.acm_certificate_arn
    ssl_support_method       = "sni-only"
    minimum_protocol_version = "TLSv1.2_2021"
  }

  tags = {
    qut-username = var.qut_username
    purpose      = "assessment"
  }
}
