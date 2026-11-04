import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, test, vi } from "vitest";
import { axeViolations } from "@/test/axe";
import { activityText, LoanCard, type LoanView } from "./LoanCard";

const loan: LoanView = {
  _id: "l1",
  toolName: "Ladder",
  toolCategory: "hand_tools",
  startDate: "2026-11-04",
  endDate: "2026-11-06",
  status: "requested",
  overdue: false,
  counterpartName: "Bob",
  activity: [],
};

describe("LoanCard", () => {
  test("lender sees approve/decline on an open request", async () => {
    const onApprove = vi.fn();
    const onDecline = vi.fn();
    render(
      <ul>
        <LoanCard loan={loan} viewer="lender" actions={{ onApprove, onDecline }} />
      </ul>,
    );
    expect(screen.getByText(/requested by Bob/)).toBeInTheDocument();
    expect(screen.getByText("Requested")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Approve" }));
    await userEvent.click(screen.getByRole("button", { name: "Decline" }));
    expect(onApprove).toHaveBeenCalledOnce();
    expect(onDecline).toHaveBeenCalledOnce();
    expect(screen.queryByRole("button", { name: "Cancel request" })).toBeNull();
  });

  test("borrower can only cancel", () => {
    render(
      <ul>
        <LoanCard loan={loan} viewer="borrower" />
      </ul>,
    );
    expect(screen.getByText(/lent by Bob/)).toBeInTheDocument();
    expect(screen.getAllByRole("button").map((b) => b.textContent)).toEqual(["Cancel request"]);
  });

  test("overdue loan shows the overdue badge and Mark returned for the lender", () => {
    render(
      <ul>
        <LoanCard loan={{ ...loan, status: "approved", overdue: true }} viewer="lender" />
      </ul>,
    );
    expect(screen.getByText("Overdue")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Mark returned" })).toBeInTheDocument();
  });

  test("closed loans have no actions; errors are announced", () => {
    render(
      <ul>
        <LoanCard loan={{ ...loan, status: "returned" }} viewer="lender" error="Not allowed" />
      </ul>,
    );
    expect(screen.queryAllByRole("button")).toHaveLength(0);
    expect(screen.getByRole("alert")).toHaveTextContent("Not allowed");
  });

  test("shows the latest automation activity", () => {
    const now = Date.now();
    render(
      <ul>
        <LoanCard
          loan={{ ...loan, activity: [{ kind: "overdue_reminder", status: "sent", at: now - 2 * 86_400_000 }] }}
          viewer="borrower"
        />
      </ul>,
    );
    expect(screen.getByText("Reminder sent 2 days ago")).toBeInTheDocument();
    expect(activityText({ kind: "workflow_error", status: "failed", at: now }, now)).toBe(
      "Automation error failed just now",
    );
  });

  test("has no axe violations", async () => {
    const { container } = render(
      <ul>
        <LoanCard loan={loan} viewer="lender" />
      </ul>,
    );
    expect(await axeViolations(container)).toEqual([]);
  });
});
