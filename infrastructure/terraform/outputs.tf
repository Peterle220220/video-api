# ---------------------------------------------------------------------------------------------------------------------
# OUTPUTS
# These outputs provide easy access to important resource identifiers and endpoints after deployment.
# ---------------------------------------------------------------------------------------------------------------------

output "application_url" {
  description = "The main URL for the web application, served via CloudFront."
  value       = "https://${var.domain_name}"
}

output "alb_dns_name" {
  description = "The DNS name of the Application Load Balancer."
  value       = aws_lb.main.dns_name
}

output "ecr_repository_urls" {
  description = "Map of ECR repository URLs for Docker images."
  value = {
    web          = aws_ecr_repository.web.repository_url
    video_api    = aws_ecr_repository.video_api.repository_url
    auth_service = aws_ecr_repository.auth_service.repository_url
    sqs_worker   = aws_ecr_repository.sqs_worker.repository_url
  }
}

output "s3_bucket_names" {
  description = "Names of the S3 buckets created."
  value = {
    uploads = aws_s3_bucket.uploads.id
    webapp  = aws_s3_bucket.webapp.id
  }
}

output "sqs_queue_urls" {
  description = "URLs of the SQS queues."
  value = {
    transcoding_queue = aws_sqs_queue.transcoding_queue.id
    transcoding_dlq   = aws_sqs_queue.transcoding_dlq.id
  }
}


