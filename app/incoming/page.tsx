"use client";

import { useQuery } from "convex/react";
import { LoanList } from "@/components/LoanList";
import { PageHeader } from "@/components/ui";
import { api } from "@/convex/_generated/api";

export default function IncomingPage() {
  const loans = useQuery(api.loans.incoming);
  return (
    <>
      <PageHeader title="Incoming requests" />
      <LoanList loans={loans} as="lender" empty="No one has asked to borrow your tools yet." />
    </>
  );
}
