variable "queue_name_prefix" {
  description = "Prefix for SQS queue names"
  type        = string
  default     = "video-api-a2"
}

variable "manage_sqs" {
  description = "Whether Terraform should create/manage SQS queues"
  type        = bool
  default     = false
}

variable "visibility_timeout" {
  description = "Visibility timeout seconds for transcoder queue"
  type        = number
  default     = 1200
}

variable "max_receive_count" {
  description = "Max receive count before redrive to DLQ"
  type        = number
  default     = 5
}

variable "receive_wait_time" {
  description = "Long polling wait time (seconds)"
  type        = number
  default     = 20
}

variable "enable_sse" {
  description = "Enable SQS-managed server-side encryption"
  type        = bool
  default     = true
}

variable "tags" {
  description = "Common tags applied to all SQS queues"
  type        = map(string)
  default     = {}
}

resource "aws_sqs_queue" "transcode_dlq" {
  count                     = var.manage_sqs ? 1 : 0
  name                      = "${var.queue_name_prefix}-transcode-dlq"
  message_retention_seconds = 1209600
  sqs_managed_sse_enabled   = var.enable_sse

  tags = merge({
    Name = "${var.queue_name_prefix}-transcode-dlq"
  }, var.tags)
}

resource "aws_sqs_queue" "transcode" {
  count                      = var.manage_sqs ? 1 : 0
  name                       = "${var.queue_name_prefix}-transcode"
  visibility_timeout_seconds = var.visibility_timeout
  receive_wait_time_seconds  = var.receive_wait_time
  message_retention_seconds  = 1209600
  sqs_managed_sse_enabled    = var.enable_sse
  redrive_policy             = jsonencode({ deadLetterTargetArn = aws_sqs_queue.transcode_dlq[0].arn, maxReceiveCount = var.max_receive_count })

  tags = merge({
    Name = "${var.queue_name_prefix}-transcode"
  }, var.tags)
}

resource "aws_sqs_queue" "transcribe_dlq" {
  count                     = var.manage_sqs ? 1 : 0
  name                      = "${var.queue_name_prefix}-transcribe-dlq"
  message_retention_seconds = 1209600
  sqs_managed_sse_enabled   = var.enable_sse

  tags = merge({
    Name = "${var.queue_name_prefix}-transcribe-dlq"
  }, var.tags)
}

resource "aws_sqs_queue" "transcribe" {
  count                      = var.manage_sqs ? 1 : 0
  name                       = "${var.queue_name_prefix}-transcribe"
  visibility_timeout_seconds = 900
  receive_wait_time_seconds  = var.receive_wait_time
  message_retention_seconds  = 1209600
  sqs_managed_sse_enabled    = var.enable_sse
  redrive_policy             = jsonencode({ deadLetterTargetArn = aws_sqs_queue.transcribe_dlq[0].arn, maxReceiveCount = var.max_receive_count })
  
  tags = merge({
    Name = "${var.queue_name_prefix}-transcribe"
  }, var.tags)
}

 
