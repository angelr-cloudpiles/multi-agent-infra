# IAM Roles and Policies

# AgentCore Execution Role
resource "aws_iam_role" "agentcore_execution" {
  name = "${local.name_prefix}-agentcore-execution-role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect = "Allow"
      Principal = {
        Service = "bedrock-agentcore.amazonaws.com"
      }
      Action = "sts:AssumeRole"
      Condition = {
        StringEquals = {
          "aws:SourceAccount" = "278741241787"
        }
        ArnLike = {
          # AgentCore creates an internal runtime while provisioning a Harness.
          # The account and regional scope remain constrained to this platform.
          "aws:SourceArn" = "arn:aws:bedrock-agentcore:us-east-1:278741241787:*"
        }
      }
    }]
  })

  tags = local.common_tags
}

resource "aws_iam_role_policy" "agentcore_execution" {
  name = "${local.name_prefix}-agentcore-execution-policy"
  role = aws_iam_role.agentcore_execution.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "bedrock:InvokeModel",
          "bedrock:InvokeModelWithResponseStream"
        ]
        Resource = [
          "arn:aws:bedrock:us-east-1::foundation-model/us.anthropic.claude-sonnet-4-6",
          "arn:aws:bedrock:us-east-1::foundation-model/us.anthropic.claude-haiku-4-5",
          "arn:aws:bedrock:us-east-1::foundation-model/us.amazon.nova-micro-v1"
        ]
      },
      {
        Effect    = "Allow"
        Action    = ["kms:Decrypt"]
        Resource  = aws_kms_key.s3.arn
        Condition = { StringEquals = { "kms:ViaService" = "s3.us-east-1.amazonaws.com" } }
      },
      {
        Effect = "Allow"
        Action = [
          "bedrock-agentcore:InvokeAgentRuntime",
          "bedrock-agentcore:GetMemory",
          "bedrock-agentcore:CreateMemory"
        ]
        Resource = "*"
      },
      {
        Effect = "Allow"
        Action = [
          "s3:GetObject",
          "s3:ListBucket"
        ]
        Resource = [
          aws_s3_bucket.skills.arn,
          "${aws_s3_bucket.skills.arn}/*",
          "${aws_s3_bucket.artifacts.arn}/agent-office/*"
        ]
      },
      {
        Effect = "Allow"
        Action = [
          "logs:CreateLogGroup",
          "logs:CreateLogStream",
          "logs:PutLogEvents"
        ]
        Resource = "*"
      }
    ]
  })
}

# ECS Task Execution Role for Langfuse and Agent Office
resource "aws_iam_role" "ecs_task_execution" {
  name = "${local.name_prefix}-ecs-task-execution-role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect = "Allow"
      Principal = {
        Service = "ecs-tasks.amazonaws.com"
      }
      Action = "sts:AssumeRole"
    }]
  })

  tags = local.common_tags
}

resource "aws_iam_role_policy_attachment" "ecs_task_execution" {
  role       = aws_iam_role.ecs_task_execution.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AmazonECSTaskExecutionRolePolicy"
}

# ECS Task Role (for Langfuse)
resource "aws_iam_role" "langfuse_task" {
  name = "${local.name_prefix}-langfuse-task-role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect = "Allow"
      Principal = {
        Service = "ecs-tasks.amazonaws.com"
      }
      Action = "sts:AssumeRole"
    }]
  })

  tags = local.common_tags
}

resource "aws_iam_role_policy" "langfuse_task" {
  name = "${local.name_prefix}-langfuse-task-policy"
  role = aws_iam_role.langfuse_task.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        # Self-hosted Langfuse evaluators use the ECS task role through its
        # Bedrock default credential chain. This is limited to the one judge
        # inference profile and its backing foundation model.
        Effect = "Allow"
        Action = ["bedrock:InvokeModel", "bedrock:InvokeModelWithResponseStream"]
        Resource = [
          "arn:aws:bedrock:${var.aws_region}:278741241787:inference-profile/us.anthropic.claude-haiku-4-5-20251001-v1:0",
          "arn:aws:bedrock:*::foundation-model/anthropic.claude-haiku-4-5-20251001-v1:0"
        ]
      },
      {
        Effect = "Allow"
        Action = [
          "s3:GetObject",
          "s3:PutObject",
          "s3:ListBucket"
        ]
        Resource = [
          aws_s3_bucket.langfuse_traces.arn,
          "${aws_s3_bucket.langfuse_traces.arn}/*"
        ]
      },
      {
        Effect = "Allow"
        Action = [
          "secretsmanager:GetSecretValue"
        ]
        Resource = [
          aws_secretsmanager_secret.langfuse_keys.arn
        ]
      },
      {
        Effect = "Allow"
        Action = [
          "logs:CreateLogGroup",
          "logs:CreateLogStream",
          "logs:PutLogEvents"
        ]
        Resource = "*"
      }
    ]
  })
}
