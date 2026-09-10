# ElastiCache Redis for LiteLLM

# Redis Subnet Group
resource "aws_elasticache_subnet_group" "main" {
  name       = "${local.name_prefix}-redis-subnet-group"
  subnet_ids = aws_subnet.private[*].id

  tags = local.common_tags
}

# Redis Cluster
resource "aws_elasticache_cluster" "litellm" {
  cluster_id           = "${local.name_prefix}-redis"
  engine                = "redis"
  node_type            = "cache.t3.micro"
  num_cache_nodes      = 1
  parameter_group_name = "default.redis7"
  engine_version       = "7.0"
  port                 = 6379
  subnet_group_name    = aws_elasticache_subnet_group.main.name
  security_group_ids  = [aws_security_group.elasticache.id]

  tags = local.common_tags
}
