variable "ddb_table_name" {
  description = "Main DynamoDB table for metadata (single-table design)"
  type        = string
  default     = "cab432-a2-n12122882-metadata"
}

variable "manage_ddb" {
  description = "Whether Terraform should manage (create/import) the DynamoDB table"
  type        = bool
  default     = true
}

resource "aws_dynamodb_table" "main" {
  count        = var.manage_ddb ? 1 : 0
  name         = var.ddb_table_name
  billing_mode = "PAY_PER_REQUEST"
  hash_key     = "qut-username"
  range_key    = "sk"

  attribute {
    name = "qut-username"
    type = "S"
  }

  attribute {
    name = "sk"
    type = "S"
  }

  ttl {
    enabled        = false
    attribute_name = "ttl"
  }
}

# If table already exists, import it first:
# terraform import aws_dynamodb_table.main <table-name>


