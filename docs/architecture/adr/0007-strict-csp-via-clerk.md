# 0007. Strict nonce-based CSP through Clerk's middleware

**Context.** There was no Content-Security-Policy. Hand-rolling a strict CSP that works with Clerk's scripts, Next.js inline scripts and the Convex websocket is error-prone.

**Decision.** Use `clerkMiddleware(..., { contentSecurityPolicy: { strict: true, directives } })` in `proxy.ts`. It generates a nonce per request, uses `'strict-dynamic'` (no host allow-lists for scripts), and passes the nonce to Next.js through request headers. The layout puts the nonce on the one inline script, and `<ClerkProvider dynamic>` uses it for Clerk's tags. Extra directives allow the Convex origin (http and ws) for `connect-src` and `img-src`, and set `frame-ancestors 'none'`, `object-src 'none'`, `base-uri 'self'`.

**Consequences.** Pages render dynamically, which they already did because of auth. Playwright checks the header, nonce freshness, and that no page (including Clerk's modal) triggers a violation.
