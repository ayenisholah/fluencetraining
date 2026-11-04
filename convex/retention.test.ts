import { describe, expect, test, vi } from "vitest";
import { internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import { OVERDUE_BATCH, redactDetail, RETENTION_DAYS } from "./automation";
import { isoDay, setup, signIn, type T } from "./test.setup";

const DAY = 24 * 60 * 60 * 1000;

async function history(t: T, loanId: Id<"loans">, tag: string) {
  return t.run(async (ctx) => ({
    delivered: await ctx.db.insert("webhookDeliveries", {
      loanId,
      event: "loan.requested",
      status: "delivered",
      attempts: 1,
      deliveredAt: Date.now(),
    }),
    failed: await ctx.db.insert("webhookDeliveries", {
      loanId,
      event: "loan.approved",
      status: "failed",
      attempts: 5,
      lastError: "HTTP 500",
    }),
    pending: await ctx.db.insert("webhookDeliveries", {
      loanId,
      event: "loan.returned",
      status: "pending",
      attempts: 0,
    }),
    event: await ctx.db.insert("automationEvents", {
      idempotencyKey: `notify:${tag}`,
      loanId,
      kind: "request_notification",
      status: "sent",
      at: Date.now(),
    }),
  }));
}

async function aLoan(t: T): Promise<Id<"loans">> {
  const ada = await signIn(t, "Ada");
  return t.run(async (ctx) => {
    const toolId = await ctx.db.insert("tools", {
      ownerId: ada.id,
      name: "Ladder",
      category: "garden",
      condition: "good",
      description: "",
      status: "available",
    });
    return ctx.db.insert("loans", {
      toolId,
      borrowerId: ada.id,
      lenderId: ada.id,
      startDate: isoDay(1),
      endDate: isoDay(2),
      status: "returned",
    });
  });
}

describe("automation:purgeOld (90-day retention)", () => {
  test("deletes finished history older than the retention period and keeps the rest", async () => {
    vi.useFakeTimers();
    try {
      const t = setup();
      const loanId = await aLoan(t);
      const old = await history(t, loanId, "old");
      vi.advanceTimersByTime((RETENTION_DAYS + 1) * DAY);
      const recent = await history(t, loanId, "recent");

      expect(await t.mutation(internal.automation.purgeOld, {})).toEqual({ deleted: 3 });
      const exists = (id: Id<"webhookDeliveries"> | Id<"automationEvents">) =>
        t.run(async (ctx) => (await ctx.db.get(id)) !== null);
      // Old finished rows are gone; an old *pending* delivery is never touched.
      expect(await exists(old.delivered)).toBe(false);
      expect(await exists(old.failed)).toBe(false);
      expect(await exists(old.event)).toBe(false);
      expect(await exists(old.pending)).toBe(true);
      for (const id of Object.values(recent)) expect(await exists(id)).toBe(true);
      // Nothing old left: a re-run deletes nothing.
      expect(await t.mutation(internal.automation.purgeOld, {})).toEqual({ deleted: 0 });
    } finally {
      vi.useRealTimers();
    }
  });
});

describe("error details are stored without email addresses", () => {
  test("redactDetail masks addresses, including inside provider errors", () => {
    expect(
      redactDetail("Message failed: 554 Access denied ... identity/jane.doe+test@example.co.uk' and <bob@test.dev>"),
    ).toBe("Message failed: 554 Access denied ... identity/[email]' and <[email]>");
    expect(redactDetail("HTTP 502 from n8n")).toBe("HTTP 502 from n8n");
    expect(redactDetail(undefined)).toBeUndefined();
    expect(redactDetail("x".repeat(600))).toHaveLength(500);
  });

  test("recordEvent stores the redacted detail", async () => {
    const t = setup();
    await t.mutation(internal.automation.recordEvent, {
      idempotencyKey: "error:exec-1",
      kind: "workflow_error",
      status: "failed",
      detail: "Send notification: 550 mailbox unavailable for a@b.test",
    });
    const row = await t.run((ctx) =>
      ctx.db
        .query("automationEvents")
        .withIndex("by_key", (q) => q.eq("idempotencyKey", "error:exec-1"))
        .unique(),
    );
    expect(row?.detail).toBe("Send notification: 550 mailbox unavailable for [email]");
  });
});

describe("automation:overdueLoans batching", () => {
  test("loans already reminded today don't use up the batch", async () => {
    const t = setup();
    const ada = await signIn(t, "Ada", { email: "ada@example.com" });
    const asOf = isoDay(0);
    const total = OVERDUE_BATCH + 1;
    const loanIds = await t.run(async (ctx) => {
      const toolId = await ctx.db.insert("tools", {
        ownerId: ada.id,
        name: "Ladder",
        category: "garden",
        condition: "good",
        description: "",
        status: "on_loan",
      });
      const ids: Id<"loans">[] = [];
      for (let i = 0; i < total; i++) {
        ids.push(
          await ctx.db.insert("loans", {
            toolId,
            borrowerId: ada.id,
            lenderId: ada.id,
            startDate: isoDay(-10),
            endDate: isoDay(-1),
            status: "approved",
          }),
        );
      }
      return ids;
    });
    // The first run reaches the first 500.
    const first = await t.query(internal.automation.overdueLoans, { asOf });
    expect(first).toHaveLength(OVERDUE_BATCH);
    // They're reminded (as n8n's write-back records them)...
    await t.run(async (ctx) => {
      for (const row of first) {
        await ctx.db.insert("automationEvents", {
          idempotencyKey: row.idempotencyKey,
          loanId: row.loanId as Id<"loans">,
          kind: "overdue_reminder",
          status: "sent",
          at: Date.now(),
        });
      }
    });
    // ...so a re-run returns the one loan the first run didn't get to.
    const second = await t.query(internal.automation.overdueLoans, { asOf });
    expect(second.map((r) => r.loanId)).toEqual(loanIds.filter((id) => !first.some((r) => r.loanId === id)));
    expect(second).toHaveLength(1);
  });
});
