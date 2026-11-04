# Contributing

## Setup
- Use Node 22 (`nvm use` reads `.nvmrc`). `npm install` also installs the git hooks (husky).
- Follow [README › Local setup](../README.md#local-setup) for Docker, Convex, Clerk and n8n.

## Using AI agents
[AGENTS.md](../AGENTS.md) is the rulebook for coding agents (Claude Code reads it through [CLAUDE.md](../CLAUDE.md)). The same rules apply to you. If you use an agent, you're responsible for its diff: review every line, and don't let it add AI attribution (`Co-Authored-By` trailers, "Generated with ..." lines) to commits or PRs.

## Workflow
1. Branch from `main` (`feature/…`, `fix/…`).
2. Make small, **atomic commits**: one logical change each, and each one passes `npm run typecheck`. Message style: an imperative subject (≤ 72 characters) saying what and why ("Refuse to approve expired requests"), then a body explaining the reasoning.
3. Before pushing: `npm run format:check && npm run lint && npm run typecheck && npm test`. If you touched UI, also run `npm run test:storybook` and `npm run check:contrast`. If you touched `infra/`: `cd infra && npm run typecheck && npm run lint && npx cdk synth --strict -q`.
   - The pre-commit hook formats (Prettier) and lints (ESLint, zero warnings) staged files. Don't bypass it with `--no-verify`.
   - Never loosen a lint rule, type check or test to get green. An `eslint-disable` needs a `-- reason`.
4. Open a PR. CI must be green. Run the signed-in Playwright project locally for changes to flows (see the [test plan](testing/test-plan.md)).

## Where code goes
| Kind | Location |
|---|---|
| A query or mutation | `convex/<domain>.ts` (`tools`, `loans`, `admin`, `users`) |
| A shared rule or guard | `convex/lib/` (`auth.ts` guards, `rules.ts` validation shared with forms) |
| A design-system component | `components/ui/<Name>/` with `.tsx`, `.test.tsx` and `.stories.tsx` |
| A domain component | `components/` (e.g. `ToolCard.tsx`, `CategoryBadge.tsx`) |
| A page | `app/(site)` or `app/(app)` route + `components/screens/<Name>.tsx` |
| Client helpers | `lib/` |
| AWS infrastructure | `infra/` (a separate npm package) and `deploy/ec2/` |

## Conventions
- **Authorisation lives in Convex.** Every public function starts with a guard from `convex/lib/auth.ts`. The UI only hides what the server would refuse anyway.
- **Never trust arguments for identity**: use `ctx.auth`. Don't accept `ownerId`, `status` or `role` from the client.
- **Show people by first name** with `firstName()`; never send other users' emails.
- **Lists are paginated and searched on the server.** Use `convex/lib/pagination.ts` and `convex/lib/search.ts`, keep filters in the URL with `lib/useUrlState.ts`, and show them with `Pagination`.
- **Design tokens only:** colours from `app/globals.css` (including `--preset-*`). Never hard-code hex values in components.
- **Accessibility:** every new screen or component gets an axe test, keyboard support and visible focus.
- **Form errors** show after a submit attempt, not while typing.
- **Destructive actions** confirm with `useConfirm()` (the ConfirmDialog), never `window.confirm`.

## Checklists for common changes

### Add a public Convex function
- Add a guard, and add an entry to `PUBLIC_FUNCTIONS` in `convex/access.test.ts`. **CI fails until you do.**
- Add deny tests for each wrong caller.
- Document it in [architecture/api.md](architecture/api.md).

### Add a tool category
- Add it to `categories`/`vCategory` in `convex/schema.ts`.
- `lib/categories.tsx` **won't compile** until it has a label, preset colour and icon.
- `convex/dev.test.ts` expects the seed to cover every category, so add a seed tool.

### Add a loan status
- Update `vLoanStatus`. `lib/loanStatus.ts` (badge) and `convex/lib/loanRecord.ts` (phase) won't compile or will need a case.

### Add a derived or indexed field
- Make it optional, maintain it through the helper in `convex/lib/*Record.ts`, and extend `migrations:backfillSearch`.

### Change an n8n workflow
- Edit it in n8n, run `npm run n8n:export` (it refuses if a secret appears), review the JSON diff, and run `npm run test:n8n`.
