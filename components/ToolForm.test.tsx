import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ConvexError } from "convex/values";
import { describe, expect, test, vi } from "vitest";
import { axeViolations } from "@/test/axe";
import { ToolForm } from "./ToolForm";

describe("ToolForm", () => {
  test("submitting empty shows the name error and focuses the field", async () => {
    const onSubmit = vi.fn();
    render(<ToolForm submitLabel="List it" onSubmit={onSubmit} />);
    await userEvent.click(screen.getByRole("button", { name: "List it" }));
    const name = screen.getByLabelText("Name");
    expect(name).toHaveFocus();
    expect(name).toHaveAttribute("aria-invalid", "true");
    expect(name).toHaveAccessibleDescription(/Give the tool a name/);
    expect(onSubmit).not.toHaveBeenCalled();
  });

  test("pasted control or bidi characters are caught before submitting", async () => {
    const onSubmit = vi.fn();
    render(<ToolForm submitLabel="List it" onSubmit={onSubmit} />);
    const name = screen.getByLabelText("Name");
    await userEvent.click(name);
    await userEvent.paste("Drill\u202Eyrros");
    await userEvent.click(screen.getByRole("button", { name: "List it" }));
    expect(name).toHaveAccessibleDescription(/plain text/);
    expect(onSubmit).not.toHaveBeenCalled();
  });

  test("typing into or leaving a field never shows an error; submitting does, then fixing clears it", async () => {
    render(<ToolForm submitLabel="List it" onSubmit={vi.fn()} />);
    const name = screen.getByLabelText("Name");
    await userEvent.type(name, "a");
    await userEvent.tab();
    await userEvent.click(name);
    await userEvent.clear(name);
    await userEvent.tab();
    expect(name).not.toHaveAttribute("aria-invalid");
    expect(screen.queryByText(/Give the tool a name/)).toBeNull();
    await userEvent.click(screen.getByRole("button", { name: "List it" }));
    expect(name).toHaveAttribute("aria-invalid", "true");
    await userEvent.type(name, "Drill");
    expect(name).not.toHaveAttribute("aria-invalid");
  });

  test("valid input submits trimmed values and resets the new-listing form", async () => {
    const onSubmit = vi.fn().mockResolvedValue("id");
    render(<ToolForm submitLabel="List it" onSubmit={onSubmit} />);
    await userEvent.type(screen.getByLabelText("Name"), "Ladder");
    await userEvent.click(screen.getByRole("combobox", { name: /Category/ }));
    await userEvent.click(screen.getByRole("option", { name: "Hand tools" }));
    await userEvent.click(screen.getByRole("combobox", { name: /Condition/ }));
    await userEvent.click(screen.getByRole("option", { name: "Fair" }));
    await userEvent.type(screen.getByLabelText("Short description"), "3m");
    await userEvent.click(screen.getByRole("button", { name: "List it" }));
    expect(onSubmit).toHaveBeenCalledWith({
      name: "Ladder",
      category: "hand_tools",
      condition: "fair",
      description: "3m",
    });
    expect(screen.getByLabelText("Name")).toHaveValue("");
  });

  test("server errors are shown", async () => {
    const onSubmit = vi.fn().mockRejectedValue(new ConvexError({ code: "RATE_LIMITED", message: "Slow down." }));
    render(<ToolForm submitLabel="List it" onSubmit={onSubmit} />);
    await userEvent.type(screen.getByLabelText("Name"), "Ladder");
    await userEvent.click(screen.getByRole("button", { name: "List it" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Slow down.");
  });

  test("description counter and over-limit error", async () => {
    render(<ToolForm submitLabel="Save" onSubmit={vi.fn()} />);
    const description = screen.getByLabelText("Short description");
    expect(screen.getByText("0/500")).toBeInTheDocument();
    await userEvent.click(description);
    await userEvent.paste("x".repeat(501));
    await userEvent.tab();
    expect(description).not.toHaveAttribute("aria-invalid"); // the counter warns; the error waits for submit
    await userEvent.type(screen.getByLabelText("Name"), "Drill");
    await userEvent.click(screen.getByRole("button", { name: "Save" }));
    expect(description).toHaveAttribute("aria-invalid", "true");
    expect(screen.getByText("501/500")).toBeInTheDocument();
  });

  test("has no axe violations", async () => {
    const { container } = render(<ToolForm submitLabel="Save" onSubmit={vi.fn()} onCancel={() => {}} />);
    expect(await axeViolations(container)).toEqual([]);
  });
});
