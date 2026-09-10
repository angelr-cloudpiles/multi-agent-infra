#!/bin/bash

# Generate secrets for Terraform
# Run this before deploying infrastructure

set -e

echo "🔐 Generating secrets for Multi-Agent Infrastructure..."

# Generate LiteLLM master key
LITELLM_KEY=$(openssl rand -hex 32)
echo "✅ LiteLLM Master Key: $LITELLM_KEY"

# Generate Langfuse keys
LANGFUSE_SECRET=$(openssl rand -hex 32)
LANGFUSE_PUBLIC=$(openssl rand -hex 32)
echo "✅ Langfuse Secret Key: $LANGFUSE_SECRET"
echo "✅ Langfuse Public Key: $LANGFUSE_PUBLIC"

# Create terraform.tfvars
cat > terraform.tfvars <<EOF
aws_region = "us-east-1"
environment = "production"
budget_limit = 1000
notification_email = "aiops@cloudpiles.com"
entra_id_tenant_id = "0d7c9ad4-6df4-4c9c-a088-f296098ad992"
entra_id_application_id = "1d92561c-b198-48eb-9c8c-410fda3c969d"
domain_name = "aiops.cloudpiles.net"
litellm_master_key = "$LITELLM_KEY"
langfuse_secret_key = "$LANGFUSE_SECRET"
langfuse_public_key = "$LANGFUSE_PUBLIC"
EOF

echo ""
echo "✅ terraform.tfvars created successfully!"
echo ""
echo "⚠️  IMPORTANT: Save these keys securely:"
echo "   LiteLLM Master Key: $LITELLM_KEY"
echo "   Langfuse Secret Key: $LANGFUSE_SECRET"
echo "   Langfuse Public Key: $LANGFUSE_PUBLIC"
echo ""
echo "📝 Next steps:"
echo "   1. Review terraform.tfvars"
echo "   2. Run: terraform init"
echo "   3. Run: terraform plan"
echo "   4. Run: terraform apply"
