import type { ComponentType } from "react";
import { BellIcon, BoxIcon, CalendarIcon, type IconProps } from "@/components/ui";

const STEPS: { title: string; body: string; Icon: ComponentType<IconProps> }[] = [
  { title: "List what you own", body: "Name, condition and a photo of the tools gathering dust.", Icon: BoxIcon },
  { title: "Ask for dates", body: "Neighbours request up to 30 days; you approve or decline.", Icon: CalendarIcon },
  {
    title: "Get notified and reminded",
    body: "Emails on every change, and a nudge when a loan is overdue.",
    Icon: BellIcon,
  },
];

/** Three connected steps: side by side with a joining line on wider screens, a vertical rail on phones. */
export function HowItWorks() {
  return (
    <section aria-labelledby="how" className="rounded-lg border border-line bg-surface px-5 py-6 sm:px-8 sm:py-8">
      <h2 id="how" className="text-h7 text-fg">
        How it works
      </h2>
      <ol className="relative mt-6 grid gap-6 sm:grid-cols-3 sm:gap-8">
        {/* Connector: vertical on phones, horizontal through the number circles on sm+. */}
        <span
          aria-hidden
          className="absolute top-2 bottom-2 left-5 w-px bg-line sm:top-5 sm:right-[16.66%] sm:bottom-auto sm:left-[16.66%] sm:h-px sm:w-auto"
        />
        {STEPS.map(({ title, body, Icon }, i) => (
          <li key={title} className="relative flex gap-4 sm:flex-col sm:items-center sm:text-center">
            <span className="relative z-10 flex size-10 shrink-0 items-center justify-center rounded-full bg-brand text-button-label text-on-brand ring-4 ring-surface">
              {i + 1}
            </span>
            <div className="min-w-0">
              <p className="flex items-center gap-2 text-subtitle-semibold text-fg sm:justify-center">
                <Icon size={18} className="text-brand-fg" />
                {title}
              </p>
              <p className="mt-1 text-body text-fg-muted">{body}</p>
            </div>
          </li>
        ))}
      </ol>
    </section>
  );
}
