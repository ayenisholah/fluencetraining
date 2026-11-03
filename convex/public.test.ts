import { describe, expect, test } from "vitest";
import { api } from "./_generated/api";
import { isoDay, setup, signIn } from "./test.setup";

const tool = (name: string, category: "power_tools" | "garden" | "camping" = "power_tools") => ({
  name,
  category,
  condition: "good" as const,
  description: "Private detail only signed-in users see",
});

describe("tools.listPublic (landing page)", () => {
  test("works with no identity at all", async () => {
    const t = setup();
    await expect(t.query(api.tools.listPublic, {})).resolves.toEqual([]);
  });

  test("returns exactly id, name and category: no owner, condition or description", async () => {
    const t = setup();
    const ada = await signIn(t, "Ada Lovelace", { email: "ada@example.com" });
    await ada.as.mutation(api.tools.create, tool("Drill"));
    await ada.as.mutation(api.tools.create, tool("Rake", "garden"));
    const rows = await t.query(api.tools.listPublic, {});
    for (const row of rows) expect(Object.keys(row).sort()).toEqual(["_id", "category", "name"]);
    const json = JSON.stringify(rows);
    for (const secret of ["Ada", "ada@example.com", ada.id, "good", "Private detail", "ownerId"]) {
      expect(json).not.toContain(secret);
    }
  });

  test("newest first, across owners", async () => {
    const t = setup();
    const ada = await signIn(t, "Ada");
    const bob = await signIn(t, "Bob");
    await ada.as.mutation(api.tools.create, tool("First"));
    await bob.as.mutation(api.tools.create, tool("Second", "camping"));
    await ada.as.mutation(api.tools.create, tool("Third", "garden"));
    const rows = await t.query(api.tools.listPublic, {});
    expect(rows.map((r) => [r.name, r.category])).toEqual([
      ["Third", "garden"],
      ["Second", "camping"],
      ["First", "power_tools"],
    ]);
  });

  test("only available tools: on-loan ones drop out and come back when returned", async () => {
    const t = setup();
    const ada = await signIn(t, "Ada");
    const bob = await signIn(t, "Bob");
    const toolId = await ada.as.mutation(api.tools.create, tool("Drill"));
    const loanId = await bob.as.mutation(api.loans.request, { toolId, startDate: isoDay(1), endDate: isoDay(2) });
    // A pending request doesn't hide it.
    expect(await t.query(api.tools.listPublic, {})).toHaveLength(1);
    await ada.as.mutation(api.loans.approve, { loanId });
    expect(await t.query(api.tools.listPublic, {})).toEqual([]);
    await ada.as.mutation(api.loans.markReturned, { loanId });
    expect((await t.query(api.tools.listPublic, {})).map((r) => r.name)).toEqual(["Drill"]);
  });

  test("removed tools are gone; edits show up", async () => {
    const t = setup();
    const ada = await signIn(t, "Ada");
    const drill = await ada.as.mutation(api.tools.create, tool("Drill"));
    const rake = await ada.as.mutation(api.tools.create, tool("Rake", "garden"));
    await ada.as.mutation(api.tools.remove, { toolId: drill });
    await ada.as.mutation(api.tools.update, { toolId: rake, ...tool("Leaf rake", "garden") });
    expect(await t.query(api.tools.listPublic, {})).toEqual([{ _id: rake, name: "Leaf rake", category: "garden" }]);
  });

  test("is capped at 100 rows", async () => {
    const t = setup();
    const ada = await signIn(t, "Ada");
    await t.run(async (ctx) => {
      for (let i = 0; i < 105; i++) {
        await ctx.db.insert("tools", { ownerId: ada.id, ...tool(`Tool ${i}`), status: "available" });
      }
    });
    const rows = await t.query(api.tools.listPublic, {});
    expect(rows).toHaveLength(100);
    expect(rows[0].name).toBe("Tool 104");
  });
});
