import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { api } from "./_generated/api";
import { reminderKey } from "./automation";
import { todayUtc } from "./lib/dates";
import { sign } from "./lib/hmac";
import { backoffMs, MAX_ATTEMPTS } from "./webhooks";
import { isoDay, setup, signIn, type T } from "./test.setup";

const SECRET = "test-n8n-to-lendloop";

async function overdueLoan(t: T) {
  const ada = await signIn(t, "Ada");
  const bob = await signIn(t, "Bob Builder");
  const toolId = await ada.as.mutation(api.tools.create, {
    name: "Ladder",
    category: "hand_tools",
    condition: "fair",
    description: "",
  });
  const loanId = await bob.as.mutation(api.loans.request, {
    toolId,
    startDate: isoDay(0),
    endDate: isoDay(1),
  });
  await ada.as.mutation(api.loans.approve, { loanId });
  // Back-date the loan so it is overdue.
  await t.run((ctx) =>
    ctx.db.patch(loanId, { startDate: isoDay(-5), endDate: isoDay(-2) }),
  );
  return { ada, bob, loanId };
}

async function signedPost(t: T, path: string, body: unknown, secret = SECRET) {
  const raw = JSON.stringify(body);
  const { timestamp, signature } = await sign(secret, raw);
  return await t.fetch(path, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-lendloop-timestamp": timestamp,
      "x-lendloop-signature": signature,
    },
    body: raw,
  });
}

describe("n8n HTTP endpoints", () => {
  beforeEach(() => {
    process.env.N8N_TO_LENDLOOP_SECRET = SECRET;
  });

  test("reject unsigned, wrongly signed and stale requests", async () => {
    const t = setup();
    const unsigned = await t.fetch("/n8n/overdue-loans", {
      method: "POST",
      body: "{}",
    });
    expect(unsigned.status).toBe(401);
    const wrong = await signedPost(t, "/n8n/overdue-loans", {}, "not-the-secret");
    expect(wrong.status).toBe(401);
    const raw = "{}";
    const old = await sign(SECRET, raw, Date.now() - 10 * 60 * 1000);
    const stale = await t.fetch("/n8n/overdue-loans", {
      method: "POST",
      headers: {
        "x-lendloop-timestamp": old.timestamp,
        "x-lendloop-signature": old.signature,
      },
      body: raw,
    });
    expect(stale.status).toBe(401);
  });

  test("overdue endpoint returns minimal fields", async () => {
    const t = setup();
    const { loanId } = await overdueLoan(t);
    const res = await signedPost(t, "/n8n/overdue-loans", { request: "overdue-loans" });
    expect(res.status).toBe(200);
    const { loans } = await res.json();
    expect(loans).toEqual([
      {
        loanId,
        idempotencyKey: reminderKey(loanId, todayUtc()),
        toolName: "Ladder",
        endDate: isoDay(-2),
        daysOverdue: 2,
        borrower: { email: "bob.builder@example.com", firstName: "Bob" },
      },
    ]);
  });

  test("reminder write-back is idempotent and hides reminded loans", async () => {
    const t = setup();
    const { loanId, bob } = await overdueLoan(t);
    const event = {
      idempotencyKey: reminderKey(loanId, todayUtc()),
      loanId,
      kind: "overdue_reminder",
      status: "sent",
    };
    const first = await signedPost(t, "/n8n/automation-events", event);
    const second = await signedPost(t, "/n8n/automation-events", event);
    expect(await first.json()).toEqual({ ok: true, duplicate: false });
    expect(await second.json()).toEqual({ ok: true, duplicate: true });
    const rows = await t.run((ctx) => ctx.db.query("automationEvents").collect());
    expect(rows).toHaveLength(1);

    // A second run of the daily workflow gets nothing to send.
    const rerun = await signedPost(t, "/n8n/overdue-loans", {});
    expect((await rerun.json()).loans).toEqual([]);

    // The borrower sees the activity on the loan.
    const [mine] = await bob.as.query(api.loans.myRequests, {});
    expect(mine.overdue).toBe(true);
    expect(mine.activity[0]).toMatchObject({ kind: "overdue_reminder", status: "sent" });
  });

  test("a failed reminder is upgraded when a retry succeeds", async () => {
    const t = setup();
    const { loanId } = await overdueLoan(t);
    const key = reminderKey(loanId, todayUtc());
    await signedPost(t, "/n8n/automation-events", {
      idempotencyKey: key, loanId, kind: "overdue_reminder", status: "failed",
    });
    await signedPost(t, "/n8n/automation-events", {
      idempotencyKey: key, loanId, kind: "overdue_reminder", status: "sent",
    });
    const rows = await t.run((ctx) => ctx.db.query("automationEvents").collect());
    expect(rows.map((r) => r.status)).toEqual(["sent"]);
  });

  test("rejects malformed events and unknown loans", async () => {
    const t = setup();
    const bad = await signedPost(t, "/n8n/automation-events", { kind: "drop_tables" });
    expect(bad.status).toBe(400);
    const unknown = await signedPost(t, "/n8n/automation-events", {
      idempotencyKey: "overdue:nope:2026-01-01",
      loanId: "nope",
      kind: "overdue_reminder",
      status: "sent",
    });
    expect(unknown.status).toBe(422);
  });
});

describe("webhook delivery", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    process.env.N8N_WEBHOOK_URL = "http://n8n.test/webhook/lendloop";
    process.env.LENDLOOP_TO_N8N_SECRET = "test-lendloop-to-n8n";
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  async function oneRequest(t: T) {
    const ada = await signIn(t, "Ada Lovelace");
    const bob = await signIn(t, "Bob");
    const toolId = await ada.as.mutation(api.tools.create, {
      name: "Tent",
      category: "camping",
      condition: "good",
      description: "Sleeps four. Secret campsite inside.",
    });
    await bob.as.mutation(api.loans.request, {
      toolId,
      startDate: isoDay(1),
      endDate: isoDay(2),
    });
  }

  test("signs a minimal payload addressed to the lender", async () => {
    const calls: { headers: Headers; body: string }[] = [];
    vi.stubGlobal("fetch", async (_url: string, init: RequestInit) => {
      calls.push({ headers: new Headers(init.headers), body: String(init.body) });
      return new Response("ok", { status: 200 });
    });
    const t = setup();
    await oneRequest(t);
    await t.finishAllScheduledFunctions(vi.runAllTimers);

    expect(calls).toHaveLength(1);
    const body = JSON.parse(calls[0].body);
    expect(body.event).toBe("loan.requested");
    expect(body.recipient).toEqual({
      role: "lender",
      email: "ada.lovelace@example.com",
      firstName: "Ada",
    });
    expect(body.otherParty).toEqual({ firstName: "Bob" });
    expect(calls[0].body).not.toContain("Secret campsite"); // no description
    expect(calls[0].body).not.toContain("bob@example.com"); // no other email
    const expected = await sign(
      "test-lendloop-to-n8n",
      calls[0].body,
      Number(calls[0].headers.get("x-lendloop-timestamp")),
    );
    expect(calls[0].headers.get("x-lendloop-signature")).toBe(expected.signature);
    const [delivery] = await t.run((ctx) => ctx.db.query("webhookDeliveries").collect());
    expect(delivery.status).toBe("delivered");
  });

  test("retries transient failures with backoff, then marks failed", async () => {
    let attempts = 0;
    vi.stubGlobal("fetch", async () => {
      attempts++;
      return new Response("busy", { status: 503 });
    });
    const t = setup();
    await oneRequest(t);
    await t.finishAllScheduledFunctions(vi.runAllTimers);
    expect(attempts).toBe(MAX_ATTEMPTS);
    const [delivery] = await t.run((ctx) => ctx.db.query("webhookDeliveries").collect());
    expect(delivery).toMatchObject({ status: "failed", attempts: MAX_ATTEMPTS });
    expect(delivery.lastError).toContain("503");
    expect(backoffMs(1)).toBe(30_000);
    expect(backoffMs(4)).toBe(1_920_000);
  });

  test("does not retry a rejected signature (4xx)", async () => {
    let attempts = 0;
    vi.stubGlobal("fetch", async () => {
      attempts++;
      return new Response("unauthorized", { status: 401 });
    });
    const t = setup();
    await oneRequest(t);
    await t.finishAllScheduledFunctions(vi.runAllTimers);
    expect(attempts).toBe(1);
    const [delivery] = await t.run((ctx) => ctx.db.query("webhookDeliveries").collect());
    expect(delivery.status).toBe("failed");
  });

  test("admin can retry a failed delivery", async () => {
    let status = 401;
    vi.stubGlobal("fetch", async () => new Response("", { status }));
    const t = setup();
    const admin = await signIn(t, "Root", { role: "admin" });
    await oneRequest(t);
    await t.finishAllScheduledFunctions(vi.runAllTimers);
    const { deliveries } = await admin.as.query(api.admin.automationHealth, {});
    expect(deliveries[0].status).toBe("failed");
    status = 200;
    await admin.as.mutation(api.admin.retryDelivery, { deliveryId: deliveries[0]._id });
    await t.finishAllScheduledFunctions(vi.runAllTimers);
    const [delivery] = await t.run((ctx) => ctx.db.query("webhookDeliveries").collect());
    expect(delivery.status).toBe("delivered");
  });

  test("missing configuration fails visibly instead of silently", async () => {
    delete process.env.N8N_WEBHOOK_URL;
    const t = setup();
    await oneRequest(t);
    await t.finishAllScheduledFunctions(vi.runAllTimers);
    const [delivery] = await t.run((ctx) => ctx.db.query("webhookDeliveries").collect());
    expect(delivery.status).toBe("failed");
    expect(delivery.lastError).toMatch(/N8N_WEBHOOK_URL/);
  });
});
