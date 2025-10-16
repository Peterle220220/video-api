# Note: This file sets up example CloudWatch alarms for SQS metrics.
# ECS Service autoscaling wiring is left as a next step, as it requires
# service ARNs from created services.

resource "aws_cloudwatch_metric_alarm" "transcoder_queue_depth_high" {
  alarm_name          = "transcoder-queue-depth-high"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 1
  metric_name         = "ApproximateNumberOfMessagesVisible"
  namespace           = "AWS/SQS"
  period              = 60
  statistic           = "Average"
  threshold           = 10
  dimensions = {
    QueueName = aws_sqs_queue.transcode.name
  }
}

resource "aws_cloudwatch_metric_alarm" "transcoder_oldest_age_high" {
  alarm_name          = "transcoder-oldest-age-high"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 1
  metric_name         = "ApproximateAgeOfOldestMessage"
  namespace           = "AWS/SQS"
  period              = 60
  statistic           = "Average"
  threshold           = 300
  dimensions = {
    QueueName = aws_sqs_queue.transcode.name
  }
}


