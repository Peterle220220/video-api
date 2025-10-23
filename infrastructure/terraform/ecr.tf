# ---------------------------------------------------------------------------------------------------------------------
# ECR REPOSITORIES
# Creates a separate ECR repository for each microservice. This allows for independent
# versioning and deployment of each service's Docker image.
# ---------------------------------------------------------------------------------------------------------------------

resource "aws_ecr_repository" "web" {
  name                 = "${var.project_name}-web"
  image_tag_mutability = "MUTABLE"

  image_scanning_configuration {
    scan_on_push = true
  }

  tags = {
    qut-username = var.qut_username
    purpose      = "assessment"
  }
}

resource "aws_ecr_repository" "video_api" {
  name                 = "${var.project_name}-video-api"
  image_tag_mutability = "MUTABLE"

  image_scanning_configuration {
    scan_on_push = true
  }

  tags = {
    qut-username = var.qut_username
    purpose      = "assessment"
  }
}

resource "aws_ecr_repository" "auth_service" {
  name                 = "${var.project_name}-auth-service"
  image_tag_mutability = "MUTABLE"

  image_scanning_configuration {
    scan_on_push = true
  }

  tags = {
    qut-username = var.qut_username
    purpose      = "assessment"
  }
}

resource "aws_ecr_repository" "sqs_worker" {
  name                 = "${var.project_name}-sqs-worker"
  image_tag_mutability = "MUTABLE"

  image_scanning_configuration {
    scan_on_push = true
  }

  tags = {
    qut-username = var.qut_username
    purpose      = "assessment"
  }
}
