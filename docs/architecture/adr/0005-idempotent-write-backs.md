# 0005. Idempotency keys for write-backs; n8n de-duplication is best effort

**Context.** Webhook delivery is at-least-once, n8n nodes retry, and the daily workflow can be re-run. Retries must not create duplicate records or reminders.

**Decision.** Every write-back carries a deterministic key: `notify:<deliveryId>`, `overdue:<loanId>:<date>`, `error:<executionId>`. `automation.recordEvent` upserts by key and upgrades `failed` to `sent`. The overdue endpoint skips loans already reminded today. n8n also remembers handled `deliveryId`s in workflow static data.

**Consequences.** Records and reminders are idempotent. n8n saves static data only when an execution ends, so a redelivery arriving *during* the first run can send a second email. Convex retries only after ≥ 30 s, so this is rare. The fix is an atomic "claim" in Convex before sending (README production notes).
