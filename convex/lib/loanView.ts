import { numberedPage, type NumberedPageArgs } from "./pagination";
import type { Doc, Id } from "../_generated/dataModel";
import type { QueryCtx } from "../_generated/server";
import { todayUtc } from "./dates";
import type { LoanPhase } from "./loanRecord";
import { firstName } from "./people";
import { searchTerm } from "./search";

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

export type LoanListArgs = NumberedPageArgs & {
  search?: string;
  phase?: LoanPhase;
  /** Restrict to one party's loans; omitted only for the admin view. */
  party?: { field: "borrowerId" | "lenderId"; userId: Id<"users"> };
};

/**
 * One page of loans, newest first (or by relevance when searching by tool
 * name), filtered by party and phase on the server.
 */
function loanQuery(ctx: QueryCtx, { search, phase, party }: LoanListArgs) {
  const term = searchTerm(search);
  const loans = ctx.db.query("loans");
  if (term) {
    return loans
      .withSearchIndex("search", (q) => {
        let s = q.search("toolName", term);
        if (party) s = s.eq(party.field, party.userId);
        if (phase) s = s.eq("phase", phase);
        return s;
      });
  }
  if (party?.field === "borrowerId") {
    return phase
      ? loans.withIndex("by_borrower_phase", (q) => q.eq("borrowerId", party.userId).eq("phase", phase)).order("desc")
      : loans.withIndex("by_borrower", (q) => q.eq("borrowerId", party.userId)).order("desc");
  }
  if (party?.field === "lenderId") {
    return phase
      ? loans.withIndex("by_lender_phase", (q) => q.eq("lenderId", party.userId).eq("phase", phase)).order("desc")
      : loans.withIndex("by_lender", (q) => q.eq("lenderId", party.userId)).order("desc");
  }
  return phase
    ? loans.withIndex("by_phase", (q) => q.eq("phase", phase)).order("desc")
    : loans.order("desc");
}

export async function pageLoans(ctx: QueryCtx, args: LoanListArgs) {
  return numberedPage(loanQuery(ctx, args), args);
}
