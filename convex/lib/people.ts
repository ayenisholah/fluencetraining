// How one person is shown to another. Data minimisation lives here: other
// users (and notification payloads) only ever see a first name, never a full
// name or an email address.

import { BIDI_CONTROLS } from "./rules";

export const DISPLAY_NAME_MAX = 80;

/**
 * A display name from the identity provider, made safe to show and to put in
 * an email subject: no control or bidi characters, whitespace collapsed,
 * capped, never empty.
 */
export function cleanDisplayName(raw: string | undefined | null, fallback = "Neighbour"): string {
  const cleaned = (raw ?? "")
    .replace(/[\u0000-\u001f\u007f-\u009f]/g, " ")
    .replace(new RegExp(BIDI_CONTROLS.source, "g"), "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, DISPLAY_NAME_MAX)
    .trim();
  return cleaned || fallback;
}

/** First word of a display name, or `fallback` when there's no name. */
export function firstName(name: string | undefined | null, fallback = "Neighbour"): string {
  const first = name?.trim().split(/\s+/)[0];
  return first || fallback;
}

/** What admin search matches for a member: name and email. */
export function userSearchText(name: string, email: string | undefined): string {
  return `${name} ${email ?? ""}`.trim();
}
