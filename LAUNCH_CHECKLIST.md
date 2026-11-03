# Launch checklist

The status of each launch item, what was done, and how it was checked. Checked on 3 November 2026 against a local production build (`npm run build && npm start`).

**Status key:**
- ✅ done and verified
- ➖ not applicable, with the reason
- 👤 needs a decision or a step on the hosting/Clerk side

| # | Item | Status | What was done | How it's verified |
|---|---|---|---|---|
| 1 | Privacy policy | ✅ | `/privacy` (`app/privacy/page.tsx`): what's collected, why, who sees what, processors, cookies, retention, user choices. Marked clearly as demo text, since LendLoop is fictional. Linked from the footer and the cookie banner. | 200 with its own title; in the sitemap; link check passes |
| 2 | Terms & conditions | ✅ | `/terms` (`app/terms/page.tsx`): the service, accounts, lender and borrower duties, prohibited use, no warranty, changes. Same demo notice. | 200 with its own title; in the sitemap |
| 3 | Cookie consent banner | ✅ | `components/CookieConsent.tsx`: Clerk's session cookies are essential and are explained, not gated. "Allow analytics" / "Essential only" controls the optional analytics only. The choice is stored in `localStorage` (failures are handled) and can be reopened via **Cookie settings** in the footer. A spacer stops the banner covering the footer. | Checked in screenshots at 390 px and 1280 px; with no choice made, analytics never loads (item 19) |
| 4 | Remove frontend secrets | ✅ | Only `NEXT_PUBLIC_CONVEX_URL` and `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` reach the browser, and both are designed to be public. `scripts/check-client-bundle.sh` scans `.next/static` for Clerk secret-key patterns and for every non-public value in `.env` / `.env.local`. | `npm run check:bundle` passes. It also correctly failed when a real secret was planted in the bundle as a test. Runs in CI after the build. |
| 5 | Enforce HTTPS | ✅ / 👤 | `Strict-Transport-Security` (2 years, includeSubDomains, preload) is sent in production. An opt-in 308 redirect for plain-http requests behind a TLS proxy (`ENFORCE_HTTPS=true`) is built from the request's host. Vercel already forces HTTPS at the edge, so it isn't needed there. | `curl -D -` shows HSTS. With `ENFORCE_HTTPS=true`, `X-Forwarded-Proto: http` → `308 https://lendloop.example/privacy?x=1`, and https requests → 200. 👤 Turn the flag on if self-hosting behind a proxy. |
| 6 | Meta titles/descriptions | ✅ | Each route has a server `page.tsx` that exports `metadata`, with the UI in `components/screens/*`. The title template is `%s · LendLoop`, set alongside `metadataBase`, canonical URLs and the theme colour. Signed-in pages are `noindex`. | Checked the `<title>` and `<meta name="description">` per page with `curl` |
| 7 | Social preview image | ✅ | `app/opengraph-image.tsx` and `twitter-image.tsx` are generated with `next/og` at 1200×630, with alt text. `twitter:card = summary_large_image`. | `/opengraph-image` returns `image/png` and was viewed. `og:image`, `og:image:alt` and `twitter:*` tags are present. |
| 8 | Favicon | ✅ | `app/icon.svg` (the brand mark) and a generated `app/apple-icon` (180 px). Removed the default Next.js `favicon.ico`. | `/icon.svg` returns `image/svg+xml`, `/apple-icon` returns `image/png`, and both are linked in `<head>` |
| 9 | Sitemap and robots.txt | ✅ | `app/sitemap.ts` lists only the public pages (`/`, `/privacy`, `/terms`). `app/robots.ts` disallows the signed-in app routes and points to the sitemap. | `/robots.txt` and `/sitemap.xml` return 200 with the expected content |
| 10 | Image alt text | ➖ | The app ships no `<img>` elements. Icons are SVG/CSS, and the Clerk avatar sets its own alt. The OG image's alt is set via `opengraph-image.alt`. | `grep -rn "<img" app components` finds nothing. Lighthouse accessibility scores 100 on every public page. |
| 11 | Image compression | ➖ | There are no raster assets: the icon is a 0.3 KB SVG, and the OG and Apple icons are generated PNGs. The empty `public/` folder was removed. | Total page weight is about 300 KB, almost all JS and fonts (Lighthouse `total-byte-weight`) |
| 12 | Page load speed check | ✅ | Lighthouse 12 on mobile, results in [`docs/lighthouse/summary.md`](docs/lighthouse/summary.md). Fixed during the audit: the mono font is no longer preloaded on every page. The remaining cost is Clerk's dev-instance handshake and `clerk-js`. | With Clerk's dev domain blocked: Performance 75–82, observed LCP 0.9–1.1 s. As shipped with dev keys: Performance 62–69, observed LCP 1.0–1.9 s. Accessibility and SEO score 100 everywhere. |
| 13 | Color contrast fixes | ✅ | `scripts/contrast-check.mjs` reads the tokens in `app/globals.css` and checks every text/background pair the UI uses, in both light and dark themes. No token needed changing; the closest pair is the light "Requested" badge at 4.73:1. | `npm run check:contrast`: all 20 pairs pass AA. Runs in CI. Lighthouse contrast audit passes. |
| 14 | Mobile responsiveness | ✅ / 👤 | Public pages were checked at 390 px and 1280 px. Layout is single-column on phones and the grid becomes 2–3 columns wider up. The nav wraps, the banner stacks its buttons, and there's no horizontal scroll. | Headless Chrome screenshots of `/`, `/privacy` and the 404 page. 👤 Signed-in pages need a session: check them in a narrow window. |
| 15 | Custom 404 page | ✅ | `app/not-found.tsx`: on-brand copy, links home and to tools, `noindex`. | `/does-not-exist` returns **404** (not 200) and renders the page |
| 16 | Broken link fixes | ✅ | Added footer links (Privacy, Terms, Cookie settings). `scripts/check-links.mjs` crawls the public pages and every same-origin link and asset. | `npm run check:links`: 25 URLs, 0 broken. Runs in CI against the built app. |
| 17 | Form validation | ✅ | Rules live in one place (`convex/lib/rules.ts`), used by both the server checks and the forms. Fields show inline messages after blur or submit, with `aria-invalid` / `aria-describedby`, a description character counter, and focus moved to the first invalid field. Borrow dates are checked before sending: real dates, not in the past, end after start, at most 30 days. The server stays authoritative. | `npm test` covers the server rules, including invalid dates. The UI messages use the same functions. |
| 18 | Spam protection | ✅ / 👤 | Per-user rolling limits in Convex (`convex/lib/rateLimit.ts`): 10 listings and 20 borrow requests per hour. Deleting listings doesn't reset the count. All mutations need a signed-in user. Sign-up abuse is handled by Clerk's bot protection. | 3 new tests in `convex/rbac.test.ts` (over-limit, delete-and-repost, per-user isolation). 👤 Confirm bot sign-up protection under Clerk → Configure → Attack protection. |
| 19 | Analytics setup | ✅ / 👤 | `components/Analytics.tsx` adds Plausible-compatible, cookie-free analytics. It loads only when `NEXT_PUBLIC_PLAUSIBLE_DOMAIN` is set and the visitor chose "Allow analytics". | With the variable unset (local default), no analytics request is made. 👤 Set the domain (and optionally `NEXT_PUBLIC_PLAUSIBLE_SRC` for a self-hosted instance) when deploying. |
| 20 | Single clear CTA | ✅ | The landing page has one primary button: "Sign in to lend or borrow", or "Browse tools" when signed in. The header's Sign in is now secondary (ghost) so it doesn't compete. | Screenshot at 390 px shows one filled button above the fold |

## Commands

```bash
npm test                 # 32 tests incl. rate limits
npm run typecheck && npm run lint
npm run check:contrast   # WCAG AA token check
npm run build
npm run check:bundle     # no secrets in .next/static
npm start &              # then:
npm run check:links      # crawl public pages for broken links
```
