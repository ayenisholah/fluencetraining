"use client";

import { useQuery } from "convex/react";
import { LoanList } from "@/components/LoanList";
import { PageHeader } from "@/components/ui";
import { api } from "@/convex/_generated/api";

export default function RequestsPage() {
  const loans = useQuery(api.loans.myRequests);
  return (
    <>
      <PageHeader title="My requests" />
      <LoanList loans={loans} as="borrower" empty="You haven't asked to borrow anything yet." />
    </>
  );
}
