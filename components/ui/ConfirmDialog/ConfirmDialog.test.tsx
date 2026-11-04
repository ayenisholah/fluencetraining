import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ConvexError } from "convex/values";
import { describe, expect, test, vi } from "vitest";
import { axeViolations } from "@/test/axe";
import { useConfirm } from "./ConfirmDialog";

function Harness({ onConfirm }: { onConfirm: () => Promise<unknown> }) {
  const { confirm, dialog } = useConfirm();
  return (
    <>
      <button
        onClick={() =>
          confirm({
            title: 'Delete "Ladder"?',
            description: "Open requests will be declined.",
            confirmLabel: "Delete listing",
            onConfirm,
          })
        }
      >
        Delete
      </button>
      {dialog}
    </>
  );
}

describe("ConfirmDialog", () => {
  test("opens as a labelled alertdialog with focus on the safe button", async () => {
    render(<Harness onConfirm={vi.fn().mockResolvedValue(null)} />);
    await userEvent.click(screen.getByRole("button", { name: "Delete" }));
    const dialog = screen.getByRole("alertdialog", { name: 'Delete "Ladder"?' });
    expect(dialog).toHaveAccessibleDescription("Open requests will be declined.");
    expect(screen.getByRole("button", { name: "Keep" })).toHaveFocus();
  });

  test("Keep and Escape cancel and return focus to the trigger", async () => {
    const onConfirm = vi.fn();
    render(<Harness onConfirm={onConfirm} />);
    const trigger = screen.getByRole("button", { name: "Delete" });
    await userEvent.click(trigger);
    await userEvent.click(screen.getByRole("button", { name: "Keep" }));
    expect(screen.queryByRole("alertdialog")).toBeNull();
    expect(trigger).toHaveFocus();
    await userEvent.click(trigger);
    screen.getByRole("alertdialog").dispatchEvent(new Event("cancel", { cancelable: true }));
    await vi.waitFor(() => expect(screen.queryByRole("alertdialog")).toBeNull());
    expect(onConfirm).not.toHaveBeenCalled();
  });

  test("confirm runs the action and closes", async () => {
    const onConfirm = vi.fn().mockResolvedValue(null);
    render(<Harness onConfirm={onConfirm} />);
    await userEvent.click(screen.getByRole("button", { name: "Delete" }));
    await userEvent.click(screen.getByRole("button", { name: "Delete listing" }));
    expect(onConfirm).toHaveBeenCalledOnce();
    expect(screen.queryByRole("alertdialog")).toBeNull();
  });

  test("while pending both buttons are disabled; a refusal stays in the dialog", async () => {
    let reject!: (e: unknown) => void;
    const onConfirm = vi.fn(() => new Promise((_, r) => (reject = r)));
    render(<Harness onConfirm={onConfirm} />);
    await userEvent.click(screen.getByRole("button", { name: "Delete" }));
    await userEvent.click(screen.getByRole("button", { name: "Delete listing" }));
    expect(screen.getByRole("button", { name: "Keep" })).toBeDisabled();
    expect(screen.getByRole("button", { name: /Delete listing/ })).toHaveAttribute("aria-busy", "true");
    reject(new ConvexError({ code: "BAD_REQUEST", message: "This tool is on loan." }));
    expect(await screen.findByText("This tool is on loan.")).toBeInTheDocument();
    expect(screen.getByRole("alertdialog")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Keep" })).toBeEnabled();
  });

  test("has no axe violations", async () => {
    const { container } = render(<Harness onConfirm={vi.fn()} />);
    await userEvent.click(screen.getByRole("button", { name: "Delete" }));
    expect(await axeViolations(container)).toEqual([]);
  });
});
