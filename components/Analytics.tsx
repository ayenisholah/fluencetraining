"use client";

import Script from "next/script";
import { useConsent } from "@/lib/consent";

const domain = process.env.NEXT_PUBLIC_PLAUSIBLE_DOMAIN;
const src = process.env.NEXT_PUBLIC_PLAUSIBLE_SRC ?? "https://plausible.io/js/script.tagged-events.js";

/**
 * Plausible-compatible, cookie-free page analytics. Loads only when a domain
 * is configured and the visitor allowed analytics in the consent banner.
 */
export function Analytics() {
  const consent = useConsent();
  if (!domain || consent !== "accepted") return null;
  return <Script src={src} data-domain={domain} strategy="afterInteractive" />;
}
