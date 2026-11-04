import { expect, test } from "@playwright/test";
import {
  acceptEssentialOnly,
  signedInPage,
  promoteToAdmin,
  listTool,
  purgeTestTool,
  cardFor,
  expectNoHorizontalScroll,
} from "./helpers";
import { ADMIN, RENTER } from "./users";

test.use({ actionTimeout: 15_000 });

const widths = [320, 375, 639, 640, 767, 768, 1023, 1024, 1279, 1280, 1536];

test("pages fit across Tailwind breakpoints in both themes", async ({ browser }) => {
  test.setTimeout(240_000);
  const page = await signedInPage(browser, ADMIN.email);
  promoteToAdmin(ADMIN.email);
  try {
    for (const theme of ["light", "dark"]) {
      await page.evaluate((value) => localStorage.setItem("lendloop.theme", value), theme);
      for (const path of [
        "/tools?view=cards",
        "/tools?view=tiles",
        "/tools?view=list",
        "/listings",
        "/requests",
        "/incoming",
        "/admin",
        "/",
        "/privacy",
        "/terms",
      ]) {
        await page.goto(path);
        await acceptEssentialOnly(page);
        await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
        await expect(page.locator('main [aria-busy="true"]')).toHaveCount(0);
        await expect(page.getByRole("status").filter({ hasText: /Loading…|Setting up/ })).toHaveCount(0);
        await page.evaluate((value) => document.documentElement.setAttribute("data-theme", value), theme);
        for (const width of widths) {
          await page.setViewportSize({ width, height: 900 });
          const overflow = await page.evaluate(() => document.documentElement.scrollWidth - innerWidth);
          expect.soft(overflow, `${theme} ${path} at ${width}px`).toBeLessThanOrEqual(1);
        }
      }
    }
  } finally {
    await page.context().close();
  }
});

test("long listings, borrowing calendars and bulk actions remain usable", async ({ browser }, testInfo) => {
  test.setTimeout(600_000);
  const marker = Date.now().toString();
  const name = `E2E responsive ${marker} ${"LongToolName".repeat(4)}`;
  const owner = await signedInPage(browser, ADMIN.email);
  const renter = await signedInPage(browser, RENTER.email);
  try {
    await listTool(owner, name, "Camping");
    for (const theme of ["light", "dark"]) {
      for (const page of [owner, renter])
        await page.evaluate((value) => localStorage.setItem("lendloop.theme", value), theme);
      for (const width of [320, 375, 640, 768, 1024, 1280, 1536]) {
        for (const view of ["cards", "tiles", "list"]) {
          await renter.setViewportSize({ width, height: 900 });
          await renter.goto(`/tools?view=${view}&q=${encodeURIComponent(marker)}`);
          const card = cardFor(renter, name);
          await expect(card).toBeVisible();
          await acceptEssentialOnly(renter);
          await card.getByRole("button", { name: "Request to borrow", exact: true }).click();
          await expectNoHorizontalScroll(renter);
          await card.getByRole("button", { name: /^Until/ }).click();
          const calendar = card.getByRole("dialog");
          await expect(calendar).toBeVisible();
          const box = await calendar.boundingBox();
          expect(box!.x, `${view} calendar at ${width}`).toBeGreaterThanOrEqual(0);
          expect(box!.x + box!.width).toBeLessThanOrEqual(width);
          await expectNoHorizontalScroll(renter);
          if (width === 320 && view === "tiles")
            await renter.screenshot({ path: testInfo.outputPath(`borrow-${theme}.png`) });
          if (width === 375) {
            await renter.keyboard.press("ArrowRight");
            await renter.keyboard.press("Enter");
          } else await renter.keyboard.press("Escape");
          await expect(calendar).toBeHidden();
          await expect(card.getByRole("button", { name: "Send request", exact: true })).toBeVisible();
          await card.getByRole("button", { name: "Cancel", exact: true }).click();
        }
        await owner.setViewportSize({ width, height: 900 });
        await owner.goto("/listings");
        await owner.getByRole("searchbox", { name: "Search your listings" }).fill(marker);
        await cardFor(owner, name).getByRole("button", { name: "Edit", exact: true }).click();
        await expectNoHorizontalScroll(owner);
        await owner.getByRole("button", { name: "Cancel", exact: true }).click();
        await owner.goto("/admin");
        await expect(owner.getByRole("heading", { level: 1, name: "Admin" })).toBeVisible();
        await acceptEssentialOnly(owner);
        const section = owner
          .locator("section")
          .filter({ has: owner.getByRole("heading", { name: "Listings", exact: true }) });
        await section.getByRole("searchbox", { name: "Search listings" }).fill(marker);
        await expect(section.getByRole("checkbox", { name: `Select ${name}`, exact: true })).toBeVisible();
        await expect(section.getByRole("checkbox")).toHaveCount(2);
        await section.getByRole("checkbox", { name: "Select all on this page" }).check();
        await section.getByRole("button", { name: "Remove selected (1)", exact: true }).click();
        await expect(owner.getByRole("alertdialog", { name: "Remove 1 listing?", exact: true })).toBeVisible();
        await expectNoHorizontalScroll(owner);
        await owner.getByRole("button", { name: "Keep", exact: true }).click();
        if (width === 320) await section.screenshot({ path: testInfo.outputPath(`admin-${theme}.png`) });
        if (width < 1024) {
          await owner.getByRole("button", { name: "Open navigation" }).click();
          await expectNoHorizontalScroll(owner);
          await owner.keyboard.press("Escape");
        }
      }
    }
  } finally {
    try {
      await Promise.allSettled([owner.context().close(), renter.context().close()]);
    } finally {
      purgeTestTool(name);
    }
  }
});
