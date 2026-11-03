"use client";

import { UserButton } from "@clerk/nextjs";
import { useQuery } from "convex/react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import {
  BoxIcon,
  DropdownMenu,
  InboxIcon,
  MenuIcon,
  SendIcon,
  ShieldIcon,
  SidebarItem,
  Spinner,
  ThemeToggle,
  ToolIcon,
} from "@/components/ui";
import { api } from "@/convex/_generated/api";
import { appNav, isActive, type NavIcon } from "@/lib/nav";
import { Footer } from "./Footer";
import { Logo } from "./Logo";

const icons: Record<NavIcon, ReactNode> = {
  tools: <ToolIcon />,
  listings: <BoxIcon />,
  requests: <SendIcon />,
  incoming: <InboxIcon />,
  admin: <ShieldIcon />,
};

/** Signed-in layout: Frox-style sidebar on desktop, menu button on mobile. */
export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const me = useQuery(api.users.me);
  // Pages call queries that need the user's row. On a first sign-in that row
  // is created by users.store just after auth reaches Convex, so wait for it
  // instead of letting those queries throw.
  const ready = Boolean(me);
  const incoming = useQuery(api.loans.incoming, ready ? {} : "skip");
  const pending = incoming?.filter((l) => l.status === "requested").length ?? 0;
  const links = appNav(me?.role);
  const current = links.find((l) => isActive(pathname, l.href));

  return (
    <div className="flex min-h-full">
      <aside className="sticky top-0 hidden h-dvh w-64 shrink-0 flex-col border-r border-line bg-surface px-4 py-6 lg:flex">
        <div className="px-3">
          <Logo href="/tools" />
        </div>
        <nav aria-label="Main" className="mt-8 flex flex-col gap-1">
          {links.map((link) => (
            <SidebarItem
              key={link.href}
              href={link.href}
              icon={icons[link.icon]}
              label={link.label}
              active={isActive(pathname, link.href)}
              count={link.icon === "incoming" ? pending : undefined}
            />
          ))}
        </nav>
        <div className="mt-auto px-3">
          <ThemeToggle />
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex items-center gap-3 border-b border-line bg-surface/95 px-4 py-3 backdrop-blur lg:px-8">
          <div className="lg:hidden">
            <DropdownMenu
              triggerLabel="Open navigation"
              align="start"
              trigger={<span className="flex size-10 items-center justify-center rounded-pill border border-line text-fg"><MenuIcon size={20} /></span>}
              linkComponent={Link as never}
              items={links.map((link) => ({
                key: link.href,
                label: link.label,
                icon: icons[link.icon],
                href: link.href,
                active: isActive(pathname, link.href),
              }))}
            />
          </div>
          <div className="lg:hidden">
            <Logo href="/tools" />
          </div>
          <p className="hidden text-subtitle-semibold text-fg lg:block">{current?.label}</p>
          <div className="ml-auto flex items-center gap-3">
            <ThemeToggle className="lg:hidden" />
            <UserButton />
          </div>
        </header>
        <main className="w-full flex-1 px-4 py-8 lg:px-8">
          {ready ? children : <Spinner label="Setting up your account…" />}
        </main>
        <Footer className="px-4 lg:px-8" />
      </div>
    </div>
  );
}
