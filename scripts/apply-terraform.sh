#!/bin/bash
# Apply Terraform plan
# This script applies the Terraform plan to deploy the infrastructure

set -e

INFRA_DIR="/Users/angelreale/MLOps/Personales/Gaudi/multi-agent-infra/infra"

echo "=========================================="
echo "Applying Terraform Plan"
echo "=========================================="
echo ""
echo "This will deploy 78 AWS resources:"
echo "- VPC with 6 subnets"
echo "- Security Groups"
echo "- IAM Roles"
echo "- S3 Buckets"
echo "- RDS PostgreSQL (2 instances)"
echo "- ElastiCache Redis"
echo "- AWS Budgets"
echo "- Secrets Manager"
echo ""
echo "Estimated time: 15-20 minutes"
echo ""

cd "$INFRA_DIR"

# Apply the plan
terraform apply tfplan

echo ""
echo "=========================================="
echo "Infrastructure deployed successfully!"
echo "=========================================="
echo ""
echo "Next steps:"
echo "1. Run: terraform output to see all outputs"
echo "2. Continue with Route53 + ACM setup"
echo "3. Deploy ECS Services"
