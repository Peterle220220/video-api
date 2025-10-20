output "aws_region" {
  value       = var.aws_region
  description = "Region where resources are deployed"
}

output "s3_bucket_name" {
  value       = aws_s3_bucket.videos.bucket
  description = "S3 bucket name"
}

output "ddb_table_name" {
  value       = coalesce(try(aws_dynamodb_table.main[0].name, null), var.ddb_table_name)
  description = "DynamoDB table name"
}

output "sqs_transcode_url" {
  value       = try(aws_sqs_queue.transcode[0].url, null)
  description = "SQS transcode URL"
}

output "sqs_transcode_dlq_url" {
  value       = try(aws_sqs_queue.transcode_dlq[0].url, null)
  description = "SQS transcode DLQ URL"
}

output "sqs_transcribe_url" {
  value       = try(aws_sqs_queue.transcribe[0].url, null)
  description = "SQS transcribe URL"
}

output "sqs_transcribe_dlq_url" {
  value       = try(aws_sqs_queue.transcribe_dlq[0].url, null)
  description = "SQS transcribe DLQ URL"
}


