#!/bin/bash

# Verify deployment of Multi-Agent Infrastructure
# Run this after terraform apply

set -e

echo "🔍 Verifying Multi-Agent Infrastructure Deployment..."
echo ""

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check AWS CLI
echo "1️⃣ Checking AWS CLI..."
if command -v aws &> /dev/null; then
    echo -e "${GREEN}✅ AWS CLI installed${NC}"
else
    echo -e "${RED}❌ AWS CLI not found${NC}"
    exit 1
fi

# Check Terraform
echo ""
echo "2️⃣ Checking Terraform..."
if command -v terraform &> /dev/null; then
    echo -e "${GREEN}✅ Terraform installed${NC}"
else
    echo -e "${RED}❌ Terraform not found${NC}"
    exit 1
fi

# Check VPC
echo ""
echo "3️⃣ Checking VPC..."
VPC_ID=$(terraform output -raw vpc_id 2>/dev/null || echo "")
if [ -n "$VPC_ID" ]; then
    echo -e "${GREEN}✅ VPC: $VPC_ID${NC}"
else
    echo -e "${YELLOW}⚠️  VPC not found (may not be deployed yet)${NC}"
fi

# Check S3 Buckets
echo ""
echo "4️⃣ Checking S3 Buckets..."
SKILLS_BUCKET=$(terraform output -raw skills_bucket_name 2>/dev/null || echo "")
if [ -n "$SKILLS_BUCKET" ]; then
    if aws s3 ls "s3://$SKILLS_BUCKET" --profile aiops-aws 2>/dev/null; then
        echo -e "${GREEN}✅ Skills Bucket: $SKILLS_BUCKET${NC}"
    else
        echo -e "${YELLOW}⚠️  Skills Bucket exists in state but not accessible${NC}"
    fi
else
    echo -e "${YELLOW}⚠️  Skills Bucket not found${NC}"
fi

# Check Langfuse RDS
echo ""
echo "5️⃣ Checking RDS..."
LANGFUSE_DB=$(terraform output -raw langfuse_db_endpoint 2>/dev/null || echo "")
if [ -n "$LANGFUSE_DB" ]; then
    echo -e "${GREEN}✅ Langfuse DB Endpoint: $LANGFUSE_DB${NC}"
else
    echo -e "${YELLOW}⚠️  Langfuse DB not found${NC}"
fi

# Check ElastiCache
echo ""
echo "6️⃣ Checking ElastiCache..."
REDIS_ENDPOINT=$(terraform output -raw langfuse_redis_endpoint 2>/dev/null || echo "")
if [ -n "$REDIS_ENDPOINT" ]; then
    echo -e "${GREEN}✅ Redis Endpoint: $REDIS_ENDPOINT${NC}"
else
    echo -e "${YELLOW}⚠️  Redis not found${NC}"
fi

# Check Budgets
echo ""
echo "7️⃣ Checking AWS Budgets..."
BUDGET_NAME=$(terraform output -raw budget_name 2>/dev/null || echo "")
if [ -n "$BUDGET_NAME" ]; then
    if aws budgets describe-budget --account-id 278741241787 --budget-name "$BUDGET_NAME" --profile aiops-aws 2>/dev/null; then
        echo -e "${GREEN}✅ Budget: $BUDGET_NAME${NC}"
    else
        echo -e "${YELLOW}⚠️  Budget exists in state but not accessible${NC}"
    fi
else
    echo -e "${YELLOW}⚠️  Budget not found${NC}"
fi

# Summary
echo ""
echo "=========================================="
echo "📊 Deployment Verification Summary"
echo "=========================================="
echo ""
echo "Next steps:"
echo "1. Deploy ECS services (Langfuse and Agent Office)"
echo "2. Configure Route53 and ACM"
echo "3. Setup Cognito with Entra ID"
echo "4. Create AgentCore Harnesses"
echo ""
echo "Run: ./scripts/deploy-services.sh"
