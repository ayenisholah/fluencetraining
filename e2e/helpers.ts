import AxeBuilder from "@axe-core/playwright";
import { expect, type Page } from "@playwright/test";

/** Dismiss the consent banner so it doesn't cover content in assertions. */
export async function acceptEssentialOnly(page: Page) {
  const banner = page.getByRole("dialog", { name: "Cookie preferences" });
  if (await banner.isVisible().catch(() => false)) {
    await banner.getByRole("button", { name: "Essential only" }).click();
    await expect(banner).toBeHidden();
  }
}

export async function expectNoAxeViolations(page: Page) {
  const results = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]).analyze();
  const summary = results.violations.map((v) => `${v.id}: ${v.help} → ${v.nodes.map((n) => n.target.join(" ")).join(", ")}`);
  expect(summary).toEqual([]);
}

export async function expectNoHorizontalScroll(page: Page) {
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(overflow).toBeLessThanOrEqual(0);
}
