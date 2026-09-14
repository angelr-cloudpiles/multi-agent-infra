resource "aws_kms_key" "agentcore_memory" {
  description             = "Encryption key for AgentCore long-term project memory"
  deletion_window_in_days = 30
  enable_key_rotation     = true

  tags = {
    Name      = "multi-agent-agentcore-memory"
    DataClass = "project-context"
  }
}

resource "aws_kms_alias" "agentcore_memory" {
  name          = "alias/multi-agent-agentcore-memory"
  target_key_id = aws_kms_key.agentcore_memory.key_id
}
