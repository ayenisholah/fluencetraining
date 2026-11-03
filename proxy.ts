import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { httpsRedirectUrl } from "@/lib/https";

// Optimistic redirect for signed-out visitors. This is a UX convenience only:
// every Convex function re-checks identity and role on the server.
const isAppRoute = createRouteMatcher([
  "/tools(.*)",
  "/listings(.*)",
  "/requests(.*)",
  "/incoming(.*)",
  "/admin(.*)",
]);

/** An origin plus its WebSocket twin (Convex syncs over ws/wss). */
function withSocket(url: string | undefined): string[] {
  if (!url) return [];
  const { origin, protocol, host } = new URL(url);
  return [origin, `${protocol === "https:" ? "wss:" : "ws:"}//${host}`];
}

const analyticsOrigin =
  process.env.NEXT_PUBLIC_PLAUSIBLE_DOMAIN
    ? [new URL(process.env.NEXT_PUBLIC_PLAUSIBLE_SRC ?? "https://plausible.io/js/script.js").origin]
    : [];

export default clerkMiddleware(
  async (auth, req) => {
    // Behind a TLS-terminating proxy (ENFORCE_HTTPS=true), send plain-http
    // requests to https. Off by default: Next sets x-forwarded-proto itself on
    // direct requests, and hosts like Vercel already redirect at the edge.
    if (process.env.ENFORCE_HTTPS === "true" && req.headers.get("x-forwarded-proto") === "http") {
      return NextResponse.redirect(httpsRedirectUrl(req.nextUrl, process.env.NEXT_PUBLIC_SITE_URL), 308);
    }
    if (isAppRoute(req)) await auth.protect();
  },
  {
    // Strict CSP: a fresh nonce per request, 'strict-dynamic' instead of host
    // allow-lists for scripts, plus Clerk's own origins. Clerk passes the nonce
    // to Next.js (which nonces its inline scripts) via the request headers.
    contentSecurityPolicy: {
      strict: true,
      directives: {
        "connect-src": [...withSocket(process.env.NEXT_PUBLIC_CONVEX_URL), ...analyticsOrigin],
        "script-src": analyticsOrigin,
        // Tool photos are served from the Convex deployment; blob: for previews.
        "img-src": ["data:", "blob:", ...withSocket(process.env.NEXT_PUBLIC_CONVEX_URL).slice(0, 1)],
        "frame-ancestors": ["none"],
        "object-src": ["none"],
        "base-uri": ["self"],
      },
    },
  },
);

export const config = {
  matcher: [
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    "/__clerk/:path*",
    "/(api|trpc)(.*)",
  ],
};
