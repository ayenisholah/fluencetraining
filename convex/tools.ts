import { v } from "convex/values";
import type { Doc, Id } from "./_generated/dataModel";
import { mutation, query, type MutationCtx } from "./_generated/server";
import { badRequest, requireToolOwner, requireUser } from "./lib/auth";
import { enqueueLoanEvent } from "./lib/outbox";
import { firstName } from "./lib/people";
import { assertWithinRateLimit } from "./lib/rateLimit";
import { toolFieldErrors } from "./lib/rules";
import { vCategory, vCondition } from "./schema";

function cleanFields(fields: { name: string; description: string }) {
  const errors = toolFieldErrors(fields);
  const first = errors.name ?? errors.description;
  if (first) badRequest(first);
  return { name: fields.name.trim(), description: fields.description.trim() };
}

/**
 * Public, unauthenticated. Returns only id, name and category of listed tools:
 * no owner, condition, description or availability. The id is a stable React
 * key for live updates and reveals nothing about the lender.
 */
export const listPublic = query({
  args: {},
  handler: async (ctx) => {
    const tools = await ctx.db
      .query("tools")
      .withIndex("by_status", (q) => q.eq("status", "available"))
      .order("desc")
      .take(100);
    return tools.map((tool) => ({ _id: tool._id, name: tool.name, category: tool.category }));
  },
});

/** Signed-in browse view, optionally filtered by category. */
export const list = query({
  args: { category: v.optional(vCategory) },
  handler: async (ctx, { category }) => {
    const user = await requireUser(ctx);
    // Everything except removed tools, newest first. The two status reads are
    // independent, so run them together.
    const byStatus = (status: "available" | "on_loan") =>
      category
        ? ctx.db
            .query("tools")
            .withIndex("by_category_status", (q) => q.eq("category", category).eq("status", status))
            .take(200)
        : ctx.db
            .query("tools")
            .withIndex("by_status", (q) => q.eq("status", status))
            .take(200);
    const results = (await Promise.all([byStatus("available"), byStatus("on_loan")])).flat();
    results.sort((a, b) => b._creationTime - a._creationTime);
    // One lookup per lender, not per tool: neighbours tend to list several.
    const owners = new Map<Id<"users">, Promise<Doc<"users"> | null>>();
    const ownerOf = (id: Id<"users">) => {
      if (!owners.has(id)) owners.set(id, ctx.db.get(id));
      return owners.get(id)!;
    };
    return await Promise.all(
      results.map(async (tool) => {
        const owner = await ownerOf(tool.ownerId);
        return {
          _id: tool._id,
          name: tool.name,
          category: tool.category,
          condition: tool.condition,
          description: tool.description,
          status: tool.status,
          isMine: tool.ownerId === user._id,
          // First name only; lenders' emails are never sent to other users.
          lenderName: firstName(owner?.name),
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
    await assertWithinRateLimit(ctx, "listing", user._id);
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

/**
 * Soft-removes a tool and declines its open requests. Shared by owner/admin.
 * Owners must wait for an active loan to come back; admins (moderation) may
 * remove mid-loan: the loan stays open so the lender can still mark it
 * returned, and the tool stays removed afterwards.
 */
export async function removeTool(
  ctx: MutationCtx,
  tool: Doc<"tools">,
  removedBy: Doc<"users">,
  { allowOnLoan = false }: { allowOnLoan?: boolean } = {},
): Promise<void> {
  if (tool.status === "on_loan" && !allowOnLoan) {
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
