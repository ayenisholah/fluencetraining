import { readFileSync } from "node:fs";
import { describe, expect, test } from "vitest";
import { EMAIL_CATEGORIES, EMAIL_COLORS, EMAIL_PRESETS } from "@/convex/lib/email/branding";
import { brand } from "./brand";
import { CATEGORY_STYLES } from "./categories";

// Email clients can't use CSS variables, so the email module repeats the
// brand as literals. These checks keep the copies honest.
const css = readFileSync(`${process.cwd()}/app/globals.css`, "utf8");
const dayBlock = css.slice(css.indexOf(":root {"), css.indexOf("@media (prefers-color-scheme: dark)"));
const token = (name: string) => dayBlock.match(new RegExp(`--${name}:\\s*(#[0-9a-fA-F]{3,8})`))?.[1]?.toLowerCase();

describe("email branding matches the app", () => {
  test("brand colours", () => {
    expect(EMAIL_COLORS.brand).toBe(brand.violet);
    expect(EMAIL_COLORS.lilac).toBe(brand.lilac);
    expect(EMAIL_COLORS.paper).toBe(brand.paper);
    expect(EMAIL_COLORS.ink).toBe(brand.ink);
    expect(EMAIL_COLORS.muted).toBe(brand.muted);
    expect(EMAIL_COLORS.brandText).toBe(token("brand-fg"));
    expect(EMAIL_COLORS.success).toBe(token("success"));
    expect(EMAIL_COLORS.warning).toBe(token("warning"));
  });

  test("category presets: same colours and labels as the UI", () => {
    for (const [name, preset] of Object.entries(EMAIL_PRESETS)) {
      expect(preset.text, name).toBe(token(`preset-${name}`));
      expect(preset.soft, name).toBe(token(`preset-${name}-soft`));
    }
    expect(Object.keys(EMAIL_CATEGORIES).sort()).toEqual(Object.keys(CATEGORY_STYLES).sort());
    for (const [category, style] of Object.entries(CATEGORY_STYLES)) {
      expect(EMAIL_CATEGORIES[category]).toEqual({ label: style.label, color: style.color });
    }
  });
});
