// Convex ⇄ n8n contract: real Convex functions (convex-test) talking to the
// real Code nodes from the exported workflows, with the network stubbed.
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { api, internal } from "../convex/_generated/api";
import { ALL, isoDay, setup, signIn, type T } from "../convex/test.setup";
import { loadWorkflow, runCode } from "./runCode";

const TO_N8N = "rt-lendloop-to-n8n";
const TO_CONVEX = "rt-n8n-to-lendloop";
const env = { LENDLOOP_TO_N8N_SECRET: TO_N8N, N8N_TO_LENDLOOP_SECRET: TO_CONVEX, LENDLOOP_APP_URL: "http://app" };
const notify = loadWorkflow("notify");
const remind = loadWorkflow("remind");

beforeEach(() => {
  process.env.N8N_WEBHOOK_URL = "http://n8n.test/webhook/lendloop-loan-events";
  process.env.LENDLOOP_TO_N8N_SECRET = TO_N8N;
  process.env.N8N_TO_LENDLOOP_SECRET = TO_CONVEX;
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

async function requested(t: T) {
  const owner = await signIn(t, "Olu Owner", { email: "olu@example.com" });
  const renter = await signIn(t, "Remi Renter", { email: "remi@example.com" });
  const toolId = await owner.as.mutation(api.tools.create, {
    name: "Ladder",
    category: "hand_tools",
    condition: "good",
    description: "Private note",
  });
  const loanId = await renter.as.mutation(api.loans.request, { toolId, startDate: isoDay(1), endDate: isoDay(2) });
  return { owner, renter, toolId, loanId };
}

/** Posts a signed n8n write-back (the output of a "sign" Code node) to Convex. */
function postToConvex(t: T, path: string, signed: Record<string, unknown>) {
  return t.fetch(path, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-lendloop-timestamp": signed.timestamp as string,
      "x-lendloop-signature": signed.signature as string,
    },
    body: signed.body as string,
  });
}

describe("request notification: Convex → n8n → Convex", () => {
  test("n8n's verifier accepts Convex's signed delivery, and its write-back lands on the loan once", async () => {
    vi.useFakeTimers();
    const t = setup();
    const { owner, renter, loanId } = await requested(t);

    // Convex delivers; the stubbed n8n runs the real Verify → Compose → Mark sent nodes.
    const staticData: Record<string, unknown> = {};
    const writeBacks: Record<string, unknown>[] = [];
    const emails: Record<string, unknown>[] = [];
    vi.stubGlobal("fetch", async (_url: string, init: RequestInit) => {
      const headers = Object.fromEntries(new Headers(init.headers).entries());
      const [verified] = await runCode(notify, "Verify signature", {
        input: [{ json: { headers } }],
        rawBody: init.body as string,
        env,
        staticData,
      });
      if (!verified.json.valid) return new Response("{}", { status: 401 });
      if (verified.json.duplicate) return new Response(JSON.stringify({ ok: true, duplicate: true }));
      const composed = await runCode(notify, "Check payload", { input: [verified], env });
      emails.push(composed[0].json);
      const [signed] = await runCode(notify, "Mark sent and sign write-back", {
        nodes: { "Check payload": composed },
        env,
        staticData,
      });
      writeBacks.push(signed.json);
      return new Response(JSON.stringify({ ok: true }));
    });
    await t.finishAllScheduledFunctions(vi.runAllTimers);

    const deliveries = await t.run((ctx) => ctx.db.query("webhookDeliveries").collect());
    expect(deliveries.map((d) => [d.event, d.status])).toEqual([["loan.requested", "delivered"]]);
    expect(emails).toEqual([
      expect.objectContaining({ to: "olu@example.com", subject: "Remi wants to borrow your Ladder" }),
    ]);
    expect(JSON.stringify(emails)).not.toContain("remi@example.com");
    expect(JSON.stringify(emails)).not.toContain("Private note");

    // n8n → Convex: the signed write-back is accepted, and a retry is a no-op.
    const first = await postToConvex(t, "/n8n/automation-events", writeBacks[0]);
    expect(first.status).toBe(200);
    expect(await first.json()).toEqual({ ok: true, duplicate: false });
    const retry = await postToConvex(t, "/n8n/automation-events", writeBacks[0]);
    expect(await retry.json()).toEqual({ ok: true, duplicate: true });
    expect(await t.run((ctx) => ctx.db.query("automationEvents").collect())).toHaveLength(1);

    // Bonus: both sides see the activity on the loan.
    const [incoming] = (await owner.as.query(api.loans.incoming, ALL)).page;
    expect(incoming.activity).toEqual([expect.objectContaining({ kind: "request_notification", status: "sent" })]);
    const [mine] = (await renter.as.query(api.loans.myRequests, ALL)).page;
    expect(mine._id).toBe(loanId);
    expect(mine.activity).toHaveLength(1);

    // A Convex retry of the same delivery is recognised by n8n and not emailed again.
    await t.run((ctx) => ctx.db.patch(deliveries[0]._id, { status: "pending" }));
    await t.action(internal.webhooks.deliver, { deliveryId: deliveries[0]._id });
    expect(emails).toHaveLength(1);
  });

  test("n8n rejecting the signature (401) is not retried and the delivery is marked failed", async () => {
    vi.useFakeTimers();
    process.env.LENDLOOP_TO_N8N_SECRET = "a-different-secret";
    const t = setup();
    await requested(t);
    vi.stubGlobal("fetch", async (_url: string, init: RequestInit) => {
      const headers = Object.fromEntries(new Headers(init.headers).entries());
      const [verified] = await runCode(notify, "Verify signature", {
        input: [{ json: { headers } }],
        rawBody: init.body as string,
        env,
      });
      return new Response("{}", { status: verified.json.valid ? 200 : 401 });
    });
    await t.finishAllScheduledFunctions(vi.runAllTimers);
    const [delivery] = await t.run((ctx) => ctx.db.query("webhookDeliveries").collect());
    expect(delivery).toMatchObject({ status: "failed", attempts: 1, lastError: "n8n responded 401" });
  });
});

describe("overdue reminders: n8n → Convex → n8n → Convex", () => {
  test("fetch, remind, write back; a re-run the same day finds nothing", async () => {
    const t = setup();
    const { owner, loanId } = await requested(t);
    await owner.as.mutation(api.loans.approve, { loanId });
    await t.run((ctx) => ctx.db.patch(loanId, { startDate: isoDay(-5), endDate: isoDay(-2) }));

    const runWorkflow = async (sendFails = false) => {
      const [request] = await runCode(remind, "Sign request", { env });
      const response = await postToConvex(t, "/n8n/overdue-loans", request.json);
      expect(response.status).toBe(200);
      const perLoan = await runCode(remind, "One item per loan", { input: [{ json: await response.json() }] });
      const sent = perLoan.map(() => ({ json: sendFails ? { error: { message: "SMTP down" } } : {} }));
      const signed = await runCode(remind, "Sign write-back", {
        input: sent,
        nodes: { "One item per loan": perLoan },
        env,
      });
      for (const item of signed) expect((await postToConvex(t, "/n8n/automation-events", item.json)).status).toBe(200);
      return perLoan;
    };

    // First run: the email fails, so the failure is recorded and the loan stays due today.
    const firstRun = await runWorkflow(true);
    expect(firstRun.map((i) => i.json.loanId)).toEqual([loanId]);
    expect(firstRun[0].json).toMatchObject({
      daysOverdue: 2,
      borrower: { email: "remi@example.com", firstName: "Remi" },
    });
    // Retry run succeeds and upgrades the same record.
    expect(await runWorkflow()).toHaveLength(1);
    // Third run the same day: already reminded, nothing to send.
    expect(await runWorkflow()).toEqual([]);

    const events = await t.run((ctx) => ctx.db.query("automationEvents").collect());
    expect(events.map((e) => [e.kind, e.status])).toEqual([["overdue_reminder", "sent"]]);
    const [incoming] = (await owner.as.query(api.loans.incoming, ALL)).page;
    expect(incoming).toMatchObject({
      overdue: true,
      activity: [expect.objectContaining({ kind: "overdue_reminder", status: "sent" })],
    });
  });
});
