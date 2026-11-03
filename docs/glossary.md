# Glossary

| Term | Meaning |
|---|---|
| **Listing / tool** | Something a neighbour offers to lend (`tools` table). |
| **Lender** | The owner of a tool in a loan (`loans.lenderId`). |
| **Borrower** | The person who asked to borrow (`loans.borrowerId`). |
| **Loan / request** | One borrowing of one tool for a date range (`loans`). It starts as a *request*. |
| **Phase** | Coarse loan state for tabs: *open* (requested), *active* (approved), *closed* (declined, cancelled or returned). |
| **Overdue** | An approved loan whose end date has passed. |
| **Trusted Lender** | A badge an admin gives a member; shown on their listings. |
| **Listed** | A tool that isn't removed (available or on loan). |
| **Soft delete** | Removing a listing by setting `status: "removed"` instead of deleting the row. |
| **Preset colour** | One of seven fixed design-system colours (orange, blue, green, pink, emerald, sky, violet); each category maps to one. |
| **Board view** | Cards, Tiles or List layout of All tools. |
| **Guard** | A server-side check at the start of a Convex function (`requireUser`, `requireToolOwner`, `requireLoanParty`, `requireAdmin`). |
| **Coverage guard** | The test that lists every public Convex function with its guard and fails on new, unlisted ones. |
| **Outbox** | `webhookDeliveries`: events written in the same transaction as the change, then delivered to n8n with retries. |
| **Write-back** | n8n reporting a result to Convex (`/n8n/automation-events`). |
| **Idempotency key** | A deterministic id for a write-back (e.g. `overdue:<loan>:<date>`), so retries don't duplicate records. |
| **HMAC** | Keyed hash (SHA-256) used to sign requests between Convex and n8n. |
| **Replay window** | How far a signed request's timestamp may be from now (5 minutes). |
| **Error workflow** | The n8n workflow that runs when another workflow fails: it emails ops and records an error. |
| **CSP / nonce** | Content-Security-Policy; a per-request random value that allows only our own inline scripts. |
| **Derived field** | A field computed from others for indexing (`searchText`, `listed`, `phase`, `toolName`), maintained by helpers and backfilled by a migration. |
| **Seed / purge** | Dev commands that add the sample catalogue and remove `E2E …` test data. |
