"use client";

import { useMutation, useQuery } from "convex/react";
import { useState } from "react";
import { ToolStatusBadge } from "@/components/ToolStatusBadge";
import { Button, Spinner } from "@/components/ui";
import { api } from "@/convex/_generated/api";
import { categoryLabel } from "@/lib/format";
import { RowError, Section, type RowActions } from "./shared";

/** Every live listing with its owner; admins can remove any of them, even mid-loan. */
export function ListingsModeration({ actions }: { actions: RowActions }) {
  const listings = useQuery(api.admin.listings);
  const removeListing = useMutation(api.admin.removeListing);
  const [confirming, setConfirming] = useState<string>();
  return (
    <Section title="Listings">
      {listings === undefined ? (
        <Spinner />
      ) : listings.length === 0 ? (
        <p className="text-body text-fg-muted">No listings.</p>
      ) : (
        <ul className="divide-y divide-line">
          {listings.map((t) => (
            <li key={t._id} className="flex flex-wrap items-center justify-between gap-2 py-3 text-body">
              <span className="min-w-0">
                <span className="font-semibold">{t.name}</span>{" "}
                <span className="text-fg-muted">· {categoryLabel(t.category)} · {t.ownerName}</span>{" "}
                {t.status === "on_loan" && <ToolStatusBadge status={t.status} />}
              </span>
              {confirming === t._id ? (
                <span role="group" aria-label={`Remove ${t.name}?`} className="flex flex-wrap items-center gap-2">
                  <span className="text-description text-fg-muted">
                    {t.status === "on_loan" ? "It's on loan; the loan stays open." : "Open requests will be declined."}
                  </span>
                  <Button
                    size="sm"
                    variant="danger"
                    onClick={() => {
                      setConfirming(undefined);
                      void actions.run(t._id, () => removeListing({ toolId: t._id }));
                    }}
                  >
                    Confirm remove
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => setConfirming(undefined)}>Keep</Button>
                </span>
              ) : (
                <Button size="sm" variant="danger" aria-label={`Remove ${t.name}`} onClick={() => setConfirming(t._id)}>
                  Remove
                </Button>
              )}
              <RowError actions={actions} id={t._id} />
            </li>
          ))}
        </ul>
      )}
    </Section>
  );
}
