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

# output "ecr_repository_urls" {
#   description = "Map of ECR repository URLs for Docker images."
#   value = {
#     web          = "901444280953.dkr.ecr.ap-southeast-2.amazonaws.com/n12122882-cab432-a3-web"
#     auth         = "901444280953.dkr.ecr.ap-southeast-2.amazonaws.com/n12122882-cab432-a3-auth-service"
#     transcoding  = "901444280953.dkr.ecr.ap-southeast-2.amazonaws.com/n12122882-cab432-a3-transcoding-service"
#     upload       = "901444280953.dkr.ecr.ap-southeast-2.amazonaws.com/n12122882-cab432-a3-upload-service"
#     sqs_worker   = "901444280953.dkr.ecr.ap-southeast-2.amazonaws.com/n12122882-cab432-a3-sqs-worker"
#   }
# }


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

# Lambda function commented out - no IAM role available
# output "lambda_function_name" {
#   description = "The name of the Lambda function."
#   value       = aws_lambda_function.s3_trigger_lambda.function_name
# }