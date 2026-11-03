export type LoanStatus = "requested" | "approved" | "declined" | "cancelled" | "returned";
export type BadgeTone = "neutral" | "brand" | "success" | "warning" | "danger" | "info";

/** How a loan's state is shown: label and badge tone. Overdue wins. */
export function loanStatusBadge(status: LoanStatus, overdue = false): { label: string; tone: BadgeTone } {
  if (overdue && status === "approved") return { label: "Overdue", tone: "danger" };
  switch (status) {
    case "requested":
      return { label: "Requested", tone: "warning" };
    case "approved":
      return { label: "On loan", tone: "brand" };
    case "declined":
      return { label: "Declined", tone: "danger" };
    case "cancelled":
      return { label: "Cancelled", tone: "neutral" };
    case "returned":
      return { label: "Returned", tone: "success" };
  }
}

/** Which actions a viewer can take on a loan right now (mirrors server rules). */
export function loanActions(status: LoanStatus, viewer: "lender" | "borrower") {
  return {
    approve: viewer === "lender" && status === "requested",
    decline: viewer === "lender" && status === "requested",
    markReturned: viewer === "lender" && status === "approved",
    cancel: viewer === "borrower" && status === "requested",
  };
}
