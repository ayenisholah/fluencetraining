import AxeBuilder from "@axe-core/playwright";
import { execFileSync } from "node:child_process";
import { clerk } from "@clerk/testing/playwright";
import { expect, type Browser, type Page } from "@playwright/test";

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

/** A fresh browser context signed in as `email`, parked on /tools. */
export async function signedInPage(browser: Browser, email: string): Promise<Page> {
  const context = await browser.newContext();
  const page = await context.newPage();
  await page.goto("/");
  await clerk.signIn({ page, emailAddress: email });
  await page.goto("/tools");
  await acceptEssentialOnly(page);
  await expect(page.getByRole("heading", { level: 1, name: "All tools" })).toBeVisible();
  return page;
}

/** Cards (list items) headed by `name`, optionally narrowed to one showing a status badge. */
export function cardFor(page: Page, name: string, status?: string) {
  const cards = page.getByRole("listitem").filter({ has: page.getByRole("heading", { name }) });
  return status ? cards.filter({ has: page.getByText(status, { exact: true }) }) : cards;
}

/** Opens the borrow form for `name` on /tools, picks today+1 → today+2 and sends it. */
export async function requestToBorrow(page: Page, name: string) {
  await page.goto("/tools");
  await page.getByRole("searchbox", { name: "Search tools", exact: true }).fill(name);
  const card = cardFor(page, name);
  await card.getByRole("button", { name: "Request to borrow" }).click();
  await card.getByRole("button", { name: /^From/ }).click();
  await page.keyboard.press("ArrowRight");
  await page.keyboard.press("Enter");
  await card.getByRole("button", { name: /^Until/ }).click();
  await page.keyboard.press("ArrowRight");
  await page.keyboard.press("Enter");
  await card.getByRole("button", { name: "Send request" }).click();
  return card;
}

/** Lists a tool from /listings and waits for it to appear. */
export async function listTool(page: Page, name: string, category: string) {
  await page.goto("/listings");
  const form = page.getByRole("region", { name: "List a tool" });
  await form.getByLabel("Name").fill(name);
  await form.getByRole("combobox", { name: /Category/ }).click();
  await page.getByRole("option", { name: category }).click();
  await form.getByRole("button", { name: "List it" }).click();
  await expect(page.getByRole("heading", { name })).toBeVisible();
}

/** Runs a CLI command against the local stack (Convex CLI, docker compose). */
export function cli(command: string, args: string[], timeout = 120_000): string {
  return execFileSync(command, args, {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
    timeout,
    // The stack runs on the native engine; Docker Desktop's context may be down.
    env: { ...process.env, DOCKER_CONTEXT: process.env.DOCKER_CONTEXT ?? "default" },
  });
}

/** Promotes a user server-side, the only way a role can change. Idempotent. */
export function promoteToAdmin(email: string) {
  cli("npx", ["convex", "run", "users:setRole", JSON.stringify({ email, role: "admin" })]);
}

/** Hard-deletes this run's test tool (and its loans and activity) so runs leave no trace. */
export function purgeTestTool(name: string, errorMarkers: string[] = []) {
  cli("npx", ["convex", "run", "dev:purgeTestData", JSON.stringify({ names: [name], errorMarkers })]);
}

/**
 * Records Content-Security-Policy violations on a page: the browser's
 * securitypolicyviolation events plus CSP console errors. Call before the
 * first navigation, then `expect(await read()).toEqual([])`.
 */
export async function watchCsp(page: Page) {
  const consoleErrors: string[] = [];
  page.on("console", (msg) => {
    if (/Content Security Policy|Refused to (load|execute|connect|apply|frame)/i.test(msg.text())) consoleErrors.push(msg.text());
  });
  await page.addInitScript(() => {
    const w = window as unknown as { __csp?: string[] };
    w.__csp = [];
    document.addEventListener("securitypolicyviolation", (e) => {
      w.__csp!.push(`${e.violatedDirective} blocked ${e.blockedURI || "inline"} (${e.sourceFile ?? ""}:${e.lineNumber})`);
    });
  });
  return async () => [
    ...consoleErrors,
    ...((await page.evaluate(() => (window as unknown as { __csp?: string[] }).__csp ?? []).catch(() => [])) as string[]),
  ];
}
