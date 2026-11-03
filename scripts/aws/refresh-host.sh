#!/usr/bin/env bash
# Re-runs deploy/ec2/bootstrap.sh on the production host through SSM Run
# Command (no SSH): pulls the latest bundle and n8n workflows, rewrites the
# compose environment from Secrets Manager, and restarts what changed.
# Used by the deploy workflow and after infrastructure changes.
set -euo pipefail
REGION=${AWS_REGION:-eu-north-1}
id=$(aws cloudformation describe-stacks --region "$REGION" --stack-name LendLoop-Backend \
  --query "Stacks[0].Outputs[?OutputKey=='InstanceId'].OutputValue" --output text)
cmd=$(aws ssm send-command --region "$REGION" --instance-ids "$id" --document-name AWS-RunShellScript \
  --comment "LendLoop bootstrap" --timeout-seconds 900 \
  --parameters 'commands=["set -a; . /etc/lendloop.env; set +a; aws s3 cp --region $AWS_REGION \"$(aws ssm get-parameter --region $AWS_REGION --name $BUNDLE_PARAM --query Parameter.Value --output text)\" /tmp/ec2.zip --only-show-errors && unzip -oq /tmp/ec2.zip -d /opt/lendloop && chmod +x /opt/lendloop/*.sh && /opt/lendloop/bootstrap.sh"]' \
  --query Command.CommandId --output text)
echo "Refreshing $id (command $cmd)…"
until status=$(aws ssm get-command-invocation --region "$REGION" --command-id "$cmd" --instance-id "$id" --query Status --output text 2>/dev/null) &&
  [[ $status != Pending && $status != InProgress && $status != Delayed ]]; do sleep 5; done
if [ "$status" != Success ]; then
  echo "Host refresh $status. Last output (bootstrap logs go to journald: lendloop-bootstrap):" >&2
  aws ssm get-command-invocation --region "$REGION" --command-id "$cmd" --instance-id "$id" --query StandardErrorContent --output text >&2
  exit 1
fi
echo "Host refreshed."
