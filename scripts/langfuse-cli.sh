#!/bin/zsh
set -euo pipefail

if [[ $# -lt 2 ]]; then
  print -u2 'Usage: scripts/langfuse-cli.sh <multi-agent|tattoo-studio> <langfuse CLI arguments...>'
  exit 64
fi
project_id=$1
shift
case "$project_id" in
  multi-agent) secret_id=multi-agent-langfuse-keys ;;
  tattoo-studio) secret_id=multi-agent-langfuse-tattoo-studio-keys ;;
  *) print -u2 'Unknown Langfuse project'; exit 64 ;;
esac
key_json=$(AWS_PROFILE=${AWS_PROFILE:-aiops-aws} AWS_REGION=${AWS_REGION:-us-east-1} aws secretsmanager get-secret-value --secret-id "$secret_id" --query SecretString --output text)
public_key=$(print -r -- "$key_json" | jq -r '.public_key')
secret_key=$(print -r -- "$key_json" | jq -r '.secret_key')
exec npx --prefix tools/langfuse-control langfuse --host "${LANGFUSE_HOST:-https://langfuse.aiops.cloudpiles.net}" --api-version auto --public-key "$public_key" --secret-key "$secret_key" "$@"
