import { pageArgs } from "./lib/pagination";
import { v } from "convex/values";
import type { Doc } from "./_generated/dataModel";
import { mutation, query, type QueryCtx } from "./_generated/server";
import {
  badRequest,
  notFound,
  requireLoanParty,
  requireUser,
} from "./lib/auth";
import { rangesOverlap, todayUtc, validateLoanDates } from "./lib/dates";
import { setToolStatus } from "./lib/toolRecord";
import { loanPhase, setLoanStatus } from "./lib/loanRecord";
import { describeLoan, pageLoans } from "./lib/loanView";
import { enqueueLoanEvent } from "./lib/outbox";
import { assertWithinRateLimit } from "./lib/rateLimit";
import { vSearch } from "./lib/search";
import { vLoanPhase } from "./schema";

async function activeLoanFor(ctx: QueryCtx, toolId: Doc<"tools">["_id"]) {
  return await ctx.db
    .query("loans")
    .withIndex("by_tool_status", (q) =>
      q.eq("toolId", toolId).eq("status", "approved"),
    )
    .first();
}

export const request = mutation({
  args: {
    toolId: v.id("tools"),
    startDate: v.string(),
    endDate: v.string(),
  },
  handler: async (ctx, { toolId, startDate, endDate }) => {
    const user = await requireUser(ctx);
    const tool = await ctx.db.get(toolId);
    if (!tool || tool.status === "removed") notFound("Tool");
    if (tool.ownerId === user._id) badRequest("You can't borrow your own tool.");
    validateLoanDates(startDate, endDate);
    await assertWithinRateLimit(ctx, "request", user._id);

    const active = await activeLoanFor(ctx, toolId);
    if (active && rangesOverlap(active, { startDate, endDate })) {
      badRequest("The tool is already lent out for those dates.");
    }
    // Keep the read range borrower-specific: other borrowers may request the
    // same tool without exhausting OCC retries on this duplicate check.
    const mine = await ctx.db
      .query("loans")
      .withIndex("by_tool_borrower_status", (q) =>
        q.eq("toolId", toolId).eq("borrowerId", user._id).eq("status", "requested"),
      )
      .first();
    if (mine) badRequest("You already have an open request for this tool.");

    const loanId = await ctx.db.insert("loans", {
      toolId,
      borrowerId: user._id,
      lenderId: tool.ownerId,
      startDate,
      endDate,
      status: "requested",
      phase: loanPhase("requested"),
      toolName: tool.name,
    });
    await enqueueLoanEvent(ctx, loanId, "loan.requested");
    return loanId;
  },
});

export const approve = mutation({
  args: { loanId: v.id("loans") },
  handler: async (ctx, { loanId }) => {
    const { loan } = await requireLoanParty(ctx, loanId, "lender");
    if (loan.status !== "requested") badRequest("This request is not open.");
    // A stale request would start life as an overdue loan; decline it instead.
    if (loan.endDate < todayUtc()) badRequest("This request's dates have passed.");
    const tool = await ctx.db.get(loan.toolId);
    if (!tool || tool.status === "removed") notFound("Tool");
    if (await activeLoanFor(ctx, loan.toolId)) {
      badRequest("The tool is already lent out. Mark it returned first.");
    }
    await setLoanStatus(ctx, loanId, "approved", { decidedAt: Date.now() });
    await setToolStatus(ctx, tool._id, "on_loan");
    await enqueueLoanEvent(ctx, loanId, "loan.approved");
  },
});

export const decline = mutation({
  args: { loanId: v.id("loans") },
  handler: async (ctx, { loanId }) => {
    const { loan } = await requireLoanParty(ctx, loanId, "lender");
    if (loan.status !== "requested") badRequest("This request is not open.");
    await setLoanStatus(ctx, loanId, "declined", { decidedAt: Date.now() });
    await enqueueLoanEvent(ctx, loanId, "loan.declined");
  },
});

export const cancel = mutation({
  args: { loanId: v.id("loans") },
  handler: async (ctx, { loanId }) => {
    const { loan } = await requireLoanParty(ctx, loanId, "borrower");
    if (loan.status !== "requested") {
      badRequest("Only open requests can be cancelled.");
    }
    await setLoanStatus(ctx, loanId, "cancelled", { decidedAt: Date.now() });
    await enqueueLoanEvent(ctx, loanId, "loan.cancelled");
  },
});

export const markReturned = mutation({
  args: { loanId: v.id("loans") },
  handler: async (ctx, { loanId }) => {
    const { loan } = await requireLoanParty(ctx, loanId, "lender");
    if (loan.status !== "approved") badRequest("This loan is not active.");
    await setLoanStatus(ctx, loanId, "returned", { returnedAt: Date.now() });
    const tool = await ctx.db.get(loan.toolId);
    if (tool && tool.status === "on_loan") {
      await setToolStatus(ctx, tool._id, "available");
    }
    await enqueueLoanEvent(ctx, loanId, "loan.returned");
  },
});

const loanListArgs = { ...pageArgs, search: vSearch, phase: v.optional(vLoanPhase) };

/** Loans the caller asked to borrow, searchable by tool name, by phase. */
export const myRequests = query({
  args: loanListArgs,
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    const result = await pageLoans(ctx, { ...args, party: { field: "borrowerId", userId: user._id } });
    return { ...result, page: await Promise.all(result.page.map((l) => describeLoan(ctx, l, "borrower"))) };
  },
});

/** Requests for the caller's tools, searchable by tool name, by phase. */
export const incoming = query({
  args: loanListArgs,
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    const result = await pageLoans(ctx, { ...args, party: { field: "lenderId", userId: user._id } });
    return { ...result, page: await Promise.all(result.page.map((l) => describeLoan(ctx, l, "lender"))) };
  },
});

/** Open requests waiting on the caller, for the sidebar badge (capped at 100). */
export const pendingIncomingCount = query({
  args: {},
  handler: async (ctx) => {
    const user = await requireUser(ctx);
    const open = await ctx.db
      .query("loans")
      .withIndex("by_lender_phase", (q) => q.eq("lenderId", user._id).eq("phase", "open"))
      .take(100);
    return open.length;
  },
});
