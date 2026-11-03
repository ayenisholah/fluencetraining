import type { Doc } from "../_generated/dataModel";
import type { QueryCtx } from "../_generated/server";
import { todayUtc } from "./dates";
import { firstName } from "./people";

/** Recent automation events shown on a loan card ("Reminder sent 2 days ago"). */
export const ACTIVITY_LIMIT = 5;

/** Loan rows enriched for display, with recent automation activity. */
export async function describeLoan(
  ctx: QueryCtx,
  loan: Doc<"loans">,
  viewer: "lender" | "borrower" | "admin",
) {
  const [tool, lender, borrower] = await Promise.all([
    ctx.db.get(loan.toolId),
    ctx.db.get(loan.lenderId),
    ctx.db.get(loan.borrowerId),
  ]);
  const activity = await ctx.db
    .query("automationEvents")
    .withIndex("by_loan", (q) => q.eq("loanId", loan._id))
    .order("desc")
    .take(ACTIVITY_LIMIT);
  const counterpart = viewer === "lender" ? borrower : lender;
  return {
    _id: loan._id,
    toolName: tool?.name ?? "Removed tool",
    toolCategory: tool?.category,
    startDate: loan.startDate,
    endDate: loan.endDate,
    status: loan.status,
    overdue: loan.status === "approved" && loan.endDate < todayUtc(),
    counterpartName: firstName(counterpart?.name),
    ...(viewer === "admin"
      ? { lenderName: lender?.name, borrowerName: borrower?.name }
      : {}),
    activity: activity.map((event) => ({
      kind: event.kind,
      status: event.status,
      at: event.at,
    })),
  };
}
