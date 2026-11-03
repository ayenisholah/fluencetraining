import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

export function EmptyState({
  icon,
  title,
  description,
  action,
  className,
}: {
  icon?: ReactNode;
  title: ReactNode;
  description?: ReactNode;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-col items-center gap-2 rounded-md border border-dashed border-line-strong px-6 py-10 text-center",
        className,
      )}
    >
      {icon && <span className="mb-1 text-fg-subtle [&_svg]:size-8">{icon}</span>}
      <p className="text-subtitle-semibold text-fg">{title}</p>
      {description && <p className="max-w-sm text-body text-fg-muted">{description}</p>}
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}
