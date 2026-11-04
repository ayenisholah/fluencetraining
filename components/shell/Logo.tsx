import Link from "next/link";
import { Mark } from "@/lib/brand";

/** `compact` hides the wordmark below the sm breakpoint (the link keeps its name). */
export function Logo({ href = "/", compact = false }: { href?: string; compact?: boolean }) {
  return (
    <Link
      href={href}
      aria-label="LendLoop home"
      className="inline-flex items-center gap-2 rounded-sm outline-none focus-visible:ring-4 focus-visible:ring-focus-ring"
    >
      <Mark size={30} />
      <span className={compact ? "hidden text-h7 tracking-tight text-fg sm:inline" : "text-h7 tracking-tight text-fg"}>
        Lend<span className="text-brand-fg">Loop</span>
      </span>
    </Link>
  );
}
