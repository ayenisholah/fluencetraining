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
2. SMTP failures retry three times and are written back as `failed`; re-run the workflow after fixing.
3. Signature failures: compare `N8N_TO_LENDLOOP_SECRET` in n8n and Convex.

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
