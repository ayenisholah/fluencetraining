# 0001. Convex for data, backend logic, storage and scheduling

**Context.** The brief prescribes Convex. The app needs live updates (a request appears on the lender's screen without refresh), transactions across tables, scheduled work (webhook retries, a nightly clean-up), file uploads and HTTP endpoints for n8n.

**Decision.** Use Convex for all of it: queries and mutations for app logic, `ctx.scheduler` for delivery and retries, `crons.ts` for housekeeping, `httpAction` for the n8n endpoints, file storage for photos. Self-host it with Docker locally.

**Consequences.** One transactional store keeps state changes and their side effects consistent (see 0003). Queries are reactive, so the UI needs no polling. Indexes must be designed up front for every access path (see the data model). Full-text search is Convex's: relevance-ordered, OR-ing terms, one search field per index.
