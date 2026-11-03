import type { ReactNode } from "react";
import { cn } from "@/lib/cn";
import { Card } from "../Card/Card";
import { ArrowDownIcon, ArrowUpIcon } from "../icons";

export type StatDelta = {
  /** e.g. "+5.4%" or "3 this week" */
  value: string;
  direction: "up" | "down" | "flat";
  /** Whether "up" is good (green) or bad (red). Defaults to up = good. */
  upIsGood?: boolean;
};

export type StatWidgetProps = {
  label: ReactNode;
  value: ReactNode;
  icon?: ReactNode;
  delta?: StatDelta;
  /** Optional chart or extra content under the number. */
  children?: ReactNode;
  className?: string;
};

export function deltaTone({ direction, upIsGood = true }: StatDelta): "success" | "danger" | "neutral" {
  if (direction === "flat") return "neutral";
  return (direction === "up") === upIsGood ? "success" : "danger";
}

/** Figma "Widgets": small label, big number, change indicator, optional chart. */
export function StatWidget({ label, value, icon, delta, children, className }: StatWidgetProps) {
  const tone = delta ? deltaTone(delta) : "neutral";
  return (
    <Card className={cn("flex flex-col gap-3", className)}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-body text-fg-muted">{label}</p>
          <p className="mt-1 text-h5 text-fg">{value}</p>
          {delta && (
            <p
              className={cn(
                "mt-1 inline-flex items-center gap-0.5 text-description font-medium",
                tone === "success" && "text-success",
                tone === "danger" && "text-danger",
                tone === "neutral" && "text-fg-muted",
              )}
            >
              {delta.direction === "up" && <ArrowUpIcon size={14} />}
              {delta.direction === "down" && <ArrowDownIcon size={14} />}
              <span>{delta.value}</span>
            </p>
          )}
        </div>
        {icon && (
          <span className="flex size-12 shrink-0 items-center justify-center rounded-full bg-surface-sunken text-brand-fg">
            {icon}
          </span>
        )}
      </div>
      {children}
    </Card>
  );
}
