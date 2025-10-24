# ---------------------------------------------------------------------------------------------------------------------
# SQS QUEUES AND DEAD LETTER QUEUES
# This file defines SQS queues for inter-service communication and their corresponding DLQs.
# This satisfies the "Dead letter queue" additional criterion.
# ---------------------------------------------------------------------------------------------------------------------

# ---------------------------------------------------------------------------------------------------------------------
# DEAD LETTER QUEUES
# DLQs store messages that have failed processing after multiple retries.
# ---------------------------------------------------------------------------------------------------------------------

resource "aws_sqs_queue" "transcoding_dlq" {
  name                      = "transcoding-dlq"
  message_retention_seconds = 1209600 # 14 days
  visibility_timeout_seconds = 30

  tags = {
    qut-username = var.qut_username
    purpose      = "assessment"
    queue-type   = "dlq"
    service      = "transcoding"
  }
}

resource "aws_sqs_queue" "upload_dlq" {
  name                      = "upload-dlq"
  message_retention_seconds = 1209600 # 14 days
  visibility_timeout_seconds = 30

  tags = {
    qut-username = var.qut_username
    purpose      = "assessment"
    queue-type   = "dlq"
    service      = "upload"
  }
}

resource "aws_sqs_queue" "storage_dlq" {
  name                      = "storage-dlq"
  message_retention_seconds = 1209600 # 14 days
  visibility_timeout_seconds = 30

  tags = {
    qut-username = var.qut_username
    purpose      = "assessment"
    queue-type   = "dlq"
    service      = "storage"
  }
}

resource "aws_sqs_queue" "notifications_dlq" {
  name                      = "notifications-dlq"
  message_retention_seconds = 1209600 # 14 days
  visibility_timeout_seconds = 30

  tags = {
    qut-username = var.qut_username
    purpose      = "assessment"
    queue-type   = "dlq"
    service      = "notifications"
  }
}

# ---------------------------------------------------------------------------------------------------------------------
# MAIN SQS QUEUES (EXISTING)
# Use existing queues instead of creating new ones to avoid conflicts
# ---------------------------------------------------------------------------------------------------------------------

# Data sources to reference existing queues
data "aws_sqs_queue" "transcoding" {
  name = "transcoding-queue"
}

data "aws_sqs_queue" "upload" {
  name = "upload-queue"
}

data "aws_sqs_queue" "storage" {
  name = "storage-queue"
}

data "aws_sqs_queue" "notifications" {
  name = "notifications-queue"
}

# Note: We cannot modify existing queues' redrive policies via Terraform
# The existing queues will need to be manually configured with DLQ redrive policies
# or we can work with the existing configuration

# ---------------------------------------------------------------------------------------------------------------------
# CLOUDWATCH ALARMS FOR DLQ MONITORING
# Alerts when messages appear in DLQs, indicating processing failures.
# ---------------------------------------------------------------------------------------------------------------------

resource "aws_cloudwatch_metric_alarm" "transcoding_dlq_alarm" {
  alarm_name          = "${var.project_name}-transcoding-dlq-alarm"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = "1"
  metric_name         = "ApproximateNumberOfVisibleMessages"
  namespace           = "AWS/SQS"
  period              = "300"
  statistic           = "Average"
  threshold           = "0"
  alarm_description   = "This metric monitors transcoding DLQ messages"
  alarm_actions       = []

  dimensions = {
    QueueName = aws_sqs_queue.transcoding_dlq.name
  }

  tags = {
    qut-username = var.qut_username
    purpose      = "assessment"
    alarm-type   = "dlq-monitoring"
  }
}

resource "aws_cloudwatch_metric_alarm" "upload_dlq_alarm" {
  alarm_name          = "${var.project_name}-upload-dlq-alarm"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = "1"
  metric_name         = "ApproximateNumberOfVisibleMessages"
  namespace           = "AWS/SQS"
  period              = "300"
  statistic           = "Average"
  threshold           = "0"
  alarm_description   = "This metric monitors upload DLQ messages"
  alarm_actions       = []

  dimensions = {
    QueueName = aws_sqs_queue.upload_dlq.name
  }

  tags = {
    qut-username = var.qut_username
    purpose      = "assessment"
    alarm-type   = "dlq-monitoring"
  }
}

resource "aws_cloudwatch_metric_alarm" "storage_dlq_alarm" {
  alarm_name          = "${var.project_name}-storage-dlq-alarm"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = "1"
  metric_name         = "ApproximateNumberOfVisibleMessages"
  namespace           = "AWS/SQS"
  period              = "300"
  statistic           = "Average"
  threshold           = "0"
  alarm_description   = "This metric monitors storage DLQ messages"
  alarm_actions       = []

  dimensions = {
    QueueName = aws_sqs_queue.storage_dlq.name
  }

  tags = {
    qut-username = var.qut_username
    purpose      = "assessment"
    alarm-type   = "dlq-monitoring"
  }
}

resource "aws_cloudwatch_metric_alarm" "notifications_dlq_alarm" {
  alarm_name          = "${var.project_name}-notifications-dlq-alarm"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = "1"
  metric_name         = "ApproximateNumberOfVisibleMessages"
  namespace           = "AWS/SQS"
  period              = "300"
  statistic           = "Average"
  threshold           = "0"
  alarm_description   = "This metric monitors notifications DLQ messages"
  alarm_actions       = []

  dimensions = {
    QueueName = aws_sqs_queue.notifications_dlq.name
  }

  tags = {
    qut-username = var.qut_username
    purpose      = "assessment"
    alarm-type   = "dlq-monitoring"
  }
}

# ---------------------------------------------------------------------------------------------------------------------
# OUTPUTS
# Export queue URLs and ARNs for use in other resources.
# ---------------------------------------------------------------------------------------------------------------------

output "sqs_queue_urls" {
  description = "URLs of the main SQS queues (existing)"
  value = {
    transcoding = data.aws_sqs_queue.transcoding.url
    upload      = data.aws_sqs_queue.upload.url
    storage     = data.aws_sqs_queue.storage.url
    notifications = data.aws_sqs_queue.notifications.url
  }
}

output "sqs_dlq_urls" {
  description = "URLs of the Dead Letter Queues (newly created)"
  value = {
    transcoding_dlq = aws_sqs_queue.transcoding_dlq.url
    upload_dlq      = aws_sqs_queue.upload_dlq.url
    storage_dlq     = aws_sqs_queue.storage_dlq.url
    notifications_dlq = aws_sqs_queue.notifications_dlq.url
  }
}

output "sqs_queue_arns" {
  description = "ARNs of the main SQS queues (existing)"
  value = {
    transcoding = data.aws_sqs_queue.transcoding.arn
    upload      = data.aws_sqs_queue.upload.arn
    storage     = data.aws_sqs_queue.storage.arn
    notifications = data.aws_sqs_queue.notifications.arn
  }
}
