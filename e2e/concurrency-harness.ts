import { randomUUID } from "node:crypto";
import { ConvexHttpClient } from "convex/browser";
import { internal } from "../convex/_generated/api";
import type { FunctionReturnType, FunctionArgs, FunctionReference } from "convex/server";

type Actor = FunctionReturnType<typeof internal.concurrencyFixtures.setup>["actors"][number];

// Operator transport accepts internal references; retain argument/result typing while
// adapting the SDK's public-only HTTP signature. This does not change server visibility.
function operatorRef<T extends FunctionReference<"query" | "mutation", "internal">>(ref: T) {
  return ref as unknown as FunctionReference<T["_type"], "public", FunctionArgs<T>, FunctionReturnType<T>>;
}
const fixtures = {
  setup: operatorRef(internal.concurrencyFixtures.setup),
  inspect: operatorRef(internal.concurrencyFixtures.inspect),
  cleanup: operatorRef(internal.concurrencyFixtures.cleanup),
};

/** Node-only admin impersonation; this tests public mutation guards, not Clerk JWT validation. */
function connection(identity?: Actor["identity"]) {
  const url = process.env.CONVEX_SELF_HOSTED_URL ?? process.env.NEXT_PUBLIC_CONVEX_URL;
  if (!url || !["127.0.0.1", "localhost", "[::1]"].includes(new URL(url).hostname))
    throw new Error("Concurrency tests require a loopback Convex deployment.");
  const key = process.env.CONVEX_SELF_HOSTED_ADMIN_KEY;
  if (!key) throw new Error("Set the local Convex admin credential in .env.local.");
  const client = new ConvexHttpClient(url, { logger: false });
  // Convex exposes this operator method at runtime but marks it internal in its public types.
  (client as ConvexHttpClient & { setAdminAuth(key: string, identity?: Actor["identity"]): void }).setAdminAuth(
    key,
    identity,
  );
  return client;
}
export async function withRace<T>(body: (fixture: Awaited<ReturnType<typeof create>>) => Promise<T>, toolCount = 1) {
  const runId = randomUUID();
  const operator = connection();
  try {
    return await body(await create(operator, runId, toolCount));
  } finally {
    await operator.mutation(fixtures.cleanup, { runId });
    const remaining = await operator.query(fixtures.inspect, { runId });
    if (Object.values(remaining).some((rows) => rows.length !== 0))
      throw new Error("Concurrency fixture cleanup left rows behind.");
  }
}
async function create(operator: ConvexHttpClient, runId: string, toolCount: number) {
  const data = await operator.mutation(fixtures.setup, { runId, toolCount });
  const client = (name: string) => {
    const actor = data.actors.find((a) => a.actor === name);
    if (!actor) throw new Error("Unknown test actor.");
    return connection(actor.identity); // independent queues, including calls for the same actor
  };
  const today = new Date();
  const date = (days: number) => new Date(today.getTime() + days * 86400000).toISOString().slice(0, 10);
  return {
    ...data,
    client,
    dates: { startDate: date(1), endDate: date(3) },
    inspect: () => operator.query(fixtures.inspect, { runId }),
  };
}
/** Prepare each operation before opening a shared start gate; never await one actor before another. */
export async function contend<T>(operations: (() => Promise<T>)[]) {
  let release!: () => void;
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  const pending = operations.map(async (operation) => {
    await gate;
    return operation();
  });
  release();
  return Promise.allSettled(pending);
}
