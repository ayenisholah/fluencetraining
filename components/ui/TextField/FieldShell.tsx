import type { ReactNode } from "react";
import { cn } from "@/lib/cn";
import { WarningIcon } from "../icons";

/** IDs for the text that a field's aria-describedby should reference. */
export function describedBy(id: string, parts: { hint?: unknown; error?: unknown; counter?: unknown }) {
  const ids = [
    parts.error ? `${id}-error` : null,
    parts.hint ? `${id}-hint` : null,
    parts.counter ? `${id}-count` : null,
  ].filter(Boolean);
  return ids.length ? ids.join(" ") : undefined;
}

// Box styling for Figma "Fields": rest, hover (4px focus border),
// focused (glow), error (red border + caption bar), disabled.
export const fieldBoxClass =
  "relative rounded-sm border border-transparent bg-field transition-[box-shadow,background-color,border-color] has-[:enabled]:hover:ring-4 has-[:enabled]:hover:ring-state-focus focus-within:border-focus-ring focus-within:bg-surface focus-within:shadow-[0_0_0_4px_var(--focus-glow)] has-[:disabled]:opacity-60";

export function FieldShell({
  id,
  hint,
  error,
  counter,
  invalid,
  bare = false,
  className,
  children,
}: {
  id: string;
  hint?: ReactNode;
  error?: ReactNode;
  counter?: { length: number; max: number };
  invalid: boolean;
  /** Render children without the filled field box (outline triggers draw their own). */
  bare?: boolean;
  className?: string;
  children: ReactNode;
}) {
  const over = counter ? counter.length > counter.max : false;
  return (
    <div className={cn("min-w-0", className)}>
      {bare ? (
        children
      ) : (
        <div
          className={cn(
            fieldBoxClass,
            invalid && "border-danger focus-within:border-danger",
            error ? "rounded-b-none" : "",
          )}
        >
          {children}
        </div>
      )}
      {error && (
        <p
          id={`${id}-error`}
          className="flex items-center gap-1.5 rounded-b-sm bg-danger-solid px-4 py-1 text-body text-white"
        >
          <WarningIcon size={16} />
          <span>{error}</span>
        </p>
      )}
      {(hint || counter) && (
        <div className="mt-1 flex items-start justify-between gap-3 text-description text-fg-muted">
          {hint ? <p id={`${id}-hint`}>{hint}</p> : <span />}
          {counter && (
            <p id={`${id}-count`} className={cn("shrink-0 tabular-nums", over && "font-semibold text-danger")}>
              {counter.length}/{counter.max}
            </p>
          )}
        </div>
      )}
    </div>
  );
}

/**
 * Figma "All Category" / "Date" field: white, 1px #E8EDF2 border, radius 8,
 * 48px tall, 15px side padding. Used by Select and DatePicker triggers.
 */
export const outlineFieldClass =
  "relative flex h-12 w-full items-center gap-[19px] rounded-sm border border-field-border bg-surface px-[15px] text-left outline-none transition-[box-shadow,border-color] enabled:hover:ring-4 enabled:hover:ring-state-focus focus-visible:border-focus-ring focus-visible:shadow-[0_0_0_4px_var(--focus-glow)] aria-expanded:border-focus-ring disabled:cursor-not-allowed disabled:opacity-60";
