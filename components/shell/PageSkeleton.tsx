import { Spinner } from "@/components/ui";

const block = "rounded-md bg-surface-sunken motion-safe:animate-pulse";

/**
 * Placeholder for a signed-in page while the user's record loads: the shape of
 * a page header, toolbar and card grid, so the layout doesn't jump when the
 * real page arrives. On a first sign-in (`settingUp`) it also says why there's
 * a wait; otherwise the status is for screen readers only.
 */
export function PageSkeleton({ settingUp = false }: { settingUp?: boolean }) {
  return (
    <div aria-busy="true" className="flex flex-col gap-6">
      {settingUp ? (
        <Spinner label="Setting up your account…" />
      ) : (
        <span role="status" className="sr-only">
          Loading…
        </span>
      )}
      <div aria-hidden="true" className="flex flex-col gap-6">
        <div className="flex flex-col gap-2">
          <div className={`${block} h-8 w-56`} />
          <div className={`${block} h-4 w-80 max-w-full`} />
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <div className={`${block} h-11 w-full max-w-md`} />
          <div className={`${block} h-9 w-24 rounded-pill`} />
          <div className={`${block} h-9 w-24 rounded-pill`} />
          <div className={`${block} h-9 w-24 rounded-pill`} />
        </div>
        <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 6 }, (_, i) => (
            <li key={i} className="h-48 rounded-lg border border-line bg-surface p-4">
              <div className={`${block} h-24 w-full`} />
              <div className={`${block} mt-4 h-4 w-2/3`} />
              <div className={`${block} mt-2 h-4 w-1/3`} />
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
