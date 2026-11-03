# LendLoop: requirements

LendLoop is a neighbourhood tool-lending board with automated workflows. Neighbours list tools they're willing to lend and ask to borrow from each other. Notifications and reminders are handled by n8n.

This file restates the take-home brief as numbered requirements and traces each one to the code that implements it and the tests that check it. Setup, architecture and the reasoning behind decisions are in the [README](../README.md).

**Stack:** Next.js (App Router), Clerk (auth), Convex (data and backend logic), n8n (self-hosted with Docker), TypeScript.

**Status key:** ✅ done and tested · 🟡 done, with a known limitation (see [Known limitations](#known-limitations))

---

## 1. Public page

| ID | Requirement | Status |
|---|---|---|
| P1 | The fictional company name is **LendLoop**. | ✅ |
| P2 | A short tagline: "Borrow what you need. Lend what you don't." | ✅ |
| P3 | A read-only list of **available** tools, pulled from Convex. | ✅ |
| P4 | The list shows **name and category only**, with no owner details. | ✅ |
| P5 | A **"Sign in to lend or borrow"** button wired to Clerk. | ✅ |

| ID | Implementation | Tests |
|---|---|---|
| P1–P2 | `components/screens/Home.tsx`, `components/shell/Logo.tsx`, metadata in `app/(site)/page.tsx` | `components/screens/Home.test.tsx`, `e2e/public.spec.ts` |
| P3–P4 | `tools.listPublic` in `convex/tools.ts`. It needs no auth, returns only `status = "available"`, and projects each tool to `{ _id, name, category }` **on the server**. | `convex/public.test.ts`: the exact field set; no owner name, email, id, condition or description; on-loan and removed tools excluded. `e2e/signed-in.spec.ts` checks the landing page with real data. |
| P5 | `<SignInButton mode="modal">` inside `<Unauthenticated>` in `components/screens/Home.tsx`. Signed-in visitors get "Browse tools" instead. | `components/screens/Home.test.tsx`, `e2e/public.spec.ts` (the Clerk modal opens) |

## 2. Authenticated experience

Only signed-in users can do the following.

| ID | Requirement | Status |
|---|---|---|
| A1 | List a tool with **name**, **category** (power tools, garden, kitchen, camping, …), **condition** and a **short description**. | ✅ |
| A2 | Request to borrow a tool for a **date range**. | ✅ |
| A3 | **Approve or decline** requests on their own tools. | ✅ |
| A4 | **Mark a loan as returned.** | ✅ |
| A5 | Show **all tools with availability status**, filterable by **category**. | ✅ |
| A6 | **My listings**, **My requests** and **Incoming requests** views. | ✅ |
| A7 | A nice, minimal layout. | ✅ |

| ID | Implementation | Tests |
|---|---|---|
| Signed-in gate | `requireUser` (`convex/lib/auth.ts`) in every non-public function. `proxy.ts` redirects signed-out visitors away from app routes. | `convex/workflow.test.ts`, `convex/access.test.ts`, `e2e/public.spec.ts` (every app route redirects) |
| A1 | `tools.create` and `tools.update` with the `vCategory`/`vCondition` validators and `toolFieldErrors` (`convex/lib/rules.ts`), the same rules the form uses. Rate-limited. | `convex/workflow.test.ts`, `components/ToolForm.test.tsx`, `components/screens/Listings.test.tsx`, `e2e/signed-in.spec.ts` |
| A2 | `loans.request`: you can't borrow your own tool; loans run up to 30 days with no past dates; no overlap with an active loan; one open request per tool. The UI is `BorrowForm` with a date picker. | `convex/workflow.test.ts`, `convex/rbac.test.ts`, `components/BorrowForm.test.tsx`, `e2e/signed-in.spec.ts` |
| A3 | `loans.approve` and `loans.decline` are lender-only. Approving marks the tool on loan. A request whose dates have passed can't be approved. | `convex/workflow.test.ts`, `components/LoanList.test.tsx`, `e2e/signed-in.spec.ts` |
| A4 | `loans.markReturned` is lender-only and makes the tool available again. | as A3 |
| A5 | `tools.list` with the `by_category_status` index; the Select filter and status badges are in `components/screens/Tools.tsx`. | `convex/workflow.test.ts`, `components/screens/Tools.test.tsx`, `e2e/signed-in.spec.ts` |
| A6 | `tools.mine`, `loans.myRequests` and `loans.incoming` on `/listings`, `/requests` and `/incoming`. Each is scoped to the caller. | `convex/workflow.test.ts`, `convex/access.test.ts`, `e2e/signed-in.spec.ts` |
| A7 | The design system in `components/ui` (documented in Storybook), the sidebar `AppShell` and a phone menu. | axe checks in UI tests and e2e (light and dark), plus a no-horizontal-scroll check on phone width |

## 3. Roles and rules

Role-based access control (RBAC) is enforced **in Convex functions**, not only in the UI.

| ID | Requirement | Status |
|---|---|---|
| R1 | **admin** can remove **any** listing. | ✅ |
| R2 | **admin** can view **all loans**. | ✅ |
| R3 | **admin** can mark a lender as **Trusted Lender**. | ✅ |
| R4 | **user** can create, edit and delete **only their own** listings. | ✅ |
| R5 | **user** can act only on requests that involve **their own tools** (as lender) or **their own borrowing** (as borrower). | ✅ |
| R6 | Best practices: the server enforces the rules and roles can't be escalated. | ✅ |

| ID | Implementation | Tests |
|---|---|---|
| R1 | `admin.removeListing` uses `requireAdmin`. It can remove a listing even while it's on loan; the loan stays open so the lender can still close it. | `convex/access.test.ts`, `components/screens/Admin.test.tsx`, `e2e/admin.spec.ts` |
| R2 | `admin.allLoans` is paginated, with lender and borrower names. | as R1 |
| R3 | `admin.setTrustedLender`; the badge shows on that lender's listings. | as R1 |
| R4 | `requireToolOwner` on `tools.update` and `tools.remove`. `ownerId` and `status` are set on the server, and validators reject extra fields. | `convex/access.test.ts` (every wrong caller is denied, including an admin trying to *edit*) |
| R5 | `requireLoanParty(…, "lender")` on approve, decline and mark returned; `requireLoanParty(…, "borrower")` on cancel. | `convex/access.test.ts` (matrix across signed-out, other user, owner, borrower and admin) |
| R6 | Identity comes only from `ctx.auth` `tokenIdentifier`. New users are always `role: "user"`. `users.setRole` is an `internalMutation` (operator CLI only). Errors use typed `ConvexError` codes. | `convex/access.test.ts`: a **coverage guard** lists every public function with its guard, so a new unguarded function fails CI. It also covers escalation attempts. |

## 4. Automation with n8n

At least two workflows.

| ID | Requirement | Status |
|---|---|---|
| N1 | **Request notification:** when a borrow request is created or changes status, Convex calls an n8n Webhook. | ✅ |
| N2 | The workflow notifies **the relevant user** (email, Slack, Discord or a logged mock), using **only the fields it needs**. | ✅ |
| N3 | **Overdue reminders:** a scheduled workflow runs **daily** and fetches overdue loans from a **Convex HTTP endpoint**. | ✅ |
| N4 | It sends a reminder to **each borrower** and **writes the reminder status back** to Convex. | ✅ |

| ID | Implementation | Tests |
|---|---|---|
| N1 | Every loan mutation calls `enqueueLoanEvent` (`convex/lib/outbox.ts`). This is a transactional outbox: the event is stored in the same transaction as the state change. `webhooks.deliver` then POSTs to `N8N_WEBHOOK_URL`. Workflow: `n8n/workflows/01-request-notifications.json`. | `convex/automation.test.ts`, `n8n/roundtrip.test.ts`, `e2e/automation.spec.ts` |
| N2 | `webhooks.buildPayload` sends the recipient's role, email and first name, the other party's first name, the tool name, the loan id, status and dates, and nothing else. Requested/cancelled go to the lender; approved/declined/returned go to the borrower. Delivered as email through Mailpit SMTP. | `convex/automation.test.ts` (the exact key set for all 5 events), `n8n/workflows.test.ts` ("Compose message"), `e2e/automation.spec.ts` (real emails, no extra personal data) |
| N3 | `n8n/workflows/02-overdue-reminders.json` runs on a schedule at 08:00 UTC and makes a signed `POST /n8n/overdue-loans` (`convex/http.ts` → `automation.overdueLoans`). The server decides what "today" is. | `convex/automation.test.ts`, `n8n/workflows.test.ts`, `e2e/automation.spec.ts` |
| N4 | One email per loan, then a signed `POST /n8n/automation-events` recording `sent` or `failed`. | `n8n/roundtrip.test.ts`, `e2e/automation.spec.ts` (the email arrives and "Reminder sent" shows on the loan) |

### Securing the integration

| ID | Requirement | Status |
|---|---|---|
| S1 | **Sign** webhook payloads (HMAC with a shared secret) and **verify** them on the receiving side, **in both directions**. | ✅ |
| S2 | Keep secrets in **environment variables and n8n credentials**, never in code or the exported workflow JSON. | ✅ |
| S3 | Make write-backs **idempotent** so retries don't create duplicate records or reminders. | 🟡 |
| S4 | Handle failures with **retries** and an **error workflow** so failed runs are visible and never fail silently. | ✅ |

| ID | Implementation | Tests |
|---|---|---|
| S1 | `convex/lib/hmac.ts` signs `sha256` over `${timestamp}.${rawBody}`, allows ±5 minutes and compares in constant time. n8n's "Verify signature" node checks the **raw** body with `crypto.timingSafeEqual` and rejects stale or non-numeric timestamps. Convex's endpoints have a body size limit and return 503 if the secret isn't configured. | `convex/hmac.test.ts`, `convex/automation.test.ts`, `n8n/workflows.test.ts`, `n8n/roundtrip.test.ts` (each side accepts the other's signatures), `e2e/automation.spec.ts` (unsigned, wrong and replayed calls get 401 both ways) |
| S2 | Secrets come from `.env`, then docker-compose env, then `$env` in n8n Code nodes, and from Convex env vars. The SMTP credential file has an empty password. `scripts/n8n-export.sh` refuses to export if a secret value is found. | `n8n/workflows.test.ts` (no secrets or key material in the JSON; credentials referenced by id only) |
| S3 | `automation.recordEvent` is keyed by `idempotencyKey` (`notify:<deliveryId>`, `overdue:<loanId>:<date>`); a later success upgrades a failed row. `overdueLoans` skips loans already reminded today. n8n de-duplicates on `deliveryId`. | `convex/automation.test.ts`, `n8n/roundtrip.test.ts`, `e2e/automation.spec.ts` (re-running sends nothing new; a redelivery is acknowledged but not re-sent) |
| S4 | **Convex:** outbox retries with exponential backoff (5 attempts) for 5xx, 408 and 429 only, then marks the delivery `failed`, visible in Admin with a Retry button. **n8n:** `retryOnFail` on every HTTP and email node; `errorWorkflow` routes failures to `n8n/workflows/03-error-handler.json`, which emails ops and records a `workflow_error` shown in Admin. The reminder run fails on purpose if any reminder failed. | `convex/automation.test.ts`, `n8n/workflows.test.ts`, `e2e/automation.spec.ts` (a broken run sends the ops email and shows in Admin) |

### Bonus

| ID | Requirement | Status |
|---|---|---|
| B1 | Show recent automation activity on each loan, e.g. "Reminder sent 2 days ago". | ✅ |

`describeLoan` (`convex/loans.ts`) attaches the latest 5 `automationEvents`, and `LoanCard` shows the newest. Tested in `components/LoanCard.test.tsx`, `convex/automation.test.ts` and `e2e/automation.spec.ts`.

## 5. Deliverables

| ID | Deliverable | Where |
|---|---|---|
| D1 | GitHub repository with the app source code | this repository |
| D2 | Exported n8n workflow JSON files | `n8n/workflows/` (plus `n8n/credentials/`, which holds no secrets) |
| D3 | README: local setup (including n8n and docker-compose), environment variables, architecture, security and data-minimisation decisions | `README.md`, `docker-compose.yml`, `.env.example`, `.env.local.example` |
| D4 | A short note on what to change for production | `README.md` › "What I would change for production" |

## 6. Evaluation criteria

| Criterion | Where to look |
|---|---|
| Code structure and clarity | `convex/` split by domain (`tools`, `loans`, `admin`, `users`, `http`, `webhooks`, `automation`) with shared guards in `convex/lib/`. UI is split into `components/ui` (design system), `components/screens` and `components/shell`. Validation rules are shared between client and server (`convex/lib/rules.ts`). |
| Security-minded thinking | §3 and §4 above; README › "Security and data-minimisation decisions" |
| UX and practicality | Inline validation, confirmation before destructive actions without browser dialogs, empty and loading states, light/dark themes, a phone layout, and axe checks throughout |
| Integration design, reliability and error handling | Transactional outbox, signed both ways, idempotency keys, backoff with a visible failed state, error workflow, and contract tests that run the real n8n Code nodes against the real Convex functions |
| Documentation and reasoning | `README.md`, this file, and comments at each decision point in the code |

## Running the checks

```bash
npm test               # Convex, UI and n8n unit tests
npm run typecheck
npm run test:e2e:public                                  # no stack needed
npx playwright test                                      # all, including signed-in, admin and automation (needs docker compose + Clerk dev keys)
```

## Known limitations

- **S3: a redelivery during a run can double-send.** n8n saves its record of handled `deliveryId`s only when a run finishes, but it acknowledges Convex partway through. A redelivery that arrives *during* the first run is therefore not recognised. Convex retries only after a backoff of 30 seconds or more, so in practice this needs an unusually slow SMTP step. The fix is for n8n to claim the delivery in Convex (an atomic mutation) before sending.
- A borrower with no email on file is skipped from reminders without a record.
- A failed request notification is recorded as a `workflow_error` with no loan id, so it appears in Admin but not on the loan itself.
- Trusted-lender changes aren't audit-logged. Listing removals are, through `removedBy`.

## Concurrency regression coverage

A2 (requests), A3 (lender decisions), A4 (returns), and admin removal are additionally covered by
the [concurrency scenario matrix](testing/concurrency.md): deterministic operation
orderings, independent real-backend clients, and stale-browser end-to-end checks.
Multiple pending requests are allowed; only one active approval is permitted.
