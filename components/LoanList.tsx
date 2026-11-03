"use client";

import { useMutation } from "convex/react";
import { EmptyState, InboxIcon, Spinner } from "@/components/ui";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { LoanCard, type LoanView } from "./LoanCard";
import { useRowAction } from "./useRowAction";

/** Connects LoanCard to the Convex loan mutations. */
export function LoanList({
  loans,
  as,
  empty,
}: {
  loans: LoanView[] | undefined;
  as: "lender" | "borrower";
  empty: string;
}) {
  const approve = useMutation(api.loans.approve);
  const decline = useMutation(api.loans.decline);
  const cancel = useMutation(api.loans.cancel);
  const markReturned = useMutation(api.loans.markReturned);
  const { run, errorFor } = useRowAction();

  if (loans === undefined) return <Spinner />;
  if (loans.length === 0) return <EmptyState icon={<InboxIcon />} title={empty} />;

  const act = (id: string, fn: (args: { loanId: Id<"loans"> }) => Promise<unknown>) => () =>
    void run(id, () => fn({ loanId: id as Id<"loans"> }));

  return (
    <ul className="space-y-3">
      {loans.map((loan) => (
        <LoanCard
          key={loan._id}
          loan={loan}
          viewer={as}
          error={errorFor(loan._id)}
          actions={{
            onApprove: act(loan._id, approve),
            onDecline: act(loan._id, decline),
            onCancel: act(loan._id, cancel),
            onMarkReturned: act(loan._id, markReturned),
          }}
        />
      ))}
    </ul>
  );
}
