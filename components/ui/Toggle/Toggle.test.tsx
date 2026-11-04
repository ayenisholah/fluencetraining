import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { describe, expect, test } from "vitest";
import { axeViolations } from "@/test/axe";
import { Checkbox, Radio } from "../Checkbox/Checkbox";
import { Toggle } from "./Toggle";

function Harness({ disabled = false }) {
  const [on, setOn] = useState(false);
  return <Toggle label="Trusted lender" checked={on} onCheckedChange={setOn} disabled={disabled} />;
}

describe("Toggle", () => {
  test("is a labelled switch that flips with click and keyboard", async () => {
    render(<Harness />);
    const sw = screen.getByRole("switch", { name: "Trusted lender" });
    expect(sw).toHaveAttribute("aria-checked", "false");
    await userEvent.click(sw);
    expect(sw).toHaveAttribute("aria-checked", "true");
    await userEvent.keyboard(" ");
    expect(sw).toHaveAttribute("aria-checked", "false");
  });
  test("disabled does nothing", async () => {
    render(<Harness disabled />);
    const sw = screen.getByRole("switch");
    await userEvent.click(sw);
    expect(sw).toHaveAttribute("aria-checked", "false");
  });
  test("icon-only toggle uses aria-label", () => {
    render(<Toggle aria-label="Notifications" checked onCheckedChange={() => {}} />);
    expect(screen.getByRole("switch", { name: "Notifications" })).toBeChecked();
  });
});

describe("Checkbox and Radio", () => {
  test("native, labelled and checkable", async () => {
    render(
      <fieldset>
        <legend>Size</legend>
        <Checkbox label="Remember me" />
        <Radio name="size" label="Small" value="s" />
        <Radio name="size" label="Large" value="l" />
      </fieldset>,
    );
    await userEvent.click(screen.getByLabelText("Remember me"));
    expect(screen.getByRole("checkbox", { name: "Remember me" })).toBeChecked();
    await userEvent.click(screen.getByLabelText("Large"));
    expect(screen.getByRole("radio", { name: "Large" })).toBeChecked();
    expect(screen.getByRole("radio", { name: "Small" })).not.toBeChecked();
  });
  test("have no axe violations", async () => {
    const { container } = render(
      <>
        <Harness />
        <Checkbox label="A" />
        <Radio name="r" label="B" />
      </>,
    );
    expect(await axeViolations(container)).toEqual([]);
  });
});

test("mixed checkbox has a native indeterminate state and supports keyboard selection", async () => {
  function Mixed() {
    const [selected, setSelected] = useState(false);
    return (
      <Checkbox
        label="Select all"
        checked={selected}
        indeterminate={!selected}
        onChange={(e) => setSelected(e.target.checked)}
      />
    );
  }
  const { container } = render(<Mixed />);
  const checkbox = screen.getByRole("checkbox", { name: "Select all" });
  expect(checkbox).toBePartiallyChecked();
  expect(await axeViolations(container)).toEqual([]);
  await userEvent.tab();
  await userEvent.keyboard(" ");
  expect(checkbox).toBeChecked();
  expect(checkbox).not.toBePartiallyChecked();
});
