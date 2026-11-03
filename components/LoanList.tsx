"use client";

import { useMutation } from "convex/react";
import { useState } from "react";
import { EmptyState, InboxIcon, Spinner } from "@/components/ui";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { errorMessage } from "@/lib/format";
import { LoanCard, type LoanView } from "./LoanCard";

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
  const [error, setError] = useState<{ id: string; message: string }>();

  if (loans === undefined) return <Spinner />;
  if (loans.length === 0) return <EmptyState icon={<InboxIcon />} title={empty} />;

  const run = (id: string, fn: (args: { loanId: Id<"loans"> }) => Promise<unknown>) => async () => {
    setError(undefined);
    try {
      await fn({ loanId: id as Id<"loans"> });
    } catch (err) {
      setError({ id, message: errorMessage(err) });
    }
  };

  return (
    <ul className="space-y-3">
      {loans.map((loan) => (
        <LoanCard
          key={loan._id}
          loan={loan}
          viewer={as}
          error={error?.id === loan._id ? error.message : undefined}
          actions={{
            onApprove: run(loan._id, approve),
            onDecline: run(loan._id, decline),
            onCancel: run(loan._id, cancel),
            onMarkReturned: run(loan._id, markReturned),
          }}
        />
      ))}
    </ul>
  );
}
