# ---------------------------------------------------------------------------------------------------------------------
# GENERAL CONFIGURATION
# ---------------------------------------------------------------------------------------------------------------------
variable "region" {
  description = "The AWS region to deploy resources in."
  type        = string
  default     = "ap-southeast-2"
}

variable "qut_username" {
  description = "Your QUT username (e.g., n1234567). Used for tagging resources."
  type        = string
}

variable "project_name" {
  description = "A name for the project, used to prefix resource names."
  type        = string
  default     = "cab432-a3"
}

# ---------------------------------------------------------------------------------------------------------------------
# NETWORKING CONFIGURATION
# ---------------------------------------------------------------------------------------------------------------------
variable "domain_name" {
  description = "The custom domain name for the application (e.g., myapp.cab432.com)."
  type        = string
}

variable "hosted_zone_name" {
  description = "The name of the Route 53 hosted zone (e.g., cab432.com)."
  type        = string
}

variable "acm_certificate_arn" {
  description = "The ARN of the ACM certificate for the custom domain."
  type        = string
}

# ---------------------------------------------------------------------------------------------------------------------
# EXISTING RESOURCES (from Assessment 2)
# ---------------------------------------------------------------------------------------------------------------------
variable "existing_s3_bucket" {
  description = "Existing S3 bucket name from Assessment 2"
  type        = string
  default     = "cab432-a2-n12122882"
}

variable "existing_dynamodb_table" {
  description = "Existing DynamoDB table name from Assessment 2"
  type        = string
  default     = "cab432-a2-n12122882-metadata"
}

variable "existing_cognito_user_pool_id" {
  description = "Existing Cognito User Pool ID from Assessment 2"
  type        = string
  default     = "ap-southeast-2_wgTgFFTuB"
}

variable "existing_cognito_client_id" {
  description = "Existing Cognito Client ID from Assessment 2"
  type        = string
  default     = "1o00oog3qb82t1qgvi62lfv9fa"
}

variable "existing_security_group_id" {
  description = "Existing Security Group ID to use"
  type        = string
  default     = "sg-032bd1ff8cf77dbb9"
}

# ---------------------------------------------------------------------------------------------------------------------
# ECS & DOCKER CONFIGURATION
# ---------------------------------------------------------------------------------------------------------------------
variable "image_uri_web" {
  description = "Docker image URI for the web service."
  type        = string
}

variable "image_uri_auth" {
  description = "Docker image URI for the auth service."
  type        = string
}

variable "image_uri_transcoding" {
  description = "Docker image URI for the transcoding service."
  type        = string
}

variable "image_uri_upload" {
  description = "Docker image URI for the upload service."
  type        = string
}

variable "image_uri_sqs_worker" {
  description = "Docker image URI for the sqs-worker service."
  type        = string
}

variable "image_uri_maintenance" {
  description = "Docker image URI for the maintenance scheduled task."
  type        = string
}

variable "image_uri_log_cleanup" {
  description = "Docker image URI for the log cleanup scheduled task."
  type        = string
}

variable "ecs_task_cpu" {
  description = "CPU units to allocate for the ECS tasks."
  type        = number
  default     = 512 # 0.5 vCPU
}

variable "ecs_task_memory" {
  description = "Memory to allocate for the ECS tasks (in MiB)."
  type        = number
  default     = 1024 # 1 GB
}

variable "transcoding_task_cpu" {
  description = "CPU units for transcoding tasks (CPU-intensive)"
  type        = number
  default     = 1024 # 1 vCPU
}

variable "transcoding_task_memory" {
  description = "Memory for transcoding tasks (in MiB)"
  type        = number
  default     = 2048 # 2 GB
}