# Lighthouse results

Measured 2026-11-03 with Lighthouse 12.8 (mobile preset: simulated slow 4G, 4x CPU slowdown) against a local production build (`npm run build && npm start`). Signed-out public pages.

| Run | Page | Perf | A11y | Best practices | SEO | LCP (simulated) | LCP (observed) | TBT | CLS |
|---|---|---|---|---|---|---|---|---|---|
| As shipped, Clerk dev instance | / | 62 | 100 | 79 | 100 | 4.2 s | 1.9 s | 780 ms | 0.062 |
| As shipped, Clerk dev instance | /privacy | 69 | 100 | 79 | 100 | 3.7 s | 1.5 s | 630 ms | 0.011 |
| As shipped, Clerk dev instance | /terms | 66 | 100 | 79 | 100 | 3.8 s | 1.0 s | 770 ms | 0.011 |
| Clerk dev domain blocked | / | 82 | 100 | 100 | 100 | 4.0 s | 0.9 s | 100 ms | 0.049 |
| Clerk dev domain blocked | /privacy | 80 | 100 | 100 | 100 | 3.5 s | 1.1 s | 320 ms | 0 |
| Clerk dev domain blocked | /terms | 75 | 100 | 100 | 100 | 3.8 s | 1.0 s | 390 ms | 0 |

## Reading these numbers

- **The gap between the two runs is Clerk's development instance.** Dev keys make every first visit do a handshake redirect to `*.clerk.accounts.dev` (about 1.5 s here) and set third-party cookies. That accounts for the best-practices deductions (`third-party-cookies`, `inspector-issues`) and most of the blocking time. A production Clerk instance runs on the app's own domain and drops the handshake.
- `clerk-js` (about 360 KB) still loads on every page in production. Next step if needed: load Clerk only when someone opens sign-in, or move the legal pages to a route group without the provider.
- Simulated LCP is Lighthouse's model of a slow phone. Observed LCP is what the test browser actually measured. The LCP element is the server-rendered hero heading, with no images involved.
- Fixed during this audit: a non-descriptive "Learn more" link (SEO 92 → 100), and no longer preloading the mono font, which only the admin page uses.

