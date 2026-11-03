import { clerk } from "@clerk/testing/playwright";
import { expect, test, type Browser, type Page } from "@playwright/test";
import { acceptEssentialOnly, expectNoAxeViolations } from "./helpers";
import { BORROWER, LENDER } from "./users";

// Requires the local stack (docker compose: Convex, n8n, Mailpit) and Clerk
// dev keys in .env.local. Runs the whole lend → borrow → approve → return flow.
test.describe.configure({ mode: "serial" });

async function signedInPage(browser: Browser, email: string): Promise<Page> {
  const context = await browser.newContext();
  const page = await context.newPage();
  await page.goto("/");
  await clerk.signIn({ page, emailAddress: email });
  await page.goto("/tools");
  await acceptEssentialOnly(page);
  await expect(page.getByRole("heading", { level: 1, name: "All tools" })).toBeVisible();
  return page;
}

const toolName = `E2E ladder ${Date.now().toString(36)}`;
let lender: Page;
let borrower: Page;

test.beforeAll(async ({ browser }) => {
  lender = await signedInPage(browser, LENDER.email);
  borrower = await signedInPage(browser, BORROWER.email);
});

test.afterAll(async () => {
  await lender?.context().close();
  await borrower?.context().close();
});

test("non-admins don't get the admin area", async () => {
  await expect(lender.getByRole("navigation", { name: "Main" }).getByRole("link", { name: "Admin" })).toHaveCount(0);
  await lender.goto("/admin");
  await expect(lender.getByText("Admins only")).toBeVisible();
});

test("listing form validates before submitting", async () => {
  await lender.goto("/listings");
  const form = lender.getByRole("region", { name: "List a tool" });
  await form.getByRole("button", { name: "List it" }).click();
  const name = form.getByLabel("Name");
  await expect(name).toHaveAttribute("aria-invalid", "true");
  await expect(name).toBeFocused();
});

test("lender lists a tool", async () => {
  const form = lender.getByRole("region", { name: "List a tool" });
  await form.getByLabel("Name").fill(toolName);
  await form.getByLabel("Category").selectOption("hand_tools");
  await form.getByLabel("Short description").fill("Three metres, folds flat.");
  await form.getByRole("button", { name: "List it" }).click();
  await expect(lender.getByRole("heading", { name: toolName })).toBeVisible();
});

test("borrower requests it", async () => {
  await borrower.goto("/tools");
  const card = borrower.getByRole("listitem").filter({ has: borrower.getByRole("heading", { name: toolName }) });
  await card.getByRole("button", { name: "Request to borrow" }).click();
  await card.getByRole("button", { name: "Send request" }).click();
  await expect(card.getByText("Request sent. The lender has been notified.")).toBeVisible();
});

test("lender approves; both sides see it on loan", async () => {
  await lender.goto("/incoming");
  const card = lender.getByRole("listitem").filter({ has: lender.getByRole("heading", { name: toolName }) });
  await expect(card.getByText(`requested by ${BORROWER.firstName}`)).toBeVisible();
  await card.getByRole("button", { name: "Approve" }).click();
  await expect(card.getByText("On loan")).toBeVisible();

  await borrower.goto("/requests");
  const mine = borrower.getByRole("listitem").filter({ has: borrower.getByRole("heading", { name: toolName }) });
  await expect(mine.getByText("On loan")).toBeVisible();
  await expect(mine.getByText(`lent by ${LENDER.firstName}`)).toBeVisible();
});

test("automation activity appears on the loan", async () => {
  const card = lender.getByRole("listitem").filter({ has: lender.getByRole("heading", { name: toolName }) });
  await expect(card.getByText(/Notification sent/)).toBeVisible({ timeout: 20_000 });
});

test("lender marks it returned", async () => {
  const card = lender.getByRole("listitem").filter({ has: lender.getByRole("heading", { name: toolName }) });
  await card.getByRole("button", { name: "Mark returned" }).click();
  await expect(card.getByText("Returned")).toBeVisible();
  await expect(card.getByRole("button")).toHaveCount(0);
});

test("signed-in pages pass axe", async () => {
  for (const path of ["/tools", "/listings", "/requests", "/incoming"]) {
    await lender.goto(path);
    await expect(lender.getByRole("heading", { level: 1 })).toBeVisible();
    await expectNoAxeViolations(lender);
  }
});
