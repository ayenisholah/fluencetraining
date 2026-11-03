import { v } from "convex/values";

export const SEARCH_MAX = 100;

/** Optional free-text search argument shared by every list query. */
export const vSearch = v.optional(v.string());

/** Trimmed, capped search text, or undefined when there's nothing to search for. */
export function searchTerm(raw: string | undefined): string | undefined {
  const term = raw?.trim().slice(0, SEARCH_MAX);
  return term ? term : undefined;
}
