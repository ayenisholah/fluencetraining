import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Page not found",
  robots: { index: false },
};

export default function NotFound() {
  return (
    <section className="mx-auto max-w-md space-y-4 py-16 text-center">
      <p className="text-sm font-medium uppercase tracking-wide text-muted">404</p>
      <h1 className="text-3xl font-semibold tracking-tight">This page has been borrowed</h1>
      <p className="text-muted">
        We couldn&apos;t find what you were looking for. It may have moved, or the link
        might be mistyped.
      </p>
      <div className="flex justify-center gap-2">
        <Link href="/" className="btn-primary">Back to home</Link>
        <Link href="/tools" className="btn-ghost">Browse tools</Link>
      </div>
    </section>
  );
}
