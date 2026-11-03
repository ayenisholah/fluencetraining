import { expect, test, vi } from "vitest";
import { api } from "./_generated/api";
import { isoDay, setup, signIn } from "./test.setup";
import * as toolFunctions from "./tools";

async function fixture() {
  const t = setup();
  const admin = await signIn(t, "Admin", { role: "admin" });
  const owner = await signIn(t, "Owner");
  const borrower = await signIn(t, "Borrower");
  const imageId = await t.run((ctx) => ctx.storage.store(new Blob(["image"], { type: "image/png" })));
  const create = (name: string, photo = false) => owner.as.mutation(api.tools.create, { name, category: "garden", condition: "good", description: "Garden tool", ...(photo ? { imageId } : {}) });
  const first = await create("Spade", true);
  const second = await create("Rake");
  const request = (toolId: typeof first) => borrower.as.mutation(api.loans.request, { toolId, startDate: isoDay(1), endDate: isoDay(2) });
  const open = await request(first);
  const active = await request(second);
  await owner.as.mutation(api.loans.approve, { loanId: active });
  return { t, admin, owner, first, second, imageId, open, active };
}

test("bulk removal preserves active loans, declines requests, deletes images and deduplicates", async () => {
  const w = await fixture();
  expect(await w.admin.as.mutation(api.admin.removeListings, { toolIds: [w.first, w.second, w.first] })).toEqual({ removedCount: 2, skippedCount: 0 });
  await w.t.run(async (ctx) => {
    expect(await ctx.db.get(w.first)).toMatchObject({ status: "removed", removedBy: w.admin.id });
    expect(await ctx.db.get(w.second)).toMatchObject({ status: "removed", removedBy: w.admin.id });
    expect(await ctx.db.get(w.open)).toMatchObject({ status: "declined" });
    expect(await ctx.db.get(w.active)).toMatchObject({ status: "approved" });
    expect(await ctx.db.system.get(w.imageId)).toBeNull();
    const events = await ctx.db.query("webhookDeliveries").collect();
    expect(events.filter((e) => e.loanId === w.open && e.event === "loan.declined")).toHaveLength(1);
  });
  await w.owner.as.mutation(api.loans.markReturned, { loanId: w.active });
  expect(await w.t.run((ctx) => ctx.db.get(w.second))).toMatchObject({ status: "removed" });
  await w.t.run((ctx) => ctx.db.delete(w.first));
  expect(await w.admin.as.mutation(api.admin.removeListings, { toolIds: [w.first, w.second] })).toEqual({ removedCount: 0, skippedCount: 2 });
});

test("batch size is validated before writes", async () => {
  const w = await fixture();
  for (const toolIds of [[], Array(101).fill(w.first)]) {
    await expect(w.admin.as.mutation(api.admin.removeListings, { toolIds })).rejects.toThrow(/between 1 and 100/);
  }
  expect(await w.t.run((ctx) => ctx.db.get(w.first))).toMatchObject({ status: "available" });
});

test("a failure after the first removal rolls back the whole batch", async () => {
  const w = await fixture();
  const original = toolFunctions.removeTool;
  const spy = vi.spyOn(toolFunctions, "removeTool").mockImplementationOnce(original).mockRejectedValueOnce(new Error("Removal failed"));
  try {
    await expect(w.admin.as.mutation(api.admin.removeListings, { toolIds: [w.first, w.second] })).rejects.toThrow("Removal failed");
    await w.t.run(async (ctx) => {
      expect(await ctx.db.get(w.first)).toMatchObject({ status: "available" });
      expect(await ctx.db.get(w.open)).toMatchObject({ status: "requested" });
      expect(await ctx.db.system.get(w.imageId)).not.toBeNull();
      expect((await ctx.db.query("webhookDeliveries").collect()).filter((e) => e.event === "loan.declined")).toHaveLength(0);
    });
  } finally { spy.mockRestore(); }
});

test("accepts a full page of 100 listings", async () => {
  const t = setup();
  const admin = await signIn(t, "Admin", { role: "admin" });
  const toolIds = await t.run(async (ctx) => {
    const ids = [];
    for (let i = 0; i < 100; i++) ids.push(await ctx.db.insert("tools", {
      name: `Garden tool ${i}`, description: "Tool", category: "garden", condition: "good", ownerId: admin.id,
      status: "available", searchText: `garden tool ${i}`, listed: true,
    }));
    return ids;
  });
  expect(await admin.as.mutation(api.admin.removeListings, { toolIds })).toEqual({ removedCount: 100, skippedCount: 0 });
});
