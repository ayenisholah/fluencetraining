import { ConvexError } from "convex/values";
import type { Id } from "../_generated/dataModel";
import type { MutationCtx } from "../_generated/server";

const HOUR = 60 * 60 * 1000;

export const RATE_LIMITS = {
  listing: { max: 10, windowMs: HOUR, noun: "listings" },
  request: { max: 20, windowMs: HOUR, noun: "borrow requests" },
} as const;

/**
 * Per-user rolling-window limit on content creation, counted from the user's
 * own rows (removed or declined ones included, so deleting and re-posting
 * doesn't reset it). Uses the owner/borrower indexes, which end in
 * _creationTime, so the count reads at most `max` documents.
 */
export async function assertWithinRateLimit(
  ctx: MutationCtx,
  kind: keyof typeof RATE_LIMITS,
  userId: Id<"users">,
  now: number = Date.now(),
): Promise<void> {
  const { max, windowMs, noun } = RATE_LIMITS[kind];
  const since = now - windowMs;
  const recent =
    kind === "listing"
      ? await ctx.db
          .query("tools")
          .withIndex("by_owner", (q) => q.eq("ownerId", userId).gt("_creationTime", since))
          .take(max)
      : await ctx.db
          .query("loans")
          .withIndex("by_borrower", (q) => q.eq("borrowerId", userId).gt("_creationTime", since))
          .take(max);
  if (recent.length >= max) {
    throw new ConvexError({
      code: "RATE_LIMITED",
      message: `You've created a lot of ${noun} in the last hour. Please try again later.`,
    });
  }
}
