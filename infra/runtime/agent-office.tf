locals {
  office_name       = "multi-agent-agent-office"
  office_public_url = "https://aiops.cloudpiles.net"
  harnesses         = jsondecode(file("${path.module}/../../agentcore/deployed.json"))
}

data "aws_secretsmanager_secret" "langfuse_keys" { name = "multi-agent-langfuse-keys" }

resource "aws_dynamodb_table" "agent_office_events" {
  name         = "multi-agent-agent-office-events"
  billing_mode = "PAY_PER_REQUEST"
  hash_key     = "pk"
  range_key    = "sk"

  attribute {
    name = "pk"
    type = "S"
  }
  attribute {
    name = "sk"
    type = "S"
  }
  ttl {
    attribute_name = "expires_at"
    enabled        = true
  }
  point_in_time_recovery { enabled = true }
  server_side_encryption { enabled = true }
}

resource "aws_sqs_queue" "office_runs_dlq" {
  name                        = "${local.office_name}-runs-dlq.fifo"
  fifo_queue                  = true
  content_based_deduplication = false
  message_retention_seconds   = 1209600
}

resource "aws_sqs_queue" "office_runs" {
  name                        = "${local.office_name}-runs.fifo"
  fifo_queue                  = true
  content_based_deduplication = false
  visibility_timeout_seconds  = 2700
  message_retention_seconds   = 345600
  redrive_policy              = jsonencode({ deadLetterTargetArn = aws_sqs_queue.office_runs_dlq.arn, maxReceiveCount = 2 })
}

resource "aws_sqs_queue" "office_events_dlq" {
  name                      = "${local.office_name}-events-dlq"
  message_retention_seconds = 1209600
}

resource "aws_sqs_queue" "office_events" {
  name                       = "${local.office_name}-events"
  visibility_timeout_seconds = 120
  message_retention_seconds  = 345600
  redrive_policy             = jsonencode({ deadLetterTargetArn = aws_sqs_queue.office_events_dlq.arn, maxReceiveCount = 3 })
}

resource "aws_cloudwatch_event_rule" "office_events" {
  name        = "${local.office_name}-events"
  description = "Delivers actual ECS and CI/CD state changes to Agent Office"
  event_pattern = jsonencode({
    source = ["aws.ecs", "cloudpiles.cicd"]
  })
}

resource "aws_cloudwatch_event_target" "office_events" {
  rule = aws_cloudwatch_event_rule.office_events.name
  arn  = aws_sqs_queue.office_events.arn
}

resource "aws_sqs_queue_policy" "office_events" {
  queue_url = aws_sqs_queue.office_events.id
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect    = "Allow"
      Principal = { Service = "events.amazonaws.com" }
      Action    = "sqs:SendMessage"
      Resource  = aws_sqs_queue.office_events.arn
      Condition = { ArnEquals = { "aws:SourceArn" = aws_cloudwatch_event_rule.office_events.arn } }
    }]
  })
}

resource "random_password" "office_auth_signing_key" {
  length  = 64
  special = false
}

resource "aws_secretsmanager_secret" "office_runtime" {
  name                    = "multi-agent-agent-office-runtime"
  description             = "Runtime-only signing key for Agent Office"
  recovery_window_in_days = 7
}

resource "aws_secretsmanager_secret_version" "office_runtime" {
  secret_id     = aws_secretsmanager_secret.office_runtime.id
  secret_string = jsonencode({ auth_signing_key = random_password.office_auth_signing_key.result })
}

resource "aws_iam_role" "office_task" {
  name = "multi-agent-agent-office-task-role"
  assume_role_policy = jsonencode({
    Version   = "2012-10-17"
    Statement = [{ Effect = "Allow", Principal = { Service = "ecs-tasks.amazonaws.com" }, Action = "sts:AssumeRole" }]
  })
}

resource "aws_iam_role_policy" "office_task" {
  name = "multi-agent-agent-office-task-policy"
  role = aws_iam_role.office_task.id
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      { Effect = "Allow", Action = ["dynamodb:GetItem", "dynamodb:PutItem", "dynamodb:UpdateItem", "dynamodb:Query"], Resource = aws_dynamodb_table.agent_office_events.arn },
      { Effect = "Allow", Action = ["sqs:SendMessage", "sqs:ReceiveMessage", "sqs:DeleteMessage", "sqs:ChangeMessageVisibility", "sqs:GetQueueAttributes"], Resource = [aws_sqs_queue.office_runs.arn, aws_sqs_queue.office_events.arn] },
      { Effect = "Allow", Action = ["secretsmanager:GetSecretValue"], Resource = data.aws_secretsmanager_secret.langfuse_keys.arn },
      { Effect = "Allow", Action = ["ecs:DescribeServices"], Resource = "*" },
      { Effect = "Allow", Action = ["bedrock-agentcore:InvokeHarness", "bedrock-agentcore:InvokeAgentRuntime", "bedrock-agentcore:GetHarness", "bedrock-agentcore:GetAgentRuntime"], Resource = concat([for deployment in values(local.harnesses) : deployment.arn], ["arn:aws:bedrock-agentcore:us-east-1:278741241787:runtime/*"]) }
    ]
  })
}

resource "aws_iam_role_policy" "office_execution_secret" {
  name = "multi-agent-agent-office-runtime-secret"
  role = "multi-agent-ecs-task-execution-role"
  policy = jsonencode({
    Version   = "2012-10-17"
    Statement = [{ Effect = "Allow", Action = ["secretsmanager:GetSecretValue"], Resource = aws_secretsmanager_secret.office_runtime.arn }]
  })
}

resource "aws_lb_target_group" "office" {
  name        = "multi-agent-agent-office"
  port        = 8080
  protocol    = "HTTP"
  target_type = "ip"
  vpc_id      = "vpc-06a015e90038514b5"
  health_check {
    path                = "/healthz"
    matcher             = "200"
    healthy_threshold   = 2
    unhealthy_threshold = 3
    interval            = 30
    timeout             = 5
  }
}

resource "aws_lb_listener_rule" "office" {
  listener_arn = "arn:aws:elasticloadbalancing:us-east-1:278741241787:listener/app/multi-agent-platform-alb/c0f7525c5f206dcb/e3c5966f298fb374"
  priority     = 5
  action {
    type             = "forward"
    target_group_arn = aws_lb_target_group.office.arn
  }
  condition {
    host_header {
      values = ["aiops.cloudpiles.net"]
    }
  }
}

variable "agent_office_image" {
  type    = string
  default = "278741241787.dkr.ecr.us-east-1.amazonaws.com/multi-agent-agent-office:2026-09-14-agent-office-workspace-r3"
}

resource "aws_ecs_task_definition" "office" {
  family                   = local.office_name
  network_mode             = "awsvpc"
  requires_compatibilities = ["FARGATE"]
  cpu                      = "1024"
  memory                   = "2048"
  execution_role_arn       = local.execution_role
  task_role_arn            = aws_iam_role.office_task.arn
  runtime_platform {
    cpu_architecture        = "X86_64"
    operating_system_family = "LINUX"
  }
  container_definitions = jsonencode([{
    name         = "agent-office"
    image        = var.agent_office_image
    essential    = true
    portMappings = [{ containerPort = 8080, protocol = "tcp" }]
    environment = [
      { name = "PORT", value = "8080" },
      { name = "PUBLIC_URL", value = local.office_public_url },
      { name = "EVENT_TABLE", value = aws_dynamodb_table.agent_office_events.name },
      { name = "RUN_QUEUE_URL", value = aws_sqs_queue.office_runs.url },
      { name = "EVENT_QUEUE_URL", value = aws_sqs_queue.office_events.url }
    ]
    secrets          = [{ name = "AUTH_SIGNING_KEY", valueFrom = "${aws_secretsmanager_secret.office_runtime.arn}:auth_signing_key::" }]
    logConfiguration = { logDriver = "awslogs", options = { awslogs-group = local.logs, awslogs-region = "us-east-1", awslogs-stream-prefix = "agent-office" } }
    healthCheck      = { command = ["CMD", "/nodejs/bin/node", "-e", "fetch('http://127.0.0.1:8080/healthz').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"], interval = 30, timeout = 5, retries = 3, startPeriod = 60 }
    stopTimeout      = 60
  }])
  depends_on = [aws_secretsmanager_secret_version.office_runtime, aws_iam_role_policy.office_execution_secret]
}

resource "aws_ecs_service" "office" {
  name                               = local.office_name
  cluster                            = local.cluster
  task_definition                    = aws_ecs_task_definition.office.arn
  desired_count                      = 1
  launch_type                        = "FARGATE"
  platform_version                   = "1.4.0"
  health_check_grace_period_seconds  = 120
  deployment_minimum_healthy_percent = 100
  deployment_maximum_percent         = 200
  enable_execute_command             = true
  deployment_circuit_breaker {
    enable   = true
    rollback = true
  }
  network_configuration {
    subnets          = local.private_subnets
    security_groups  = [local.ecs_sg]
    assign_public_ip = false
  }
  load_balancer {
    target_group_arn = aws_lb_target_group.office.arn
    container_name   = "agent-office"
    container_port   = 8080
  }
  depends_on = [aws_lb_listener_rule.office]
}
