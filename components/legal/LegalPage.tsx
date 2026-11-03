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
    <article className="mx-auto max-w-2xl space-y-6 text-body leading-relaxed text-fg [&_a]:text-brand-fg [&_a]:underline [&_a]:underline-offset-2 [&_h2]:mt-8 [&_h2]:text-h7 [&_li]:ml-5 [&_li]:list-disc [&_p]:mt-2 [&_strong]:font-semibold [&_ul]:mt-2 [&_ul]:space-y-1">
      <header className="space-y-2">
        <h1 className="text-h4 text-fg">{title}</h1>
        <p className="text-description text-fg-muted">Last updated {updated}</p>
        <p className="rounded-sm bg-warning-soft p-3 text-body text-warning">
          LendLoop is a fictional product built as a take-home assignment. This page is
          sample text showing what the live service would publish; it is not a legal
          agreement with a real company.
        </p>
      </header>
      {children}
    </article>
  );
}
