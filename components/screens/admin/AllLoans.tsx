"use client";

import { useState } from "react";
import { CategoryBadge } from "@/components/CategoryBadge";
import { activityText } from "@/components/LoanCard";
import { Badge, Pagination, SearchField, SegmentedControl, Spinner } from "@/components/ui";
import { api } from "@/convex/_generated/api";
import { useNumberedPage } from "@/lib/useNumberedPage";
import { formatDate } from "@/lib/format";
import { loanStatusBadge } from "@/lib/loanStatus";
import { Section } from "./shared";
import { useSectionSearch } from "./useSectionSearch";

type Phase = "" | "open" | "active" | "closed";

/** Every loan across all users, newest first, searchable by tool name, by phase. */
export function AllLoans() {
  const { search, setSearch, term } = useSectionSearch();
  const [phase, setPhase] = useState<Phase>("");
  const { results: loans, status, pagination } = useNumberedPage(
    api.admin.allLoans,
    { search: term, phase: phase || undefined },
  );
  return (
    <Section title="All loans">
      <div className="mb-3 flex flex-col gap-3 sm:flex-row sm:items-center">
        <SearchField label="Search loans by tool name" value={search} onChange={setSearch} className="sm:flex-1" />
        <SegmentedControl<Phase>
          aria-label="Loan status"
          size="sm"
          value={phase}
          onChange={setPhase}
          options={[
            { value: "", label: "All" },
            { value: "open", label: "Open" },
            { value: "active", label: "On loan" },
            { value: "closed", label: "Closed" },
          ]}
        />
      </div>
      {status === "LoadingFirstPage" ? (
        <Spinner />
      ) : loans.length === 0 ? (
        <p className="text-body text-fg-muted">{term || phase ? "No loans match." : "No loans yet."}</p>
      ) : (
        <ul className="divide-y divide-line">
          {loans.map((l) => {
            const badge = loanStatusBadge(l.status, l.overdue);
            return (
              <li key={l._id} className="flex flex-wrap items-center justify-between gap-2 py-3 text-body">
                <div className="min-w-0">
                  <span className="font-semibold">{l.toolName}</span>{" "}
                  {l.toolCategory && <CategoryBadge category={l.toolCategory} className="mx-1 align-middle" />}
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
      <Pagination pagination={pagination} noun="loans" />
    </Section>
  );
}
