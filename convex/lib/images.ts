// Tool photos in Convex file storage. Uploads are checked before they are
// attached: they must exist, be a raster image of an allowed type (no SVG,
// which can carry script), be at most 5 MB, and not belong to another tool.
import type { Id } from "../_generated/dataModel";
import type { MutationCtx, QueryCtx } from "../_generated/server";
import { badRequest } from "./auth";

export const IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"] as const;
export const IMAGE_MAX_BYTES = 5 * 1024 * 1024;

export async function assertUsableImage(ctx: MutationCtx, imageId: Id<"_storage">, forTool?: Id<"tools">): Promise<void> {
  const file = await ctx.db.system.get(imageId);
  if (!file) badRequest("That photo upload has expired. Please choose it again.");
  if (!IMAGE_TYPES.includes(file.contentType as (typeof IMAGE_TYPES)[number])) {
    badRequest("Photos must be JPEG, PNG or WebP.");
  }
  if (file.size > IMAGE_MAX_BYTES) badRequest("Photos must be 5 MB or smaller.");
  const owner = await ctx.db.query("tools").withIndex("by_image", (q) => q.eq("imageId", imageId)).first();
  if (owner && owner._id !== forTool) badRequest("That photo is already used by another listing.");
}

export async function deleteImage(ctx: MutationCtx, imageId: Id<"_storage"> | undefined): Promise<void> {
  if (imageId && (await ctx.db.system.get(imageId))) await ctx.storage.delete(imageId);
}

export async function imageUrl(ctx: QueryCtx, imageId: Id<"_storage"> | undefined): Promise<string | null> {
  return imageId ? await ctx.storage.getUrl(imageId) : null;
}
