import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export const categories = ["power_tools", "hand_tools", "garden", "kitchen", "camping", "cleaning", "other"] as const;

export const conditions = ["new", "good", "fair", "worn"] as const;

export const vCategory = v.union(
  v.literal("power_tools"),
  v.literal("hand_tools"),
  v.literal("garden"),
  v.literal("kitchen"),
  v.literal("camping"),
  v.literal("cleaning"),
  v.literal("other"),
);
export const vCondition = v.union(v.literal("new"), v.literal("good"), v.literal("fair"), v.literal("worn"));
export const vRole = v.union(v.literal("admin"), v.literal("user"));
export const vLoanStatus = v.union(
  v.literal("requested"),
  v.literal("approved"),
  v.literal("declined"),
  v.literal("cancelled"),
  v.literal("returned"),
);
export const vLoanEvent = v.union(
  v.literal("loan.requested"),
  v.literal("loan.approved"),
  v.literal("loan.declined"),
  v.literal("loan.cancelled"),
  v.literal("loan.returned"),
);
/** Coarse loan state for list tabs (open / active / closed), derived from status. */
export const vLoanPhase = v.union(v.literal("open"), v.literal("active"), v.literal("closed"));

export const vAutomationKind = v.union(
  v.literal("request_notification"),
  v.literal("overdue_reminder"),
  v.literal("workflow_error"),
);

export default defineSchema({
  users: defineTable({
    tokenIdentifier: v.string(),
    name: v.string(),
    email: v.optional(v.string()),
    role: vRole,
    trustedLender: v.boolean(),
    // Name + email, for admin search. Optional until convex/migrations.ts has run.
    searchText: v.optional(v.string()),
  })
    .index("by_token", ["tokenIdentifier"])
    .index("by_email", ["email"])
    .index("by_role", ["role"])
    .index("by_trusted", ["trustedLender"])
    .searchIndex("search", { searchField: "searchText", filterFields: ["role", "trustedLender"] }),

  tools: defineTable({
    ownerId: v.id("users"),
    name: v.string(),
    category: vCategory,
    condition: vCondition,
    description: v.string(),
    status: v.union(v.literal("available"), v.literal("on_loan"), v.literal("removed")),
    removedBy: v.optional(v.id("users")),
    // Optional photo (Convex file storage), checked by convex/lib/images.ts.
    imageId: v.optional(v.id("_storage")),
    // Derived, kept in sync by convex/lib/toolRecord.ts. `listed` exists because
    // search-index filters can only test equality (status != "removed").
    // Optional until convex/migrations.ts has run.
    searchText: v.optional(v.string()),
    publicSearchText: v.optional(v.string()),
    listed: v.optional(v.boolean()),
  })
    .index("by_status", ["status"])
    .index("by_category_status", ["category", "status"])
    .index("by_owner", ["ownerId"])
    .index("by_owner_status", ["ownerId", "status"])
    .index("by_owner_listed", ["ownerId", "listed"])
    .index("by_listed", ["listed"])
    .index("by_listed_category", ["listed", "category"])
    .index("by_image", ["imageId"])
    .searchIndex("search", {
      searchField: "searchText",
      filterFields: ["listed", "status", "category", "ownerId"],
    })
    // Signed-out search: public fields only (see convex/lib/toolRecord.ts).
    .searchIndex("searchPublic", {
      searchField: "publicSearchText",
      filterFields: ["status", "category"],
    }),

  loans: defineTable({
    toolId: v.id("tools"),
    borrowerId: v.id("users"),
    lenderId: v.id("users"),
    // ISO calendar dates (YYYY-MM-DD), compared lexically.
    startDate: v.string(),
    endDate: v.string(),
    status: vLoanStatus,
    decidedAt: v.optional(v.number()),
    returnedAt: v.optional(v.number()),
    // Derived, kept in sync by convex/lib/loanRecord.ts: the tool's name (for
    // search) and the coarse phase (for tabs). Optional until migrated.
    toolName: v.optional(v.string()),
    phase: v.optional(vLoanPhase),
  })
    .index("by_borrower", ["borrowerId"])
    .index("by_lender", ["lenderId"])
    .index("by_borrower_phase", ["borrowerId", "phase"])
    .index("by_lender_phase", ["lenderId", "phase"])
    .index("by_phase", ["phase"])
    .index("by_tool", ["toolId"])
    .index("by_tool_status", ["toolId", "status"])
    .index("by_tool_borrower_status", ["toolId", "borrowerId", "status"])
    .index("by_status_end", ["status", "endDate"])
    .searchIndex("search", { searchField: "toolName", filterFields: ["lenderId", "borrowerId", "phase"] }),

  // Outbox for Convex -> n8n webhooks. Stores references only; the payload is
  // built at delivery time so no personal data sits in the queue.
  webhookDeliveries: defineTable({
    loanId: v.id("loans"),
    event: vLoanEvent,
    status: v.union(v.literal("pending"), v.literal("delivered"), v.literal("failed")),
    attempts: v.number(),
    lastError: v.optional(v.string()),
    nextAttemptAt: v.optional(v.number()),
    deliveredAt: v.optional(v.number()),
  })
    .index("by_status", ["status"])
    .index("by_loan", ["loanId"]),

  // Write-backs from n8n. idempotencyKey makes retries safe.
  automationEvents: defineTable({
    idempotencyKey: v.string(),
    loanId: v.optional(v.id("loans")),
    kind: vAutomationKind,
    status: v.union(v.literal("sent"), v.literal("failed")),
    detail: v.optional(v.string()),
    at: v.number(),
  })
    .index("by_key", ["idempotencyKey"])
    .index("by_loan", ["loanId"])
    .index("by_kind", ["kind"]),
});
