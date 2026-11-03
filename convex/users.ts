import { v } from "convex/values";
import { internalMutation, mutation, query } from "./_generated/server";
import { getCurrentUser, notFound } from "./lib/auth";
import { cleanDisplayName, userSearchText } from "./lib/people";
import { vRole } from "./schema";

/** Called by the client after sign-in; creates or refreshes the user record. */
export const store = mutation({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return null;
    // Names come from the identity token and reach other users' screens and
    // email subjects, so they are cleaned like any other user input.
    const name = cleanDisplayName(identity.name ?? identity.givenName ?? identity.nickname);
    const existing = await ctx.db
      .query("users")
      .withIndex("by_token", (q) =>
        q.eq("tokenIdentifier", identity.tokenIdentifier),
      )
      .unique();
    const searchText = userSearchText(name, identity.email);
    if (existing) {
      if (existing.name !== name || existing.email !== identity.email || existing.searchText !== searchText) {
        await ctx.db.patch(existing._id, { name, email: identity.email, searchText });
      }
      return existing._id;
    }
    // Role is never taken from the client or token claims: everyone starts as
    // "user"; admins are promoted server-side (see setRole).
    return await ctx.db.insert("users", {
      tokenIdentifier: identity.tokenIdentifier,
      name,
      email: identity.email,
      role: "user",
      trustedLender: false,
      searchText,
    });
  },
});

export const me = query({
  args: {},
  handler: async (ctx) => {
    const user = await getCurrentUser(ctx);
    if (!user) return null;
    return {
      _id: user._id,
      name: user.name,
      role: user.role,
      trustedLender: user.trustedLender,
    };
  },
});

/** Operator-only: `npx convex run users:setRole '{"email":"…","role":"admin"}'` */
export const setRole = internalMutation({
  args: { email: v.string(), role: vRole },
  handler: async (ctx, { email, role }) => {
    const user = await ctx.db
      .query("users")
      .withIndex("by_email", (q) => q.eq("email", email))
      .unique();
    if (!user) notFound("User (sign in once first)");
    await ctx.db.patch(user._id, { role });
    return { id: user._id, role };
  },
});
