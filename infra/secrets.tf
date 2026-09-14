# Secrets Manager

# Langfuse Keys
resource "aws_secretsmanager_secret" "langfuse_keys" {
  name                    = "${local.name_prefix}-langfuse-keys"
  description             = "Langfuse secret and public keys"
  recovery_window_in_days = 7

  tags = local.common_tags
}

resource "aws_secretsmanager_secret_version" "langfuse_keys" {
  secret_id = aws_secretsmanager_secret.langfuse_keys.id
  secret_string = jsonencode({
    secret_key = var.langfuse_secret_key
    public_key = var.langfuse_public_key
  })
}

# Database Credentials
resource "random_password" "db_password" {
  length  = 32
  special = false
}

resource "aws_secretsmanager_secret" "db_credentials" {
  name                    = "${local.name_prefix}-db-credentials"
  description             = "Database credentials for Langfuse"
  recovery_window_in_days = 7

  tags = local.common_tags
}

resource "aws_secretsmanager_secret_version" "db_credentials" {
  secret_id = aws_secretsmanager_secret.db_credentials.id
  secret_string = jsonencode({
    username = "dbadmin"
    password = random_password.db_password.result
  })
}

# Entra ID Configuration
resource "aws_secretsmanager_secret" "entra_id" {
  name                    = "${local.name_prefix}-entra-id-config"
  description             = "Microsoft Entra ID configuration"
  recovery_window_in_days = 7

  tags = local.common_tags
}

resource "aws_secretsmanager_secret_version" "entra_id" {
  secret_id = aws_secretsmanager_secret.entra_id.id
  secret_string = jsonencode({
    tenant_id      = var.entra_id_tenant_id
    application_id = var.entra_id_application_id
  })
}
