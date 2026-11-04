# 0005. Idempotency keys for write-backs; n8n de-duplication is best effort

**Context.** Webhook delivery is at-least-once, n8n nodes retry, and the daily workflow can be re-run. Retries must not create duplicate records or reminders.

**Decision.** Every write-back carries a deterministic key: `notify:<deliveryId>`, `overdue:<loanId>:<date>`, `error:<executionId>`. `automation.recordEvent` upserts by key and upgrades `failed` to `sent`. The overdue endpoint skips loans already reminded today. n8n also remembers handled `deliveryId`s in workflow static data.

**Consequences.** Records are idempotent. Email deduplication is best effort:
- n8n saves static data only when an execution ends, so a redelivery arriving *during* the first run can send a second email. Convex retries only after ≥ 30 s, so this is rare.
- The static-data list keeps the last 1,000 delivery IDs.
- A reminder accepted by SMTP whose write-back then fails is eligible again on a same-day re-run.
- The webhook is acknowledged before the activity write-back, so an exhausted write-back leaves a sent email with no recorded activity. The error workflow makes that visible.

The fix is an atomic "claim" in Convex before sending (README production notes). A claim narrows but can't remove the duplicate window after an ambiguous SMTP failure.
