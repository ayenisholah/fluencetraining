import { v } from "convex/values";
import { PAGE_SIZES } from "../../lib/pagination";
import { badRequest } from "./auth";

export const pageArgs = { pageNumber: v.number(), pageSize: v.number() };
export type NumberedPageArgs = { pageNumber: number; pageSize: number };
export type NumberedPage<T> = NumberedPageArgs & { page: T[]; totalCount: number; totalPages: number };

/**
 * Exact counts for the small demo catalogue: scan the matching index in one
 * transaction, retaining only the requested and final page. Enrichment happens
 * afterwards. Larger deployments should maintain counts rather than scan them.
 */
export async function numberedPage<T>(
  source: AsyncIterable<T>,
  { pageNumber, pageSize }: NumberedPageArgs,
): Promise<NumberedPage<T>> {
  if (!Number.isSafeInteger(pageNumber) || pageNumber < 1) badRequest("Page number must be a positive integer.");
  if (!PAGE_SIZES.some((size) => size === pageSize)) badRequest("Page size must be 10, 25, 50 or 100.");
  let totalCount = 0;
  let selected: T[] = [];
  let last: T[] = [];
  for await (const row of source) {
    if (totalCount % pageSize === 0) last = [];
    last.push(row);
    if (Math.floor(totalCount / pageSize) + 1 === pageNumber) selected = last;
    totalCount++;
  }
  const totalPages = Math.ceil(totalCount / pageSize);
  const effectivePage = Math.min(pageNumber, Math.max(1, totalPages));
  return {
    page: effectivePage === pageNumber ? selected : last,
    pageNumber: effectivePage,
    pageSize,
    totalCount,
    totalPages,
  };
}
