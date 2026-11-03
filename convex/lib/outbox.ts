import type { Infer } from "convex/values";
import { internal } from "../_generated/api";
import type { Id } from "../_generated/dataModel";
import type { MutationCtx } from "../_generated/server";
import type { vLoanEvent } from "../schema";

export type LoanEvent = Infer<typeof vLoanEvent>;

/**
 * Records a loan event in the outbox inside the same transaction as the state
 * change, then schedules delivery. If the mutation rolls back, no webhook is
 * sent; if delivery fails, the row stays visible to admins.
 */
export async function enqueueLoanEvent(
  ctx: MutationCtx,
  loanId: Id<"loans">,
  event: LoanEvent,
): Promise<void> {
  const deliveryId = await ctx.db.insert("webhookDeliveries", {
    loanId,
    event,
    status: "pending",
    attempts: 0,
  });
  await ctx.scheduler.runAfter(0, internal.webhooks.deliver, { deliveryId });
}
