import { Badge } from "@/components/ui";
import type { Doc } from "@/convex/_generated/dataModel";

const BADGES = {
  available: { tone: "success", label: "Available" },
  on_loan: { tone: "warning", label: "On loan" },
  removed: { tone: "neutral", label: "Removed" },
} as const satisfies Record<Doc<"tools">["status"], { tone: string; label: string }>;

/** A listed tool's availability, as shown on the board, My listings and Admin. */
export function ToolStatusBadge({ status, className }: { status: Doc<"tools">["status"]; className?: string }) {
  const { tone, label } = BADGES[status];
  return <Badge tone={tone} className={className}>{label}</Badge>;
}
