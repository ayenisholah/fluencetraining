import { act, fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, test, vi } from "vitest";
import { ConvexError } from "convex/values";
import { axeViolations } from "@/test/axe";
import { addDays, formatCompact, formatLong } from "@/lib/calendar";
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

  test("moving From past Until pushes Until along, so the range stays valid", async () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    render(<BorrowForm onSubmit={onSubmit} onSent={vi.fn()} onCancel={vi.fn()} />);
    await userEvent.click(screen.getByRole("button", { name: /^From/ }));
    await userEvent.click(screen.getByRole("button", { name: formatLong(todayIso(5)) }));
    expect(screen.getByRole("button", { name: /^Until/ })).toHaveTextContent(formatCompact(todayIso(5)));
    await userEvent.click(screen.getByRole("button", { name: "Send request" }));
    expect(onSubmit).toHaveBeenCalledWith({ startDate: todayIso(5), endDate: todayIso(5) });
  });

  test("Until is limited to 30 days after From and highlights the range", async () => {
    render(<BorrowForm onSubmit={vi.fn()} onSent={vi.fn()} onCancel={vi.fn()} />);
    const until = screen.getByRole("button", { name: /^Until/ });
    expect(until).toHaveAccessibleDescription(/Up to 30 days/);
    await userEvent.click(until);
    const start = todayIso(1);
    expect(screen.getByRole("button", { name: formatLong(addDays(start, 30)) })).not.toHaveAttribute("aria-disabled");
    await userEvent.keyboard("{PageDown}{PageDown}");
    expect(screen.getByRole("button", { name: formatLong(addDays(start, 30)) })).toHaveFocus();
    await userEvent.keyboard("{Escape}");
    await userEvent.click(until);
    expect(screen.getByRole("button", { name: formatLong(todayIso(2)) }).closest("td")?.className).toContain(
      "bg-brand-soft",
    );
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

test("repeated submit events while a request is pending send only once", async () => {
  let finish!: () => void;
  const onSubmit = vi.fn(
    () =>
      new Promise<void>((resolve) => {
        finish = resolve;
      }),
  );
  const onSent = vi.fn();
  render(<BorrowForm onSubmit={onSubmit} onSent={onSent} onCancel={vi.fn()} />);
  const button = screen.getByRole("button", { name: "Send request" });
  act(() => {
    fireEvent.submit(button.closest("form")!);
    fireEvent.submit(button.closest("form")!);
  });
  expect(onSubmit).toHaveBeenCalledTimes(1);
  expect(button).toBeDisabled();
  await act(async () => finish());
  expect(onSent).toHaveBeenCalledOnce();
});

test("a server refusal is shown and releases the submit guard for retry", async () => {
  const onSubmit = vi
    .fn()
    .mockRejectedValueOnce(
      new ConvexError({ code: "BAD_REQUEST", message: "The tool is already lent out for those dates." }),
    )
    .mockResolvedValueOnce(undefined);
  const onSent = vi.fn();
  render(<BorrowForm onSubmit={onSubmit} onSent={onSent} onCancel={vi.fn()} />);
  const button = screen.getByRole("button", { name: "Send request" });
  await userEvent.click(button);
  expect(await screen.findByText("The tool is already lent out for those dates.")).toBeVisible();
  expect(button).toBeEnabled();
  expect(onSent).not.toHaveBeenCalled();
  await userEvent.click(button);
  expect(onSubmit).toHaveBeenCalledTimes(2);
  expect(onSent).toHaveBeenCalledOnce();
});
