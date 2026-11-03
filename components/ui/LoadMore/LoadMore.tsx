import { Button } from "../Button/Button";

export type PaginationStatus = "LoadingFirstPage" | "CanLoadMore" | "LoadingMore" | "Exhausted";

/**
 * Footer for a paginated list: how many are shown, and a Load more button
 * while the server has more. Convex pagination has no cheap total, so the
 * count is "Showing N".
 */
export function LoadMore({
  status,
  count,
  onLoadMore,
  noun = "items",
}: {
  status: PaginationStatus;
  count: number;
  onLoadMore: () => void;
  /** Plural noun ("tools"); the singular is used for a count of one. */
  noun?: string;
}) {
  if (status === "LoadingFirstPage" || count === 0) return null;
  const counted = count === 1 ? noun.replace(/s$/, "") : noun;
  const more = status === "CanLoadMore" || status === "LoadingMore";
  return (
    <div className="mt-6 flex flex-col items-center gap-3">
      <p className="text-description text-fg-muted" aria-live="polite">
        Showing {count} {counted}
        {more ? "" : " · that's everything"}
      </p>
      {more && (
        <Button variant="ghost" size="sm" onClick={onLoadMore} disabled={status === "LoadingMore"}>
          {status === "LoadingMore" ? "Loading…" : `Load more ${noun}`}
        </Button>
      )}
    </div>
  );
}
