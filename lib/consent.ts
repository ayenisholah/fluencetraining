"use client";

import { useEffect, useState } from "react";

export type Consent = "accepted" | "declined" | null;

const KEY = "lendloop.analytics-consent";
const EVENT = "lendloop:consent";
export const OPEN_SETTINGS_EVENT = "lendloop:cookie-settings";

export function readConsent(): Consent {
  try {
    const value = window.localStorage.getItem(KEY);
    return value === "accepted" || value === "declined" ? value : null;
  } catch {
    return null; // storage blocked: treat as "not decided", load nothing
  }
}

export function writeConsent(value: Exclude<Consent, null>): void {
  try {
    window.localStorage.setItem(KEY, value);
  } catch {
    // Storage unavailable; the choice applies to this page view only.
  }
  window.dispatchEvent(new CustomEvent(EVENT, { detail: value }));
}

/** Current analytics consent; `undefined` until read on the client. */
export function useConsent(): Consent | undefined {
  const [consent, setConsent] = useState<Consent | undefined>(undefined);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- reading browser storage after mount
    setConsent(readConsent());
    const onChange = (e: Event) => setConsent((e as CustomEvent<Consent>).detail);
    window.addEventListener(EVENT, onChange);
    return () => window.removeEventListener(EVENT, onChange);
  }, []);
  return consent;
}
