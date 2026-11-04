## What and why
<!-- One or two sentences. Link the user story (docs/product/user-stories.md) or issue. -->

## How it was tested
<!-- Commands run and results; screenshots for UI changes (light and dark). -->

## Checklist
- [ ] `npm run format:check`, `npm run lint`, `npm run typecheck` and `npm test` pass
- [ ] Infra changes: `cd infra && npm run typecheck && npm run lint && npx cdk synth --strict -q`; `cdk diff` reviewed, nothing stateful replaced, no new paid resources
- [ ] No secrets, `.env` files or personal email addresses committed
- [ ] No AI attribution in commits or this description; any agent-written code reviewed line by line
- [ ] New public Convex functions have a guard and an entry in the coverage guard (`convex/access.test.ts`)
- [ ] No new personal data shown to other users or the public page ([privacy](docs/security/privacy.md))
- [ ] UI changes pass axe and `npm run check:contrast`
- [ ] Docs updated (user stories, API reference, CHANGELOG) and an ADR for any new decision
