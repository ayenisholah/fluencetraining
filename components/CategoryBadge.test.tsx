import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, test, vi } from "vitest";
import { axeViolations } from "@/test/axe";
import { CATEGORY_STYLES } from "@/lib/categories";
import { CategoryBadge } from "./CategoryBadge";
import { PhotoPicker, photoError } from "./PhotoPicker";
import { ToolImage } from "./ToolImage";

describe("CategoryBadge", () => {
  test("every category has its own preset colour", () => {
    const colours = Object.values(CATEGORY_STYLES).map((s) => s.color);
    expect(new Set(colours).size).toBe(colours.length);
    for (const [category, style] of Object.entries(CATEGORY_STYLES)) {
      const { unmount } = render(<CategoryBadge category={category} />);
      expect(screen.getByText(style.label).className).toContain(`bg-preset-${style.color}-soft`);
      unmount();
    }
  });

  test("unknown categories fall back to Other", () => {
    render(<CategoryBadge category="spaceships" />);
    expect(screen.getByText("Other")).toBeInTheDocument();
  });

  test("ToolImage shows the photo, or a decorative tile in the category colour", () => {
    const { rerender, container } = render(<ToolImage src="https://x/1.png" name="Ladder" category="hand_tools" />);
    expect(screen.getByRole("img", { name: "Ladder" })).toHaveAttribute("loading", "lazy");
    rerender(<ToolImage src={null} name="Ladder" category="hand_tools" />);
    expect(screen.queryByRole("img")).toBeNull();
    expect(container.firstElementChild?.className).toContain("bg-preset-blue-soft");
  });
});

describe("PhotoPicker", () => {
  test("rejects SVG, other types and files over 5 MB before upload", () => {
    expect(photoError(new File(["<svg/>"], "a.svg", { type: "image/svg+xml" }))).toMatch(/JPEG, PNG or WebP/);
    expect(photoError(new File(["x"], "a.gif", { type: "image/gif" }))).toMatch(/JPEG, PNG or WebP/);
    expect(photoError(new File([new Uint8Array(5 * 1024 * 1024 + 1)], "a.jpg", { type: "image/jpeg" }))).toMatch(/5 MB/);
    expect(photoError(new File(["x"], "a.webp", { type: "image/webp" }))).toBeUndefined();
  });

  test("an invalid choice shows an alert and doesn't change the value", async () => {
    const onChange = vi.fn();
    render(<PhotoPicker value={{ kind: "none" }} onChange={onChange} />);
    await userEvent.upload(screen.getByLabelText("Choose a photo"), new File(["x"], "a.gif", { type: "image/gif" }), { applyAccept: false });
    expect(screen.getByRole("alert")).toHaveTextContent(/JPEG, PNG or WebP/);
    expect(onChange).not.toHaveBeenCalled();
  });

  test("has no axe violations", async () => {
    const { container } = render(<PhotoPicker value={{ kind: "existing", url: "https://x/1.png" }} onChange={() => {}} />);
    expect(await axeViolations(container)).toEqual([]);
  });
});
