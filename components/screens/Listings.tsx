"use client";

import { useMutation, usePaginatedQuery } from "convex/react";
import { useState } from "react";
import { CategoryBadge } from "@/components/CategoryBadge";
import { ToolForm, type ToolSubmit } from "@/components/ToolForm";
import { ToolImage } from "@/components/ToolImage";
import { ToolStatusBadge } from "@/components/ToolStatusBadge";
import { useUploadImage } from "@/components/useUploadImage";
import {
  BoxIcon,
  Button,
  Card,
  CardHeader,
  EmptyState,
  LoadMore,
  PageHeader,
  SearchField,
  SegmentedControl,
  Spinner,
  useConfirm,
} from "@/components/ui";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { conditionLabel } from "@/lib/format";
import { useDebouncedValue } from "@/lib/useDebouncedValue";
import { useUrlState } from "@/lib/useUrlState";

export const LISTINGS_PAGE_SIZE = 25;
type StatusFilter = "" | "available" | "on_loan";

/** Convex ids are strings on the client; the form hands back a plain string. */
const asImage = (fields: ToolSubmit) => ({ ...fields, imageId: fields.imageId as Id<"_storage"> | undefined });

export function ListingsScreen() {
  const [url, setUrl] = useUrlState(["q", "status"] as const);
  const [search, setSearch] = useState(url.q);
  const term = useDebouncedValue(search.trim());
  const status: StatusFilter = url.status === "available" || url.status === "on_loan" ? url.status : "";
  const { results: tools, status: pageStatus, loadMore } = usePaginatedQuery(
    api.tools.mine,
    { search: term || undefined, status: status || undefined },
    { initialNumItems: LISTINGS_PAGE_SIZE },
  );
  const create = useMutation(api.tools.create);
  const update = useMutation(api.tools.update);
  const remove = useMutation(api.tools.remove);
  const uploadImage = useUploadImage();
  const { confirm, dialog } = useConfirm();
  const [editing, setEditing] = useState<Id<"tools">>();
  const filtered = Boolean(term || status);

  return (
    <>
      <PageHeader title="My listings" description="Tools you're lending to the neighbourhood." />
      <div className="grid items-start gap-6 lg:grid-cols-[1fr_360px]">
        <section className="space-y-4" aria-label="Your tools">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <SearchField
              label="Search your listings"
              value={search}
              onChange={(value) => {
                setSearch(value);
                setUrl({ q: value.trim() });
              }}
              className="sm:flex-1"
            />
            <SegmentedControl<StatusFilter>
              aria-label="Show"
              size="sm"
              value={status}
              onChange={(value) => setUrl({ status: value })}
              options={[
                { value: "", label: "All" },
                { value: "available", label: "Available" },
                { value: "on_loan", label: "On loan" },
              ]}
            />
          </div>
          {pageStatus === "LoadingFirstPage" ? (
            <Spinner />
          ) : tools.length === 0 ? (
            <EmptyState
              icon={<BoxIcon />}
              title={filtered ? "No listings match" : "You haven't listed anything yet"}
              description={filtered ? "Try another search or filter." : "Use the form to add your first tool."}
            />
          ) : (
            <>
              <ul className="space-y-3">
                {tools.map((tool) => (
                  <Card as="li" key={tool._id}>
                    {editing === tool._id ? (
                      <ToolForm
                        initial={{ name: tool.name, category: tool.category, condition: tool.condition, description: tool.description }}
                        initialImageUrl={tool.imageUrl}
                        uploadImage={uploadImage}
                        submitLabel="Save"
                        onCancel={() => setEditing(undefined)}
                        onSubmit={async (fields) => {
                          await update({ toolId: tool._id, ...asImage(fields) });
                          setEditing(undefined);
                        }}
                      />
                    ) : (
                      <div className="flex gap-4">
                        <ToolImage src={tool.imageUrl} name={tool.name} category={tool.category} iconSize={28} className="w-24 shrink-0 rounded-md sm:w-32" />
                        <div className="min-w-0 flex-1">
                          <div className="flex items-start justify-between gap-3">
                            <h2 className="text-subtitle-semibold text-fg">{tool.name}</h2>
                            <ToolStatusBadge status={tool.status} />
                          </div>
                          <div className="mt-2 flex flex-wrap items-center gap-2">
                            <CategoryBadge category={tool.category} />
                            <span className="text-description text-fg-muted">{conditionLabel(tool.condition)}</span>
                          </div>
                          {tool.description && <p className="mt-2 line-clamp-2 text-body text-fg-muted">{tool.description}</p>}
                          <div className="mt-3 flex gap-2">
                            <Button variant="ghost" size="sm" onClick={() => setEditing(tool._id)}>Edit</Button>
                            <Button
                              variant="danger"
                              size="sm"
                              onClick={() =>
                                confirm({
                                  title: `Delete "${tool.name}"?`,
                                  description: "It disappears from the board and any open requests for it are declined.",
                                  confirmLabel: "Delete listing",
                                  onConfirm: () => remove({ toolId: tool._id }),
                                })
                              }
                            >
                              Delete
                            </Button>
                          </div>
                        </div>
                      </div>
                    )}
                  </Card>
                ))}
              </ul>
              <LoadMore status={pageStatus} count={tools.length} noun="listings" onLoadMore={() => loadMore(LISTINGS_PAGE_SIZE)} />
            </>
          )}
        </section>
        <Card as="section" aria-labelledby="new-listing">
          <CardHeader title={<span id="new-listing">List a tool</span>} description="It appears on the board straight away." />
          <ToolForm submitLabel="List it" uploadImage={uploadImage} onSubmit={(fields) => create(asImage(fields))} />
        </Card>
      </div>
      {dialog}
    </>
  );
}
