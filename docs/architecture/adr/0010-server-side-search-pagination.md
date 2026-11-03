# 0010. Server-side search and numbered pagination on every list

**Context.** Lists were capped (`take(100…500)`) and some loaded everything. Filtering on the client wouldn't scale and hid data past the cap.

**Decision.** Every list and table is searched, filtered and paginated in Convex. Search uses Convex search indexes over derived fields (`tools.searchText`, `loans.toolName`, `users.searchText`), with equality filters. `listed` and `phase` exist because search filters can only test equality. Without a search term, queries use ordinary indexes, newest first. Pages are numbered (10/25/50/100 per page, with totals) for the demo-sized catalogue (`convex/lib/pagination.ts`). Filter state lives in the URL. Derived fields are maintained by helpers and backfilled by `migrations:backfillSearch`.

**Consequences.** Totals are computed by scanning the matching index, which is fine for a neighbourhood and should become maintained counts at scale (noted in the helper). Search is relevance-ordered and matches any term, so a multi-word query can match broadly.
