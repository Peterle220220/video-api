# Note: This file sets up example CloudWatch alarms for SQS metrics.
# ECS Service autoscaling wiring is now added using Target Tracking on CPU
# for the transcoder worker service. The service must exist in the cluster
# with the given name for autoscaling to attach successfully.

variable "transcoder_service_name" {
  description = "ECS service name of the transcoder worker (leave empty to default to <app_name>-transcoder)"
  type        = string
  default     = ""
}

variable "transcoder_min_capacity" {
  description = "Minimum desired task count for transcoder service"
  type        = number
  default     = 1
}

variable "transcoder_max_capacity" {
  description = "Maximum desired task count for transcoder service"
  type        = number
  default     = 3
}

variable "transcoder_cpu_target" {
  description = "Target average CPU utilization percentage for autoscaling"
  type        = number
  default     = 70
}

variable "transcoder_scale_out_cooldown" {
  description = "Seconds to wait after a scale-out activity before another scale action"
  type        = number
  default     = 60
}

variable "transcoder_scale_in_cooldown" {
  description = "Seconds to wait after a scale-in activity before another scale action"
  type        = number
  default     = 180
}

locals {
  transcoder_service_name = var.transcoder_service_name != "" ? var.transcoder_service_name : "${var.app_name}-transcoder"
  transcoder_resource_id  = "service/${aws_ecs_cluster.this.name}/${local.transcoder_service_name}"
}

# Attach Application Auto Scaling target to the ECS service desired count
resource "aws_appautoscaling_target" "transcoder" {
  service_namespace  = "ecs"
  resource_id        = local.transcoder_resource_id
  scalable_dimension = "ecs:service:DesiredCount"
  min_capacity       = var.transcoder_min_capacity
  max_capacity       = var.transcoder_max_capacity
}

# Target Tracking policy: ECS Service Average CPU Utilization @ target (default 70%)
resource "aws_appautoscaling_policy" "transcoder_target_cpu" {
  name               = "${var.app_name}-transcoder-target-cpu"
  service_namespace  = aws_appautoscaling_target.transcoder.service_namespace
  resource_id        = aws_appautoscaling_target.transcoder.resource_id
  scalable_dimension = aws_appautoscaling_target.transcoder.scalable_dimension
  policy_type        = "TargetTrackingScaling"

  target_tracking_scaling_policy_configuration {
    target_value       = var.transcoder_cpu_target
    scale_out_cooldown = var.transcoder_scale_out_cooldown
    scale_in_cooldown  = var.transcoder_scale_in_cooldown

    predefined_metric_specification {
      predefined_metric_type = "ECSServiceAverageCPUUtilization"
    }
  }
}

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


