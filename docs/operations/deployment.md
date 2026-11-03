# Deployment

## Environments

| Environment | App | Convex | n8n | Email |
|---|---|---|---|---|
| Local | `npm run dev` | self-hosted (Docker) | self-hosted (Docker) | Mailpit |
| Production (proposed) | Vercel | Convex cloud | n8n Cloud or queue-mode self-hosted behind TLS | Transactional provider with SPF/DKIM |

Local setup is in the [README](../../README.md#local-setup): `npm run setup` creates `.env`, starts Docker, deploys Convex, sets its env, runs the search backfill and imports the n8n workflows.

## Configuration per environment

Full variable list: [README › Environment variables](../../README.md#environment-variables). Where each one lives:

| Where | Variables |
|---|---|
| Next.js host (Vercel env) | `NEXT_PUBLIC_CONVEX_URL`, `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`, `CLERK_SECRET_KEY`, `NEXT_PUBLIC_SITE_URL`, optional `NEXT_PUBLIC_PLAUSIBLE_*`, `ENFORCE_HTTPS` (only behind a non-Vercel TLS proxy) |
| Convex deployment env | `CLERK_JWT_ISSUER_DOMAIN`, `N8N_WEBHOOK_URL`, `LENDLOOP_TO_N8N_SECRET`, `N8N_TO_LENDLOOP_SECRET`, `LENDLOOP_APP_URL` (links and logo in emails) |
| n8n (credentials / env) | `LENDLOOP_TO_N8N_SECRET`, `N8N_TO_LENDLOOP_SECRET`, `LENDLOOP_CONVEX_SITE_URL`, `LENDLOOP_APP_URL`, `LENDLOOP_OPS_EMAIL`, the SMTP credential |

Secrets are generated per environment (`openssl rand -hex 32`) and never shared between them.

## Deploy steps (production)
1. **Convex:** `npx convex deploy` (functions, schema, crons), then `npx convex run migrations:backfillSearch` if the schema gained derived fields.
2. **n8n:** import `n8n/workflows/*.json` and the SMTP credential, set env and credentials, publish the three workflows, and confirm the error workflow is linked.
3. **Next.js:** deploy through the Vercel Git integration; check that the build passes `check:bundle`.
4. **Clerk:** production instance with the Convex JWT template, allowed origins and redirect URLs (`/tools` after sign-in).
5. **Smoke test:** sign in, list a tool with a photo, request it from a second account, see the email and "Notification sent", check Admin › Automation health is clear.

## Rollback
- **Next.js:** promote the previous Vercel deployment.
- **Convex:** redeploy the previous commit. Schema changes are additive (new fields optional), so a rollback leaves extra fields unused.
- **n8n:** re-import the previous workflow JSON from git and publish.
- **Data:** Convex cloud backups or point-in-time restore. Locally, the `convex-data` Docker volume.
