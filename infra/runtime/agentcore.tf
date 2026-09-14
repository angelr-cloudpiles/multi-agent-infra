locals {
  model_policy = jsondecode(file("${path.module}/../../agentcore/model-policy.json"))
}
resource "aws_iam_role_policy" "harness_runtime" {
  name = "multi-agent-harness-runtime"
  role = "multi-agent-agentcore-execution-role"
  policy = jsonencode({ Version = "2012-10-17", Statement = [
    { Effect = "Allow", Action = ["bedrock:InvokeModel", "bedrock:InvokeModelWithResponseStream"], Resource = concat(
      [for model in values(local.model_policy.aliases) : "arn:aws:bedrock:us-east-1:278741241787:inference-profile/${model}"],
      [for model in values(local.model_policy.aliases) : "arn:aws:bedrock:us-*::foundation-model/${trimprefix(model, "us.")}"]
    ) },
    { Effect = "Allow", Action = ["ecr-public:GetAuthorizationToken"], Resource = "*" },
    { Effect = "Allow", Action = ["sts:GetServiceBearerToken"], Resource = "*", Condition = { StringEquals = { "sts:AWSServiceName" = "ecr-public.amazonaws.com" } } },
    { Effect = "Allow", Action = ["xray:PutTraceSegments", "xray:PutTelemetryRecords", "xray:GetSamplingRules", "xray:GetSamplingTargets"], Resource = "*" },
    { Effect = "Allow", Action = ["logs:CreateLogGroup", "logs:DescribeLogStreams", "logs:CreateLogStream", "logs:PutLogEvents"], Resource = "arn:aws:logs:us-east-1:278741241787:log-group:/aws/bedrock-agentcore/*" },
    { Effect = "Allow", Action = ["logs:DescribeLogGroups"], Resource = "*" },
    { Effect = "Allow", Action = ["cloudwatch:PutMetricData"], Resource = "*", Condition = { StringEquals = { "cloudwatch:namespace" = "bedrock-agentcore" } } },
    { Effect = "Allow", Action = ["bedrock-agentcore:GetMemory", "bedrock-agentcore:CreateEvent", "bedrock-agentcore:ListEvents", "bedrock-agentcore:RetrieveMemoryRecords", "bedrock-agentcore:ListMemoryRecords", "bedrock-agentcore:DeleteMemoryRecord"], Resource = "arn:aws:bedrock-agentcore:us-east-1:278741241787:memory/*" },
    { Effect = "Allow", Action = ["kms:CreateGrant", "kms:Decrypt", "kms:DescribeKey", "kms:GenerateDataKey", "kms:GenerateDataKeyWithoutPlaintext", "kms:ReEncrypt*"], Resource = aws_kms_key.agentcore_memory.arn, Condition = { StringEquals = { "kms:ViaService" = "bedrock-agentcore.us-east-1.amazonaws.com" } } },
    { Effect = "Allow", Action = ["bedrock-agentcore:GetWorkloadAccessToken", "bedrock-agentcore:GetWorkloadAccessTokenForJWT"], Resource = ["arn:aws:bedrock-agentcore:us-east-1:278741241787:workload-identity-directory/default", "arn:aws:bedrock-agentcore:us-east-1:278741241787:workload-identity-directory/default/workload-identity/harness_*"] }
  ] })
}
