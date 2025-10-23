# ---------------------------------------------------------------------------------------------------------------------
# SQS DEAD LETTER QUEUE (DLQ)
# This queue receives messages that fail to be processed after a specified number of attempts.
# This satisfies the "Dead letter queue" additional criterion.
# ---------------------------------------------------------------------------------------------------------------------

resource "aws_sqs_queue" "transcoding_dlq" {
  name = "${var.project_name}-${var.qut_username}-transcoding-dlq"

  tags = {
    qut-username = var.qut_username
    purpose      = "assessment"
  }
}

# ---------------------------------------------------------------------------------------------------------------------
# SQS MAIN QUEUES
# These are the primary queues for distributing tasks to worker services.
# This satisfies the "Load distribution" core criterion.
# ---------------------------------------------------------------------------------------------------------------------

# Main transcoding queue with DLQ
resource "aws_sqs_queue" "transcoding_queue" {
  name                      = "${var.project_name}-${var.qut_username}-transcoding-queue"
  delay_seconds             = 0
  max_message_size          = 262144 # 256 KiB
  message_retention_seconds = 86400  # 1 day
  visibility_timeout_seconds = 1800  # 30 minutes for transcoding

  # Redrive policy to move messages to the DLQ after 3 failed receives
  redrive_policy = jsonencode({
    deadLetterTargetArn = aws_sqs_queue.transcoding_dlq.arn
    maxReceiveCount     = 3
  })

  tags = {
    qut-username = var.qut_username
    purpose      = "assessment"
  }
}

# Upload queue
resource "aws_sqs_queue" "upload_queue" {
  name                      = "${var.project_name}-${var.qut_username}-upload-queue"
  delay_seconds             = 0
  max_message_size          = 262144 # 256 KiB
  message_retention_seconds = 86400  # 1 day
  visibility_timeout_seconds = 300   # 5 minutes

  tags = {
    qut-username = var.qut_username
    purpose      = "assessment"
  }
}

# Storage queue (AssemblyAI)
resource "aws_sqs_queue" "storage_queue" {
  name                      = "${var.project_name}-${var.qut_username}-storage-queue"
  delay_seconds             = 0
  max_message_size          = 262144 # 256 KiB
  message_retention_seconds = 86400  # 1 day
  visibility_timeout_seconds = 1800  # 30 minutes

  tags = {
    qut-username = var.qut_username
    purpose      = "assessment"
  }
}

# Notifications queue
resource "aws_sqs_queue" "notifications_queue" {
  name                      = "${var.project_name}-${var.qut_username}-notifications-queue"
  delay_seconds             = 0
  max_message_size          = 262144 # 256 KiB
  message_retention_seconds = 86400  # 1 day
  visibility_timeout_seconds = 60    # 1 minute

  tags = {
    qut-username = var.qut_username
    purpose      = "assessment"
  }
}