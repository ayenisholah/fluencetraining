import type { Metadata } from "next";
import Link from "next/link";
import { Footer } from "@/components/shell/Footer";
import { SiteHeader } from "@/components/shell/SiteHeader";
import { buttonVariants } from "@/components/ui";

export const metadata: Metadata = {
  title: "Page not found",
  robots: { index: false },
};

export default function NotFound() {
  return (
    <>
      <SiteHeader />
      <main className="mx-auto w-full max-w-6xl flex-1 px-4">
        <section className="mx-auto max-w-md space-y-4 py-20 text-center">
          <p className="text-mini-description uppercase text-fg-muted">404</p>
          <h1 className="text-h4 text-fg">This page has been borrowed</h1>
          <p className="text-body text-fg-muted">
            We couldn&apos;t find what you were looking for. It may have moved, or the link might be mistyped.
          </p>
          <div className="flex justify-center gap-2">
            <Link href="/" className={buttonVariants()}>Back to home</Link>
            <Link href="/tools" className={buttonVariants({ variant: "ghost" })}>Browse tools</Link>
          </div>
        </section>
      </main>
      <Footer className="mx-auto w-full max-w-6xl px-4" />
    </>
  );
}
