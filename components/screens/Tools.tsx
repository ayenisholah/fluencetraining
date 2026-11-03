"use client";

import { useQuery } from "convex/react";
import { useState } from "react";
import { BorrowForm } from "@/components/BorrowForm";
import { Badge, Empty, Loading, PageHeader } from "@/components/ui";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { CATEGORIES, categoryLabel, conditionLabel, type Category } from "@/lib/format";

export function ToolsScreen() {
  const [category, setCategory] = useState<Category | "">("");
  const [borrowing, setBorrowing] = useState<Id<"tools">>();
  const [sent, setSent] = useState<Id<"tools">>();
  const tools = useQuery(api.tools.list, category ? { category } : {});

  return (
    <>
      <PageHeader title="All tools">
        <label className="flex items-center gap-2 text-sm">
          <span className="text-muted">Category</span>
          <select className="field w-auto" value={category}
            onChange={(e) => setCategory(e.target.value as Category | "")}>
            <option value="">All</option>
            {CATEGORIES.map(([value, label]) => (
              <option key={value} value={value}>{label}</option>
            ))}
          </select>
        </label>
      </PageHeader>
      {tools === undefined ? (
        <Loading />
      ) : tools.length === 0 ? (
        <Empty>Nothing here yet{category ? " in this category" : ""}.</Empty>
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2">
          {tools.map((tool) => (
            <li key={tool._id} className="card">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h2 className="font-medium">{tool.name}</h2>
                  <p className="text-xs text-muted">
                    {categoryLabel(tool.category)} · {conditionLabel(tool.condition)} · lent by{" "}
                    {tool.isMine ? "you" : tool.lenderName}
                  </p>
                </div>
                <div className="flex shrink-0 flex-col items-end gap-1">
                  {tool.status === "available" ? (
                    <Badge tone="good">Available</Badge>
                  ) : (
                    <Badge tone="warn">On loan</Badge>
                  )}
                  {tool.trustedLender && <Badge tone="good">Trusted lender</Badge>}
                </div>
              </div>
              {tool.description && <p className="mt-2 text-sm">{tool.description}</p>}
              {sent === tool._id ? (
                <p className="mt-3 text-sm text-accent">Request sent. The lender has been notified.</p>
              ) : borrowing === tool._id ? (
                <BorrowForm
                  toolId={tool._id}
                  onSent={() => {
                    setBorrowing(undefined);
                    setSent(tool._id);
                  }}
                  onCancel={() => setBorrowing(undefined)}
                />
              ) : (
                !tool.isMine && (
                  <button className="btn-ghost mt-3" onClick={() => setBorrowing(tool._id)}>
                    Request to borrow
                  </button>
                )
              )}
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
