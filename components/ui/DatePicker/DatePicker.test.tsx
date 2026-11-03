import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { describe, expect, test } from "vitest";
import { axeViolations } from "@/test/axe";
import { addDays, formatLong } from "@/lib/calendar";
import { todayIso } from "@/lib/format";
import { DatePicker } from "./DatePicker";

function Harness(props: { initial?: string; min?: string; max?: string; name?: string; range?: [string, string] }) {
  const [value, setValue] = useState(props.initial ?? "");
  return (
    <form data-testid="form">
      <DatePicker
        label="From"
        value={value}
        onValueChange={setValue}
        min={props.min}
        max={props.max}
        name={props.name}
        rangeStart={props.range?.[0]}
        rangeEnd={props.range?.[1]}
      />
    </form>
  );
}

const trigger = () => screen.getByRole("button", { name: /^From/ });
const day = (iso: string) => screen.getByRole("button", { name: formatLong(iso) });

describe("DatePicker", () => {
  test("shows the placeholder, then the chosen date", async () => {
    render(<Harness />);
    expect(trigger()).toHaveTextContent("Select a date");
    await userEvent.click(trigger());
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(screen.getByRole("grid")).toBeInTheDocument();
    await userEvent.click(day(addDays(todayIso(), 2)));
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(trigger()).toHaveFocus();
    expect(trigger()).not.toHaveTextContent("Select a date");
  });

  test("opens on the selected day, with today marked", async () => {
    const selected = addDays(todayIso(), 5);
    render(<Harness initial={selected} />);
    await userEvent.click(trigger());
    expect(day(selected)).toHaveFocus();
    expect(day(selected).closest("td")).toHaveAttribute("aria-selected", "true");
    expect(day(todayIso())).toHaveAttribute("aria-current", "date");
  });

  test("keyboard: arrows, Home/End, PageDown, Enter, Escape", async () => {
    const start = "2026-11-04"; // a Wednesday
    render(<Harness initial={start} />);
    await userEvent.click(trigger());
    await userEvent.keyboard("{ArrowRight}");
    expect(day("2026-11-05")).toHaveFocus();
    await userEvent.keyboard("{ArrowDown}");
    expect(day("2026-11-12")).toHaveFocus();
    await userEvent.keyboard("{Home}");
    expect(day("2026-11-09")).toHaveFocus();
    await userEvent.keyboard("{End}");
    expect(day("2026-11-15")).toHaveFocus();
    await userEvent.keyboard("{PageDown}");
    expect(screen.getByText("December 2026")).toBeInTheDocument();
    expect(day("2026-12-15")).toHaveFocus();
    await userEvent.keyboard("{Escape}");
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(trigger()).toHaveTextContent("4 Nov 2026");
    await userEvent.click(trigger());
    await userEvent.keyboard("{ArrowLeft}{Enter}");
    expect(trigger()).toHaveTextContent("3 Nov 2026");
  });

  test("days outside min/max can't be chosen and focus stays inside the range", async () => {
    const min = "2026-11-10";
    const max = "2026-11-20";
    render(<Harness initial="2026-11-12" min={min} max={max} />);
    await userEvent.click(trigger());
    expect(day("2026-11-09")).toHaveAttribute("aria-disabled", "true");
    await userEvent.click(day("2026-11-09"));
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    await userEvent.keyboard("{ArrowUp}");
    expect(day(min)).toHaveFocus();
    expect(screen.getByRole("button", { name: "Previous month" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Next month" })).toBeDisabled();
  });

  test("range days are highlighted; hidden input carries the value", async () => {
    render(<Harness initial="2026-11-04" name="from" range={["2026-11-04", "2026-11-06"]} />);
    expect(new FormData(screen.getByTestId("form") as HTMLFormElement).get("from")).toBe("2026-11-04");
    await userEvent.click(trigger());
    expect(day("2026-11-05").closest("td")?.className).toContain("bg-brand-soft");
    expect(day("2026-11-07").closest("td")?.className).not.toContain("bg-brand-soft");
  });

  test("closed and open states have no axe violations", async () => {
    const { container } = render(<Harness initial="2026-11-04" />);
    expect(await axeViolations(container)).toEqual([]);
    await userEvent.click(trigger());
    expect(await axeViolations(container)).toEqual([]);
  });
});
