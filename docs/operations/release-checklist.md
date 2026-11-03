# Release checklist

Copy into the release PR and tick each item.

## Code and tests
- [ ] CI green on the release commit: lint, typecheck, `npm test`, contrast, workflow-export check, build, bundle check, link check, Storybook story tests, public Playwright.
- [ ] Signed-in Playwright run against the local Mailpit stack; never bypass the email-provider setup dependency against SES. Public-only CI tests need no n8n/Mailpit service.
- [ ] No new public Convex function without an entry in the coverage guard (`convex/access.test.ts`).

## Data and configuration
- [ ] Schema changes are additive, or have a migration and a backfill plan.
- [ ] `migrations:backfillSearch` run after deploy if derived fields changed.
- [ ] New environment variables added to `.env.example`, the README table and the deployment doc.
- [ ] n8n workflows re-exported with `npm run n8n:export` (no secrets found), and the JSON diff reviewed.

## Security and privacy
- [ ] No new personal data exposed to other users or the public page ([privacy.md](../security/privacy.md)).
- [ ] CSP still passes with no violations (Playwright CSP tests).
- [ ] `npm audit --omit=dev` has no high or critical findings.

## Docs
- [ ] [CHANGELOG](../CHANGELOG.md) updated.
- [ ] User stories, requirements and the API reference updated for behaviour changes.
- [ ] New decisions recorded as ADRs.

## AWS infrastructure
- [ ] CDK diff reviewed for EC2/AMI replacement, persistent storage, IAM and secret changes; region/account match the [AWS guide](aws-deployment.md).
- [ ] EC2 email bootstrap gap resolved or explicitly accounted for before refresh; verify actual n8n SMTP credential and sender after deployment.
- [ ] Amplify auto-build commit checked independently of the GitHub production deployment gate.
- [ ] Namecheap records, HTTPS endpoints and production Clerk instance agree.
- [ ] Recent AWS Backup recovery point verified; restore plan preserves Convex and n8n encryption secrets.
- [ ] CloudWatch heartbeat/canaries reviewed and SNS subscription confirmed if operator notifications are expected.

## After deploy
- [ ] Smoke test ([deployment.md](deployment.md#deploy-steps-production)).
- [ ] No new unexplained Admin automation errors an hour later; historical failures are retained.
