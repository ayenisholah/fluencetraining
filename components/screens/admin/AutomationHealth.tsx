"use client";

import { useMutation, useQuery } from "convex/react";
import { Badge, Button, Spinner } from "@/components/ui";
import { api } from "@/convex/_generated/api";
import { timeAgo } from "@/lib/format";
import { RowError, Section, type RowActions } from "./shared";

/** Webhook deliveries that haven't succeeded (with Retry) and n8n workflow errors. */
export function AutomationHealth({ actions }: { actions: RowActions }) {
  const health = useQuery(api.admin.automationHealth);
  const retry = useMutation(api.admin.retryDelivery);
  return (
    <Section title="Automation health" description="Webhook deliveries that haven't succeeded, and n8n workflow errors.">
      {health === undefined ? (
        <Spinner />
      ) : health.deliveries.length === 0 && health.workflowErrors.length === 0 ? (
        <p className="text-body text-fg-muted">All webhooks delivered. No workflow errors.</p>
      ) : (
        <ul className="divide-y divide-line">
          {health.deliveries.map((d) => (
            <li key={d._id} className="flex flex-wrap items-center justify-between gap-3 py-3">
              <div className="min-w-0 text-body">
                <span className="font-semibold">{d.event}</span>{" "}
                <Badge tone={d.status === "failed" ? "danger" : "warning"}>{d.status}</Badge>
                <p className="mt-1 text-description text-fg-muted">
                  {d.attempts} attempt{d.attempts === 1 ? "" : "s"} · queued {timeAgo(d.createdAt)}
                  {d.lastError && ` · ${d.lastError}`}
                </p>
              </div>
              {d.status === "failed" && (
                <Button size="sm" variant="ghost" onClick={() => void actions.run(d._id, () => retry({ deliveryId: d._id }))}>
                  Retry
                </Button>
              )}
              <RowError actions={actions} id={d._id} />
            </li>
          ))}
          {health.workflowErrors.map((e) => (
            <li key={e._id} className="py-3 text-body">
              <Badge tone="danger">n8n error</Badge>{" "}
              <span className="text-description text-fg-muted">{timeAgo(e.at)}</span>
              <p className="mt-1 text-description text-fg">{e.detail}</p>
            </li>
          ))}
        </ul>
      )}
    </Section>
  );
}
