import type { HTMLAttributes, ReactNode } from "react";
import { cn } from "@/lib/cn";

export type CardProps = HTMLAttributes<HTMLDivElement> & {
  as?: "div" | "article" | "section" | "li";
  padding?: "none" | "md" | "lg";
};

/** Flat surface with a hairline border, as used by every Frox widget. */
export function Card({ as = "div", padding = "md", className, ...props }: CardProps) {
  // The tags share the same attribute set; narrow for the type checker.
  const Tag = as as "div";
  return (
    <Tag
      className={cn(
        "min-w-0 [overflow-wrap:anywhere] rounded-md border border-line bg-surface",
        padding === "md" && "p-5",
        padding === "lg" && "p-6",
        className,
      )}
      {...props}
    />
  );
}

export function CardHeader({
  title,
  description,
  actions,
  className,
}: {
  title: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("mb-4 flex flex-wrap items-start justify-between gap-3", className)}>
      <div className="min-w-0">
        <h2 className="text-subtitle-semibold text-fg">{title}</h2>
        {description && <p className="mt-1 text-description text-fg-muted">{description}</p>}
      </div>
      {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
    </div>
  );
}
