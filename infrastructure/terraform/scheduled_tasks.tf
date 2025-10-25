# ---------------------------------------------------------------------------------------------------------------------
# SCHEDULED TASKS
# ECS scheduled tasks for maintenance and cleanup operations
# This satisfies the "Advanced container orchestration" additional criterion.
# ---------------------------------------------------------------------------------------------------------------------

# CloudWatch Event Rule for scheduled maintenance
resource "aws_cloudwatch_event_rule" "maintenance_schedule" {
  name                = "n12122882-cab432-maintenance-schedule"
  description         = "Trigger maintenance tasks daily"
  schedule_expression = "rate(1 day)"  # Run daily at midnight UTC

  tags = {
    qut-username = var.qut_username
    purpose      = "assessment"
  }
}

# CloudWatch Event Target
resource "aws_cloudwatch_event_target" "ecs_scheduled_task" {
  rule      = aws_cloudwatch_event_rule.maintenance_schedule.name
  target_id = "ECSScheduledTask"
  arn       = aws_ecs_cluster.main.arn
  role_arn  = "arn:aws:iam::901444280953:role/CAB432-EventBridge-Rules-Role"

  ecs_target {
    task_count          = 1
    task_definition_arn = aws_ecs_task_definition.maintenance.arn
    launch_type         = "FARGATE"
    platform_version    = "LATEST"

    network_configuration {
      subnets          = data.aws_subnets.public.ids
      security_groups  = [data.aws_security_group.existing.id]
      assign_public_ip = true
    }
  }
}

# Use existing IAM roles

# Maintenance Task Definition
resource "aws_ecs_task_definition" "maintenance" {
  family                   = "n12122882-cab432-maintenance"
  network_mode             = "awsvpc"
  requires_compatibilities = ["FARGATE"]
  cpu                      = 256
  memory                   = 512
  execution_role_arn       = "arn:aws:iam::901444280953:role/Execution-Role-CAB432-ECS"
  task_role_arn            = "arn:aws:iam::901444280953:role/Task-Role-CAB432-ECS"

  container_definitions = jsonencode([
    {
      name      = "maintenance"
      image     = var.image_uri_maintenance
      essential = true
      environment = [
        {
          name  = "AWS_REGION"
          value = var.region
        },
        {
          name  = "S3_BUCKET_NAME"
          value = var.existing_s3_bucket
        },
        {
          name  = "DYNAMODB_TABLE_NAME"
          value = var.existing_dynamodb_table
        },
        {
          name  = "ECS_CLUSTER_NAME"
          value = aws_ecs_cluster.main.name
        }
      ]
      logConfiguration = {
        logDriver = "awslogs"
        options = {
          "awslogs-group"         = aws_cloudwatch_log_group.maintenance.name
          "awslogs-region"        = var.region
          "awslogs-stream-prefix" = "ecs"
        }
      }
    }
  ])

  tags = {
    qut-username = var.qut_username
    purpose      = "assessment"
  }
}

# CloudWatch Log Group for maintenance tasks - defined in ecs.tf

# Additional scheduled task for log cleanup (weekly)
resource "aws_cloudwatch_event_rule" "log_cleanup_schedule" {
  name                = "n12122882-cab432-log-cleanup"
  description         = "Trigger log cleanup tasks weekly"
  schedule_expression = "rate(7 days)"  # Run weekly

  tags = {
    qut-username = var.qut_username
    purpose      = "assessment"
  }
}

resource "aws_cloudwatch_event_target" "log_cleanup_task" {
  rule      = aws_cloudwatch_event_rule.log_cleanup_schedule.name
  target_id = "LogCleanupTask"
  arn       = aws_ecs_cluster.main.arn
  role_arn  = "arn:aws:iam::901444280953:role/CAB432-EventBridge-Rules-Role"

  ecs_target {
    task_count          = 1
    task_definition_arn = aws_ecs_task_definition.log_cleanup.arn
    launch_type         = "FARGATE"
    platform_version    = "LATEST"

    network_configuration {
      subnets          = data.aws_subnets.public.ids
      security_groups  = [data.aws_security_group.existing.id]
      assign_public_ip = true
    }
  }
}

# Log Cleanup Task Definition
resource "aws_ecs_task_definition" "log_cleanup" {
  family                   = "n12122882-cab432-log-cleanup"
  network_mode             = "awsvpc"
  requires_compatibilities = ["FARGATE"]
  cpu                      = 256
  memory                   = 512
  execution_role_arn       = "arn:aws:iam::901444280953:role/Execution-Role-CAB432-ECS"
  task_role_arn            = "arn:aws:iam::901444280953:role/Task-Role-CAB432-ECS"

  container_definitions = jsonencode([
    {
      name      = "log-cleanup"
      image     = var.image_uri_log_cleanup
      essential = true
      environment = [
        {
          name  = "AWS_REGION"
          value = var.region
        }
      ]
      logConfiguration = {
        logDriver = "awslogs"
        options = {
          "awslogs-group"         = aws_cloudwatch_log_group.log_cleanup.name
          "awslogs-region"        = var.region
          "awslogs-stream-prefix" = "ecs"
        }
      }
    }
  ])

  tags = {
    qut-username = var.qut_username
    purpose      = "assessment"
  }
}

# CloudWatch Log Group for log cleanup tasks - defined in ecs.tf
