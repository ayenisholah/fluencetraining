"use client";

import { useQuery } from "convex/react";
import { LoanList } from "@/components/LoanList";
import { PageHeader } from "@/components/ui";
import { api } from "@/convex/_generated/api";

export function IncomingScreen() {
  const loans = useQuery(api.loans.incoming);
  return (
    <>
      <PageHeader title="Incoming requests" description="Approve or decline requests for your tools." />
      <LoanList loans={loans} as="lender" empty="No one has asked to borrow your tools yet." />
    </>
  );
}
