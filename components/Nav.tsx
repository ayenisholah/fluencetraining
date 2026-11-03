"use client";

import { SignInButton, UserButton } from "@clerk/nextjs";
import { Authenticated, Unauthenticated, useQuery } from "convex/react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { api } from "@/convex/_generated/api";

const links = [
  { href: "/tools", label: "All tools" },
  { href: "/listings", label: "My listings" },
  { href: "/requests", label: "My requests" },
  { href: "/incoming", label: "Incoming" },
];

function AppLinks() {
  const pathname = usePathname();
  const me = useQuery(api.users.me);
  const all = me?.role === "admin" ? [...links, { href: "/admin", label: "Admin" }] : links;
  return (
    <nav className="flex flex-wrap gap-1 text-sm" aria-label="Main">
      {all.map((link) => {
        const active = pathname.startsWith(link.href);
        return (
          <Link
            key={link.href}
            href={link.href}
            aria-current={active ? "page" : undefined}
            className={`rounded-md px-2.5 py-1.5 ${
              active ? "bg-accent-soft font-medium text-accent" : "text-muted hover:text-foreground"
            }`}
          >
            {link.label}
          </Link>
        );
      })}
    </nav>
  );
}

export function Nav() {
  return (
    <header className="border-b border-border bg-surface">
      <div className="mx-auto flex max-w-5xl flex-wrap items-center gap-x-6 gap-y-2 px-4 py-3">
        <Link href="/" className="text-lg font-semibold tracking-tight">
          Lend<span className="text-accent">Loop</span>
        </Link>
        <Authenticated>
          <AppLinks />
          <div className="ml-auto">
            <UserButton />
          </div>
        </Authenticated>
        <Unauthenticated>
          <div className="ml-auto">
            <SignInButton mode="modal">
              <button className="btn-ghost">Sign in</button>
            </SignInButton>
          </div>
        </Unauthenticated>
      </div>
    </header>
  );
}
