# Changelog

All notable changes, newest first. Dates are UTC. Commit references are short hashes.

## Unreleased

### Fixed
- The privacy page gives a real contact address for deletion and data requests instead of a placeholder.
- The overdue query filters already-reminded loans *while* scanning (up to 500 returned, 4,000 scanned), so a partial run no longer leaves later overdue loans permanently unreminded.

### Documentation
- README opens with a live-demo walkthrough, including the SES sandbox limit and how a reviewer gets admin, and the production note is rewritten as a short, current priority list.
- README, ADR 0004 and `AGENTS.md` no longer overstate what per-direction HMAC secrets protect, and match the code on the Node version, admin removal of on-loan tools, admin access to names and emails, and pagination state.
- README and ADR 0005 state the delivery guarantees precisely: idempotent records, best-effort email deduplication, and why the webhook is acknowledged before the activity write-back.

### Security
- The signed-out landing page searches tool **names only** (new `searchPublic` index on `publicSearchText`). Before, a description-only word still matched, which let anyone probe descriptions they aren't shown.
- Error details written back from n8n have email addresses masked before storage.
- n8n stores no data from successful runs and prunes the rest after 7 days.

### Added
- Daily `automation:purgeOld` deletes finished webhook deliveries and automation events after 90 days, as the privacy page states.

### Changed
- The borrow confirmation says "Request sent. We'll email the lender." instead of claiming the lender was already notified (delivery is asynchronous and retried).
- The privacy page describes account deletion as the operator process it actually is.
- Signed-in pages show a page-shaped skeleton while the user's record loads, instead of a corner spinner saying "Setting up your account…" on every visit. That message now appears only on a first sign-in, while the account row is created.

### Added
- The SES SMTP IAM user (`lendloop-prod-ses-smtp`) and its send policy are defined in CDK instead of by hand. The policy covers recipient identities, which the SES sandbox requires.
- A $1/month AWS Budget emails `ALERT_EMAIL` as soon as real (or forecast) spend appears on the free-plan account. Create it once with `scripts/aws/create-cost-budget.sh` (Budgets is global and unavailable to CloudFormation in eu-north-1).
- `.git-blame-ignore-revs` skips the repo-wide formatting commit.

### Fixed
- **Production email is delivered.** The EC2 host sent every notification to Mailpit, which kept it on the host. Bootstrap now imports the SES SMTP credential from Secrets Manager (`put-external-secrets.sh --ses`), renders the workflows for SES with the shared `deploy/ec2/n8n_mail.py`, sets the ops mailbox from `ALERT_EMAIL`, and fails the deploy if any of it doesn't import. Mailpit runs only when `config.mailProvider` is `"mailpit"`.

### Added
- Contributor and agent guard rails: `AGENTS.md` rules for coding agents (read by `CLAUDE.md`), Prettier, EditorConfig, `.nvmrc`, a husky + lint-staged pre-commit hook, stricter ESLint rules that enforce the CONTRIBUTING conventions, stricter TypeScript flags, and an `infra` CI job (typecheck, lint, `cdk synth`).

### Documentation
- Document all four AWS CDK stacks and their services, DNS/TLS, IAM, secrets, deployment scripts, backups and recovery limits.
- Add the CloudWatch/Synthetics/SNS monitoring guide with metric definitions, alarm thresholds and operator procedures.
- Replace the proposed Vercel/Convex Cloud deployment guidance with the AWS architecture and document the EC2 bootstrap's remaining SES integration gap.

## 2026-11-03: audit and integration changes

### Added
- **Branded HTML emails** for every loan event and the overdue reminder: rendered and unit-tested in Convex (`convex/lib/email/`), sent by n8n as HTML plus text, with a preview command (`npm run email:preview`).
- Server-side search and **numbered pagination** (10/25/50/100 per page, with totals) on every list and table: landing, board, My listings, My requests, Incoming, and Admin loans, listings and members. Filters are kept in the URL (bd33bd1, 5a4db0e).
- **Tool photos**: upload on create and edit, shown on the board, My listings and Admin; server-side type and size checks; orphan clean-up cron (bd33bd1).
- Board **views**: Cards, Tiles and List (bd33bd1).
- **Category preset colours** and icons; coloured category chips and badges everywhere (bd33bd1).
- Landing **How it works** stepper above the tool list; brand-coloured header Sign in; sign-in lands on `/tools` (bd33bd1).
- **ConfirmDialog** for delete, remove, decline and cancel (bd33bd1).
- Sample neighbourhood seed (later 100 tools) and e2e test-data purge (f9dc9f2, 5a4db0e).
- Test suites: Convex role-by-role access tests with a coverage guard, screen tests, n8n Code-node and round-trip tests, Playwright for the full spec (d22e072, 1128c05, dbbcafb, 873b725).
- Requirements traceability and SDLC documentation in `docs/` (b4ec4c5, this release).

### Changed
- DatePicker and a listbox Select replace native inputs (f2d89e4); the new LendLoop mark (6205689).
- Admins can remove listings that are on loan; All loans is paginated; admin refusals are shown (978be23).
- Code-structure refactors: the first-name rule, loan view, typed labels, shared badge and row-action hook, and Admin split into sections (9077669 … 0af4acf).
- Form validation errors appear only after submitting.

### Fixed
- Expired requests can no longer be approved; deleting a listing asks first (1bbca1f).
- n8n rejects non-numeric signature timestamps (e031994).
- DatePicker accessible name and outside-month contrast (c25ef61).

### Security
- Strict nonce-based CSP; HTTPS redirect no longer trusts `X-Forwarded-Host`; control and bidi characters refused in user text; display names cleaned; body size checked before reading (e072abf).

## Initial build: 2026-11-03
- Convex backend with server-side RBAC, outbox webhooks and n8n endpoints (0a1a046); Next.js UI with Clerk (8011a5f); n8n workflows, local stack, CI and README (1578bfd).
- Legal pages, cookie consent and consent-gated analytics (5486618); metadata, icons, sitemap and 404 (73ff132).
- Inline validation and rate limits (bee98fc); HTTPS enforcement and bundle secret check (6e96e16).
- Frox design system (e71fa19); component tests with axe (6536b29); Storybook (085cdd9); Playwright (1b45461); CI for stories and e2e (b6f0e24).
