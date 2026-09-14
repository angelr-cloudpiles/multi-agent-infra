#!/bin/bash
# Complete deployment script
# This script applies Terraform and continues with next steps

set -e

PROJECT_DIR="/Users/angelreale/MLOps/Personales/Gaudi/multi-agent-infra"
INFRA_DIR="$PROJECT_DIR/infra"

echo "=========================================="
echo "Multi-Agent Infrastructure Deployment"
echo "=========================================="
echo ""
echo "Phase 1: Applying Terraform Infrastructure"
echo "=========================================="
echo ""

cd "$INFRA_DIR"

# Apply Terraform
terraform apply tfplan

echo ""
echo "=========================================="
echo "Phase 1 Complete: Infrastructure Deployed"
echo "=========================================="
echo ""

# Get outputs
echo "Getting infrastructure outputs..."
terraform output -json > "$PROJECT_DIR/terraform-outputs.json"

echo ""
echo "=========================================="
echo "Next Steps (Manual)"
echo "=========================================="
echo ""
echo "1. Route53 + ACM Setup:"
echo "   - Request ACM certificate for *.aiops.cloudpiles.net"
echo "   - Create Route53 record in cloudpiles-platform account"
echo ""
echo "2. ECS Services:"
echo "   - Deploy Langfuse on ECS Fargate"
echo "   - Deploy Agent Office on ECS Fargate"
echo ""
echo "3. Cognito + Entra ID:"
echo "   - Create Cognito User Pool"
echo "   - Configure Entra ID federation"
echo ""
echo "4. AgentCore Harnesses:"
echo "   - Create 5 agent harnesses"
echo ""
echo "5. CI/CD Pipeline:"
echo "   - Setup GitHub Actions"
echo ""
echo "=========================================="
echo "Infrastructure deployment complete!"
echo "Outputs saved to: terraform-outputs.json"
echo "=========================================="
