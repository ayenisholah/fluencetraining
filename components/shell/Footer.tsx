import Link from "next/link";
import { CookieSettingsButton } from "@/components/CookieConsent";
import { cn } from "@/lib/cn";

export function Footer({ className }: { className?: string }) {
  return (
    <footer
      className={cn("flex flex-wrap items-center gap-x-5 gap-y-2 py-6 text-description text-fg-muted", className)}
    >
      <span>LendLoop is a fictional neighbourhood lending board.</span>
      <nav aria-label="Legal" className="flex flex-wrap gap-x-4 gap-y-2 sm:ml-auto">
        <Link href="/privacy" className="underline-offset-2 hover:underline">
          Privacy
        </Link>
        <Link href="/terms" className="underline-offset-2 hover:underline">
          Terms
        </Link>
        <CookieSettingsButton />
      </nav>
    </footer>
  );
}
