"use client";

import { useState } from "react";
import { LoanList } from "@/components/LoanList";
import { PageHeader, Pagination, SearchField, SegmentedControl } from "@/components/ui";
import { api } from "@/convex/_generated/api";
import { useNumberedPage } from "@/lib/useNumberedPage";
import { useDebouncedValue } from "@/lib/useDebouncedValue";
import { useUrlState } from "@/lib/useUrlState";

type Phase = "" | "open" | "active" | "closed";
const PHASES: { value: Phase; label: string }[] = [
  { value: "", label: "All" },
  { value: "open", label: "Open" },
  { value: "active", label: "On loan" },
  { value: "closed", label: "Closed" },
];

/** My requests and Incoming: the same searchable, tabbed, paginated list from either side. */
export function LoanListScreen({
  as,
  title,
  description,
  empty,
}: {
  as: "borrower" | "lender";
  title: string;
  description: string;
  empty: string;
}) {
  const [url, setUrl] = useUrlState(["q", "phase"] as const);
  const [search, setSearch] = useState(url.q);
  const term = useDebouncedValue(search.trim());
  const phase = PHASES.some((p) => p.value === url.phase) ? (url.phase as Phase) : "";
  const { results, status, pagination } = useNumberedPage(
    as === "borrower" ? api.loans.myRequests : api.loans.incoming,
    { search: term || undefined, phase: phase || undefined },
  );
  const filtered = Boolean(term || phase);
  return (
    <>
      <PageHeader title={title} description={description} />
      <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center">
        <SearchField
          label="Search by tool name"
          value={search}
          onChange={(value) => {
            setSearch(value);
            setUrl({ q: value.trim() });
          }}
          className="sm:max-w-md sm:flex-1"
        />
        <SegmentedControl<Phase> aria-label="Status" size="sm" value={phase} onChange={(value) => setUrl({ phase: value })} options={PHASES} className="sm:ml-auto" />
      </div>
      <LoanList
        loans={results}
        status={status}
        as={as}
        empty={filtered ? "Nothing matches that search." : empty}
      />
      <Pagination pagination={pagination} noun="requests" />
    </>
  );
}
