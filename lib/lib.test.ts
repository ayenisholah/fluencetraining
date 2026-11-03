import { describe, expect, test } from "vitest";
import { cn } from "./cn";
import { categoryLabel, conditionLabel, formatDate, timeAgo } from "./format";
import { loanActions, loanStatusBadge } from "./loanStatus";
import { appNav, isActive } from "./nav";
import { applyTheme, readTheme, THEME_KEY, writeTheme } from "./theme";

describe("cn", () => {
  test("later Tailwind classes win", () => {
    expect(cn("px-2 text-fg", "px-4")).toBe("text-fg px-4");
  });
  test("type-scale and colour classes don't cancel each other", () => {
    expect(cn("text-body text-fg")).toBe("text-body text-fg");
    expect(cn("text-body", "text-h4")).toBe("text-h4");
  });
});

describe("theme", () => {
  const memory = () => {
    const data = new Map<string, string>();
    return {
      getItem: (k: string) => data.get(k) ?? null,
      setItem: (k: string, v: string) => void data.set(k, v),
      removeItem: (k: string) => void data.delete(k),
    };
  };
  test("defaults to system and round-trips a choice", () => {
    const store = memory();
    expect(readTheme(store)).toBe("system");
    writeTheme(store, "dark");
    expect(store.getItem(THEME_KEY)).toBe("dark");
    expect(readTheme(store)).toBe("dark");
    writeTheme(store, "system");
    expect(store.getItem(THEME_KEY)).toBeNull();
  });
  test("ignores junk and survives storage errors", () => {
    expect(readTheme({ getItem: () => "purple" })).toBe("system");
    expect(readTheme({ getItem: () => { throw new Error("blocked"); } })).toBe("system");
    expect(() => writeTheme({ setItem: () => { throw new Error("blocked"); }, removeItem: () => {} }, "dark")).not.toThrow();
  });
  test("applyTheme sets or clears data-theme", () => {
    const el = document.createElement("html");
    applyTheme(el, "dark");
    expect(el.dataset.theme).toBe("dark");
    applyTheme(el, "system");
    expect(el.hasAttribute("data-theme")).toBe(false);
  });
});

describe("loan status", () => {
  test("labels and tones", () => {
    expect(loanStatusBadge("requested")).toEqual({ label: "Requested", tone: "warning" });
    expect(loanStatusBadge("approved")).toEqual({ label: "On loan", tone: "brand" });
    expect(loanStatusBadge("approved", true)).toEqual({ label: "Overdue", tone: "danger" });
    expect(loanStatusBadge("returned", true)).toEqual({ label: "Returned", tone: "success" });
  });
  test("actions mirror the server rules", () => {
    expect(loanActions("requested", "lender")).toEqual({ approve: true, decline: true, markReturned: false, cancel: false });
    expect(loanActions("requested", "borrower")).toEqual({ approve: false, decline: false, markReturned: false, cancel: true });
    expect(loanActions("approved", "lender").markReturned).toBe(true);
    expect(Object.values(loanActions("returned", "lender")).some(Boolean)).toBe(false);
  });
});

describe("nav", () => {
  test("admin link only for admins", () => {
    expect(appNav("user").map((l) => l.href)).not.toContain("/admin");
    expect(appNav(undefined).map((l) => l.href)).not.toContain("/admin");
    expect(appNav("admin").at(-1)?.href).toBe("/admin");
  });
  test("active matching", () => {
    expect(isActive("/tools", "/tools")).toBe(true);
    expect(isActive("/tools/123", "/tools")).toBe(true);
    expect(isActive("/toolshed", "/tools")).toBe(false);
  });
});

describe("format", () => {
  test("labels", () => {
    expect(categoryLabel("power_tools")).toBe("Power tools");
    expect(categoryLabel(undefined)).toBe("");
    expect(conditionLabel("worn")).toBe("Well used");
  });
  test("timeAgo", () => {
    const now = Date.UTC(2026, 10, 3, 12);
    expect(timeAgo(now - 10_000, now)).toBe("just now");
    expect(timeAgo(now - 5 * 60_000, now)).toBe("5 min ago");
    expect(timeAgo(now - 3 * 3_600_000, now)).toBe("3 h ago");
    expect(timeAgo(now - 30 * 3_600_000, now)).toBe("yesterday");
    expect(timeAgo(now - 72 * 3_600_000, now)).toBe("3 days ago");
  });
  test("formatDate is UTC and stable", () => {
    expect(formatDate("2026-11-04")).toMatch(/4/);
    expect(formatDate("2026-11-04")).toMatch(/Nov/);
  });
});
