"use client";

import { useMutation } from "convex/react";
import { EmptyState, InboxIcon, LoadMore, Spinner, useConfirm, type PaginationStatus } from "@/components/ui";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { LoanCard, type LoanView } from "./LoanCard";
import { useRowAction } from "./useRowAction";

export const LOANS_PAGE_SIZE = 25;

/**
 * Connects LoanCard to the Convex loan mutations for one page-able list.
 * Irreversible actions (decline, cancel) ask first in a dialog; approve and
 * mark returned are the expected next step and act at once.
 */
export function LoanList({
  loans,
  status,
  onLoadMore,
  as,
  empty,
}: {
  loans: LoanView[];
  status: PaginationStatus;
  onLoadMore: () => void;
  as: "lender" | "borrower";
  empty: string;
}) {
  const approve = useMutation(api.loans.approve);
  const decline = useMutation(api.loans.decline);
  const cancel = useMutation(api.loans.cancel);
  const markReturned = useMutation(api.loans.markReturned);
  const { run, errorFor } = useRowAction();
  const { confirm, dialog } = useConfirm();

  if (status === "LoadingFirstPage") return <Spinner />;
  if (loans.length === 0) return <EmptyState icon={<InboxIcon />} title={empty} />;

  const id = (loan: LoanView) => ({ loanId: loan._id as Id<"loans"> });

  return (
    <>
      <ul className="space-y-3">
        {loans.map((loan) => (
          <LoanCard
            key={loan._id}
            loan={loan}
            viewer={as}
            error={errorFor(loan._id)}
            actions={{
              onApprove: () => void run(loan._id, () => approve(id(loan))),
              onMarkReturned: () => void run(loan._id, () => markReturned(id(loan))),
              onDecline: () =>
                confirm({
                  title: `Decline ${loan.counterpartName}'s request?`,
                  description: `${loan.counterpartName} will be told you can't lend the ${loan.toolName} this time.`,
                  confirmLabel: "Decline request",
                  onConfirm: () => decline(id(loan)),
                }),
              onCancel: () =>
                confirm({
                  title: `Cancel your request for the ${loan.toolName}?`,
                  description: `${loan.counterpartName} will be told you no longer need it.`,
                  confirmLabel: "Cancel request",
                  cancelLabel: "Keep request",
                  onConfirm: () => cancel(id(loan)),
                }),
            }}
          />
        ))}
      </ul>
      <LoadMore status={status} count={loans.length} noun="requests" onLoadMore={onLoadMore} />
      {dialog}
    </>
  );
}
