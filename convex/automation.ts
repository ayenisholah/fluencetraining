import { v } from "convex/values";
import { internalMutation, internalQuery } from "./_generated/server";
import { daysBetween } from "./lib/dates";
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
    const results = [];
    for (const loan of loans) {
      const sent = await ctx.db
        .query("automationEvents")
        .withIndex("by_key", (q) =>
          q.eq("idempotencyKey", reminderKey(loan._id, asOf)),
        )
        .unique();
      if (sent?.status === "sent") continue;
      const [tool, borrower] = await Promise.all([
        ctx.db.get(loan.toolId),
        ctx.db.get(loan.borrowerId),
      ]);
      if (!borrower?.email) continue;
      results.push({
        loanId: loan._id,
        idempotencyKey: reminderKey(loan._id, asOf),
        toolName: tool?.name ?? "a tool",
        endDate: loan.endDate,
        daysOverdue: daysBetween(loan.endDate, asOf),
        borrower: { email: borrower.email, firstName: borrower.name.split(" ")[0] },
      });
    }
    return results;
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
