import { httpRouter } from "convex/server";
import type { Infer } from "convex/values";
import { internal } from "./_generated/api";
import { httpAction } from "./_generated/server";
import { todayUtc } from "./lib/dates";
import { SIGNATURE_HEADER, TIMESTAMP_HEADER, verify } from "./lib/hmac";
import { vAutomationKind } from "./schema";

const MAX_BODY_BYTES = 16 * 1024;
type AutomationKind = Infer<typeof vAutomationKind>;
const KINDS: readonly string[] = vAutomationKind.members.map((m) => m.value);
const isKind = (value: unknown): value is AutomationKind => typeof value === "string" && KINDS.includes(value);

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json", "cache-control": "no-store" },
  });
}

/**
 * Reads and authenticates a signed request. n8n signs with
 * N8N_TO_LENDLOOP_SECRET; the production metrics poller with its own
 * OPS_METRICS_SECRET, so neither credential can call the other's endpoints.
 */
async function authenticate(
  request: Request,
  secretName: "N8N_TO_LENDLOOP_SECRET" | "OPS_METRICS_SECRET" = "N8N_TO_LENDLOOP_SECRET",
): Promise<{ body: Record<string, unknown> } | Response> {
  const secret = process.env[secretName];
  if (!secret) return json({ error: "not configured" }, 503);
  // Refuse oversized bodies before reading them when the size is declared, and
  // measure in bytes (not UTF-16 units) for chunked or undeclared ones.
  const declared = Number(request.headers.get("content-length") ?? 0);
  if (declared > MAX_BODY_BYTES) return json({ error: "too large" }, 413);
  const rawBody = await request.text();
  if (new TextEncoder().encode(rawBody).byteLength > MAX_BODY_BYTES) return json({ error: "too large" }, 413);
  const result = await verify({
    secret,
    rawBody,
    timestamp: request.headers.get(TIMESTAMP_HEADER),
    signature: request.headers.get(SIGNATURE_HEADER),
  });
  if (!result.ok) {
    console.warn(JSON.stringify({ level: "warn", event: "signed_request_rejected", path: new URL(request.url).pathname, reason: result.reason }));
    return json({ error: "unauthorized" }, 401);
  }
  try {
    const body: unknown = JSON.parse(rawBody);
    if (typeof body !== "object" || body === null || Array.isArray(body)) {
      return json({ error: "expected a JSON object" }, 400);
    }
    return { body: body as Record<string, unknown> };
  } catch {
    return json({ error: "invalid JSON" }, 400);
  }
}

const http = httpRouter();

// POST (not GET) so the signed body states the intent and nothing is cached.
http.route({
  path: "/n8n/overdue-loans",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    const auth = await authenticate(request);
    if (auth instanceof Response) return auth;
    // The server decides "today"; the caller cannot widen the query.
    const asOf = todayUtc();
    const loans = await ctx.runQuery(internal.automation.overdueLoans, { asOf });
    return json({ asOf, loans });
  }),
});

http.route({
  path: "/n8n/automation-events",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    const auth = await authenticate(request);
    if (auth instanceof Response) return auth;
    const { idempotencyKey, loanId, kind, status, detail } = auth.body;
    if (
      typeof idempotencyKey !== "string" ||
      idempotencyKey.length < 3 ||
      idempotencyKey.length > 200 ||
      !isKind(kind) ||
      (status !== "sent" && status !== "failed") ||
      (loanId !== undefined && loanId !== null && typeof loanId !== "string") ||
      (detail !== undefined && detail !== null && typeof detail !== "string")
    ) {
      return json({ error: "invalid event" }, 400);
    }
    const result = await ctx.runMutation(internal.automation.recordEvent, {
      idempotencyKey,
      loanId: loanId ?? undefined,
      kind,
      status,
      detail: detail ?? undefined,
    });
    if (!result.ok) return json({ error: result.error }, 422);
    return json({ ok: true, duplicate: result.duplicate });
  }),
});

// Operational counts for CloudWatch, polled by the production host over
// localhost (Caddy blocks /ops/* from the internet) and signed with a secret
// of its own.
http.route({
  path: "/ops/metrics",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    const auth = await authenticate(request, "OPS_METRICS_SECRET");
    if (auth instanceof Response) return auth;
    return json(await ctx.runQuery(internal.ops.metricsSnapshot, {}));
  }),
});

export default http;
