import { Badge } from "@/components/ui";
import type { Doc } from "@/convex/_generated/dataModel";

const BADGES = {
  available: { tone: "success", label: "Available" },
  on_loan: { tone: "warning", label: "On loan" },
  removed: { tone: "neutral", label: "Removed" },
} as const satisfies Record<Doc<"tools">["status"], { tone: string; label: string }>;

/** A listed tool's availability, as shown on the board, My listings and Admin. */
export function ToolStatusBadge({ status }: { status: Doc<"tools">["status"] }) {
  const { tone, label } = BADGES[status];
  return <Badge tone={tone}>{label}</Badge>;
}
