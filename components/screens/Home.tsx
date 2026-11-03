"use client";

import { SignInButton } from "@clerk/nextjs";
import { Authenticated, Unauthenticated, useQuery } from "convex/react";
import Link from "next/link";
import { Badge, Button, buttonVariants, Card, EmptyState, ToolIcon } from "@/components/ui";
import { api } from "@/convex/_generated/api";
import { categoryLabel } from "@/lib/format";

const steps = [
  { title: "List what you own", body: "Add the tools gathering dust: name, condition, anything borrowers should know." },
  { title: "Request for dates", body: "Neighbours ask to borrow for up to 30 days. You approve or decline." },
  { title: "Get reminders", body: "Everyone gets an email when something changes, and borrowers are nudged when a loan is overdue." },
];

export function HomeScreen() {
  const tools = useQuery(api.tools.listPublic);
  return (
    <div className="space-y-14">
      <section className="space-y-5 pt-4">
        <Badge tone="brand">Neighbourhood tool library</Badge>
        <h1 className="max-w-2xl text-h4 text-fg sm:text-h1">Borrow what you need. Lend what you don&apos;t.</h1>
        <p className="max-w-xl text-subtitle font-normal tracking-normal leading-relaxed text-fg-muted">
          LendLoop is a neighbourhood board for the drills, ladders and tents that spend most of the year in a cupboard.
        </p>
        {/* Fixed-height slot: the button appears once auth resolves, without shifting the page. */}
        <div className="min-h-14">
          <Unauthenticated>
            <SignInButton mode="modal">
              <Button size="lg">Sign in to lend or borrow</Button>
            </SignInButton>
          </Unauthenticated>
          <Authenticated>
            <Link href="/tools" className={buttonVariants({ size: "lg" })}>
              Browse tools
            </Link>
          </Authenticated>
        </div>
      </section>

      <section aria-labelledby="available">
        <h2 id="available" className="mb-4 text-h7 text-fg">Available now</h2>
        {tools === undefined ? (
          <ul aria-busy="true" aria-label="Loading tools" className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {[0, 1, 2].map((i) => (
              <li key={i} className="h-[68px] animate-pulse rounded-md border border-line bg-surface" />
            ))}
          </ul>
        ) : tools.length === 0 ? (
          <EmptyState icon={<ToolIcon />} title="No tools listed yet" description="Be the first to lend something." />
        ) : (
          <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {tools.map((tool) => (
              <Card as="li" key={tool._id} className="flex items-center justify-between gap-3">
                <span className="text-body-bold text-fg">{tool.name}</span>
                <Badge>{categoryLabel(tool.category)}</Badge>
              </Card>
            ))}
          </ul>
        )}
      </section>

      <section aria-labelledby="how" className="grid gap-3 sm:grid-cols-3">
        <h2 id="how" className="sr-only">How it works</h2>
        {steps.map((step, i) => (
          <Card key={step.title}>
            <p className="text-description font-semibold text-brand-fg">Step {i + 1}</p>
            <h3 className="mt-1 text-subtitle-semibold text-fg">{step.title}</h3>
            <p className="mt-2 text-body text-fg-muted">{step.body}</p>
          </Card>
        ))}
      </section>
    </div>
  );
}
