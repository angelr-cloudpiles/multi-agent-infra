terraform {
  required_version = ">= 1.15.0"
  required_providers {
    aws    = { source = "hashicorp/aws", version = "~> 5.0" }
    random = { source = "hashicorp/random", version = "~> 3.0" }
  }
  backend "s3" {
    bucket         = "multi-agent-terraform-state-278741241787"
    key            = "multi-agent-runtime/terraform.tfstate"
    region         = "us-east-1"
    encrypt        = true
    dynamodb_table = "multi-agent-terraform-locks"
  }
}
provider "aws" {
  region              = "us-east-1"
  allowed_account_ids = ["278741241787"]
  default_tags {
    tags = { Project = "multi-agent-team", Environment = "production", ManagedBy = "terraform" }
  }
}
locals {
  cluster         = "arn:aws:ecs:us-east-1:278741241787:cluster/multi-agent-platform"
  execution_role  = "arn:aws:iam::278741241787:role/multi-agent-ecs-task-execution-role"
  private_subnets = ["subnet-0aa9a8feadd153fa0", "subnet-08d4044dd3f658cee"]
  ecs_sg          = "sg-0718112f192257456"
  traces_bucket   = "multi-agent-langfuse-traces-20260913111629427300000006"
  logs            = "/aws/ecs/multi-agent-platform"
}
data "aws_secretsmanager_secret" "runtime" {
  for_each = toset(["langfuse-runtime", "langfuse-keys", "clickhouse-runtime"])
  name     = "multi-agent-${each.key}"
}

data "aws_secretsmanager_secret" "langfuse_admin_initial" {
  name = "multi-agent-langfuse-admin-initial"
}

variable "langfuse_initial_project_id" {
  description = "Project selected for one-time Langfuse headless initialization. Existing projects are never removed."
  type        = string
  default     = "multi-agent"

  validation {
    condition     = contains(["multi-agent", "tattoo-studio"], var.langfuse_initial_project_id)
    error_message = "The Langfuse initialization project must be a managed project."
  }
}

resource "random_password" "langfuse_tattoo_studio_public_key" {
  length  = 40
  special = false
}

resource "random_password" "langfuse_tattoo_studio_secret_key" {
  length  = 48
  special = false
}

resource "aws_secretsmanager_secret" "langfuse_tattoo_studio_keys" {
  name                    = "multi-agent-langfuse-tattoo-studio-keys"
  description             = "Dedicated Langfuse ingestion credentials for Tattoo Studio"
  recovery_window_in_days = 7
}

resource "aws_secretsmanager_secret_version" "langfuse_tattoo_studio_keys" {
  secret_id = aws_secretsmanager_secret.langfuse_tattoo_studio_keys.id
  secret_string = jsonencode({
    public_key = "pk-lf-${random_password.langfuse_tattoo_studio_public_key.result}"
    secret_key = "sk-lf-${random_password.langfuse_tattoo_studio_secret_key.result}"
  })
}
data "aws_kms_alias" "s3" { name = "alias/multi-agent-s3" }
resource "aws_iam_role_policy" "langfuse_secrets" {
  name   = "multi-agent-langfuse-runtime-secrets"
  role   = "multi-agent-ecs-task-execution-role"
  policy = jsonencode({ Version = "2012-10-17", Statement = [{ Effect = "Allow", Action = ["secretsmanager:GetSecretValue"], Resource = concat([for secret in data.aws_secretsmanager_secret.runtime : secret.arn], [data.aws_secretsmanager_secret.langfuse_admin_initial.arn, aws_secretsmanager_secret.langfuse_tattoo_studio_keys.arn]) }] })
}
resource "aws_iam_role_policy" "langfuse_kms" {
  name   = "multi-agent-langfuse-s3-kms"
  role   = "multi-agent-langfuse-task-role"
  policy = jsonencode({ Version = "2012-10-17", Statement = [{ Effect = "Allow", Action = ["kms:Decrypt", "kms:GenerateDataKey"], Resource = data.aws_kms_alias.s3.target_key_arn, Condition = { StringEquals = { "kms:ViaService" = "s3.us-east-1.amazonaws.com" } } }] })
}
variable "langfuse_image" {
  type    = string
  default = "278741241787.dkr.ecr.us-east-1.amazonaws.com/multi-agent-langfuse@sha256:5aa769febf42c6ebe3de0c251a78a4b5823eff41294b49e09e4532a2abcc3a49"
}
variable "langfuse_worker_image" {
  type    = string
  default = "278741241787.dkr.ecr.us-east-1.amazonaws.com/multi-agent-langfuse@sha256:c2ecb2836a6e1e871bb61c9657b215565a6c308f41d41417f4680a3bf4218738"
}
locals {
  langfuse_initial_projects = {
    "multi-agent" = {
      id              = "multi-agent"
      name            = "Gaudi"
      keys_secret_arn = data.aws_secretsmanager_secret.runtime["langfuse-keys"].arn
    }
    "tattoo-studio" = {
      id              = "tattoo-studio"
      name            = "Fede Rod Tattoo Studio"
      keys_secret_arn = aws_secretsmanager_secret.langfuse_tattoo_studio_keys.arn
    }
  }
  langfuse_initial_project = local.langfuse_initial_projects[var.langfuse_initial_project_id]
  langfuse_env = {
    HOSTNAME                         = "0.0.0.0"
    NEXTAUTH_URL                     = "https://langfuse.aiops.cloudpiles.net"
    CLICKHOUSE_URL                   = "http://clickhouse.internal.aiops:8123"
    CLICKHOUSE_MIGRATION_URL         = "clickhouse://clickhouse.internal.aiops:9000"
    CLICKHOUSE_USER                  = "langfuse"
    CLICKHOUSE_DB                    = "default"
    CLICKHOUSE_CLUSTER_ENABLED       = "false"
    REDIS_HOST                       = "multi-agent-redis.6mdm9j.0001.use1.cache.amazonaws.com"
    REDIS_PORT                       = "6379"
    REDIS_TLS_ENABLED                = "false"
    TELEMETRY_ENABLED                = "false"
    AUTH_DISABLE_SIGNUP              = "true"
    LANGFUSE_S3_EVENT_UPLOAD_BUCKET  = local.traces_bucket
    LANGFUSE_S3_EVENT_UPLOAD_REGION  = "us-east-1"
    LANGFUSE_S3_EVENT_UPLOAD_PREFIX  = "events/"
    LANGFUSE_S3_MEDIA_UPLOAD_BUCKET  = local.traces_bucket
    LANGFUSE_S3_MEDIA_UPLOAD_REGION  = "us-east-1"
    LANGFUSE_S3_MEDIA_UPLOAD_PREFIX  = "media/"
    LANGFUSE_S3_BATCH_EXPORT_ENABLED = "true"
    LANGFUSE_S3_BATCH_EXPORT_BUCKET  = local.traces_bucket
    LANGFUSE_S3_BATCH_EXPORT_REGION  = "us-east-1"
    LANGFUSE_S3_BATCH_EXPORT_PREFIX  = "exports/"
    # Agent Office uses v4 OTEL ingestion. Keep dual mode during the staged
    # rollout so the existing database remains a rollback point; historic
    # backfill stays off until representative non-production traces are
    # validated by the project owner.
    LANGFUSE_MIGRATION_V4_WRITE_MODE                          = "dual"
    LANGFUSE_MIGRATION_V4_NATIVE_OTEL_BEHAVIOUR               = "dual_write"
    LANGFUSE_MIGRATION_V4_ALLOW_PREVIEW_OPT_IN                = "true"
    LANGFUSE_BACKGROUND_MIGRATION_V4_ENABLE_HISTORIC_BACKFILL = "false"
  }
  langfuse_secrets = concat([for key, value in { DATABASE_URL = "database_url", NEXTAUTH_SECRET = "nextauth_secret", SALT = "salt", ENCRYPTION_KEY = "encryption_key" } : {
    name = key, valueFrom = "${data.aws_secretsmanager_secret.runtime["langfuse-runtime"].arn}:${value}::"
  }], [{ name = "CLICKHOUSE_PASSWORD", valueFrom = "${data.aws_secretsmanager_secret.runtime["clickhouse-runtime"].arn}:password::" }])
}
resource "aws_ecs_task_definition" "langfuse" {
  for_each                 = { web = { name = "langfuse", port = 3000, image = var.langfuse_image }, worker = { name = "langfuse-worker", port = 3030, image = var.langfuse_worker_image } }
  family                   = "multi-agent-${each.value.name}"
  network_mode             = "awsvpc"
  requires_compatibilities = ["FARGATE"]
  cpu                      = "1024"
  memory                   = "2048"
  execution_role_arn       = local.execution_role
  task_role_arn            = "arn:aws:iam::278741241787:role/multi-agent-langfuse-task-role"
  runtime_platform {
    cpu_architecture        = "X86_64"
    operating_system_family = "LINUX"
  }
  container_definitions = jsonencode([{
    name         = each.value.name, image = each.value.image, essential = true
    portMappings = [{ containerPort = each.value.port, protocol = "tcp" }]
    environment = [for key, value in merge(local.langfuse_env, each.key == "web" ? {
      LANGFUSE_INIT_ORG_ID = "cloudpiles", LANGFUSE_INIT_ORG_NAME = "Cloudpiles", LANGFUSE_INIT_PROJECT_ID = local.langfuse_initial_project.id, LANGFUSE_INIT_PROJECT_NAME = local.langfuse_initial_project.name, LANGFUSE_INIT_USER_EMAIL = "angelr@cloudpiles.com", LANGFUSE_INIT_USER_NAME = "Angel Reale"
    } : {}) : { name = key, value = value }]
    secrets          = concat(local.langfuse_secrets, each.key == "web" ? concat([for key, value in { LANGFUSE_INIT_PROJECT_PUBLIC_KEY = "public_key", LANGFUSE_INIT_PROJECT_SECRET_KEY = "secret_key" } : { name = key, valueFrom = "${local.langfuse_initial_project.keys_secret_arn}:${value}::" }], [{ name = "LANGFUSE_INIT_USER_PASSWORD", valueFrom = "${data.aws_secretsmanager_secret.langfuse_admin_initial.arn}:password::" }]) : [])
    logConfiguration = { logDriver = "awslogs", options = { awslogs-group = local.logs, awslogs-region = "us-east-1", awslogs-stream-prefix = each.value.name } }
    healthCheck      = { command = ["CMD-SHELL", "node -e \"fetch('http://127.0.0.1:${each.value.port}/${each.key == "web" ? "api/public/health" : "api/health"}').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))\""], interval = 30, timeout = 5, retries = 3, startPeriod = 120 }
    stopTimeout      = 60
  }])
  depends_on = [aws_iam_role_policy.langfuse_secrets, aws_iam_role_policy.langfuse_kms]
}
resource "aws_ecs_service" "langfuse" {
  for_each                           = { web = "langfuse", worker = "langfuse-worker" }
  name                               = "multi-agent-${each.value}"
  cluster                            = local.cluster
  task_definition                    = aws_ecs_task_definition.langfuse[each.key].arn
  desired_count                      = 1
  launch_type                        = "FARGATE"
  platform_version                   = "1.4.0"
  deployment_minimum_healthy_percent = 100
  deployment_maximum_percent         = 200
  health_check_grace_period_seconds  = each.key == "web" ? 300 : null
  deployment_circuit_breaker {
    enable   = true
    rollback = true
  }
  network_configuration {
    subnets          = local.private_subnets
    security_groups  = [local.ecs_sg]
    assign_public_ip = false
  }
  dynamic "load_balancer" {
    for_each = each.key == "web" ? [1] : []
    content {
      target_group_arn = "arn:aws:elasticloadbalancing:us-east-1:278741241787:targetgroup/multi-agent-langfuse/32501a85ce48b530"
      container_name   = "langfuse"
      container_port   = 3000
    }
  }
}

locals { clickhouse_secret_arn = data.aws_secretsmanager_secret.runtime["clickhouse-runtime"].arn }
