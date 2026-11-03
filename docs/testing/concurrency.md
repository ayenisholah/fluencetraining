# Lending concurrency and race conditions

A request is not a reservation. Ten different neighbours may request the same
available tool; the lender chooses whom to approve. Only one approved loan may
exist for a tool, even when the requested dates differ. Other requests remain
pending. There is no first-come-first-served or fairness guarantee.

## Transaction boundaries and limits of the evidence

Each public Convex mutation performs authorization, reads the relevant state,
and writes its transition in one transaction. Convex uses serializable isolation
and optimistic concurrency control; conflicting transactions are retried against
current state. An exhausted infrastructure retry is an error, not a second
successful loan. See [Convex transactions](https://docs.convex.dev/functions/mutation-functions)
and [database guarantees](https://docs.convex.dev/understanding/overview).

Approval checks for any approved loan through `by_tool_status` before writing
both the loan and tool. Duplicate requests check the current borrower's open
requests using `by_tool_borrower_status`, an exact tool/borrower/status range. Rate limits read the actor's recent rows in the same mutation as the
insert. Removal declines pending requests; admin removal may leave an approved
loan active. Return only restores availability when the tool is still on loan,
so it cannot resurrect a removed listing.

The outbox entry and its state transition commit together. Tests count **outbox
entries**, not emails or delivery attempts. A later cancellation and new request
is a new valid operation, not a duplicate of the original submission.

## Scenario matrix

| Competing operations | Permitted outcome | Evidence |
|---|---|---|
| Ten distinct borrowers request one available tool | Ten pending loans, ten request events | Real backend, three fresh runs |
| Ten submissions by the same borrower | One pending loan and one request event; nine useful refusals | Real backend, three fresh runs; browser tabs |
| Ten competing approvals | One approved loan/event; nine pending requests | Real backend, three fresh runs; two lender tabs |
| Approve versus approve/cancel/decline | One decision wins; the other is rejected | Both serial orders in Vitest; concurrent real calls; stale cancellation dialog |
| Repeated return | One return and event; later attempts rejected | Real backend and Vitest |
| Request versus removal | Either rejection before creation, or request then decline; no pending loan on the removed tool | Both orders and real contention |
| Approval versus admin removal | Removal first declines the request; approval first leaves an active, returnable loan on a removed tool | Both orders and real contention |
| Return versus removal | Returned loan and removed listing in either order | Both orders and real contention |
| Overlapping bulk removals | Each unique listing removed once; shared IDs skipped; one decline event per open request | Real backend and existing bulk-removal tests |
| Creation near hourly limits | At most 10 listings / 20 requests per actor in the window | Real backend, ten competing calls with two remaining slots |
| UI submits twice before React rerenders | One submission while pending; refusal allows a later retry | BorrowForm component tests |
| Removal while another browser has a borrow form open | Live update removes the unavailable form; no request created | Browser test |

Every real-backend scenario also checks relevant tool availability, loan phases,
unique transition events, and final persisted state. Order-sensitive tests accept
all valid outcomes and never assume a particular actor wins. Unexpected errors
(including infrastructure contention errors) fail the suite rather than being
counted as expected business refusals.

## Confirmed issues found and fixed

- **False contention between different borrowers:** the original duplicate check
  read all pending loans for a tool and filtered the borrower afterwards. Real
  ten-client tests reproduced exhausted Convex OCC retries (only eight or nine
  requests succeeded). The borrower-specific index narrows the transaction read
  range. We keep the ten-success assertion rather than adding harness retries or
  accepting those failures. Same-borrower duplicates still share the same range.
- **Duplicate form submission before render:** two immediate submit events called
  the request handler twice. A synchronous ref guard prevents the second call
  until the first completes, including failure/retry paths.

## Test layers

- `convex/concurrency.test.ts`: deterministic state-machine orderings and fixture
  isolation, complementing existing authorization, workflow, and bulk-removal tests.
  The installed `convex-test` locks top-level transactions. `Promise.all` inside
  those tests would **not** exercise the real backend's conflict detection.
- `e2e/concurrency-backend.spec.ts`: Playwright as a Node test runner, using
  independent Convex HTTP clients and a shared start gate. Separate clients avoid
  the SDK's per-client mutation queue. This is bounded contention testing, not a
  throughput benchmark or proof of every possible scheduling interleaving.
- `e2e/concurrency-ui.spec.ts`: real Clerk sessions in separate browser contexts,
  with additional tabs for the same actor. Exercises refusals and reactive views;
  authenticated queries independently verify the persisted loans.
- `components/BorrowForm.test.tsx`: rapid submission and retry presentation. Testing
  revealed that two submit events before the pending render invoked the handler
  twice. A synchronous ref guard now blocks the second invocation; backend guards
  remain authoritative across tabs and users.

## Running locally

Use the existing local Convex deployment and app. The browser suite also needs
Clerk development keys and the usual local stack. No production load is generated.

```bash
npm run test:convex
npm run test:ui -- components/BorrowForm.test.tsx
npm run test:concurrency
npm run test:concurrency:ui
```

The backend harness requires `CONVEX_SELF_HOSTED_URL` (or
`NEXT_PUBLIC_CONVEX_URL`) and `CONVEX_SELF_HOSTED_ADMIN_KEY` from `.env.local`.
It refuses non-loopback hosts before sending credentials. Operator-only internal
fixtures create twelve isolated users (owner, admin, ten borrowers) and uniquely
prefixed tools. Public mutations are called with distinct impersonated identities;
this tests their authorization rules, **not Clerk JWT validation**. Browser tests
cover real Clerk authentication separately. No public test endpoints, rate-limit
exceptions or application-wide locks are introduced. The additive
`by_tool_borrower_status` index is deployed with the functions and indexes existing
rows automatically; no data backfill or new document fields are required.

Credentials stay in Node or the signed-in browser and are never printed. Tracing
is disabled for these projects to avoid capturing operator headers or JWT-returning
browser evaluations. Playwright still reports assertions and scenario names.
Synthetic backend users have no email address, so their outbox processing cannot
send emails. The suite does not require successful n8n delivery.

Backend cleanup runs in `finally`, deletes only that UUID's tools, loans, outbox
entries, automation records, and synthetic users, and verifies the scoped snapshot
is empty. There is an explicit test for cleanup after a scenario throws. Browser
cleanup uses the exact run's tool names; Clerk test accounts are reused and kept
separate from the other end-to-end suites. No sample listings are removed.
If a process is forcibly killed, normal finalizers cannot run: use the run UUID
from the `E2E race <UUID>` fixture name with the operator command below:

```bash
npx convex run concurrencyFixtures:cleanup '{"runId":"<UUID>"}'
```

## What is intentionally outside this work

Network requests and user actions can overlap; saying they have "no chance" of
racing would be misleading. Tests protect realistic application invariants while
relying on Convex's documented transaction guarantees. They do not reimplement a
database scheduler, inject arbitrary pauses into production mutations, or claim
that client-side disabled buttons are sufficient protection.

External notification delivery is a separate boundary. n8n static-data
deduplication is best effort when executions overlap, so duplicate emails remain
possible despite unique outbox records and idempotent write-backs. See
[ADR 0005](../architecture/adr/0005-idempotent-write-backs.md). Atomic notification
claims, overlapping reminder tests, and exactly-once email delivery are not part
of this lending/admin work.
