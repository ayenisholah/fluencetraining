"use client";

import { useEffect, useId, useRef, useState, type KeyboardEvent, type ReactNode } from "react";
import {
  addDays,
  addMonths,
  clampIso,
  endOfWeek,
  formatLong,
  formatMonth,
  formatCompact,
  isOutside,
  monthGrid,
  parseIso,
  startOfWeek,
  toIso,
  weekdayLabels,
} from "@/lib/calendar";
import { cn } from "@/lib/cn";
import { todayIso } from "@/lib/format";
import { CalendarIcon, ChevronLeftIcon, ChevronRightIcon } from "../icons";
import { popoverCardClass, usePopover } from "../Popover/usePopover";
import { describedBy, FieldShell, outlineFieldClass } from "../TextField/FieldShell";

export type DatePickerProps = {
  label: string;
  /** ISO date (YYYY-MM-DD) or "" for none. */
  value: string;
  onValueChange: (value: string) => void;
  min?: string;
  max?: string;
  /** Highlight a range (e.g. a loan's From–Until) in the calendar. */
  rangeStart?: string;
  rangeEnd?: string;
  hideLabel?: boolean;
  placeholder?: string;
  hint?: ReactNode;
  error?: ReactNode;
  name?: string;
  disabled?: boolean;
  id?: string;
  className?: string;
  /** 0 = Sunday, 1 = Monday (default). */
  weekStartsOn?: number;
};

/**
 * Date field (Figma "Date": outline box, calendar icon) that opens a calendar
 * dialog. Keyboard follows the WAI-ARIA date picker dialog pattern.
 */
export function DatePicker({
  label,
  value,
  onValueChange,
  min,
  max,
  rangeStart,
  rangeEnd,
  hideLabel = false,
  placeholder = "Select a date",
  hint,
  error,
  name,
  disabled,
  id: idProp,
  className,
  weekStartsOn = 1,
}: DatePickerProps) {
  const autoId = useId();
  const id = idProp ?? autoId;
  const dialogId = `${id}-dialog`;
  const headingId = `${id}-month`;
  const { open, setOpen, close, placement, rootRef, triggerRef } = usePopover({ estimatedHeight: 360 });
  const today = todayIso();
  const hasValue = Boolean(parseIso(value));
  const [focused, setFocused] = useState(() => clampIso(hasValue ? value : today, min, max));
  const dayRefs = useRef(new Map<string, HTMLButtonElement>());
  const invalid = Boolean(error);
  const view = parseIso(focused)!;
  const weeks = monthGrid(view.year, view.month, weekStartsOn);
  const labels = weekdayLabels(weekStartsOn);

  useEffect(() => {
    if (open) dayRefs.current.get(focused)?.focus();
  }, [open, focused]);

  const openCalendar = () => {
    setFocused(clampIso(hasValue ? value : today, min, max));
    setOpen(true);
  };

  const move = (next: string) => setFocused(clampIso(next, min, max));

  const select = (iso: string) => {
    if (isOutside(iso, min, max)) return;
    onValueChange(iso);
    close();
  };

  const onGridKey = (e: KeyboardEvent) => {
    const keys: Record<string, () => string> = {
      ArrowLeft: () => addDays(focused, -1),
      ArrowRight: () => addDays(focused, 1),
      ArrowUp: () => addDays(focused, -7),
      ArrowDown: () => addDays(focused, 7),
      Home: () => startOfWeek(focused, weekStartsOn),
      End: () => endOfWeek(focused, weekStartsOn),
      PageUp: () => addMonths(focused, e.shiftKey ? -12 : -1),
      PageDown: () => addMonths(focused, e.shiftKey ? 12 : 1),
    };
    if (e.key in keys) {
      e.preventDefault();
      move(keys[e.key]());
    } else if (e.key === "Escape") {
      e.preventDefault();
      close();
    }
  };

  const firstOfMonth = toIso(view.year, view.month, 1);
  const prevDisabled = Boolean(min && addDays(firstOfMonth, -1) < min);
  const nextDisabled = Boolean(max && addMonths(firstOfMonth, 1) > max);

  return (
    <FieldShell id={id} hint={hint} error={error} invalid={invalid} bare className={className}>
      <div ref={rootRef} className="relative">
        <button
          ref={triggerRef}
          id={id}
          type="button"
          aria-haspopup="dialog"
          aria-expanded={open}
          aria-controls={open ? dialogId : undefined}
          // Named by its own content ("From 4 Nov 2026"), so the accessible name
          // always contains the visible text.
          // aria-invalid isn't valid on a button; the error is announced through
          // aria-describedby and the field is styled by FieldShell.
          aria-describedby={describedBy(id, { hint, error })}
          disabled={disabled}
          onClick={() => (open ? close(false) : openCalendar())}
          onKeyDown={(e) => {
            if (e.key === "ArrowDown" && !open) {
              e.preventDefault();
              openCalendar();
            }
          }}
          className={cn(outlineFieldClass, invalid && "border-danger", error && "rounded-b-none")}
        >
          <span className="flex min-w-0 flex-1 flex-col">
            <span className={hideLabel ? "sr-only" : "text-description text-field-label"}>{label}</span>{" "}
            <span
              className={cn("truncate text-body", hasValue ? (hideLabel ? "text-fg-muted" : "text-fg") : "text-field-placeholder")}
            >
              {hasValue ? formatCompact(value) : placeholder}
            </span>
          </span>
          <CalendarIcon size={18} className="shrink-0 text-fg-subtle" />
        </button>
        {name && <input type="hidden" name={name} value={value} />}

        {open && (
          <div
            id={dialogId}
            role="dialog"
            aria-modal="false"
            aria-labelledby={headingId}
            className={cn(
              popoverCardClass,
              "w-[300px] p-4",
              placement === "bottom" ? "top-full mt-2" : "bottom-full mb-2",
            )}
            onKeyDown={(e) => {
              if (e.key === "Escape") {
                e.preventDefault();
                close();
              }
            }}
          >
            <div className="mb-3 flex items-center justify-between">
              <button
                type="button"
                aria-label="Previous month"
                disabled={prevDisabled}
                onClick={() => move(addMonths(focused, -1))}
                className="flex size-8 items-center justify-center rounded-pill text-fg-muted outline-none hover:bg-surface-sunken hover:text-fg focus-visible:ring-4 focus-visible:ring-focus-ring disabled:cursor-not-allowed disabled:opacity-40"
              >
                <ChevronLeftIcon size={18} />
              </button>
              <p id={headingId} aria-live="polite" className="text-body-bold text-fg">
                {formatMonth(view.year, view.month)}
              </p>
              <button
                type="button"
                aria-label="Next month"
                disabled={nextDisabled}
                onClick={() => move(addMonths(focused, 1))}
                className="flex size-8 items-center justify-center rounded-pill text-fg-muted outline-none hover:bg-surface-sunken hover:text-fg focus-visible:ring-4 focus-visible:ring-focus-ring disabled:cursor-not-allowed disabled:opacity-40"
              >
                <ChevronRightIcon size={18} />
              </button>
            </div>
            <table role="grid" aria-labelledby={headingId} className="w-full border-collapse" onKeyDown={onGridKey}>
              <thead>
                <tr>
                  {labels.map((d) => (
                    <th key={d.long} scope="col" abbr={d.long} className="pb-1 text-description font-medium text-fg-muted">
                      {d.short}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {weeks.map((week) => (
                  <tr key={week[0]}>
                    {week.map((iso) => {
                      const inMonth = parseIso(iso)!.month === view.month;
                      const isSelected = hasValue && iso === value;
                      const isToday = iso === today;
                      const unavailable = isOutside(iso, min, max);
                      const inRange = Boolean(rangeStart && rangeEnd && iso >= rangeStart && iso <= rangeEnd);
                      const isRangeEdge = inRange && (iso === rangeStart || iso === rangeEnd);
                      return (
                        <td
                          key={iso}
                          role="gridcell"
                          aria-selected={isSelected || undefined}
                          className={cn("p-0.5 text-center", inRange && !isRangeEdge && "bg-brand-soft")}
                        >
                          <button
                            ref={(el) => {
                              if (el) dayRefs.current.set(iso, el);
                              else dayRefs.current.delete(iso);
                            }}
                            type="button"
                            tabIndex={iso === focused ? 0 : -1}
                            aria-label={formatLong(iso)}
                            aria-current={isToday ? "date" : undefined}
                            aria-disabled={unavailable || undefined}
                            onClick={() => select(iso)}
                            className={cn(
                              "mx-auto flex size-9 items-center justify-center rounded-pill text-body outline-none transition-colors focus-visible:ring-4 focus-visible:ring-focus-ring",
                              inMonth ? "text-fg" : "text-fg-muted", // fg-subtle is for icons and large text only
                              !unavailable && !isSelected && "hover:bg-surface-sunken",
                              inRange && !isSelected && "text-brand-fg",
                              isRangeEdge && !isSelected && "bg-brand-soft font-semibold",
                              isToday && !isSelected && "font-semibold ring-1 ring-brand ring-inset",
                              isSelected && "bg-brand font-semibold text-on-brand",
                              unavailable && "cursor-not-allowed text-fg-subtle line-through decoration-1 opacity-50",
                            )}
                          >
                            {parseIso(iso)!.day}
                          </button>
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="mt-3 flex justify-between border-t border-line pt-3">
              <button
                type="button"
                disabled={isOutside(today, min, max)}
                onClick={() => select(today)}
                className="rounded-sm px-2 py-1 text-description font-semibold text-brand-fg outline-none hover:underline focus-visible:ring-4 focus-visible:ring-focus-ring disabled:opacity-40"
              >
                Today
              </button>
              <button
                type="button"
                onClick={() => close()}
                className="rounded-sm px-2 py-1 text-description font-semibold text-fg-muted outline-none hover:text-fg focus-visible:ring-4 focus-visible:ring-focus-ring"
              >
                Close
              </button>
            </div>
          </div>
        )}
      </div>
    </FieldShell>
  );
}
