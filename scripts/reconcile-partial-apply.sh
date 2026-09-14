#!/usr/bin/env bash
# Reconciles Terraform state after a timed-out apply that created AWS resources.
# This script does not delete or replace AWS resources.

set -euo pipefail

infra_dir="/Users/angelreale/MLOps/Personales/Gaudi/multi-agent-infra/infra"
cd "$infra_dir"

# The first interrupted apply created these resources, but did not persist them
# to state. The second attempt wrote failed NAT gateway IDs to state while the
# originally created NAT gateways remained available.
terraform state rm 'aws_nat_gateway.main[0]' || true
terraform state rm 'aws_nat_gateway.main[1]' || true

terraform import 'aws_nat_gateway.main[0]' nat-08596e48f1dae5e32
terraform import 'aws_nat_gateway.main[1]' nat-04f5066459ed19a87
terraform import aws_db_instance.langfuse multi-agent-langfuse-db
terraform import aws_elasticache_cluster.langfuse multi-agent-redis

terraform plan -out=tfplan
