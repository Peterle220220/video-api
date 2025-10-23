# ---------------------------------------------------------------------------------------------------------------------
# ECR REPOSITORIES
# Creates a separate ECR repository for each microservice.
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

resource "aws_ecr_repository" "auth" {
  name                 = "${var.project_name}-auth"
  image_tag_mutability = "MUTABLE"

  image_scanning_configuration {
    scan_on_push = true
  }

  tags = {
    qut-username = var.qut_username
    purpose      = "assessment"
  }
}

resource "aws_ecr_repository" "transcoding" {
  name                 = "${var.project_name}-transcoding"
  image_tag_mutability = "MUTABLE"

  image_scanning_configuration {
    scan_on_push = true
  }

  tags = {
    qut-username = var.qut_username
    purpose      = "assessment"
  }
}

resource "aws_ecr_repository" "upload" {
  name                 = "${var.project_name}-upload"
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