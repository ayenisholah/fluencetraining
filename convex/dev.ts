// Operator/testing helpers. Internal functions cannot be called from the
// browser; run them with `npx convex run dev:<name>`.
import { v } from "convex/values";
import type { Doc, Id } from "./_generated/dataModel";
import { internalMutation } from "./_generated/server";
import { todayUtc } from "./lib/dates";
import { userSearchText } from "./lib/people";
import { toolFieldErrors } from "./lib/rules";
import { toolSearchFields } from "./lib/toolRecord";
import { vLoanStatus } from "./schema";

const DAY = 86_400_000;

/** Moves an approved loan into the past so the overdue workflow picks it up. */
export const backdateLoan = internalMutation({
  args: { loanId: v.id("loans"), daysOverdue: v.optional(v.number()) },
  handler: async (ctx, { loanId, daysOverdue = 2 }) => {
    const loan = await ctx.db.get(loanId);
    if (!loan || loan.status !== "approved") throw new Error("Not an approved loan.");
    const endDate = todayUtc(Date.now() - daysOverdue * DAY);
    const startDate = todayUtc(Date.now() - (daysOverdue + 3) * DAY);
    await ctx.db.patch(loanId, { startDate, endDate });
    return { startDate, endDate };
  },
});

// ---------------------------------------------------------------------------
// Sample data and test clean-up (local/dev only).
// ---------------------------------------------------------------------------

/** Only rows created by the e2e suite carry this prefix; nothing else can be purged. */
export const TEST_PREFIX = "E2E ";

/**
 * Hard-deletes e2e test tools and everything that points at them (loans, their
 * webhook deliveries and automation events). `workflow_error` rows left by the
 * error-workflow test are removed by `errorMarkers` (each "e2e-…"), or all of
 * them in `prefix` mode. Test artifacts aren't history worth keeping, and a soft
 * delete would leave their loans in people's views.
 *
 *   npx convex run dev:purgeTestData '{"prefix":"E2E "}'
 *   npx convex run dev:purgeTestData '{"names":["E2E ladder abc"],"errorMarkers":["e2e-broken-abc"]}'
 */
export const purgeTestData = internalMutation({
  args: {
    names: v.optional(v.array(v.string())),
    prefix: v.optional(v.string()),
    errorMarkers: v.optional(v.array(v.string())),
  },
  handler: async (ctx, { names, prefix, errorMarkers = [] }) => {
    if (!names?.length && prefix === undefined) throw new Error("Pass `names` or `prefix`.");
    if (errorMarkers.some((m) => !m.startsWith("e2e-"))) throw new Error('errorMarkers must start with "e2e-".');
    if (prefix !== undefined && !prefix.startsWith(TEST_PREFIX)) {
      throw new Error(`prefix must start with "${TEST_PREFIX}".`);
    }
    if (names?.some((name) => !name.startsWith(TEST_PREFIX))) {
      throw new Error(`Only tools named "${TEST_PREFIX}…" can be purged.`);
    }
    const wanted = new Set(names ?? []);
    const tools = (await ctx.db.query("tools").collect()).filter(
      (t) => wanted.has(t.name) || (prefix !== undefined && t.name.startsWith(prefix)),
    );
    const counts = { tools: 0, loans: 0, deliveries: 0, events: 0 };
    for (const tool of tools) {
      for (const { value: status } of vLoanStatus.members) {
        const loans = await ctx.db
          .query("loans")
          .withIndex("by_tool_status", (q) => q.eq("toolId", tool._id).eq("status", status))
          .collect();
        for (const loan of loans) {
          for (const d of await ctx.db.query("webhookDeliveries").withIndex("by_loan", (q) => q.eq("loanId", loan._id)).collect()) {
            await ctx.db.delete(d._id);
            counts.deliveries++;
          }
          for (const e of await ctx.db.query("automationEvents").withIndex("by_loan", (q) => q.eq("loanId", loan._id)).collect()) {
            await ctx.db.delete(e._id);
            counts.events++;
          }
          await ctx.db.delete(loan._id);
          counts.loans++;
        }
      }
      if (tool.imageId && (await ctx.db.system.get(tool.imageId))) await ctx.storage.delete(tool.imageId);
      await ctx.db.delete(tool._id);
      counts.tools++;
    }
    // Error-workflow e2e runs leave loan-less workflow_error rows tagged "e2e-".
    // Scoped to this run's markers unless purging everything by prefix, so
    // parallel specs don't delete each other's rows mid-test.
    const markers = prefix !== undefined ? ["e2e-"] : errorMarkers;
    const errors = await ctx.db.query("automationEvents").withIndex("by_kind", (q) => q.eq("kind", "workflow_error")).collect();
    for (const e of errors) {
      if (markers.some((m) => e.detail?.includes(m))) {
        await ctx.db.delete(e._id);
        counts.events++;
      }
    }
    return counts;
  },
});

const NEIGHBOURS = [
  { slug: "priya", name: "Priya Shah" },
  { slug: "tom", name: "Tom Okafor" },
  { slug: "maria", name: "Maria Lopez" },
  { slug: "sam", name: "Sam Chen" },
] as const;

type SeedTool = {
  owner: (typeof NEIGHBOURS)[number]["slug"];
  name: string;
  category: Doc<"tools">["category"];
  condition: Doc<"tools">["condition"];
  description: string;
};

export const SEED_TOOLS: SeedTool[] = [
  { owner: "tom", name: "18V impact driver", category: "power_tools", condition: "good", description: "Two batteries and a charger. Comes with a box of hex bits." },
  { owner: "sam", name: "Random orbital sander", category: "power_tools", condition: "fair", description: "125 mm pads; a few 80 and 120 grit discs included. Dust bag works." },
  { owner: "tom", name: "Circular saw", category: "power_tools", condition: "good", description: "Corded, 190 mm blade with a guide rail. Please return the blade guard on." },
  { owner: "maria", name: "Extension ladder, 3.8 m", category: "hand_tools", condition: "good", description: "Aluminium, two sections. Reaches most first-floor gutters." },
  { owner: "tom", name: "Pipe wrench set", category: "hand_tools", condition: "fair", description: "10, 14 and 18 inch. A bit rusty but they grip." },
  { owner: "sam", name: "Stud and cable detector", category: "hand_tools", condition: "new", description: "Finds studs, pipes and live wires. Takes a 9V battery (fitted)." },
  { owner: "priya", name: "Petrol lawnmower", category: "garden", condition: "good", description: "46 cm cut with a grass box. Returned with a full tank, please." },
  { owner: "maria", name: "Garden shredder", category: "garden", condition: "fair", description: "Handles branches up to 4 cm. Loud, so weekends after 10am." },
  { owner: "priya", name: "Wheelbarrow", category: "garden", condition: "worn", description: "Solid tyre, never goes flat. Paint is mostly gone." },
  { owner: "sam", name: "Long-reach pruner", category: "garden", condition: "good", description: "Telescopic to 4 m with a saw attachment for thicker limbs." },
  { owner: "maria", name: "Stand mixer", category: "kitchen", condition: "good", description: "4.8 L bowl with whisk, paddle and dough hook." },
  { owner: "priya", name: "Pasta machine", category: "kitchen", condition: "new", description: "Hand-crank, with tagliatelle and spaghetti cutters. Wipe clean only." },
  { owner: "tom", name: "20 L stockpot", category: "kitchen", condition: "good", description: "Stainless steel with lid. Good for batch cooking or jam." },
  { owner: "sam", name: "4-person tent", category: "camping", condition: "good", description: "Pitches in about ten minutes. Pegs, poles and footprint in the bag." },
  { owner: "maria", name: "Cool box, 45 L", category: "camping", condition: "fair", description: "Keeps things cold for two days with ice packs (two included)." },
  { owner: "priya", name: "Carpet cleaner", category: "cleaning", condition: "good", description: "Upright, with an upholstery tool. Bring your own shampoo." },
  { owner: "tom", name: "Steam mop", category: "cleaning", condition: "fair", description: "Two washable pads. Fine on tiles and sealed wood." },
  { owner: "sam", name: "Sack truck", category: "other", condition: "good", description: "Folding, 150 kg load. Handy for moving day." },
  { owner: "maria", name: "Projector and screen", category: "other", condition: "good", description: "1080p projector, HDMI, and a 100 inch pull-up screen for garden films." },
  { owner: "priya", name: "Cordless hammer drill", category: "power_tools", condition: "good", description: "Includes the required accessories. Please wipe clean before returning." },
  { owner: "tom", name: "Jigsaw with blade set", category: "power_tools", condition: "good", description: "Includes the required accessories. Please wipe clean before returning." },
  { owner: "maria", name: "Belt sander", category: "power_tools", condition: "fair", description: "Includes the required accessories. Please wipe clean before returning." },
  { owner: "sam", name: "Electric planer", category: "power_tools", condition: "new", description: "Includes the required accessories. Please wipe clean before returning." },
  { owner: "priya", name: "Palm router", category: "power_tools", condition: "good", description: "Includes the required accessories. Please wipe clean before returning." },
  { owner: "tom", name: "Heat gun", category: "power_tools", condition: "good", description: "Includes the required accessories. Please wipe clean before returning." },
  { owner: "maria", name: "Rotary multitool", category: "power_tools", condition: "fair", description: "Includes the required accessories. Please wipe clean before returning." },
  { owner: "sam", name: "Cordless nail gun", category: "power_tools", condition: "new", description: "Includes the required accessories. Please wipe clean before returning." },
  { owner: "priya", name: "Angle grinder", category: "power_tools", condition: "good", description: "Includes the required accessories. Please wipe clean before returning." },
  { owner: "tom", name: "Bench drill press", category: "power_tools", condition: "good", description: "Includes the required accessories. Please wipe clean before returning." },
  { owner: "maria", name: "Oscillating multitool", category: "power_tools", condition: "fair", description: "Includes the required accessories. Please wipe clean before returning." },
  { owner: "sam", name: "Electric tile cutter", category: "power_tools", condition: "new", description: "Includes the required accessories. Please wipe clean before returning." },
  { owner: "priya", name: "Socket wrench set", category: "hand_tools", condition: "good", description: "Stored together in a carry case. Please check all pieces are returned." },
  { owner: "tom", name: "Precision screwdriver kit", category: "hand_tools", condition: "good", description: "Stored together in a carry case. Please check all pieces are returned." },
  { owner: "maria", name: "Claw hammer", category: "hand_tools", condition: "fair", description: "Stored together in a carry case. Please check all pieces are returned." },
  { owner: "sam", name: "Rubber mallet", category: "hand_tools", condition: "new", description: "Stored together in a carry case. Please check all pieces are returned." },
  { owner: "priya", name: "Wood chisel set", category: "hand_tools", condition: "good", description: "Stored together in a carry case. Please check all pieces are returned." },
  { owner: "tom", name: "Hand plane", category: "hand_tools", condition: "good", description: "Stored together in a carry case. Please check all pieces are returned." },
  { owner: "maria", name: "Coping saw", category: "hand_tools", condition: "fair", description: "Stored together in a carry case. Please check all pieces are returned." },
  { owner: "sam", name: "Bolt cutters", category: "hand_tools", condition: "new", description: "Stored together in a carry case. Please check all pieces are returned." },
  { owner: "priya", name: "Rivet gun", category: "hand_tools", condition: "good", description: "Stored together in a carry case. Please check all pieces are returned." },
  { owner: "tom", name: "Adjustable spanner set", category: "hand_tools", condition: "good", description: "Stored together in a carry case. Please check all pieces are returned." },
  { owner: "maria", name: "Torque wrench", category: "hand_tools", condition: "fair", description: "Stored together in a carry case. Please check all pieces are returned." },
  { owner: "sam", name: "Woodworking clamp set", category: "hand_tools", condition: "new", description: "Stored together in a carry case. Please check all pieces are returned." },
  { owner: "priya", name: "Hedge trimmer", category: "garden", condition: "good", description: "For weekend garden jobs. Please brush off soil before returning." },
  { owner: "tom", name: "Leaf blower", category: "garden", condition: "good", description: "For weekend garden jobs. Please brush off soil before returning." },
  { owner: "maria", name: "Garden fork", category: "garden", condition: "fair", description: "For weekend garden jobs. Please brush off soil before returning." },
  { owner: "sam", name: "Border spade", category: "garden", condition: "new", description: "For weekend garden jobs. Please brush off soil before returning." },
  { owner: "priya", name: "Leaf rake", category: "garden", condition: "good", description: "For weekend garden jobs. Please brush off soil before returning." },
  { owner: "tom", name: "Lawn aerator", category: "garden", condition: "good", description: "For weekend garden jobs. Please brush off soil before returning." },
  { owner: "maria", name: "Grass seed spreader", category: "garden", condition: "fair", description: "For weekend garden jobs. Please brush off soil before returning." },
  { owner: "sam", name: "Garden hose reel", category: "garden", condition: "new", description: "For weekend garden jobs. Please brush off soil before returning." },
  { owner: "priya", name: "Secateurs", category: "garden", condition: "good", description: "For weekend garden jobs. Please brush off soil before returning." },
  { owner: "tom", name: "Post hole digger", category: "garden", condition: "good", description: "For weekend garden jobs. Please brush off soil before returning." },
  { owner: "maria", name: "Garden roller", category: "garden", condition: "fair", description: "For weekend garden jobs. Please brush off soil before returning." },
  { owner: "sam", name: "Compost sieve", category: "garden", condition: "new", description: "For weekend garden jobs. Please brush off soil before returning." },
  { owner: "priya", name: "Bread maker", category: "kitchen", condition: "good", description: "Clean and ready to use. Please wash and dry before returning." },
  { owner: "tom", name: "Food processor", category: "kitchen", condition: "good", description: "Clean and ready to use. Please wash and dry before returning." },
  { owner: "maria", name: "Ice cream maker", category: "kitchen", condition: "fair", description: "Clean and ready to use. Please wash and dry before returning." },
  { owner: "sam", name: "Slow cooker", category: "kitchen", condition: "new", description: "Clean and ready to use. Please wash and dry before returning." },
  { owner: "priya", name: "Electric griddle", category: "kitchen", condition: "good", description: "Clean and ready to use. Please wash and dry before returning." },
  { owner: "tom", name: "Waffle maker", category: "kitchen", condition: "good", description: "Clean and ready to use. Please wash and dry before returning." },
  { owner: "maria", name: "Juicer", category: "kitchen", condition: "fair", description: "Clean and ready to use. Please wash and dry before returning." },
  { owner: "sam", name: "Food dehydrator", category: "kitchen", condition: "new", description: "Clean and ready to use. Please wash and dry before returning." },
  { owner: "priya", name: "Digital kitchen scales", category: "kitchen", condition: "good", description: "Clean and ready to use. Please wash and dry before returning." },
  { owner: "tom", name: "Jam funnel set", category: "kitchen", condition: "good", description: "Clean and ready to use. Please wash and dry before returning." },
  { owner: "maria", name: "Cake decorating kit", category: "kitchen", condition: "fair", description: "Clean and ready to use. Please wash and dry before returning." },
  { owner: "sam", name: "Large roasting tray", category: "kitchen", condition: "new", description: "Clean and ready to use. Please wash and dry before returning." },
  { owner: "priya", name: "Two-person hiking tent", category: "camping", condition: "good", description: "Packed for a weekend outdoors. Please return dry with all parts." },
  { owner: "tom", name: "Sleeping bag", category: "camping", condition: "good", description: "Packed for a weekend outdoors. Please return dry with all parts." },
  { owner: "maria", name: "Self-inflating sleeping mat", category: "camping", condition: "fair", description: "Packed for a weekend outdoors. Please return dry with all parts." },
  { owner: "sam", name: "Camping stove", category: "camping", condition: "new", description: "Packed for a weekend outdoors. Please return dry with all parts." },
  { owner: "priya", name: "Folding camp table", category: "camping", condition: "good", description: "Packed for a weekend outdoors. Please return dry with all parts." },
  { owner: "tom", name: "Folding camp chair", category: "camping", condition: "good", description: "Packed for a weekend outdoors. Please return dry with all parts." },
  { owner: "maria", name: "Rechargeable lantern", category: "camping", condition: "fair", description: "Packed for a weekend outdoors. Please return dry with all parts." },
  { owner: "sam", name: "Hiking backpack", category: "camping", condition: "new", description: "Packed for a weekend outdoors. Please return dry with all parts." },
  { owner: "priya", name: "Picnic blanket", category: "camping", condition: "good", description: "Packed for a weekend outdoors. Please return dry with all parts." },
  { owner: "tom", name: "Camping kettle", category: "camping", condition: "good", description: "Packed for a weekend outdoors. Please return dry with all parts." },
  { owner: "maria", name: "Portable hammock", category: "camping", condition: "fair", description: "Packed for a weekend outdoors. Please return dry with all parts." },
  { owner: "sam", name: "Trekking poles", category: "camping", condition: "new", description: "Packed for a weekend outdoors. Please return dry with all parts." },
  { owner: "priya", name: "Pressure washer", category: "cleaning", condition: "good", description: "For household cleaning. Bring any consumables and empty after use." },
  { owner: "tom", name: "Wet and dry vacuum", category: "cleaning", condition: "good", description: "For household cleaning. Bring any consumables and empty after use." },
  { owner: "maria", name: "Window cleaning pole", category: "cleaning", condition: "fair", description: "For household cleaning. Bring any consumables and empty after use." },
  { owner: "sam", name: "Handheld steam cleaner", category: "cleaning", condition: "new", description: "For household cleaning. Bring any consumables and empty after use." },
  { owner: "priya", name: "Upholstery spot cleaner", category: "cleaning", condition: "good", description: "For household cleaning. Bring any consumables and empty after use." },
  { owner: "tom", name: "Floor polishing machine", category: "cleaning", condition: "good", description: "For household cleaning. Bring any consumables and empty after use." },
  { owner: "maria", name: "Drain auger", category: "cleaning", condition: "fair", description: "For household cleaning. Bring any consumables and empty after use." },
  { owner: "sam", name: "Gutter cleaning kit", category: "cleaning", condition: "new", description: "For household cleaning. Bring any consumables and empty after use." },
  { owner: "priya", name: "Car vacuum", category: "cleaning", condition: "good", description: "For household cleaning. Bring any consumables and empty after use." },
  { owner: "tom", name: "Long-handled scrubbing brush", category: "cleaning", condition: "good", description: "For household cleaning. Bring any consumables and empty after use." },
  { owner: "maria", name: "Sewing machine", category: "other", condition: "fair", description: "Available for occasional home projects. Please return with its accessories." },
  { owner: "sam", name: "Wallpaper steamer", category: "other", condition: "new", description: "Available for occasional home projects. Please return with its accessories." },
  { owner: "priya", name: "Digital luggage scales", category: "other", condition: "good", description: "Available for occasional home projects. Please return with its accessories." },
  { owner: "tom", name: "Folding workbench", category: "other", condition: "good", description: "Available for occasional home projects. Please return with its accessories." },
  { owner: "maria", name: "Furniture moving dollies", category: "other", condition: "fair", description: "Available for occasional home projects. Please return with its accessories." },
  { owner: "sam", name: "Cable reel", category: "other", condition: "new", description: "Available for occasional home projects. Please return with its accessories." },
  { owner: "priya", name: "Laser distance meter", category: "other", condition: "good", description: "Available for occasional home projects. Please return with its accessories." },
  { owner: "tom", name: "Metal detector", category: "other", condition: "good", description: "Available for occasional home projects. Please return with its accessories." },
  { owner: "maria", name: "Bike repair stand", category: "other", condition: "fair", description: "Available for occasional home projects. Please return with its accessories." },
  { owner: "sam", name: "Bicycle track pump", category: "other", condition: "new", description: "Available for occasional home projects. Please return with its accessories." },
  { owner: "priya", name: "Portable gazebo", category: "other", condition: "good", description: "Available for occasional home projects. Please return with its accessories." },
];

/**
 * Idempotent sample catalogue: four neighbours (role "user", Mailpit-only
 * addresses) and their tools. Safe to re-run; existing rows are left alone.
 *
 *   npx convex run dev:seedNeighbourhood
 */
export const seedNeighbourhood = internalMutation({
  args: {},
  handler: async (ctx) => {
    const ids = {} as Record<(typeof NEIGHBOURS)[number]["slug"], Id<"users">>;
    let users = 0;
    for (const n of NEIGHBOURS) {
      const tokenIdentifier = `seed|${n.slug}`;
      const existing = await ctx.db.query("users").withIndex("by_token", (q) => q.eq("tokenIdentifier", tokenIdentifier)).unique();
      if (existing) {
        ids[n.slug] = existing._id;
        continue;
      }
      ids[n.slug] = await ctx.db.insert("users", {
        tokenIdentifier,
        name: n.name,
        email: `${n.slug}@lendloop.local`,
        role: "user",
        trustedLender: false,
        searchText: userSearchText(n.name, `${n.slug}@lendloop.local`),
      });
      users++;
    }
    const existingNames = new Map<Id<"users">, Set<string>>();
    for (const ownerId of Object.values(ids)) {
      const mine = await ctx.db.query("tools").withIndex("by_owner", (q) => q.eq("ownerId", ownerId)).collect();
      existingNames.set(ownerId, new Set(mine.map((tool) => tool.name)));
    }
    let tools = 0;
    for (const tool of SEED_TOOLS) {
      const ownerId = ids[tool.owner];
      if (existingNames.get(ownerId)!.has(tool.name)) continue;
      const errors = toolFieldErrors(tool);
      if (errors.name || errors.description) throw new Error(`Bad seed tool ${tool.name}: ${JSON.stringify(errors)}`);
      const fields = {
        name: tool.name,
        category: tool.category,
        condition: tool.condition,
        description: tool.description,
        status: "available" as const,
      };
      await ctx.db.insert("tools", { ownerId, ...fields, ...toolSearchFields(fields) });
      tools++;
    }
    return { users, tools };
  },
});
