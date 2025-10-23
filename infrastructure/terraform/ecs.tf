# ---------------------------------------------------------------------------------------------------------------------
# ECS CLUSTER
# The cluster provides a logical grouping for all services and tasks.
# It is configured to use Fargate, which is a serverless compute engine for containers.
# ---------------------------------------------------------------------------------------------------------------------

resource "aws_ecs_cluster" "main" {
  name = "n12122882-cab432-a3-cluster"

  setting {
    name  = "containerInsights"
    value = "enabled"
  }

  tags = {
    qut-username = var.qut_username
    purpose      = "assessment"
  }
}

# ---------------------------------------------------------------------------------------------------------------------
# LOGGING
# Each service gets its own CloudWatch Log Group for isolated log streams.
# ---------------------------------------------------------------------------------------------------------------------

resource "aws_cloudwatch_log_group" "web" {
  name = "/ecs/${var.project_name}-web"
  tags = {
    qut-username = var.qut_username
    purpose      = "assessment"
  }
}

resource "aws_cloudwatch_log_group" "api" {
  name = "/ecs/${var.project_name}-api"
  tags = {
    qut-username = var.qut_username
    purpose      = "assessment"
  }
}

resource "aws_cloudwatch_log_group" "auth" {
  name = "/ecs/${var.project_name}-auth"
  tags = {
    qut-username = var.qut_username
    purpose      = "assessment"
  }
}

resource "aws_cloudwatch_log_group" "sqs_worker" {
  name = "/ecs/${var.project_name}-sqs-worker"
  tags = {
    qut-username = var.qut_username
    purpose      = "assessment"
  }
}

# ---------------------------------------------------------------------------------------------------------------------
# TASK DEFINITIONS
# Blueprints that describe how to run a Docker container.
# ---------------------------------------------------------------------------------------------------------------------

# Task Definition for the Web Frontend service
resource "aws_ecs_task_definition" "web" {
  family                   = "${var.project_name}-web"
  network_mode             = "awsvpc"
  requires_compatibilities = ["FARGATE"]
  cpu                      = var.ecs_task_cpu
  memory                   = var.ecs_task_memory
  execution_role_arn       = aws_iam_role.ecs_task_execution_role.arn
  task_role_arn            = aws_iam_role.ecs_task_role.arn # Grant permissions to the app

  container_definitions = jsonencode([
    {
      name      = "web"
      image     = var.image_uri_web
      cpu       = var.ecs_task_cpu
      memory    = var.ecs_task_memory
      essential = true
      portMappings = [
        {
          containerPort = 3000
          hostPort      = 3000
        }
      ]
      logConfiguration = {
        logDriver = "awslogs"
        options = {
          "awslogs-group"         = aws_cloudwatch_log_group.web.name
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

# ... (similar task definitions for api, auth, and sqs_worker) ...
# Note: You would create separate aws_ecs_task_definition resources for
# video-api, auth-service, and sqs-worker, pointing to their respective
# images, log groups, and container ports.

# Example for SQS Worker (no port mappings needed)
resource "aws_ecs_task_definition" "sqs_worker" {
  family                   = "${var.project_name}-sqs-worker"
  network_mode             = "awsvpc"
  requires_compatibilities = ["FARGATE"]
  cpu                      = var.ecs_task_cpu
  memory                   = var.ecs_task_memory
  execution_role_arn       = aws_iam_role.ecs_task_execution_role.arn
  task_role_arn            = aws_iam_role.ecs_task_role.arn

  container_definitions = jsonencode([
    {
      name      = "sqs-worker"
      image     = var.image_uri_sqs_worker
      cpu       = var.ecs_task_cpu
      memory    = var.ecs_task_memory
      essential = true
      # Environment variables to pass queue URL to the worker
      environment = [
        {
          name = "SQS_QUEUE_URL",
          value = aws_sqs_queue.transcoding_queue.id
        }
      ]
      logConfiguration = {
        logDriver = "awslogs"
        options = {
          "awslogs-group"         = aws_cloudwatch_log_group.sqs_worker.name
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

# (You would also add task definitions for video-api and auth-service here)


# ---------------------------------------------------------------------------------------------------------------------
# ECS SERVICES
# Manages the lifecycle of tasks, ensuring the desired number of instances are running.
# ---------------------------------------------------------------------------------------------------------------------

resource "aws_ecs_service" "web" {
  name            = "${var.project_name}-web-service"
  cluster         = aws_ecs_cluster.main.id
  task_definition = aws_ecs_task_definition.web.arn
  desired_count   = 1 # Start with one instance
  launch_type     = "FARGATE"

  network_configuration {
    subnets         = data.aws_subnets.public.ids
    security_groups = [aws_security_group.app_sg.id]
    assign_public_ip = true
  }

  load_balancer {
    target_group_arn = aws_lb_target_group.web.arn
    container_name   = "web"
    container_port   = 3000
  }

  # This ensures that the service waits for the ALB to be ready before starting.
  depends_on = [aws_lb_listener.https]
}

# SQS Worker Service (no load balancer)
resource "aws_ecs_service" "sqs_worker" {
  name            = "${var.project_name}-sqs-worker-service"
  cluster         = aws_ecs_cluster.main.id
  task_definition = aws_ecs_task_definition.sqs_worker.arn
  desired_count   = 1 # This will be managed by auto-scaling
  launch_type     = "FARGATE"

  network_configuration {
    subnets         = data.aws_subnets.public.ids
    security_groups = [aws_security_group.app_sg.id]
    assign_public_ip = true # Needed to pull images from ECR if not using a NAT Gateway
  }
}

# (You would also add aws_ecs_service resources for video-api and auth-service here,
# linking them to their respective target groups)
