"use client";

import { SignInButton } from "@clerk/nextjs";
import { Authenticated, Unauthenticated, useQuery } from "convex/react";
import Link from "next/link";
import { Badge, Empty, Loading } from "@/components/ui";
import { api } from "@/convex/_generated/api";
import { categoryLabel } from "@/lib/format";

export function HomeScreen() {
  const tools = useQuery(api.tools.listPublic);
  return (
    <div className="space-y-10">
      <section className="space-y-4 pt-6">
        <h1 className="max-w-xl text-4xl font-semibold tracking-tight sm:text-5xl">
          Borrow what you need. Lend what you don&apos;t.
        </h1>
        <p className="max-w-xl text-muted">
          LendLoop is a neighbourhood board for the drills, ladders and tents that
          spend most of the year in a cupboard.
        </p>
        <Unauthenticated>
          <SignInButton mode="modal">
            <button className="btn-primary">Sign in to lend or borrow</button>
          </SignInButton>
        </Unauthenticated>
        <Authenticated>
          <Link href="/tools" className="btn-primary">
            Browse tools
          </Link>
        </Authenticated>
      </section>

      <section>
        <h2 className="mb-3 text-sm font-medium uppercase tracking-wide text-muted">
          Available now
        </h2>
        {tools === undefined ? (
          <Loading />
        ) : tools.length === 0 ? (
          <Empty>No tools listed yet. Be the first.</Empty>
        ) : (
          <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {tools.map((tool, i) => (
              <li key={i} className="card flex items-center justify-between gap-3">
                <span className="font-medium">{tool.name}</span>
                <Badge>{categoryLabel(tool.category)}</Badge>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
