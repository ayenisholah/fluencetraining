import { pageArgs, numberedPage } from "./lib/pagination";
import { v } from "convex/values";
import { internal } from "./_generated/api";
import { mutation, query } from "./_generated/server";
import { badRequest, notFound, requireAdmin } from "./lib/auth";
import { todayUtc } from "./lib/dates";
import { imageUrl } from "./lib/images";
import { describeLoan, pageLoans } from "./lib/loanView";
import { searchTerm, vSearch } from "./lib/search";
import { vCategory, vLoanPhase } from "./schema";
import { removeTool } from "./tools";

/** Every loan across all users, newest first, a page at a time; searchable by tool name. */
export const allLoans = query({
  args: { ...pageArgs, search: vSearch, phase: v.optional(vLoanPhase) },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    const result = await pageLoans(ctx, args);
    return { ...result, page: await Promise.all(result.page.map((l) => describeLoan(ctx, l, "admin"))) };
  },
});

/** Members, searchable by name or email, filterable to admins or trusted lenders. */
export const users = query({
  args: {
    ...pageArgs,
    search: vSearch,
    filter: v.optional(v.union(v.literal("admins"), v.literal("trusted"))),
  },
  handler: async (ctx, { pageNumber, pageSize, search, filter }) => {
    await requireAdmin(ctx);
    const term = searchTerm(search);
    const users = ctx.db.query("users");
    const source = term
      ? users.withSearchIndex("search", (q) => {
          const s = q.search("searchText", term);
          return filter === "admins" ? s.eq("role", "admin") : filter === "trusted" ? s.eq("trustedLender", true) : s;
        })
      : filter === "admins"
        ? users.withIndex("by_role", (q) => q.eq("role", "admin")).order("desc")
        : filter === "trusted"
          ? users.withIndex("by_trusted", (q) => q.eq("trustedLender", true)).order("desc")
          : users.order("desc");
    const result = await numberedPage(source, { pageNumber, pageSize });
    return {
      ...result,
      page: result.page.map((u) => ({
        _id: u._id,
        name: u.name,
        email: u.email,
        role: u.role,
        trustedLender: u.trustedLender,
      })),
    };
  },
});

/** Every live listing with its owner, searchable, by category. */
export const listings = query({
  args: { ...pageArgs, search: vSearch, category: v.optional(vCategory) },
  handler: async (ctx, { pageNumber, pageSize, search, category }) => {
    await requireAdmin(ctx);
    const term = searchTerm(search);
    const tools = ctx.db.query("tools");
    const source = term
      ? tools.withSearchIndex("search", (q) => {
          const s = q.search("searchText", term).eq("listed", true);
          return category ? s.eq("category", category) : s;
        })
      : category
        ? tools.withIndex("by_listed_category", (q) => q.eq("listed", true).eq("category", category)).order("desc")
        : tools.withIndex("by_listed", (q) => q.eq("listed", true)).order("desc");
    const result = await numberedPage(source, { pageNumber, pageSize });
    return {
      ...result,
      page: await Promise.all(
        result.page.map(async (t) => ({
          _id: t._id,
          name: t.name,
          category: t.category,
          status: t.status,
          imageUrl: await imageUrl(ctx, t.imageId),
          ownerName: (await ctx.db.get(t.ownerId))?.name ?? "Unknown",
        })),
      ),
    };
  },
});

export const setTrustedLender = mutation({
  args: { userId: v.id("users"), trusted: v.boolean() },
  handler: async (ctx, { userId, trusted }) => {
    await requireAdmin(ctx);
    if (!(await ctx.db.get(userId))) notFound("User");
    await ctx.db.patch(userId, { trustedLender: trusted });
  },
});

export const removeListing = mutation({
  args: { toolId: v.id("tools") },
  handler: async (ctx, { toolId }) => {
    const admin = await requireAdmin(ctx);
    const tool = await ctx.db.get(toolId);
    if (!tool || tool.status === "removed") notFound("Tool");
    await removeTool(ctx, tool, admin, { allowOnLoan: true });
  },
});

/** One atomic, admin-only removal of a visible page of listings. */
export const removeListings = mutation({
  args: { toolIds: v.array(v.id("tools")) },
  handler: async (ctx, { toolIds }) => {
    const admin = await requireAdmin(ctx);
    if (toolIds.length < 1 || toolIds.length > 100) badRequest("Select between 1 and 100 listings.");
    let removedCount = 0;
    let skippedCount = 0;
    for (const toolId of new Set(toolIds)) {
      const tool = await ctx.db.get(toolId);
      if (!tool || tool.status === "removed") {
        skippedCount++;
        continue;
      }
      await removeTool(ctx, tool, admin, { allowOnLoan: true });
      removedCount++;
    }
    return { removedCount, skippedCount };
  },
});

/** Pending and failed webhook deliveries plus recent n8n workflow errors. */
export const automationHealth = query({
  args: {},
  handler: async (ctx) => {
    await requireAdmin(ctx);
    const [failed, pending, errors] = await Promise.all([
      ctx.db
        .query("webhookDeliveries")
        .withIndex("by_status", (q) => q.eq("status", "failed"))
        .order("desc")
        .take(50),
      ctx.db
        .query("webhookDeliveries")
        .withIndex("by_status", (q) => q.eq("status", "pending"))
        .order("desc")
        .take(50),
      ctx.db
        .query("automationEvents")
        .withIndex("by_kind", (q) => q.eq("kind", "workflow_error"))
        .order("desc")
        .take(20),
    ]);
    return {
      deliveries: [...failed, ...pending].map((d) => ({
        _id: d._id,
        event: d.event,
        status: d.status,
        attempts: d.attempts,
        lastError: d.lastError,
        nextAttemptAt: d.nextAttemptAt,
        createdAt: d._creationTime,
      })),
      workflowErrors: errors.map((e) => ({
        _id: e._id,
        detail: e.detail,
        at: e.at,
      })),
    };
  },
});

export const retryDelivery = mutation({
  args: { deliveryId: v.id("webhookDeliveries") },
  handler: async (ctx, { deliveryId }) => {
    await requireAdmin(ctx);
    const delivery = await ctx.db.get(deliveryId);
    if (!delivery) notFound("Delivery");
    if (delivery.status !== "failed") badRequest("Only failed deliveries can be retried.");
    await ctx.db.patch(deliveryId, {
      status: "pending",
      attempts: 0,
      lastError: undefined,
    });
    await ctx.scheduler.runAfter(0, internal.webhooks.deliver, { deliveryId });
  },
});

/** Headline numbers for the admin dashboard. */
export const stats = query({
  args: {},
  handler: async (ctx) => {
    await requireAdmin(ctx);
    const today = todayUtc();
    const [requested, approved, failed] = await Promise.all([
      ctx.db
        .query("loans")
        .withIndex("by_status_end", (q) => q.eq("status", "requested"))
        .collect(),
      ctx.db
        .query("loans")
        .withIndex("by_status_end", (q) => q.eq("status", "approved"))
        .collect(),
      ctx.db
        .query("webhookDeliveries")
        .withIndex("by_status", (q) => q.eq("status", "failed"))
        .collect(),
    ]);
    return {
      openRequests: requested.length,
      activeLoans: approved.length,
      overdueLoans: approved.filter((l) => l.endDate < today).length,
      failedDeliveries: failed.length,
    };
  },
});
