import { expect, test, type Page } from "@playwright/test";
import {
  acceptEssentialOnly,
  cardFor,
  cli,
  expectNoAxeViolations,
  expectNoHorizontalScroll,
  listTool,
  promoteToAdmin,
  purgeTestTool,
  requestToBorrow,
  signedInPage,
} from "./helpers";
import { ADMIN, OWNER, RENTER } from "./users";

// Roles & rules end to end. Needs the local stack (docker compose) and Clerk
// dev keys, like signed-in.spec.ts. The server-side rules are covered
// exhaustively in convex/access.test.ts; this checks the real app honours them.
test.describe.configure({ mode: "serial" });

const toolName = `E2E admin wheelbarrow ${Date.now().toString(36)}`;
const bulkName = `E2E bulk ${Date.now().toString(36)}`;
const ownerName = `${OWNER.firstName} ${OWNER.lastName}`;
const renterName = `${RENTER.firstName} ${RENTER.lastName}`;

let admin: Page;
let owner: Page;
let renter: Page;
let visitor: Page;

const section = (page: Page, title: string) =>
  page.locator("section").filter({ has: page.getByRole("heading", { name: title, exact: true }) });

test.beforeAll(async ({ browser }) => {
  test.setTimeout(120_000);
  // Signing in once creates the Convex user row (as role "user").
  admin = await signedInPage(browser, ADMIN.email);
  promoteToAdmin(ADMIN.email);
  owner = await signedInPage(browser, OWNER.email);
  renter = await signedInPage(browser, RENTER.email);
  visitor = await (await browser.newContext()).newPage();
  await visitor.goto("/");
  await acceptEssentialOnly(visitor);
});

test.afterAll(async () => {
  for (const page of [admin, owner, renter, visitor]) await page?.context().close();
  purgeTestTool(toolName);
  cli("npx", ["convex", "run", "dev:purgeTestData", JSON.stringify({ prefix: bulkName })]);
});

test("only admins get the admin area", async () => {
  const nav = (page: Page) => page.getByRole("navigation", { name: "Main" });
  await renter.goto("/tools");
  await expect(nav(renter).getByRole("link", { name: "Admin" })).toHaveCount(0);
  await renter.goto("/admin");
  await expect(renter.getByText("Admins only")).toBeVisible();
  await expect(renter.getByRole("heading", { name: "All loans" })).toHaveCount(0);

  await admin.goto("/tools");
  await expect(nav(admin).getByRole("link", { name: "Admin" })).toBeVisible();
  await nav(admin).getByRole("link", { name: "Admin" }).click();
  await expect(admin.getByRole("heading", { level: 1, name: "Admin" })).toBeVisible();
});

test("set-up: owner lists a tool, renter borrows it, owner approves", async () => {
  await listTool(owner, toolName, "Garden");
  await expect(
    (await requestToBorrow(renter, toolName)).getByText("Request sent. The lender has been notified."),
  ).toBeVisible();
  await owner.goto("/incoming");
  await cardFor(owner, toolName, "Requested").getByRole("button", { name: "Approve" }).click();
  await expect(cardFor(owner, toolName, "On loan")).toHaveCount(1);
});

test("users only see edit and delete on their own listings", async () => {
  // The board offers no owner actions at all, mine or anyone else's.
  await renter.goto("/tools");
  await expect(cardFor(renter, toolName)).toHaveCount(1);
  await expect(renter.getByRole("button", { name: /^(Edit|Delete|Remove)$/ })).toHaveCount(0);
  // My listings is scoped to the caller: the renter doesn't see the owner's tool there.
  await renter.goto("/listings");
  await expect(renter.getByRole("heading", { level: 1, name: "My listings" })).toBeVisible();
  await expect(cardFor(renter, toolName)).toHaveCount(0);
  await owner.goto("/listings");
  await expect(cardFor(owner, toolName).getByRole("button", { name: "Edit" })).toBeVisible();
});

test("users only see loans they're part of", async () => {
  await admin.goto("/incoming");
  await expect(admin.getByRole("heading", { level: 1, name: "Incoming requests" })).toBeVisible();
  await expect(cardFor(admin, toolName)).toHaveCount(0);
  await admin.goto("/requests");
  await expect(admin.getByRole("heading", { level: 1, name: "My requests" })).toBeVisible();
  await expect(cardFor(admin, toolName)).toHaveCount(0);
  // The admin's own views stay personal; all loans live on the admin page.
});

test("admin views all loans, with both parties", async () => {
  await admin.goto("/admin");
  const loans = section(admin, "All loans");
  const row = loans.getByRole("listitem").filter({ hasText: toolName });
  await expect(row).toHaveCount(1);
  await expect(row).toContainText(`${ownerName} → ${renterName}`);
  await expect(row.getByText("On loan", { exact: true })).toBeVisible();
});

test("admin marks the owner a trusted lender, and can undo it", async () => {
  await admin.goto("/admin");
  await admin.getByRole("searchbox", { name: "Search members by name or email" }).fill(ownerName);
  const trusted = admin.getByRole("switch", { name: `${ownerName}: Trusted` });
  // Start from a known state in case an earlier run was interrupted.
  if ((await trusted.getAttribute("aria-checked")) === "true") await trusted.click();
  await expect(trusted).toHaveAttribute("aria-checked", "false");

  await trusted.click();
  await expect(trusted).toHaveAttribute("aria-checked", "true");
  await renter.goto("/tools");
  await expect(cardFor(renter, toolName).getByText("Trusted lender")).toBeVisible();

  await trusted.click();
  await expect(trusted).toHaveAttribute("aria-checked", "false");
  await renter.reload();
  await expect(cardFor(renter, toolName)).toHaveCount(1);
  await expect(cardFor(renter, toolName).getByText("Trusted lender")).toHaveCount(0);
});

test("admin removes someone else's listing even while it's on loan", async () => {
  await admin.goto("/admin");
  const listings = section(admin, "Listings");
  await listings.getByRole("button", { name: `Remove ${toolName}` }).click();
  const confirm = admin.getByRole("alertdialog", { name: `Remove "${toolName}"?` });
  await expect(confirm).toContainText("The loan stays open");
  await confirm.getByRole("button", { name: "Keep" }).click();
  await expect(listings.getByRole("button", { name: `Remove ${toolName}` })).toBeVisible();

  await listings.getByRole("button", { name: `Remove ${toolName}` }).click();
  await confirm.getByRole("button", { name: "Remove listing" }).click();
  await expect(listings.getByRole("button", { name: `Remove ${toolName}` })).toHaveCount(0);

  await renter.goto("/tools");
  await expect(renter.getByRole("heading", { level: 1, name: "All tools" })).toBeVisible();
  await expect(cardFor(renter, toolName)).toHaveCount(0);
  await owner.goto("/listings");
  await expect(owner.getByRole("heading", { level: 1, name: "My listings" })).toBeVisible();
  await expect(cardFor(owner, toolName)).toHaveCount(0);
});

test("the loan on a removed listing can still be closed, and the tool stays gone", async () => {
  await owner.goto("/incoming");
  const active = cardFor(owner, toolName, "On loan");
  await expect(active).toHaveCount(1);
  await active.getByRole("button", { name: "Mark returned" }).click();
  await expect(cardFor(owner, toolName, "Returned")).toHaveCount(1);

  await renter.goto("/requests");
  await expect(cardFor(renter, toolName, "Returned")).toHaveCount(1);

  await visitor.goto("/");
  const available = visitor.getByRole("region", { name: "Available now" });
  await expect(available.getByRole("list", { name: "Loading tools" })).toHaveCount(0);
  await expect(available.getByText(toolName)).toHaveCount(0);
  await renter.goto("/tools");
  await expect(renter.getByRole("heading", { level: 1, name: "All tools" })).toBeVisible();
  await expect(cardFor(renter, toolName)).toHaveCount(0);
});

test("admin page passes axe", async () => {
  await admin.goto("/admin");
  await expect(section(admin, "Members")).toBeVisible();
  await expectNoAxeViolations(admin);
});

test("admin bulk removal selects only the visible page and clamps the final page", async () => {
  test.setTimeout(180_000);
  for (let i = 1; i <= 11; i++) await listTool(i <= 6 ? owner : renter, `${bulkName} ${i}`, "Garden");
  await admin.goto("/admin");
  const listings = section(admin, "Listings");
  await listings.getByRole("searchbox").fill(bulkName);
  await expect(listings.getByRole("navigation", { name: "listings pagination" })).toContainText(
    "Showing 1–10 of 11 listings",
  );
  await expect(listings.getByRole("listitem")).toHaveCount(10);
  await listings.getByRole("button", { name: "Next" }).click();
  await expect(listings.getByRole("listitem")).toHaveCount(1);
  await listings.getByRole("checkbox", { name: "Select all on this page" }).check();
  await listings.getByRole("button", { name: "Remove selected (1)" }).click();
  await admin.getByRole("alertdialog").getByRole("button", { name: "Keep" }).click();
  await listings.getByRole("button", { name: "Remove selected (1)" }).click();
  await admin.getByRole("alertdialog").getByRole("button", { name: "Remove selected", exact: true }).click();
  await expect(listings.getByRole("listitem")).toHaveCount(10);
  await expect(listings.locator('[aria-current="page"]')).toHaveAttribute("aria-label", "Page 1");
  await listings.getByRole("checkbox", { name: "Select all on this page" }).check();
  for (const theme of ["light", "dark"]) {
    await admin.evaluate((value) => document.documentElement.setAttribute("data-theme", value), theme);
    for (const width of [1920, 375]) {
      await admin.setViewportSize({ width, height: 900 });
      await expectNoHorizontalScroll(admin);
      await listings.screenshot({ path: `test-results/screens/admin-bulk-${theme}-${width}.png` });
    }
  }
  await expectNoAxeViolations(admin);
  await listings.getByRole("button", { name: "Remove selected (10)" }).click();
  await admin.getByRole("alertdialog").getByRole("button", { name: "Remove selected", exact: true }).click();
  await expect(listings.getByRole("listitem")).toHaveCount(0);
  await expect(listings.getByRole("status")).toContainText("10 listings removed.");
  await expect(listings.getByRole("button", { name: "Remove selected (0)" })).toBeDisabled();
});
