"use client";

import { useMutation, useQuery } from "convex/react";
import { useState } from "react";
import { BorrowForm } from "@/components/BorrowForm";
import { ToolStatusBadge } from "@/components/ToolStatusBadge";
import { Badge, Button, Card, EmptyState, PageHeader, Select, Spinner, ToolIcon } from "@/components/ui";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { CATEGORIES, categoryLabel, conditionLabel, type Category } from "@/lib/format";

const filterOptions = [{ value: "", label: "All categories" }, ...CATEGORIES.map(([value, label]) => ({ value, label }))];

export function ToolsScreen() {
  const [category, setCategory] = useState<Category | "">("");
  const [borrowing, setBorrowing] = useState<Id<"tools">>();
  const [sent, setSent] = useState<Id<"tools">>();
  const tools = useQuery(api.tools.list, category ? { category } : {});
  const request = useMutation(api.loans.request);

  return (
    <>
      <PageHeader
        title="All tools"
        description="Everything your neighbours are lending right now."
        actions={
          <Select
            label="Category"
            hideLabel
            className="w-56"
            options={filterOptions}
            value={category}
            onValueChange={(v) => setCategory(v as Category | "")}
          />
        }
      />
      {tools === undefined ? (
        <Spinner />
      ) : tools.length === 0 ? (
        <EmptyState icon={<ToolIcon />} title={`Nothing here yet${category ? " in this category" : ""}`} />
      ) : (
        <ul className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {tools.map((tool) => (
            <Card as="li" key={tool._id} className="flex flex-col">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <h2 className="text-subtitle-semibold text-fg">{tool.name}</h2>
                  <p className="mt-1 text-description text-fg-muted">
                    {categoryLabel(tool.category)} · {conditionLabel(tool.condition)} · lent by{" "}
                    {tool.isMine ? "you" : tool.lenderName}
                  </p>
                </div>
                <div className="flex shrink-0 flex-col items-end gap-1">
                  <ToolStatusBadge status={tool.status} />
                  {tool.trustedLender && <Badge variant="ghost" tone="brand">Trusted lender</Badge>}
                </div>
              </div>
              {tool.description && <p className="mt-3 text-body text-fg">{tool.description}</p>}
              <div className="mt-auto">
                {sent === tool._id ? (
                  <p role="status" className="mt-4 text-body text-success">Request sent. The lender has been notified.</p>
                ) : borrowing === tool._id ? (
                  <BorrowForm
                    onSubmit={(dates) => request({ toolId: tool._id, ...dates })}
                    onSent={() => {
                      setBorrowing(undefined);
                      setSent(tool._id);
                    }}
                    onCancel={() => setBorrowing(undefined)}
                  />
                ) : (
                  !tool.isMine && (
                    <Button variant="ghost" size="sm" className="mt-4" onClick={() => setBorrowing(tool._id)}>
                      Request to borrow
                    </Button>
                  )
                )}
              </div>
            </Card>
          ))}
        </ul>
      )}
    </>
  );
}
