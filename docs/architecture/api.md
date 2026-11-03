# API reference

All Convex functions live in `convex/`. The guard column matches the coverage guard in [`convex/access.test.ts`](../../convex/access.test.ts): a new public function fails CI until it's listed there.

Numbered list queries take `pageNumber` (from 1) and `pageSize` (10, 25, 50 or 100) and return `{ page, pageNumber, pageSize, totalCount, totalPages }` (`convex/lib/pagination.ts`). `search` is optional free text, trimmed and capped at 100 characters (`convex/lib/search.ts`).

## Public functions

| Function | Kind | Guard | Arguments | Returns |
|---|---|---|---|---|
| `tools.listPublic` | query | anyone | page, `search?`, `category?` | available tools: `{ _id, name, category }` only |
| `tools.list` | query | signed in | page, `search?`, `category?`, `availableOnly?` | listed tools with condition, description, status, `imageUrl`, `isMine`, lender first name, `trustedLender` |
| `tools.mine` | query | signed in (own rows) | page, `search?`, `status?` | the caller's listed tools with `imageUrl` |
| `tools.create` | mutation | signed in | name, category, condition, description, `imageId?` | new tool id (rate-limited) |
| `tools.update` | mutation | owner | toolId, fields, `imageId?`, `removeImage?` | — |
| `tools.remove` | mutation | owner | toolId | — (refused while on loan) |
| `tools.generateUploadUrl` | mutation | signed in | — | short-lived upload URL (shares the listing rate limit) |
| `loans.request` | mutation | signed in | toolId, startDate, endDate | loan id (rate-limited) |
| `loans.approve` / `decline` / `markReturned` | mutation | lender | loanId | — |
| `loans.cancel` | mutation | borrower | loanId | — |
| `loans.myRequests` / `incoming` | query | signed in (own rows) | page, `search?`, `phase?` | loan views with counterpart first name and latest 5 activity items |
| `loans.pendingIncomingCount` | query | signed in | — | open incoming requests (capped at 100) |
| `users.store` | mutation | anyone (no-op signed out) | — | user id; never sets a role |
| `users.me` | query | anyone | — | `{ _id, name, role, trustedLender }` or null |
| `admin.allLoans` | query | admin | page, `search?`, `phase?` | loan views with both parties' full names |
| `admin.users` | query | admin | page, `search?`, `filter?` (`admins`/`trusted`) | members with email, role, trusted |
| `admin.listings` | query | admin | page, `search?`, `category?` | live listings with owner name and `imageUrl` |
| `admin.stats`, `admin.automationHealth` | query | admin | — | headline counts; failed/pending deliveries and workflow errors |
| `admin.setTrustedLender` | mutation | admin | userId, trusted | — |
| `admin.removeListing` | mutation | admin | toolId | — (allowed while on loan) |
| `admin.retryDelivery` | mutation | admin | deliveryId | — |

Errors are `ConvexError({ code, message })` with codes `UNAUTHENTICATED`, `FORBIDDEN`, `NOT_FOUND`, `BAD_REQUEST`, `RATE_LIMITED`; the UI shows `message`.

## Internal functions (CLI or scheduler only)

| Function | Use |
|---|---|
| `users.setRole` | `npx convex run users:setRole '{"email":"…","role":"admin"}'` |
| `migrations.backfillSearch` | Fill derived fields on old rows; idempotent, self-rescheduling |
| `images.deleteOrphans` | Daily cron: delete unattached uploads older than 24 h |
| `dev.seedNeighbourhood` / `dev.purgeTestData` / `dev.backdateLoan` | Sample data, e2e clean-up, overdue testing |
| `concurrencyFixtures.setup` / `inspect` / `cleanup` | UUID-scoped operator fixtures for the [local concurrency suite](../testing/concurrency.md); never callable by browser clients |
| `webhooks.*`, `automation.*` | Outbox delivery and n8n endpoint internals |

## HTTP endpoints (n8n → Convex)

Both are `POST`, take a JSON object, and require:

```
x-lendloop-timestamp: <ms since epoch>
x-lendloop-signature: sha256=<hex HMAC-SHA256 of "<timestamp>.<raw body>" with N8N_TO_LENDLOOP_SECRET>
```

Responses: `401` bad or stale signature (±5 min), `413` body over 16 KB, `400` not a JSON object or invalid event, `422` unknown loan, `503` secret not configured.

| Path | Body | Response |
|---|---|---|
| `/n8n/overdue-loans` | any (e.g. `{"request":"overdue-loans"}`) | `{ asOf, loans: [{ loanId, idempotencyKey, toolName, endDate, daysOverdue, borrower: { email, firstName }, lender: { firstName }, email: { subject, html, text } }] }`, excluding loans reminded today |
| `/n8n/automation-events` | `{ idempotencyKey, loanId?, kind, status: "sent"\|"failed", detail? }` | `{ ok: true, duplicate }`; a repeat key is a no-op, `failed` → `sent` upgrades |

## Webhook (Convex → n8n)

`POST N8N_WEBHOOK_URL`, signed the same way with `LENDLOOP_TO_N8N_SECRET`, plus `x-lendloop-delivery: <deliveryId>`:

```json
{
  "deliveryId": "…",
  "event": "loan.requested",
  "occurredAt": "2026-11-03T10:00:00.000Z",
  "loan": { "id": "…", "status": "requested", "startDate": "2026-11-04", "endDate": "2026-11-06" },
  "tool": { "name": "Ladder", "category": "hand_tools" },
  "recipient": { "role": "lender", "email": "olu@example.com", "firstName": "Olu" },
  "otherParty": { "firstName": "Remi" },
  "email": { "subject": "Remi wants to borrow your Ladder", "html": "<!DOCTYPE html>…", "text": "Hi Olu,…" }
}
```

`email` is rendered by `convex/lib/email/loanEmails.ts` from the fields above (no other personal data). n8n's "Check payload" node refuses a payload without it, so a malformed delivery reaches the error workflow.

A `2xx` marks the delivery delivered. `5xx`, `408` and `429` are retried (30 s, 2 m, 8 m, 32 m), then marked failed. Other `4xx` codes fail immediately.
