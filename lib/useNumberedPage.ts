"use client";

import { useQuery, type OptionalRestArgsOrSkip } from "convex/react";
import { getFunctionName, type FunctionReference, type FunctionArgs, type FunctionReturnType } from "convex/server";
import { useState } from "react";
import { PAGE_SIZES, type PageControls, type PageSize } from "./pagination";

export type PageStatus = "LoadingFirstPage" | "CanLoadMore" | "Exhausted";
type NumberedQuery = FunctionReference<"query", "public", { pageNumber: number; pageSize: number }, { page: unknown[]; pageNumber: number; pageSize: number; totalCount: number; totalPages: number }>;

/** Subscribe to exactly one server page, with direct numbered navigation. */
export function useNumberedPage<Query extends NumberedQuery>(query: Query, args: Omit<FunctionArgs<Query>, "pageNumber" | "pageSize">) {
  const key = JSON.stringify([getFunctionName(query), args]);
  const [pageSize, setPageSize] = useState<PageSize>(10);
  const [selection, setSelection] = useState({ key, page: 1 });
  const page = selection.key === key ? selection.page : 1;
  if (selection.key !== key) setSelection({ key, page: 1 });
  const result = useQuery(query, ...[{ ...args, pageNumber: page, pageSize }] as OptionalRestArgsOrSkip<Query>) as FunctionReturnType<Query> | undefined;
  if (result && result.pageNumber !== page) setSelection({ key, page: result.pageNumber });
  const loading = result === undefined;
  const results: FunctionReturnType<Query>["page"] = result?.page ?? [];
  const goToPage = (target: number) => {
    if (!loading && Number.isSafeInteger(target) && target >= 1 && target <= result.totalPages) setSelection({ key, page: target });
  };
  const pagination: PageControls = {
    page: result?.pageNumber ?? page, pageSize, count: results.length, loading,
    totalCount: result?.totalCount ?? 0, totalPages: result?.totalPages ?? 0,
    hasPrevious: page > 1, hasNext: !loading && page < result.totalPages,
    goToPage, previous: () => goToPage(page - 1), next: () => goToPage(page + 1),
    setPageSize: (size) => { if (PAGE_SIZES.includes(size)) { setPageSize(size); setSelection({ key, page: 1 }); } },
  };
  const status: PageStatus = loading ? "LoadingFirstPage" : pagination.hasNext ? "CanLoadMore" : "Exhausted";
  return { results, status, pagination };
}
