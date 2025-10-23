# ---------------------------------------------------------------------------------------------------------------------
# IAM ROLE FOR ECS TASK EXECUTION
# This role is assumed by the ECS agent to perform actions on your behalf.
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
# This role is assumed by the containers themselves.
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

# Policy for ECS tasks to access AWS services
resource "aws_iam_policy" "ecs_task_policy" {
  name        = "${var.project_name}-${var.qut_username}-ecs-task-policy"
  description = "Policy for ECS tasks to access S3, SQS, DynamoDB, and Cognito"
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
          "arn:aws:s3:::${var.existing_s3_bucket}",
          "arn:aws:s3:::${var.existing_s3_bucket}/*"
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
        Resource = [
          aws_sqs_queue.transcoding_queue.arn,
          aws_sqs_queue.transcoding_dlq.arn,
          aws_sqs_queue.upload_queue.arn,
          aws_sqs_queue.storage_queue.arn,
          aws_sqs_queue.notifications_queue.arn
        ]
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
        Resource = "arn:aws:dynamodb:${var.region}:*:table/${var.existing_dynamodb_table}"
      },
      {
        Action = [
          "cognito-idp:AdminGetUser",
          "cognito-idp:AdminCreateUser",
          "cognito-idp:AdminUpdateUserAttributes",
          "cognito-idp:AdminDeleteUser",
          "cognito-idp:ListUsers"
        ],
        Effect   = "Allow",
        Resource = "arn:aws:cognito-idp:${var.region}:*:userpool/${var.existing_cognito_user_pool_id}"
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
        Resource = "arn:aws:s3:::${var.existing_s3_bucket}/*"
      }
    ]
  })
}

resource "aws_iam_role_policy_attachment" "lambda_policy_attachment" {
  role       = aws_iam_role.lambda_role.name
  policy_arn = aws_iam_policy.lambda_policy.arn
}