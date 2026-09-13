locals {
  github_repository = "angelr-cloudpiles/multi-agent-infra"
  github_subject    = "repo:angelr-cloudpiles@228038680/multi-agent-infra@1365001608"
  github_oidc_url   = "https://token.actions.githubusercontent.com"
}

resource "aws_iam_openid_connect_provider" "github_actions" {
  url             = local.github_oidc_url
  client_id_list  = ["sts.amazonaws.com"]
  thumbprint_list = ["6938fd4d98bab03faadb97b34396831e3780aea1"]
}

data "aws_iam_policy_document" "github_plan_trust" {
  statement {
    actions = ["sts:AssumeRoleWithWebIdentity"]
    principals {
      type        = "Federated"
      identifiers = [aws_iam_openid_connect_provider.github_actions.arn]
    }
    condition {
      test     = "StringEquals"
      variable = "token.actions.githubusercontent.com:aud"
      values   = ["sts.amazonaws.com"]
    }
    condition {
      test     = "StringLike"
      variable = "token.actions.githubusercontent.com:sub"
      values   = ["${local.github_subject}:*"]
    }
  }
}

resource "aws_iam_role" "github_plan" {
  name               = "multi-agent-github-plan-role"
  assume_role_policy = data.aws_iam_policy_document.github_plan_trust.json
}

resource "aws_iam_role_policy_attachment" "github_plan_readonly" {
  role       = aws_iam_role.github_plan.name
  policy_arn = "arn:aws:iam::aws:policy/ReadOnlyAccess"
}

resource "aws_iam_role_policy" "github_plan_state" {
  name = "multi-agent-github-plan-state"
  role = aws_iam_role.github_plan.id
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      { Effect = "Allow", Action = ["s3:GetObject", "s3:PutObject", "s3:DeleteObject"], Resource = "arn:aws:s3:::multi-agent-terraform-state-278741241787/multi-agent-runtime/terraform.tfstate" },
      { Effect = "Allow", Action = ["s3:ListBucket"], Resource = "arn:aws:s3:::multi-agent-terraform-state-278741241787", Condition = { StringLike = { "s3:prefix" = ["multi-agent-runtime/terraform.tfstate"] } } },
      { Effect = "Allow", Action = ["dynamodb:GetItem", "dynamodb:PutItem", "dynamodb:DeleteItem"], Resource = "arn:aws:dynamodb:us-east-1:278741241787:table/multi-agent-terraform-locks" }
    ]
  })
}

data "aws_iam_policy_document" "github_deploy_trust" {
  statement {
    actions = ["sts:AssumeRoleWithWebIdentity"]
    principals {
      type        = "Federated"
      identifiers = [aws_iam_openid_connect_provider.github_actions.arn]
    }
    condition {
      test     = "StringEquals"
      variable = "token.actions.githubusercontent.com:aud"
      values   = ["sts.amazonaws.com"]
    }
    condition {
      test     = "StringEquals"
      variable = "token.actions.githubusercontent.com:sub"
      values   = ["${local.github_subject}:environment:production"]
    }
  }
}

resource "aws_iam_role" "github_deploy" {
  name               = "multi-agent-github-deploy-role"
  assume_role_policy = data.aws_iam_policy_document.github_deploy_trust.json
}

resource "aws_iam_role_policy" "github_deploy" {
  name = "multi-agent-github-deploy"
  role = aws_iam_role.github_deploy.id
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      { Effect = "Allow", Action = ["ecr:GetAuthorizationToken"], Resource = "*" },
      { Effect = "Allow", Action = ["ecr:BatchCheckLayerAvailability", "ecr:CompleteLayerUpload", "ecr:DescribeImageScanFindings", "ecr:DescribeImages", "ecr:InitiateLayerUpload", "ecr:PutImage", "ecr:UploadLayerPart"], Resource = "arn:aws:ecr:us-east-1:278741241787:repository/multi-agent-agent-office" },
      { Effect = "Allow", Action = ["ecs:DescribeServices", "ecs:DescribeTaskDefinition", "ecs:RegisterTaskDefinition", "ecs:UpdateService"], Resource = "*" },
      { Effect = "Allow", Action = ["iam:PassRole"], Resource = [local.execution_role, aws_iam_role.office_task.arn], Condition = { StringEquals = { "iam:PassedToService" = "ecs-tasks.amazonaws.com" } } },
      { Effect = "Allow", Action = ["events:PutEvents"], Resource = "arn:aws:events:us-east-1:278741241787:event-bus/default" }
    ]
  })
}
