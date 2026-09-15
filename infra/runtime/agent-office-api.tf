locals {
  office_api_cognito_user_pool_id = "us-east-1_HfqTm2uYI"
  office_api_cognito_client_id    = "1ebc3vlsnt8raekoipr3fplim0"
  office_api_alb_listener_arn     = "arn:aws:elasticloadbalancing:us-east-1:278741241787:listener/app/multi-agent-platform-alb/c0f7525c5f206dcb/e3c5966f298fb374"
}

# The IDE bridge uses a separate public OAuth client. It has no client secret
# and is limited to Authorization Code plus PKCE on a fixed local loopback
# callback. Keeping it distinct from the browser client avoids broadening the
# browser redirect surface or changing its cookie/session behavior.
resource "aws_cognito_user_pool_client" "office_ide_mcp" {
  name                                 = "multi-agent-ide-mcp"
  user_pool_id                         = local.office_api_cognito_user_pool_id
  generate_secret                      = false
  prevent_user_existence_errors        = "ENABLED"
  supported_identity_providers         = ["COGNITO", "EntraID"]
  callback_urls                        = ["http://127.0.0.1:19876/oauth/callback"]
  logout_urls                          = ["http://127.0.0.1:19876/oauth/callback"]
  allowed_oauth_flows_user_pool_client = true
  allowed_oauth_flows                  = ["code"]
  allowed_oauth_scopes                 = ["openid", "email", "profile"]
  explicit_auth_flows                  = ["ALLOW_REFRESH_TOKEN_AUTH"]
  enable_token_revocation              = true
  refresh_token_validity               = 30
  auth_session_validity                = 3
}

resource "aws_security_group" "office_api_vpc_link" {
  name        = "multi-agent-office-api-vpc-link"
  description = "API Gateway VPC Link egress for Agent Office"
  vpc_id      = "vpc-06a015e90038514b5"

  tags = { Name = "multi-agent-office-api-vpc-link" }
}

resource "aws_vpc_security_group_egress_rule" "office_api_to_alb" {
  security_group_id            = aws_security_group.office_api_vpc_link.id
  referenced_security_group_id = "sg-04cec424b04a6df36"
  ip_protocol                  = "tcp"
  from_port                    = 443
  to_port                      = 443
  description                  = "HTTPS to the Agent Office ALB"
}

resource "aws_apigatewayv2_api" "office" {
  name          = "multi-agent-agent-office-api"
  protocol_type = "HTTP"
  description   = "Authenticated API boundary for Agent Office and AgentCore"

  cors_configuration {
    allow_credentials = true
    allow_headers     = ["authorization", "content-type", "x-requested-with"]
    allow_methods     = ["GET", "POST", "PUT", "OPTIONS"]
    allow_origins     = [local.office_public_url]
    max_age           = 600
  }
}

resource "aws_apigatewayv2_vpc_link" "office" {
  name               = "multi-agent-agent-office-link"
  security_group_ids = [aws_security_group.office_api_vpc_link.id]
  subnet_ids         = local.private_subnets
}

resource "aws_apigatewayv2_integration" "office" {
  api_id                 = aws_apigatewayv2_api.office.id
  integration_type       = "HTTP_PROXY"
  integration_method     = "ANY"
  integration_uri        = local.office_api_alb_listener_arn
  connection_type        = "VPC_LINK"
  connection_id          = aws_apigatewayv2_vpc_link.office.id
  payload_format_version = "1.0"
  timeout_milliseconds   = 29000
  request_parameters = {
    "append:header.x-agent-office-gateway" = "agent-office-api"
  }
}

resource "aws_apigatewayv2_authorizer" "office" {
  api_id           = aws_apigatewayv2_api.office.id
  name             = "agent-office-cognito"
  authorizer_type  = "JWT"
  identity_sources = ["$request.header.Authorization"]

  jwt_configuration {
    audience = [local.office_api_cognito_client_id, aws_cognito_user_pool_client.office_ide_mcp.id]
    issuer   = "https://cognito-idp.us-east-1.amazonaws.com/${local.office_api_cognito_user_pool_id}"
  }
}

resource "aws_apigatewayv2_route" "office_api_root" {
  api_id             = aws_apigatewayv2_api.office.id
  route_key          = "ANY /api"
  target             = "integrations/${aws_apigatewayv2_integration.office.id}"
  authorization_type = "JWT"
  authorizer_id      = aws_apigatewayv2_authorizer.office.id
}

resource "aws_apigatewayv2_route" "office_api_proxy" {
  api_id             = aws_apigatewayv2_api.office.id
  route_key          = "ANY /api/{proxy+}"
  target             = "integrations/${aws_apigatewayv2_integration.office.id}"
  authorization_type = "JWT"
  authorizer_id      = aws_apigatewayv2_authorizer.office.id
}

resource "aws_cloudwatch_log_group" "office_api" {
  name              = "/aws/apigateway/multi-agent-agent-office"
  retention_in_days = 90
}

resource "aws_apigatewayv2_stage" "office" {
  api_id      = aws_apigatewayv2_api.office.id
  name        = "$default"
  auto_deploy = true

  access_log_settings {
    destination_arn = aws_cloudwatch_log_group.office_api.arn
    format = jsonencode({
      requestId   = "$context.requestId"
      routeKey    = "$context.routeKey"
      status      = "$context.status"
      latencyMs   = "$context.responseLatency"
      sourceIp    = "$context.identity.sourceIp"
      userAgent   = "$context.identity.userAgent"
      integration = "$context.integrationStatus"
    })
  }

  default_route_settings {
    detailed_metrics_enabled = true
    throttling_burst_limit   = 20
    throttling_rate_limit    = 10
  }
}

output "agent_office_api_endpoint" {
  description = "JWT-protected API Gateway endpoint for Agent Office"
  value       = aws_apigatewayv2_api.office.api_endpoint
}

output "agent_ide_mcp_client_id" {
  description = "Public Cognito client id used only by the local IDE MCP bridge"
  value       = aws_cognito_user_pool_client.office_ide_mcp.id
}
