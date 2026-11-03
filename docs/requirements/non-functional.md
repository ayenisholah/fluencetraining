# Non-functional requirements

Each requirement says how it's verified. Functional requirements are in [REQUIREMENTS.md](../REQUIREMENTS.md).

## Security

| ID | Requirement | Verified by |
|---|---|---|
| NFR-S1 | Every public Convex function checks identity, ownership or role on the server | Coverage guard and deny matrix in `convex/access.test.ts` |
| NFR-S2 | Roles can't be raised from the client; admins are promoted only by an operator | `convex/access.test.ts` (escalation tests) |
| NFR-S3 | Convex ↔ n8n traffic is HMAC-SHA256 signed in both directions, with a 5-minute replay window and constant-time comparison | `convex/hmac.test.ts`, `convex/automation.test.ts`, `n8n/workflows.test.ts`, `e2e/automation.spec.ts` |
| NFR-S4 | No secrets in source, workflow exports or the browser bundle | `n8n/workflows.test.ts`, CI export check, `npm run check:bundle` |
| NFR-S5 | Strict, nonce-based Content-Security-Policy on every page; framing blocked | `e2e/public.spec.ts`, `e2e/signed-in.spec.ts` (header and no violations) |
| NFR-S6 | User text rejects control and bidi characters; display names are cleaned | `convex/rules.test.ts`, `convex/workflow.test.ts`, `convex/access.test.ts` |
| NFR-S7 | Uploads are raster images only (no SVG), at most 5 MB, and can't be reused across listings | `convex/images.test.ts` |
| NFR-S8 | Rate limits on listings, uploads and borrow requests | `convex/rbac.test.ts` (spam protection) |

## Privacy

| ID | Requirement | Verified by |
|---|---|---|
| NFR-P1 | Signed-out visitors see only tool name and category | `convex/public.test.ts` |
| NFR-P2 | Other users see a first name only, never an email | `convex/workflow.test.ts`, `convex/rbac.test.ts` |
| NFR-P3 | Webhook payloads carry only what the email needs | `convex/automation.test.ts` (exact key set) |
| NFR-P4 | Analytics load only after consent, and are cookie-free | `components/Analytics.tsx`, `e2e/public.spec.ts` |

See [privacy.md](../security/privacy.md) for the data inventory.

## Accessibility

| ID | Requirement | Verified by |
|---|---|---|
| NFR-A1 | WCAG 2.1 AA on every screen, light and dark | axe in UI tests, Storybook story tests and Playwright |
| NFR-A2 | All colour pairs meet AA contrast, including category presets | `npm run check:contrast` (CI) |
| NFR-A3 | Fully keyboard operable; dialogs trap and return focus; custom controls follow ARIA patterns | `ConfirmDialog.test.tsx`, `Select.test.tsx`, `DatePicker.test.tsx`, Playwright |
| NFR-A4 | Errors are announced and linked to their fields, and appear only after a submit attempt | `components/ToolForm.test.tsx` |

## Performance

| ID | Requirement | Verified by |
|---|---|---|
| NFR-PF1 | Every list and table is paginated and searched on the server | `convex/search.test.ts`, `convex/pagination.test.ts` |
| NFR-PF2 | List queries do one owner lookup per lender, not per row | `convex/tools.ts` (`ownerLoader`) |
| NFR-PF3 | Photos lazy-load; layouts reserve space so nothing jumps | `components/ToolImage.tsx`, loading skeletons |
| NFR-PF4 | Lighthouse performance and accessibility tracked per release | [lighthouse/summary.md](../lighthouse/summary.md) |

## Reliability

| ID | Requirement | Verified by |
|---|---|---|
| NFR-R1 | A loan state change and its webhook are committed together (transactional outbox) | `convex/lib/outbox.ts`, `convex/automation.test.ts` |
| NFR-R2 | Transient delivery failures retry with backoff; permanent ones are marked failed and visible | `convex/automation.test.ts` |
| NFR-R3 | Write-backs are idempotent; the daily reminder sends at most one per loan per day | `convex/automation.test.ts`, `n8n/roundtrip.test.ts`, `e2e/automation.spec.ts` |
| NFR-R4 | Every n8n failure reaches the error workflow and is visible in Admin | `n8n/workflows.test.ts`, `e2e/automation.spec.ts` |
| NFR-R5 | Derived fields can be backfilled safely and repeatedly | `convex/search.test.ts` (migration) |

## Compatibility

| ID | Requirement | Verified by |
|---|---|---|
| NFR-C1 | Current Chrome, Firefox, Safari and Edge; responsive down to 360 px | Playwright `public` and `public-mobile` projects, no-horizontal-scroll checks |
| NFR-C2 | Respects `prefers-color-scheme` and `prefers-reduced-motion` | Theme tests, `motion-safe` on animations |

## Maintainability

| ID | Requirement | Verified by |
|---|---|---|
| NFR-M1 | Adding a schema category or loan status fails the type check until it has a label, colour and icon | `lib/categories.tsx`, `lib/loanStatus.ts` |
| NFR-M2 | Lint, typecheck and all unit suites pass in CI on every push | `.github/workflows/ci.yml` |
