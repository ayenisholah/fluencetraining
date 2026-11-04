"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui";
import { OPEN_SETTINGS_EVENT, useConsent, writeConsent } from "@/lib/consent";

/**
 * Asks only about optional analytics. Clerk's session cookies are strictly
 * necessary for signing in and are not gated. Nothing optional loads until
 * the visitor accepts.
 */
export function CookieConsent() {
  const consent = useConsent();
  const [reopened, setReopened] = useState(false);

  useEffect(() => {
    const open = () => setReopened(true);
    window.addEventListener(OPEN_SETTINGS_EVENT, open);
    return () => window.removeEventListener(OPEN_SETTINGS_EVENT, open);
  }, []);

  if (consent === undefined) return null;
  if (consent !== null && !reopened) return null;

  const choose = (value: "accepted" | "declined") => {
    writeConsent(value);
    setReopened(false);
  };

  return (
    <>
      {/* Reserves space so the fixed banner never hides the footer links. */}
      <div aria-hidden className="h-44 sm:h-24" />
      <div
        role="dialog"
        aria-live="polite"
        aria-label="Cookie preferences"
        className="fixed inset-x-0 bottom-0 z-50 border-t border-line bg-surface/95 backdrop-blur"
      >
        <div className="mx-auto flex max-w-5xl flex-col gap-3 px-4 py-4 sm:flex-row sm:items-center">
          <p className="flex-1 text-body text-fg">
            We use essential cookies to keep you signed in. With your permission we&apos;d also count page views with
            cookie-free, privacy-friendly analytics.{" "}
            <Link href="/privacy#cookies" className="text-brand-fg underline underline-offset-2">
              How we use cookies
            </Link>
          </p>
          <div className="flex gap-2">
            <Button variant="ghost" size="sm" onClick={() => choose("declined")}>
              Essential only
            </Button>
            <Button size="sm" onClick={() => choose("accepted")}>
              Allow analytics
            </Button>
          </div>
        </div>
      </div>
    </>
  );
}

export function CookieSettingsButton() {
  return (
    <button
      type="button"
      className="underline-offset-2 hover:underline"
      onClick={() => window.dispatchEvent(new Event(OPEN_SETTINGS_EVENT))}
    >
      Cookie settings
    </button>
  );
}
