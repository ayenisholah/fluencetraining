import { Alert, Badge, Button, Card, ClockIcon } from "@/components/ui";
import { CategoryBadge } from "@/components/CategoryBadge";
import { formatDate, timeAgo } from "@/lib/format";
import { loanActions, loanStatusBadge, type LoanStatus } from "@/lib/loanStatus";

export type LoanView = {
  _id: string;
  toolName: string;
  toolCategory?: string;
  startDate: string;
  endDate: string;
  status: LoanStatus;
  overdue: boolean;
  counterpartName: string;
  activity: { kind: string; status: string; at: number }[];
};

const activityLabel: Record<string, string> = {
  request_notification: "Notification",
  overdue_reminder: "Reminder",
  workflow_error: "Automation error",
};

export function activityText(item: LoanView["activity"][number], now = Date.now()): string {
  const label = activityLabel[item.kind] ?? item.kind;
  return `${label} ${item.status === "sent" ? "sent" : "failed"} ${timeAgo(item.at, now)}`;
}

export type LoanCardActions = {
  onApprove?: () => void;
  onDecline?: () => void;
  onCancel?: () => void;
  onMarkReturned?: () => void;
};

/** One loan, from the lender's or the borrower's point of view. Presentational. */
export function LoanCard({
  loan,
  viewer,
  actions = {},
  error,
}: {
  loan: LoanView;
  viewer: "lender" | "borrower";
  actions?: LoanCardActions;
  error?: string;
}) {
  const badge = loanStatusBadge(loan.status, loan.overdue);
  const can = loanActions(loan.status, viewer);
  const latest = loan.activity[0];
  return (
    <Card as="li">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-subtitle-semibold text-fg">{loan.toolName}</h2>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            {loan.toolCategory && <CategoryBadge category={loan.toolCategory} />}
            <p className="text-description text-fg-muted">
              {formatDate(loan.startDate)} – {formatDate(loan.endDate)} ·{" "}
              {viewer === "lender" ? `requested by ${loan.counterpartName}` : `lent by ${loan.counterpartName}`}
            </p>
          </div>
        </div>
        <Badge tone={badge.tone}>{badge.label}</Badge>
      </div>
      {latest && (
        <p className="mt-3 inline-flex items-center gap-1.5 text-description text-fg-muted">
          <ClockIcon size={14} />
          {activityText(latest)}
        </p>
      )}
      {(can.approve || can.decline || can.markReturned || can.cancel) && (
        <div className="mt-4 flex flex-wrap gap-2">
          {can.approve && <Button size="sm" onClick={actions.onApprove}>Approve</Button>}
          {can.decline && <Button size="sm" variant="ghost" onClick={actions.onDecline}>Decline</Button>}
          {can.markReturned && <Button size="sm" variant="ghost" onClick={actions.onMarkReturned}>Mark returned</Button>}
          {can.cancel && <Button size="sm" variant="ghost" onClick={actions.onCancel}>Cancel request</Button>}
        </div>
      )}
      {error && <Alert tone="danger" className="mt-3">{error}</Alert>}
    </Card>
  );
}
