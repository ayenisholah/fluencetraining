import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, test } from "vitest";
import { axeViolations } from "@/test/axe";
import { Select } from "../Select/Select";
import { TextField } from "./TextField";

describe("TextField", () => {
  test("label is associated and floats on focus or value", async () => {
    render(<TextField label="Name" />);
    const input = screen.getByLabelText("Name");
    const label = screen.getByText("Name");
    expect(label.className).toContain("top-1/2");
    await userEvent.click(input);
    expect(label.className).toContain("top-1.5");
    await userEvent.type(input, "Drill");
    await userEvent.tab();
    expect(label.className).toContain("top-1.5");
  });

  test("error sets aria-invalid and is described", () => {
    render(<TextField label="Name" error="Give the tool a name." hint="Shown to neighbours" />);
    const input = screen.getByLabelText("Name");
    expect(input).toHaveAttribute("aria-invalid", "true");
    expect(input).toHaveAccessibleDescription(/Give the tool a name\. Shown to neighbours/);
  });

  test("counter tracks length and flags overflow", async () => {
    render(<TextField multiline label="Description" maxLengthHint={5} />);
    const box = screen.getByLabelText("Description");
    expect(box.tagName).toBe("TEXTAREA");
    await userEvent.type(box, "abcdef");
    const count = screen.getByText("6/5");
    expect(count.className).toContain("text-danger");
    expect(box).toHaveAccessibleDescription("6/5");
  });

  test("controlled value is respected", () => {
    render(<TextField label="Name" value="Saw" onChange={() => {}} />);
    expect(screen.getByLabelText("Name")).toHaveValue("Saw");
  });

  test("forwards refs", () => {
    const ref = { current: null as HTMLInputElement | null };
    render(<TextField ref={ref} label="X" />);
    expect(ref.current).toBeInstanceOf(HTMLInputElement);
  });

  test("Select renders options with a label", async () => {
    render(<Select label="Category" options={[{ value: "a", label: "Garden" }, { value: "b", label: "Kitchen" }]} defaultValue="b" />);
    const select = screen.getByLabelText("Category");
    expect(select).toHaveValue("b");
    await userEvent.selectOptions(select, "a");
    expect(select).toHaveValue("a");
  });

  test("has no axe violations, including the error state", async () => {
    const { container } = render(
      <>
        <TextField label="Name" />
        <TextField label="Email" error="Required" />
        <Select label="Category" options={[{ value: "a", label: "A" }]} />
      </>,
    );
    expect(await axeViolations(container)).toEqual([]);
  });
});
