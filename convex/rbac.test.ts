import { describe, expect, test } from "vitest";
import { api } from "./_generated/api";
import { isoDay, setup, signIn, ALL } from "./test.setup";

const drill = {
  name: "Cordless drill",
  category: "power_tools" as const,
  condition: "good" as const,
  description: "18V with two batteries",
};

describe("public listing", () => {
  test("exposes only name and category", async () => {
    const t = setup();
    const ada = await signIn(t, "Ada Lovelace");
    const toolId = await ada.as.mutation(api.tools.create, drill);
    const list = (await t.query(api.tools.listPublic, { ...ALL })).page;
    expect(list).toEqual([{ _id: toolId, name: "Cordless drill", category: "power_tools" }]);
  });

  test("hides tools that are on loan", async () => {
    const t = setup();
    const ada = await signIn(t, "Ada");
    const bob = await signIn(t, "Bob");
    const toolId = await ada.as.mutation(api.tools.create, drill);
    const loanId = await bob.as.mutation(api.loans.request, {
      toolId,
      startDate: isoDay(1),
      endDate: isoDay(2),
    });
    await ada.as.mutation(api.loans.approve, { loanId });
    expect((await t.query(api.tools.listPublic, { ...ALL })).page).toEqual([]);
  });

  test("signed-out users cannot use authenticated queries", async () => {
    const t = setup();
    await expect(t.query(api.tools.list, { ...ALL })).rejects.toThrow(/Sign in/);
    await expect(t.mutation(api.tools.create, drill)).rejects.toThrow(/Sign in/);
  });
});

describe("listing ownership", () => {
  test("only the owner can edit or delete a listing", async () => {
    const t = setup();
    const ada = await signIn(t, "Ada");
    const bob = await signIn(t, "Bob");
    const toolId = await ada.as.mutation(api.tools.create, drill);
    await expect(
      bob.as.mutation(api.tools.update, { toolId, ...drill, name: "Mine now" }),
    ).rejects.toThrow(/Only the owner/);
    await expect(bob.as.mutation(api.tools.remove, { toolId })).rejects.toThrow(
      /Only the owner/,
    );
    await ada.as.mutation(api.tools.update, { toolId, ...drill, name: "Drill v2" });
    expect(((await ada.as.query(api.tools.mine, { ...ALL })).page)[0].name).toBe("Drill v2");
  });

  test("browse view does not leak lender email", async () => {
    const t = setup();
    const ada = await signIn(t, "Ada Lovelace");
    const bob = await signIn(t, "Bob");
    await ada.as.mutation(api.tools.create, drill);
    const [row] = (await bob.as.query(api.tools.list, { ...ALL })).page;
    expect(row.lenderName).toBe("Ada");
    expect(JSON.stringify(row)).not.toContain("@");
  });
});

describe("loan workflow", () => {
  async function requested() {
    const t = setup();
    const ada = await signIn(t, "Ada");
    const bob = await signIn(t, "Bob");
    const eve = await signIn(t, "Eve");
    const toolId = await ada.as.mutation(api.tools.create, drill);
    const loanId = await bob.as.mutation(api.loans.request, {
      toolId,
      startDate: isoDay(1),
      endDate: isoDay(3),
    });
    return { t, ada, bob, eve, toolId, loanId };
  }

  test("cannot borrow your own tool", async () => {
    const { ada, toolId } = await requested();
    await expect(
      ada.as.mutation(api.loans.request, {
        toolId,
        startDate: isoDay(1),
        endDate: isoDay(2),
      }),
    ).rejects.toThrow(/own tool/);
  });

  test("rejects invalid date ranges", async () => {
    const { eve, toolId } = await requested();
    for (const [startDate, endDate] of [
      [isoDay(-2), isoDay(1)],
      [isoDay(3), isoDay(1)],
      [isoDay(1), isoDay(60)],
      ["2026-02-30", "2026-03-01"],
    ]) {
      await expect(
        eve.as.mutation(api.loans.request, { toolId, startDate, endDate }),
      ).rejects.toThrow();
    }
  });

  test("only the lender can approve, decline or mark returned", async () => {
    const { ada, bob, eve, loanId } = await requested();
    for (const who of [bob, eve]) {
      await expect(who.as.mutation(api.loans.approve, { loanId })).rejects.toThrow(
        /Only the lender/,
      );
      await expect(who.as.mutation(api.loans.decline, { loanId })).rejects.toThrow(
        /Only the lender/,
      );
    }
    await ada.as.mutation(api.loans.approve, { loanId });
    await expect(bob.as.mutation(api.loans.markReturned, { loanId })).rejects.toThrow(
      /Only the lender/,
    );
    await ada.as.mutation(api.loans.markReturned, { loanId });
    const [mine] = (await bob.as.query(api.loans.myRequests, { ...ALL })).page;
    expect(mine.status).toBe("returned");
  });

  test("only the borrower can cancel their request", async () => {
    const { ada, eve, bob, loanId } = await requested();
    await expect(ada.as.mutation(api.loans.cancel, { loanId })).rejects.toThrow(
      /Only the borrower/,
    );
    await expect(eve.as.mutation(api.loans.cancel, { loanId })).rejects.toThrow(
      /Only the borrower/,
    );
    await bob.as.mutation(api.loans.cancel, { loanId });
  });

  test("approval marks the tool on loan and blocks overlapping requests", async () => {
    const { ada, eve, toolId, loanId } = await requested();
    await ada.as.mutation(api.loans.approve, { loanId });
    const [row] = (await eve.as.query(api.tools.list, { ...ALL })).page;
    expect(row.status).toBe("on_loan");
    await expect(
      eve.as.mutation(api.loans.request, {
        toolId,
        startDate: isoDay(2),
        endDate: isoDay(4),
      }),
    ).rejects.toThrow(/already lent out/);
  });

  test("every state change queues one outbox delivery", async () => {
    const { t, ada, loanId } = await requested();
    await ada.as.mutation(api.loans.approve, { loanId });
    const deliveries = await t.run((ctx) =>
      ctx.db.query("webhookDeliveries").collect(),
    );
    expect(deliveries.map((d) => d.event)).toEqual([
      "loan.requested",
      "loan.approved",
    ]);
  });
});

describe("admin", () => {
  test("non-admins cannot use admin functions", async () => {
    const t = setup();
    const ada = await signIn(t, "Ada");
    const bob = await signIn(t, "Bob");
    const toolId = await ada.as.mutation(api.tools.create, drill);
    await expect(bob.as.mutation(api.admin.removeListing, { toolId })).rejects.toThrow(
      /Admins only/,
    );
    await expect(
      bob.as.mutation(api.admin.setTrustedLender, { userId: bob.id, trusted: true }),
    ).rejects.toThrow(/Admins only/);
    await expect(bob.as.query(api.admin.allLoans, { paginationOpts: { numItems: 10, cursor: null } })).rejects.toThrow(/Admins only/);
  });

  test("admin can remove any listing and mark a trusted lender", async () => {
    const t = setup();
    const admin = await signIn(t, "Root", { role: "admin" });
    const ada = await signIn(t, "Ada");
    const bob = await signIn(t, "Bob");
    const toolId = await ada.as.mutation(api.tools.create, drill);
    const loanId = await bob.as.mutation(api.loans.request, {
      toolId,
      startDate: isoDay(1),
      endDate: isoDay(2),
    });
    await admin.as.mutation(api.admin.setTrustedLender, {
      userId: ada.id,
      trusted: true,
    });
    expect(((await bob.as.query(api.tools.list, { ...ALL })).page)[0].trustedLender).toBe(true);
    await admin.as.mutation(api.admin.removeListing, { toolId });
    expect((await t.query(api.tools.listPublic, { ...ALL })).page).toEqual([]);
    // Open requests on a removed listing are declined, not left dangling.
    const loan = await t.run((ctx) => ctx.db.get(loanId));
    expect(loan?.status).toBe("declined");
  });

  test("stats are admin-only and count open, active and overdue loans", async () => {
    const t = setup();
    const admin = await signIn(t, "Root", { role: "admin" });
    const ada = await signIn(t, "Ada");
    const bob = await signIn(t, "Bob");
    await expect(bob.as.query(api.admin.stats, {})).rejects.toThrow(/Admins only/);
    const one = await ada.as.mutation(api.tools.create, drill);
    const two = await ada.as.mutation(api.tools.create, { ...drill, name: "Saw" });
    await bob.as.mutation(api.loans.request, { toolId: one, startDate: isoDay(1), endDate: isoDay(2) });
    const active = await bob.as.mutation(api.loans.request, { toolId: two, startDate: isoDay(1), endDate: isoDay(2) });
    await ada.as.mutation(api.loans.approve, { loanId: active });
    await t.run((ctx) => ctx.db.patch(active, { startDate: isoDay(-4), endDate: isoDay(-1) }));
    expect(await admin.as.query(api.admin.stats, {})).toEqual({
      openRequests: 1,
      activeLoans: 1,
      overdueLoans: 1,
      failedDeliveries: 0,
    });
  });

  test("new users always start as role user", async () => {
    const t = setup();
    const as = t.withIdentity({ tokenIdentifier: "x|new", name: "New", email: "n@e.com" });
    await as.mutation(api.users.store, {});
    expect((await as.query(api.users.me, {}))?.role).toBe("user");
  });
});

describe("spam protection", () => {
  test("limits listings per user per hour", async () => {
    const t = setup();
    const ada = await signIn(t, "Ada");
    const bob = await signIn(t, "Bob");
    for (let i = 0; i < 10; i++) {
      await ada.as.mutation(api.tools.create, { ...drill, name: `Drill ${i}` });
    }
    await expect(ada.as.mutation(api.tools.create, drill)).rejects.toThrow(
      /a lot of listings/,
    );
    // Other users are unaffected.
    await bob.as.mutation(api.tools.create, drill);
  });

  test("deleting listings does not reset the limit", async () => {
    const t = setup();
    const ada = await signIn(t, "Ada");
    for (let i = 0; i < 10; i++) {
      const toolId = await ada.as.mutation(api.tools.create, drill);
      await ada.as.mutation(api.tools.remove, { toolId });
    }
    await expect(ada.as.mutation(api.tools.create, drill)).rejects.toThrow(
      /a lot of listings/,
    );
  });

  test("limits borrow requests per user per hour", async () => {
    const t = setup();
    const ada = await signIn(t, "Ada");
    const bob = await signIn(t, "Bob");
    const toolIds = [];
    for (let i = 0; i < 10; i++) toolIds.push(await ada.as.mutation(api.tools.create, drill));
    const eve = await signIn(t, "Eve");
    for (let i = 0; i < 10; i++) toolIds.push(await eve.as.mutation(api.tools.create, drill));
    const lender = await signIn(t, "Lee");
    const extra = await lender.as.mutation(api.tools.create, drill);
    for (const toolId of toolIds) {
      await bob.as.mutation(api.loans.request, { toolId, startDate: isoDay(1), endDate: isoDay(2) });
    }
    await expect(
      bob.as.mutation(api.loans.request, { toolId: extra, startDate: isoDay(1), endDate: isoDay(2) }),
    ).rejects.toThrow(/a lot of borrow requests/);
  });
});
