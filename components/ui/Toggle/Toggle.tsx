"use client";

import { useId, type ReactNode } from "react";
import { cn } from "@/lib/cn";

export type ToggleProps = {
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  /** Visible label ("Toggle + Text" variant). Without it, pass aria-label. */
  label?: ReactNode;
  "aria-label"?: string;
  size?: "md" | "sm";
  disabled?: boolean;
  className?: string;
};

/** On/off switch (Figma "Toggles"): 56×32 track, or the small inline variant. */
export function Toggle({
  checked,
  onCheckedChange,
  label,
  size = "md",
  disabled,
  className,
  ...aria
}: ToggleProps) {
  const labelId = useId();
  const md = size === "md";
  const button = (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label ? undefined : aria["aria-label"]}
      aria-labelledby={label ? labelId : undefined}
      disabled={disabled}
      onClick={() => onCheckedChange(!checked)}
      className={cn(
        "relative inline-flex shrink-0 items-center rounded-pill outline-none transition-colors focus-visible:ring-4 focus-visible:ring-focus-ring disabled:cursor-not-allowed disabled:opacity-50",
        md ? "h-8 w-14 p-1" : "h-[18px] w-8 p-0.5",
        checked ? "bg-brand" : "bg-brand-soft",
      )}
    >
      <span
        aria-hidden
        className={cn(
          "rounded-full bg-white shadow transition-transform",
          md ? "size-6" : "size-3.5",
          checked ? (md ? "translate-x-6" : "translate-x-3.5") : "translate-x-0",
        )}
      />
    </button>
  );
  if (!label) return <span className={className}>{button}</span>;
  return (
    <span className={cn("inline-flex items-center gap-2", className)}>
      {button}
      <span id={labelId} className="text-body text-fg">
        {label}
      </span>
    </span>
  );
}
