import { v } from "convex/values";
import type { Doc } from "./_generated/dataModel";
import { mutation, query, type MutationCtx } from "./_generated/server";
import { badRequest, requireToolOwner, requireUser } from "./lib/auth";
import { enqueueLoanEvent } from "./lib/outbox";
import { vCategory, vCondition } from "./schema";

const LIMITS = { name: 80, description: 500 };

function cleanFields(fields: { name: string; description: string }) {
  const name = fields.name.trim();
  const description = fields.description.trim();
  if (name.length < 2 || name.length > LIMITS.name) {
    badRequest(`Name must be 2–${LIMITS.name} characters.`);
  }
  if (description.length > LIMITS.description) {
    badRequest(`Description must be at most ${LIMITS.description} characters.`);
  }
  return { name, description };
}

/**
 * Public, unauthenticated. Returns only name and category of listed tools:
 * no owner, condition, description or availability.
 */
export const listPublic = query({
  args: {},
  handler: async (ctx) => {
    const tools = await ctx.db
      .query("tools")
      .withIndex("by_status", (q) => q.eq("status", "available"))
      .order("desc")
      .take(100);
    return tools.map((tool) => ({ name: tool.name, category: tool.category }));
  },
});

/** Signed-in browse view, optionally filtered by category. */
export const list = query({
  args: { category: v.optional(vCategory) },
  handler: async (ctx, { category }) => {
    const user = await requireUser(ctx);
    const statuses = ["available", "on_loan"] as const;
    const results: Doc<"tools">[] = [];
    for (const status of statuses) {
      const rows = category
        ? await ctx.db
            .query("tools")
            .withIndex("by_category_status", (q) =>
              q.eq("category", category).eq("status", status),
            )
            .take(200)
        : await ctx.db
            .query("tools")
            .withIndex("by_status", (q) => q.eq("status", status))
            .take(200);
      results.push(...rows);
    }
    results.sort((a, b) => b._creationTime - a._creationTime);
    return await Promise.all(
      results.map(async (tool) => {
        const owner = await ctx.db.get(tool.ownerId);
        return {
          _id: tool._id,
          name: tool.name,
          category: tool.category,
          condition: tool.condition,
          description: tool.description,
          status: tool.status,
          isMine: tool.ownerId === user._id,
          // First name only; lenders' emails are never sent to other users.
          lenderName: owner?.name.split(" ")[0] ?? "Neighbour",
          trustedLender: owner?.trustedLender ?? false,
        };
      }),
    );
  },
});

export const mine = query({
  args: {},
  handler: async (ctx) => {
    const user = await requireUser(ctx);
    const tools = await ctx.db
      .query("tools")
      .withIndex("by_owner", (q) => q.eq("ownerId", user._id))
      .order("desc")
      .collect();
    return tools.filter((tool) => tool.status !== "removed");
  },
});

export const create = mutation({
  args: {
    name: v.string(),
    category: vCategory,
    condition: vCondition,
    description: v.string(),
  },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    return await ctx.db.insert("tools", {
      ...args,
      ...cleanFields(args),
      ownerId: user._id,
      status: "available",
    });
  },
});

export const update = mutation({
  args: {
    toolId: v.id("tools"),
    name: v.string(),
    category: vCategory,
    condition: vCondition,
    description: v.string(),
  },
  handler: async (ctx, { toolId, ...fields }) => {
    await requireToolOwner(ctx, toolId);
    await ctx.db.patch(toolId, { ...fields, ...cleanFields(fields) });
  },
});

/** Soft-removes a tool and declines its open requests. Shared by owner/admin. */
export async function removeTool(
  ctx: MutationCtx,
  tool: Doc<"tools">,
  removedBy: Doc<"users">,
): Promise<void> {
  if (tool.status === "on_loan") {
    badRequest("This tool is on loan. Mark it returned first.");
  }
  const open = await ctx.db
    .query("loans")
    .withIndex("by_tool_status", (q) =>
      q.eq("toolId", tool._id).eq("status", "requested"),
    )
    .collect();
  for (const loan of open) {
    await ctx.db.patch(loan._id, { status: "declined", decidedAt: Date.now() });
    await enqueueLoanEvent(ctx, loan._id, "loan.declined");
  }
  await ctx.db.patch(tool._id, { status: "removed", removedBy: removedBy._id });
}

export const remove = mutation({
  args: { toolId: v.id("tools") },
  handler: async (ctx, { toolId }) => {
    const { user, tool } = await requireToolOwner(ctx, toolId);
    await removeTool(ctx, tool, user);
  },
});
