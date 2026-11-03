// In-memory stand-in for next/navigation in jsdom: useSearchParams reads a
// shared URL, router.replace updates it and re-renders subscribers, so
// URL-backed filters behave like the real thing.
import { useSyncExternalStore } from "react";

let href = "/";
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

export const navigation = {
  /** The last URL a component navigated to. */
  get href() {
    return href;
  },
  reset(next = "/") {
    href = next;
    emit();
  },
};

const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => listeners.delete(l);
};
const snapshot = () => href;

const router = {
  replace: (next: string) => {
    href = next;
    emit();
  },
  push: (next: string) => router.replace(next),
  back: () => {},
  refresh: () => {},
  prefetch: () => Promise.resolve(),
};

export const nextNavigationMock = {
  useSearchParams: () => new URLSearchParams(useSyncExternalStore(subscribe, snapshot, snapshot).split("?")[1] ?? ""),
  usePathname: () => useSyncExternalStore(subscribe, snapshot, snapshot).split("?")[0],
  useRouter: () => router,
};
