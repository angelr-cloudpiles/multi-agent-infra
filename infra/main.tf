terraform {
  required_version = ">= 1.15.0"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
    random = {
      source  = "hashicorp/random"
      version = "~> 3.0"
    }
  }

  backend "s3" {
    bucket         = "multi-agent-terraform-state-278741241787"
    key            = "multi-agent-infra/terraform.tfstate"
    region         = "us-east-1"
    encrypt        = true
    dynamodb_table = "multi-agent-terraform-locks"
  }
}

# Provider for main account (aiops-aws)
provider "aws" {
  profile = "aiops-aws"
  region  = var.aws_region

  default_tags {
    tags = local.common_tags
  }
}

# Provider for platform account (cloudpiles-platform) - for Route53
provider "aws" {
  alias   = "platform"
  profile = "cloudpiles-platform"
  region  = "us-east-1"
}

locals {
  common_tags = {
    Project     = "multi-agent-team"
    Environment = "production"
    Owner       = "aiops"
    CostCenter  = "aiops-operations"
    ManagedBy   = "terraform"
    Repository  = "angelr-cloudpiles/multi-agent-infra"
  }

  name_prefix = "multi-agent"
}

variable "aws_region" {
  description = "AWS region for resources"
  type        = string
  default     = "us-east-1"
}

variable "environment" {
  description = "Environment name"
  type        = string
  default     = "production"
}

variable "budget_limit" {
  description = "Monthly budget limit in USD"
  type        = number
  default     = 1000
}

variable "notification_email" {
  description = "Email for budget notifications"
  type        = string
  default     = "aiops@cloudpiles.com"
}

variable "entra_id_tenant_id" {
  description = "Microsoft Entra ID Tenant ID"
  type        = string
  default     = "0d7c9ad4-6df4-4c9c-a088-f296098ad992"
}

variable "entra_id_application_id" {
  description = "Microsoft Entra ID Application ID"
  type        = string
  default     = "1d92561c-b198-48eb-9c8c-410fda3c969d"
}

variable "domain_name" {
  description = "Custom domain name"
  type        = string
  default     = "aiops.cloudpiles.net"
}

variable "litellm_master_key" {
  description = "Master key for LiteLLM"
  type        = string
  sensitive   = true
}

variable "langfuse_secret_key" {
  description = "Secret key for Langfuse"
  type        = string
  sensitive   = true
}

variable "langfuse_public_key" {
  description = "Public key for Langfuse"
  type        = string
  sensitive   = true
}
