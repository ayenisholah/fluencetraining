import { render, screen } from "@testing-library/react";
import { describe, expect, test } from "vitest";
import { ToolIcon } from "../icons";
import { SidebarItem } from "./SidebarItem";

describe("SidebarItem", () => {
  test("active item is marked as the current page and filled", () => {
    render(
      <nav>
        <SidebarItem href="/tools" icon={<ToolIcon />} label="All tools" active />
        <SidebarItem href="/incoming" icon={<ToolIcon />} label="Incoming" count={2} />
      </nav>,
    );
    const active = screen.getByRole("link", { name: "All tools" });
    expect(active).toHaveAttribute("aria-current", "page");
    expect(active.className).toContain("bg-brand");
    const other = screen.getByRole("link", { name: /Incoming/ });
    expect(other).not.toHaveAttribute("aria-current");
    expect(other).toHaveTextContent("2");
  });
  test("zero count is hidden", () => {
    render(<SidebarItem href="/x" icon={null} label="X" count={0} />);
    expect(screen.getByRole("link").textContent).toBe("X");
  });
});
