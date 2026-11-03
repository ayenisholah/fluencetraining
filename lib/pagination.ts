export const PAGE_SIZES = [10, 25, 50, 100] as const;
export type PageSize = (typeof PAGE_SIZES)[number];

export type PageControls = {
  page: number;
  pageSize: PageSize;
  count: number;
  totalCount: number;
  totalPages: number;
  loading: boolean;
  hasPrevious: boolean;
  hasNext: boolean;
  previous: () => void;
  next: () => void;
  goToPage: (page: number) => void;
  setPageSize: (size: PageSize) => void;
};

export type PageNumber = number | "ellipsis-start" | "ellipsis-end";

/** Always expose endpoints; reserve at most seven slots for numbers and gaps. */
export function pageNumbers(page: number, totalPages: number): PageNumber[] {
  if (totalPages <= 7) return Array.from({ length: totalPages }, (_, i) => i + 1);
  if (page <= 4) return [1, 2, 3, 4, 5, "ellipsis-end", totalPages];
  if (page >= totalPages - 3) return [1, "ellipsis-start", totalPages - 4, totalPages - 3, totalPages - 2, totalPages - 1, totalPages];
  return [1, "ellipsis-start", page - 1, page, page + 1, "ellipsis-end", totalPages];
}
