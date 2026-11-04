# Deployment

## Environments

| Environment | App | Backend / automation | Email |
|---|---|---|---|
| Local tests | Next.js on localhost | Docker Convex + n8n | Mailpit; notification-capable tests require it |
| Local SES integration | Next.js on localhost | Same local stack, explicitly configured | Amazon SES in `eu-north-1` |
| AWS production code | Amplify Hosting SSR | Self-hosted Convex + n8n + Caddy on EC2 | SES (`notifications@sholaayeni.xyz`); see [SES SMTP](ses-smtp.md#production-ec2) |

Start with the [AWS deployment guide](aws-deployment.md) for the full service inventory, account/region, IAM, secrets, DNS, stacks and deployment scripts. Local setup remains in the [README](../../README.md#local-setup).

The application URL is `https://lendloop.sholaayeni.xyz`. AWS infrastructure is declared in `infra/`; host configuration lives in `deploy/ec2/`. Vercel and Convex Cloud are not the current production architecture.

## Configuration per environment

| Location | Configuration |
|---|---|
| Amplify build / SSR | `NEXT_PUBLIC_CONVEX_URL`, production `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`, `NEXT_PUBLIC_SITE_URL`, `CLERK_SECRET_ID`; Clerk secret fetched from Secrets Manager at build time |
| Convex deployment | `CLERK_JWT_ISSUER_DOMAIN`, `N8N_WEBHOOK_URL`, both HMAC keys, `OPS_METRICS_SECRET`, `LENDLOOP_APP_URL` |
| EC2 Compose environment | Generated secrets, region, base domain, app URL and Caddy editor-password hash, written by bootstrap to a root-only file |
| n8n credential store | Encrypted SMTP credentials; tied to that instance's `N8N_ENCRYPTION_KEY` and data volume |
| GitHub production deployment | Repository variables for region/Clerk; AWS deployer credentials in the `production` environment |

**Email:** bootstrap imports the SES credential from Secrets Manager (`lendloop/prod/SES_SMTP_CREDENTIALS`) and renders the workflows for SES on every host refresh; the ops mailbox comes from the `ALERT_EMAIL` variable. See [SES SMTP › Production](ses-smtp.md#production-ec2).

## Deploy steps (production)

Follow the ordered [AWS setup/deploy steps](aws-deployment.md#deploy-steps-production). For a release:

1. Review CI and the CDK diff, especially host replacements, secrets and persistent storage.
2. Deploy CDK, configure Convex functions/environment/backfill, then refresh the host. Resolve the bootstrap email gap before relying on production notification delivery.
3. Check Amplify's build for the intended `main` commit separately; auto-build runs independently of GitHub deployment approval.
4. Confirm app, Convex and n8n HTTPS endpoints and the production Clerk instance. Inspect [CloudWatch monitoring](observability.md).
5. With controlled accounts, sign in, list a tool with a photo, request it from a second account, and verify the intended recipient's notification and Convex activity. Real email tests require valid recipient access for the SES account's current state.
6. Check Admin automation health for fresh errors, the host metrics heartbeat, and recent AWS Backup recovery points. Historical errors remain visible after recovery.

## Rollback

Use a reviewed revert on `main` for the frontend. Redeploy compatible previous Convex functions and workflows only after reviewing schema and SMTP-provider implications. Restore persistent data from AWS Backup rather than clearing volumes. See [AWS recovery details](aws-deployment.md#rollback-and-recovery).
