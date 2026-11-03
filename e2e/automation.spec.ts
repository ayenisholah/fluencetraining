import { createHmac } from "node:crypto";
import { expect, test, type APIRequestContext, type Page } from "@playwright/test";
import { cardFor, cli, listTool, promoteToAdmin, purgeTestTool, requestToBorrow, signedInPage } from "./helpers";
import { ADMIN, OWNER, RENTER } from "./users";

// n8n automation end to end against the local stack: Convex → n8n webhook →
// Mailpit, and the daily reminder n8n → Convex → Mailpit → Convex. Needs
// docker compose (Convex, n8n with the workflows imported, Mailpit).
test.describe.configure({ mode: "serial" });

try {
  process.loadEnvFile(".env"); // shared HMAC secrets, same values n8n and Convex use
} catch {
  // CI provides them in the environment
}
const TO_N8N = process.env.LENDLOOP_TO_N8N_SECRET!;
const TO_CONVEX = process.env.N8N_TO_LENDLOOP_SECRET!;
const N8N_WEBHOOK = "http://127.0.0.1:5678/webhook/lendloop-loan-events";
const CONVEX_SITE = process.env.NEXT_PUBLIC_CONVEX_SITE_URL ?? "http://127.0.0.1:3211";
const MAILPIT = "http://127.0.0.1:8025/api/v1";

const run = Date.now().toString(36);
const toolName = `E2E automation tent ${run}`;
const outageToolName = `E2E automation outage ${run}`;
let owner: Page;
let renter: Page;
let admin: Page;
let loanId: string;

// ---- helpers ---------------------------------------------------------------

function signed(secret: string, body: string, timestamp = Date.now()) {
  const ts = String(timestamp);
  return {
    "content-type": "application/json",
    "x-lendloop-timestamp": ts,
    "x-lendloop-signature": `sha256=${createHmac("sha256", secret).update(`${ts}.${body}`).digest("hex")}`,
  };
}

type Mail = { ID: string; Subject: string; To: { Address: string }[]; Created: string };

async function searchMail(request: APIRequestContext, query: string): Promise<Mail[]> {
  const res = await request.get(`${MAILPIT}/search`, { params: { query, limit: "50" } });
  expect(res.ok()).toBe(true);
  return (await res.json()).messages ?? [];
}

async function mailText(request: APIRequestContext, id: string): Promise<string> {
  return (await (await request.get(`${MAILPIT}/message/${id}`)).json()).Text;
}

/** Waits for exactly one email matching `query` and returns it with its body. */
async function onlyMail(request: APIRequestContext, query: string) {
  await expect.poll(async () => (await searchMail(request, query)).length, { timeout: 30_000, message: query }).toBe(1);
  const [mail] = await searchMail(request, query);
  return { ...mail, text: await mailText(request, mail.ID) };
}

function convexRows<T>(table: string): T[] {
  return JSON.parse(cli("npx", ["convex", "data", table, "--limit", "10000", "--format", "jsonArray"]));
}

function runReminderWorkflow() {
  // The running n8n holds the task broker port, so the one-off CLI run uses another.
  const out = cli("docker", [
    "compose", "exec", "-T", "-e", "N8N_RUNNERS_BROKER_PORT=5699", "n8n", "n8n", "execute", "--id", "LendLoopRemindWf",
  ], 180_000);
  expect(out).toContain('"status": "success"');
}

const loanCard = (page: Page, status?: string) => cardFor(page, toolName, status);

// ---- set-up ----------------------------------------------------------------

test.beforeAll(async ({ browser }) => {
  test.setTimeout(150_000);
  expect(TO_N8N, "LENDLOOP_TO_N8N_SECRET (from .env)").toBeTruthy();
  expect(TO_CONVEX, "N8N_TO_LENDLOOP_SECRET (from .env)").toBeTruthy();
  owner = await signedInPage(browser, OWNER.email);
  renter = await signedInPage(browser, RENTER.email);
  admin = await signedInPage(browser, ADMIN.email);
  promoteToAdmin(ADMIN.email);
});

test.afterAll(async () => {
  for (const page of [owner, renter, admin]) await page?.context().close();
  purgeTestTool(outageToolName);
  purgeTestTool(toolName, [`e2e-broken-${run}`, `e2e-dup-${run}`]);
});

// ---- request notifications ---------------------------------------------------

test("a new request emails the lender with only what they need", async ({ request }) => {
  await listTool(owner, toolName, "Camping");
  await expect((await requestToBorrow(renter, toolName)).getByText(/Request sent/)).toBeVisible();

  const mail = await onlyMail(request, `subject:"${RENTER.firstName} wants to borrow your ${toolName}"`);
  expect(mail.To.map((t) => t.Address)).toEqual([OWNER.email]);
  expect(mail.text).toContain(`Hi ${OWNER.firstName},`);
  expect(mail.text).toContain("/incoming");
  // The other party appears by first name only.
  expect(mail.text).not.toContain(RENTER.email);
  expect(mail.text).not.toContain(RENTER.lastName);

  const tools = convexRows<{ _id: string; name: string }>("tools");
  const toolId = tools.find((t) => t.name === toolName)!._id;
  loanId = convexRows<{ _id: string; toolId: string }>("loans").find((l) => l.toolId === toolId)!._id;
  expect(loanId).toBeTruthy();
  await expect.poll(() => convexRows<{ loanId?: string; kind: string; status: string }>("automationEvents")
    .filter((e) => e.loanId === loanId && e.kind === "request_notification" && e.status === "sent").length,
    { timeout: 30_000 }).toBe(1);
});

test("a status change emails the borrower, and both sides see the activity", async ({ request }) => {
  await owner.goto("/incoming");
  await loanCard(owner, "Requested").getByRole("button", { name: "Approve" }).click();
  await expect(loanCard(owner, "On loan")).toHaveCount(1);

  const mail = await onlyMail(request, `subject:"${OWNER.firstName} said yes: ${toolName}"`);
  expect(mail.To.map((t) => t.Address)).toEqual([RENTER.email]);
  expect(mail.text).not.toContain(OWNER.email);

  await expect(loanCard(owner).getByText(/Notification sent/)).toBeVisible({ timeout: 20_000 });
  await renter.goto("/requests");
  await expect(loanCard(renter).getByText(/Notification sent/)).toBeVisible({ timeout: 20_000 });
});

// ---- signatures, both directions ---------------------------------------------

test("n8n's webhook refuses unsigned, wrongly signed and replayed calls", async ({ request }) => {
  const body = JSON.stringify({ deliveryId: `e2e-forged-${run}`, event: "loan.approved" });
  const cases: [string, Record<string, string>][] = [
    ["unsigned", { "content-type": "application/json" }],
    ["wrong secret", signed("not-the-secret", body)],
    ["stale (replayed)", signed(TO_N8N, body, Date.now() - 10 * 60 * 1000)],
    ["non-numeric timestamp", { ...signed(TO_N8N, body), "x-lendloop-timestamp": "soon" }],
  ];
  for (const [name, headers] of cases) {
    const res = await request.post(N8N_WEBHOOK, { headers, data: body });
    expect(res.status(), name).toBe(401);
  }
});

test("Convex's endpoints refuse unsigned, wrongly signed and replayed calls", async ({ request }) => {
  const body = JSON.stringify({ request: "overdue-loans" });
  for (const path of ["/n8n/overdue-loans", "/n8n/automation-events"]) {
    for (const [name, headers] of [
      ["unsigned", { "content-type": "application/json" }],
      ["wrong secret", signed("not-the-secret", body)],
      ["stale (replayed)", signed(TO_CONVEX, body, Date.now() - 10 * 60 * 1000)],
    ] as const) {
      const res = await request.post(`${CONVEX_SITE}${path}`, { headers, data: body });
      expect(res.status(), `${path} ${name}`).toBe(401);
      expect(await res.text()).not.toContain("loans");
    }
  }
  const ok = await request.post(`${CONVEX_SITE}/n8n/overdue-loans`, { headers: signed(TO_CONVEX, body), data: body });
  expect(ok.status()).toBe(200);
});

// ---- overdue reminders ---------------------------------------------------------

test("the daily workflow reminds an overdue borrower and writes the status back", async ({ request }) => {
  test.setTimeout(90_000); // runs a real n8n execution via the CLI
  cli("npx", ["convex", "run", "dev:backdateLoan", JSON.stringify({ loanId, daysOverdue: 2 })]);
  runReminderWorkflow();

  const mail = await onlyMail(request, `subject:"Reminder: please return ${toolName}"`);
  expect(mail.To.map((t) => t.Address)).toEqual([RENTER.email]);
  expect(mail.text).toContain(`Hi ${RENTER.firstName},`);
  expect(mail.text).toMatch(/2 days ago/);

  // Write-back reached Convex: the loan's activity says so on both sides.
  await renter.goto("/requests");
  await expect(loanCard(renter, "Overdue")).toHaveCount(1);
  await expect(loanCard(renter).getByText(/Reminder sent/)).toBeVisible();
  await owner.goto("/incoming");
  await expect(loanCard(owner, "Overdue").getByText(/Reminder sent/)).toBeVisible();

  const events = convexRows<{ idempotencyKey: string; kind: string; status: string; loanId?: string }>("automationEvents")
    .filter((e) => e.loanId === loanId && e.kind === "overdue_reminder");
  expect(events.map((e) => e.status)).toEqual(["sent"]);
  expect(events[0].idempotencyKey).toMatch(new RegExp(`^overdue:${loanId}:\\d{4}-\\d{2}-\\d{2}$`));
});

test("re-running the reminder workflow the same day sends nothing new", async ({ request }) => {
  test.setTimeout(90_000); // runs a real n8n execution via the CLI
  runReminderWorkflow();
  // Give a duplicate time to arrive if there were going to be one.
  await new Promise((r) => setTimeout(r, 3_000));
  expect(await searchMail(request, `subject:"Reminder: please return ${toolName}"`)).toHaveLength(1);
  const events = convexRows<{ kind: string; loanId?: string }>("automationEvents")
    .filter((e) => e.loanId === loanId && e.kind === "overdue_reminder");
  expect(events).toHaveLength(1);
});

// ---- idempotency of request notifications ---------------------------------------

test("a redelivered webhook is acknowledged but not emailed twice", async ({ request }) => {
  const recipient = `e2e-dup-${run}@lendloop.local`;
  const deliveryId = `e2e-dup-${run}`;
  const body = JSON.stringify({
    deliveryId,
    event: "loan.approved",
    occurredAt: new Date().toISOString(),
    loan: { id: loanId, status: "approved", startDate: "2026-11-04", endDate: "2026-11-06" },
    tool: { name: toolName },
    recipient: { role: "borrower", email: recipient, firstName: "Dup" },
    otherParty: { firstName: OWNER.firstName },
  });
  const writeBacks = () =>
    convexRows<{ idempotencyKey: string }>("automationEvents").filter((e) => e.idempotencyKey === `notify:${deliveryId}`).length;

  const first = await request.post(N8N_WEBHOOK, { headers: signed(TO_N8N, body), data: body });
  expect(first.status()).toBe(200);
  expect(await first.json()).toEqual({ ok: true });
  await onlyMail(request, `to:"${recipient}"`);
  // Convex retries only after a backoff of 30 s or more, by which time the first
  // run has finished (its last step is this write-back) and n8n has saved the
  // delivery id. Wait for that instead of sleeping 30 s.
  // NOTE: n8n saves workflow static data only when a run ends, so a redelivery
  // arriving *during* the first run is not recognised (see the audit notes).
  await expect.poll(writeBacks, { timeout: 30_000 }).toBe(1);

  // Same delivery again, freshly signed, as a Convex retry would be.
  const again = await request.post(N8N_WEBHOOK, { headers: signed(TO_N8N, body), data: body });
  expect(again.status()).toBe(200);
  expect(await again.json()).toEqual({ ok: true, duplicate: true });
  await new Promise((r) => setTimeout(r, 2_000));
  expect(await searchMail(request, `to:"${recipient}"`)).toHaveLength(1);
  expect(writeBacks()).toBe(1);
});

// ---- failures are visible ---------------------------------------------------------

test("a failing run triggers the error workflow: ops are emailed and Admin shows it", async ({ request }) => {
  const marker = `loan.e2e-broken-${run}`;
  const body = JSON.stringify({
    deliveryId: `e2e-broken-${run}`,
    event: marker,
    loan: { id: loanId, status: "approved", startDate: "2026-11-04", endDate: "2026-11-06" },
    tool: { name: toolName },
    recipient: { role: "borrower", email: `e2e-broken-${run}@lendloop.local`, firstName: "Broken" },
    otherParty: { firstName: OWNER.firstName },
  });
  const res = await request.post(N8N_WEBHOOK, { headers: signed(TO_N8N, body), data: body });
  // n8n doesn't acknowledge a failed run, so Convex would retry it.
  expect(res.status()).toBeGreaterThanOrEqual(500);

  await expect
    .poll(async () => {
      for (const mail of await searchMail(request, `subject:"[LendLoop] Automation failed"`)) {
        if ((await mailText(request, mail.ID)).includes(marker)) return true;
      }
      return false;
    }, { timeout: 45_000, message: "ops alert email" })
    .toBe(true);

  await admin.goto("/admin");
  const health = admin.locator("section").filter({ has: admin.getByRole("heading", { name: "Automation health", exact: true }) });
  await expect(health.getByText(new RegExp(`Unknown event type: ${marker.replace(/[.]/g, "\\.")}`))).toBeVisible({ timeout: 20_000 });
  await expect(health.getByText("n8n error").first()).toBeVisible();
});

test("SMTP outage is visible and the queued request recovers automatically", async ({ request }) => {
  test.skip(process.env.LENDLOOP_TEST_SMTP_OUTAGE !== "1", "Run npm run test:automation for the local outage drill");
  test.setTimeout(240_000);
  // Never stop a service while pointing the test app at a remote deployment.
  for (const url of [process.env.E2E_BASE_URL ?? "http://localhost:3000", process.env.NEXT_PUBLIC_CONVEX_URL!, CONVEX_SITE]) {
    expect(["localhost", "127.0.0.1", "[::1]"]).toContain(new URL(url).hostname);
  }
  const endpoint = cli("docker", ["context", "inspect", process.env.DOCKER_CONTEXT ?? "default", "--format", "{{.Endpoints.docker.Host}}"]);
  expect(endpoint.trim()).toMatch(/^unix:\/\//);
  expect((await request.get(`${MAILPIT}/messages`)).ok()).toBe(true);
  await listTool(owner, outageToolName, "Camping");
  type Delivery = { _id: string; loanId: string; status: string; attempts: number; lastError?: string };
  const toolId = convexRows<{ _id: string; name: string }>("tools").find((t) => t.name === outageToolName)!._id;
  let outageLoanId: string | undefined;
  const delivery = () => convexRows<Delivery>("webhookDeliveries").find((d) => d.loanId === outageLoanId);
  const startedAt = Date.now();
  try {
    cli("docker", ["compose", "stop", "mailpit"]);
    await expect((await requestToBorrow(renter, outageToolName)).getByText(/Request sent/)).toBeVisible();
    outageLoanId = convexRows<{ _id: string; toolId: string }>("loans").find((l) => l.toolId === toolId)!._id;
    await expect.poll(() => delivery()?.attempts ?? 0, { timeout: 45_000 }).toBeGreaterThan(0);
    expect(delivery()?.status).toBe("pending");
    expect(delivery()?.lastError).toBeTruthy();
    // Ops email also fails while SMTP is down, but the error must still reach Convex.
    await expect.poll(() => convexRows<{ kind: string; at: number; detail?: string }>("automationEvents")
      .some((e) => e.kind === "workflow_error" && e.at >= startedAt && e.detail?.includes("Send notification")),
      { timeout: 60_000 }).toBe(true);
  } finally {
    cli("docker", ["compose", "start", "mailpit"]);
  }
  await expect.poll(async () => {
    try { return (await request.get(`${MAILPIT}/messages`)).ok(); } catch { return false; }
  }, { timeout: 30_000 }).toBe(true);
  await expect.poll(() => delivery()?.status, { timeout: 160_000 }).toBe("delivered");
  expect(delivery()!.attempts).toBeGreaterThan(1);
  const mail = await onlyMail(request, `subject:"${RENTER.firstName} wants to borrow your ${outageToolName}"`);
  expect(mail.To.map((t) => t.Address)).toEqual([OWNER.email]);
  await expect.poll(() => convexRows<{ idempotencyKey: string; status: string }>("automationEvents")
    .filter((e) => e.idempotencyKey === `notify:${delivery()!._id}` && e.status === "sent").length,
    { timeout: 30_000 }).toBe(1);
});

test("clean up: the lender marks the loan returned", async () => {
  await owner.goto("/incoming");
  await loanCard(owner, "Overdue").getByRole("button", { name: "Mark returned" }).click();
  await expect(loanCard(owner, "Returned")).toHaveCount(1);
});
