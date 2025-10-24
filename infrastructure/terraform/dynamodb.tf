variable "ddb_table_name" {
  description = "Main DynamoDB table for metadata (single-table design)"
  type        = string
  default     = "cab432-a2-n12122882-metadata"
}

# Use existing DynamoDB table from Assessment 2
# No need to import or create new table

# If table already exists, import it first:
# terraform import aws_dynamodb_table.main <table-name>


