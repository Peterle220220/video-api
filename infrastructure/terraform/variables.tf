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
# ECS & DOCKER CONFIGURATION
# ---------------------------------------------------------------------------------------------------------------------
variable "image_uri_web" {
  description = "Docker image URI for the web service."
  type        = string
}

variable "image_uri_api" {
  description = "Docker image URI for the video-api service."
  type        = string
}

variable "image_uri_auth" {
  description = "Docker image URI for the auth-service."
  type        = string
}

variable "image_uri_sqs_worker" {
  description = "Docker image URI for the sqs-worker service."
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
