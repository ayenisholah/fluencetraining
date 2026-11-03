#!/usr/bin/env bash
# Reads operational counts from Convex (signed, localhost-only POST
# /ops/metrics) and publishes them, plus a Heartbeat, to CloudWatch namespace
# "LendLoop" with the instance role. A missing Heartbeat is itself an alarm.
set -euo pipefail
: "${AWS_REGION:?}" "${SECRET_PREFIX:?}"
secret=$(aws secretsmanager get-secret-value --region "$AWS_REGION" --secret-id "$SECRET_PREFIX/OPS_METRICS_SECRET" --query SecretString --output text)
body='{"request":"metrics"}'
ts=$(date +%s%3N)
sig=$(printf '%s.%s' "$ts" "$body" | openssl dgst -sha256 -hmac "$secret" -hex | awk '{print $NF}')
json=$(curl -sf --max-time 10 -X POST http://127.0.0.1:3211/ops/metrics \
  -H 'content-type: application/json' -H "x-lendloop-timestamp: $ts" -H "x-lendloop-signature: sha256=$sig" \
  --data "$body")
data=$(jq -c '[to_entries[] | {MetricName: .key, Value: .value, Unit: (if (.key | endswith("Seconds")) then "Seconds" else "Count" end)}] + [{MetricName: "Heartbeat", Value: 1, Unit: "Count"}]' <<<"$json")
aws cloudwatch put-metric-data --region "$AWS_REGION" --namespace LendLoop --metric-data "$data"
