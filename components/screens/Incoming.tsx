"use client";

import { LoanListScreen } from "@/components/LoanListScreen";

export function IncomingScreen() {
  return (
    <LoanListScreen as="lender" title="Incoming requests" description="Approve or decline requests for your tools." empty="No one has asked to borrow your tools yet." />
  );
}
