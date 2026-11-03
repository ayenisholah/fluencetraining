// Derived tool fields used by indexes: `searchText` (what search matches) and
// `listed` (status != "removed", because search filters only test equality).
// Every write of name, description or status goes through these, so the
// derived fields can't drift.
import type { Doc, Id } from "../_generated/dataModel";
import type { MutationCtx } from "../_generated/server";

type ToolStatus = Doc<"tools">["status"];

export function toolSearchFields(tool: { name: string; description: string; status: ToolStatus }) {
  return { searchText: `${tool.name} ${tool.description}`.trim(), listed: tool.status !== "removed" };
}

/** Changes a tool's status and keeps `listed` in step. */
export async function setToolStatus(
  ctx: MutationCtx,
  toolId: Id<"tools">,
  status: ToolStatus,
  extra: Partial<Doc<"tools">> = {},
): Promise<void> {
  await ctx.db.patch(toolId, { ...extra, status, listed: status !== "removed" });
}
