// Internal-only fixtures for the loopback concurrency harness. Never public APIs.
import { v } from "convex/values";
import { internalMutation, internalQuery, type QueryCtx } from "./_generated/server";
import { toolSearchFields } from "./lib/toolRecord";

function prefix(runId: string) {
  if (!/^[a-f0-9-]{36}$/.test(runId)) throw new Error("Expected a concurrency run UUID.");
  return `E2E race ${runId} `;
}
async function rows(ctx: QueryCtx, runId: string) {
  const namePrefix = prefix(runId);
  const users = (await ctx.db.query("users").collect()).filter((u) => u.name.startsWith(namePrefix));
  const tools = (await ctx.db.query("tools").collect()).filter((t) => t.name.startsWith(namePrefix));
  const loans = (await Promise.all(tools.map((t) => ctx.db.query("loans").withIndex("by_tool", (q) => q.eq("toolId", t._id)).collect()))).flat();
  const deliveries = (await Promise.all(loans.map((l) => ctx.db.query("webhookDeliveries").withIndex("by_loan", (q) => q.eq("loanId", l._id)).collect()))).flat();
  return { users, tools, loans, deliveries };
}
export const setup = internalMutation({
  args: { runId: v.string(), toolCount: v.number() },
  handler: async (ctx, { runId, toolCount }) => {
    const namePrefix = prefix(runId);
    if (!Number.isInteger(toolCount) || toolCount < 1 || toolCount > 40) throw new Error("Expected 1–40 tools.");
    if ((await rows(ctx, runId)).users.length) throw new Error("Run already exists.");
    const actors = [];
    for (const actor of ["owner", "admin", ...Array.from({ length: 10 }, (_, i) => `borrower${i}`)]) {
      const identity = { issuer: "https://concurrency.lendloop.test", subject: `${runId}-${actor}`, tokenIdentifier: `https://concurrency.lendloop.test|${runId}-${actor}` };
      const userId = await ctx.db.insert("users", { tokenIdentifier: identity.tokenIdentifier, name: `${namePrefix}${actor}`, role: actor === "admin" ? "admin" : "user", trustedLender: false });
      actors.push({ actor, identity, userId });
    }
    const toolIds = [];
    for (let i = 0; i < toolCount; i++) {
      const tool = { ownerId: actors[0].userId, name: `${namePrefix}tool ${i}`, category: "garden" as const, condition: "good" as const, description: "Concurrency fixture", status: "available" as const };
      toolIds.push(await ctx.db.insert("tools", { ...tool, ...toolSearchFields(tool) }));
    }
    return { actors, toolIds, namePrefix };
  },
});
export const inspect = internalQuery({ args: { runId: v.string() }, handler: (ctx, { runId }) => rows(ctx, runId) });
export const cleanup = internalMutation({
  args: { runId: v.string() },
  handler: async (ctx, { runId }) => {
    const state = await rows(ctx, runId);
    for (const loan of state.loans) {
      for (const event of await ctx.db.query("automationEvents").withIndex("by_loan", (q) => q.eq("loanId", loan._id)).collect()) await ctx.db.delete(event._id);
    }
    for (const row of [...state.deliveries, ...state.loans, ...state.tools, ...state.users]) await ctx.db.delete(row._id);
  },
});
