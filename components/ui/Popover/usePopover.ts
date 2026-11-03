"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";

/** Card styling shared by every popover (Figma dropdowns: white card, big soft shadow). */
export const popoverCardClass =
  "absolute z-50 rounded-md border border-line bg-surface shadow-popover";

/**
 * Open/close state for a trigger + floating panel: closes on outside pointer
 * down, and decides whether the panel fits below the trigger or must flip above.
 */
export function usePopover({ estimatedHeight = 280 }: { estimatedHeight?: number } = {}) {
  const [open, setOpen] = useState(false);
  const [placement, setPlacement] = useState<"bottom" | "top">("bottom");
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  const close = useCallback((returnFocus = true) => {
    setOpen(false);
    if (returnFocus) triggerRef.current?.focus();
  }, []);

  useLayoutEffect(() => {
    if (!open || !triggerRef.current || typeof window === "undefined") return;
    const rect = triggerRef.current.getBoundingClientRect();
    const below = window.innerHeight - rect.bottom;
    // Placement depends on measured layout after opening, so it is set here.
    setPlacement(below < estimatedHeight && rect.top > below ? "top" : "bottom");
  }, [open, estimatedHeight]);

  useEffect(() => {
    if (!open) return;
    const onPointer = (e: PointerEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) close(false);
    };
    document.addEventListener("pointerdown", onPointer);
    return () => document.removeEventListener("pointerdown", onPointer);
  }, [open, close]);

  return { open, setOpen, close, placement, rootRef, triggerRef };
}
