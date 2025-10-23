# ---------------------------------------------------------------------------------------------------------------------
# SQS DEAD LETTER QUEUE (DLQ)
# This queue receives messages that fail to be processed after a specified number of attempts.
# This satisfies the "Dead letter queue" additional criterion.
# It prevents message loss and allows for manual inspection or automated handling of failed tasks.
# ---------------------------------------------------------------------------------------------------------------------

resource "aws_sqs_queue" "transcoding_dlq" {
  name = "${var.project_name}-${var.qut_username}-transcoding-dlq"

  tags = {
    qut-username = var.qut_username
    purpose      = "assessment"
  }
}

# ---------------------------------------------------------------------------------------------------------------------
# SQS MAIN QUEUE
# This is the primary queue for distributing transcoding tasks to the worker services.
# This satisfies the "Load distribution" core criterion.
# It is configured with a redrive policy to send failed messages to the DLQ.
# ---------------------------------------------------------------------------------------------------------------------

resource "aws_sqs_queue" "transcoding_queue" {
  name                      = "${var.project_name}-${var.qut_username}-transcoding-queue"
  delay_seconds             = 0
  max_message_size          = 262144 # 256 KiB
  message_retention_seconds = 86400  # 1 day
  visibility_timeout_seconds = 300   # 5 minutes, should be longer than the expected max processing time

  # Redrive policy to move messages to the DLQ after 5 failed receives
  redrive_policy = jsonencode({
    deadLetterTargetArn = aws_sqs_queue.transcoding_dlq.arn
    maxReceiveCount     = 5
  })

  tags = {
    qut-username = var.qut_username
    purpose      = "assessment"
  }
}
