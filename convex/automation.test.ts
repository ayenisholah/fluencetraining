import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { api } from "./_generated/api";
import { reminderKey } from "./automation";
import { todayUtc } from "./lib/dates";
import { sign } from "./lib/hmac";
import { backoffMs, MAX_ATTEMPTS } from "./webhooks";
import { isoDay, setup, signIn, type T, ALL } from "./test.setup";

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
  await t.run((ctx) => ctx.db.patch(loanId, { startDate: isoDay(-5), endDate: isoDay(-2) }));
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
        lender: { firstName: "Ada" },
        email: {
          subject: "Reminder: please return Ladder",
          html: expect.stringContaining("Overdue: please return"),
          text: expect.stringContaining("Hi Bob,"),
        },
      },
    ]);
    // The rendered reminder adds no personal data beyond the row's own fields.
    expect(JSON.stringify(loans[0].email)).not.toMatch(/@/);
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
    const [mine] = (await bob.as.query(api.loans.myRequests, { ...ALL })).page;
    expect(mine.overdue).toBe(true);
    expect(mine.activity[0]).toMatchObject({ kind: "overdue_reminder", status: "sent" });
  });

  test("a failed reminder is upgraded when a retry succeeds", async () => {
    const t = setup();
    const { loanId } = await overdueLoan(t);
    const key = reminderKey(loanId, todayUtc());
    await signedPost(t, "/n8n/automation-events", {
      idempotencyKey: key,
      loanId,
      kind: "overdue_reminder",
      status: "failed",
    });
    await signedPost(t, "/n8n/automation-events", {
      idempotencyKey: key,
      loanId,
      kind: "overdue_reminder",
      status: "sent",
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

describe("every loan event notifies the right person with only what's needed", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    process.env.N8N_WEBHOOK_URL = "http://n8n.test/webhook/lendloop";
    process.env.LENDLOOP_TO_N8N_SECRET = "test-lendloop-to-n8n";
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  test("requested/cancelled → lender; approved/declined/returned → borrower", async () => {
    type Body = {
      event: string;
      loan: Record<string, unknown>;
      tool: Record<string, unknown>;
      recipient: { role: string; email: string; firstName?: string };
      otherParty: { firstName: string };
      email: { subject: string; html: string; text: string };
    };
    const bodies: Body[] = [];
    vi.stubGlobal("fetch", async (_url: string, init: RequestInit) => {
      bodies.push(JSON.parse(String(init.body)));
      return new Response("ok");
    });
    const t = setup();
    const ada = await signIn(t, "Ada Lovelace");
    const bob = await signIn(t, "Bob Builder");
    const toolId = await ada.as.mutation(api.tools.create, {
      name: "Tent",
      category: "camping",
      condition: "good",
      description: "Secret campsite inside.",
    });
    const req = (from: number, to: number) =>
      bob.as.mutation(api.loans.request, { toolId, startDate: isoDay(from), endDate: isoDay(to) });
    const a = await req(1, 2);
    await bob.as.mutation(api.loans.cancel, { loanId: a });
    const b = await req(1, 2);
    await ada.as.mutation(api.loans.decline, { loanId: b });
    const c = await req(1, 2);
    await ada.as.mutation(api.loans.approve, { loanId: c });
    await ada.as.mutation(api.loans.markReturned, { loanId: c });
    await t.finishAllScheduledFunctions(vi.runAllTimers);

    const sent = bodies.map((body) => [
      body.event,
      body.recipient.role,
      body.recipient.email,
      body.otherParty.firstName,
    ]);
    expect(sent.sort()).toEqual([
      ["loan.approved", "borrower", "bob.builder@example.com", "Ada"],
      ["loan.cancelled", "lender", "ada.lovelace@example.com", "Bob"],
      ["loan.declined", "borrower", "bob.builder@example.com", "Ada"],
      ["loan.requested", "lender", "ada.lovelace@example.com", "Bob"],
      ["loan.requested", "lender", "ada.lovelace@example.com", "Bob"],
      ["loan.requested", "lender", "ada.lovelace@example.com", "Bob"],
      ["loan.returned", "borrower", "bob.builder@example.com", "Ada"],
    ]);
    for (const body of bodies) {
      // Exactly these fields, nothing else (no ids of people, no descriptions, no second email).
      expect(Object.keys(body).sort()).toEqual([
        "deliveryId",
        "email",
        "event",
        "loan",
        "occurredAt",
        "otherParty",
        "recipient",
        "tool",
      ]);
      expect(Object.keys(body.loan).sort()).toEqual(["endDate", "id", "startDate", "status"]);
      expect(Object.keys(body.tool).sort()).toEqual(["category", "name"]);
      // The rendered email (subject, html, text) is a view of these fields: no addresses in it.
      expect(Object.keys(body.email).sort()).toEqual(["html", "subject", "text"]);
      expect(JSON.stringify(body.email)).not.toMatch(/@/);
      expect(body.email.html).toContain(`Hi ${body.recipient.firstName ?? ""}`.trim());
      expect(Object.keys(body.recipient).sort()).toEqual(["email", "firstName", "role"]);
      expect(Object.keys(body.otherParty)).toEqual(["firstName"]);
      expect(JSON.stringify(body).match(/@/g)).toHaveLength(1);
      expect(JSON.stringify(body)).not.toContain("Secret campsite");
    }
    const deliveries = await t.run((ctx) => ctx.db.query("webhookDeliveries").collect());
    expect(deliveries.every((d) => d.status === "delivered")).toBe(true);
  });

  test("a recipient without an email fails the delivery visibly, without calling n8n", async () => {
    const fetchSpy = vi.fn(async () => new Response("ok"));
    vi.stubGlobal("fetch", fetchSpy);
    const t = setup();
    const ada = await signIn(t, "Ada");
    const bob = await signIn(t, "Bob");
    await t.run((ctx) => ctx.db.patch(ada.id, { email: undefined }));
    const toolId = await ada.as.mutation(api.tools.create, {
      name: "Saw",
      category: "hand_tools",
      condition: "good",
      description: "",
    });
    await bob.as.mutation(api.loans.request, { toolId, startDate: isoDay(1), endDate: isoDay(2) });
    await t.finishAllScheduledFunctions(vi.runAllTimers);
    expect(fetchSpy).not.toHaveBeenCalled();
    const [delivery] = await t.run((ctx) => ctx.db.query("webhookDeliveries").collect());
    expect(delivery).toMatchObject({ status: "failed", lastError: "Recipient has no email address on file." });
  });
});

describe("overdue endpoint selection and the signature window", () => {
  beforeEach(() => {
    process.env.N8N_TO_LENDLOOP_SECRET = SECRET;
  });

  test("only approved loans past their end date; reminded-today ones are skipped, failed ones retried", async () => {
    const t = setup();
    const { loanId, ada, bob } = await overdueLoan(t);
    // Not yet due: approved, ends today.
    const dueToday = await ada.as.mutation(api.tools.create, {
      name: "Drill",
      category: "power_tools",
      condition: "good",
      description: "",
    });
    const onTime = await bob.as.mutation(api.loans.request, {
      toolId: dueToday,
      startDate: isoDay(0),
      endDate: isoDay(0),
    });
    await ada.as.mutation(api.loans.approve, { loanId: onTime });
    // Overdue dates but returned already.
    const done = await ada.as.mutation(api.tools.create, {
      name: "Rake",
      category: "garden",
      condition: "good",
      description: "",
    });
    const returned = await bob.as.mutation(api.loans.request, {
      toolId: done,
      startDate: isoDay(0),
      endDate: isoDay(1),
    });
    await ada.as.mutation(api.loans.approve, { loanId: returned });
    await ada.as.mutation(api.loans.markReturned, { loanId: returned });
    await t.run((ctx) => ctx.db.patch(returned, { startDate: isoDay(-9), endDate: isoDay(-8) }));
    // Overdue but still only requested (never approved).
    const asked = await ada.as.mutation(api.tools.create, {
      name: "Tent",
      category: "camping",
      condition: "good",
      description: "",
    });
    const pending = await bob.as.mutation(api.loans.request, {
      toolId: asked,
      startDate: isoDay(0),
      endDate: isoDay(1),
    });
    await t.run((ctx) => ctx.db.patch(pending, { startDate: isoDay(-9), endDate: isoDay(-8) }));

    const ids = async () =>
      (await (await signedPost(t, "/n8n/overdue-loans", {})).json()).loans.map((l: { loanId: string }) => l.loanId);
    expect(await ids()).toEqual([loanId]);

    const key = reminderKey(loanId, todayUtc());
    await signedPost(t, "/n8n/automation-events", {
      idempotencyKey: key,
      loanId,
      kind: "overdue_reminder",
      status: "failed",
    });
    expect(await ids()).toEqual([loanId]); // failed today → retried
    await signedPost(t, "/n8n/automation-events", {
      idempotencyKey: key,
      loanId,
      kind: "overdue_reminder",
      status: "sent",
    });
    expect(await ids()).toEqual([]); // sent today → skipped
    // A reminder from yesterday doesn't count for today.
    await t.run((ctx) => ctx.db.patch(loanId, { endDate: isoDay(-3) }));
    const yesterday = reminderKey(loanId, isoDay(-1));
    await t.run(async (ctx) => {
      const row = await ctx.db
        .query("automationEvents")
        .withIndex("by_key", (q) => q.eq("idempotencyKey", key))
        .unique();
      await ctx.db.patch(row!._id, { idempotencyKey: yesterday });
    });
    expect(await ids()).toEqual([loanId]);
  });

  test("timestamps within ±5 minutes are accepted; outside are rejected", async () => {
    const t = setup();
    const raw = "{}";
    const at = async (offsetMs: number) => {
      const s = await sign(SECRET, raw, Date.now() + offsetMs);
      return (
        await t.fetch("/n8n/overdue-loans", {
          method: "POST",
          headers: { "x-lendloop-timestamp": s.timestamp, "x-lendloop-signature": s.signature },
          body: raw,
        })
      ).status;
    };
    expect(await at(-4 * 60 * 1000)).toBe(200);
    expect(await at(4 * 60 * 1000)).toBe(200);
    expect(await at(-6 * 60 * 1000)).toBe(401);
    expect(await at(6 * 60 * 1000)).toBe(401);
  });

  test("an oversized declared body is refused before the signature is even checked", async () => {
    const t = setup();
    const res = await t.fetch("/n8n/automation-events", {
      method: "POST",
      headers: { "content-length": String(1024 * 1024) },
      body: "{}",
    });
    expect(res.status).toBe(413);
    // Size is measured in bytes: 6,000 three-byte characters is ~18 KB, over the 16 KB limit.
    expect((await signedPost(t, "/n8n/automation-events", { pad: "€".repeat(6_000) })).status).toBe(413);
  });

  test("oversized, non-object and non-JSON bodies are refused", async () => {
    const t = setup();
    expect((await signedPost(t, "/n8n/automation-events", { pad: "x".repeat(17 * 1024) })).status).toBe(413);
    expect((await signedPost(t, "/n8n/automation-events", ["array"])).status).toBe(400);
    const raw = "not json";
    const s = await sign(SECRET, raw);
    const res = await t.fetch("/n8n/automation-events", {
      method: "POST",
      headers: { "x-lendloop-timestamp": s.timestamp, "x-lendloop-signature": s.signature },
      body: raw,
    });
    expect(res.status).toBe(400);
  });

  test("no secret configured → 503, never an open endpoint", async () => {
    delete process.env.N8N_TO_LENDLOOP_SECRET;
    const t = setup();
    expect((await t.fetch("/n8n/overdue-loans", { method: "POST", body: "{}" })).status).toBe(503);
  });
});

describe("activity on each loan (bonus)", () => {
  beforeEach(() => {
    process.env.N8N_TO_LENDLOOP_SECRET = SECRET;
  });

  test("both parties see that loan's latest five events, newest first", async () => {
    const t = setup();
    const { loanId, ada, bob } = await overdueLoan(t);
    for (let i = 0; i < 7; i++) {
      await t.run((ctx) =>
        ctx.db.insert("automationEvents", {
          idempotencyKey: `overdue:${loanId}:day${i}`,
          loanId,
          kind: "overdue_reminder",
          status: i === 6 ? "failed" : "sent",
          at: 1_000 + i,
        }),
      );
    }
    // Another loan's event never shows here.
    await t.run((ctx) =>
      ctx.db.insert("automationEvents", {
        idempotencyKey: "other",
        kind: "workflow_error",
        status: "failed",
        at: 9_999,
      }),
    );
    const [lenderView] = (await ada.as.query(api.loans.incoming, { ...ALL })).page;
    const [borrowerView] = (await bob.as.query(api.loans.myRequests, { ...ALL })).page;
    for (const view of [lenderView, borrowerView]) {
      expect(view.activity).toHaveLength(5);
      expect(view.activity[0]).toEqual({ kind: "overdue_reminder", status: "failed", at: 1_006 });
      expect(view.activity.map((a) => a.at)).toEqual([1_006, 1_005, 1_004, 1_003, 1_002]);
    }
  });
});
