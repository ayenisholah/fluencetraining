"use client";

import { useMutation } from "convex/react";
import { useState } from "react";
import { BorrowForm } from "@/components/BorrowForm";
import { CategoryChips } from "@/components/CategoryChips";
import { ToolCard, ToolRow, ToolTile } from "@/components/ToolCard";
import {
  Button,
  CardsIcon,
  EmptyState,
  ListIcon,
  Pagination,
  PageHeader,
  SearchField,
  SegmentedControl,
  TilesIcon,
  Toggle,
  ToolIcon,
} from "@/components/ui";
import { api } from "@/convex/_generated/api";
import { useNumberedPage } from "@/lib/useNumberedPage";
import type { Id } from "@/convex/_generated/dataModel";
import { CATEGORY_STYLES, type Category } from "@/lib/categories";
import { useDebouncedValue } from "@/lib/useDebouncedValue";
import { useUrlState } from "@/lib/useUrlState";

const asCategory = (value: string): Category | "" => (value in CATEGORY_STYLES ? (value as Category) : "");

/** Board layouts. Cards is the default (and isn't written to the URL). */
export type BoardView = "cards" | "tiles" | "list";
const VIEWS = {
  cards: { Item: ToolCard, label: "Cards", Icon: CardsIcon, grid: "grid gap-5 md:grid-cols-2 xl:grid-cols-3" },
  tiles: { Item: ToolTile, label: "Tiles", Icon: TilesIcon, grid: "grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4" },
  list: { Item: ToolRow, label: "List", Icon: ListIcon, grid: "space-y-2" },
} as const;
const asView = (value: string): BoardView => (value in VIEWS ? (value as BoardView) : "cards");

export function ToolsScreen() {
  // Filters live in the URL so refresh and back keep them.
  const [url, setUrl] = useUrlState(["q", "category", "available", "view"] as const);
  const view = asView(url.view);
  const { Item, grid } = VIEWS[view];
  const [search, setSearch] = useState(url.q);
  const term = useDebouncedValue(search.trim());
  const category = asCategory(url.category);
  const availableOnly = url.available === "1";

  const { results: tools, status, pagination } = useNumberedPage(
    api.tools.list,
    { search: term || undefined, category: category || undefined, availableOnly: availableOnly || undefined },
  );
  const request = useMutation(api.loans.request);
  const [borrowing, setBorrowing] = useState<Id<"tools">>();
  const [sent, setSent] = useState<Id<"tools">>();
  const filtered = Boolean(term || category || availableOnly);

  const onSearch = (value: string) => {
    setSearch(value);
    setUrl({ q: value.trim() });
  };
  const clearFilters = () => {
    setSearch("");
    setUrl({ q: "", category: "", available: "" });
  };

  return (
    <>
      <PageHeader title="All tools" description="Everything your neighbours are lending right now." />
      <div className="mb-6 space-y-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <SearchField label="Search tools" placeholder="Search by name or description" value={search} onChange={onSearch} className="sm:max-w-md sm:flex-1" />
          <div className="flex flex-wrap items-center justify-between gap-3 sm:ml-auto">
            <Toggle label="Available only" checked={availableOnly} onCheckedChange={(on) => setUrl({ available: on ? "1" : "" })} />
            <SegmentedControl<BoardView>
              aria-label="View"
              size="sm"
              value={view}
              onChange={(next) => setUrl({ view: next === "cards" ? "" : next })}
              options={(Object.keys(VIEWS) as BoardView[]).map((v) => {
                const { Icon, label } = VIEWS[v];
                return { value: v, ariaLabel: label, label: <Icon size={18} /> };
              })}
            />
          </div>
        </div>
        <CategoryChips value={category} onChange={(c) => setUrl({ category: c })} />
      </div>

      {status === "LoadingFirstPage" ? (
        <ul aria-busy="true" aria-label="Loading tools" className={grid}>
          {[0, 1, 2].map((i) => (
            <li key={i} className={`${view === "list" ? "h-[90px]" : view === "tiles" ? "h-[260px]" : "h-[380px]"} animate-pulse rounded-lg border border-line bg-surface`} />
          ))}
        </ul>
      ) : tools.length === 0 ? (
        <EmptyState
          icon={<ToolIcon />}
          title={filtered ? (term ? `No tools match "${term}"` : "No tools match these filters") : "Nothing here yet"}
          description={filtered ? undefined : "List the first tool from My listings."}
          action={filtered ? <Button variant="ghost" size="sm" onClick={clearFilters}>Clear filters</Button> : undefined}
        />
      ) : (
        <>
          <ul className={grid} data-view={view}>
            {tools.map((tool) => (
              <Item
                key={tool._id}
                tool={tool}
                action={
                  tool.isMine || borrowing === tool._id || sent === tool._id ? null : (
                    <Button size="sm" onClick={() => setBorrowing(tool._id)}>
                      Request to borrow
                    </Button>
                  )
                }
              >
                {sent === tool._id && (
                  <p role="status" className="mt-4 text-body text-success">
                    Request sent. The lender has been notified.
                  </p>
                )}
                {borrowing === tool._id && (
                  <BorrowForm
                    onSubmit={(dates) => request({ toolId: tool._id, ...dates })}
                    onSent={() => {
                      setBorrowing(undefined);
                      setSent(tool._id);
                    }}
                    onCancel={() => setBorrowing(undefined)}
                  />
                )}
              </Item>
            ))}
          </ul>
        </>
      )}
      <Pagination pagination={pagination} noun="tools" />
    </>
  );
}
