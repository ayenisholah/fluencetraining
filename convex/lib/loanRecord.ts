// Derived loan fields: `phase` (open / active / closed, for list tabs) and
// `toolName` (for search). Status changes go through setLoanStatus so the
// phase can't drift.
import type { Infer } from "convex/values";
import type { Doc, Id } from "../_generated/dataModel";
import type { MutationCtx } from "../_generated/server";
import type { vLoanPhase } from "../schema";

export type LoanPhase = Infer<typeof vLoanPhase>;

export function loanPhase(status: Doc<"loans">["status"]): LoanPhase {
  if (status === "requested") return "open";
  if (status === "approved") return "active";
  return "closed";
}

export async function setLoanStatus(
  ctx: MutationCtx,
  loanId: Id<"loans">,
  status: Doc<"loans">["status"],
  extra: Partial<Doc<"loans">> = {},
): Promise<void> {
  await ctx.db.patch(loanId, { ...extra, status, phase: loanPhase(status) });
}

/** After a tool is renamed, keep its loans findable by the new name. */
export async function renameToolOnLoans(ctx: MutationCtx, toolId: Id<"tools">, toolName: string): Promise<void> {
  const loans = await ctx.db.query("loans").withIndex("by_tool", (q) => q.eq("toolId", toolId)).collect();
  for (const loan of loans) if (loan.toolName !== toolName) await ctx.db.patch(loan._id, { toolName });
}
