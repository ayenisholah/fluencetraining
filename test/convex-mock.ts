import { getFunctionName, type FunctionReference } from "convex/server";
import type { ReactNode } from "react";
import { vi, type Mock } from "vitest";

/**
 * Stand-ins for convex/react in jsdom tests. Use with:
 *
 *   vi.mock("convex/react", async () => (await import("@/test/convex-mock")).convexReactMock);
 *
 * then set `queryResults["tools:list"] = [...]` and inspect `mutations["loans:approve"]`.
 */
export const queryResults: Record<string, unknown> = {};
export const queryArgs: Record<string, unknown[]> = {};
export const mutations: Record<string, Mock> = {};
/** usePaginatedQuery results by function name; `loadMore` is shared and inspectable. */
export const paginated: Record<string, { results: unknown[]; status: string }> = {};
export const loadMore = vi.fn();

function nameOf(ref: FunctionReference<"query" | "mutation">): string {
  return getFunctionName(ref);
}

/** Drives <Authenticated>/<Unauthenticated>. Reset to signed out by resetConvexMock. */
export const auth = { signedIn: false };

export const convexReactMock = {
  Authenticated: ({ children }: { children: ReactNode }) => (auth.signedIn ? children : null),
  Unauthenticated: ({ children }: { children: ReactNode }) => (auth.signedIn ? null : children),
  useQuery: (ref: FunctionReference<"query">, args?: unknown) => {
    const name = nameOf(ref);
    (queryArgs[name] ??= []).push(args);
    return queryResults[name];
  },
  usePaginatedQuery: (ref: FunctionReference<"query">, args: unknown) => {
    const name = nameOf(ref);
    (queryArgs[name] ??= []).push(args);
    return { ...(paginated[name] ?? { results: [], status: "LoadingFirstPage" }), isLoading: false, loadMore };
  },
  useMutation: (ref: FunctionReference<"mutation">) => (mutations[nameOf(ref)] ??= vi.fn().mockResolvedValue(null)),
};

export function resetConvexMock() {
  auth.signedIn = false;
  loadMore.mockReset();
  for (const store of [queryResults, queryArgs, mutations, paginated]) {
    for (const key of Object.keys(store)) delete store[key];
  }
}
