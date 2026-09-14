#!/bin/bash
# Complete autonomous deployment script
# This script executes all deployment steps in sequence

set -e

PROJECT_DIR="/Users/angelreale/MLOps/Personales/Gaudi/multi-agent-infra"
INFRA_DIR="$PROJECT_DIR/infra"

echo "=========================================="
echo "Multi-Agent Infrastructure - Complete Deployment"
echo "=========================================="
echo ""
echo "This script will:"
echo "1. Commit and push to GitHub"
echo "2. Apply Terraform infrastructure"
echo "3. Continue with next steps"
echo ""

# Step 1: Git operations
echo "Step 1: Committing and pushing to GitHub..."
cd "$PROJECT_DIR"
git add -A
git commit -m "Initial commit: Multi-Agent Infrastructure ready for deployment"
git push -u origin main

echo ""
echo "Step 2: Applying Terraform infrastructure..."
cd "$INFRA_DIR"
terraform apply -auto-approve tfplan

echo ""
echo "Step 3: Getting outputs..."
terraform output -json > "$PROJECT_DIR/terraform-outputs.json"

echo ""
echo "=========================================="
echo "Deployment Complete!"
echo "=========================================="
echo ""
echo "Infrastructure deployed successfully!"
echo "Outputs saved to: terraform-outputs.json"
echo ""
echo "Next steps (manual):"
echo "1. Route53 + ACM setup"
echo "2. ECS Services deployment"
echo "3. Cognito + Entra ID federation"
echo "4. AgentCore Harnesses creation"
echo "5. CI/CD Pipeline setup"
