import { v } from "convex/values";
import { internal } from "./_generated/api";
import {
  internalAction,
  internalMutation,
  internalQuery,
} from "./_generated/server";
import { sign, SIGNATURE_HEADER, TIMESTAMP_HEADER } from "./lib/hmac";
import type { LoanEvent } from "./lib/outbox";

export const MAX_ATTEMPTS = 5;
const TIMEOUT_MS = 10_000;

/** 30s, 2m, 8m, 32m between attempts. */
export function backoffMs(attempt: number): number {
  return 30_000 * 4 ** (attempt - 1);
}

const RECIPIENT: Record<LoanEvent, "lender" | "borrower"> = {
  "loan.requested": "lender",
  "loan.cancelled": "lender",
  "loan.approved": "borrower",
  "loan.declined": "borrower",
  "loan.returned": "borrower",
};

/**
 * Builds the webhook body at send time from current records. Contains only
 * what a notification needs: one recipient's email and first name, the other
 * party's first name, the tool name and the dates.
 */
export const buildPayload = internalQuery({
  args: { deliveryId: v.id("webhookDeliveries") },
  handler: async (ctx, { deliveryId }) => {
    const delivery = await ctx.db.get(deliveryId);
    if (!delivery || delivery.status !== "pending") return null;
    const loan = await ctx.db.get(delivery.loanId);
    if (!loan) return { error: "Loan no longer exists." } as const;
    const tool = await ctx.db.get(loan.toolId);
    const lender = await ctx.db.get(loan.lenderId);
    const borrower = await ctx.db.get(loan.borrowerId);
    const to = RECIPIENT[delivery.event];
    const recipient = to === "lender" ? lender : borrower;
    const other = to === "lender" ? borrower : lender;
    if (!recipient?.email) {
      return { error: "Recipient has no email address on file." } as const;
    }
    return {
      body: {
        deliveryId,
        event: delivery.event,
        occurredAt: new Date(delivery._creationTime).toISOString(),
        loan: {
          id: loan._id,
          status: loan.status,
          startDate: loan.startDate,
          endDate: loan.endDate,
        },
        tool: { name: tool?.name ?? "a tool" },
        recipient: {
          role: to,
          email: recipient.email,
          firstName: recipient.name.split(" ")[0],
        },
        otherParty: { firstName: other?.name.split(" ")[0] ?? "A neighbour" },
      },
    } as const;
  },
});

export const deliver = internalAction({
  args: { deliveryId: v.id("webhookDeliveries") },
  handler: async (ctx, { deliveryId }) => {
    const built = await ctx.runQuery(internal.webhooks.buildPayload, {
      deliveryId,
    });
    if (built === null) return; // already delivered or failed
    if ("error" in built) {
      await ctx.runMutation(internal.webhooks.recordAttempt, {
        deliveryId,
        ok: false,
        retryable: false,
        error: built.error,
      });
      return;
    }

    const url = process.env.N8N_WEBHOOK_URL;
    const secret = process.env.LENDLOOP_TO_N8N_SECRET;
    if (!url || !secret) {
      await ctx.runMutation(internal.webhooks.recordAttempt, {
        deliveryId,
        ok: false,
        retryable: false,
        error: "N8N_WEBHOOK_URL or LENDLOOP_TO_N8N_SECRET is not set.",
      });
      return;
    }

    const rawBody = JSON.stringify(built.body);
    const { timestamp, signature } = await sign(secret, rawBody);
    let ok = false;
    let retryable = true;
    let error: string | undefined;
    try {
      const response = await fetch(url, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          [TIMESTAMP_HEADER]: timestamp,
          [SIGNATURE_HEADER]: signature,
          "x-lendloop-delivery": deliveryId,
        },
        body: rawBody,
        signal: AbortSignal.timeout(TIMEOUT_MS),
      });
      ok = response.ok;
      if (!ok) {
        error = `n8n responded ${response.status}`;
        // 4xx (bad signature, bad payload) will not fix itself on retry;
        // 408/429 and 5xx are transient.
        retryable =
          response.status >= 500 ||
          response.status === 408 ||
          response.status === 429;
      }
    } catch (err) {
      error = err instanceof Error ? err.message : String(err);
    }
    await ctx.runMutation(internal.webhooks.recordAttempt, {
      deliveryId,
      ok,
      retryable,
      error,
    });
  },
});

export const recordAttempt = internalMutation({
  args: {
    deliveryId: v.id("webhookDeliveries"),
    ok: v.boolean(),
    retryable: v.boolean(),
    error: v.optional(v.string()),
  },
  handler: async (ctx, { deliveryId, ok, retryable, error }) => {
    const delivery = await ctx.db.get(deliveryId);
    if (!delivery || delivery.status !== "pending") return;
    const attempts = delivery.attempts + 1;
    if (ok) {
      await ctx.db.patch(deliveryId, {
        status: "delivered",
        attempts,
        deliveredAt: Date.now(),
        lastError: undefined,
        nextAttemptAt: undefined,
      });
      return;
    }
    const lastError = error?.slice(0, 300);
    if (retryable && attempts < MAX_ATTEMPTS) {
      const delay = backoffMs(attempts);
      await ctx.db.patch(deliveryId, {
        attempts,
        lastError,
        nextAttemptAt: Date.now() + delay,
      });
      await ctx.scheduler.runAfter(delay, internal.webhooks.deliver, {
        deliveryId,
      });
      return;
    }
    console.error(`Webhook delivery ${deliveryId} failed: ${lastError}`);
    await ctx.db.patch(deliveryId, {
      status: "failed",
      attempts,
      lastError,
      nextAttemptAt: undefined,
    });
  },
});
