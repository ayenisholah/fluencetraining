import { expect, test } from "@playwright/test";
import { acceptEssentialOnly, expectNoAxeViolations, expectNoHorizontalScroll, watchCsp } from "./helpers";

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
    // Read-only tools: the section has search, category chips and pagination, but the
    // tool cards themselves carry no buttons or links (name and category only).
    const cards = section.getByRole("listitem");
    await expect(cards.getByRole("button")).toHaveCount(0);
    await expect(cards.getByRole("link")).toHaveCount(0);
  });

  test("How it works sits between the hero and the tool list, as three ordered steps", async ({ page }) => {
    await page.goto("/");
    const how = page.getByRole("region", { name: "How it works" });
    const available = page.getByRole("region", { name: "Available now" });
    const [howBox, availableBox] = await Promise.all([how.boundingBox(), available.boundingBox()]);
    expect(howBox!.y).toBeLessThan(availableBox!.y);
    await expect(how.locator("ol > li")).toHaveCount(3);
  });

  test("the header Sign in is a brand button", async ({ page }) => {
    await page.goto("/");
    const signIn = page.getByRole("banner").getByRole("button", { name: "Sign in", exact: true });
    const background = await signIn.evaluate((el) => getComputedStyle(el).backgroundColor);
    expect(background).not.toMatch(/rgba?\(0, 0, 0, 0\)|transparent/);
  });

  test("the header Sign in also opens Clerk, and there is no app link while signed out", async ({ page }) => {
    await page.goto("/");
    await acceptEssentialOnly(page);
    await expect(page.getByRole("link", { name: "Browse tools" })).toHaveCount(0);
    await expect(page.getByRole("link", { name: "Open app" })).toHaveCount(0);
    await page.getByRole("banner").getByRole("button", { name: "Sign in", exact: true }).click();
    await expect(page.locator(".cl-modalContent .cl-signIn-root")).toBeVisible();
  });

  test("pages are served with a strict, per-request Content-Security-Policy", async ({ page }) => {
    const first = await page.goto("/");
    const csp = first?.headers()["content-security-policy"] ?? "";
    const directive = (name: string) =>
      csp
        .split(";")
        .map((d) => d.trim())
        .find((d) => d.startsWith(`${name} `)) ?? "";
    expect(directive("script-src")).toMatch(/'nonce-[A-Za-z0-9+/=]+'/);
    expect(directive("script-src")).toContain("'strict-dynamic'");
    expect(directive("script-src")).not.toMatch(/(^|\s)(https?:|\*)(\s|$)/); // no blanket host allow-lists
    expect(directive("frame-ancestors")).toBe("frame-ancestors 'none'");
    expect(directive("object-src")).toBe("object-src 'none'");
    expect(directive("base-uri")).toBe("base-uri 'self'");
    expect(directive("connect-src")).toMatch(/wss?:\/\//); // the Convex sync socket
    // The nonce is fresh on every request.
    const second = await page.reload();
    const nonce = (h?: string) => h?.match(/'nonce-([^']+)'/)?.[1];
    expect(nonce(second?.headers()["content-security-policy"])).not.toBe(nonce(csp));
    // And it's the one on the inline theme script.
    expect(await page.locator("head script[nonce]").count()).toBeGreaterThan(0);
  });

  test("nothing on the public pages, or Clerk's sign-in, is blocked by the policy", async ({ page }) => {
    const violations = await watchCsp(page);
    for (const path of ["/", "/privacy", "/terms"]) {
      await page.goto(path);
      await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    }
    await page.goto("/");
    await acceptEssentialOnly(page);
    await expect(page.getByRole("region", { name: "Available now" }).getByRole("listitem").first()).toBeVisible();
    // Clerk's script must have loaded (under the CSP) before the button does anything.
    await page.waitForFunction(() => (window as unknown as { Clerk?: { loaded?: boolean } }).Clerk?.loaded === true);
    await page.getByRole("button", { name: "Sign in to lend or borrow" }).click();
    await expect(page.locator(".cl-modalContent .cl-signIn-root")).toBeVisible();
    expect(await violations()).toEqual([]);
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
    for (const [path, title] of [
      ["/privacy", "Privacy policy"],
      ["/terms", "Terms and conditions"],
    ]) {
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
