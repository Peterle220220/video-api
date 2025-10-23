# ---------------------------------------------------------------------------------------------------------------------
# OUTPUTS
# These outputs provide easy access to important resource identifiers and endpoints after deployment.
# ---------------------------------------------------------------------------------------------------------------------

output "application_url" {
  description = "The main URL for the web application, served via ALB."
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
    auth         = aws_ecr_repository.auth.repository_url
    transcoding  = aws_ecr_repository.transcoding.repository_url
    upload       = aws_ecr_repository.upload.repository_url
    sqs_worker   = aws_ecr_repository.sqs_worker.repository_url
  }
}

output "sqs_queue_urls" {
  description = "URLs of the SQS queues."
  value = {
    transcoding_queue = aws_sqs_queue.transcoding_queue.id
    transcoding_dlq   = aws_sqs_queue.transcoding_dlq.id
    upload_queue      = aws_sqs_queue.upload_queue.id
    storage_queue     = aws_sqs_queue.storage_queue.id
    notifications_queue = aws_sqs_queue.notifications_queue.id
  }
}

output "existing_resources" {
  description = "Information about existing resources from Assessment 2."
  value = {
    s3_bucket_name = var.existing_s3_bucket
    dynamodb_table = var.existing_dynamodb_table
    cognito_user_pool_id = var.existing_cognito_user_pool_id
    cognito_client_id = var.existing_cognito_client_id
  }
}

output "ecs_cluster_name" {
  description = "The name of the ECS cluster."
  value       = aws_ecs_cluster.main.name
}

output "lambda_function_name" {
  description = "The name of the Lambda function."
  value       = aws_lambda_function.s3_trigger_lambda.function_name
}