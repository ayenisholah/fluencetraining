# AWS observability

This documents [ObservabilityStack](../../infra/lib/observability-stack.ts), the [host metrics poller](../../deploy/ec2/metrics.sh), and [Convex's metrics query](../../convex/ops.ts). Values describe the repository configuration; confirm live alarms and subscriptions in AWS before relying on them.

## Signals and data flow

The CloudWatch dashboard is `LendLoop-Prod` in `eu-north-1`; its URL is a `LendLoop-Observability` stack output. Custom metrics use namespace `LendLoop`.

The `lendloop-metrics.timer` systemd timer starts two minutes after boot and runs every five minutes. Its service reads `OPS_METRICS_SECRET`, signs a POST to `http://127.0.0.1:3211/ops/metrics`, and publishes the returned counts plus `Heartbeat`. Caddy rejects external `/ops/*` requests. A failure to read metrics or publish to AWS also prevents that heartbeat.

| Metric | Meaning |
|---|---|
| `OpenRequests`, `ActiveLoans`, `OverdueLoans` | Requested loans, approved loans, and approved loans past their UTC end date |
| `PendingDeliveries`, `FailedDeliveries` | Pending outbox rows and permanently failed webhook deliveries |
| `OldestPendingDeliveryAgeSeconds` | Age of the oldest pending row in the scanned set |
| `WorkflowErrors24h` | Recorded n8n workflow errors during the previous 24 hours |
| `OverdueNotRemindedToday` | Overdue loans without a successful reminder event for today's UTC date |
| `Heartbeat` | One sample for a successful poll/publish |

Queries cap each scanned signal at 1,000 rows. Counts can therefore saturate; they are operational indicators rather than uncapped reporting totals. Historical workflow errors remain counted until they age out. A delivery acknowledgement indicates workflow processing/SMTP acceptance, not inbox delivery.

The CloudWatch agent collects memory and root-disk usage every 60 seconds with `InstanceId` dimensions. EC2 supplies CPU/status metrics; Amplify supplies requests, errors and latency metrics. Dashboard log filters count n8n errors, Convex errors, rejected signed requests and Caddy 5xx responses. Those log filters have graphs, not separate alarms in the current stack.

## Logs and access

Docker writes through `awslogs` to `/lendloop/prod/caddy`, `/lendloop/prod/convex`, `/lendloop/prod/n8n`, and `/lendloop/prod/mailpit`. Retention is one month and the groups are retained if the backend stack is removed. Logging is non-blocking with a 4 MiB buffer; a logging failure need not stop the application and can lose buffered logs.

Bootstrap writes to journald under tag `lendloop-bootstrap`; this tag is not separately shipped by the configured CloudWatch agent. Use SSM Session Manager and inspect:

```sh
sudo journalctl -t lendloop-bootstrap --since '1 hour ago'
sudo systemctl status lendloop-metrics.timer
sudo journalctl -u lendloop-metrics.service --since '1 hour ago'
cd /opt/lendloop
sudo docker compose -f docker-compose.prod.yml ps
```

Do not paste secrets, signed request headers, credentials or recipient payloads from logs into tickets. The dashboard includes a Logs Insights query for recent errors across the four service groups.

## Synthetic checks

| Canary | Interval | Expected result |
|---|---|---|
| `lendloop-landing` | 15 minutes | App returns 200, renders “Available now”, and contains at least one public tool list item; captures a screenshot |
| `lendloop-n8n-webhook` | 15 minutes | Unsigned POST to the loan webhook returns 401; no email should be sent |
| `lendloop-convex` | 15 minutes | Convex `/version` returns 200 |

An empty public catalogue can fail the landing canary even when the app is healthy. Canaries use `SYNTHETICS_NODEJS_PUPPETEER_13_0`. The stack starts them after creation, keeps successful runs seven days and failures fourteen days, and expires S3 artifacts after fourteen days. The artifact bucket blocks public access, requires TLS and uses S3-managed encryption. Screenshots may contain public listing data. These checks do not verify signed-in flows, database recovery or SES inbox delivery.

## Alarm thresholds

Names below have prefix `lendloop-prod-`. Unless overridden, alarms use five-minute periods, require two of three breaching periods, compare strictly greater than the threshold, and treat missing data as not breaching. Both ALARM and OK transitions notify SNS.

| Alarm suffix | Trigger / override |
|---|---|
| `metrics-heartbeat-missing` | Heartbeat sample count below 1 for 3/3 periods; missing data breaches |
| `failed-deliveries` | Failed deliveries > 0 |
| `deliveries-stuck` | Oldest pending delivery > 900 seconds |
| `workflow-errors` | Errors in the last 24 hours > 0; 1/1 period |
| `reminders-missed` | Overdue loans not reminded today > 0 for 12/12 periods (one hour) |
| `canary-landing`, `canary-n8n`, `canary-convex` | Success percentage < 100, 2/3 fifteen-minute periods; missing data breaches |
| `host-cpu` | Average CPU > 80%, 3/3 periods |
| `host-memory` | Maximum memory use > 85% |
| `host-disk` | Maximum root disk use > 85%, 1/1 period; dimensions include `/` and `xfs` |
| `host-status-check` | EC2 status failures > 0, 2/3 one-minute periods |
| `web-5xx` | Amplify 5xx sum > 5 per period |
| `web-latency-p99` | Amplify p99 latency > 3,000 ms |

The reminder alarm evaluates continuously, not only after the 08:00 UTC reminder schedule. It can alarm earlier in the day; check the workflow's scheduled run before treating this as a missed execution. Metric dimension/availability mismatches can leave non-heartbeat alarms quiet because their missing-data policy is not breaching.

Composite alarm `lendloop-prod-unhealthy` is the OR of heartbeat, stuck deliveries, host status, and all three canary alarms. The backend stack also defines `lendloop-prod-host-auto-recover`, which uses EC2 system status failures over two one-minute periods to request recovery; it does not depend on SNS.

## Alert delivery and triage

All operational alarm actions target SNS topic `lendloop-prod-alerts`, exposed as `AlertsTopicArn`. The stack creates **no subscription**. Configure a monitored destination and complete any endpoint confirmation before assuming an alarm reaches an operator. CloudWatch's alarm state alone does not prove notification delivery.

1. Check the composite alarm and individual failing signal on `LendLoop-Prod`.
2. For missing heartbeat, inspect EC2 status, SSM availability, metrics timer/service, Convex health and access to Secrets Manager/CloudWatch.
3. For notification failures, correlate the timestamp with Admin automation health, n8n execution history and service logs. Follow the [runbook](runbook.md) before retrying.
4. For web failures, inspect the Amplify build and runtime logs, DNS and Clerk configuration. For landing-only canary failures, check whether public listings exist.
5. For disk pressure, inspect volume usage before deleting anything. Convex/n8n volumes are persistent application data, not disposable container caches.

SES bounce/complaint monitoring is deferred and is not implemented by this stack. Do not confuse the SNS infrastructure alarm topic with SES delivery-event monitoring.
