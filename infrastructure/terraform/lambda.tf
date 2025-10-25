# ---------------------------------------------------------------------------------------------------------------------
# LAMBDA FUNCTION RESOURCES
# This file defines Lambda functions for serverless operations
# This satisfies the "Serverless functions" and "Custom scaling metric" additional criteria.
# ---------------------------------------------------------------------------------------------------------------------

# Archive the custom metric Lambda source code into a zip file.
data "archive_file" "custom_metric_lambda_zip" {
  type        = "zip"
  source_dir  = "${path.module}/lambda_custom_metric"
  output_path = "${path.module}/lambda_custom_metric.zip"
}

# Lambda function to publish custom CloudWatch metrics for auto-scaling
# This calculates SQS queue depth per running ECS task
# Uses pre-existing CAB432-Lambda-Role
resource "aws_lambda_function" "custom_metric_publisher" {
  filename      = data.archive_file.custom_metric_lambda_zip.output_path
  function_name = "n12122882-custom-scaling-metric"
  role          = "arn:aws:iam::901444280953:role/CAB432-Lambda-Role"
  handler       = "index.handler"
  runtime       = "nodejs20.x"
  timeout       = 30
  source_code_hash = data.archive_file.custom_metric_lambda_zip.output_base64sha256

  environment {
    variables = {
      TRANSCODING_QUEUE_URL   = data.aws_sqs_queue.transcoding.url
      ECS_CLUSTER_NAME        = aws_ecs_cluster.main.name
      ECS_SERVICE_NAME        = aws_ecs_service.transcoding.name
    }
  }

  tags = {
    qut-username = var.qut_username
    purpose      = "assessment"
  }
}

# EventBridge rule to trigger Lambda every minute
resource "aws_cloudwatch_event_rule" "custom_metric_schedule" {
  name                = "n12122882-custom-metric-schedule"
  description         = "Trigger custom metric Lambda every minute"
  schedule_expression = "rate(1 minute)"

  tags = {
    qut-username = var.qut_username
    purpose      = "assessment"
  }
}

# EventBridge target to invoke Lambda
resource "aws_cloudwatch_event_target" "custom_metric_lambda" {
  rule      = aws_cloudwatch_event_rule.custom_metric_schedule.name
  target_id = "CustomMetricLambda"
  arn       = aws_lambda_function.custom_metric_publisher.arn
}

# Grant EventBridge permission to invoke Lambda
resource "aws_lambda_permission" "allow_eventbridge" {
  statement_id  = "AllowExecutionFromEventBridge"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.custom_metric_publisher.function_name
  principal     = "events.amazonaws.com"
  source_arn    = aws_cloudwatch_event_rule.custom_metric_schedule.arn
}

# Note: CloudWatch Log Group will be automatically created by Lambda on first invocation
# Commenting out manual creation due to missing logs:TagResource permission
# resource "aws_cloudwatch_log_group" "custom_metric_lambda" {
#   name              = "/aws/lambda/${aws_lambda_function.custom_metric_publisher.function_name}"
#   retention_in_days = 7
#
#   tags = {
#     qut-username = var.qut_username
#     purpose      = "assessment"
#   }
# }

# Output Lambda function name
output "custom_metric_lambda_name" {
  description = "Name of the custom metric Lambda function"
  value       = aws_lambda_function.custom_metric_publisher.function_name
}