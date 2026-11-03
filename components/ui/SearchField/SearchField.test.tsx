import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { describe, expect, test } from "vitest";
import { axeViolations } from "@/test/axe";
import { SearchField } from "./SearchField";

function Harness() {
  const [value, setValue] = useState("");
  return <SearchField label="Search tools" value={value} onChange={setValue} />;
}

describe("SearchField", () => {
  test("is a named search landmark with a labelled searchbox", () => {
    render(<Harness />);
    expect(screen.getByRole("search", { name: "Search tools" })).toBeInTheDocument();
    expect(screen.getByRole("searchbox", { name: "Search tools" })).toHaveAttribute("maxlength", "100");
  });

  test("clear button and Escape empty it", async () => {
    render(<Harness />);
    const box = screen.getByRole("searchbox");
    expect(screen.queryByRole("button", { name: "Clear search" })).toBeNull();
    await userEvent.type(box, "drill");
    await userEvent.click(screen.getByRole("button", { name: "Clear search" }));
    expect(box).toHaveValue("");
    await userEvent.type(box, "saw{Escape}");
    expect(box).toHaveValue("");
  });

  test("has no axe violations", async () => {
    const { container } = render(<Harness />);
    expect(await axeViolations(container)).toEqual([]);
  });
});
