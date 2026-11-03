// How one person is shown to another. Data minimisation lives here: other
// users (and notification payloads) only ever see a first name, never a full
// name or an email address.

/** First word of a display name, or `fallback` when there's no name. */
export function firstName(name: string | undefined | null, fallback = "Neighbour"): string {
  const first = name?.trim().split(/\s+/)[0];
  return first || fallback;
}
