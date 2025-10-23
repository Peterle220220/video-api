# ---------------------------------------------------------------------------------------------------------------------
# APPLICATION AUTO SCALING
# This file configures auto-scaling for the CPU-intensive worker service.
# This satisfies the "Auto scaling" core criterion.
# It automatically adjusts the number of tasks based on CPU utilization.
# ---------------------------------------------------------------------------------------------------------------------

# Register the SQS worker service as a scalable target.
resource "aws_appautoscaling_target" "sqs_worker_target" {
  max_capacity       = 3 # Scales up to a maximum of 3 tasks
  min_capacity       = 1 # Scales down to a minimum of 1 task
  resource_id        = "service/${aws_ecs_cluster.main.name}/${aws_ecs_service.sqs_worker.name}"
  scalable_dimension = "ecs:service:DesiredCount"
  service_namespace  = "ecs"
}

# Define the scaling policy based on average CPU utilization.
resource "aws_appautoscaling_policy" "sqs_worker_cpu_policy" {
  name               = "${var.project_name}-sqs-worker-cpu-scaling"
  policy_type        = "TargetTrackingScaling"
  resource_id        = aws_appautoscaling_target.sqs_worker_target.resource_id
  scalable_dimension = aws_appautoscaling_target.sqs_worker_target.scalable_dimension
  service_namespace  = aws_appautoscaling_target.sqs_worker_target.service_namespace

  target_tracking_scaling_policy_configuration {
    predefined_metric_specification {
      predefined_metric_type = "ECSServiceAverageCPUUtilization"
    }

    target_value = 70 # Target 70% average CPU utilization

    # Cooldown periods to prevent rapid, successive scaling actions.
    scale_in_cooldown  = 300 # 5 minutes before scaling in
    scale_out_cooldown = 60  # 1 minute before scaling out
  }
}
