import { describe, expect, test } from "vitest";
import { api } from "./_generated/api";
import { isoDay, setup, signIn, ALL } from "./test.setup";

const drill = {
  name: "Cordless drill",
  category: "power_tools" as const,
  condition: "good" as const,
  description: "18V with two batteries",
};
const rake = { ...drill, name: "Leaf rake", category: "garden" as const, condition: "worn" as const };

async function lenderAndBorrower() {
  const t = setup();
  const ada = await signIn(t, "Ada Lovelace");
  const bob = await signIn(t, "Bob Builder");
  const eve = await signIn(t, "Eve");
  const toolId = await ada.as.mutation(api.tools.create, drill);
  return { t, ada, bob, eve, toolId };
}

describe("listing a tool", () => {
  test("stores all four fields, trimmed, as available", async () => {
    const t = setup();
    const ada = await signIn(t, "Ada");
    const toolId = await ada.as.mutation(api.tools.create, {
      ...drill,
      name: "  Cordless drill  ",
      description: "  18V  ",
    });
    const tool = await t.run((ctx) => ctx.db.get(toolId));
    expect(tool).toMatchObject({
      name: "Cordless drill",
      category: "power_tools",
      condition: "good",
      description: "18V",
      status: "available",
      ownerId: ada.id,
    });
  });

  test("rejects a too-short name and an over-long description", async () => {
    const t = setup();
    const ada = await signIn(t, "Ada");
    await expect(ada.as.mutation(api.tools.create, { ...drill, name: " x " })).rejects.toThrow(/name/);
    await expect(
      ada.as.mutation(api.tools.create, { ...drill, description: "a".repeat(501) }),
    ).rejects.toThrow(/description/);
  });

  test("the server refuses control and bidi characters even if the form is bypassed", async () => {
    const t = setup();
    const ada = await signIn(t, "Ada");
    await expect(ada.as.mutation(api.tools.create, { ...drill, name: "Drill\r\nBcc: x@evil.example" })).rejects.toThrow(/plain text/);
    await expect(ada.as.mutation(api.tools.create, { ...drill, description: "fine\u202Eenif" })).rejects.toThrow(/plain text/);
    const toolId = await ada.as.mutation(api.tools.create, drill);
    await expect(ada.as.mutation(api.tools.update, { toolId, ...drill, name: "Drill\u0000" })).rejects.toThrow(/plain text/);
  });

  test("rejects unknown categories and conditions", async () => {
    const t = setup();
    const ada = await signIn(t, "Ada");
    await expect(
      // @ts-expect-error: not a category
      ada.as.mutation(api.tools.create, { ...drill, category: "weapons" }),
    ).rejects.toThrow();
    await expect(
      // @ts-expect-error: not a condition
      ada.as.mutation(api.tools.create, { ...drill, condition: "mint" }),
    ).rejects.toThrow();
  });

  test("editing validates the same way", async () => {
    const { ada, toolId } = await lenderAndBorrower();
    await expect(ada.as.mutation(api.tools.update, { toolId, ...drill, name: "" })).rejects.toThrow(/name/);
    await ada.as.mutation(api.tools.update, { toolId, ...drill, condition: "fair" });
    expect(((await ada.as.query(api.tools.mine, { ...ALL })).page)[0].condition).toBe("fair");
  });
});

describe("browsing tools", () => {
  test("shows availability, filters by category and flags my own tools", async () => {
    const { ada, bob, toolId } = await lenderAndBorrower();
    await bob.as.mutation(api.tools.create, rake);
    const loanId = await bob.as.mutation(api.loans.request, { toolId, startDate: isoDay(1), endDate: isoDay(2) });
    await ada.as.mutation(api.loans.approve, { loanId });

    const all = (await bob.as.query(api.tools.list, { ...ALL })).page;
    expect(all.map((t) => [t.name, t.status, t.isMine])).toEqual([
      ["Leaf rake", "available", true],
      ["Cordless drill", "on_loan", false],
    ]);
    const garden = (await bob.as.query(api.tools.list, { ...ALL, category: "garden" })).page;
    expect(garden.map((t) => t.name)).toEqual(["Leaf rake"]);
    const power = (await bob.as.query(api.tools.list, { ...ALL, category: "power_tools" })).page;
    expect(power.map((t) => t.name)).toEqual(["Cordless drill"]);
    expect((await bob.as.query(api.tools.list, { ...ALL, category: "kitchen" })).page).toEqual([]);
  });

  test("removed tools disappear from browse and from My listings", async () => {
    const { ada, bob, toolId } = await lenderAndBorrower();
    await ada.as.mutation(api.tools.create, rake);
    await ada.as.mutation(api.tools.remove, { toolId });
    expect(((await bob.as.query(api.tools.list, { ...ALL })).page).map((t) => t.name)).toEqual(["Leaf rake"]);
    expect(((await ada.as.query(api.tools.mine, { ...ALL })).page).map((t) => t.name)).toEqual(["Leaf rake"]);
  });

  test("My listings only shows the caller's tools", async () => {
    const { bob } = await lenderAndBorrower();
    expect((await bob.as.query(api.tools.mine, { ...ALL })).page).toEqual([]);
  });

  test("a tool on loan cannot be removed", async () => {
    const { ada, bob, toolId } = await lenderAndBorrower();
    const loanId = await bob.as.mutation(api.loans.request, { toolId, startDate: isoDay(1), endDate: isoDay(2) });
    await ada.as.mutation(api.loans.approve, { loanId });
    await expect(ada.as.mutation(api.tools.remove, { toolId })).rejects.toThrow(/on loan/);
  });
});

describe("requesting to borrow", () => {
  test("a second open request for the same tool is rejected", async () => {
    const { bob, toolId } = await lenderAndBorrower();
    await bob.as.mutation(api.loans.request, { toolId, startDate: isoDay(1), endDate: isoDay(2) });
    await expect(
      bob.as.mutation(api.loans.request, { toolId, startDate: isoDay(5), endDate: isoDay(6) }),
    ).rejects.toThrow(/already have an open request/);
  });

  test("removed tools cannot be requested", async () => {
    const { ada, bob, toolId } = await lenderAndBorrower();
    await ada.as.mutation(api.tools.remove, { toolId });
    await expect(
      bob.as.mutation(api.loans.request, { toolId, startDate: isoDay(1), endDate: isoDay(2) }),
    ).rejects.toThrow(/not found/);
  });

  test("an on-loan tool can be requested for later, non-overlapping dates", async () => {
    const { ada, bob, eve, toolId } = await lenderAndBorrower();
    const loanId = await bob.as.mutation(api.loans.request, { toolId, startDate: isoDay(1), endDate: isoDay(3) });
    await ada.as.mutation(api.loans.approve, { loanId });
    await expect(
      eve.as.mutation(api.loans.request, { toolId, startDate: isoDay(4), endDate: isoDay(6) }),
    ).resolves.toBeDefined();
  });

  test("a one-day loan and a 30-day loan are both allowed", async () => {
    const { bob, eve, toolId } = await lenderAndBorrower();
    await expect(
      bob.as.mutation(api.loans.request, { toolId, startDate: isoDay(0), endDate: isoDay(0) }),
    ).resolves.toBeDefined();
    await expect(
      eve.as.mutation(api.loans.request, { toolId, startDate: isoDay(1), endDate: isoDay(31) }),
    ).resolves.toBeDefined();
  });
});

describe("approving, declining and returning", () => {
  async function requested() {
    const ctx = await lenderAndBorrower();
    const loanId = await ctx.bob.as.mutation(api.loans.request, {
      toolId: ctx.toolId,
      startDate: isoDay(1),
      endDate: isoDay(3),
    });
    return { ...ctx, loanId };
  }

  test("declining closes the request and leaves the tool available", async () => {
    const { ada, bob, loanId } = await requested();
    await ada.as.mutation(api.loans.decline, { loanId });
    const [mine] = (await bob.as.query(api.loans.myRequests, { ...ALL })).page;
    expect(mine.status).toBe("declined");
    expect(((await bob.as.query(api.tools.list, { ...ALL })).page)[0].status).toBe("available");
    await expect(ada.as.mutation(api.loans.decline, { loanId })).rejects.toThrow(/not open/);
    await expect(ada.as.mutation(api.loans.approve, { loanId })).rejects.toThrow(/not open/);
  });

  test("a cancelled request can't be approved", async () => {
    const { ada, bob, loanId } = await requested();
    await bob.as.mutation(api.loans.cancel, { loanId });
    await expect(ada.as.mutation(api.loans.approve, { loanId })).rejects.toThrow(/not open/);
    await expect(bob.as.mutation(api.loans.cancel, { loanId })).rejects.toThrow(/Only open requests/);
  });

  test("a second request can't be approved while the tool is lent out", async () => {
    const { ada, eve, toolId, loanId } = await requested();
    const later = await eve.as.mutation(api.loans.request, { toolId, startDate: isoDay(5), endDate: isoDay(6) });
    await ada.as.mutation(api.loans.approve, { loanId });
    await expect(ada.as.mutation(api.loans.approve, { loanId: later })).rejects.toThrow(/Mark it returned first/);
    await ada.as.mutation(api.loans.markReturned, { loanId });
    await ada.as.mutation(api.loans.approve, { loanId: later });
  });

  test("a request whose dates have passed can't be approved", async () => {
    const { t, ada, bob, toolId } = await lenderAndBorrower();
    const loanId = await t.run((ctx) =>
      ctx.db.insert("loans", {
        toolId,
        borrowerId: bob.id,
        lenderId: ada.id,
        startDate: isoDay(-5),
        endDate: isoDay(-2),
        status: "requested",
      }),
    );
    await expect(ada.as.mutation(api.loans.approve, { loanId })).rejects.toThrow(/dates have passed/);
    await ada.as.mutation(api.loans.decline, { loanId });
  });

  test("marking returned frees the tool; only active loans can be returned", async () => {
    const { ada, bob, loanId } = await requested();
    await expect(ada.as.mutation(api.loans.markReturned, { loanId })).rejects.toThrow(/not active/);
    await ada.as.mutation(api.loans.approve, { loanId });
    await ada.as.mutation(api.loans.markReturned, { loanId });
    expect(((await bob.as.query(api.tools.list, { ...ALL })).page)[0].status).toBe("available");
    await expect(ada.as.mutation(api.loans.markReturned, { loanId })).rejects.toThrow(/not active/);
  });
});

describe("My requests and Incoming requests", () => {
  test("each side sees only their own loans, with the other party's first name", async () => {
    const { ada, bob, eve, toolId } = await lenderAndBorrower();
    await bob.as.mutation(api.loans.request, { toolId, startDate: isoDay(1), endDate: isoDay(2) });

    const incoming = (await ada.as.query(api.loans.incoming, { ...ALL })).page;
    expect(incoming).toHaveLength(1);
    expect(incoming[0]).toMatchObject({ toolName: "Cordless drill", status: "requested", counterpartName: "Bob" });
    expect(JSON.stringify(incoming)).not.toContain("@");

    const requests = (await bob.as.query(api.loans.myRequests, { ...ALL })).page;
    expect(requests[0]).toMatchObject({ toolName: "Cordless drill", counterpartName: "Ada" });
    expect(requests[0]).not.toHaveProperty("lenderName");

    expect((await ada.as.query(api.loans.myRequests, { ...ALL })).page).toEqual([]);
    expect((await bob.as.query(api.loans.incoming, { ...ALL })).page).toEqual([]);
    expect((await eve.as.query(api.loans.incoming, { ...ALL })).page).toEqual([]);
    expect((await eve.as.query(api.loans.myRequests, { ...ALL })).page).toEqual([]);
  });

  test("signed-out callers can't read the personal views or act on loans", async () => {
    const { t, bob, toolId } = await lenderAndBorrower();
    const loanId = await bob.as.mutation(api.loans.request, { toolId, startDate: isoDay(1), endDate: isoDay(2) });
    await expect(t.query(api.tools.mine, ALL)).rejects.toThrow(/Sign in/);
    await expect(t.query(api.loans.myRequests, ALL)).rejects.toThrow(/Sign in/);
    await expect(t.query(api.loans.incoming, ALL)).rejects.toThrow(/Sign in/);
    await expect(t.query(api.loans.pendingIncomingCount, {})).rejects.toThrow(/Sign in/);
    for (const m of [api.loans.approve, api.loans.decline, api.loans.markReturned, api.loans.cancel]) {
      await expect(t.mutation(m, { loanId })).rejects.toThrow(/Sign in/);
    }
    await expect(t.mutation(api.loans.request, { toolId, startDate: isoDay(3), endDate: isoDay(4) })).rejects.toThrow(/Sign in/);
  });
});
