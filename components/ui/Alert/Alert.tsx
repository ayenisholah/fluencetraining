import type { ReactNode } from "react";
import { cn } from "@/lib/cn";
import { CheckIcon, WarningIcon } from "../icons";

export type AlertTone = "info" | "success" | "warning" | "danger";

const tones: Record<AlertTone, string> = {
  info: "bg-info-soft text-info",
  success: "bg-success-soft text-success",
  warning: "bg-warning-soft text-warning",
  danger: "bg-danger-soft text-danger",
};

/**
 * Inline message. Danger alerts use role="alert" so screen readers announce
 * them immediately; the others are polite status messages.
 */
export function Alert({
  tone = "info",
  title,
  children,
  className,
}: {
  tone?: AlertTone;
  title?: ReactNode;
  children?: ReactNode;
  className?: string;
}) {
  if (!title && !children) return null;
  return (
    <div
      role={tone === "danger" ? "alert" : "status"}
      className={cn("flex gap-2 rounded-sm px-4 py-3 text-body", tones[tone], className)}
    >
      <span className="mt-0.5 shrink-0">
        {tone === "success" ? <CheckIcon size={16} /> : <WarningIcon size={16} />}
      </span>
      <div>
        {title && <p className="font-semibold">{title}</p>}
        {children && <div>{children}</div>}
      </div>
    </div>
  );
}
