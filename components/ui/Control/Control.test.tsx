import { render, screen } from "@testing-library/react";
import { describe, expect, test } from "vitest";
import { axeViolations } from "@/test/axe";
import { PlusIcon } from "../icons";
import { Control, IconButton } from "./Control";

describe("Control", () => {
  test("is a pill button", () => {
    render(<Control variant="dim">Filter</Control>);
    expect(screen.getByRole("button", { name: "Filter" }).className).toContain("rounded-pill");
  });
  test("IconButton requires and exposes a label", async () => {
    const { container } = render(<IconButton label="Add tool"><PlusIcon /></IconButton>);
    expect(screen.getByRole("button", { name: "Add tool" })).toHaveAttribute("title", "Add tool");
    expect(await axeViolations(container)).toEqual([]);
  });
});
