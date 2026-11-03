# Runbook

Commands assume the repo root with `.env.local` pointing at the target Convex deployment. Locally, Docker commands need the engine that runs the stack (`DOCKER_CONTEXT=default` if Docker Desktop isn't the one).

## Failed webhook deliveries
**Symptom:** Admin › Automation health lists `failed` deliveries; users didn't get emails.
1. Read `lastError`. A `401` means the secrets don't match (Convex `LENDLOOP_TO_N8N_SECRET` vs n8n). A `5xx` or timeout means n8n is down or slow. "not set" means Convex env is missing `N8N_WEBHOOK_URL` or the secret.
2. Fix the cause, then click **Retry** on each row (`admin.retryDelivery`).
3. Check the email in Mailpit (`http://localhost:8025`) or the provider's log.

## n8n workflow error
**Symptom:** an "[LendLoop] Automation failed" email to ops, or an "n8n error" row in Automation health.
1. Open the execution URL from the email in n8n and find the failing node.
2. SMTP failures retry three times inside n8n. The error handler records a separate `workflow_error` in Convex even when its ops email also fails. For loan notifications, Convex retries a pending webhook after 30 seconds, then 2, 8 and 32 minutes (five attempts total). Restore SMTP and allow a pending delivery to retry; use Admin **Retry** only if it has reached `failed`.
3. A workflow error is historical: it remains visible after recovery. Check its timestamp against newer successful executions and the loan's “Notification sent” activity. Do not delete old errors to make the panel appear healthy.
4. Signature failures: compare `N8N_TO_LENDLOOP_SECRET` in n8n and Convex.

## The overdue reminder didn't run
1. In n8n, check that **LendLoop – Overdue reminders** is published and has a run today (08:00 UTC).
2. Run it by hand: in the n8n editor, **Run now (testing)**. Or use the CLI: `docker compose exec -e N8N_RUNNERS_BROKER_PORT=5699 n8n n8n execute --id LendLoopRemindWf`. The broker port avoids clashing with the running instance.
3. Re-running is safe: loans already reminded today are skipped.

## Rotate an HMAC secret
1. Generate a new value: `openssl rand -hex 32`.
2. Set it in Convex (`npx convex env set LENDLOOP_TO_N8N_SECRET …` or `N8N_TO_LENDLOOP_SECRET …`) **and** in n8n's env or credentials, then restart n8n.
3. Requests in flight during the switch fail with 401 and are retried by the outbox. Retry any rows that end up failed. Zero-downtime rotation (two active keys) is a production to-do.

## Promote or demote an admin
The person signs in once, then: `npx convex run users:setRole '{"email":"person@example.com","role":"admin"}'` (or `"user"`).

## Clean up test data
- After an interrupted e2e run: `npx convex run dev:purgeTestData '{"prefix":"E2E "}'`. It only ever touches tools named `E2E …`.
- Refill the sample catalogue: `npx convex run dev:seedNeighbourhood` (idempotent).

## After a schema change adds derived fields
`npx convex run migrations:backfillSearch`. It's idempotent and reschedules itself until done, and returns `{ patched, done }`.

## Orphaned photos
They're deleted nightly by the `delete orphaned tool photos` cron. To run it now: `npx convex run images:deleteOrphans`.

## Restore local data
The local Convex data is in the `convex-data` Docker volume. `docker compose down` keeps it; `docker compose down -v` deletes it.

## Verify local notifications

Run `npm run test:automation` from the repo root. It uses the existing Playwright
Clerk setup, local Convex, published n8n workflows and Mailpit. Configure `.env`
and `.env.local` as described in the README; start the Docker stack and app first.
If the workflows have not been installed, run `npm run n8n:import -- --provider mailpit` once. For SES setup and provider switching, see [SES SMTP](ses-smtp.md).
The test command requires Clerk dev credentials, a local Docker engine and Chrome
(or `PLAYWRIGHT_CHANNEL=""` with Playwright Chromium installed).

This command runs serially and **temporarily stops Mailpit** to verify recovery.
Run it on an idle development stack, without other automation tests running.
It restores Mailpit in `finally`; if the process is killed, restore it manually:
`DOCKER_CONTEXT=default docker compose start mailpit`.
Browser traces are disabled because webhook tests carry signing headers.

The suite verifies request/approval emails, successful Convex activity, webhook
signatures, sequential duplicate delivery, overdue reminders, error reporting,
and automatic delivery after SMTP restoration. It removes its named test listings,
loans and linked events. Mailpit messages and untagged SMTP error history remain
as evidence; an intentional outage can add historical errors to Admin.
To run the existing checks without stopping SMTP:
`npx playwright test e2e/automation.spec.ts --project signed-in --workers=1 --trace off`.

For a manual smoke test:

1. Open Mailpit at <http://localhost:8025> and n8n at <http://localhost:5678>.
2. Sign in as a lender and list a uniquely named tool. In a private window, sign
   in as a different borrower and request that tool.
3. In Mailpit, find that tool's request email addressed to the lender. Check
   “Notification sent” on the loan and the successful notification execution in n8n.
4. Approve as the lender. Find the approval email addressed to the borrower and
   confirm the corresponding activity entry.

For the reported DNS failure, n8n's local SMTP credential must use host `mailpit`,
port `1025`, without TLS/STARTTLS. `localhost` inside n8n points to n8n itself.
Check `DOCKER_CONTEXT=default docker compose ps` and verify DNS from n8n:

```bash
DOCKER_CONTEXT=default docker compose exec -T n8n node -e 'require("node:dns").lookup("mailpit", console.log)'
```

A working DNS lookup alone does not prove delivery. Verify the fresh email and
Convex activity using the smoke test above. A webhook marked `delivered` means
n8n acknowledged it after SMTP; the subsequent activity write-back can still fail.
Local Mailpit captures messages; it does not deliver them to real external inboxes.
