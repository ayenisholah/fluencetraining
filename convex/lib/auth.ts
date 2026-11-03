import { ConvexError } from "convex/values";
import type { Doc, Id } from "../_generated/dataModel";
import type { MutationCtx, QueryCtx } from "../_generated/server";

type Ctx = QueryCtx | MutationCtx;

export function forbidden(message = "You are not allowed to do that."): never {
  throw new ConvexError({ code: "FORBIDDEN", message });
}

export function notFound(what: string): never {
  throw new ConvexError({ code: "NOT_FOUND", message: `${what} not found.` });
}

export function badRequest(message: string): never {
  throw new ConvexError({ code: "BAD_REQUEST", message });
}

/** The signed-in user's record, or null when signed out / not yet stored. */
export async function getCurrentUser(ctx: Ctx): Promise<Doc<"users"> | null> {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) return null;
  return await ctx.db
    .query("users")
    .withIndex("by_token", (q) =>
      q.eq("tokenIdentifier", identity.tokenIdentifier),
    )
    .unique();
}

export async function requireUser(ctx: Ctx): Promise<Doc<"users">> {
  const user = await getCurrentUser(ctx);
  if (!user) {
    throw new ConvexError({
      code: "UNAUTHENTICATED",
      message: "Sign in to continue.",
    });
  }
  return user;
}

export async function requireAdmin(ctx: Ctx): Promise<Doc<"users">> {
  const user = await requireUser(ctx);
  if (user.role !== "admin") forbidden("Admins only.");
  return user;
}

export async function requireToolOwner(
  ctx: Ctx,
  toolId: Id<"tools">,
): Promise<{ user: Doc<"users">; tool: Doc<"tools"> }> {
  const user = await requireUser(ctx);
  const tool = await ctx.db.get(toolId);
  if (!tool || tool.status === "removed") notFound("Tool");
  if (tool.ownerId !== user._id) forbidden("Only the owner can do that.");
  return { user, tool };
}

export async function requireLoanParty(
  ctx: Ctx,
  loanId: Id<"loans">,
  party: "lender" | "borrower",
): Promise<{ user: Doc<"users">; loan: Doc<"loans"> }> {
  const user = await requireUser(ctx);
  const loan = await ctx.db.get(loanId);
  if (!loan) notFound("Request");
  const partyId = party === "lender" ? loan.lenderId : loan.borrowerId;
  if (partyId !== user._id) forbidden(`Only the ${party} can do that.`);
  return { user, loan };
}
