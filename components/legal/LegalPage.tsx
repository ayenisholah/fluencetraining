import type { ReactNode } from "react";

export function LegalPage({
  title,
  updated,
  children,
}: {
  title: string;
  updated: string;
  children: ReactNode;
}) {
  return (
    <article className="mx-auto max-w-2xl space-y-6 text-[0.95rem] leading-relaxed [&_h2]:mt-8 [&_h2]:text-lg [&_h2]:font-semibold [&_li]:ml-5 [&_li]:list-disc [&_a]:underline [&_a]:underline-offset-2">
      <header className="space-y-2">
        <h1 className="text-3xl font-semibold tracking-tight">{title}</h1>
        <p className="text-sm text-muted">Last updated {updated}</p>
        <p className="rounded-lg border border-warn bg-warn-soft p-3 text-sm text-warn">
          LendLoop is a fictional product built as a take-home assignment. This page is
          sample text showing what the live service would publish; it is not a legal
          agreement with a real company.
        </p>
      </header>
      {children}
    </article>
  );
}
