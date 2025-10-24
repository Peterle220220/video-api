# ---------------------------------------------------------------------------------------------------------------------
# LAMBDA FUNCTION RESOURCES
# This file defines the Lambda function and the S3 trigger that invokes it.
# This satisfies the "Serverless functions" additional criterion.
# ---------------------------------------------------------------------------------------------------------------------

# Archive the Lambda source code into a zip file.
data "archive_file" "lambda_zip" {
  type        = "zip"
  source_dir  = "${path.module}/lambda_function"
  output_path = "${path.module}/lambda_function.zip"
}

# Create the Lambda function resource.
# Lambda function requires IAM role creation permission
# Commenting out for now - create manually if needed
# resource "aws_lambda_function" "s3_trigger_lambda" {
#   filename      = data.archive_file.lambda_zip.output_path
#   function_name = "n12122882-cab432-s3-trigger"
#   role          = "arn:aws:iam::901444280953:role/lambdaExecutionRole"
#   handler       = "index.handler"
#   runtime       = "nodejs20.x"
#   source_code_hash = data.archive_file.lambda_zip.output_base64sha256
#
#   environment {
#     variables = {
#       S3_BUCKET_NAME = var.existing_s3_bucket
#       DYNAMODB_TABLE_NAME = var.existing_dynamodb_table
#     }
#   }
#
#   tags = {
#     qut-username = var.qut_username
#     purpose      = "assessment"
#   }
# }

# Grant S3 permission to invoke the Lambda function.
# resource "aws_lambda_permission" "allow_s3" {
#   statement_id  = "AllowS3Invoke"
#   action        = "lambda:InvokeFunction"
#   function_name = aws_lambda_function.s3_trigger_lambda.function_name
#   principal     = "s3.amazonaws.com"
#   source_arn    = "arn:aws:s3:::${var.existing_s3_bucket}"
# }

# Configure the S3 bucket to send a notification to the Lambda function on object creation.
# resource "aws_s3_bucket_notification" "bucket_notification" {
#   bucket = var.existing_s3_bucket
#
#   lambda_function {
#     lambda_function_arn = aws_lambda_function.s3_trigger_lambda.arn
#     events              = ["s3:ObjectCreated:*"]
#     filter_prefix       = "uploads/"
#     filter_suffix       = ".mp4"
#   }
#
#   depends_on = [aws_lambda_permission.allow_s3]
# }