import Link from "next/link";
import { Mark } from "@/lib/brand";

export function Logo({ href = "/" }: { href?: string }) {
  return (
    <Link href={href} className="inline-flex items-center gap-2 rounded-sm outline-none focus-visible:ring-4 focus-visible:ring-focus-ring">
      <Mark size={30} />
      <span className="text-h7 text-fg">
        Lend<span className="text-brand-fg">Loop</span>
      </span>
    </Link>
  );
}
