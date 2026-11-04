import { describe, expect, test } from "vitest";
import { api } from "./_generated/api";
import { toolSearchFields } from "./lib/toolRecord";
import { isoDay, setup, signIn, ALL } from "./test.setup";

const tool = (name: string, category: "power_tools" | "garden" | "camping" = "power_tools") => ({
  name,
  category,
  condition: "good" as const,
  description: "Private detail only signed-in users see",
});

describe("tools.listPublic (landing page)", () => {
  test("works with no identity at all", async () => {
    const t = setup();
    expect((await t.query(api.tools.listPublic, { ...ALL })).page).toEqual([]);
  });

  test("returns exactly id, name and category: no owner, condition or description", async () => {
    const t = setup();
    const ada = await signIn(t, "Ada Lovelace", { email: "ada@example.com" });
    await ada.as.mutation(api.tools.create, tool("Drill"));
    await ada.as.mutation(api.tools.create, tool("Rake", "garden"));
    const rows = (await t.query(api.tools.listPublic, { ...ALL })).page;
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
    const rows = (await t.query(api.tools.listPublic, { ...ALL })).page;
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
    expect((await t.query(api.tools.listPublic, { ...ALL })).page).toHaveLength(1);
    await ada.as.mutation(api.loans.approve, { loanId });
    expect((await t.query(api.tools.listPublic, { ...ALL })).page).toEqual([]);
    await ada.as.mutation(api.loans.markReturned, { loanId });
    expect((await t.query(api.tools.listPublic, { ...ALL })).page.map((r) => r.name)).toEqual(["Drill"]);
  });

  test("removed tools are gone; edits show up", async () => {
    const t = setup();
    const ada = await signIn(t, "Ada");
    const drill = await ada.as.mutation(api.tools.create, tool("Drill"));
    const rake = await ada.as.mutation(api.tools.create, tool("Rake", "garden"));
    await ada.as.mutation(api.tools.remove, { toolId: drill });
    await ada.as.mutation(api.tools.update, { toolId: rake, ...tool("Leaf rake", "garden") });
    expect((await t.query(api.tools.listPublic, { ...ALL })).page).toEqual([
      { _id: rake, name: "Leaf rake", category: "garden" },
    ]);
  });

  test("pages through every available tool without repeats", async () => {
    const t = setup();
    const ada = await signIn(t, "Ada");
    // Inserted directly: 30 listings would trip the per-hour listing limit.
    await t.run(async (ctx) => {
      for (let i = 0; i < 30; i++) {
        const fields = { ...tool(`Tool ${i}`), status: "available" as const };
        await ctx.db.insert("tools", { ownerId: ada.id, ...fields, ...toolSearchFields(fields) });
      }
    });
    const seen: string[] = [];
    let pageNumber = 1;
    for (;;) {
      const result: { page: { name: string }[]; totalPages: number } = await t.query(api.tools.listPublic, {
        pageNumber,
        pageSize: 10,
      });
      seen.push(...result.page.map((r) => r.name));
      if (pageNumber >= result.totalPages) break;
      pageNumber++;
    }
    expect(seen).toHaveLength(30);
    expect(new Set(seen).size).toBe(30);
    expect(seen[0]).toBe("Tool 29");
  });

  test("search and category narrow the public list, still name and category only", async () => {
    const t = setup();
    const ada = await signIn(t, "Ada");
    await ada.as.mutation(api.tools.create, { ...tool("Cordless drill"), description: "18V hammer drill" });
    await ada.as.mutation(api.tools.create, tool("Leaf rake", "garden"));
    await ada.as.mutation(api.tools.create, { ...tool("Garden shears", "garden"), description: "sharp" });
    const names = async (args: Record<string, unknown>) =>
      (await t.query(api.tools.listPublic, { ...ALL, ...args })).page.map((r) => r.name).sort();
    expect(await names({ search: "drill" })).toEqual(["Cordless drill"]);
    // Descriptions are for signed-in users: a word only in the description must
    // not find the tool publicly, or a signed-out caller could probe for it.
    expect(await names({ search: "hammer" })).toEqual([]);
    expect(await names({ search: "18V" })).toEqual([]);
    expect(await names({ category: "garden" })).toEqual(["Garden shears", "Leaf rake"]);
    expect(await names({ search: "garden", category: "garden" })).toEqual(["Garden shears"]);
    expect(await names({ search: "   " })).toHaveLength(3); // blank search = no search
    const [row] = (await t.query(api.tools.listPublic, { ...ALL, search: "drill" })).page;
    expect(Object.keys(row).sort()).toEqual(["_id", "category", "name"]);
  });
});
