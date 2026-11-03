import { afterEach, beforeEach, describe, expect, test } from "vitest";
import { api } from "./_generated/api";
import { reminderKey } from "./automation";
import { todayUtc } from "./lib/dates";
import { sign } from "./lib/hmac";
import { isoDay, setup, signIn, type T } from "./test.setup";

const OPS = "ops-test-secret";
const N8N = "n8n-test-secret";

beforeEach(() => {
  process.env.OPS_METRICS_SECRET = OPS;
  process.env.N8N_TO_LENDLOOP_SECRET = N8N;
});
afterEach(() => {
  delete process.env.OPS_METRICS_SECRET;
  delete process.env.N8N_TO_LENDLOOP_SECRET;
});

async function post(t: T, secret: string, body: unknown = { request: "metrics" }) {
  const raw = JSON.stringify(body);
  const { timestamp, signature } = await sign(secret, raw);
  return t.fetch("/ops/metrics", {
    method: "POST",
    headers: { "content-type": "application/json", "x-lendloop-timestamp": timestamp, "x-lendloop-signature": signature },
    body: raw,
  });
}

describe("POST /ops/metrics", () => {
  test("needs the ops secret: unsigned, wrongly signed and n8n-signed calls are refused", async () => {
    const t = setup();
    expect((await t.fetch("/ops/metrics", { method: "POST", body: "{}" })).status).toBe(401);
    expect((await post(t, "nope")).status).toBe(401);
    // n8n's credential can't read operational metrics.
    expect((await post(t, N8N)).status).toBe(401);
    delete process.env.OPS_METRICS_SECRET;
    expect((await post(t, OPS)).status).toBe(503);
  });

  test("returns counts only, matching the data", async () => {
    const t = setup();
    const ada = await signIn(t, "Ada");
    const bob = await signIn(t, "Bob");
    const tool = { name: "Ladder", category: "hand_tools" as const, condition: "good" as const, description: "" };
    const open = await ada.as.mutation(api.tools.create, tool);
    await bob.as.mutation(api.loans.request, { toolId: open, startDate: isoDay(1), endDate: isoDay(2) });
    const lent = await ada.as.mutation(api.tools.create, { ...tool, name: "Drill" });
    const loanId = await bob.as.mutation(api.loans.request, { toolId: lent, startDate: isoDay(1), endDate: isoDay(2) });
    await ada.as.mutation(api.loans.approve, { loanId });
    await t.run(async (ctx) => {
      await ctx.db.patch(loanId, { startDate: isoDay(-5), endDate: isoDay(-2) });
      await ctx.db.insert("automationEvents", { idempotencyKey: "error:1", kind: "workflow_error", status: "failed", at: Date.now() });
    });
    // Deliveries really run in tests (and fail: no N8N_WEBHOOK_URL), moving from
    // pending to failed while we read, so check the stable total.
    const deliveries = await t.run((ctx) => ctx.db.query("webhookDeliveries").collect());

    const res = await post(t, OPS);
    expect(res.status).toBe(200);
    const m = await res.json();
    expect(m).toMatchObject({
      WorkflowErrors24h: 1,
      OpenRequests: 1,
      ActiveLoans: 1,
      OverdueLoans: 1,
      OverdueNotRemindedToday: 1,
    });
    expect(m.FailedDeliveries + m.PendingDeliveries).toBe(deliveries.length);
    expect(m.OldestPendingDeliveryAgeSeconds).toBeGreaterThanOrEqual(0);
    expect(Object.values(m).every((v) => typeof v === "number")).toBe(true);
    expect(JSON.stringify(m)).not.toMatch(/@|Ada|Bob|Ladder/);

    // Once today's reminder is recorded as sent, the loan no longer counts as un-reminded.
    await t.run((ctx) =>
      ctx.db.insert("automationEvents", { idempotencyKey: reminderKey(loanId, todayUtc()), loanId, kind: "overdue_reminder", status: "sent", at: Date.now() }),
    );
    expect((await (await post(t, OPS)).json()).OverdueNotRemindedToday).toBe(0);
  });
});
