# Lighthouse results

Re-measured 2026-11-03 after the Frox design system (Poppins 400–700) with Lighthouse 12.8 (mobile preset: simulated slow 4G, 4x CPU slowdown) against a local production build (`npm run build && npm start`). Signed-out public pages.

| Run | Page | Perf | A11y | Best practices | SEO | LCP (simulated) | LCP (observed) | TBT | CLS |
|---|---|---|---|---|---|---|---|---|---|
| As shipped, Clerk dev instance | / | 59 | 100 | 79 | 100 | 4.8 s | 2.6 s | 710 ms | 0.005 |
| As shipped, Clerk dev instance | /privacy | 65 | 100 | 79 | 100 | 4.8 s | 1.2 s | 530 ms | 0 |
| As shipped, Clerk dev instance | /terms | 61 | 100 | 79 | 100 | 4.7 s | 1.2 s | 740 ms | 0 |
| Clerk dev domain blocked | / | 70 | 100 | 100 | 100 | 5.7 s | 2.0 s | 90 ms | 0.005 |
| Clerk dev domain blocked | /privacy | 78 | 100 | 100 | 100 | 4.9 s | 1.1 s | 80 ms | 0 |
| Clerk dev domain blocked | /terms | 79 | 100 | 100 | 100 | 4.7 s | 1.0 s | 80 ms | 0 |

## Reading these numbers

- **The gap between the two runs is Clerk's development instance.** Dev keys make every first visit do a handshake redirect to `*.clerk.accounts.dev` (about 1.5 s here) and set third-party cookies. That accounts for the best-practices deductions (`third-party-cookies`, `inspector-issues`) and most of the blocking time. A production Clerk instance runs on the app's own domain and drops the handshake.
- `clerk-js` (about 360 KB) still loads on every page in production. Next step if needed: load Clerk only when someone opens sign-in, or move the legal pages to a route group without the provider.
- Simulated LCP is Lighthouse's model of a slow phone. Observed LCP is what the test browser actually measured. The LCP element is the server-rendered hero heading, with no images involved.
- Fixed after the design-system change: home-page layout shift was 0.124 because the hero button and tool cards appeared after auth and data loaded. A fixed-height CTA slot and same-size skeleton cards brought it to 0.005.
- Fixed during the first audit: a non-descriptive "Learn more" link (SEO 92 → 100), and no longer preloading the mono font, which only the admin page uses.

