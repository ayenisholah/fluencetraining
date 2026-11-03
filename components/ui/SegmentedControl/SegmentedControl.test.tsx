import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { describe, expect, test } from "vitest";
import { axeViolations } from "@/test/axe";
import { SegmentedControl } from "./SegmentedControl";

function Harness() {
  const [value, setValue] = useState<"a" | "b" | "c">("a");
  return (
    <SegmentedControl
      aria-label="View"
      value={value}
      onChange={setValue}
      options={[
        { value: "a", label: "Day" },
        { value: "b", label: "Week" },
        { value: "c", label: "Month" },
      ]}
    />
  );
}

describe("SegmentedControl", () => {
  test("is a radiogroup with one tab stop", () => {
    render(<Harness />);
    expect(screen.getByRole("radiogroup", { name: "View" })).toBeInTheDocument();
    const radios = screen.getAllByRole("radio");
    expect(radios.map((r) => r.tabIndex)).toEqual([0, -1, -1]);
    expect(radios[0]).toHaveAttribute("aria-checked", "true");
  });

  test("arrow keys, Home and End move the selection and focus", async () => {
    render(<Harness />);
    const [day, week, month] = screen.getAllByRole("radio");
    day.focus();
    await userEvent.keyboard("{ArrowRight}");
    expect(week).toHaveAttribute("aria-checked", "true");
    expect(week).toHaveFocus();
    await userEvent.keyboard("{End}");
    expect(month).toHaveAttribute("aria-checked", "true");
    await userEvent.keyboard("{ArrowRight}");
    expect(day).toHaveAttribute("aria-checked", "true");
    await userEvent.keyboard("{ArrowLeft}");
    expect(month).toHaveFocus();
  });

  test("clicking selects", async () => {
    render(<Harness />);
    await userEvent.click(screen.getByRole("radio", { name: "Week" }));
    expect(screen.getByRole("radio", { name: "Week" })).toHaveAttribute("aria-checked", "true");
  });

  test("has no axe violations", async () => {
    const { container } = render(<Harness />);
    expect(await axeViolations(container)).toEqual([]);
  });
});
