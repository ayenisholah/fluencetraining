import { v } from "convex/values";
import { internal } from "./_generated/api";
import { mutation, query } from "./_generated/server";
import { badRequest, notFound, requireAdmin } from "./lib/auth";
import { todayUtc } from "./lib/dates";
import { describeLoan } from "./loans";
import { removeTool } from "./tools";

export const allLoans = query({
  args: {},
  handler: async (ctx) => {
    await requireAdmin(ctx);
    const loans = await ctx.db.query("loans").order("desc").take(200);
    return await Promise.all(loans.map((l) => describeLoan(ctx, l, "admin")));
  },
});

export const users = query({
  args: {},
  handler: async (ctx) => {
    await requireAdmin(ctx);
    const users = await ctx.db.query("users").take(500);
    return users.map((u) => ({
      _id: u._id,
      name: u.name,
      email: u.email,
      role: u.role,
      trustedLender: u.trustedLender,
    }));
  },
});

export const listings = query({
  args: {},
  handler: async (ctx) => {
    await requireAdmin(ctx);
    const tools = await ctx.db.query("tools").order("desc").take(300);
    const live = tools.filter((t) => t.status !== "removed");
    return await Promise.all(
      live.map(async (t) => ({
        _id: t._id,
        name: t.name,
        category: t.category,
        status: t.status,
        ownerName: (await ctx.db.get(t.ownerId))?.name ?? "Unknown",
      })),
    );
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
    await removeTool(ctx, tool, admin);
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
      ctx.db.query("loans").withIndex("by_status_end", (q) => q.eq("status", "requested")).collect(),
      ctx.db.query("loans").withIndex("by_status_end", (q) => q.eq("status", "approved")).collect(),
      ctx.db.query("webhookDeliveries").withIndex("by_status", (q) => q.eq("status", "failed")).collect(),
    ]);
    return {
      openRequests: requested.length,
      activeLoans: approved.length,
      overdueLoans: approved.filter((l) => l.endDate < today).length,
      failedDeliveries: failed.length,
    };
  },
});
