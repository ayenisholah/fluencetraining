# 0003. Transactional outbox for Convex → n8n webhooks

**Context.** Every loan state change must notify n8n. Calling n8n from the mutation isn't possible (mutations can't do network I/O), and calling from an action after the mutation risks a committed change with no notification, or a notification for a rolled-back change.

**Decision.** Each loan mutation inserts a `webhookDeliveries` row in the same transaction (`enqueueLoanEvent`) and schedules `webhooks.deliver`. The row stores references only; the payload is built at send time. Delivery retries 5xx/408/429 with backoff (30 s → 32 m, 5 attempts), then marks the row failed. Admins see failed rows and can retry.

**Consequences.** No lost or phantom notifications. No personal data sits in the queue. Delivery is at-least-once, so n8n must tolerate duplicates (see 0005).
