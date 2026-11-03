import { readFileSync } from "node:fs";
import { describe, expect, test } from "vitest";
import { loanEventEmail, type LoanEventName } from "../convex/lib/email/loanEmails";
import { sign, verify } from "../convex/lib/hmac";
import { vLoanEvent } from "../convex/schema";
import { loadWorkflow, node, runCode, type Item } from "./runCode";

const TO_N8N = "lendloop-to-n8n-test-secret";
const TO_CONVEX = "n8n-to-lendloop-test-secret";
const env = {
  LENDLOOP_TO_N8N_SECRET: TO_N8N,
  N8N_TO_LENDLOOP_SECRET: TO_CONVEX,
  LENDLOOP_APP_URL: "https://lendloop.test",
};

const notify = loadWorkflow("notify");
const remind = loadWorkflow("remind");
const errors = loadWorkflow("error");
const remind02 = () => remind;
const all = [notify, remind, errors];
const LOAN_EVENTS = vLoanEvent.members.map((m) => m.value);

const LOAN_EVENT_NAMES = ["loan.requested", "loan.approved", "loan.declined", "loan.cancelled", "loan.returned"] as LoanEventName[];
const payload = (over: Record<string, unknown> = {}) => ({
  email: loanEventEmail({
    // A bogus event still carries a well-formed email, so the check that fails is the event's.
    event: (LOAN_EVENT_NAMES.includes(over.event as LoanEventName) ? over.event : "loan.requested") as LoanEventName,
    recipientFirstName: "Olu",
    otherFirstName: "Remi",
    toolName: "Ladder",
    toolCategory: "hand_tools",
    startDate: "2026-11-04",
    endDate: "2026-11-06",
  }),
  deliveryId: "d1",
  event: "loan.requested",
  occurredAt: "2026-11-03T10:00:00.000Z",
  loan: { id: "loan1", status: "requested", startDate: "2026-11-04", endDate: "2026-11-06" },
  tool: { name: "Ladder" },
  recipient: { role: "lender", email: "olu@example.com", firstName: "Olu" },
  otherParty: { firstName: "Remi" },
  ...over,
});

/** What the Webhook node hands "Verify signature": headers in json, raw body in binary. */
async function webhookCall(body: string, opts: { secret?: string; timestamp?: string; signature?: string } = {}) {
  const signed = await sign(opts.secret ?? TO_N8N, body);
  const headers = {
    "x-lendloop-timestamp": opts.timestamp ?? signed.timestamp,
    "x-lendloop-signature": opts.signature ?? signed.signature,
  };
  return { input: [{ json: { headers } }], rawBody: body };
}

/** Checks a signed write-back the way Convex's HTTP endpoint will. */
async function convexAccepts(out: Record<string, unknown>) {
  return verify({
    secret: TO_CONVEX,
    rawBody: out.body as string,
    timestamp: out.timestamp as string,
    signature: out.signature as string,
  });
}

describe("exported workflow JSON", () => {
  const raw = all.map((w) => JSON.stringify(w)).join("\n");

  test("contains no secrets: only $env references and credential ids", () => {
    for (const secret of [TO_N8N, TO_CONVEX]) expect(raw).not.toContain(secret);
    expect(raw).not.toMatch(/-----BEGIN|sk_(live|test)_|pk_(live|test)_|xox[bp]-|hooks\.slack\.com/);
    // Secrets are only ever read from the environment.
    for (const w of all) {
      for (const n of w.nodes) {
        const code = String(n.parameters.jsCode ?? "");
        if (code.includes("createHmac")) expect(code).toMatch(/\$env\.(LENDLOOP_TO_N8N_SECRET|N8N_TO_LENDLOOP_SECRET)/);
        const creds = n.credentials as Record<string, Record<string, unknown>> | undefined;
        for (const ref of Object.values(creds ?? {})) expect(Object.keys(ref).sort()).toEqual(["id", "name"]);
      }
    }
  });

  test("the committed SMTP credential has no password", () => {
    const creds = JSON.parse(readFileSync(new URL("./credentials/mailpit-smtp.json", import.meta.url), "utf8"));
    for (const c of creds) expect(c.data.password ?? "").toBe("");
  });

  test("every workflow that can fail routes to the error workflow", () => {
    expect(errors.nodes.some((n) => n.type === "n8n-nodes-base.errorTrigger")).toBe(true);
    for (const w of [notify, remind]) {
      expect(w.settings.errorWorkflow).toBe(errors.id);
      expect(w.settings.saveDataErrorExecution).toBe("all");
    }
  });

  test("every network step (HTTP, email) retries", () => {
    for (const w of all) {
      for (const n of w.nodes.filter((n) => /httpRequest|emailSend/.test(n.type))) {
        expect(n.retryOnFail, `${w.name} › ${n.name}`).toBe(true);
        expect(Number(n.maxTries), `${w.name} › ${n.name}`).toBeGreaterThanOrEqual(2);
      }
    }
  });

  test("calls to Convex use the env URL and send both signature headers", () => {
    for (const w of all) {
      for (const n of w.nodes.filter((n) => n.type === "n8n-nodes-base.httpRequest")) {
        expect(n.parameters.url).toMatch(/^=\{\{ \$env\.LENDLOOP_CONVEX_SITE_URL \}\}\/n8n\//);
        const names = (n.parameters.headerParameters as { parameters: { name: string }[] }).parameters.map((h) => h.name);
        expect(names).toEqual(expect.arrayContaining(["x-lendloop-timestamp", "x-lendloop-signature"]));
      }
    }
  });

  test("the webhook path is the one Convex is configured to call", () => {
    const setup = readFileSync(new URL("../scripts/setup.sh", import.meta.url), "utf8");
    const path = node(notify, "Loan event webhook").parameters.path as string;
    expect(setup).toContain(`N8N_WEBHOOK_URL http://n8n:5678/webhook/${path}`);
    // The raw body is kept so the signature is checked over the exact bytes.
    expect(node(notify, "Loan event webhook").parameters.options).toMatchObject({ rawBody: true });
  });

  test("the reminder workflow runs daily", () => {
    const rule = node(remind, "Every day at 08:00 UTC").parameters.rule as { interval: { field: string }[] };
    expect(rule.interval).toEqual([expect.objectContaining({ field: "days" })]);
  });
});

describe("01 Request notifications › Verify signature", () => {
  const verifyNode = (call: Awaited<ReturnType<typeof webhookCall>>, staticData = {}, e: Record<string, string | undefined> = env) =>
    runCode(notify, "Verify signature", { ...call, env: e, staticData });

  test("accepts a body signed by Convex's sign()", async () => {
    const body = JSON.stringify(payload());
    const [out] = await verifyNode(await webhookCall(body));
    expect(out.json).toEqual({ valid: true, duplicate: false, payload: payload() });
  });

  test.each([
    ["tampered body", async () => ({ ...(await webhookCall(JSON.stringify(payload()))), rawBody: JSON.stringify(payload({ tool: { name: "Car" } })) }), "bad signature"],
    ["wrong secret", () => webhookCall(JSON.stringify(payload()), { secret: "nope" }), "bad signature"],
    ["stale timestamp", async () => {
      const body = JSON.stringify(payload());
      const old = Date.now() - 6 * 60 * 1000;
      const s = await sign(TO_N8N, body, old);
      return webhookCall(body, { timestamp: s.timestamp, signature: s.signature });
    }, "stale"],
    ["future timestamp", async () => {
      const body = JSON.stringify(payload());
      const s = await sign(TO_N8N, body, Date.now() + 6 * 60 * 1000);
      return webhookCall(body, { timestamp: s.timestamp, signature: s.signature });
    }, "stale"],
    ["non-numeric timestamp", () => webhookCall(JSON.stringify(payload()), { timestamp: "soon" }), "stale"],
    ["missing signature", () => webhookCall(JSON.stringify(payload()), { signature: "" }), "missing signature"],
  ])("rejects a %s", async (_name, make, reason) => {
    const [out] = await verifyNode(await make());
    expect(out.json).toEqual({ valid: false, reason });
  });

  test("rejects when the secret isn't configured or the body is missing", async () => {
    const call = await webhookCall(JSON.stringify(payload()));
    expect((await verifyNode(call, {}, {}))[0].json).toEqual({ valid: false, reason: "not configured" });
    expect((await verifyNode({ ...call, rawBody: undefined } as never))[0].json).toEqual({ valid: false, reason: "missing body" });
  });

  test("flags a delivery it has already handled", async () => {
    const [out] = await verifyNode(await webhookCall(JSON.stringify(payload())), { deliveries: ["d0", "d1"] });
    expect(out.json).toMatchObject({ valid: true, duplicate: true });
  });
});

describe("01 Request notifications › Check payload", () => {
  const check = (p: Record<string, unknown>) =>
    runCode(notify, "Check payload", { input: [{ json: { valid: true, duplicate: false, payload: p } }], env });

  test.each(LOAN_EVENTS)("%s: passes Convex's rendered email through to the send step", async (event) => {
    const p = payload({ event });
    const [out] = await check(p);
    expect(out.json).toEqual({ to: "olu@example.com", ...(p.email as object), deliveryId: "d1", loanId: "loan1" });
  });

  test("the message really is Convex's: same renderer, HTML and text", async () => {
    const [out] = await check(payload());
    expect(out.json.subject).toBe("Remi wants to borrow your Ladder");
    expect(out.json.html).toContain("New borrow request");
    expect(out.json.text).toMatch(/^Hi Olu,/);
  });

  test.each([
    ["an unknown event", { event: "loan.exploded" }, /Unknown event type/],
    ["no rendered email", { email: undefined }, /missing email\.subject/],
    ["an empty html part", { email: { subject: "s", html: "", text: "t" } }, /missing email\.html/],
    ["no recipient address", { recipient: { role: "lender", firstName: "Olu" } }, /missing recipient\.email/],
  ])("%s fails the run (so the error workflow sees it)", async (_name, over, message) => {
    await expect(check(payload(over))).rejects.toThrow(message);
  });

  test("both email nodes send HTML and text from the rendered message", () => {
    const send = node(notify, "Send notification").parameters;
    expect(send).toMatchObject({ emailFormat: "both", html: "={{ $json.html }}", text: "={{ $json.text }}", subject: "={{ $json.subject }}" });
    const remind = node(remind02(), "Send reminder").parameters;
    expect(remind).toMatchObject({ emailFormat: "both", html: "={{ $json.email.html }}", text: "={{ $json.email.text }}", subject: "={{ $json.email.subject }}" });
  });
});

describe("01 Request notifications › Mark sent and sign write-back", () => {
  const composed: Item[] = [{ json: { deliveryId: "d9", loanId: "loan9" } }];

  test("signs an idempotent write-back that Convex will accept", async () => {
    const staticData: Record<string, unknown> = {};
    const [out] = await runCode(notify, "Mark sent and sign write-back", { nodes: { "Check payload": composed }, env, staticData });
    expect(JSON.parse(out.json.body as string)).toEqual({
      idempotencyKey: "notify:d9",
      loanId: "loan9",
      kind: "request_notification",
      status: "sent",
    });
    expect(await convexAccepts(out.json)).toEqual({ ok: true });
    expect(staticData.deliveries).toEqual(["d9"]);
  });

  test("remembers at most the last 1000 deliveries", async () => {
    const staticData: Record<string, unknown> = { deliveries: Array.from({ length: 1000 }, (_, i) => `old${i}`) };
    await runCode(notify, "Mark sent and sign write-back", { nodes: { "Check payload": composed }, env, staticData });
    const list = staticData.deliveries as string[];
    expect(list).toHaveLength(1000);
    expect(list.at(-1)).toBe("d9");
    expect(list[0]).toBe("old1");
  });
});

describe("02 Overdue reminders", () => {
  const loan = (id: string) => ({
    loanId: id,
    idempotencyKey: `overdue:${id}:2026-11-03`,
    toolName: "Ladder",
    endDate: "2026-11-01",
    daysOverdue: 2,
    borrower: { email: `${id}@example.com`, firstName: "Remi" },
  });

  test("the fetch request is signed for Convex", async () => {
    const [out] = await runCode(remind, "Sign request", { env });
    expect(JSON.parse(out.json.body as string)).toEqual({ request: "overdue-loans" });
    expect(await convexAccepts(out.json)).toEqual({ ok: true });
  });

  test("one item per overdue loan; none when nothing is overdue", async () => {
    const two = await runCode(remind, "One item per loan", { input: [{ json: { asOf: "2026-11-03", loans: [loan("a"), loan("b")] } }] });
    expect(two.map((i) => i.json.loanId)).toEqual(["a", "b"]);
    expect(await runCode(remind, "One item per loan", { input: [{ json: { asOf: "2026-11-03", loans: [] } }] })).toEqual([]);
  });

  test("write-back is keyed per loan per day and records sent or failed", async () => {
    const loans = [{ json: loan("a") }, { json: loan("b") }];
    const out = await runCode(remind, "Sign write-back", {
      nodes: { "One item per loan": loans },
      // Send reminder output: the email node passes through on success, adds `error` on failure.
      input: [{ json: {} }, { json: { error: { message: "SMTP said no ".repeat(40) } } }],
      env,
    });
    const bodies = out.map((i) => JSON.parse(i.json.body as string));
    expect(bodies[0]).toEqual({ idempotencyKey: "overdue:a:2026-11-03", loanId: "a", kind: "overdue_reminder", status: "sent" });
    expect(bodies[1]).toMatchObject({ idempotencyKey: "overdue:b:2026-11-03", loanId: "b", status: "failed" });
    expect(bodies[1].detail.length).toBeLessThanOrEqual(300);
    expect(out.map((i) => i.json.failed)).toEqual([false, true]);
    for (const item of out) expect(await convexAccepts(item.json)).toEqual({ ok: true });
  });

  test("a run with any failed reminder fails, so it reaches the error workflow", async () => {
    const ok: Item[] = [{ json: { failed: false } }, { json: { failed: false } }];
    expect(await runCode(remind, "Fail run if any reminder failed", { nodes: { "Sign write-back": ok } })).toEqual([{ json: { reminded: 2 } }]);
    const bad: Item[] = [{ json: { failed: false } }, { json: { failed: true } }];
    await expect(runCode(remind, "Fail run if any reminder failed", { nodes: { "Sign write-back": bad } })).rejects.toThrow(/1 overdue reminder/);
  });

  test("the reminder email node keeps going on failure so the failure is written back", () => {
    expect(node(remind, "Send reminder").onError).toBe("continueRegularOutput");
  });
});

describe("03 Error handler", () => {
  test("records a signed, idempotent workflow_error without copying item data", async () => {
    const [out] = await runCode(errors, "Describe and sign", {
      input: [{
        json: {
          execution: { id: "ex42", url: "http://n8n/ex42", lastNodeExecuted: "Send reminder", error: { message: "boom ".repeat(100) } },
          workflow: { name: "LendLoop – Overdue reminders" },
          // Data an error trigger might carry that must not leak into the alert.
          items: [{ email: "remi@example.com" }],
        },
      }],
      env,
    });
    const body = JSON.parse(out.json.body as string);
    expect(body).toMatchObject({ idempotencyKey: "error:ex42", kind: "workflow_error", status: "failed" });
    expect(body.detail).toMatch(/^LendLoop – Overdue reminders › Send reminder: boom/);
    expect(body.detail.length).toBeLessThan(400);
    expect(out.json.body).not.toContain("remi@example.com");
    expect(out.json.url).toBe("http://n8n/ex42");
    expect(await convexAccepts(out.json)).toEqual({ ok: true });
  });
});
