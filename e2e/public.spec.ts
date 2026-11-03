import { expect, test } from "@playwright/test";
import { acceptEssentialOnly, expectNoAxeViolations, expectNoHorizontalScroll } from "./helpers";

test.describe("signed-out visitor", () => {
  test("landing page has one primary call to action", async ({ page }) => {
    await page.goto("/");
    await expect(page).toHaveTitle(/LendLoop/);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(/Borrow what you need/);
    await expect(page.getByRole("button", { name: "Sign in to lend or borrow" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Available now" })).toBeVisible();
  });

  test("sign-in call to action opens the Clerk modal", async ({ page }) => {
    await page.goto("/");
    await acceptEssentialOnly(page);
    await page.getByRole("button", { name: "Sign in to lend or borrow" }).click();
    await expect(page.locator(".cl-modalContent .cl-signIn-root")).toBeVisible();
    await expect(page).toHaveURL(/\/$/);
  });

  test("brand, tagline and the public tools section", async ({ page }) => {
    await page.goto("/");
    await acceptEssentialOnly(page);
    const logo = page.getByRole("link", { name: "LendLoop home" });
    await expect(logo).toBeVisible();
    await expect(logo).toHaveText("LendLoop");
    await expect(page).toHaveTitle("LendLoop · Borrow what you need. Lend what you don't.");
    await expect(page.locator('meta[name="description"]')).toHaveAttribute("content", /Borrow what you need/);
    const section = page.getByRole("region", { name: "Available now" });
    await expect(section).toBeVisible();
    // Read-only: whatever has loaded (skeleton, empty state or tools), nothing in it is actionable.
    await expect(section.getByRole("button")).toHaveCount(0);
    await expect(section.getByRole("link")).toHaveCount(0);
  });

  test("the header Sign in also opens Clerk, and there is no app link while signed out", async ({ page }) => {
    await page.goto("/");
    await acceptEssentialOnly(page);
    await expect(page.getByRole("link", { name: "Browse tools" })).toHaveCount(0);
    await expect(page.getByRole("link", { name: "Open app" })).toHaveCount(0);
    await page.getByRole("banner").getByRole("button", { name: "Sign in", exact: true }).click();
    await expect(page.locator(".cl-modalContent .cl-signIn-root")).toBeVisible();
  });

  test("cookie choice is remembered and can be reopened", async ({ page }) => {
    await page.goto("/");
    const banner = page.getByRole("dialog", { name: "Cookie preferences" });
    await expect(banner).toBeVisible();
    await banner.getByRole("button", { name: "Essential only" }).click();
    await expect(banner).toBeHidden();
    await page.reload();
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    await expect(banner).toBeHidden();
    await page.getByRole("button", { name: "Cookie settings" }).click();
    await expect(banner).toBeVisible();
  });

  test("theme choice persists across reloads", async ({ page, isMobile }) => {
    test.skip(isMobile, "The header theme switch is hidden on small screens.");
    await page.goto("/");
    await page.getByRole("radio", { name: "Dark theme" }).click();
    await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
    await page.reload();
    await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
    await page.getByRole("radio", { name: "Use system theme" }).click();
    await expect(page.locator("html")).not.toHaveAttribute("data-theme", /.+/);
  });

  test("legal pages render with their own titles", async ({ page }) => {
    for (const [path, title] of [["/privacy", "Privacy policy"], ["/terms", "Terms and conditions"]]) {
      await page.goto(path);
      await expect(page).toHaveTitle(`${title} · LendLoop`);
      await expect(page.getByRole("heading", { level: 1, name: title })).toBeVisible();
    }
    await page.goto("/");
    await page.getByRole("contentinfo").getByRole("link", { name: "Terms" }).click();
    await expect(page).toHaveURL(/\/terms$/);
  });

  test("unknown pages return a real 404", async ({ page }) => {
    const response = await page.goto("/definitely-not-a-page");
    expect(response?.status()).toBe(404);
    await expect(page.getByRole("heading", { name: "This page has been borrowed" })).toBeVisible();
  });

  test("app pages send signed-out visitors to sign in", async ({ page }) => {
    for (const path of ["/tools", "/listings", "/requests", "/incoming", "/admin"]) {
      await page.goto(path);
      await expect(page, `${path} should redirect`).toHaveURL(/sign-in/);
    }
  });

  test("no horizontal scrolling", async ({ page }) => {
    for (const path of ["/", "/privacy", "/terms"]) {
      await page.goto(path);
      await expectNoHorizontalScroll(page);
    }
  });

  for (const theme of ["light", "dark"] as const) {
    test(`public pages pass axe (${theme})`, async ({ page }) => {
      await page.emulateMedia({ colorScheme: theme });
      for (const path of ["/", "/privacy", "/terms", "/nope"]) {
        await page.goto(path);
        await acceptEssentialOnly(page);
        await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
        await expectNoAxeViolations(page);
      }
    });
  }
});
