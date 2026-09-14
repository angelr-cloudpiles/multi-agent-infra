#!/bin/bash

# Generate secrets for Terraform
# Run this before deploying infrastructure

set -e

echo "🔐 Generating Langfuse secrets for Multi-Agent Infrastructure..."
umask 077

# Generate Langfuse keys
LANGFUSE_SECRET=$(openssl rand -hex 32)
LANGFUSE_PUBLIC=$(openssl rand -hex 32)

# Create terraform.tfvars
cat > terraform.tfvars <<EOF
aws_region = "us-east-1"
environment = "production"
budget_limit = 1000
notification_email = "aiops@cloudpiles.com"
entra_id_tenant_id = "0d7c9ad4-6df4-4c9c-a088-f296098ad992"
entra_id_application_id = "1d92561c-b198-48eb-9c8c-410fda3c969d"
domain_name = "aiops.cloudpiles.net"
langfuse_secret_key = "$LANGFUSE_SECRET"
langfuse_public_key = "$LANGFUSE_PUBLIC"
EOF

echo ""
echo "✅ terraform.tfvars created successfully!"
echo ""
echo "🔒 Secrets were written with owner-only permissions. Store them in AWS Secrets Manager before deployment."
echo ""
echo "📝 Next steps:"
echo "   1. Review terraform.tfvars"
echo "   2. Run: terraform init"
echo "   3. Run: terraform plan"
echo "   4. Run: terraform apply"
