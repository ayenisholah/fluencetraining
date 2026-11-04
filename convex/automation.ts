import { v } from "convex/values";
import { internal } from "./_generated/api";
import { internalMutation, internalQuery } from "./_generated/server";
import { daysBetween } from "./lib/dates";
import { overdueReminderEmail } from "./lib/email/reminderEmail";
import { firstName } from "./lib/people";
import { vAutomationKind } from "./schema";

const EMAIL_LIKE = /[^\s@<>"'(),;:/]+@[^\s@<>"'(),;:]+\.[^\s@<>"'(),;:]+/g;

/**
 * Error details come from n8n and SMTP providers and can quote a recipient
 * ("554 ... identity/jane@example.com"). Mask addresses before storing: the
 * detail is shown in Admin and kept for weeks.
 */
export function redactDetail(detail: string | undefined): string | undefined {
  return detail?.replace(EMAIL_LIKE, "[email]").slice(0, 500);
}

export function reminderKey(loanId: string, asOf: string): string {
  return `overdue:${loanId}:${asOf}`;
}

/**
 * Approved loans whose end date has passed and that have not had a reminder
 * sent today. Excluding already-reminded loans means a re-run or retry of the
 * daily workflow does not email anyone twice.
 */
export const overdueLoans = internalQuery({
  args: { asOf: v.string() },
  handler: async (ctx, { asOf }) => {
    const loans = await ctx.db
      .query("loans")
      .withIndex("by_status_end", (q) => q.eq("status", "approved").lt("endDate", asOf))
      .take(500);
    // Per-loan lookups are independent; run them together and keep the order.
    const rows = await Promise.all(
      loans.map(async (loan) => {
        const idempotencyKey = reminderKey(loan._id, asOf);
        const [sent, tool, borrower, lender] = await Promise.all([
          ctx.db
            .query("automationEvents")
            .withIndex("by_key", (q) => q.eq("idempotencyKey", idempotencyKey))
            .unique(),
          ctx.db.get(loan.toolId),
          ctx.db.get(loan.borrowerId),
          ctx.db.get(loan.lenderId),
        ]);
        if (sent?.status === "sent" || !borrower?.email) return null;
        const toolName = tool?.name ?? "a tool";
        const daysOverdue = daysBetween(loan.endDate, asOf);
        const borrowerFirstName = firstName(borrower.name);
        const lenderFirstName = firstName(lender?.name, "the lender");
        return {
          loanId: loan._id,
          idempotencyKey,
          toolName,
          endDate: loan.endDate,
          daysOverdue,
          borrower: { email: borrower.email, firstName: borrowerFirstName },
          lender: { firstName: lenderFirstName },
          email: overdueReminderEmail({
            borrowerFirstName,
            lenderFirstName,
            toolName,
            toolCategory: tool?.category,
            endDate: loan.endDate,
            daysOverdue,
          }),
        };
      }),
    );
    return rows.filter((row) => row !== null);
  },
});

/**
 * Idempotent write-back. The same idempotencyKey always maps to one row; a
 * retry that reports "sent" after an earlier "failed" upgrades the row.
 * Convex mutations are serializable, so the check-then-insert cannot race.
 */
export const recordEvent = internalMutation({
  args: {
    idempotencyKey: v.string(),
    loanId: v.optional(v.string()),
    kind: vAutomationKind,
    status: v.union(v.literal("sent"), v.literal("failed")),
    detail: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const loanId = args.loanId ? ctx.db.normalizeId("loans", args.loanId) : undefined;
    if (args.loanId && !loanId) return { ok: false as const, error: "unknown loan" };
    if (loanId && !(await ctx.db.get(loanId))) {
      return { ok: false as const, error: "unknown loan" };
    }
    const existing = await ctx.db
      .query("automationEvents")
      .withIndex("by_key", (q) => q.eq("idempotencyKey", args.idempotencyKey))
      .unique();
    if (existing) {
      if (existing.status === "failed" && args.status === "sent") {
        await ctx.db.patch(existing._id, { status: "sent", at: Date.now() });
      }
      return { ok: true as const, id: existing._id, duplicate: true };
    }
    const id = await ctx.db.insert("automationEvents", {
      idempotencyKey: args.idempotencyKey,
      loanId: loanId ?? undefined,
      kind: args.kind,
      status: args.status,
      detail: redactDetail(args.detail),
      at: Date.now(),
    });
    return { ok: true as const, id, duplicate: false };
  },
});

/** How long automation history is kept (the privacy page says 90 days). */
export const RETENTION_DAYS = 90;
const PURGE_BATCH = 500;

/**
 * Deletes automation history older than RETENTION_DAYS: finished webhook
 * deliveries (delivered or permanently failed; pending ones are never
 * touched) and n8n write-backs. Their idempotency keys only matter while a
 * retry is possible, which is minutes, not months. Batched and rescheduled
 * until nothing old is left. Run daily by convex/crons.ts.
 */
export const purgeOld = internalMutation({
  args: {},
  handler: async (ctx) => {
    const cutoff = Date.now() - RETENTION_DAYS * 24 * 60 * 60 * 1000;
    let deleted = 0;
    for (const status of ["delivered", "failed"] as const) {
      const rows = await ctx.db
        .query("webhookDeliveries")
        .withIndex("by_status", (q) => q.eq("status", status).lt("_creationTime", cutoff))
        .take(PURGE_BATCH - deleted);
      for (const row of rows) await ctx.db.delete(row._id);
      deleted += rows.length;
    }
    const events = await ctx.db
      .query("automationEvents")
      .withIndex("by_creation_time", (q) => q.lt("_creationTime", cutoff))
      .take(PURGE_BATCH - deleted);
    for (const row of events) await ctx.db.delete(row._id);
    deleted += events.length;
    if (deleted >= PURGE_BATCH) await ctx.scheduler.runAfter(0, internal.automation.purgeOld, {});
    return { deleted };
  },
});
