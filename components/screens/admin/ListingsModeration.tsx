"use client";

import { useMutation } from "convex/react";
import { useRef, useState } from "react";
import { CategoryBadge } from "@/components/CategoryBadge";
import { ToolImage } from "@/components/ToolImage";
import { ToolStatusBadge } from "@/components/ToolStatusBadge";
import { Button, Checkbox, Pagination, SearchField, Select, Spinner, useConfirm } from "@/components/ui";
import type { Id } from "@/convex/_generated/dataModel";
import { api } from "@/convex/_generated/api";
import { useNumberedPage } from "@/lib/useNumberedPage";
import { CATEGORIES, type Category } from "@/lib/format";
import { Section } from "./shared";
import { useSectionSearch } from "./useSectionSearch";

const categoryOptions = [{ value: "", label: "All categories" }, ...CATEGORIES.map(([value, label]) => ({ value, label }))];

/** Every live listing with its owner; admins can remove any of them, even mid-loan. */
export function ListingsModeration() {
  const { search, setSearch, term } = useSectionSearch();
  const [category, setCategory] = useState<Category | "">("");
  const { results: listings, status, pagination } = useNumberedPage(
    api.admin.listings,
    { search: term, category: category || undefined },
  );
  const removeListing = useMutation(api.admin.removeListing);
  const removeListings = useMutation(api.admin.removeListings);
  const { confirm, dialog } = useConfirm();
  const selectionKey = JSON.stringify([search, term, category, pagination.page, pagination.pageSize]);
  const [selection, setSelection] = useState<{ key: string; ids: Id<"tools">[] }>({ key: selectionKey, ids: [] });
  const toolbarRef = useRef<HTMLDivElement>(null);
  const [notice, setNotice] = useState("");
  const selected = selection.key !== selectionKey ? [] : selection.ids.filter((id) => pagination.loading || listings.some((listing) => listing._id === id));
  if (selection.key !== selectionKey || selected.length !== selection.ids.length) setSelection({ key: selectionKey, ids: selected });
  const select = (ids: Id<"tools">[]) => { setSelection({ key: selectionKey, ids }); setNotice(""); };
  const allSelected = listings.length > 0 && selected.length === listings.length;
  const removeSelected = () => {
    const toolIds = [...selected];
    confirm({
      title: `Remove ${toolIds.length} ${toolIds.length === 1 ? "listing" : "listings"}?`,
      description: "These listings disappear from the board and their open requests are declined. Active loans stay open so lenders can mark them returned; the listings won't come back.",
      confirmLabel: "Remove selected",
      onConfirm: async () => {
        const { removedCount, skippedCount } = await removeListings({ toolIds });
        setSelection({ key: selectionKey, ids: [] });
        requestAnimationFrame(() => toolbarRef.current?.focus());
        setNotice(`${removedCount} ${removedCount === 1 ? "listing" : "listings"} removed.${skippedCount ? ` ${skippedCount} already removed or unavailable.` : ""}`);
      },
    });
  };
  return (
    <Section title="Listings">
      <div className="mb-3 flex flex-col gap-3 sm:flex-row">
        <SearchField label="Search listings" value={search} onChange={setSearch} className="sm:flex-1" />
        <Select label="Category" hideLabel className="sm:w-48" options={categoryOptions} value={category} onValueChange={(v) => setCategory(v as Category | "")} />
      </div>
      <div ref={toolbarRef} tabIndex={-1} role="group" aria-label="Listing selection" className="mb-3 flex flex-wrap items-center gap-3 py-3 focus-visible:outline-2 focus-visible:outline-focus-ring">
        <Checkbox label="Select all on this page" checked={allSelected} indeterminate={selected.length > 0 && !allSelected}
          disabled={pagination.loading || listings.length === 0}
          onChange={(event) => select(event.target.checked ? listings.map((listing) => listing._id) : [])} />
        <span className="text-description text-fg-muted" aria-live="polite">{selected.length} selected</span>
        <Button size="sm" variant="ghost" disabled={selected.length === 0} onClick={() => select([])}>Clear selection</Button>
        <Button size="sm" variant="danger" disabled={pagination.loading || selected.length === 0} onClick={removeSelected}>Remove selected ({selected.length})</Button>
      </div>
      <p role="status" className="text-description text-fg-muted">{notice}</p>
      {status === "LoadingFirstPage" ? (
        <Spinner />
      ) : listings.length === 0 ? (
        <p className="text-body text-fg-muted">{term || category ? "No listings match." : "No listings."}</p>
      ) : (
        <ul className="divide-y divide-line">
          {listings.map((t) => (
            <li key={t._id} className="flex items-center gap-3 py-3 text-body">
              <Checkbox label={<span className="sr-only">Select {t.name}</span>} checked={selected.includes(t._id)}
                onChange={(event) => select(event.target.checked ? [...selected, t._id] : selected.filter((id) => id !== t._id))} />
              <ToolImage src={t.imageUrl} name={t.name} category={t.category} iconSize={18} className="w-14 shrink-0 rounded-sm" />
              <span className="min-w-0 flex-1">
                <span className="block truncate font-semibold">{t.name}</span>
                <span className="mt-1 flex flex-wrap items-center gap-2 text-description text-fg-muted">
                  <CategoryBadge category={t.category} />
                  {t.ownerName}
                  {t.status === "on_loan" && <ToolStatusBadge status={t.status} />}
                </span>
              </span>
              <Button
                size="sm"
                variant="danger"
                aria-label={`Remove ${t.name}`}
                onClick={() =>
                  confirm({
                    title: `Remove "${t.name}"?`,
                    description:
                      t.status === "on_loan"
                        ? `It's on loan right now. The loan stays open so ${t.ownerName} can still mark it returned; the listing won't come back.`
                        : "It disappears from the board and any open requests for it are declined.",
                    confirmLabel: "Remove listing",
                    onConfirm: () => removeListing({ toolId: t._id }),
                  })
                }
              >
                Remove
              </Button>
            </li>
          ))}
        </ul>
      )}
      <Pagination pagination={pagination} noun="listings" />
      {dialog}
    </Section>
  );
}
