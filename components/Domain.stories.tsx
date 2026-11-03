import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect, fn, userEvent, within } from "storybook/test";
import { BorrowForm } from "./BorrowForm";
import { LoanCard, type LoanView } from "./LoanCard";
import { ToolForm } from "./ToolForm";

const meta = { title: "LendLoop/Domain", component: LoanCard } satisfies Meta<typeof LoanCard>;
export default meta;
type Story = StoryObj<typeof meta>;

const base: LoanView = {
  _id: "l1",
  toolName: "Cordless drill",
  toolCategory: "power_tools",
  startDate: "2026-11-04",
  endDate: "2026-11-06",
  status: "requested",
  overdue: false,
  counterpartName: "Bob",
  activity: [{ kind: "request_notification", status: "sent", at: Date.now() - 60_000 }],
};

export const LoanStates: Story = {
  args: { loan: base, viewer: "lender" },
  render: () => (
    <ul className="grid max-w-3xl gap-3 md:grid-cols-2">
      <LoanCard loan={base} viewer="lender" />
      <LoanCard loan={{ ...base, status: "approved" }} viewer="lender" />
      <LoanCard loan={{ ...base, status: "approved", overdue: true, activity: [{ kind: "overdue_reminder", status: "sent", at: Date.now() - 2 * 86_400_000 }] }} viewer="borrower" />
      <LoanCard loan={{ ...base, status: "declined", activity: [] }} viewer="borrower" />
      <LoanCard loan={{ ...base, status: "returned" }} viewer="lender" />
      <LoanCard loan={base} viewer="borrower" error="Only the borrower can do that." />
    </ul>
  ),
};

export const ToolFormValidation: Story = {
  args: { loan: base, viewer: "lender" },
  render: () => <div className="max-w-sm"><ToolForm submitLabel="List it" onSubmit={fn()} /></div>,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole("button", { name: "List it" }));
    await expect(canvas.getByLabelText("Name")).toHaveAttribute("aria-invalid", "true");
    await expect(canvas.getByLabelText("Name")).toHaveFocus();
  },
};

export const BorrowDates: Story = {
  args: { loan: base, viewer: "lender" },
  render: () => <div className="max-w-sm"><BorrowForm onSubmit={fn()} onSent={fn()} onCancel={fn()} /></div>,
};
