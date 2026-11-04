import { describe, expect, test } from "vitest";
import { cleanDisplayName, DISPLAY_NAME_MAX, firstName } from "./lib/people";
import { loanDateError, toolFieldErrors } from "./lib/rules";

const now = Date.UTC(2026, 10, 3, 12);

describe("shared validation rules", () => {
  test("tool fields", () => {
    expect(toolFieldErrors({ name: "Drill", description: "" })).toEqual({});
    expect(toolFieldErrors({ name: " a ", description: "" }).name).toMatch(/at least 2/);
    expect(toolFieldErrors({ name: "x".repeat(81), description: "" }).name).toMatch(/under 80/);
    expect(toolFieldErrors({ name: "Drill", description: "x".repeat(501) }).description).toMatch(/under 500/);
  });
  test("tool text is plain: no control or bidi characters (they reach email headers)", () => {
    for (const name of [
      "Drill\r\nBcc: x@evil.example",
      "Drill\u0000",
      "Drill\u0085",
      "Drill\u202Eyrros",
      "Drill\u2066x\u2069",
    ]) {
      expect(toolFieldErrors({ name, description: "" }).name, JSON.stringify(name)).toMatch(/plain text/);
    }
    expect(toolFieldErrors({ name: "Drill", description: "Two lines\nand\ta tab" })).toEqual({});
    expect(toolFieldErrors({ name: "Drill", description: "Ding\u0007" }).description).toMatch(/plain text/);
    expect(toolFieldErrors({ name: "Drill", description: "abc\u202Edef" }).description).toMatch(/plain text/);
    // Ordinary non-ASCII is fine.
    expect(toolFieldErrors({ name: "Rasenmäher – 46 cm 🌱", description: "Très bien" })).toEqual({});
  });
  test("display names from the identity provider are cleaned", () => {
    expect(cleanDisplayName("Eve\r\nBcc: x\u202E")).toBe("Eve Bcc: x");
    expect(cleanDisplayName("  Ada   Lovelace ")).toBe("Ada Lovelace");
    expect(cleanDisplayName("a".repeat(200))).toHaveLength(DISPLAY_NAME_MAX);
    expect(cleanDisplayName("\u0000\u202E")).toBe("Neighbour");
    expect(cleanDisplayName(undefined)).toBe("Neighbour");
    expect(firstName(" Ada  Lovelace")).toBe("Ada");
    expect(firstName("", "A neighbour")).toBe("A neighbour");
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
