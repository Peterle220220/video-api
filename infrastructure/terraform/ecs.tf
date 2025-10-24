# ---------------------------------------------------------------------------------------------------------------------
# ECS CLUSTER
# The cluster provides a logical grouping for all services and tasks.
# ---------------------------------------------------------------------------------------------------------------------

resource "aws_ecs_cluster" "main" {
  name = "n12122882-a3-cluster"

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
}

resource "aws_cloudwatch_log_group" "auth" {
  name = "/ecs/${var.project_name}-auth"
}

resource "aws_cloudwatch_log_group" "transcoding" {
  name = "/ecs/${var.project_name}-transcoding"
}

resource "aws_cloudwatch_log_group" "upload" {
  name = "/ecs/${var.project_name}-upload"
}

resource "aws_cloudwatch_log_group" "sqs_worker" {
  name = "/ecs/${var.project_name}-sqs-worker"
}

resource "aws_cloudwatch_log_group" "maintenance" {
  name = "/ecs/${var.project_name}-maintenance"
}

resource "aws_cloudwatch_log_group" "log_cleanup" {
  name = "/ecs/${var.project_name}-log-cleanup"
}

# ---------------------------------------------------------------------------------------------------------------------
# TASK DEFINITIONS
# Blueprints that describe how to run Docker containers.
# ---------------------------------------------------------------------------------------------------------------------

# Task Definition for the Web Frontend service
resource "aws_ecs_task_definition" "web" {
  family                   = "${var.project_name}-web"
  network_mode             = "awsvpc"
  requires_compatibilities = ["FARGATE"]
  cpu                      = var.ecs_task_cpu
  memory                   = var.ecs_task_memory
  execution_role_arn       = "arn:aws:iam::901444280953:role/Execution-Role-CAB432-ECS"
  task_role_arn            = "arn:aws:iam::901444280953:role/Task-Role-CAB432-ECS"

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
      environment = [
        {
          name  = "REACT_APP_AUTH_SERVICE_URL"
          value = "https://${var.domain_name}/api/auth"
        },
        {
          name  = "REACT_APP_TRANSCODING_SERVICE_URL"
          value = "https://${var.domain_name}/api/transcoding"
        },
        {
          name  = "REACT_APP_UPLOAD_SERVICE_URL"
          value = "https://${var.domain_name}/api/storage"
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

# Task Definition for the Auth service
resource "aws_ecs_task_definition" "auth" {
  family                   = "${var.project_name}-auth"
  network_mode             = "awsvpc"
  requires_compatibilities = ["FARGATE"]
  cpu                      = var.ecs_task_cpu
  memory                   = var.ecs_task_memory
  execution_role_arn       = "arn:aws:iam::901444280953:role/Execution-Role-CAB432-ECS"
  task_role_arn            = "arn:aws:iam::901444280953:role/Task-Role-CAB432-ECS"

  container_definitions = jsonencode([
    {
      name      = "auth"
      image     = var.image_uri_auth
      cpu       = var.ecs_task_cpu
      memory    = var.ecs_task_memory
      essential = true
      portMappings = [
        {
          containerPort = 3001
          hostPort      = 3001
        }
      ]
      environment = [
        {
          name  = "NODE_ENV"
          value = "production"
        },
        {
          name  = "PORT"
          value = "3001"
        },
        {
          name  = "AWS_REGION"
          value = var.region
        },
        {
          name  = "COGNITO_USER_POOL_ID"
          value = var.existing_cognito_user_pool_id
        },
        {
          name  = "COGNITO_CLIENT_ID"
          value = var.existing_cognito_client_id
        }
      ]
      logConfiguration = {
        logDriver = "awslogs"
        options = {
          "awslogs-group"         = aws_cloudwatch_log_group.auth.name
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

# Task Definition for the Transcoding service (CPU-intensive)
resource "aws_ecs_task_definition" "transcoding" {
  family                   = "${var.project_name}-transcoding"
  network_mode             = "awsvpc"
  requires_compatibilities = ["FARGATE"]
  cpu                      = var.transcoding_task_cpu
  memory                   = var.transcoding_task_memory
  execution_role_arn       = "arn:aws:iam::901444280953:role/Execution-Role-CAB432-ECS"
  task_role_arn            = "arn:aws:iam::901444280953:role/Task-Role-CAB432-ECS"

  container_definitions = jsonencode([
    {
      name      = "transcoding"
      image     = var.image_uri_transcoding
      cpu       = var.transcoding_task_cpu
      memory    = var.transcoding_task_memory
      essential = true
      portMappings = [
        {
          containerPort = 3002
          hostPort      = 3002
        }
      ]
      environment = [
        {
          name  = "NODE_ENV"
          value = "production"
        },
        {
          name  = "PORT"
          value = "3002"
        },
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
      ]
      logConfiguration = {
        logDriver = "awslogs"
        options = {
          "awslogs-group"         = aws_cloudwatch_log_group.transcoding.name
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

# Task Definition for the Upload service
resource "aws_ecs_task_definition" "upload" {
  family                   = "${var.project_name}-upload"
  network_mode             = "awsvpc"
  requires_compatibilities = ["FARGATE"]
  cpu                      = var.ecs_task_cpu
  memory                   = var.ecs_task_memory
  execution_role_arn       = "arn:aws:iam::901444280953:role/Execution-Role-CAB432-ECS"
  task_role_arn            = "arn:aws:iam::901444280953:role/Task-Role-CAB432-ECS"

  container_definitions = jsonencode([
    {
      name      = "upload"
      image     = var.image_uri_upload
      cpu       = var.ecs_task_cpu
      memory    = var.ecs_task_memory
      essential = true
      portMappings = [
        {
          containerPort = 3003
          hostPort      = 3003
        }
      ]
      environment = [
        {
          name  = "NODE_ENV"
          value = "production"
        },
        {
          name  = "PORT"
          value = "3003"
        },
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
        }
      ]
      logConfiguration = {
        logDriver = "awslogs"
        options = {
          "awslogs-group"         = aws_cloudwatch_log_group.upload.name
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

# Task Definition for the SQS Worker (CPU-intensive for auto-scaling)
resource "aws_ecs_task_definition" "sqs_worker" {
  family                   = "${var.project_name}-sqs-worker"
  network_mode             = "awsvpc"
  requires_compatibilities = ["FARGATE"]
  cpu                      = var.transcoding_task_cpu
  memory                   = var.transcoding_task_memory
  execution_role_arn       = "arn:aws:iam::901444280953:role/Execution-Role-CAB432-ECS"
  task_role_arn            = "arn:aws:iam::901444280953:role/Task-Role-CAB432-ECS"

  container_definitions = jsonencode([
    {
      name      = "sqs-worker"
      image     = var.image_uri_sqs_worker
      cpu       = var.transcoding_task_cpu
      memory    = var.transcoding_task_memory
      essential = true
      environment = [
        {
          name  = "NODE_ENV"
          value = "production"
        },
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

# ---------------------------------------------------------------------------------------------------------------------
# ECS SERVICES
# Manages the lifecycle of tasks, ensuring the desired number of instances are running.
# ---------------------------------------------------------------------------------------------------------------------

resource "aws_ecs_service" "web" {
  name            = "${var.project_name}-web-service"
  cluster         = aws_ecs_cluster.main.id
  task_definition = aws_ecs_task_definition.web.arn
  desired_count   = 1
  launch_type     = "FARGATE"

  # Rolling update configuration with failure detection
  deployment_maximum_percent         = 200  # Allow up to 200% of desired count during deployment
  deployment_minimum_healthy_percent = 50   # Keep at least 50% healthy during deployment

  deployment_circuit_breaker {
    enable   = true
    rollback = true  # Automatically rollback on failure
  }

  # Health check grace period
  health_check_grace_period_seconds = 60

  network_configuration {
    subnets         = data.aws_subnets.public.ids
    security_groups = [data.aws_security_group.existing.id]
    assign_public_ip = true
  }

  load_balancer {
    target_group_arn = aws_lb_target_group.web.arn
    container_name   = "web"
    container_port   = 3000
  }


  depends_on = [aws_lb_listener.https]
}

resource "aws_ecs_service" "auth" {
  name            = "${var.project_name}-auth-service"
  cluster         = aws_ecs_cluster.main.id
  task_definition = aws_ecs_task_definition.auth.arn
  desired_count   = 1
  launch_type     = "FARGATE"

  network_configuration {
    subnets         = data.aws_subnets.public.ids
    security_groups = [data.aws_security_group.existing.id]
    assign_public_ip = true
  }

  load_balancer {
    target_group_arn = aws_lb_target_group.auth.arn
    container_name   = "auth"
    container_port   = 3001
  }

  depends_on = [aws_lb_listener.https]
}

resource "aws_ecs_service" "transcoding" {
  name            = "${var.project_name}-transcoding-service"
  cluster         = aws_ecs_cluster.main.id
  task_definition = aws_ecs_task_definition.transcoding.arn
  desired_count   = 1
  launch_type     = "FARGATE"

  network_configuration {
    subnets         = data.aws_subnets.public.ids
    security_groups = [data.aws_security_group.existing.id]
    assign_public_ip = true
  }

  load_balancer {
    target_group_arn = aws_lb_target_group.transcoding.arn
    container_name   = "transcoding"
    container_port   = 3002
  }

  depends_on = [aws_lb_listener.https]
}

resource "aws_ecs_service" "upload" {
  name            = "${var.project_name}-upload-service"
  cluster         = aws_ecs_cluster.main.id
  task_definition = aws_ecs_task_definition.upload.arn
  desired_count   = 1
  launch_type     = "FARGATE"

  network_configuration {
    subnets         = data.aws_subnets.public.ids
    security_groups = [data.aws_security_group.existing.id]
    assign_public_ip = true
  }

  load_balancer {
    target_group_arn = aws_lb_target_group.upload.arn
    container_name   = "upload"
    container_port   = 3003
  }

  depends_on = [aws_lb_listener.https]
}

# SQS Worker Service (no load balancer, will be auto-scaled)
resource "aws_ecs_service" "sqs_worker" {
  name            = "${var.project_name}-sqs-worker-service"
  cluster         = aws_ecs_cluster.main.id
  task_definition = aws_ecs_task_definition.sqs_worker.arn
  desired_count   = 1 # This will be managed by auto-scaling
  launch_type     = "FARGATE"

  network_configuration {
    subnets         = data.aws_subnets.public.ids
    security_groups = [data.aws_security_group.existing.id]
    assign_public_ip = true
  }
}