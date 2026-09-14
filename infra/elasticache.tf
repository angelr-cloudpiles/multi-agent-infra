# ElastiCache Redis for Langfuse queues and cache

# Redis Subnet Group
resource "aws_elasticache_subnet_group" "main" {
  name       = "${local.name_prefix}-redis-subnet-group"
  subnet_ids = aws_subnet.private[*].id

  tags = local.common_tags
}

resource "aws_elasticache_parameter_group" "langfuse" {
  name   = "${local.name_prefix}-redis7"
  family = "redis7"

  parameter {
    name  = "maxmemory-policy"
    value = "noeviction"
  }

  tags = local.common_tags
}

# Redis Cluster
resource "aws_elasticache_cluster" "langfuse" {
  cluster_id           = "${local.name_prefix}-redis"
  engine               = "redis"
  node_type            = "cache.t3.micro"
  num_cache_nodes      = 1
  parameter_group_name = aws_elasticache_parameter_group.langfuse.name
  engine_version       = "7.0"
  port                 = 6379
  subnet_group_name    = aws_elasticache_subnet_group.main.name
  security_group_ids   = [aws_security_group.elasticache.id]

  tags = local.common_tags
}

moved {
  from = aws_elasticache_parameter_group.litellm
  to   = aws_elasticache_parameter_group.langfuse
}

moved {
  from = aws_elasticache_cluster.litellm
  to   = aws_elasticache_cluster.langfuse
}
