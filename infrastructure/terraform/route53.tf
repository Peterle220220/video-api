# ---------------------------------------------------------------------------------------------------------------------
# ROUTE 53 DNS RECORDS
# This file creates the DNS records to point your custom domain to the CloudFront distribution.
# This is a required step for the "HTTPS" criterion to work correctly with a custom domain.
# ---------------------------------------------------------------------------------------------------------------------

# Temporarily commented out due to permission issues
# Look up the hosted zone for the provided domain name.
# data "aws_route53_zone" "main" {
#   name = var.hosted_zone_name
# }

# Create an A record that points the custom domain to the CloudFront distribution.
# Using an Alias record is the recommended way to point a domain to AWS resources like CloudFront or an ALB.
# resource "aws_route53_record" "www" {
#   zone_id = data.aws_route53_zone.main.zone_id
#   name    = var.domain_name
#   type    = "A"

#   alias {
#     name                   = aws_cloudfront_distribution.s3_distribution.domain_name
#     zone_id                = aws_cloudfront_distribution.s3_distribution.hosted_zone_id
#     evaluate_target_health = false
#   }
# }
