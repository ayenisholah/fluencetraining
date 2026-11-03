import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ConvexError } from "convex/values";
import { beforeEach, describe, expect, test, vi } from "vitest";
import { mutations, resetConvexMock } from "@/test/convex-mock";
import type { LoanView } from "./LoanCard";
import { LoanList } from "./LoanList";

vi.mock("convex/react", async () => (await import("@/test/convex-mock")).convexReactMock);

const base: Omit<LoanView, "_id" | "toolName" | "status"> = {
  toolCategory: "hand_tools",
  startDate: "2026-11-04",
  endDate: "2026-11-06",
  overdue: false,
  counterpartName: "Bob",
  activity: [],
};
const loans: LoanView[] = [
  { ...base, _id: "l1", toolName: "Ladder", status: "requested" },
  { ...base, _id: "l2", toolName: "Drill", status: "approved" },
];

const card = (name: string) => screen.getByRole("heading", { name }).closest("li") as HTMLElement;

beforeEach(resetConvexMock);

describe("LoanList", () => {
  test("lender actions call the right mutation with the loan id", async () => {
    render(<LoanList loans={loans} as="lender" empty="none" />);
    await userEvent.click(within(card("Ladder")).getByRole("button", { name: "Approve" }));
    expect(mutations["loans:approve"]).toHaveBeenCalledWith({ loanId: "l1" });
    await userEvent.click(within(card("Ladder")).getByRole("button", { name: "Decline" }));
    expect(mutations["loans:decline"]).toHaveBeenCalledWith({ loanId: "l1" });
    await userEvent.click(within(card("Drill")).getByRole("button", { name: "Mark returned" }));
    expect(mutations["loans:markReturned"]).toHaveBeenCalledWith({ loanId: "l2" });
  });

  test("borrowers can only cancel open requests", async () => {
    render(<LoanList loans={loans} as="borrower" empty="none" />);
    expect(within(card("Drill")).queryByRole("button")).toBeNull();
    await userEvent.click(within(card("Ladder")).getByRole("button", { name: "Cancel request" }));
    expect(mutations["loans:cancel"]).toHaveBeenCalledWith({ loanId: "l1" });
    expect(screen.queryByRole("button", { name: "Approve" })).toBeNull();
  });

  test("a server error is shown on that card only", async () => {
    render(<LoanList loans={loans} as="lender" empty="none" />);
    mutations["loans:approve"].mockRejectedValueOnce(
      new ConvexError({ code: "BAD_REQUEST", message: "The tool is already lent out. Mark it returned first." }),
    );
    await userEvent.click(within(card("Ladder")).getByRole("button", { name: "Approve" }));
    expect(await within(card("Ladder")).findByText(/already lent out/)).toBeInTheDocument();
    expect(within(card("Drill")).queryByText(/already lent out/)).toBeNull();
  });

  test("loading and empty states", () => {
    const { rerender } = render(<LoanList loans={undefined} as="lender" empty="Nothing yet" />);
    expect(screen.getByRole("status")).toBeInTheDocument();
    rerender(<LoanList loans={[]} as="lender" empty="Nothing yet" />);
    expect(screen.getByText("Nothing yet")).toBeInTheDocument();
  });
});
