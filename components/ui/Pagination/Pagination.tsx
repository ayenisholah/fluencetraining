"use client";

import { PAGE_SIZES, pageNumbers, type PageControls, type PageSize } from "@/lib/pagination";
import { useId } from "react";

import { ArrowUpIcon } from "../icons";
import { Select } from "../Select/Select";

export function Pagination({ pagination: p, noun = "items", label = `${noun} pagination` }: {
  pagination: PageControls;
  noun?: string;
  label?: string;
}) {
  const sizeId = useId();
  const start = (p.page - 1) * p.pageSize + 1;
  const summary = p.count === 0 ? `0 ${noun}` : `Showing ${start}–${start + p.count - 1} of ${p.totalCount} ${noun}`;
  return (
    <nav aria-label={label} className="@container mt-6 border-t border-line pt-4">
      <div className="flex flex-col gap-5 @[60rem]:flex-row @[60rem]:items-center @[60rem]:justify-between">
        <div className="flex flex-wrap items-center gap-x-5 gap-y-3">
          <div className="flex items-center gap-3">
            <label id={`${sizeId}-label`} htmlFor={sizeId} className="whitespace-nowrap text-body text-fg-muted">Items per page</label>
            <Select id={sizeId} aria-labelledby={`${sizeId}-label`} label="Items per page" appearance="control" className="w-20" value={String(p.pageSize)}
            options={PAGE_SIZES.map((size) => ({ value: String(size), label: String(size) }))}
            onValueChange={(value) => p.setPageSize(Number(value) as PageSize)} disabled={p.loading} />
          </div>
          <p aria-live="polite" className="text-description text-fg-muted">
            <span className="sr-only">Page {p.page} · </span>
            {p.loading ? "Loading…" : summary}
          </p>
        </div>
        <div className="grid w-fit max-w-full grid-cols-2 items-center gap-x-3 gap-y-3 @[36rem]:flex">
          <button type="button" className={`${navigationClass} justify-self-start`} onClick={p.previous} disabled={p.loading || !p.hasPrevious}>
            <ArrowUpIcon className="size-4 -rotate-90" aria-hidden />Previous
          </button>
          <div className="col-span-2 row-start-1 flex flex-wrap items-center gap-1">
            {pageNumbers(p.page, p.totalPages).map((number) => typeof number === "string" ? <span key={number} aria-hidden="true" className="w-6 text-center text-fg-muted">…</span> : <button key={number} type="button"
              aria-label={`Page ${number}`} aria-current={number === p.page ? "page" : undefined}
              disabled={p.loading} onClick={() => p.goToPage(number)}
              className={`h-10 w-10 rounded-sm text-description font-semibold tabular-nums outline-none focus-visible:ring-2 focus-visible:ring-focus-ring disabled:opacity-50 ${number === p.page ? "bg-brand text-on-brand" : "text-fg hover:bg-surface"}`}>
              {number}
            </button>)}
          </div>
          <button type="button" className={`${navigationClass} justify-self-end`} onClick={p.next} disabled={p.loading || !p.hasNext}>
            Next<ArrowUpIcon className="size-4 rotate-90" aria-hidden />
          </button>
        </div>
      </div>
    </nav>
  );
}

const navigationClass = "inline-flex h-10 items-center justify-center gap-2 rounded-sm border border-line-strong px-4 text-description font-semibold text-fg outline-none hover:bg-surface focus-visible:ring-2 focus-visible:ring-focus-ring disabled:text-fg-muted disabled:opacity-50 disabled:cursor-not-allowed";
