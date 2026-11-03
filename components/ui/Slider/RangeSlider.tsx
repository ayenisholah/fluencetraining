"use client";

import { cn } from "@/lib/cn";

export type RangeSliderProps = {
  min: number;
  max: number;
  step?: number;
  value: [number, number];
  onChange: (value: [number, number]) => void;
  label: string;
  format?: (n: number) => string;
  className?: string;
};

/** Keeps the low thumb ≤ the high thumb and both inside [min, max]. */
export function clampRange(
  next: [number, number],
  min: number,
  max: number,
  moved: 0 | 1,
): [number, number] {
  let [lo, hi] = next.map((n) => Math.min(max, Math.max(min, n))) as [number, number];
  if (lo > hi) {
    if (moved === 0) lo = hi;
    else hi = lo;
  }
  return [lo, hi];
}

const thumb =
  "pointer-events-none absolute inset-0 h-full w-full appearance-none bg-transparent outline-none [&::-webkit-slider-thumb]:pointer-events-auto [&::-webkit-slider-thumb]:size-5 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:border [&::-webkit-slider-thumb]:border-line [&::-webkit-slider-thumb]:bg-white [&::-webkit-slider-thumb]:shadow [&::-moz-range-thumb]:pointer-events-auto [&::-moz-range-thumb]:size-5 [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:border [&::-moz-range-thumb]:bg-white focus-visible:[&::-webkit-slider-thumb]:ring-4 focus-visible:[&::-webkit-slider-thumb]:ring-focus-ring";

/**
 * Two-thumb range selector (Figma "Sliders"): values above the thumbs,
 * min/max below. Built from two native range inputs, so each thumb has
 * full keyboard and screen-reader support.
 */
export function RangeSlider({
  min,
  max,
  step = 1,
  value,
  onChange,
  label,
  format = String,
  className,
}: RangeSliderProps) {
  const [lo, hi] = value;
  const pct = (n: number) => ((n - min) / (max - min || 1)) * 100;
  return (
    <div role="group" aria-label={label} className={cn("w-full pt-6", className)}>
      <div className="relative h-5">
        <div className="absolute top-1/2 right-2.5 left-2.5 h-1 -translate-y-1/2 rounded-full bg-line">
          <div
            className="absolute h-full rounded-full bg-brand"
            style={{ left: `${pct(lo)}%`, right: `${100 - pct(hi)}%` }}
          />
        </div>
        {([0, 1] as const).map((i) => (
          <span
            key={i}
            aria-hidden
            className="absolute -top-6 -translate-x-1/2 text-description text-fg-muted tabular-nums"
            style={{ left: `calc(${pct(value[i])}% * (100% - 20px) / 100% + 10px)` }}
          >
            {format(value[i])}
          </span>
        ))}
        <input
          type="range"
          aria-label={`${label}: minimum`}
          min={min}
          max={max}
          step={step}
          value={lo}
          onChange={(e) => onChange(clampRange([Number(e.target.value), hi], min, max, 0))}
          className={thumb}
        />
        <input
          type="range"
          aria-label={`${label}: maximum`}
          min={min}
          max={max}
          step={step}
          value={hi}
          onChange={(e) => onChange(clampRange([lo, Number(e.target.value)], min, max, 1))}
          className={thumb}
        />
      </div>
      <div className="mt-1 flex justify-between text-description text-fg-muted" aria-hidden>
        <span>{format(min)}</span>
        <span>{format(max)}</span>
      </div>
    </div>
  );
}
