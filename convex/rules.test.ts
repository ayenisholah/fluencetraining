import { describe, expect, test } from "vitest";
import { loanDateError, toolFieldErrors } from "./lib/rules";

const now = Date.UTC(2026, 10, 3, 12);

describe("shared validation rules", () => {
  test("tool fields", () => {
    expect(toolFieldErrors({ name: "Drill", description: "" })).toEqual({});
    expect(toolFieldErrors({ name: " a ", description: "" }).name).toMatch(/at least 2/);
    expect(toolFieldErrors({ name: "x".repeat(81), description: "" }).name).toMatch(/under 80/);
    expect(toolFieldErrors({ name: "Drill", description: "x".repeat(501) }).description).toMatch(/under 500/);
  });
  test("loan dates", () => {
    expect(loanDateError("2026-11-04", "2026-11-06", now)).toBeUndefined();
    expect(loanDateError("2026-11-03", "2026-11-03", now)).toBeUndefined();
    expect(loanDateError("", "2026-11-06", now)).toMatch(/both/);
    expect(loanDateError("2026-02-30", "2026-03-01", now)).toMatch(/both/);
    expect(loanDateError("2026-11-01", "2026-11-06", now)).toMatch(/past/);
    expect(loanDateError("2026-11-06", "2026-11-04", now)).toMatch(/before the start/);
    expect(loanDateError("2026-11-04", "2026-12-20", now)).toMatch(/30 days/);
  });
});
