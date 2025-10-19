variable "queue_name_prefix" {
  description = "Prefix for SQS queue names"
  type        = string
  default     = "video-api-a2"
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

resource "aws_sqs_queue" "transcode_dlq" {
  name                      = "${var.queue_name_prefix}-transcode-dlq"
  message_retention_seconds = 1209600
}

resource "aws_sqs_queue" "transcode" {
  name                       = "${var.queue_name_prefix}-transcode"
  visibility_timeout_seconds = var.visibility_timeout
  redrive_policy             = jsonencode({ deadLetterTargetArn = aws_sqs_queue.transcode_dlq.arn, maxReceiveCount = var.max_receive_count })
}

resource "aws_sqs_queue" "transcribe_dlq" {
  name                      = "${var.queue_name_prefix}-transcribe-dlq"
  message_retention_seconds = 1209600
}

resource "aws_sqs_queue" "transcribe" {
  name                       = "${var.queue_name_prefix}-transcribe"
  visibility_timeout_seconds = 900
  redrive_policy             = jsonencode({ deadLetterTargetArn = aws_sqs_queue.transcribe_dlq.arn, maxReceiveCount = var.max_receive_count })
}

 
