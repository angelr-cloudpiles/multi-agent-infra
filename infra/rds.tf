# RDS PostgreSQL for Langfuse

# DB Subnet Group
resource "aws_db_subnet_group" "main" {
  name       = "${local.name_prefix}-db-subnet-group"
  subnet_ids = aws_subnet.database[*].id

  tags = local.common_tags
}

# Langfuse Database
resource "aws_db_instance" "langfuse" {
  identifier                = "${local.name_prefix}-langfuse-db"
  engine                    = "postgres"
  engine_version            = "15.7"
  instance_class            = "db.t3.micro"
  allocated_storage         = 20
  storage_encrypted         = true
  kms_key_id                = aws_kms_key.rds.arn
  db_name                   = "langfuse"
  username                  = "dbadmin"
  password                  = random_password.db_password.result
  db_subnet_group_name      = aws_db_subnet_group.main.name
  vpc_security_group_ids    = [aws_security_group.rds.id]
  parameter_group_name      = "default.postgres15"
  skip_final_snapshot       = false
  final_snapshot_identifier = "${local.name_prefix}-langfuse-final-snapshot"
  backup_retention_period   = 7
  multi_az                  = false
  publicly_accessible       = false

  tags = local.common_tags
}

# KMS Key for RDS Encryption
resource "aws_kms_key" "rds" {
  description             = "KMS key for RDS encryption"
  deletion_window_in_days = 7
  enable_key_rotation     = true

  tags = merge(local.common_tags, {
    Name = "${local.name_prefix}-rds-kms-key"
  })
}

resource "aws_kms_alias" "rds" {
  name          = "alias/${local.name_prefix}-rds"
  target_key_id = aws_kms_key.rds.key_id
}
