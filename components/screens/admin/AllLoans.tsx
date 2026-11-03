"use client";

import { usePaginatedQuery } from "convex/react";
import { activityText } from "@/components/LoanCard";
import { Badge, Button, Spinner } from "@/components/ui";
import { api } from "@/convex/_generated/api";
import { formatDate } from "@/lib/format";
import { loanStatusBadge } from "@/lib/loanStatus";
import { Section } from "./shared";

export const LOANS_PAGE_SIZE = 25;

/** Every loan across all users, newest first, a page at a time. */
export function AllLoans() {
  const { results: loans, status, loadMore } = usePaginatedQuery(api.admin.allLoans, {}, { initialNumItems: LOANS_PAGE_SIZE });
  return (
    <Section title="All loans">
      {status === "LoadingFirstPage" ? (
        <Spinner />
      ) : loans.length === 0 ? (
        <p className="text-body text-fg-muted">No loans yet.</p>
      ) : (
        <ul className="divide-y divide-line">
          {loans.map((l) => {
            const badge = loanStatusBadge(l.status, l.overdue);
            return (
              <li key={l._id} className="flex flex-wrap items-center justify-between gap-2 py-3 text-body">
                <div className="min-w-0">
                  <span className="font-semibold">{l.toolName}</span>{" "}
                  <span className="text-fg-muted">
                    · {l.lenderName} → {l.borrowerName} · {formatDate(l.startDate)} – {formatDate(l.endDate)}
                  </span>
                  {l.activity[0] && <p className="mt-1 text-description text-fg-muted">{activityText(l.activity[0])}</p>}
                </div>
                <Badge tone={badge.tone}>{badge.label}</Badge>
              </li>
            );
          })}
        </ul>
      )}
      {(status === "CanLoadMore" || status === "LoadingMore") && (
        <Button size="sm" variant="ghost" className="mt-3" disabled={status === "LoadingMore"} onClick={() => loadMore(LOANS_PAGE_SIZE)}>
          {status === "LoadingMore" ? "Loading…" : "Load more loans"}
        </Button>
      )}
    </Section>
  );
}
