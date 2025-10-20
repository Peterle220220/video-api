variable "app_name" {
  type    = string
  default = "video-api"
}

variable "manage_ecs" {
  description = "Whether Terraform should create ECS cluster, IAM roles, and log groups"
  type        = bool
  default     = false
}

resource "aws_ecs_cluster" "this" {
  count = var.manage_ecs ? 1 : 0
  name  = "${var.app_name}-cluster"
}

# CloudWatch log groups
resource "aws_cloudwatch_log_group" "api" {
  count             = var.manage_ecs ? 1 : 0
  name              = "/ecs/${var.app_name}-api"
  retention_in_days = 7
}

resource "aws_cloudwatch_log_group" "transcoder" {
  count             = var.manage_ecs ? 1 : 0
  name              = "/ecs/${var.app_name}-transcoder"
  retention_in_days = 7
}

resource "aws_cloudwatch_log_group" "transcribe" {
  count             = var.manage_ecs ? 1 : 0
  name              = "/ecs/${var.app_name}-transcribe"
  retention_in_days = 7
}

resource "aws_cloudwatch_log_group" "dlq" {
  count             = var.manage_ecs ? 1 : 0
  name              = "/ecs/${var.app_name}-dlq"
  retention_in_days = 7
}

# Execution role for tasks
resource "aws_iam_role" "task_execution" {
  count = var.manage_ecs ? 1 : 0
  name  = "${var.app_name}-task-execution"
  assume_role_policy = jsonencode({
    Version = "2012-10-17",
    Statement = [{ Effect = "Allow", Principal = { Service = "ecs-tasks.amazonaws.com" }, Action = "sts:AssumeRole" }]
  })
}

resource "aws_iam_role_policy_attachment" "task_execution_policy" {
  count      = var.manage_ecs ? 1 : 0
  role       = aws_iam_role.task_execution[0].name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AmazonECSTaskExecutionRolePolicy"
}

# Task role with least privilege (S3, SQS, DynamoDB)
resource "aws_iam_role" "task_role" {
  count = var.manage_ecs ? 1 : 0
  name  = "${var.app_name}-task-role"
  assume_role_policy = jsonencode({
    Version = "2012-10-17",
    Statement = [{ Effect = "Allow", Principal = { Service = "ecs-tasks.amazonaws.com" }, Action = "sts:AssumeRole" }]
  })
}

data "aws_iam_policy_document" "task_inline" {
  statement {
    effect = "Allow"
    actions = [
      "s3:GetObject", "s3:PutObject", "s3:ListBucket", "s3:HeadObject"
    ]
    resources = flatten([
      try([aws_s3_bucket.videos.arn, "${aws_s3_bucket.videos.arn}/*"], [])
    ])
  }
  statement {
    effect = "Allow"
    actions = ["sqs:SendMessage", "sqs:ReceiveMessage", "sqs:DeleteMessage", "sqs:ChangeMessageVisibility", "sqs:GetQueueAttributes"]
    resources = compact([
      try(aws_sqs_queue.transcode[0].arn, null),
      try(aws_sqs_queue.transcode_dlq[0].arn, null),
      try(aws_sqs_queue.transcribe[0].arn, null),
      try(aws_sqs_queue.transcribe_dlq[0].arn, null)
    ])
  }
  statement {
    effect = "Allow"
    actions = ["dynamodb:PutItem", "dynamodb:GetItem", "dynamodb:UpdateItem", "dynamodb:Query"]
    resources = ["*"]
  }
}

resource "aws_iam_role_policy" "task_inline" {
  count  = var.manage_ecs ? 1 : 0
  name   = "${var.app_name}-task-inline"
  role   = aws_iam_role.task_role[0].id
  policy = data.aws_iam_policy_document.task_inline.json
}

# Placeholders for Task Definitions and Services (ECR images assumed to be pre-built)
# You can wire API service with ALB separately as needed for demo


