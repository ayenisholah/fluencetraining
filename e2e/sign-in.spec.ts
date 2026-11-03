import { setupClerkTestingToken } from "@clerk/testing/playwright";
import { expect, test } from "@playwright/test";
import { acceptEssentialOnly } from "./helpers";
import { RENTER } from "./users";

// Goes through Clerk's real modal (email + one-time code) to check where a
// sign-in from the public pages lands. +clerk_test addresses accept 424242 on
// development instances.
for (const [where, button] of [
  ["the hero", "Sign in to lend or borrow"],
  ["the header", "Sign in"],
] as const) {
  test(`signing in from ${where} lands on /tools`, async ({ page }) => {
    test.setTimeout(90_000);
    await setupClerkTestingToken({ page });
    await page.goto("/");
    await acceptEssentialOnly(page);
    await page.waitForFunction(() => (window as unknown as { Clerk?: { loaded?: boolean } }).Clerk?.loaded === true);
    await page.getByRole("button", { name: button, exact: true }).first().click();
    const modal = page.locator(".cl-modalContent");
    await modal.getByLabel(/email address/i).fill(RENTER.email);
    await modal.getByRole("button", { name: "Continue", exact: true }).click();
    // The code field auto-advances; typing fills all six boxes.
    await expect(modal.getByText(/verification code|check your email/i).first()).toBeVisible();
    await page.keyboard.type("424242");
    await expect(page).toHaveURL(/\/tools$/, { timeout: 30_000 });
    await expect(page.getByRole("heading", { level: 1, name: "All tools" })).toBeVisible();
  });
}
