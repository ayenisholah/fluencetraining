import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

// Optimistic redirect for signed-out visitors. This is a UX convenience only:
// every Convex function re-checks identity and role on the server.
const isAppRoute = createRouteMatcher([
  "/tools(.*)",
  "/listings(.*)",
  "/requests(.*)",
  "/incoming(.*)",
  "/admin(.*)",
]);

export default clerkMiddleware(async (auth, req) => {
  // Behind a TLS-terminating proxy (ENFORCE_HTTPS=true), send plain-http
  // requests to https. Off by default: Next sets x-forwarded-proto itself on
  // direct requests, and hosts like Vercel already redirect at the edge.
  if (
    process.env.ENFORCE_HTTPS === "true" &&
    req.headers.get("x-forwarded-proto") === "http"
  ) {
    const host = req.headers.get("x-forwarded-host") ?? req.headers.get("host");
    return NextResponse.redirect(`https://${host}${req.nextUrl.pathname}${req.nextUrl.search}`, 308);
  }
  if (isAppRoute(req)) await auth.protect();
});

export const config = {
  matcher: [
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    "/__clerk/:path*",
    "/(api|trpc)(.*)",
  ],
};
