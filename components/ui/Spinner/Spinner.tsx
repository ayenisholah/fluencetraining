import { cn } from "@/lib/cn";

/**
 * Loading indicator. With a `label` it's a polite live region; pass
 * `label={null}` when the surrounding control already says it's busy.
 */
export function Spinner({
  size = 20,
  label = "Loading…",
  className,
}: {
  size?: number;
  label?: string | null;
  className?: string;
}) {
  const svg = (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
      className={cn("animate-spin", className)}
    >
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeOpacity="0.25" strokeWidth="3" />
      <path d="M21 12a9 9 0 0 0-9-9" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
    </svg>
  );
  if (label === null) return svg;
  return (
    <span role="status" className="inline-flex items-center gap-2 text-body text-fg-muted">
      {svg}
      <span>{label}</span>
    </span>
  );
}
