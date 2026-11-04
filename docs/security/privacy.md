# Privacy and data handling

## Personal data inventory

| Data | Where it's stored | Who can see it | Why |
|---|---|---|---|
| Name (from Clerk) | Clerk; Convex `users.name` | Other users: **first name only**. Admins: full name | Identify lenders and borrowers to each other |
| Email (from Clerk) | Clerk; Convex `users.email` | **Admins only**; the recipient's own address in webhook payloads to n8n and in emails | Notifications; admin identification |
| Clerk subject id | Convex `users.tokenIdentifier` | No one in the UI | Linking sessions to records |
| Listings (name, description, photo) | Convex `tools`, `_storage` | Signed-in users; public page shows **name and category only**, and its search matches names only, so descriptions can't be probed | Lending |
| Loans (dates, status, parties) | Convex `loans` | The two parties; admins | Lending |
| Automation records | Convex `automationEvents` (email addresses masked in `detail`) | The two parties see kind, status and time; admins see errors | Activity on loans; operations |
| Email content | n8n execution data (failed runs only, 7 days); Mailpit locally / Amazon SES in production | Recipient; n8n operators | Notifications |
| Analytics | Plausible (cookie-free), **only after consent** | Operator, aggregated | Usage |

## Minimisation rules (enforced in code)
- `firstName()` (`convex/lib/people.ts`) is the only way a person is shown to another user.
- `tools.listPublic` projects `{ _id, name, category }` on the server.
- `webhooks.buildPayload` builds the payload at send time with exactly the fields an email needs; the outbox stores ids only. The rendered email (`convex/lib/email`) is a view of those same fields: first names, tool, dates, and no addresses in the body.
- The n8n error workflow summarises failures without copying item data.
- Display names are cleaned and capped before storage.

## Retention and deletion
- Removing a listing hides it and deletes its photo; loan history keeps the tool's name.
- Unattached uploads are deleted after 24 hours.
- Automation history (finished `webhookDeliveries` and `automationEvents`) is deleted after 90 days by the daily `automation:purgeOld` cron. Pending deliveries are never deleted.
- n8n keeps no data from successful runs (`saveDataSuccessExecution: "none"`). Failed runs are kept for debugging and pruned after 7 days (`EXECUTIONS_DATA_MAX_AGE=168`).
- Error details written back from n8n have email addresses masked (`redactDetail` in `convex/automation.ts`).
- Account deletion is a manual operator process on request (privacy page). Self-service deletion that anonymises loan history, and DPAs with Clerk, Convex, n8n and the email provider, are production follow-ups (README).

## Consent
The cookie banner offers "Essential only" or "Accept"; analytics load only after acceptance, and the choice can be reopened from the footer.
