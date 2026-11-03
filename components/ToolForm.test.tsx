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

  test("errors appear on blur, not while typing for the first time", async () => {
    render(<ToolForm submitLabel="List it" onSubmit={vi.fn()} />);
    const name = screen.getByLabelText("Name");
    await userEvent.type(name, "a");
    expect(name).not.toHaveAttribute("aria-invalid");
    await userEvent.tab();
    expect(name).toHaveAttribute("aria-invalid", "true");
  });

  test("valid input submits trimmed values and resets the new-listing form", async () => {
    const onSubmit = vi.fn().mockResolvedValue("id");
    render(<ToolForm submitLabel="List it" onSubmit={onSubmit} />);
    await userEvent.type(screen.getByLabelText("Name"), "Ladder");
    await userEvent.selectOptions(screen.getByLabelText("Category"), "hand_tools");
    await userEvent.selectOptions(screen.getByLabelText("Condition"), "fair");
    await userEvent.type(screen.getByLabelText("Short description"), "3m");
    await userEvent.click(screen.getByRole("button", { name: "List it" }));
    expect(onSubmit).toHaveBeenCalledWith({ name: "Ladder", category: "hand_tools", condition: "fair", description: "3m" });
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
    expect(description).toHaveAttribute("aria-invalid", "true");
    expect(screen.getByText("501/500")).toBeInTheDocument();
  });

  test("has no axe violations", async () => {
    const { container } = render(<ToolForm submitLabel="Save" onSubmit={vi.fn()} onCancel={() => {}} />);
    expect(await axeViolations(container)).toEqual([]);
  });
});
