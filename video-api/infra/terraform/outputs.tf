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


