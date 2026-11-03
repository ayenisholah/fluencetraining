// Operational metrics for CloudWatch. Internal only: read by the signed,
// localhost-only POST /ops/metrics endpoint (convex/http.ts), which the
// production host polls every 5 minutes and publishes with put-metric-data.
// Counts only; no personal data.
import { internalQuery } from "./_generated/server";
import { reminderKey } from "./automation";
import { todayUtc } from "./lib/dates";

const DAY = 24 * 60 * 60 * 1000;
/** Upper bound on rows scanned per signal, so the snapshot stays cheap. */
const CAP = 1000;

export const metricsSnapshot = internalQuery({
  args: {},
  handler: async (ctx) => {
    const now = Date.now();
    const today = todayUtc(now);
    const [failed, pending, errors, requested, approved] = await Promise.all([
      ctx.db.query("webhookDeliveries").withIndex("by_status", (q) => q.eq("status", "failed")).take(CAP),
      ctx.db.query("webhookDeliveries").withIndex("by_status", (q) => q.eq("status", "pending")).take(CAP),
      ctx.db
        .query("automationEvents")
        .withIndex("by_kind", (q) => q.eq("kind", "workflow_error"))
        .order("desc")
        .take(CAP),
      ctx.db.query("loans").withIndex("by_status_end", (q) => q.eq("status", "requested")).take(CAP),
      ctx.db.query("loans").withIndex("by_status_end", (q) => q.eq("status", "approved")).take(CAP),
    ]);
    const overdue = approved.filter((l) => l.endDate < today);
    const reminded = await Promise.all(
      overdue.map((l) =>
        ctx.db
          .query("automationEvents")
          .withIndex("by_key", (q) => q.eq("idempotencyKey", reminderKey(l._id, today)))
          .unique(),
      ),
    );
    const oldestPending = pending.reduce((min, d) => Math.min(min, d._creationTime), now);
    return {
      FailedDeliveries: failed.length,
      PendingDeliveries: pending.length,
      OldestPendingDeliveryAgeSeconds: pending.length ? Math.round((now - oldestPending) / 1000) : 0,
      WorkflowErrors24h: errors.filter((e) => e.at > now - DAY).length,
      OpenRequests: requested.length,
      ActiveLoans: approved.length,
      OverdueLoans: overdue.length,
      OverdueNotRemindedToday: reminded.filter((r) => r?.status !== "sent").length,
    };
  },
});
