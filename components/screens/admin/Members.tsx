"use client";

import { useMutation } from "convex/react";
import { useState } from "react";
import { Avatar, Badge, Pagination, SearchField, SegmentedControl, Spinner, Toggle } from "@/components/ui";
import { api } from "@/convex/_generated/api";
import { useNumberedPage } from "@/lib/useNumberedPage";
import { RowError, Section, type RowActions } from "./shared";
import { useSectionSearch } from "./useSectionSearch";

type Filter = "" | "admins" | "trusted";

/** Members, searchable by name or email, with the Trusted Lender switch. */
export function Members({ actions }: { actions: RowActions }) {
  const { search, setSearch, term } = useSectionSearch();
  const [filter, setFilter] = useState<Filter>("");
  const {
    results: users,
    status,
    pagination,
  } = useNumberedPage(api.admin.users, { search: term, filter: filter || undefined });
  const setTrusted = useMutation(api.admin.setTrustedLender);
  return (
    <Section title="Members" description="Trusted lenders get a badge on their listings.">
      <div className="mb-3 flex flex-col gap-3">
        <SearchField label="Search members by name or email" value={search} onChange={setSearch} />
        <SegmentedControl<Filter>
          aria-label="Show members"
          size="sm"
          value={filter}
          onChange={setFilter}
          options={[
            { value: "", label: "Everyone" },
            { value: "trusted", label: "Trusted" },
            { value: "admins", label: "Admins" },
          ]}
          className="self-start"
        />
      </div>
      {status === "LoadingFirstPage" ? (
        <Spinner />
      ) : users.length === 0 ? (
        <p className="text-body text-fg-muted">No members match.</p>
      ) : (
        <ul className="divide-y divide-line">
          {users.map((u) => (
            <li key={u._id} className="flex flex-wrap items-center justify-between gap-3 py-3">
              <span className="flex min-w-0 max-w-full items-center gap-3">
                <Avatar name={u.name} size={36} />
                <span className="min-w-0">
                  <span className="block truncate text-body-bold text-fg">
                    {u.name}{" "}
                    {u.role === "admin" && (
                      <Badge variant="ghost" tone="brand">
                        admin
                      </Badge>
                    )}
                  </span>
                  <span className="block truncate text-description text-fg-muted">{u.email}</span>
                </span>
              </span>
              <Toggle
                size="sm"
                // The hidden name makes each switch distinguishable ("Olu Owner: Trusted").
                label={
                  <>
                    <span className="sr-only">{`${u.name}:`}</span> Trusted
                  </>
                }
                checked={u.trustedLender}
                onCheckedChange={(trusted) => void actions.run(u._id, () => setTrusted({ userId: u._id, trusted }))}
              />
              <RowError actions={actions} id={u._id} />
            </li>
          ))}
        </ul>
      )}
      <Pagination pagination={pagination} noun="members" />
    </Section>
  );
}
