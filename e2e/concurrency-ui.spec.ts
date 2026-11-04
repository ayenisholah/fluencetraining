import { expect, test, type Page } from "@playwright/test";
import { ConvexHttpClient } from "convex/browser";
import { api } from "../convex/_generated/api";
import { cardFor, cli, listTool, signedInPage } from "./helpers";
import { RACE_OWNER, RACE_A, RACE_B } from "./users";

test.describe.configure({ mode: "serial" });
test.setTimeout(90_000); // Multiple real pages, Clerk sessions, and reactive round trips.
let owner: Page, a: Page, b: Page, ownerTab: Page, duplicateTab: Page;
const prefix = `E2E browser race ${Date.now().toString(36)}`;
const names = ["duplicate", "approvals", "cancel", "remove"].map((name) => `${prefix} ${name}`);
async function client(page: Page) {
  const token = await page.evaluate(async () => {
    const clerk = (
      window as unknown as { Clerk: { session: { getToken(options: { template: string }): Promise<string | null> } } }
    ).Clerk;
    return clerk.session.getToken({ template: "convex" });
  });
  if (!token) throw new Error("Missing signed-in Convex token.");
  const connection = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!, { logger: false });
  connection.setAuth(token);
  return connection;
}
async function prepare(page: Page, name: string) {
  await page.goto(`/tools?q=${encodeURIComponent(name)}`);
  const card = cardFor(page, name);
  await card.getByRole("button", { name: "Request to borrow" }).click();
  return card.getByRole("button", { name: "Send request" });
}
async function incoming(page: Page, name: string) {
  await page.goto("/incoming");
  await page.getByRole("searchbox").fill(name);
  await expect(cardFor(page, name)).not.toHaveCount(0);
}
async function persisted(name: string) {
  return (
    await (await client(owner)).query(api.loans.incoming, { pageNumber: 1, pageSize: 100, search: name })
  ).page.filter((loan) => loan.toolName === name);
}

test.beforeAll(async ({ browser }) => {
  test.setTimeout(180_000);
  owner = await signedInPage(browser, RACE_OWNER.email);
  a = await signedInPage(browser, RACE_A.email);
  b = await signedInPage(browser, RACE_B.email);
  ownerTab = await owner.context().newPage();
  duplicateTab = await a.context().newPage();
});
test.afterAll(async () => {
  for (const page of [owner, a, b]) await page?.context().close();
  cli("npx", ["convex", "run", "dev:purgeTestData", JSON.stringify({ names })]);
});

test("duplicate submissions across tabs create one request and show a useful refusal", async () => {
  await listTool(owner, names[0], "Garden");
  const first = await prepare(a, names[0]);
  const second = await prepare(duplicateTab, names[0]);
  await Promise.all([first.click(), second.click()]);
  await expect.poll(async () => (await persisted(names[0])).length).toBe(1);
  await expect
    .poll(
      async () =>
        (await cardFor(a, names[0])
          .getByRole("alert")
          .filter({ hasText: "You already have an open request for this tool." })
          .count()) +
        (await cardFor(duplicateTab, names[0])
          .getByRole("alert")
          .filter({ hasText: "You already have an open request for this tool." })
          .count()),
    )
    .toBe(1);
  await expect
    .poll(
      async () =>
        (await a.getByText("Request sent. The lender has been notified.").count()) +
        (await duplicateTab.getByText("Request sent. The lender has been notified.").count()),
    )
    .toBe(1);
});

test("two lender tabs cannot approve different borrowers for the same tool", async () => {
  await listTool(owner, names[1], "Garden");
  const first = await prepare(a, names[1]),
    second = await prepare(b, names[1]);
  await Promise.all([first.click(), second.click()]);
  await expect.poll(async () => (await persisted(names[1])).length).toBe(2);
  await incoming(owner, names[1]);
  await incoming(ownerTab, names[1]);
  const firstRow = cardFor(owner, names[1]).filter({ hasText: "requested by RaceA" });
  const secondRow = cardFor(ownerTab, names[1]).filter({ hasText: "requested by RaceB" });
  await Promise.all([
    firstRow.getByRole("button", { name: "Approve", exact: true }).click(),
    secondRow.getByRole("button", { name: "Approve", exact: true }).click(),
  ]);
  await expect.poll(async () => (await persisted(names[1])).filter((l) => l.status === "approved").length).toBe(1);
  await expect
    .poll(
      async () =>
        (await cardFor(owner, names[1])
          .getByRole("alert")
          .filter({ hasText: "The tool is already lent out. Mark it returned first." })
          .count()) +
        (await cardFor(ownerTab, names[1])
          .getByRole("alert")
          .filter({ hasText: "The tool is already lent out. Mark it returned first." })
          .count()),
    )
    .toBe(1);
  for (const page of [a, b]) {
    await page.goto("/requests");
    await page.getByRole("searchbox").fill(names[1]);
  }
  await expect
    .poll(async () => (await cardFor(a, names[1], "On loan").count()) + (await cardFor(b, names[1], "On loan").count()))
    .toBe(1);
});

test("a cancellation dialog opened before approval cannot cancel an active loan", async () => {
  await listTool(owner, names[2], "Garden");
  await (await prepare(a, names[2])).click();
  await expect.poll(async () => (await persisted(names[2])).length).toBe(1);
  await a.goto("/requests");
  await a.getByRole("searchbox").fill(names[2]);
  await cardFor(a, names[2]).getByRole("button", { name: "Cancel request" }).click();
  await incoming(owner, names[2]);
  await cardFor(owner, names[2]).getByRole("button", { name: "Approve", exact: true }).click();
  await expect.poll(async () => (await persisted(names[2]))[0].status).toBe("approved");
  const dialog = a.getByRole("alertdialog");
  await dialog.getByRole("button", { name: "Cancel request", exact: true }).click();
  await expect(dialog).toContainText("Only open requests can be cancelled.");
  await dialog.getByRole("button", { name: "Keep request" }).click();
  await expect(cardFor(a, names[2], "On loan")).toBeVisible();
});

test("listing removal clears a borrow form already open in another browser", async () => {
  await listTool(owner, names[3], "Garden");
  await prepare(b, names[3]);
  await owner.goto("/listings");
  await owner.getByRole("searchbox").fill(names[3]);
  await cardFor(owner, names[3]).getByRole("button", { name: "Delete", exact: true }).click();
  await owner.getByRole("alertdialog").getByRole("button", { name: "Delete listing" }).click();
  await expect(cardFor(b, names[3])).toHaveCount(0);
  expect(await persisted(names[3])).toHaveLength(0);
});
