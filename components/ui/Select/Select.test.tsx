import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { describe, expect, test } from "vitest";
import { axeViolations } from "@/test/axe";
import { Select, typeaheadMatch, type SelectOption } from "./Select";

const options: SelectOption[] = [
  { value: "power", label: "Power tools" },
  { value: "hand", label: "Hand tools" },
  { value: "garden", label: "Garden" },
  { value: "gear", label: "Gear" },
  { value: "kitchen", label: "Kitchen" },
];

function Harness(props: { hideLabel?: boolean; name?: string; initial?: string }) {
  const [value, setValue] = useState(props.initial ?? "power");
  return (
    <form data-testid="form">
      <Select
        label="Category"
        options={options}
        value={value}
        onValueChange={setValue}
        hideLabel={props.hideLabel}
        name={props.name}
      />
      <button type="button">After</button>
    </form>
  );
}

const trigger = () => screen.getByRole("combobox", { name: /Category/ });

describe("typeaheadMatch", () => {
  test("cycles through matches after the current index", () => {
    expect(typeaheadMatch(options, "g", 0)).toBe(2);
    expect(typeaheadMatch(options, "g", 2)).toBe(3);
    expect(typeaheadMatch(options, "g", 3)).toBe(2);
    expect(typeaheadMatch(options, "ge", 1)).toBe(3);
    expect(typeaheadMatch(options, "z", 0)).toBe(-1);
  });
});

describe("Select", () => {
  test("is a labelled combobox showing the value", () => {
    render(<Harness />);
    expect(trigger()).toHaveAttribute("aria-haspopup", "listbox");
    expect(trigger()).toHaveAttribute("aria-expanded", "false");
    expect(trigger()).toHaveTextContent("Power tools");
  });

  test("click opens a listbox; choosing an option updates and closes", async () => {
    render(<Harness />);
    await userEvent.click(trigger());
    const listbox = screen.getByRole("listbox", { name: "Category" });
    expect(listbox).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "Power tools" })).toHaveAttribute("aria-selected", "true");
    await userEvent.click(screen.getByRole("option", { name: "Garden" }));
    expect(screen.queryByRole("listbox")).toBeNull();
    expect(trigger()).toHaveTextContent("Garden");
    expect(trigger()).toHaveFocus();
  });

  test("keyboard: open, move, select; Escape closes without changing", async () => {
    render(<Harness />);
    trigger().focus();
    await userEvent.keyboard("{ArrowDown}");
    expect(trigger()).toHaveAttribute("aria-expanded", "true");
    expect(trigger().getAttribute("aria-activedescendant")).toMatch(/option-0$/);
    await userEvent.keyboard("{ArrowDown}{ArrowDown}");
    expect(trigger().getAttribute("aria-activedescendant")).toMatch(/option-2$/);
    await userEvent.keyboard("{Enter}");
    expect(trigger()).toHaveTextContent("Garden");
    await userEvent.keyboard("{ArrowDown}{End}{Escape}");
    expect(screen.queryByRole("listbox")).toBeNull();
    expect(trigger()).toHaveTextContent("Garden");
  });

  test("type-ahead works when closed and when open", async () => {
    render(<Harness />);
    trigger().focus();
    await userEvent.keyboard("k");
    expect(trigger()).toHaveTextContent("Kitchen");
    await userEvent.keyboard("{ArrowDown}");
    await userEvent.keyboard("h");
    expect(trigger().getAttribute("aria-activedescendant")).toMatch(/option-1$/);
  });

  test("Tab closes and moves on; outside clicks close", async () => {
    render(<Harness />);
    await userEvent.click(trigger());
    await userEvent.tab();
    expect(screen.queryByRole("listbox")).toBeNull();
    await userEvent.click(trigger());
    await userEvent.click(document.body);
    expect(screen.queryByRole("listbox")).toBeNull();
  });

  test("hidden input submits the value; hideLabel keeps the accessible name", async () => {
    render(<Harness name="category" hideLabel />);
    const form = screen.getByTestId("form") as HTMLFormElement;
    expect(new FormData(form).get("category")).toBe("power");
    expect(screen.queryByText("Category", { selector: "span[aria-hidden]" })).toBeNull();
    expect(trigger()).toBeInTheDocument();
  });

  test("error is announced", () => {
    render(<Select label="Condition" options={options} value="" onValueChange={() => {}} error="Pick one" />);
    const t = screen.getByRole("combobox", { name: /Condition/ });
    expect(t).toHaveAttribute("aria-invalid", "true");
    expect(t).toHaveAccessibleDescription(/Pick one/);
    expect(t).toHaveTextContent("Select…");
  });

  test("closed and open states have no axe violations", async () => {
    const { container } = render(<Harness />);
    expect(await axeViolations(container)).toEqual([]);
    await userEvent.click(trigger());
    expect(await axeViolations(container)).toEqual([]);
  });
});
