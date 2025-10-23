# ---------------------------------------------------------------------------------------------------------------------
# IAM ROLE FOR ECS TASK EXECUTION
# This role is assumed by the ECS agent to perform actions on your behalf,
# such as pulling container images from ECR and writing logs to CloudWatch.
# It uses a managed policy provided by AWS.
# ---------------------------------------------------------------------------------------------------------------------

resource "aws_iam_role" "ecs_task_execution_role" {
  name               = "${var.project_name}-${var.qut_username}-ecs-execution-role"
  assume_role_policy = jsonencode({
    Version   = "2012-10-17",
    Statement = [
      {
        Action    = "sts:AssumeRole",
        Effect    = "Allow",
        Principal = {
          Service = "ecs-tasks.amazonaws.com"
        }
      }
    ]
  })
  tags = {
    qut-username = var.qut_username
    purpose      = "assessment"
  }
}

resource "aws_iam_role_policy_attachment" "ecs_task_execution_role_attachment" {
  role       = aws_iam_role.ecs_task_execution_role.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AmazonECSTaskExecutionRolePolicy"
}

# ---------------------------------------------------------------------------------------------------------------------
# IAM ROLE FOR ECS TASKS
# This role is assumed by the containers themselves, allowing your application code
# to interact with other AWS services (S3, SQS, DynamoDB, etc.).
# It follows the principle of least privilege.
# ---------------------------------------------------------------------------------------------------------------------

resource "aws_iam_role" "ecs_task_role" {
  name               = "${var.project_name}-${var.qut_username}-ecs-task-role"
  assume_role_policy = jsonencode({
    Version   = "2012-10-17",
    Statement = [
      {
        Action    = "sts:AssumeRole",
        Effect    = "Allow",
        Principal = {
          Service = "ecs-tasks.amazonaws.com"
        }
      }
    ]
  })
  tags = {
    qut-username = var.qut_username
    purpose      = "assessment"
  }
}

# This policy grants the necessary permissions for the application.
# You can further restrict the resources (e.g., specific S3 bucket ARNs) for tighter security.
resource "aws_iam_policy" "ecs_task_policy" {
  name        = "${var.project_name}-${var.qut_username}-ecs-task-policy"
  description = "Policy for ECS tasks to access S3, SQS, and DynamoDB"
  policy = jsonencode({
    Version   = "2012-10-17",
    Statement = [
      {
        Action = [
          "s3:GetObject",
          "s3:PutObject",
          "s3:DeleteObject",
          "s3:ListBucket"
        ],
        Effect   = "Allow",
        Resource = [
          aws_s3_bucket.uploads.arn,
          "${aws_s3_bucket.uploads.arn}/*"
        ]
      },
      {
        Action = [
          "sqs:SendMessage",
          "sqs:ReceiveMessage",
          "sqs:DeleteMessage",
          "sqs:GetQueueAttributes"
        ],
        Effect   = "Allow",
        Resource = "*" # Restrict to specific SQS queue ARNs in production
      },
      {
        Action = [
          "dynamodb:GetItem",
          "dynamodb:PutItem",
          "dynamodb:UpdateItem",
          "dynamodb:DeleteItem",
          "dynamodb:Query",
          "dynamodb:Scan"
        ],
        Effect   = "Allow",
        Resource = "*" # Restrict to specific DynamoDB table ARNs in production
      }
    ]
  })
}

resource "aws_iam_role_policy_attachment" "ecs_task_role_attachment" {
  role       = aws_iam_role.ecs_task_role.name
  policy_arn = aws_iam_policy.ecs_task_policy.arn
}


# ---------------------------------------------------------------------------------------------------------------------
# IAM ROLE FOR LAMBDA FUNCTION
# This role allows the Lambda function to write logs to CloudWatch and read S3 object metadata.
# ---------------------------------------------------------------------------------------------------------------------

resource "aws_iam_role" "lambda_role" {
  name = "${var.project_name}-${var.qut_username}-lambda-role"

  assume_role_policy = jsonencode({
    Version   = "2012-10-17"
    Statement = [
      {
        Action    = "sts:AssumeRole"
        Effect    = "Allow"
        Principal = {
          Service = "lambda.amazonaws.com"
        }
      }
    ]
  })
  tags = {
    qut-username = var.qut_username
    purpose      = "assessment"
  }
}

resource "aws_iam_policy" "lambda_policy" {
  name        = "${var.project_name}-${var.qut_username}-lambda-policy"
  description = "Policy for Lambda function to access CloudWatch and S3"
  policy = jsonencode({
    Version   = "2012-10-17"
    Statement = [
      {
        Action = [
          "logs:CreateLogGroup",
          "logs:CreateLogStream",
          "logs:PutLogEvents"
        ]
        Effect   = "Allow"
        Resource = "arn:aws:logs:*:*:*"
      },
      {
        Action = [
          "s3:GetObject",
          "s3:GetObjectTagging"
        ]
        Effect   = "Allow"
        Resource = "${aws_s3_bucket.uploads.arn}/*"
      }
    ]
  })
}

resource "aws_iam_role_policy_attachment" "lambda_policy_attachment" {
  role       = aws_iam_role.lambda_role.name
  policy_arn = aws_iam_policy.lambda_policy.arn
}
