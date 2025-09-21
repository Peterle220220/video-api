variable "cognito_user_pool_name" {
  description = "Cognito User Pool name"
  type        = string
  default     = "video-api-a2-n12122882"
}

variable "cognito_app_client_name" {
  description = "Cognito App Client name"
  type        = string
  default     = "web-app-client"
}

resource "aws_cognito_user_pool" "this" {
  name = var.cognito_user_pool_name

  mfa_configuration = "OPTIONAL"

  software_token_mfa_configuration {
    enabled = true
  }

  schema {
    name                = "email"
    attribute_data_type = "String"
    required            = true
    mutable             = true
  }
}

resource "aws_cognito_user_pool_client" "this" {
  name         = var.cognito_app_client_name
  user_pool_id = aws_cognito_user_pool.this.id

  generate_secret = true

  explicit_auth_flows = [
    "ALLOW_USER_PASSWORD_AUTH",
    "ALLOW_REFRESH_TOKEN_AUTH"
  ]

  supported_identity_providers = ["COGNITO"]

  prevent_user_existence_errors = "ENABLED"
}

resource "aws_cognito_user_group" "admin" {
  name         = "Admin"
  user_pool_id = aws_cognito_user_pool.this.id
  description  = "Administrators"
}

output "cognito_user_pool_id" {
  value       = aws_cognito_user_pool.this.id
  description = "Cognito User Pool ID"
}

output "cognito_app_client_id" {
  value       = aws_cognito_user_pool_client.this.id
  description = "Cognito App Client ID"
}

output "cognito_app_client_secret" {
  value       = aws_cognito_user_pool_client.this.client_secret
  description = "Cognito App Client secret"
  sensitive   = true
}

output "cognito_jwks_uri" {
  value       = "https://cognito-idp.${var.aws_region}.amazonaws.com/${aws_cognito_user_pool.this.id}/.well-known/jwks.json"
  description = "Cognito JWKS URI"
}


