#!/usr/bin/env bash
# Recovers a Convex backend whose first start failed (e.g. a bad
# INSTANCE_SECRET) and left a half-initialised SQLite file behind
# ("missing _tables.by_id global"). Deletes the convex-data volume and starts
# Convex fresh.
#
# Guarded: it refuses unless the CONVEX_ADMIN_KEY secret is still "pending",
# i.e. Convex has never come up, so there can be no data to lose.
set -euo pipefail
REGION=${AWS_REGION:-eu-north-1}
key=$(aws secretsmanager get-secret-value --region "$REGION" --secret-id lendloop/prod/CONVEX_ADMIN_KEY --query SecretString --output text)
[ "$key" = pending ] || { echo "Refusing: Convex has run before (admin key issued). Restore from AWS Backup instead." >&2; exit 1; }
unset key
id=$(aws cloudformation describe-stacks --region "$REGION" --stack-name LendLoop-Backend \
  --query "Stacks[0].Outputs[?OutputKey=='InstanceId'].OutputValue" --output text)
cmd=$(aws ssm send-command --region "$REGION" --instance-ids "$id" --document-name AWS-RunShellScript \
  --comment "Reset never-started Convex volume" \
  --parameters 'commands=["set -e","cd /opt/lendloop","docker compose -f docker-compose.prod.yml rm -sf convex","docker volume rm lendloop_convex-data","docker compose -f docker-compose.prod.yml up -d convex","for i in $(seq 30); do curl -sf http://127.0.0.1:3210/version && exit 0; sleep 3; done; docker logs --tail 20 lendloop-convex-1; exit 1"]' \
  --query Command.CommandId --output text)
until status=$(aws ssm get-command-invocation --region "$REGION" --command-id "$cmd" --instance-id "$id" --query Status --output text 2>/dev/null) &&
  [[ $status != Pending && $status != InProgress && $status != Delayed ]]; do sleep 5; done
aws ssm get-command-invocation --region "$REGION" --command-id "$cmd" --instance-id "$id" --query '[StandardOutputContent,StandardErrorContent]' --output text
[ "$status" = Success ] && echo "Convex is up." || { echo "Reset $status" >&2; exit 1; }
