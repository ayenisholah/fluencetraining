"use client";

import { SignInButton } from "@clerk/nextjs";
import { Authenticated, Unauthenticated } from "convex/react";
import Link from "next/link";
import { useState } from "react";
import { CategoryBadge } from "@/components/CategoryBadge";
import { CategoryChips } from "@/components/CategoryChips";
import { HowItWorks } from "@/components/HowItWorks";
import { Badge, Button, buttonVariants, Card, EmptyState, Pagination, SearchField, ToolIcon } from "@/components/ui";
import { api } from "@/convex/_generated/api";
import { useNumberedPage } from "@/lib/useNumberedPage";
import { CATEGORY_STYLES, type Category } from "@/lib/categories";
import { AFTER_SIGN_IN } from "@/lib/nav";
import { useDebouncedValue } from "@/lib/useDebouncedValue";
import { useUrlState } from "@/lib/useUrlState";

export function HomeScreen() {
  const [url, setUrl] = useUrlState(["q", "category"] as const);
  const [search, setSearch] = useState(url.q);
  const term = useDebouncedValue(search.trim());
  const category = url.category in CATEGORY_STYLES ? (url.category as Category) : "";
  const { results: tools, status, pagination } = useNumberedPage(
    api.tools.listPublic,
    { search: term || undefined, category: category || undefined },
  );

  return (
    <div className="space-y-10">
      <section className="space-y-5 pt-4">
        <Badge tone="brand">Neighbourhood tool library</Badge>
        <h1 className="max-w-2xl text-h4 text-fg sm:text-h1">Borrow what you need. Lend what you don&apos;t.</h1>
        <p className="max-w-xl text-subtitle font-normal tracking-normal leading-relaxed text-fg-muted">
          LendLoop is a neighbourhood board for the drills, ladders and tents that spend most of the year in a cupboard.
        </p>
        {/* Fixed-height slot: the button appears once auth resolves, without shifting the page. */}
        <div className="min-h-14">
          <Unauthenticated>
            <SignInButton mode="modal" forceRedirectUrl={AFTER_SIGN_IN} signUpForceRedirectUrl={AFTER_SIGN_IN}>
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

      <HowItWorks />

      <section aria-labelledby="available" className="space-y-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <h2 id="available" className="text-h7 text-fg">Available now</h2>
          <SearchField
            label="Search available tools"
            placeholder="Search tools"
            value={search}
            onChange={(value) => {
              setSearch(value);
              setUrl({ q: value.trim() });
            }}
            className="sm:w-80"
          />
        </div>
        <CategoryChips value={category} onChange={(c) => setUrl({ category: c })} />
        {status === "LoadingFirstPage" ? (
          <ul aria-busy="true" aria-label="Loading tools" className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {[0, 1, 2].map((i) => (
              <li key={i} className="h-[68px] animate-pulse rounded-md border border-line bg-surface" />
            ))}
          </ul>
        ) : tools.length === 0 ? (
          <EmptyState
            icon={<ToolIcon />}
            title={term || category ? "No available tools match" : "No tools listed yet"}
            description={term || category ? "Try another search or category." : "Be the first to lend something."}
          />
        ) : (
          <>
            <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {tools.map((tool) => (
                <Card as="li" key={tool._id} className="flex items-center justify-between gap-3">
                  <span className="min-w-0 truncate text-body-bold text-fg">{tool.name}</span>
                  <CategoryBadge category={tool.category} className="shrink-0" />
                </Card>
              ))}
            </ul>
          </>
        )}
        <Pagination pagination={pagination} noun="tools" />
      </section>
    </div>
  );
}
