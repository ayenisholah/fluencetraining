"use client";

import { SignInButton, UserButton } from "@clerk/nextjs";
import { Authenticated, Unauthenticated } from "convex/react";
import Link from "next/link";
import { buttonVariants, ThemeToggle } from "@/components/ui";
import { Logo } from "./Logo";

/** Header for public pages: logo, theme, and a secondary sign-in action. */
export function SiteHeader() {
  return (
    <header className="border-b border-line bg-surface">
      <div className="mx-auto flex max-w-6xl items-center gap-4 px-4 py-3">
        <Logo />
        <div className="ml-auto flex items-center gap-3">
          <ThemeToggle className="hidden sm:inline-flex" />
          <Unauthenticated>
            <SignInButton mode="modal">
              <button className={buttonVariants({ variant: "ghost", size: "sm" })}>Sign in</button>
            </SignInButton>
          </Unauthenticated>
          <Authenticated>
            <Link href="/tools" className={buttonVariants({ variant: "ghost", size: "sm" })}>
              Open app
            </Link>
            <UserButton />
          </Authenticated>
        </div>
      </div>
    </header>
  );
}
