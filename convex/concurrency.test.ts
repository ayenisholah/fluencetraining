import { describe, expect, test } from "vitest";
import { api, internal } from "./_generated/api";
import { isoDay, setup } from "./test.setup";

// convex-test serializes top-level mutations. These tests prove valid orderings,
// not the production OCC implementation; e2e/concurrency-backend.spec.ts does contention.
async function fixture(count = 1) {
  const t = setup();
  const runId = crypto.randomUUID();
  const data = await t.mutation(internal.concurrencyFixtures.setup, { runId, toolCount: count });
  const actor = (name: string) => t.withIdentity(data.actors.find((a) => a.actor === name)!.identity);
  const inspect = () => t.query(internal.concurrencyFixtures.inspect, { runId });
  const request = () => actor("borrower0").mutation(api.loans.request, { toolId: data.toolIds[0], startDate: isoDay(1), endDate: isoDay(3) });
  return { t, runId, ...data, actor, inspect, request };
}

for (const first of ["approve", "cancel", "decline"] as const) {
  for (const second of ["approve", "cancel", "decline"] as const) {
    test(`${first} followed by stale ${second} cannot overwrite a decision`, async () => {
      const f = await fixture();
      const loanId = await f.request();
      await f.actor(first === "cancel" ? "borrower0" : "owner").mutation(api.loans[first], { loanId });
      await expect(f.actor(second === "cancel" ? "borrower0" : "owner").mutation(api.loans[second], { loanId })).rejects.toThrow(/not open|Only open requests/);
      const state = await f.inspect();
      expect(state.loans[0].status).toBe({ approve: "approved", cancel: "cancelled", decline: "declined" }[first]);
      expect(state.deliveries).toHaveLength(2);
      expect(state.tools[0].status).toBe(first === "approve" ? "on_loan" : "available");
    });
  }
}

for (const removeFirst of [true, false]) {
  describe(`removal ${removeFirst ? "first" : "second"}`, () => {
    test("request cannot survive removal as an open loan", async () => {
      const f = await fixture();
      const remove = () => f.actor("admin").mutation(api.admin.removeListing, { toolId: f.toolIds[0] });
      if (removeFirst) { await remove(); await expect(f.request()).rejects.toThrow(/not found/); }
      else { await f.request(); await remove(); }
      const state = await f.inspect();
      expect(state.tools[0].status).toBe("removed");
      expect(state.loans.every((loan) => loan.status === "declined")).toBe(true);
      expect(state.deliveries).toHaveLength(removeFirst ? 0 : 2);
    });
    test("approval only survives if committed before removal", async () => {
      const f = await fixture();
      const loanId = await f.request();
      const remove = () => f.actor("admin").mutation(api.admin.removeListing, { toolId: f.toolIds[0] });
      const approve = () => f.actor("owner").mutation(api.loans.approve, { loanId });
      if (removeFirst) { await remove(); await expect(approve()).rejects.toThrow(/not open/); }
      else { await approve(); await remove(); }
      const state = await f.inspect();
      expect(state.tools[0].status).toBe("removed");
      expect(state.loans[0].status).toBe(removeFirst ? "declined" : "approved");
      expect(state.deliveries).toHaveLength(2);
    });
    test("return never resurrects a removed listing", async () => {
      const f = await fixture();
      const loanId = await f.request();
      await f.actor("owner").mutation(api.loans.approve, { loanId });
      const remove = () => f.actor("admin").mutation(api.admin.removeListing, { toolId: f.toolIds[0] });
      const close = () => f.actor("owner").mutation(api.loans.markReturned, { loanId });
      if (removeFirst) { await remove(); await close(); } else { await close(); await remove(); }
      await expect(close()).rejects.toThrow(/not active/);
      const state = await f.inspect();
      expect(state.tools[0].status).toBe("removed");
      expect(state.loans[0]).toMatchObject({ status: "returned", phase: "closed" });
      expect(state.deliveries.filter((d) => d.event === "loan.returned")).toHaveLength(1);
    });
  });
}

test("cleanup is scoped, idempotent, and removes all related fixture records", async () => {
  const f = await fixture();
  const otherRun = crypto.randomUUID();
  await f.t.mutation(internal.concurrencyFixtures.setup, { runId: otherRun, toolCount: 1 });
  await f.request();
  for (let i = 0; i < 2; i++) await f.t.mutation(internal.concurrencyFixtures.cleanup, { runId: f.runId });
  expect(await f.inspect()).toEqual({ users: [], tools: [], loans: [], deliveries: [] });
  expect((await f.t.query(internal.concurrencyFixtures.inspect, { runId: otherRun })).tools).toHaveLength(1);
  await expect(f.t.mutation(internal.concurrencyFixtures.cleanup, { runId: "" })).rejects.toThrow(/UUID/);
});

test("fixture writes roll back on invalid input", async () => {
  const t = setup(), runId = crypto.randomUUID();
  await expect(t.mutation(internal.concurrencyFixtures.setup, { runId, toolCount: 41 })).rejects.toThrow(/1–40/);
  expect((await t.query(internal.concurrencyFixtures.inspect, { runId })).users).toHaveLength(0);
});
