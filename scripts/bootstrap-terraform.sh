#!/bin/bash

# Bootstrap script to create S3 bucket and DynamoDB table for Terraform state
# Run this ONCE before terraform init

set -e

BUCKET_NAME="multi-agent-terraform-state-278741241787"
TABLE_NAME="multi-agent-terraform-locks"
REGION="us-east-1"

echo "🚀 Bootstrapping Terraform backend..."
echo ""

# Create S3 bucket
echo "1️⃣ Creating S3 bucket: $BUCKET_NAME"
if aws s3 ls "s3://$BUCKET_NAME" --profile aiops-aws 2>/dev/null; then
    echo "✅ Bucket already exists"
else
    aws s3 mb "s3://$BUCKET_NAME" --profile aiops-aws --region $REGION
    echo "✅ Bucket created"
fi

# Enable versioning
echo ""
echo "2️⃣ Enabling versioning..."
aws s3api put-bucket-versioning \
    --bucket $BUCKET_NAME \
    --versioning-configuration Status=Enabled \
    --profile aiops-aws

# Enable encryption
echo ""
echo "3️⃣ Enabling encryption..."
aws s3api put-bucket-encryption \
    --bucket $BUCKET_NAME \
    --server-side-encryption-configuration '{"Rules":[{"ApplyServerSideEncryptionByDefault":{"SSEAlgorithm":"AES256"}}]}' \
    --profile aiops-aws

# Block public access
echo ""
echo "4️⃣ Blocking public access..."
aws s3api put-public-access-block \
    --bucket $BUCKET_NAME \
    --public-access-block-configuration "BlockPublicAcls=true,IgnorePublicAcls=true,BlockPublicPolicy=true,RestrictPublicBuckets=true" \
    --profile aiops-aws

# Create DynamoDB table
echo ""
echo "5️⃣ Creating DynamoDB table: $TABLE_NAME"
if aws dynamodb describe-table --table-name $TABLE_NAME --profile aiops-aws 2>/dev/null; then
    echo "✅ Table already exists"
else
    aws dynamodb create-table \
        --table-name $TABLE_NAME \
        --attribute-definitions AttributeName=LockID,AttributeType=S \
        --key-schema AttributeName=LockID,KeyType=HASH \
        --billing-mode PAY_PER_REQUEST \
        --tags Key=Project,Value=multi-agent-team Key=ManagedBy,Value=terraform \
        --profile aiops-aws
    echo "✅ Table created"
fi

echo ""
echo "✅ Bootstrap complete!"
echo ""
echo "📝 Next steps:"
echo "   cd infra"
echo "   terraform init"
echo "   terraform plan"
