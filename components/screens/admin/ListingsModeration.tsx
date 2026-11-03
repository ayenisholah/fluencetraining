"use client";

import { useMutation, usePaginatedQuery } from "convex/react";
import { useState } from "react";
import { CategoryBadge } from "@/components/CategoryBadge";
import { ToolImage } from "@/components/ToolImage";
import { ToolStatusBadge } from "@/components/ToolStatusBadge";
import { Button, LoadMore, SearchField, Select, Spinner, useConfirm } from "@/components/ui";
import { api } from "@/convex/_generated/api";
import { CATEGORIES, type Category } from "@/lib/format";
import { Section } from "./shared";
import { useSectionSearch } from "./useSectionSearch";

const PAGE = 25;
const categoryOptions = [{ value: "", label: "All categories" }, ...CATEGORIES.map(([value, label]) => ({ value, label }))];

/** Every live listing with its owner; admins can remove any of them, even mid-loan. */
export function ListingsModeration() {
  const { search, setSearch, term } = useSectionSearch();
  const [category, setCategory] = useState<Category | "">("");
  const { results: listings, status, loadMore } = usePaginatedQuery(
    api.admin.listings,
    { search: term, category: category || undefined },
    { initialNumItems: PAGE },
  );
  const removeListing = useMutation(api.admin.removeListing);
  const { confirm, dialog } = useConfirm();
  return (
    <Section title="Listings">
      <div className="mb-3 flex flex-col gap-3 sm:flex-row">
        <SearchField label="Search listings" value={search} onChange={setSearch} className="sm:flex-1" />
        <Select label="Category" hideLabel className="sm:w-48" options={categoryOptions} value={category} onValueChange={(v) => setCategory(v as Category | "")} />
      </div>
      {status === "LoadingFirstPage" ? (
        <Spinner />
      ) : listings.length === 0 ? (
        <p className="text-body text-fg-muted">{term || category ? "No listings match." : "No listings."}</p>
      ) : (
        <ul className="divide-y divide-line">
          {listings.map((t) => (
            <li key={t._id} className="flex items-center gap-3 py-3 text-body">
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
      <LoadMore status={status} count={listings.length} noun="listings" onLoadMore={() => loadMore(PAGE)} />
      {dialog}
    </Section>
  );
}
