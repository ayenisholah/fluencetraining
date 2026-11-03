/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import schema from "./schema";

export const modules = import.meta.glob([
  "./**/*.{ts,js}",
  "!./**/*.test.ts",
  "!./**/*.d.ts",
  "!./test.setup.ts",
]);

export function setup() {
  return convexTest(schema, modules);
}

export type T = ReturnType<typeof setup>;

/** Creates a user row and returns an authenticated client for them. */
export async function signIn(
  t: T,
  name: string,
  opts: { role?: "admin" | "user"; email?: string } = {},
) {
  const tokenIdentifier = `test|${name.toLowerCase()}`;
  const id = await t.run((ctx) =>
    ctx.db.insert("users", {
      tokenIdentifier,
      name,
      email: opts.email ?? `${name.toLowerCase().replace(/\s+/g, ".")}@example.com`,
      role: opts.role ?? "user",
      trustedLender: false,
    }),
  );
  return { id, as: t.withIdentity({ tokenIdentifier, name }) };
}

export function isoDay(offsetDays: number): string {
  return new Date(Date.now() + offsetDays * 86_400_000).toISOString().slice(0, 10);
}

/** Pagination args that fetch everything in one page, for tests. */
export const ALL = { paginationOpts: { numItems: 1000, cursor: null } };
