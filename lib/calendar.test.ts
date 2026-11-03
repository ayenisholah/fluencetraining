import { describe, expect, test } from "vitest";
import {
  addDays,
  addMonths,
  clampIso,
  endOfWeek,
  formatCompact,
  formatLong,
  formatMonth,
  isOutside,
  monthGrid,
  parseIso,
  startOfWeek,
  toIso,
  weekday,
  weekdayLabels,
} from "./calendar";

describe("calendar", () => {
  test("parseIso rejects impossible dates", () => {
    expect(parseIso("2026-11-04")).toEqual({ year: 2026, month: 10, day: 4 });
    expect(parseIso("2026-02-30")).toBeNull();
    expect(parseIso("2024-02-29")).not.toBeNull();
    expect(parseIso("2025-02-29")).toBeNull();
    expect(parseIso("4/11/2026")).toBeNull();
    expect(parseIso("")).toBeNull();
  });

  test("toIso normalises overflow", () => {
    expect(toIso(2026, 11, 32)).toBe("2027-01-01");
    expect(toIso(2026, 0, 0)).toBe("2025-12-31");
  });

  test("addDays crosses months, years and DST-free UTC", () => {
    expect(addDays("2026-12-31", 1)).toBe("2027-01-01");
    expect(addDays("2026-03-01", -1)).toBe("2026-02-28");
    expect(addDays("2026-03-29", 7)).toBe("2026-04-05");
  });

  test("addMonths clamps to the last day", () => {
    expect(addMonths("2026-01-31", 1)).toBe("2026-02-28");
    expect(addMonths("2024-01-31", 1)).toBe("2024-02-29");
    expect(addMonths("2026-11-15", -12)).toBe("2025-11-15");
    expect(addMonths("2026-12-10", 1)).toBe("2027-01-10");
  });

  test("weeks start on Monday by default", () => {
    expect(weekday("2026-11-04")).toBe(3); // Wednesday
    expect(startOfWeek("2026-11-04")).toBe("2026-11-02");
    expect(endOfWeek("2026-11-04")).toBe("2026-11-08");
    expect(startOfWeek("2026-11-04", 0)).toBe("2026-11-01");
  });

  test("monthGrid is 6×7, starts on the week start and contains the whole month", () => {
    const grid = monthGrid(2026, 10);
    expect(grid).toHaveLength(6);
    expect(grid.every((w) => w.length === 7)).toBe(true);
    expect(grid[0][0]).toBe("2026-10-26");
    const flat = grid.flat();
    expect(flat).toContain("2026-11-01");
    expect(flat).toContain("2026-11-30");
    expect(new Set(flat).size).toBe(42);
  });

  test("clamping and bounds", () => {
    expect(clampIso("2026-11-01", "2026-11-04", "2026-11-10")).toBe("2026-11-04");
    expect(clampIso("2026-11-20", "2026-11-04", "2026-11-10")).toBe("2026-11-10");
    expect(clampIso("2026-11-05")).toBe("2026-11-05");
    expect(isOutside("2026-11-03", "2026-11-04")).toBe(true);
    expect(isOutside("2026-11-04", "2026-11-04", "2026-11-04")).toBe(false);
  });

  test("formatting", () => {
    expect(formatMonth(2026, 10)).toBe("November 2026");
    expect(formatLong("2026-11-04")).toBe("Wednesday, 4 November 2026");
    expect(formatCompact("2026-11-04")).toBe("4 Nov 2026");
    expect(weekdayLabels().map((d) => d.short)).toEqual(["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"]);
    expect(weekdayLabels(0)[0].long).toBe("Sunday");
  });
});
