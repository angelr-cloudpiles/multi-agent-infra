#!/usr/bin/env bash
# Provisions the Cognito user pool and its Entra ID OIDC provider.
# The Entra client secret is read only into process memory and is never echoed.

set -euo pipefail

profile="aiops-aws"
region="us-east-1"
secret_id="multi-agent-entra-id-oidc-client-secret"
tenant_id="0d7c9ad4-6df4-4c9c-a088-f296098ad992"
client_id="1d92561c-b198-48eb-9c8c-410fda3c969d"
pool_name="multi-agent-users"
callback_url="https://aiops.cloudpiles.net/auth/callback"

secret_json="$(aws secretsmanager get-secret-value --profile "$profile" --region "$region" --secret-id "$secret_id" --query SecretString --output text)"
entra_secret="$(jq -r '.client_secret // empty' <<<"$secret_json")"

if [[ -z "$entra_secret" || "$entra_secret" == "null" ]]; then
  echo "The secret must contain a JSON field named client_secret." >&2
  exit 1
fi

pool_id="$(aws cognito-idp list-user-pools --profile "$profile" --region "$region" --max-results 60 --query "UserPools[?Name=='$pool_name'].Id | [0]" --output text)"

if [[ "$pool_id" == "None" || -z "$pool_id" ]]; then
  pool_id="$(aws cognito-idp create-user-pool \
    --profile "$profile" --region "$region" \
    --pool-name "$pool_name" \
    --username-attributes email \
    --auto-verified-attributes email \
    --mfa-configuration OFF \
    --policies '{"PasswordPolicy":{"MinimumLength":14,"RequireUppercase":true,"RequireLowercase":true,"RequireNumbers":true,"RequireSymbols":true,"TemporaryPasswordValidityDays":7}}' \
    --user-pool-tags Project=multi-agent-team,Environment=production,Owner=aiops,CostCenter=aiops-operations,ManagedBy=terraform \
    --query 'UserPool.Id' --output text)"
fi

if ! aws cognito-idp describe-identity-provider --profile "$profile" --region "$region" --user-pool-id "$pool_id" --provider-name EntraID >/dev/null 2>&1; then
  aws cognito-idp create-identity-provider \
    --profile "$profile" --region "$region" \
    --user-pool-id "$pool_id" \
    --provider-name EntraID \
    --provider-type OIDC \
    --provider-details "client_id=$client_id,client_secret=$entra_secret,attributes_request_method=GET,authorize_scopes=openid email profile,oidc_issuer=https://login.microsoftonline.com/$tenant_id/v2.0,jwks_uri=https://login.microsoftonline.com/$tenant_id/discovery/v2.0/keys" \
    --attribute-mapping email=email,given_name=given_name,family_name=family_name,username=sub >/dev/null
fi

app_client_id="$(aws cognito-idp list-user-pool-clients --profile "$profile" --region "$region" --user-pool-id "$pool_id" --max-results 60 --query "UserPoolClients[?ClientName=='multi-agent-web'].ClientId | [0]" --output text)"

if [[ "$app_client_id" == "None" || -z "$app_client_id" ]]; then
  app_client_id="$(aws cognito-idp create-user-pool-client \
    --profile "$profile" --region "$region" \
    --user-pool-id "$pool_id" --client-name multi-agent-web \
    --no-generate-secret \
    --supported-identity-providers COGNITO EntraID \
    --allowed-o-auth-flows-user-pool-client \
    --allowed-o-auth-flows code \
    --allowed-o-auth-scopes openid email profile \
    --callback-urls "$callback_url" \
    --logout-urls https://aiops.cloudpiles.net/ \
    --explicit-auth-flows ALLOW_REFRESH_TOKEN_AUTH ALLOW_USER_SRP_AUTH \
    --enable-token-revocation \
    --query 'UserPoolClient.ClientId' --output text)"
fi

echo "user_pool_id=$pool_id"
echo "app_client_id=$app_client_id"
echo "entra_redirect_uri=https://<cognito-domain>.auth.$region.amazoncognito.com/oauth2/idpresponse"
