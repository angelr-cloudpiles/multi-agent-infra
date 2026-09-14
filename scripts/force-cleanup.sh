#!/bin/bash
# Force cleanup script for Terraform state
# This script removes the .terraform directory to allow fresh initialization

set -e

INFRA_DIR="/Users/angelreale/MLOps/Personales/Gaudi/multi-agent-infra/infra"

echo "=========================================="
echo "Force Cleanup Terraform State"
echo "=========================================="
echo ""
echo "This script will:"
echo "1. Remove .terraform directory"
echo "2. Remove .terraform.lock.hcl"
echo "3. Remove any existing terraform.tfstate files"
echo "4. Reinitialize Terraform with local backend"
echo ""
read -p "Continue? (y/n): " -n 1 -r
echo ""

if [[ ! $REPLY =~ ^[Yy]$ ]]
then
    echo "Aborted."
    exit 1
fi

cd "$INFRA_DIR"

echo ""
echo "Step 1: Removing .terraform directory..."
rm -rf .terraform

echo "Step 2: Removing .terraform.lock.hcl..."
rm -f .terraform.lock.hcl

echo "Step 3: Removing terraform state files..."
rm -f terraform.tfstate terraform.tfstate.backup

echo "Step 4: Initializing Terraform..."
terraform init

echo ""
echo "=========================================="
echo "Cleanup complete!"
echo "=========================================="
echo ""
echo "Next steps:"
echo "1. Run: terraform plan -out=tfplan"
echo "2. Run: terraform apply tfplan"
