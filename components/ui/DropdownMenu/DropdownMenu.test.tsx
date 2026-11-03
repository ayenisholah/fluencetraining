import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, test, vi } from "vitest";
import { axeViolations } from "@/test/axe";
import { DropdownMenu } from "./DropdownMenu";

const setup = () => {
  const onProfile = vi.fn();
  render(
    <>
      <DropdownMenu
        triggerLabel="Account"
        trigger="Account"
        items={[
          { key: "profile", label: "View profile", onSelect: onProfile },
          { key: "tools", label: "All tools", href: "/tools", active: true },
          { key: "out", label: "Sign out", onSelect: () => {} },
        ]}
      />
      <button>Outside</button>
    </>,
  );
  return { onProfile, trigger: screen.getByRole("button", { name: "Account" }) };
};

describe("DropdownMenu", () => {
  test("opens on click and focuses the first item", async () => {
    const { trigger } = setup();
    expect(trigger).toHaveAttribute("aria-expanded", "false");
    await userEvent.click(trigger);
    expect(trigger).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByRole("menu", { name: "Account" })).toBeInTheDocument();
    expect(screen.getByRole("menuitem", { name: "View profile" })).toHaveFocus();
  });

  test("arrow keys wrap, End jumps, Escape closes and returns focus", async () => {
    const { trigger } = setup();
    await userEvent.click(trigger);
    await userEvent.keyboard("{ArrowUp}");
    expect(screen.getByRole("menuitem", { name: "Sign out" })).toHaveFocus();
    await userEvent.keyboard("{ArrowDown}");
    expect(screen.getByRole("menuitem", { name: "View profile" })).toHaveFocus();
    await userEvent.keyboard("{End}");
    expect(screen.getByRole("menuitem", { name: "Sign out" })).toHaveFocus();
    await userEvent.keyboard("{Escape}");
    expect(screen.queryByRole("menu")).toBeNull();
    expect(trigger).toHaveFocus();
  });

  test("ArrowDown on the trigger opens it; selecting runs the handler", async () => {
    const { trigger, onProfile } = setup();
    trigger.focus();
    await userEvent.keyboard("{ArrowDown}");
    await userEvent.keyboard("{Enter}");
    expect(onProfile).toHaveBeenCalledOnce();
    expect(screen.queryByRole("menu")).toBeNull();
  });

  test("links render as anchors with aria-current", async () => {
    const { trigger } = setup();
    await userEvent.click(trigger);
    const link = screen.getByRole("menuitem", { name: "All tools" });
    expect(link.tagName).toBe("A");
    expect(link).toHaveAttribute("href", "/tools");
    expect(link).toHaveAttribute("aria-current", "page");
  });

  test("clicking outside closes", async () => {
    const { trigger } = setup();
    await userEvent.click(trigger);
    await userEvent.click(screen.getByRole("button", { name: "Outside" }));
    expect(screen.queryByRole("menu")).toBeNull();
  });

  test("open menu has no axe violations", async () => {
    const { trigger } = setup();
    await userEvent.click(trigger);
    expect(await axeViolations(document.body)).toEqual([]);
  });
});
