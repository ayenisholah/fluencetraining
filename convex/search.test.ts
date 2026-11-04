import { describe, expect, test } from "vitest";
import { api, internal } from "./_generated/api";
import { ALL, isoDay, setup, signIn, type T } from "./test.setup";

const tool = (
  name: string,
  extra: Partial<{ category: "garden" | "power_tools" | "camping"; description: string }> = {},
) => ({
  name,
  category: extra.category ?? ("power_tools" as const),
  condition: "good" as const,
  description: extra.description ?? "",
});

async function pageAll<T>(fetch: (pageNumber: number) => Promise<{ page: T[]; totalPages: number }>) {
  const all: T[] = [];
  let pageNumber = 1;
  for (;;) {
    const r = await fetch(pageNumber);
    all.push(...r.page);
    if (pageNumber >= r.totalPages) return all;
    pageNumber++;
  }
}

async function board(t: T) {
  const ada = await signIn(t, "Ada Lovelace", { email: "ada@example.com" });
  const bob = await signIn(t, "Bob Builder", { email: "bob@example.com" });
  const drill = await ada.as.mutation(api.tools.create, tool("Cordless drill", { description: "18V hammer" }));
  await ada.as.mutation(api.tools.create, tool("Leaf rake", { category: "garden" }));
  await bob.as.mutation(api.tools.create, tool("Hedge trimmer", { category: "garden", description: "cordless" }));
  const tent = await bob.as.mutation(api.tools.create, tool("Tent", { category: "camping" }));
  return { ada, bob, drill, tent };
}

describe("board search, filters and pagination (tools.list)", () => {
  test("search matches name and description, combined with category and availability", async () => {
    const t = setup();
    const { ada, bob, drill } = await board(t);
    const names = async (args: Record<string, unknown>) =>
      (await bob.as.query(api.tools.list, { ...ALL, ...args })).page.map((r) => r.name).sort();
    expect(await names({ search: "cordless" })).toEqual(["Cordless drill", "Hedge trimmer"]);
    expect(await names({ search: "cordless", category: "garden" })).toEqual(["Hedge trimmer"]);
    // Put the drill on loan: it stays on the board but not under "Available only".
    const loanId = await bob.as.mutation(api.loans.request, {
      toolId: drill,
      startDate: isoDay(1),
      endDate: isoDay(2),
    });
    await ada.as.mutation(api.loans.approve, { loanId });
    expect(await names({ search: "cordless" })).toEqual(["Cordless drill", "Hedge trimmer"]);
    expect(await names({ search: "cordless", availableOnly: true })).toEqual(["Hedge trimmer"]);
    expect(await names({ availableOnly: true })).toEqual(["Hedge trimmer", "Leaf rake", "Tent"]);
  });

  test("removed tools never appear, even when searched for", async () => {
    const t = setup();
    const { bob, tent } = await board(t);
    await bob.as.mutation(api.tools.remove, { toolId: tent });
    expect((await bob.as.query(api.tools.list, { ...ALL, search: "tent" })).page).toEqual([]);
    expect((await bob.as.query(api.tools.list, ALL)).page.map((r) => r.name)).not.toContain("Tent");
  });

  test("pages are disjoint and cover everything, newest first", async () => {
    const t = setup();
    await board(t);
    const bob = await signIn(t, "Viewer");
    const names = await pageAll((pageNumber) => bob.as.query(api.tools.list, { pageNumber, pageSize: 10 }));
    expect(names.map((r) => r.name)).toEqual(["Tent", "Hedge trimmer", "Leaf rake", "Cordless drill"]);
  });

  test("renaming a tool updates what search finds", async () => {
    const t = setup();
    const { ada, bob, drill } = await board(t);
    await ada.as.mutation(api.tools.update, { toolId: drill, ...tool("Impact driver") });
    expect((await bob.as.query(api.tools.list, { ...ALL, search: "drill" })).page).toEqual([]);
    expect((await bob.as.query(api.tools.list, { ...ALL, search: "impact" })).page.map((r) => r.name)).toEqual([
      "Impact driver",
    ]);
  });

  test("search text is trimmed and capped", async () => {
    const t = setup();
    const { bob } = await board(t);
    expect((await bob.as.query(api.tools.list, { ...ALL, search: "   rake   " })).page.map((r) => r.name)).toEqual([
      "Leaf rake",
    ]);
    await expect(bob.as.query(api.tools.list, { ...ALL, search: "x".repeat(10_000) })).resolves.toBeDefined();
  });
});

describe("My listings search (tools.mine)", () => {
  test("only the caller's tools, searchable and by status", async () => {
    const t = setup();
    const { ada, bob, drill } = await board(t);
    expect((await ada.as.query(api.tools.mine, { ...ALL, search: "trimmer" })).page).toEqual([]); // Bob's, not Ada's
    expect((await ada.as.query(api.tools.mine, { ...ALL, search: "rake" })).page.map((r) => r.name)).toEqual([
      "Leaf rake",
    ]);
    const loanId = await bob.as.mutation(api.loans.request, {
      toolId: drill,
      startDate: isoDay(1),
      endDate: isoDay(2),
    });
    await ada.as.mutation(api.loans.approve, { loanId });
    expect((await ada.as.query(api.tools.mine, { ...ALL, status: "on_loan" })).page.map((r) => r.name)).toEqual([
      "Cordless drill",
    ]);
    expect((await ada.as.query(api.tools.mine, { ...ALL, status: "available" })).page.map((r) => r.name)).toEqual([
      "Leaf rake",
    ]);
  });
});

describe("loan lists: search by tool name and phase tabs", () => {
  async function loans(t: T) {
    const { ada, bob, drill, tent } = await board(t);
    const eve = await signIn(t, "Eve");
    const open = await bob.as.mutation(api.loans.request, { toolId: drill, startDate: isoDay(1), endDate: isoDay(2) });
    const rake = (await ada.as.query(api.tools.mine, { ...ALL, search: "rake" })).page[0]._id;
    const active = await bob.as.mutation(api.loans.request, { toolId: rake, startDate: isoDay(1), endDate: isoDay(2) });
    await ada.as.mutation(api.loans.approve, { loanId: active });
    const closed = await eve.as.mutation(api.loans.request, { toolId: tent, startDate: isoDay(1), endDate: isoDay(2) });
    await eve.as.mutation(api.loans.cancel, { loanId: closed });
    return { ada, bob, eve, open, active, closed };
  }

  test("phases follow the loan through its life", async () => {
    const t = setup();
    const { ada, bob } = await loans(t);
    const phase = async (p: "open" | "active" | "closed") =>
      (await ada.as.query(api.loans.incoming, { ...ALL, phase: p })).page.map((l) => l.toolName);
    expect(await phase("open")).toEqual(["Cordless drill"]);
    expect(await phase("active")).toEqual(["Leaf rake"]);
    expect(await phase("closed")).toEqual([]);
    expect((await bob.as.query(api.loans.myRequests, { ...ALL, phase: "open" })).page.map((l) => l.toolName)).toEqual([
      "Cordless drill",
    ]);
  });

  test("search is scoped to the caller: nobody finds someone else's loans", async () => {
    const t = setup();
    const { ada, bob, eve } = await loans(t);
    expect((await ada.as.query(api.loans.incoming, { ...ALL, search: "drill" })).page.map((l) => l.toolName)).toEqual([
      "Cordless drill",
    ]);
    expect((await eve.as.query(api.loans.incoming, { ...ALL, search: "drill" })).page).toEqual([]);
    expect((await eve.as.query(api.loans.myRequests, { ...ALL, search: "drill" })).page).toEqual([]);
    expect((await bob.as.query(api.loans.incoming, { ...ALL, search: "tent" })).page.map((l) => l.toolName)).toEqual([
      "Tent",
    ]);
  });

  test("admin sees all loans, searchable and by phase; renamed tools stay findable", async () => {
    const t = setup();
    const { ada } = await loans(t);
    const admin = await signIn(t, "Root", { role: "admin" });
    expect((await admin.as.query(api.admin.allLoans, ALL)).page).toHaveLength(3);
    expect((await admin.as.query(api.admin.allLoans, { ...ALL, phase: "closed" })).page.map((l) => l.toolName)).toEqual(
      ["Tent"],
    );
    const rake = (await ada.as.query(api.tools.mine, { ...ALL, search: "rake" })).page[0]._id;
    await ada.as.mutation(api.tools.update, { toolId: rake, ...tool("Garden rake", { category: "garden" }) });
    expect(
      (await admin.as.query(api.admin.allLoans, { ...ALL, search: "garden rake" })).page.map((l) => l.toolName),
    ).toEqual(["Garden rake"]);
  });

  test("the sidebar count is the caller's open incoming requests", async () => {
    const t = setup();
    const { ada, bob, eve } = await loans(t);
    expect(await ada.as.query(api.loans.pendingIncomingCount, {})).toBe(1);
    expect(await bob.as.query(api.loans.pendingIncomingCount, {})).toBe(0);
    expect(await eve.as.query(api.loans.pendingIncomingCount, {})).toBe(0);
  });
});

describe("admin search", () => {
  test("members by name or email, filtered to admins or trusted lenders", async () => {
    const t = setup();
    const admin = await signIn(t, "Root Admin", { role: "admin" });
    const { ada } = await board(t);
    await t.mutation(internal.migrations.backfillSearch, {}); // signIn() inserts users without searchText
    await admin.as.mutation(api.admin.setTrustedLender, { userId: ada.id, trusted: true });
    const names = async (args: Record<string, unknown>) =>
      (await admin.as.query(api.admin.users, { ...ALL, ...args })).page.map((u) => u.name).sort();
    expect(await names({ search: "bob@example" })).toEqual(["Bob Builder"]);
    expect(await names({ search: "lovelace" })).toEqual(["Ada Lovelace"]);
    expect(await names({ filter: "trusted" })).toEqual(["Ada Lovelace"]);
    expect(await names({ filter: "admins" })).toEqual(["Root Admin"]);
  });

  test("listings by name and category, with owner and photo URL fields", async () => {
    const t = setup();
    const admin = await signIn(t, "Root", { role: "admin" });
    await board(t);
    const rows = (await admin.as.query(api.admin.listings, { ...ALL, category: "garden" })).page;
    expect(rows.map((r) => r.name).sort()).toEqual(["Hedge trimmer", "Leaf rake"]);
    expect(rows[0]).toEqual(expect.objectContaining({ ownerName: expect.any(String), imageUrl: null }));
    expect((await admin.as.query(api.admin.listings, { ...ALL, search: "hammer" })).page.map((r) => r.name)).toEqual([
      "Cordless drill",
    ]);
  });
});

describe("migrations:backfillSearch", () => {
  test("fills derived fields on old rows and is idempotent", async () => {
    const t = setup();
    const ada = await signIn(t, "Ada", { email: "ada@example.com" });
    const { toolId, loanId } = await t.run(async (ctx) => {
      // Rows as they were before the derived fields existed.
      const toolId = await ctx.db.insert("tools", { ownerId: ada.id, ...tool("Old ladder"), status: "available" });
      const loanId = await ctx.db.insert("loans", {
        toolId,
        borrowerId: ada.id,
        lenderId: ada.id,
        startDate: isoDay(1),
        endDate: isoDay(2),
        status: "returned",
      });
      return { toolId, loanId };
    });
    const first = await t.mutation(internal.migrations.backfillSearch, {});
    expect(first.patched).toBeGreaterThanOrEqual(3);
    expect(await t.mutation(internal.migrations.backfillSearch, {})).toEqual({ patched: 0, done: true });
    const [toolRow, loanRow] = await t.run((ctx) => Promise.all([ctx.db.get(toolId), ctx.db.get(loanId)]));
    expect(toolRow).toMatchObject({ searchText: "Old ladder", listed: true });
    expect(loanRow).toMatchObject({ phase: "closed", toolName: "Old ladder" });
    const viewer = await signIn(t, "Viewer");
    expect((await viewer.as.query(api.tools.list, { ...ALL, search: "ladder" })).page.map((r) => r.name)).toEqual([
      "Old ladder",
    ]);
  });
});
