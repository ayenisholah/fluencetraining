# 0004. HMAC signing both ways, one secret per direction

**Context.** Convex calls an n8n webhook and n8n calls Convex HTTP endpoints. Both are reachable over the network.

**Decision.** HMAC-SHA256 over `"<timestamp>.<raw body>"`, sent as `x-lendloop-timestamp` and `x-lendloop-signature: sha256=<hex>`. The receiver recomputes over the raw bytes, compares in constant time, and rejects timestamps more than 5 minutes off (or non-numeric). There are two secrets: `LENDLOOP_TO_N8N_SECRET` and `N8N_TO_LENDLOOP_SECRET`.

**Consequences.** A leaked n8n credential can't forge events *to* n8n, and vice versa. Replays are limited to 5 minutes and harmless thanks to idempotency. Rotation without downtime needs two active keys (production to-do).
