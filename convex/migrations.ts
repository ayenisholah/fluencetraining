// One-off backfills. Internal only: run with
//   npx convex run migrations:backfillSearch
// Idempotent and batched: each run patches up to BATCH rows per table that are
// missing derived fields, then reschedules itself until nothing is left.
import { internal } from "./_generated/api";
import { internalMutation } from "./_generated/server";
import { loanPhase } from "./lib/loanRecord";
import { userSearchText } from "./lib/people";
import { toolSearchFields } from "./lib/toolRecord";

const BATCH = 200;

export const backfillSearch = internalMutation({
  args: {},
  handler: async (ctx) => {
    let patched = 0;
    for (const tool of await ctx.db.query("tools").collect()) {
      if (patched >= BATCH) break;
      const want = toolSearchFields(tool);
      if (
        tool.searchText !== want.searchText ||
        tool.publicSearchText !== want.publicSearchText ||
        tool.listed !== want.listed
      ) {
        await ctx.db.patch(tool._id, want);
        patched++;
      }
    }
    for (const loan of await ctx.db.query("loans").collect()) {
      if (patched >= BATCH) break;
      const phase = loanPhase(loan.status);
      const toolName = loan.toolName ?? (await ctx.db.get(loan.toolId))?.name ?? "Removed tool";
      if (loan.phase !== phase || loan.toolName !== toolName) {
        await ctx.db.patch(loan._id, { phase, toolName });
        patched++;
      }
    }
    for (const user of await ctx.db.query("users").collect()) {
      if (patched >= BATCH) break;
      const searchText = userSearchText(user.name, user.email);
      if (user.searchText !== searchText) {
        await ctx.db.patch(user._id, { searchText });
        patched++;
      }
    }
    if (patched >= BATCH) await ctx.scheduler.runAfter(0, internal.migrations.backfillSearch, {});
    return { patched, done: patched < BATCH };
  },
});
