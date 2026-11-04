import { pageArgs, numberedPage } from "./lib/pagination";
import { v } from "convex/values";
import type { Doc, Id } from "./_generated/dataModel";
import { mutation, query, type MutationCtx, type QueryCtx } from "./_generated/server";
import { badRequest, requireToolOwner, requireUser } from "./lib/auth";
import { assertUsableImage, deleteImage, imageUrl } from "./lib/images";
import { renameToolOnLoans, setLoanStatus } from "./lib/loanRecord";
import { enqueueLoanEvent } from "./lib/outbox";
import { firstName } from "./lib/people";
import { assertWithinRateLimit } from "./lib/rateLimit";
import { toolFieldErrors } from "./lib/rules";
import { searchTerm, vSearch } from "./lib/search";
import { setToolStatus, toolSearchFields } from "./lib/toolRecord";
import { vCategory, vCondition } from "./schema";

function cleanFields(fields: { name: string; description: string }) {
  const errors = toolFieldErrors(fields);
  const first = errors.name ?? errors.description;
  if (first) badRequest(first);
  return { name: fields.name.trim(), description: fields.description.trim() };
}

/** One lookup per lender per request, not per tool: neighbours tend to list several. */
function ownerLoader(ctx: QueryCtx) {
  const owners = new Map<Id<"users">, Promise<Doc<"users"> | null>>();
  return (id: Id<"users">) => {
    if (!owners.has(id)) owners.set(id, ctx.db.get(id));
    return owners.get(id)!;
  };
}

/**
 * Public, unauthenticated, paginated and searchable. Returns only id, name and
 * category of available tools: no owner, condition, description or photo. The
 * id is a stable React key and reveals nothing about the lender.
 */
export const listPublic = query({
  args: { ...pageArgs, search: vSearch, category: v.optional(vCategory) },
  handler: async (ctx, { pageNumber, pageSize, search, category }) => {
    const term = searchTerm(search);
    const source = term
      ? ctx.db.query("tools").withSearchIndex("search", (q) => {
          const base = q.search("searchText", term).eq("status", "available");
          return category ? base.eq("category", category) : base;
        })
      : category
        ? ctx.db
            .query("tools")
            .withIndex("by_category_status", (q) => q.eq("category", category).eq("status", "available"))
            .order("desc")
        : ctx.db
            .query("tools")
            .withIndex("by_status", (q) => q.eq("status", "available"))
            .order("desc");
    const result = await numberedPage(source, { pageNumber, pageSize });
    return {
      ...result,
      page: result.page.map((tool) => ({ _id: tool._id, name: tool.name, category: tool.category })),
    };
  },
});

/**
 * Signed-in board: every listed tool (available or on loan), newest first or by
 * search relevance, filterable by category and availability.
 */
export const list = query({
  args: {
    ...pageArgs,
    search: vSearch,
    category: v.optional(vCategory),
    availableOnly: v.optional(v.boolean()),
  },
  handler: async (ctx, { pageNumber, pageSize, search, category, availableOnly }) => {
    const user = await requireUser(ctx);
    const term = searchTerm(search);
    const source = term
      ? ctx.db.query("tools").withSearchIndex("search", (q) => {
          let s = q.search("searchText", term).eq("listed", true);
          if (availableOnly) s = s.eq("status", "available");
          if (category) s = s.eq("category", category);
          return s;
        })
      : availableOnly
        ? category
          ? ctx.db
              .query("tools")
              .withIndex("by_category_status", (q) => q.eq("category", category).eq("status", "available"))
              .order("desc")
          : ctx.db
              .query("tools")
              .withIndex("by_status", (q) => q.eq("status", "available"))
              .order("desc")
        : category
          ? ctx.db
              .query("tools")
              .withIndex("by_listed_category", (q) => q.eq("listed", true).eq("category", category))
              .order("desc")
          : ctx.db
              .query("tools")
              .withIndex("by_listed", (q) => q.eq("listed", true))
              .order("desc");
    const result = await numberedPage(source, { pageNumber, pageSize });
    const ownerOf = ownerLoader(ctx);
    const page = await Promise.all(
      result.page.map(async (tool) => {
        const [owner, url] = await Promise.all([ownerOf(tool.ownerId), imageUrl(ctx, tool.imageId)]);
        return {
          _id: tool._id,
          name: tool.name,
          category: tool.category,
          condition: tool.condition,
          description: tool.description,
          status: tool.status,
          imageUrl: url,
          isMine: tool.ownerId === user._id,
          // First name only; lenders' emails are never sent to other users.
          lenderName: firstName(owner?.name),
          trustedLender: owner?.trustedLender ?? false,
        };
      }),
    );
    return { ...result, page };
  },
});

/** The caller's own listings, searchable, optionally by status. */
export const mine = query({
  args: {
    ...pageArgs,
    search: vSearch,
    status: v.optional(v.union(v.literal("available"), v.literal("on_loan"))),
  },
  handler: async (ctx, { pageNumber, pageSize, search, status }) => {
    const user = await requireUser(ctx);
    const term = searchTerm(search);
    const source = term
      ? ctx.db.query("tools").withSearchIndex("search", (q) => {
          const base = q.search("searchText", term).eq("ownerId", user._id).eq("listed", true);
          return status ? base.eq("status", status) : base;
        })
      : status
        ? ctx.db
            .query("tools")
            .withIndex("by_owner_status", (q) => q.eq("ownerId", user._id).eq("status", status))
            .order("desc")
        : ctx.db
            .query("tools")
            .withIndex("by_owner_listed", (q) => q.eq("ownerId", user._id).eq("listed", true))
            .order("desc");
    const result = await numberedPage(source, { pageNumber, pageSize });
    const page = await Promise.all(
      result.page.map(async (tool) => ({
        _id: tool._id,
        name: tool.name,
        category: tool.category,
        condition: tool.condition,
        description: tool.description,
        status: tool.status,
        imageId: tool.imageId,
        imageUrl: await imageUrl(ctx, tool.imageId),
      })),
    );
    return { ...result, page };
  },
});

/** A short-lived URL to upload one photo to. Shares the listing rate limit. */
export const generateUploadUrl = mutation({
  args: {},
  handler: async (ctx) => {
    const user = await requireUser(ctx);
    await assertWithinRateLimit(ctx, "listing", user._id);
    return await ctx.storage.generateUploadUrl();
  },
});

const toolArgs = {
  name: v.string(),
  category: vCategory,
  condition: vCondition,
  description: v.string(),
  imageId: v.optional(v.id("_storage")),
};

export const create = mutation({
  args: toolArgs,
  handler: async (ctx, { imageId, ...args }) => {
    const user = await requireUser(ctx);
    await assertWithinRateLimit(ctx, "listing", user._id);
    if (imageId) await assertUsableImage(ctx, imageId);
    const clean = { ...args, ...cleanFields(args), status: "available" as const };
    return await ctx.db.insert("tools", {
      ...clean,
      ...toolSearchFields(clean),
      ownerId: user._id,
      imageId,
    });
  },
});

export const update = mutation({
  args: { toolId: v.id("tools"), ...toolArgs, removeImage: v.optional(v.boolean()) },
  handler: async (ctx, { toolId, imageId, removeImage, ...fields }) => {
    const { tool } = await requireToolOwner(ctx, toolId);
    if (imageId) await assertUsableImage(ctx, imageId, toolId);
    const clean = { ...fields, ...cleanFields(fields) };
    // A new photo or an explicit removal replaces the old file; otherwise keep it.
    const nextImage = imageId ?? (removeImage ? undefined : tool.imageId);
    if (tool.imageId && tool.imageId !== nextImage) await deleteImage(ctx, tool.imageId);
    await ctx.db.patch(toolId, {
      ...clean,
      ...toolSearchFields({ ...clean, status: tool.status }),
      imageId: nextImage,
    });
    if (clean.name !== tool.name) await renameToolOnLoans(ctx, toolId, clean.name);
  },
});

/**
 * Soft-removes a tool and declines its open requests. Shared by owner/admin.
 * Owners must wait for an active loan to come back; admins (moderation) may
 * remove mid-loan: the loan stays open so the lender can still mark it
 * returned, and the tool stays removed afterwards. The photo is deleted:
 * removed tools are never shown.
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
    .withIndex("by_tool_status", (q) => q.eq("toolId", tool._id).eq("status", "requested"))
    .collect();
  for (const loan of open) {
    await setLoanStatus(ctx, loan._id, "declined", { decidedAt: Date.now() });
    await enqueueLoanEvent(ctx, loan._id, "loan.declined");
  }
  await deleteImage(ctx, tool.imageId);
  await setToolStatus(ctx, tool._id, "removed", { removedBy: removedBy._id, imageId: undefined });
}

export const remove = mutation({
  args: { toolId: v.id("tools") },
  handler: async (ctx, { toolId }) => {
    const { user, tool } = await requireToolOwner(ctx, toolId);
    await removeTool(ctx, tool, user);
  },
});
