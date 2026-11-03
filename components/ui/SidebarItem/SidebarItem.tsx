import Link from "next/link";
import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

export type SidebarItemProps = {
  href: string;
  icon: ReactNode;
  label: ReactNode;
  active?: boolean;
  /** Optional count bubble, e.g. pending requests. */
  count?: number;
  className?: string;
};

/**
 * Figma "Left sidebar item": padding 17/15/17/21, radius 12, 22px icon.
 * Default grey, hover violet, active violet fill with white text.
 */
export function SidebarItem({ href, icon, label, active = false, count, className }: SidebarItemProps) {
  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={cn(
        "flex items-center gap-2.5 rounded-md py-[17px] pr-[15px] pl-[21px] text-body-bold outline-none transition-colors focus-visible:ring-4 focus-visible:ring-focus-ring [&_svg]:size-[22px]",
        active ? "bg-brand text-on-brand" : "text-fg-muted hover:text-brand-fg",
        className,
      )}
    >
      {icon}
      <span className="flex-1 truncate">{label}</span>
      {count !== undefined && count > 0 && (
        <span
          className={cn(
            "flex h-5 min-w-5 items-center justify-center rounded-pill px-1.5 text-description font-semibold",
            active ? "bg-white text-brand-fg" : "bg-brand-soft text-brand-fg",
          )}
        >
          {count}
        </span>
      )}
    </Link>
  );
}
