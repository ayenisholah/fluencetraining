// Operator/testing helpers. Internal functions cannot be called from the
// browser; run them with `npx convex run dev:<name>`.
import { v } from "convex/values";
import { internalMutation } from "./_generated/server";
import { todayUtc } from "./lib/dates";

const DAY = 86_400_000;

/** Moves an approved loan into the past so the overdue workflow picks it up. */
export const backdateLoan = internalMutation({
  args: { loanId: v.id("loans"), daysOverdue: v.optional(v.number()) },
  handler: async (ctx, { loanId, daysOverdue = 2 }) => {
    const loan = await ctx.db.get(loanId);
    if (!loan || loan.status !== "approved") throw new Error("Not an approved loan.");
    const endDate = todayUtc(Date.now() - daysOverdue * DAY);
    const startDate = todayUtc(Date.now() - (daysOverdue + 3) * DAY);
    await ctx.db.patch(loanId, { startDate, endDate });
    return { startDate, endDate };
  },
});
