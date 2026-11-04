"use client";

import { LoanListScreen } from "@/components/LoanListScreen";

export function RequestsScreen() {
  return (
    <LoanListScreen
      as="borrower"
      title="My requests"
      description="Tools you've asked to borrow."
      empty="You haven't asked to borrow anything yet."
    />
  );
}
