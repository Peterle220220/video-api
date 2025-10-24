# ---------------------------------------------------------------------------------------------------------------------
# ROUTE 53 DNS RECORDS
# This file creates the DNS records to point your custom domain to the ALB.
# This is a required step for the "HTTPS" criterion to work correctly with a custom domain.
# ---------------------------------------------------------------------------------------------------------------------

# Route53 record already exists - not creating new one
# resource "aws_route53_record" "www" {
#   zone_id = "Z02680423BHWEVRU2JZDQ"  # Hardcoded zone ID for cab432.com
#   name    = var.domain_name
#   type    = "A"
#
#   alias {
#     name                   = aws_lb.main.dns_name
#     zone_id                = aws_lb.main.zone_id
#     evaluate_target_health = false
#   }
# }