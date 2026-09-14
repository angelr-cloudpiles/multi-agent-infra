#!/bin/bash

# Complete cleanup and reinitialization script
# Run this to fix Terraform backend issues

set -e

echo "🧹 Cleaning up Terraform state..."

cd /Users/angelreale/MLOps/Personales/Gaudi/multi-agent-infra/infra

# Remove .terraform directory
if [ -d ".terraform" ]; then
    echo "Removing .terraform directory..."
    rm -rf .terraform
fi

# Remove lock file
if [ -f ".terraform.lock.hcl" ]; then
    echo "Removing lock file..."
    rm -f .terraform.lock.hcl
fi

# Remove any state files
if [ -f "terraform.tfstate" ]; then
    echo "Removing terraform.tfstate..."
    rm -f terraform.tfstate
fi

if [ -f "terraform.tfstate.backup" ]; then
    echo "Removing terraform.tfstate.backup..."
    rm -f terraform.tfstate.backup
fi

if [ -f "tfplan" ]; then
    echo "Removing tfplan..."
    rm -f tfplan
fi

echo ""
echo "✅ Cleanup complete!"
echo ""
echo "📝 Now run:"
echo "   terraform init"
echo "   terraform plan -out=tfplan"
echo "   terraform apply tfplan"
