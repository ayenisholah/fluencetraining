import type { ReactNode } from "react";

type Tone = "neutral" | "good" | "warn" | "danger";

const tones: Record<Tone, string> = {
  neutral: "bg-background text-muted border-border",
  good: "bg-accent-soft text-accent border-transparent",
  warn: "bg-warn-soft text-warn border-transparent",
  danger: "bg-danger-soft text-danger border-transparent",
};

export function Badge({ tone = "neutral", children }: { tone?: Tone; children: ReactNode }) {
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium ${tones[tone]}`}
    >
      {children}
    </span>
  );
}

export function PageHeader({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
      <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
      {children}
    </div>
  );
}

export function Empty({ children }: { children: ReactNode }) {
  return (
    <p className="rounded-xl border border-dashed border-border p-8 text-center text-sm text-muted">
      {children}
    </p>
  );
}

export function Loading() {
  return <p className="text-sm text-muted">Loading…</p>;
}

export function ErrorText({ children }: { children?: ReactNode }) {
  if (!children) return null;
  return (
    <p role="alert" className="text-sm text-danger">
      {children}
    </p>
  );
}

const loanTones: Record<string, Tone> = {
  requested: "warn",
  approved: "good",
  declined: "danger",
  cancelled: "neutral",
  returned: "neutral",
};

export function LoanStatus({ status, overdue }: { status: string; overdue?: boolean }) {
  if (overdue) return <Badge tone="danger">Overdue</Badge>;
  const label = status === "approved" ? "On loan" : status[0].toUpperCase() + status.slice(1);
  return <Badge tone={loanTones[status]}>{label}</Badge>;
}
