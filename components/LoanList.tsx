"use client";

import { useMutation } from "convex/react";
import { useState } from "react";
import { api } from "@/convex/_generated/api";
import type { FunctionReturnType } from "convex/server";
import type { Id } from "@/convex/_generated/dataModel";
import { categoryLabel, errorMessage, formatDate, timeAgo } from "@/lib/format";
import { Empty, ErrorText, Loading, LoanStatus } from "./ui";

type Loan = FunctionReturnType<typeof api.loans.incoming>[number];

const activityLabel: Record<string, string> = {
  request_notification: "Notification",
  overdue_reminder: "Reminder",
  workflow_error: "Automation error",
};

export function Activity({ items }: { items: Loan["activity"] }) {
  if (items.length === 0) return null;
  const latest = items[0];
  const label = activityLabel[latest.kind] ?? latest.kind;
  return (
    <p className="mt-2 text-xs text-muted">
      {latest.status === "sent" ? `${label} sent` : `${label} failed`} {timeAgo(latest.at)}
    </p>
  );
}

export function LoanList({
  loans,
  as,
  empty,
}: {
  loans: Loan[] | undefined;
  as: "lender" | "borrower";
  empty: string;
}) {
  const approve = useMutation(api.loans.approve);
  const decline = useMutation(api.loans.decline);
  const cancel = useMutation(api.loans.cancel);
  const markReturned = useMutation(api.loans.markReturned);
  const [error, setError] = useState<{ id: Id<"loans">; message: string }>();

  if (loans === undefined) return <Loading />;
  if (loans.length === 0) return <Empty>{empty}</Empty>;

  const act = (id: Id<"loans">, fn: (args: { loanId: Id<"loans"> }) => Promise<unknown>) => async () => {
    setError(undefined);
    try {
      await fn({ loanId: id });
    } catch (err) {
      setError({ id, message: errorMessage(err) });
    }
  };

  return (
    <ul className="space-y-3">
      {loans.map((loan) => (
        <li key={loan._id} className="card">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="font-medium">{loan.toolName}</h2>
              <p className="text-xs text-muted">
                {categoryLabel(loan.toolCategory)} · {formatDate(loan.startDate)} – {formatDate(loan.endDate)} ·{" "}
                {as === "lender" ? `requested by ${loan.counterpartName}` : `lent by ${loan.counterpartName}`}
              </p>
            </div>
            <LoanStatus status={loan.status} overdue={loan.overdue} />
          </div>
          <Activity items={loan.activity} />
          <div className="mt-3 flex flex-wrap gap-2">
            {as === "lender" && loan.status === "requested" && (
              <>
                <button className="btn-primary" onClick={act(loan._id, approve)}>Approve</button>
                <button className="btn-ghost" onClick={act(loan._id, decline)}>Decline</button>
              </>
            )}
            {as === "lender" && loan.status === "approved" && (
              <button className="btn-ghost" onClick={act(loan._id, markReturned)}>Mark returned</button>
            )}
            {as === "borrower" && loan.status === "requested" && (
              <button className="btn-ghost" onClick={act(loan._id, cancel)}>Cancel request</button>
            )}
          </div>
          {error?.id === loan._id && <div className="mt-2"><ErrorText>{error.message}</ErrorText></div>}
        </li>
      ))}
    </ul>
  );
}
