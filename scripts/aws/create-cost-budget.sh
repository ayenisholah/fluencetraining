#!/usr/bin/env bash
# Creates (or updates) a $1/month cost budget that emails ALERT_EMAIL when
# actual or forecast spend passes it, so free-plan credits aren't spent
# unnoticed. AWS Budgets is global and not available to CloudFormation in
# eu-north-1, so it lives here instead of in CDK. Budgets are free.
#   bash scripts/aws/create-cost-budget.sh
set -euo pipefail
REPO=${REPO:-ayenisholah/fluencetraining}
ACCOUNT=$(aws sts get-caller-identity --query Account --output text)
EMAIL=${ALERT_EMAIL:-$(gh variable get ALERT_EMAIL -R "$REPO")}
NAME=lendloop-monthly-cost-guard
budget='{"BudgetName":"'$NAME'","BudgetType":"COST","TimeUnit":"MONTHLY","BudgetLimit":{"Amount":"1","Unit":"USD"}}'
if aws budgets describe-budget --account-id "$ACCOUNT" --budget-name "$NAME" >/dev/null 2>&1; then
  aws budgets update-budget --account-id "$ACCOUNT" --new-budget "$budget"
  echo "updated budget $NAME"
else
  notify() { printf '{"Notification":{"NotificationType":"%s","ComparisonOperator":"GREATER_THAN","Threshold":100,"ThresholdType":"PERCENTAGE"},"Subscribers":[{"SubscriptionType":"EMAIL","Address":"%s"}]}' "$1" "$EMAIL"; }
  aws budgets create-budget --account-id "$ACCOUNT" --budget "$budget" \
    --notifications-with-subscribers "[$(notify ACTUAL),$(notify FORECASTED)]"
  echo "created budget $NAME (alerts to $EMAIL)"
fi
