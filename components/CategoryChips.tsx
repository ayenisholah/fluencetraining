"use client";

import { useRef, type KeyboardEvent } from "react";
import { PRESET_COLORS } from "@/components/ui";
import { CATEGORY_STYLES, type Category } from "@/lib/categories";
import { cn } from "@/lib/cn";

const ORDER = Object.keys(CATEGORY_STYLES) as Category[];

/**
 * Category filter as coloured chips: a radiogroup ("All" + each category) with
 * a roving tab stop and arrow keys. Scrolls sideways on narrow screens.
 */
export function CategoryChips({ value, onChange }: { value: Category | ""; onChange: (value: Category | "") => void }) {
  const options: (Category | "")[] = ["", ...ORDER];
  const refs = useRef<(HTMLButtonElement | null)[]>([]);
  const index = Math.max(0, options.indexOf(value));
  const onKeyDown = (e: KeyboardEvent) => {
    const step = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 }[e.key];
    const target = e.key === "Home" ? 0 : e.key === "End" ? options.length - 1 : step !== undefined ? (index + step + options.length) % options.length : -1;
    if (target < 0) return;
    e.preventDefault();
    onChange(options[target]);
    refs.current[target]?.focus();
  };
  return (
    <div role="radiogroup" aria-label="Category" onKeyDown={onKeyDown} className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1 [scrollbar-width:thin]">
      {options.map((option, i) => {
        const selected = option === value;
        const style = option ? CATEGORY_STYLES[option] : undefined;
        return (
          <button
            key={option || "all"}
            ref={(el) => {
              refs.current[i] = el;
            }}
            type="button"
            role="radio"
            aria-checked={selected}
            tabIndex={i === index ? 0 : -1}
            onClick={() => onChange(option)}
            className={cn(
              "inline-flex h-9 shrink-0 items-center gap-1.5 rounded-pill border px-3.5 text-description font-medium outline-none transition-shadow focus-visible:ring-4 focus-visible:ring-focus-ring",
              style ? PRESET_COLORS[style.color] : "bg-surface text-fg",
              selected ? "border-current ring-2 ring-current/25" : "border-transparent hover:border-line-strong",
              !style && !selected && "border-line",
            )}
          >
            {style && <style.Icon size={15} />}
            {style ? style.label : "All"}
          </button>
        );
      })}
    </div>
  );
}
