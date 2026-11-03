"use client";

import { useMutation, useQuery } from "convex/react";
import { Avatar, Badge, Spinner, Toggle } from "@/components/ui";
import { api } from "@/convex/_generated/api";
import { RowError, Section, type RowActions } from "./shared";

/** Everyone who has signed in, with the Trusted Lender switch. */
export function Members({ actions }: { actions: RowActions }) {
  const users = useQuery(api.admin.users);
  const setTrusted = useMutation(api.admin.setTrustedLender);
  return (
    <Section title="Members" description="Trusted lenders get a badge on their listings.">
      {users === undefined ? (
        <Spinner />
      ) : (
        <ul className="divide-y divide-line">
          {users.map((u) => (
            <li key={u._id} className="flex flex-wrap items-center justify-between gap-3 py-3">
              <span className="flex min-w-0 items-center gap-3">
                <Avatar name={u.name} size={36} />
                <span className="min-w-0">
                  <span className="block truncate text-body-bold text-fg">
                    {u.name} {u.role === "admin" && <Badge variant="ghost" tone="brand">admin</Badge>}
                  </span>
                  <span className="block truncate text-description text-fg-muted">{u.email}</span>
                </span>
              </span>
              <Toggle
                size="sm"
                // The hidden name makes each switch distinguishable ("Olu Owner: Trusted").
                label={<><span className="sr-only">{`${u.name}:`}</span>{" "}Trusted</>}
                checked={u.trustedLender}
                onCheckedChange={(trusted) => void actions.run(u._id, () => setTrusted({ userId: u._id, trusted }))}
              />
              <RowError actions={actions} id={u._id} />
            </li>
          ))}
        </ul>
      )}
    </Section>
  );
}
