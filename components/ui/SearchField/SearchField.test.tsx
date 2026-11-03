import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { describe, expect, test } from "vitest";
import { axeViolations } from "@/test/axe";
import { LoadMore } from "../LoadMore/LoadMore";
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

describe("LoadMore", () => {
  test("shows the count, singular for one, and a button only while there is more", () => {
    const { rerender } = render(<LoadMore status="CanLoadMore" count={24} noun="tools" onLoadMore={() => {}} />);
    expect(screen.getByText("Showing 24 tools")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Load more tools" })).toBeEnabled();
    rerender(<LoadMore status="LoadingMore" count={24} noun="tools" onLoadMore={() => {}} />);
    expect(screen.getByRole("button", { name: "Loading…" })).toBeDisabled();
    rerender(<LoadMore status="Exhausted" count={1} noun="listings" onLoadMore={() => {}} />);
    expect(screen.getByText(/Showing 1 listing · that's everything/)).toBeInTheDocument();
    expect(screen.queryByRole("button")).toBeNull();
  });
});
