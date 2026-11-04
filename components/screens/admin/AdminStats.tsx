"use client";

import { useQuery } from "convex/react";
import { ClockIcon, InboxIcon, SendIcon, StatWidget, WarningIcon } from "@/components/ui";
import { api } from "@/convex/_generated/api";

/** Headline numbers. A dash until they load. */
export function AdminStats() {
  const stats = useQuery(api.admin.stats);
  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      <StatWidget label="Open requests" value={stats?.openRequests ?? "–"} icon={<InboxIcon />} />
      <StatWidget label="Active loans" value={stats?.activeLoans ?? "–"} icon={<SendIcon />} />
      <StatWidget
        label="Overdue loans"
        value={stats?.overdueLoans ?? "–"}
        icon={<ClockIcon />}
        delta={
          stats
            ? {
                value: stats.overdueLoans ? "needs attention" : "all on time",
                direction: stats.overdueLoans ? "down" : "flat",
              }
            : undefined
        }
      />
      <StatWidget
        label="Failed webhooks"
        value={stats?.failedDeliveries ?? "–"}
        icon={<WarningIcon />}
        delta={
          stats
            ? {
                value: stats.failedDeliveries ? "retry below" : "all delivered",
                direction: stats.failedDeliveries ? "down" : "flat",
              }
            : undefined
        }
      />
    </div>
  );
}
