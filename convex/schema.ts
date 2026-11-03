import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export const categories = [
  "power_tools",
  "hand_tools",
  "garden",
  "kitchen",
  "camping",
  "cleaning",
  "other",
] as const;

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
export const vCondition = v.union(
  v.literal("new"),
  v.literal("good"),
  v.literal("fair"),
  v.literal("worn"),
);
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
  })
    .index("by_token", ["tokenIdentifier"])
    .index("by_email", ["email"]),

  tools: defineTable({
    ownerId: v.id("users"),
    name: v.string(),
    category: vCategory,
    condition: vCondition,
    description: v.string(),
    status: v.union(
      v.literal("available"),
      v.literal("on_loan"),
      v.literal("removed"),
    ),
    removedBy: v.optional(v.id("users")),
  })
    .index("by_status", ["status"])
    .index("by_category_status", ["category", "status"])
    .index("by_owner", ["ownerId"]),

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
  })
    .index("by_borrower", ["borrowerId"])
    .index("by_lender", ["lenderId"])
    .index("by_tool_status", ["toolId", "status"])
    .index("by_status_end", ["status", "endDate"]),

  // Outbox for Convex -> n8n webhooks. Stores references only; the payload is
  // built at delivery time so no personal data sits in the queue.
  webhookDeliveries: defineTable({
    loanId: v.id("loans"),
    event: vLoanEvent,
    status: v.union(
      v.literal("pending"),
      v.literal("delivered"),
      v.literal("failed"),
    ),
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
