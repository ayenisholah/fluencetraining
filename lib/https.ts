// Builds the https:// redirect for a plain-http request behind a TLS proxy.
//
// The target host comes from configuration (NEXT_PUBLIC_SITE_URL), never from
// Host / X-Forwarded-Host: those are client-controlled, so trusting them lets
// anyone turn this redirect into a 308 to their own domain (and poison a
// shared cache with it).

export function httpsRedirectUrl(requestUrl: URL, siteUrl: string | undefined): URL {
  const target = new URL(siteUrl ?? requestUrl.origin);
  // Set path and query as components. Resolving "//evil.example/…" as a
  // relative URL would make it protocol-relative and switch hosts.
  target.pathname = requestUrl.pathname;
  target.search = requestUrl.search;
  target.protocol = "https:";
  if (!siteUrl) target.port = ""; // the request's own (proxy) port is not the public one
  return target;
}
