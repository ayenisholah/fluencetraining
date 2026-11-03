import { expect, test } from "@playwright/test";
import type { FunctionReturnType } from "convex/server";
import { api, internal } from "../convex/_generated/api";
import { contend, withRace } from "./concurrency-harness";

test.setTimeout(90_000);
const successes = (results: PromiseSettledResult<unknown>[]) => results.filter((r) => r.status === "fulfilled").length;
function refusals(results: PromiseSettledResult<unknown>[], pattern: RegExp) {
  for (const result of results) if (result.status === "rejected") expect(String(result.reason)).toMatch(pattern);
}
type State = FunctionReturnType<typeof internal.concurrencyFixtures.inspect>;
function consistent(s: State) {
  for (const tool of s.tools) {
    const loans = s.loans.filter((l) => l.toolId === tool._id);
    const active = loans.filter((l) => l.status === "approved");
    expect(active.length).toBeLessThanOrEqual(1);
    if (tool.status !== "removed") expect(tool.status).toBe(active.length ? "on_loan" : "available");
    else expect(loans.filter((l) => l.status === "requested")).toHaveLength(0);
    expect(tool.listed).toBe(tool.status !== "removed");
  }
  for (const loan of s.loans) {
    expect(loan.phase).toBe(loan.status === "requested" ? "open" : loan.status === "approved" ? "active" : "closed");
    const events = s.deliveries.filter((d) => d.loanId === loan._id).map((d) => d.event);
    expect(events.filter((e) => e === "loan.requested")).toHaveLength(1);
    expect(new Set(events).size).toBe(events.length);
    if (loan.status !== "requested") expect(events).toContain(`loan.${loan.status}`);
  }
}

for (let repeat = 1; repeat <= 3; repeat++) {
  test(`ten borrowers and competing approvals (${repeat})`, async () => withRace(async (f) => {
    const requests = await contend(Array.from({ length: 10 }, (_, i) => {
      const client = f.client(`borrower${i}`);
      return () => client.mutation(api.loans.request, { toolId: f.toolIds[0], ...f.dates });
    }));
    expect(successes(requests), requests.flatMap((r) => r.status === "rejected" ? [String(r.reason)] : []).join("\n")).toBe(10);
    const before = await f.inspect();
    expect(before.loans).toHaveLength(10);
    expect(before.loans.every((l) => l.status === "requested")).toBe(true);
    const approvals = await contend(before.loans.map((loan) => {
      const owner = f.client("owner");
      return () => owner.mutation(api.loans.approve, { loanId: loan._id });
    }));
    expect(successes(approvals)).toBe(1);
    refusals(approvals, /already lent out/);
    const state = await f.inspect();
    expect(state.loans.filter((l) => l.status === "requested")).toHaveLength(9);
    expect(state.deliveries.filter((d) => d.event === "loan.approved")).toHaveLength(1);
    consistent(state);
  }));
  test(`duplicate requests from one borrower (${repeat})`, async () => withRace(async (f) => {
    const result = await contend(Array.from({ length: 10 }, () => {
      const client = f.client("borrower0");
      return () => client.mutation(api.loans.request, { toolId: f.toolIds[0], ...f.dates });
    }));
    expect(successes(result)).toBe(1);
    refusals(result, /already have an open request/);
    const state = await f.inspect();
    expect(state.loans).toHaveLength(1);
    consistent(state);
  }));
}

for (const opposing of ["cancel", "decline", "approve"] as const) {
  test(`approval versus ${opposing}`, async () => withRace(async (f) => {
    const loanId = await f.client("borrower0").mutation(api.loans.request, { toolId: f.toolIds[0], ...f.dates });
    const first = f.client("owner");
    const second = f.client(opposing === "cancel" ? "borrower0" : "owner");
    const result = await contend([
      () => first.mutation(api.loans.approve, { loanId }),
      () => second.mutation(api.loans[opposing], { loanId }),
    ]);
    expect(successes(result)).toBe(1);
    refusals(result, /not open|Only open requests/);
    const state = await f.inspect();
    expect(state.deliveries).toHaveLength(2);
    consistent(state);
  }));
}

test("duplicate returns", async () => withRace(async (f) => {
  const loanId = await f.client("borrower0").mutation(api.loans.request, { toolId: f.toolIds[0], ...f.dates });
  await f.client("owner").mutation(api.loans.approve, { loanId });
  const result = await contend(Array.from({ length: 10 }, () => {
    const owner = f.client("owner");
    return () => owner.mutation(api.loans.markReturned, { loanId });
  }));
  expect(successes(result)).toBe(1);
  refusals(result, /not active/);
  const state = await f.inspect();
  expect(state.deliveries.filter((d) => d.event === "loan.returned")).toHaveLength(1);
  consistent(state);
}));

for (const operation of ["request", "approve", "markReturned"] as const) {
  test(`removal versus ${operation}`, async () => withRace(async (f) => {
    const toolId = f.toolIds[0];
    const borrower = f.client("borrower0");
    const owner = f.client("owner");
    const admin = f.client("admin");
    const loanId = operation === "request" ? undefined : await borrower.mutation(api.loans.request, { toolId, ...f.dates });
    if (operation === "markReturned") await owner.mutation(api.loans.approve, { loanId: loanId! });
    const result = await contend<unknown>([
      () => operation === "request" ? borrower.mutation(api.loans.request, { toolId, ...f.dates }) : owner.mutation(api.loans[operation], { loanId: loanId! }),
      () => admin.mutation(api.admin.removeListing, { toolId }),
    ]);
    expect(result[1].status).toBe("fulfilled");
    if (operation === "markReturned") expect(successes(result)).toBe(2);
    refusals(result, /not found|not open/);
    let state = await f.inspect();
    expect(state.tools[0].status).toBe("removed");
    consistent(state);
    if (state.loans[0]?.status === "approved") {
      await owner.mutation(api.loans.markReturned, { loanId: state.loans[0]._id });
      state = await f.inspect();
      expect(state.tools[0].status).toBe("removed");
      consistent(state);
    }
  }));
}

test("overlapping bulk removals", async () => withRace(async (f) => {
  for (const toolId of f.toolIds) await f.client("borrower0").mutation(api.loans.request, { toolId, ...f.dates });
  const a = f.client("admin"), b = f.client("admin");
  const result = await contend([
    () => a.mutation(api.admin.removeListings, { toolIds: f.toolIds.slice(0, 2) }),
    () => b.mutation(api.admin.removeListings, { toolIds: f.toolIds.slice(1) }),
  ]);
  expect(successes(result)).toBe(2);
  const counts = result.flatMap((r) => r.status === "fulfilled" ? [r.value] : []);
  expect(counts.reduce((sum, r) => sum + r.removedCount, 0)).toBe(3);
  expect(counts.reduce((sum, r) => sum + r.skippedCount, 0)).toBe(1);
  const state = await f.inspect();
  expect(state.deliveries.filter((d) => d.event === "loan.declined")).toHaveLength(3);
  consistent(state);
}, 3));

test("concurrent listing creation cannot exceed the hourly limit", async () => withRace(async (f) => {
  const result = await contend(Array.from({ length: 10 }, (_, i) => {
    const owner = f.client("owner");
    return () => owner.mutation(api.tools.create, { name: `${f.namePrefix}new ${i}`, category: "garden", condition: "good", description: "Race fixture" });
  }));
  expect(successes(result)).toBe(2); // eight fresh fixture listings count toward the real limit
  refusals(result, /lot of listings/);
  expect((await f.inspect()).tools).toHaveLength(10);
}, 8));

test("concurrent requests cannot exceed the hourly limit", async () => withRace(async (f) => {
  for (const toolId of f.toolIds.slice(0, 18)) await f.client("borrower0").mutation(api.loans.request, { toolId, ...f.dates });
  const result = await contend(f.toolIds.slice(18).map((toolId) => {
    const borrower = f.client("borrower0");
    return () => borrower.mutation(api.loans.request, { toolId, ...f.dates });
  }));
  expect(successes(result)).toBe(2);
  refusals(result, /lot of borrow requests/);
  const state = await f.inspect();
  expect(state.loans).toHaveLength(20);
  consistent(state);
}, 28));

test("public mutation authorization still applies to impersonated actors", async () => withRace(async (f) => {
  const borrower = f.client("borrower0");
  const loanId = await borrower.mutation(api.loans.request, { toolId: f.toolIds[0], ...f.dates });
  await expect(borrower.mutation(api.loans.approve, { loanId })).rejects.toThrow(/Only the lender/);
  await expect(borrower.mutation(api.admin.removeListings, { toolIds: f.toolIds })).rejects.toThrow(/Admins only/);
  const state = await f.inspect();
  expect(state.loans[0].status).toBe("requested");
  consistent(state);
}));

test("fixture cleanup also runs when a scenario fails", async () => {
  let inspect!: () => Promise<State>;
  await expect(withRace(async (f) => {
    inspect = f.inspect;
    await f.client("borrower0").mutation(api.loans.request, { toolId: f.toolIds[0], ...f.dates });
    throw new Error("Deliberate scenario failure");
  })).rejects.toThrow("Deliberate scenario failure");
  expect(await inspect()).toEqual({ users: [], tools: [], loans: [], deliveries: [] });
});
