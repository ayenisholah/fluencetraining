import { expect, test, type Page } from "@playwright/test";
import {
  acceptEssentialOnly,
  cardFor,
  expectNoAxeViolations,
  expectNoHorizontalScroll,
  purgeTestTool,
  requestToBorrow,
  signedInPage,
} from "./helpers";
import { BORROWER, LENDER } from "./users";

// Requires the local stack (docker compose: Convex, n8n, Mailpit) and Clerk
// dev keys in .env.local. Runs the whole lend → borrow → approve → return flow.
test.describe.configure({ mode: "serial" });

/** The card for this run's tool, optionally narrowed to one with a given status badge. */
function toolCard(page: Page, status?: string) {
  return cardFor(page, toolName, status);
}

/** Borrower requests this run's tool from /tools. */
function requestFromTools(page: Page) {
  return requestToBorrow(page, toolName);
}

async function pickCategory(page: Page, label: string) {
  await page.getByRole("combobox", { name: /Category/ }).click();
  await page.getByRole("option", { name: label }).click();
}

const toolName = `E2E ladder ${Date.now().toString(36)}`;
let lender: Page;
let borrower: Page;
let visitor: Page;

/** This run's tool as a signed-out visitor sees it on the landing page. */
async function landingCard() {
  await visitor.goto("/");
  const section = visitor.getByRole("region", { name: "Available now" });
  await expect(section.getByRole("list", { name: "Loading tools" })).toHaveCount(0);
  return section.getByRole("listitem").filter({ hasText: toolName });
}

test.beforeAll(async ({ browser }) => {
  test.setTimeout(120_000); // two Clerk sign-ins, often alongside the other specs
  lender = await signedInPage(browser, LENDER.email);
  borrower = await signedInPage(browser, BORROWER.email);
  visitor = await (await browser.newContext()).newPage();
  await visitor.goto("/");
  await acceptEssentialOnly(visitor);
});

test.afterAll(async () => {
  await lender?.context().close();
  await borrower?.context().close();
  await visitor?.context().close();
  purgeTestTool(toolName);
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
  await form.getByRole("combobox", { name: /Category/ }).click();
  await lender.getByRole("option", { name: "Hand tools" }).click();
  await form.getByLabel("Short description").fill("Three metres, folds flat.");
  await form.getByRole("button", { name: "List it" }).click();
  await expect(lender.getByRole("heading", { name: toolName })).toBeVisible();
});

test("landing page: a signed-out visitor sees the new tool with name and category only", async () => {
  const card = await landingCard();
  await expect(card).toHaveCount(1);
  await expect(card).toHaveText(`${toolName}Hand tools`);
  for (const leak of [LENDER.firstName, LENDER.lastName, "lent by", "Three metres", "Good"]) {
    await expect(card).not.toContainText(leak);
  }
  await expect(card.getByRole("link")).toHaveCount(0);
  await expect(card.getByRole("button")).toHaveCount(0);
});

test("lender sees their tool as available but can't request it", async () => {
  await lender.goto("/tools");
  const card = toolCard(lender);
  await expect(card.getByText("Available", { exact: true })).toBeVisible();
  await expect(card.getByText(/Hand tools · .* · lent by you/)).toBeVisible();
  await expect(card.getByRole("button", { name: "Request to borrow" })).toHaveCount(0);
});

test("category filter narrows the board", async () => {
  await borrower.goto("/tools");
  await expect(toolCard(borrower)).toHaveCount(1);
  await pickCategory(borrower, "Garden");
  await expect(toolCard(borrower)).toHaveCount(0);
  await pickCategory(borrower, "Hand tools");
  await expect(toolCard(borrower)).toHaveCount(1);
  await pickCategory(borrower, "All categories");
  await expect(toolCard(borrower)).toHaveCount(1);
});

test("borrower requests it", async () => {
  const card = await requestFromTools(borrower);
  await expect(card.getByText("Request sent. The lender has been notified.")).toBeVisible();
});

test("a second open request for the same tool is refused", async () => {
  const card = await requestFromTools(borrower);
  await expect(card.getByText("You already have an open request for this tool.")).toBeVisible();
  await expect(toolCard(borrower)).toHaveCount(1);
});

test("borrower sees the request under My requests", async () => {
  await borrower.goto("/requests");
  const card = toolCard(borrower, "Requested");
  await expect(card).toHaveCount(1);
  await expect(card.getByText(`lent by ${LENDER.firstName}`)).toBeVisible();
  await expect(card.getByRole("button", { name: "Approve" })).toHaveCount(0);
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

test("landing page hides the tool while it is on loan", async () => {
  await expect(await landingCard()).toHaveCount(0);
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

test("the returned tool is available again, on the board and the landing page", async () => {
  await borrower.goto("/tools");
  await expect(toolCard(borrower).getByText("Available", { exact: true })).toBeVisible();
  await expect(await landingCard()).toHaveCount(1);
});

test("borrower cancels a new request", async () => {
  // Wait for the mutation to land before navigating away, or it may be dropped.
  await expect((await requestFromTools(borrower)).getByText("Request sent. The lender has been notified.")).toBeVisible();
  await borrower.goto("/requests");
  const open = toolCard(borrower, "Requested");
  await open.getByRole("button", { name: "Cancel request" }).click();
  await expect(toolCard(borrower, "Cancelled")).toHaveCount(1);
  await expect(toolCard(borrower, "Requested")).toHaveCount(0);
});

test("lender declines a request; the borrower sees it declined", async () => {
  // Wait for the mutation to land before navigating away, or it may be dropped.
  await expect((await requestFromTools(borrower)).getByText("Request sent. The lender has been notified.")).toBeVisible();
  await lender.goto("/incoming");
  const open = toolCard(lender, "Requested");
  await expect(open).toHaveCount(1);
  await open.getByRole("button", { name: "Decline" }).click();
  await expect(toolCard(lender, "Declined")).toHaveCount(1);
  await expect(toolCard(lender, "Requested")).toHaveCount(0);

  await borrower.goto("/requests");
  await expect(toolCard(borrower, "Declined")).toHaveCount(1);
  await borrower.goto("/tools");
  await expect(toolCard(borrower).getByText("Available", { exact: true })).toBeVisible();
});

test("lender edits the listing", async () => {
  await lender.goto("/listings");
  const card = toolCard(lender);
  await card.getByRole("button", { name: "Edit" }).click();
  // In edit mode the heading becomes the Name field, so find the card by its Save button.
  const form = lender.getByRole("listitem").filter({ has: lender.getByRole("button", { name: "Save" }) });
  await expect(form.getByLabel("Name")).toHaveValue(toolName);
  await form.getByRole("combobox", { name: /Condition/ }).click();
  await lender.getByRole("option", { name: "Fair" }).click();
  await form.getByLabel("Short description").fill("Edited in e2e.");
  await form.getByRole("button", { name: "Save" }).click();
  await expect(card.getByText("Hand tools · Fair")).toBeVisible();
  await expect(card.getByText("Edited in e2e.")).toBeVisible();
});

test("lender deletes the listing after confirming", async () => {
  const card = toolCard(lender);
  await card.getByRole("button", { name: "Delete" }).click();
  await card.getByRole("button", { name: "Keep" }).click();
  await expect(toolCard(lender)).toHaveCount(1);
  await card.getByRole("button", { name: "Delete" }).click();
  await card.getByRole("button", { name: "Confirm delete" }).click();
  await expect(toolCard(lender)).toHaveCount(0);
  await borrower.goto("/tools");
  await expect(toolCard(borrower)).toHaveCount(0);
  await expect(await landingCard()).toHaveCount(0);
});

test("signed-in pages pass axe", async () => {
  for (const path of ["/tools", "/listings", "/requests", "/incoming"]) {
    await lender.goto(path);
    await expect(lender.getByRole("heading", { level: 1 })).toBeVisible();
    await expectNoAxeViolations(lender);
  }
});

test("phone layout: menu, account button and no sideways scroll", async () => {
  await lender.setViewportSize({ width: 390, height: 844 });
  await lender.goto("/incoming");
  await expect(lender.getByRole("heading", { level: 1 })).toBeVisible();
  await expectNoHorizontalScroll(lender);
  const account = lender.getByRole("button", { name: /open user (button|menu)/i });
  await expect(account).toBeInViewport();
  await lender.getByRole("button", { name: "Open navigation" }).click();
  await lender.getByRole("menuitem", { name: "All tools" }).click();
  await expect(lender).toHaveURL(/\/tools$/);
  await expect(lender.getByRole("menu")).toHaveCount(0);
});
