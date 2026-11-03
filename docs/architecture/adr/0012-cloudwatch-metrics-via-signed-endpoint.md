# 0012. CloudWatch metrics from a signed localhost endpoint and a host poller

**Context.** The signals that matter are in Convex's data:
- failed or stuck webhook deliveries;
- workflow errors;
- overdue loans that weren't reminded.

Getting them into CloudWatch from inside Convex would mean AWS credentials and the AWS SDK in Convex actions. It would also couple the app to AWS.

**Decision.**
- **The endpoint:** Convex exposes `POST /ops/metrics` (`convex/ops.ts`), which returns **counts only**: no IDs, names or email addresses. It is signed with its own `OPS_METRICS_SECRET`, so n8n's credential can't read it.
- **Not public:** Caddy returns 404 for `/ops/*` from the internet. Only the host calls the endpoint, on `127.0.0.1:3211`.
- **The poller:** a systemd timer (`deploy/ec2/metrics.sh`, every 5 minutes) signs the request and publishes the counts plus a `Heartbeat` to the `LendLoop` namespace. It uses the instance role, which may call `PutMetricData` only for that namespace.
- **Other signals:**
  - container logs go to CloudWatch Logs through Docker's awslogs driver, with metric filters for errors, rejected signatures and 5xx responses;
  - three Synthetics canaries probe the app, the n8n webhook (it must still refuse unsigned calls with a 401) and Convex;
  - alarms feed a composite "unhealthy" alarm and an SNS topic.

**Consequences.**
- **No AWS dependency in app code.** The same endpoint would feed any other monitoring system.
- **A missing `Heartbeat` is treated as breaching,** so a dead poller or a dead Convex alarms rather than going quiet.
- **Metrics are at most 5 minutes stale,** which is fine for these signals.
