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
import { describeLoan } from "./lib/loanView";
import { enqueueLoanEvent } from "./lib/outbox";
import { assertWithinRateLimit } from "./lib/rateLimit";

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
    const mine = await ctx.db
      .query("loans")
      .withIndex("by_tool_status", (q) =>
        q.eq("toolId", toolId).eq("status", "requested"),
      )
      .filter((q) => q.eq(q.field("borrowerId"), user._id))
      .first();
    if (mine) badRequest("You already have an open request for this tool.");

    const loanId = await ctx.db.insert("loans", {
      toolId,
      borrowerId: user._id,
      lenderId: tool.ownerId,
      startDate,
      endDate,
      status: "requested",
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
    await ctx.db.patch(loanId, { status: "approved", decidedAt: Date.now() });
    await ctx.db.patch(tool._id, { status: "on_loan" });
    await enqueueLoanEvent(ctx, loanId, "loan.approved");
  },
});

export const decline = mutation({
  args: { loanId: v.id("loans") },
  handler: async (ctx, { loanId }) => {
    const { loan } = await requireLoanParty(ctx, loanId, "lender");
    if (loan.status !== "requested") badRequest("This request is not open.");
    await ctx.db.patch(loanId, { status: "declined", decidedAt: Date.now() });
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
    await ctx.db.patch(loanId, { status: "cancelled", decidedAt: Date.now() });
    await enqueueLoanEvent(ctx, loanId, "loan.cancelled");
  },
});

export const markReturned = mutation({
  args: { loanId: v.id("loans") },
  handler: async (ctx, { loanId }) => {
    const { loan } = await requireLoanParty(ctx, loanId, "lender");
    if (loan.status !== "approved") badRequest("This loan is not active.");
    await ctx.db.patch(loanId, { status: "returned", returnedAt: Date.now() });
    const tool = await ctx.db.get(loan.toolId);
    if (tool && tool.status === "on_loan") {
      await ctx.db.patch(tool._id, { status: "available" });
    }
    await enqueueLoanEvent(ctx, loanId, "loan.returned");
  },
});

export const myRequests = query({
  args: {},
  handler: async (ctx) => {
    const user = await requireUser(ctx);
    const loans = await ctx.db
      .query("loans")
      .withIndex("by_borrower", (q) => q.eq("borrowerId", user._id))
      .order("desc")
      .take(100);
    return await Promise.all(loans.map((l) => describeLoan(ctx, l, "borrower")));
  },
});

export const incoming = query({
  args: {},
  handler: async (ctx) => {
    const user = await requireUser(ctx);
    const loans = await ctx.db
      .query("loans")
      .withIndex("by_lender", (q) => q.eq("lenderId", user._id))
      .order("desc")
      .take(100);
    return await Promise.all(loans.map((l) => describeLoan(ctx, l, "lender")));
  },
});

