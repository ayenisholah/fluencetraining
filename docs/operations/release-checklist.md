# Release checklist

Copy into the release PR and tick each item.

## Code and tests
- [ ] CI green on the release commit: lint, typecheck, `npm test`, contrast, workflow-export check, build, bundle check, link check, Storybook story tests, public Playwright.
- [ ] Signed-in Playwright run locally against the stack: `npx playwright test`.
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

## After deploy
- [ ] Smoke test ([deployment.md](deployment.md#deploy-steps-production)).
- [ ] Admin › Automation health clear an hour later.
