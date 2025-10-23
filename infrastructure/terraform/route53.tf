# ---------------------------------------------------------------------------------------------------------------------
# ROUTE 53 DNS RECORDS
# This file creates the DNS records to point your custom domain to the ALB.
# This is a required step for the "HTTPS" criterion to work correctly with a custom domain.
# ---------------------------------------------------------------------------------------------------------------------

# Look up the hosted zone for the provided domain name.
data "aws_route53_zone" "main" {
  name = var.hosted_zone_name
}

# Create an A record that points the custom domain to the ALB.
resource "aws_route53_record" "www" {
  zone_id = data.aws_route53_zone.main.zone_id
  name    = var.domain_name
  type    = "A"

  alias {
    name                   = aws_lb.main.dns_name
    zone_id                = aws_lb.main.zone_id
    evaluate_target_health = false
  }
}