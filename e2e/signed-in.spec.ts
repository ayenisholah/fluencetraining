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

/** The board's category chips are a radiogroup. */
async function pickCategory(page: Page, label: string) {
  await page.getByRole("radiogroup", { name: "Category" }).getByRole("radio", { name: label }).click();
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

// A real 1×1 PNG, so the browser can decode the preview and the board image.
const PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==",
  "base64",
);

test("lender lists a tool with a photo", async () => {
  const form = lender.getByRole("region", { name: "List a tool" });
  await form.getByLabel("Name").fill(toolName);
  await form.getByRole("combobox", { name: /Category/ }).click();
  await lender.getByRole("option", { name: "Hand tools" }).click();
  await form.getByLabel("Short description").fill("Three metres, folds flat.");
  await form.getByLabel("Choose a photo").setInputFiles({ name: "ladder.png", mimeType: "image/png", buffer: PNG });
  await expect(form.getByRole("img", { name: "Selected photo" })).toBeVisible();
  await form.getByRole("button", { name: "List it" }).click();
  await expect(lender.getByRole("heading", { name: toolName })).toBeVisible();
  // The form resets for the next listing.
  await expect(form.getByLabel("Name")).toHaveValue("");
  await expect(form.getByRole("img", { name: "Selected photo" })).toHaveCount(0);
});

test("the photo shows on the board, served from Convex", async () => {
  await borrower.goto("/tools");
  const img = toolCard(borrower).getByRole("img", { name: toolName });
  await expect(img).toBeVisible();
  await expect(img).toHaveAttribute("src", /\/api\/storage\//);
  await expect.poll(() => img.evaluate((el) => (el as HTMLImageElement).naturalWidth)).toBe(1);
});

test("the board switches between cards, tiles and list", async () => {
  await borrower.goto("/tools");
  const views = borrower.getByRole("radiogroup", { name: "View" });
  const grid = borrower.locator("ul[data-view]");
  for (const [label, view] of [["Tiles", "tiles"], ["List", "list"], ["Cards", "cards"]] as const) {
    await views.getByRole("radio", { name: label }).click();
    await expect(grid).toHaveAttribute("data-view", view);
    await expect(toolCard(borrower).getByRole("img", { name: toolName })).toBeVisible();
    await expect(toolCard(borrower).getByText("Hand tools", { exact: true })).toBeVisible();
  }
  // List rows are one line: much shorter than cards.
  await views.getByRole("radio", { name: "List" }).click();
  await expect(grid).toHaveAttribute("data-view", "list");
  const rowHeight = (await toolCard(borrower).boundingBox())!.height;
  await views.getByRole("radio", { name: "Cards" }).click();
  await expect(grid).toHaveAttribute("data-view", "cards");
  const cardHeight = (await toolCard(borrower).boundingBox())!.height;
  expect(rowHeight).toBeLessThan(cardHeight / 2);
  // The chosen view survives a reload.
  await views.getByRole("radio", { name: "Tiles" }).click();
  await expect(borrower).toHaveURL(/[?&]view=tiles/);
  await borrower.reload();
  await expect(grid).toHaveAttribute("data-view", "tiles");
  await views.getByRole("radio", { name: "Cards" }).click();
});

test("screenshots for review: board views, landing and listings, light and dark", async () => {
  for (const scheme of ["light", "dark"] as const) {
    await borrower.emulateMedia({ colorScheme: scheme });
    for (const view of ["cards", "tiles", "list"]) {
      await borrower.goto(view === "cards" ? "/tools" : `/tools?view=${view}`);
      await expect(borrower.locator("ul[data-view]")).toBeVisible();
      await borrower.screenshot({ path: `test-results/screens/board-${view}-${scheme}.png` });
    }
    await borrower.goto("/listings");
    await expect(borrower.getByRole("heading", { level: 1, name: "My listings" })).toBeVisible();
    await borrower.screenshot({ path: `test-results/screens/listings-${scheme}.png` });
    await visitor.emulateMedia({ colorScheme: scheme });
    await visitor.goto("/");
    await expect(visitor.getByRole("region", { name: "How it works" })).toBeVisible();
    await visitor.screenshot({ path: `test-results/screens/landing-${scheme}.png`, fullPage: true });
  }
  await borrower.emulateMedia({ colorScheme: null });
  await visitor.emulateMedia({ colorScheme: null });
});

test("board search finds the tool on the server and survives a reload", async () => {
  await borrower.goto("/tools");
  const search = borrower.getByRole("searchbox", { name: "Search tools" });
  const runId = toolName.split(" ").at(-1)!;
  await search.fill(runId);
  await expect(borrower).toHaveURL(new RegExp(`[?&]q=${runId}`));
  await expect(toolCard(borrower)).toHaveCount(1);
  await expect(borrower.getByRole("heading", { level: 2 })).toHaveCount(1); // nothing else matches
  await borrower.reload();
  await expect(search).toHaveValue(runId);
  await expect(toolCard(borrower)).toHaveCount(1);
  await search.fill("qqzzxxnomatch");
  await expect(borrower.getByText('No tools match "qqzzxxnomatch"')).toBeVisible();
  await borrower.getByRole("button", { name: "Clear filters" }).click();
  await expect(borrower).toHaveURL(/\/tools$/);
});

test("landing page: search finds the new tool for a signed-out visitor", async () => {
  await visitor.goto("/");
  await visitor.getByRole("searchbox", { name: "Search available tools" }).fill(toolName.split(" ").at(-1)!);
  const section = visitor.getByRole("region", { name: "Available now" });
  await expect(section.getByRole("listitem")).toHaveCount(1);
  await expect(section.getByRole("listitem")).toHaveText(`${toolName}Hand tools`);
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
  await expect(card.getByText("Hand tools", { exact: true })).toBeVisible();
  await expect(card.getByText("Your listing")).toBeVisible();
  await expect(card.getByRole("button", { name: "Request to borrow" })).toHaveCount(0);
});

test("category filter narrows the board", async () => {
  await borrower.goto("/tools");
  await expect(toolCard(borrower)).toHaveCount(1);
  await pickCategory(borrower, "Garden");
  await expect(toolCard(borrower)).toHaveCount(0);
  await pickCategory(borrower, "Hand tools");
  await expect(toolCard(borrower)).toHaveCount(1);
  await pickCategory(borrower, "All");
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
  await borrower.getByRole("alertdialog").getByRole("button", { name: "Cancel request" }).click();
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
  const dialog = lender.getByRole("alertdialog", { name: `Decline ${BORROWER.firstName}'s request?` });
  await dialog.getByRole("button", { name: "Decline request" }).click();
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
  await expect(card.getByText("Fair", { exact: true })).toBeVisible();
  await expect(card.getByText("Edited in e2e.")).toBeVisible();
});

test("lender deletes the listing after confirming in a dialog", async () => {
  const card = toolCard(lender);
  const trigger = card.getByRole("button", { name: "Delete" });
  await trigger.click();
  const dialog = lender.getByRole("alertdialog", { name: `Delete "${toolName}"?` });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByRole("button", { name: "Keep" })).toBeFocused();
  // Escape cancels and puts focus back where it was.
  await lender.keyboard.press("Escape");
  await expect(dialog).toBeHidden();
  await expect(trigger).toBeFocused();
  await expect(toolCard(lender)).toHaveCount(1);
  await trigger.click();
  await dialog.getByRole("button", { name: "Delete listing" }).click();
  await expect(dialog).toBeHidden();
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
