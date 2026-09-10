# Outputs

output "vpc_id" {
  description = "ID of the VPC"
  value       = aws_vpc.main.id
}

output "vpc_cidr_block" {
  description = "CIDR block of the VPC"
  value       = aws_vpc.main.cidr_block
}

output "public_subnet_ids" {
  description = "IDs of public subnets"
  value       = aws_subnet.public[*].id
}

output "private_subnet_ids" {
  description = "IDs of private subnets"
  value       = aws_subnet.private[*].id
}

output "database_subnet_ids" {
  description = "IDs of database subnets"
  value       = aws_subnet.database[*].id
}

output "skills_bucket_name" {
  description = "Name of the S3 bucket for skills"
  value       = aws_s3_bucket.skills.bucket
}

output "skills_bucket_arn" {
  description = "ARN of the S3 bucket for skills"
  value       = aws_s3_bucket.skills.arn
}

output "litellm_db_endpoint" {
  description = "Endpoint for LiteLLM database"
  value       = aws_db_instance.litellm.endpoint
}

output "langfuse_db_endpoint" {
  description = "Endpoint for Langfuse database"
  value       = aws_db_instance.langfuse.endpoint
}

output "redis_endpoint" {
  description = "Endpoint for Redis cluster"
  value       = aws_elasticache_cluster.litellm.cache_nodes[0].address
}

output "agentcore_execution_role_arn" {
  description = "ARN of the AgentCore execution role"
  value       = aws_iam_role.agentcore_execution.arn
}

output "ecs_security_group_id" {
  description = "ID of the ECS security group"
  value       = aws_security_group.ecs.id
}

output "alb_security_group_id" {
  description = "ID of the ALB security group"
  value       = aws_security_group.alb.id
}

output "budget_name" {
  description = "Name of the main budget"
  value       = aws_budgets_budget.main.name
}

output "sns_topic_arn" {
  description = "ARN of the SNS topic for alerts"
  value       = aws_sns_topic.budget_alerts.arn
}

output "litellm_api_key_secret_arn" {
  description = "ARN of the LiteLLM API key secret"
  value       = aws_secretsmanager_secret.litellm_api_key.arn
}

output "langfuse_keys_secret_arn" {
  description = "ARN of the Langfuse keys secret"
  value       = aws_secretsmanager_secret.langfuse_keys.arn
}

output "entra_id_config_secret_arn" {
  description = "ARN of the Entra ID configuration secret"
  value       = aws_secretsmanager_secret.entra_id.arn
}
