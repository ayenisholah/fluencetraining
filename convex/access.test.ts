// Role-based access control, enforced in Convex functions.
//
//   admin: remove any listing, view all loans, mark a lender as trusted.
//   user:  create/edit/delete only their own listings; act only on loans for
//          their own tools (as lender) or their own borrowing (as borrower).
import { describe, expect, test } from "vitest";
import { api } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import { isoDay, setup, signIn, type T, ALL } from "./test.setup";

const drill = {
  name: "Cordless drill",
  category: "power_tools" as const,
  condition: "good" as const,
  description: "18V",
};
const page = (numItems = 50, cursor: string | null = null) => ({ paginationOpts: { numItems, cursor } });

// ---------------------------------------------------------------------------
// Coverage guard: every public function must be listed with the guard it uses.
// A new public query/mutation fails this test until someone decides who may
// call it, which keeps "forgot the auth check" out of review.
// ---------------------------------------------------------------------------
const PUBLIC_FUNCTIONS: Record<string, "anyone" | "signed-in" | "owner" | "lender" | "borrower" | "admin"> = {
  "tools:listPublic": "anyone",
  "tools:list": "signed-in",
  "tools:mine": "signed-in",
  "tools:create": "signed-in",
  "tools:update": "owner",
  "tools:remove": "owner",
  "tools:generateUploadUrl": "signed-in",
  "loans:request": "signed-in",
  "loans:approve": "lender",
  "loans:decline": "lender",
  "loans:markReturned": "lender",
  "loans:cancel": "borrower",
  "loans:myRequests": "signed-in",
  "loans:incoming": "signed-in",
  "loans:pendingIncomingCount": "signed-in",
  "users:store": "anyone", // no-op without an identity; never sets a role
  "users:me": "anyone", // returns null when signed out
  "admin:allLoans": "admin",
  "admin:users": "admin",
  "admin:listings": "admin",
  "admin:stats": "admin",
  "admin:automationHealth": "admin",
  "admin:setTrustedLender": "admin",
  "admin:removeListing": "admin",
  "admin:retryDelivery": "admin",
};

describe("coverage guard", () => {
  test("every public Convex function is accounted for, and operator tools stay internal", async () => {
    const modules = import.meta.glob<Record<string, unknown>>(["./*.ts", "!./*.test.ts", "!./test.setup.ts", "!./schema.ts", "!./auth.config.ts"]);
    const publicNames: string[] = [];
    const internalNames: string[] = [];
    for (const [path, load] of Object.entries(modules)) {
      const mod = await load();
      const file = path.replace(/^\.\//, "").replace(/\.ts$/, "");
      for (const [name, fn] of Object.entries(mod)) {
        const f = fn as { isPublic?: boolean; isInternal?: boolean; isHttp?: boolean };
        if (f?.isPublic && !f.isHttp) publicNames.push(`${file}:${name}`);
        if (f?.isInternal) internalNames.push(`${file}:${name}`);
      }
    }
    expect(publicNames.sort()).toEqual(Object.keys(PUBLIC_FUNCTIONS).sort());
    // Role changes and test helpers must never be callable from a browser.
    expect(internalNames).toEqual(
      expect.arrayContaining([
        "users:setRole",
        "dev:backdateLoan",
        "dev:purgeTestData",
        "dev:seedNeighbourhood",
        "migrations:backfillSearch",
        "images:deleteOrphans",
      ]),
    );
  });
});

// ---------------------------------------------------------------------------
// Fixture: an owner with a listing, a borrower with an open request on it, a
// bystander user, an admin and an anonymous client.
// ---------------------------------------------------------------------------
async function world() {
  const t = setup();
  const admin = await signIn(t, "Root Admin", { role: "admin" });
  const owner = await signIn(t, "Olu Owner");
  const borrower = await signIn(t, "Bora Borrower");
  const other = await signIn(t, "Eve Other");
  const toolId = await owner.as.mutation(api.tools.create, drill);
  const loanId = await borrower.as.mutation(api.loans.request, { toolId, startDate: isoDay(1), endDate: isoDay(3) });
  return { t, admin, owner, borrower, other, anon: t, toolId, loanId };
}
type World = Awaited<ReturnType<typeof world>>;
type Caller = "anon" | "admin" | "owner" | "borrower" | "other";
const client = (w: World, who: Caller) => (who === "anon" ? w.t : w[who].as);
const status = (t: T, id: Id<"loans"> | Id<"tools">) => t.run(async (ctx) => (await ctx.db.get(id))?.status);

describe("user: listings are owner-only", () => {
  const denied: [Caller, RegExp][] = [
    ["anon", /Sign in/],
    ["borrower", /Only the owner/],
    ["other", /Only the owner/],
    // Admins moderate through admin.removeListing; they don't edit people's listings.
    ["admin", /Only the owner/],
  ];

  test.each(denied)("%s cannot edit someone else's listing", async (who, error) => {
    const w = await world();
    await expect(
      client(w, who).mutation(api.tools.update, { toolId: w.toolId, ...drill, name: "Hijacked" }),
    ).rejects.toThrow(error);
    expect(await w.t.run(async (ctx) => (await ctx.db.get(w.toolId))?.name)).toBe("Cordless drill");
  });

  test.each(denied)("%s cannot delete someone else's listing through tools.remove", async (who, error) => {
    const w = await world();
    await expect(client(w, who).mutation(api.tools.remove, { toolId: w.toolId })).rejects.toThrow(error);
    expect(await status(w.t, w.toolId)).toBe("available");
  });

  test("the owner can edit and delete their own listing", async () => {
    const w = await world();
    await w.owner.as.mutation(api.tools.update, { toolId: w.toolId, ...drill, name: "Drill v2" });
    await w.owner.as.mutation(api.tools.remove, { toolId: w.toolId });
    expect(await status(w.t, w.toolId)).toBe("removed");
  });

  test("new listings always belong to the caller; ownerId, status and role can't be smuggled in", async () => {
    const w = await world();
    for (const extra of [{ ownerId: w.other.id }, { status: "on_loan" }, { role: "admin" }]) {
      await expect(
        w.borrower.as.mutation(api.tools.create, { ...drill, ...extra } as never),
      ).rejects.toThrow(/extra field|Validator/i);
      await expect(
        w.owner.as.mutation(api.tools.update, { toolId: w.toolId, ...drill, ...extra } as never),
      ).rejects.toThrow(/extra field|Validator/i);
    }
    const id = await w.borrower.as.mutation(api.tools.create, drill);
    const tool = await w.t.run((ctx) => ctx.db.get(id));
    expect(tool).toMatchObject({ ownerId: w.borrower.id, status: "available" });
  });
});

describe("user: loans only for their own tools or their own borrowing", () => {
  const lenderActions = [
    ["approve", api.loans.approve],
    ["decline", api.loans.decline],
  ] as const;

  for (const [name, fn] of lenderActions) {
    test.each<[Caller, RegExp]>([
      ["anon", /Sign in/],
      ["borrower", /Only the lender/],
      ["other", /Only the lender/],
      ["admin", /Only the lender/],
    ])(`%s cannot ${name} a request on someone else's tool`, async (who, error) => {
      const w = await world();
      await expect(client(w, who).mutation(fn, { loanId: w.loanId })).rejects.toThrow(error);
      expect(await status(w.t, w.loanId)).toBe("requested");
    });
  }

  test.each<[Caller, RegExp]>([
    ["anon", /Sign in/],
    ["borrower", /Only the lender/],
    ["other", /Only the lender/],
    ["admin", /Only the lender/],
  ])("%s cannot mark someone else's loan returned", async (who, error) => {
    const w = await world();
    await w.owner.as.mutation(api.loans.approve, { loanId: w.loanId });
    await expect(client(w, who).mutation(api.loans.markReturned, { loanId: w.loanId })).rejects.toThrow(error);
    expect(await status(w.t, w.loanId)).toBe("approved");
  });

  test.each<[Caller, RegExp]>([
    ["anon", /Sign in/],
    ["owner", /Only the borrower/],
    ["other", /Only the borrower/],
    ["admin", /Only the borrower/],
  ])("%s cannot cancel someone else's request", async (who, error) => {
    const w = await world();
    await expect(client(w, who).mutation(api.loans.cancel, { loanId: w.loanId })).rejects.toThrow(error);
    expect(await status(w.t, w.loanId)).toBe("requested");
  });

  test("the lender approves and returns; the borrower cancels their own", async () => {
    const w = await world();
    await w.owner.as.mutation(api.loans.approve, { loanId: w.loanId });
    await w.owner.as.mutation(api.loans.markReturned, { loanId: w.loanId });
    const again = await w.borrower.as.mutation(api.loans.request, { toolId: w.toolId, startDate: isoDay(5), endDate: isoDay(6) });
    await w.borrower.as.mutation(api.loans.cancel, { loanId: again });
    expect(await status(w.t, again)).toBe("cancelled");
  });

  test("the borrower is always the caller and the lender is always the tool's owner", async () => {
    const w = await world();
    const loan = await w.t.run((ctx) => ctx.db.get(w.loanId));
    expect(loan).toMatchObject({ borrowerId: w.borrower.id, lenderId: w.owner.id });
    await expect(
      w.other.as.mutation(api.loans.request, {
        toolId: w.toolId,
        startDate: isoDay(5),
        endDate: isoDay(6),
        borrowerId: w.borrower.id,
      } as never),
    ).rejects.toThrow(/extra field|Validator/i);
  });

  test("personal views show only the caller's loans, even to an admin", async () => {
    const w = await world();
    expect((await w.other.as.query(api.loans.incoming, { ...ALL })).page).toEqual([]);
    expect((await w.other.as.query(api.loans.myRequests, { ...ALL })).page).toEqual([]);
    expect((await w.admin.as.query(api.loans.incoming, { ...ALL })).page).toEqual([]);
    expect((await w.admin.as.query(api.loans.myRequests, { ...ALL })).page).toEqual([]);
    expect((await w.owner.as.query(api.loans.incoming, { ...ALL })).page).toHaveLength(1);
    expect((await w.borrower.as.query(api.loans.myRequests, { ...ALL })).page).toHaveLength(1);
  });
});

describe("admin-only functions", () => {
  const adminCalls: [string, (w: World, who: Caller) => Promise<unknown>][] = [
    ["allLoans", (w, who) => client(w, who).query(api.admin.allLoans, page())],
    ["users", (w, who) => client(w, who).query(api.admin.users, { ...ALL })],
    ["listings", (w, who) => client(w, who).query(api.admin.listings, { ...ALL })],
    ["stats", (w, who) => client(w, who).query(api.admin.stats, {})],
    ["automationHealth", (w, who) => client(w, who).query(api.admin.automationHealth, {})],
    ["setTrustedLender", (w, who) => client(w, who).mutation(api.admin.setTrustedLender, { userId: w.owner.id, trusted: true })],
    ["removeListing", (w, who) => client(w, who).mutation(api.admin.removeListing, { toolId: w.toolId })],
    [
      "retryDelivery",
      async (w, who) => {
        const deliveryId = await w.t.run((ctx) =>
          ctx.db.insert("webhookDeliveries", { loanId: w.loanId, event: "loan.requested", status: "failed", attempts: 5 }),
        );
        return client(w, who).mutation(api.admin.retryDelivery, { deliveryId });
      },
    ],
  ];

  test.each(adminCalls)("admin.%s: anonymous → Sign in, users → Admins only, admin → ok", async (_name, call) => {
    const w = await world();
    await expect(call(w, "anon")).rejects.toThrow(/Sign in/);
    for (const who of ["owner", "borrower", "other"] as const) {
      await expect(call(w, who)).rejects.toThrow(/Admins only/);
    }
    // Nothing changed for the denied calls.
    expect(await status(w.t, w.toolId)).toBe("available");
    expect(await w.t.run(async (ctx) => (await ctx.db.get(w.owner.id))?.trustedLender)).toBe(false);
    await expect(call(w, "admin")).resolves.not.toThrow();
  });

  test("a user's trusted flag or role doesn't unlock admin functions", async () => {
    const w = await world();
    await w.admin.as.mutation(api.admin.setTrustedLender, { userId: w.owner.id, trusted: true });
    await expect(w.owner.as.query(api.admin.stats, {})).rejects.toThrow(/Admins only/);
  });
});

describe("admin abilities", () => {
  test("removes any user's listing; its open requests are declined", async () => {
    const w = await world();
    await w.admin.as.mutation(api.admin.removeListing, { toolId: w.toolId });
    const tool = await w.t.run((ctx) => ctx.db.get(w.toolId));
    expect(tool).toMatchObject({ status: "removed", removedBy: w.admin.id });
    expect(await status(w.t, w.loanId)).toBe("declined");
    expect((await w.borrower.as.query(api.tools.list, { ...ALL })).page).toEqual([]);
    expect((await w.owner.as.query(api.tools.mine, { ...ALL })).page).toEqual([]);
    await expect(w.admin.as.mutation(api.admin.removeListing, { toolId: w.toolId })).rejects.toThrow(/not found/);
  });

  test("removes a listing that is on loan; the lender can still close the loan", async () => {
    const w = await world();
    await w.owner.as.mutation(api.loans.approve, { loanId: w.loanId });
    // Owners must wait for the tool to come back...
    await expect(w.owner.as.mutation(api.tools.remove, { toolId: w.toolId })).rejects.toThrow(/on loan/);
    // ...admins can moderate immediately.
    await w.admin.as.mutation(api.admin.removeListing, { toolId: w.toolId });
    expect(await status(w.t, w.toolId)).toBe("removed");
    expect(await status(w.t, w.loanId)).toBe("approved");
    const [incoming] = (await w.owner.as.query(api.loans.incoming, { ...ALL })).page;
    expect(incoming).toMatchObject({ status: "approved", toolName: "Cordless drill" });
    await w.owner.as.mutation(api.loans.markReturned, { loanId: w.loanId });
    expect(await status(w.t, w.loanId)).toBe("returned");
    expect(await status(w.t, w.toolId)).toBe("removed");
    expect((await w.t.query(api.tools.listPublic, { ...ALL })).page).toEqual([]);
  });

  test("views all loans across users, with both parties' names, page by page", async () => {
    const w = await world();
    const first = await w.admin.as.query(api.admin.allLoans, page());
    expect(first.page).toHaveLength(1);
    expect(first.page[0]).toMatchObject({ toolName: "Cordless drill", lenderName: "Olu Owner", borrowerName: "Bora Borrower" });

    await w.t.run(async (ctx) => {
      for (let i = 0; i < 230; i++) {
        await ctx.db.insert("loans", {
          toolId: w.toolId,
          borrowerId: w.other.id,
          lenderId: w.owner.id,
          startDate: isoDay(1),
          endDate: isoDay(2),
          status: "declined",
        });
      }
    });
    const seen = new Set<string>();
    let cursor: string | null = null;
    for (;;) {
      const result: { page: { _id: string }[]; isDone: boolean; continueCursor: string } =
        await w.admin.as.query(api.admin.allLoans, page(100, cursor));
      for (const loan of result.page) seen.add(loan._id);
      if (result.isDone) break;
      cursor = result.continueCursor;
    }
    expect(seen.size).toBe(231);
  });

  test("marks and unmarks a trusted lender, shown on their listings", async () => {
    const w = await world();
    await w.admin.as.mutation(api.admin.setTrustedLender, { userId: w.owner.id, trusted: true });
    expect(((await w.borrower.as.query(api.tools.list, { ...ALL })).page)[0].trustedLender).toBe(true);
    expect(((await w.admin.as.query(api.admin.users, { ...ALL })).page).find((u) => u._id === w.owner.id)?.trustedLender).toBe(true);
    await w.admin.as.mutation(api.admin.setTrustedLender, { userId: w.owner.id, trusted: false });
    expect(((await w.borrower.as.query(api.tools.list, { ...ALL })).page)[0].trustedLender).toBe(false);
  });

  test("trusting an unknown user is a not-found error", async () => {
    const w = await world();
    const ghost = await w.t.run(async (ctx) => {
      const id = await ctx.db.insert("users", { tokenIdentifier: "x|ghost", name: "Ghost", role: "user", trustedLender: false });
      await ctx.db.delete(id);
      return id;
    });
    await expect(w.admin.as.mutation(api.admin.setTrustedLender, { userId: ghost, trusted: true })).rejects.toThrow(/not found/);
  });

  test("an admin is otherwise a normal user: can lend and borrow", async () => {
    const w = await world();
    const mine = await w.admin.as.mutation(api.tools.create, { ...drill, name: "Admin's saw" });
    const loanId = await w.other.as.mutation(api.loans.request, { toolId: mine, startDate: isoDay(1), endDate: isoDay(2) });
    await w.admin.as.mutation(api.loans.approve, { loanId });
    expect(await status(w.t, loanId)).toBe("approved");
  });
});

describe("roles can't be escalated", () => {
  test("users.store never grants admin, and keeps an existing admin's role", async () => {
    const t = setup();
    const newcomer = t.withIdentity({ tokenIdentifier: "x|new", name: "New", email: "new@example.com" });
    await newcomer.mutation(api.users.store, {});
    await newcomer.mutation(api.users.store, {});
    expect((await newcomer.query(api.users.me, {}))?.role).toBe("user");

    const admin = await signIn(t, "Root", { role: "admin" });
    await admin.as.mutation(api.users.store, {});
    expect((await admin.as.query(api.users.me, {}))?.role).toBe("admin");
  });

  test("users.store takes no arguments, so a role can't be passed in", async () => {
    const t = setup();
    const as = t.withIdentity({ tokenIdentifier: "x|sneaky", name: "Sneaky" });
    await expect(as.mutation(api.users.store, { role: "admin" } as never)).rejects.toThrow(/extra field|Validator/i);
    expect(await as.query(api.users.me, {})).toBeNull();
  });

  test("signed out, store is a no-op and me is null", async () => {
    const t = setup();
    expect(await t.mutation(api.users.store, {})).toBeNull();
    expect(await t.query(api.users.me, {})).toBeNull();
  });
});
