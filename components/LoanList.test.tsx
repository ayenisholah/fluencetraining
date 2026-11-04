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
const list = (as: "lender" | "borrower", over: Partial<Parameters<typeof LoanList>[0]> = {}) => (
  <LoanList loans={loans} status="Exhausted" as={as} empty="none" {...over} />
);

beforeEach(resetConvexMock);

describe("LoanList", () => {
  test("approve and mark returned act at once", async () => {
    render(list("lender"));
    await userEvent.click(within(card("Ladder")).getByRole("button", { name: "Approve" }));
    expect(mutations["loans:approve"]).toHaveBeenCalledWith({ loanId: "l1" });
    await userEvent.click(within(card("Drill")).getByRole("button", { name: "Mark returned" }));
    expect(mutations["loans:markReturned"]).toHaveBeenCalledWith({ loanId: "l2" });
  });

  test("decline asks first, naming the borrower", async () => {
    render(list("lender"));
    await userEvent.click(within(card("Ladder")).getByRole("button", { name: "Decline" }));
    const dialog = screen.getByRole("alertdialog", { name: "Decline Bob's request?" });
    expect(mutations["loans:decline"]).not.toHaveBeenCalled();
    await userEvent.click(within(dialog).getByRole("button", { name: "Decline request" }));
    expect(mutations["loans:decline"]).toHaveBeenCalledWith({ loanId: "l1" });
  });

  test("borrowers can only cancel open requests, after confirming", async () => {
    render(list("borrower"));
    expect(within(card("Drill")).queryByRole("button")).toBeNull();
    await userEvent.click(within(card("Ladder")).getByRole("button", { name: "Cancel request" }));
    const dialog = screen.getByRole("alertdialog", { name: "Cancel your request for the Ladder?" });
    await userEvent.click(within(dialog).getByRole("button", { name: "Keep request" }));
    expect(mutations["loans:cancel"]).not.toHaveBeenCalled();
    await userEvent.click(within(card("Ladder")).getByRole("button", { name: "Cancel request" }));
    await userEvent.click(within(screen.getByRole("alertdialog")).getByRole("button", { name: "Cancel request" }));
    expect(mutations["loans:cancel"]).toHaveBeenCalledWith({ loanId: "l1" });
  });

  test("a server error on approve is shown on that card only", async () => {
    render(list("lender"));
    mutations["loans:approve"].mockRejectedValueOnce(
      new ConvexError({ code: "BAD_REQUEST", message: "The tool is already lent out. Mark it returned first." }),
    );
    await userEvent.click(within(card("Ladder")).getByRole("button", { name: "Approve" }));
    expect(await within(card("Ladder")).findByText(/already lent out/)).toBeInTheDocument();
    expect(within(card("Drill")).queryByText(/already lent out/)).toBeNull();
  });

  test("loading and empty states", async () => {
    const { rerender } = render(list("lender", { loans: [], status: "LoadingFirstPage" }));
    expect(screen.getByRole("status")).toBeInTheDocument();
    rerender(list("lender", { loans: [], empty: "Nothing yet" }));
    expect(screen.getByText("Nothing yet")).toBeInTheDocument();
  });
});
