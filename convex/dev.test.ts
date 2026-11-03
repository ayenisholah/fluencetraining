import { describe, expect, test } from "vitest";
import { api, internal } from "./_generated/api";
import { SEED_TOOLS } from "./dev";
import { toolFieldErrors } from "./lib/rules";
import { categories } from "./schema";
import { isoDay, setup, signIn, type T } from "./test.setup";

const tool = (name: string) => ({ name, category: "garden" as const, condition: "good" as const, description: "" });

/** A tool with a loan that has a delivery and an automation event. */
async function toolWithHistory(t: T, name: string) {
  const owner = await signIn(t, `Owner ${name}`);
  const borrower = await signIn(t, `Borrower ${name}`);
  const toolId = await owner.as.mutation(api.tools.create, tool(name));
  const loanId = await borrower.as.mutation(api.loans.request, { toolId, startDate: isoDay(1), endDate: isoDay(2) });
  await t.run((ctx) =>
    ctx.db.insert("automationEvents", { idempotencyKey: `notify:${name}`, loanId, kind: "request_notification", status: "sent", at: 1 }),
  );
  return { toolId, loanId };
}

const count = (t: T, table: "tools" | "loans" | "webhookDeliveries" | "automationEvents") =>
  t.run(async (ctx) => (await ctx.db.query(table).collect()).length);

describe("dev:purgeTestData", () => {
  test("removes only matching e2e tools and everything that points at them", async () => {
    const t = setup();
    const a = await toolWithHistory(t, "E2E ladder run1");
    await toolWithHistory(t, "E2E ladder run2");
    const real = await toolWithHistory(t, "Wheelbarrow");
    await t.run((ctx) =>
      Promise.all([
        ctx.db.insert("automationEvents", { idempotencyKey: "error:1", kind: "workflow_error", status: "failed", detail: "x: Unknown event type: loan.e2e-broken-1", at: 1 }),
        ctx.db.insert("automationEvents", { idempotencyKey: "error:3", kind: "workflow_error", status: "failed", detail: "x: Unknown event type: loan.e2e-broken-2", at: 1 }),
        ctx.db.insert("automationEvents", { idempotencyKey: "error:2", kind: "workflow_error", status: "failed", detail: "real outage", at: 1 }),
      ]),
    );

    // Names mode only touches this run's error rows (marker run 1, not run 2).
    const counts = await t.mutation(internal.dev.purgeTestData, { names: ["E2E ladder run1"], errorMarkers: ["e2e-broken-1"] });
    expect(counts).toEqual({ tools: 1, loans: 1, deliveries: 1, events: 2 });
    expect(await t.run(async (ctx) => (await ctx.db.query("automationEvents").collect()).map((e) => e.idempotencyKey).sort())).toEqual(
      ["error:2", "error:3", "notify:E2E ladder run2", "notify:Wheelbarrow"],
    );
    expect(await t.run((ctx) => ctx.db.get(a.toolId))).toBeNull();
    expect(await t.run((ctx) => ctx.db.get(a.loanId))).toBeNull();

    await t.mutation(internal.dev.purgeTestData, { prefix: "E2E " });
    expect(await count(t, "tools")).toBe(1);
    expect(await count(t, "loans")).toBe(1);
    expect(await count(t, "webhookDeliveries")).toBe(1);
    // The real tool's event and the real outage survive.
    const events = await t.run((ctx) => ctx.db.query("automationEvents").collect());
    expect(events.map((e) => e.idempotencyKey).sort()).toEqual(["error:2", "notify:Wheelbarrow"]);
    expect(await t.run((ctx) => ctx.db.get(real.toolId))).not.toBeNull();
  });

  test("refuses to run without a target, or on anything not named E2E", async () => {
    const t = setup();
    await toolWithHistory(t, "Wheelbarrow");
    await expect(t.mutation(internal.dev.purgeTestData, {})).rejects.toThrow(/names.*prefix/);
    await expect(t.mutation(internal.dev.purgeTestData, { prefix: "" })).rejects.toThrow(/must start with/);
    await expect(t.mutation(internal.dev.purgeTestData, { prefix: "W" })).rejects.toThrow(/must start with/);
    await expect(t.mutation(internal.dev.purgeTestData, { names: ["Wheelbarrow"] })).rejects.toThrow(/Only tools named/);
    await expect(
      t.mutation(internal.dev.purgeTestData, { names: ["E2E x"], errorMarkers: ["outage"] }),
    ).rejects.toThrow(/errorMarkers/);
    expect(await count(t, "tools")).toBe(1);
  });
});

describe("dev:seedNeighbourhood", () => {
  test("creates believable neighbours and tools, and is safe to re-run", async () => {
    const t = setup();
    expect(await t.mutation(internal.dev.seedNeighbourhood, {})).toEqual({ users: 4, tools: SEED_TOOLS.length });
    expect(await t.mutation(internal.dev.seedNeighbourhood, {})).toEqual({ users: 0, tools: 0 });

    const users = await t.run((ctx) => ctx.db.query("users").collect());
    expect(users.map((u) => u.role)).toEqual(["user", "user", "user", "user"]);
    expect(users.every((u) => u.email?.endsWith("@lendloop.local"))).toBe(true);

    const listed = await t.query(api.tools.listPublic, {});
    expect(listed).toHaveLength(SEED_TOOLS.length);
    expect(listed.some((r) => r.name.startsWith("E2E"))).toBe(false);
  });

  test("covers every category with valid, distinct tools", () => {
    expect(new Set(SEED_TOOLS.map((s) => s.category))).toEqual(new Set(categories));
    expect(new Set(SEED_TOOLS.map((s) => s.name)).size).toBe(SEED_TOOLS.length);
    for (const s of SEED_TOOLS) expect(toolFieldErrors(s), s.name).toEqual({});
  });
});
