import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, test, vi } from "vitest";
import { axeViolations } from "@/test/axe";
import { todayIso } from "@/lib/format";
import { BorrowForm, dateErrorField } from "./BorrowForm";

describe("dateErrorField", () => {
  test("routes messages to the right field", () => {
    expect(dateErrorField("The start date is in the past.", "2026-01-01")).toBe("from");
    expect(dateErrorField("The end date is before the start date.", "2026-01-01")).toBe("until");
    expect(dateErrorField("Loans can last at most 30 days.", "2026-01-01")).toBe("until");
    expect(dateErrorField("Pick both dates.", "")).toBe("from");
    expect(dateErrorField("Pick both dates.", "2026-01-01")).toBe("until");
  });
});

describe("BorrowForm", () => {
  test("defaults are valid and submit the dates", async () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    const onSent = vi.fn();
    render(<BorrowForm onSubmit={onSubmit} onSent={onSent} onCancel={vi.fn()} />);
    await userEvent.click(screen.getByRole("button", { name: "Send request" }));
    expect(onSubmit).toHaveBeenCalledWith({ startDate: todayIso(1), endDate: todayIso(3) });
    expect(onSent).toHaveBeenCalledOnce();
  });

  test("an end date before the start blocks submit with a message", async () => {
    const onSubmit = vi.fn();
    render(<BorrowForm onSubmit={onSubmit} onSent={vi.fn()} onCancel={vi.fn()} />);
    fireEvent.change(screen.getByLabelText("Until"), { target: { value: todayIso(0) } });
    fireEvent.change(screen.getByLabelText("From"), { target: { value: todayIso(5) } });
    await userEvent.click(screen.getByRole("button", { name: "Send request" }));
    expect(onSubmit).not.toHaveBeenCalled();
    expect(screen.getByLabelText("Until")).toHaveAccessibleDescription(/before the start date/);
  });

  test("more than 30 days is flagged on the Until field", () => {
    render(<BorrowForm onSubmit={vi.fn()} onSent={vi.fn()} onCancel={vi.fn()} />);
    const until = screen.getByLabelText("Until");
    fireEvent.change(until, { target: { value: todayIso(60) } });
    expect(until).toHaveAttribute("aria-invalid", "true");
    expect(until).toHaveAccessibleDescription(/at most 30 days/);
  });

  test("cancel calls back", async () => {
    const onCancel = vi.fn();
    render(<BorrowForm onSubmit={vi.fn()} onSent={vi.fn()} onCancel={onCancel} />);
    await userEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(onCancel).toHaveBeenCalledOnce();
  });

  test("has no axe violations", async () => {
    const { container } = render(<BorrowForm onSubmit={vi.fn()} onSent={vi.fn()} onCancel={vi.fn()} />);
    expect(await axeViolations(container)).toEqual([]);
  });
});
