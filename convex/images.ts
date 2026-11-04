// Housekeeping for tool photos. Internal only (scheduled by convex/crons.ts).
import { internalMutation } from "./_generated/server";

const DAY = 24 * 60 * 60 * 1000;
const BATCH = 500;

/**
 * Deletes uploads older than a day that no tool references: photos chosen in
 * a form that was then abandoned. Fresh uploads are left alone so a form
 * being filled in right now isn't affected.
 */
export const deleteOrphans = internalMutation({
  args: {},
  handler: async (ctx) => {
    const cutoff = Date.now() - DAY;
    const files = await ctx.db.system.query("_storage").take(BATCH);
    let deleted = 0;
    for (const file of files) {
      if (file._creationTime > cutoff) continue;
      const used = await ctx.db
        .query("tools")
        .withIndex("by_image", (q) => q.eq("imageId", file._id))
        .first();
      if (!used) {
        await ctx.storage.delete(file._id);
        deleted++;
      }
    }
    return { deleted };
  },
});
