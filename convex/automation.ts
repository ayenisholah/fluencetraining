import { v } from "convex/values";
import { internalMutation, internalQuery } from "./_generated/server";
import { daysBetween } from "./lib/dates";
import { overdueReminderEmail } from "./lib/email/reminderEmail";
import { firstName } from "./lib/people";
import { vAutomationKind } from "./schema";

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
      .withIndex("by_status_end", (q) =>
        q.eq("status", "approved").lt("endDate", asOf),
      )
      .take(500);
    // Per-loan lookups are independent; run them together and keep the order.
    const rows = await Promise.all(
      loans.map(async (loan) => {
        const idempotencyKey = reminderKey(loan._id, asOf);
        const [sent, tool, borrower, lender] = await Promise.all([
          ctx.db.query("automationEvents").withIndex("by_key", (q) => q.eq("idempotencyKey", idempotencyKey)).unique(),
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
    const loanId = args.loanId
      ? ctx.db.normalizeId("loans", args.loanId)
      : undefined;
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
      detail: args.detail?.slice(0, 500),
      at: Date.now(),
    });
    return { ok: true as const, id, duplicate: false };
  },
});
