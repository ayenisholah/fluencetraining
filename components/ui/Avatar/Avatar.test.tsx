import { render, screen } from "@testing-library/react";
import { describe, expect, test } from "vitest";
import { Avatar, AvatarGroup, initials } from "./Avatar";

describe("Avatar", () => {
  test("initials", () => {
    expect(initials("Ada Lovelace")).toBe("AL");
    expect(initials("  shola  ")).toBe("S");
    expect(initials("Mary Jane Watson")).toBe("MW");
    expect(initials("")).toBe("?");
  });
  test("falls back to labelled initials, or an image with alt", () => {
    const { rerender } = render(<Avatar name="Ada Lovelace" />);
    expect(screen.getByRole("img", { name: "Ada Lovelace" })).toHaveTextContent("AL");
    rerender(<Avatar name="Ada" src="/ada.png" />);
    expect(screen.getByRole("img", { name: "Ada" })).toHaveAttribute("src", "/ada.png");
  });
  test("group shows overflow", () => {
    render(<AvatarGroup max={2} people={[{ name: "A B" }, { name: "C D" }, { name: "E F" }]} />);
    expect(screen.getByRole("group", { name: "3 people" })).toHaveTextContent("+1");
  });
});
