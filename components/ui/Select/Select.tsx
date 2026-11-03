"use client";

import {
  useEffect,
  useId,
  useRef,
  useState,
  type KeyboardEvent,
  type ReactNode,
} from "react";
import { cn } from "@/lib/cn";
import chevron from "../assets/chevron-down.svg";
import { CheckIcon } from "../icons";
import { popoverCardClass, usePopover } from "../Popover/usePopover";
import { describedBy, FieldShell, outlineFieldClass } from "../TextField/FieldShell";

export type SelectOption = { value: string; label: string; icon?: ReactNode };

export type SelectProps = {
  label: string;
  options: readonly SelectOption[];
  value: string;
  onValueChange: (value: string) => void;
  /** Hide the visible label (toolbar filters, like Figma's "All Category"). Still announced. */
  hideLabel?: boolean;
  placeholder?: string;
  hint?: ReactNode;
  error?: ReactNode;
  /** Adds a hidden input so the value is submitted with a native form. */
  name?: string;
  disabled?: boolean;
  id?: string;
  className?: string;
};

const chevronSrc = typeof chevron === "string" ? chevron : (chevron as { src: string }).src;

/** Next option index that starts with the typed text, searching after `from`. */
export function typeaheadMatch(options: readonly SelectOption[], query: string, from: number): number {
  const q = query.toLowerCase();
  for (let step = 1; step <= options.length; step++) {
    const i = (from + step) % options.length;
    if (options[i].label.toLowerCase().startsWith(q)) return i;
  }
  return -1;
}

/**
 * Select-only combobox (WAI-ARIA APG). The trigger keeps focus and points at
 * the highlighted option with aria-activedescendant; the list is a listbox.
 */
export function Select({
  label,
  options,
  value,
  onValueChange,
  hideLabel = false,
  placeholder = "Select…",
  hint,
  error,
  name,
  disabled,
  id: idProp,
  className,
}: SelectProps) {
  const autoId = useId();
  const id = idProp ?? autoId;
  const labelId = `${id}-label`;
  const listId = `${id}-listbox`;
  const { open, setOpen, close, placement, rootRef, triggerRef } = usePopover({
    estimatedHeight: Math.min(options.length, 6) * 46 + 16,
  });
  const selectedIndex = options.findIndex((o) => o.value === value);
  const [active, setActive] = useState(Math.max(0, selectedIndex));
  const typed = useRef({ text: "", at: 0 });
  const listRef = useRef<HTMLUListElement>(null);
  const selected = options[selectedIndex];
  const invalid = Boolean(error);

  useEffect(() => {
    if (!open) return;
    listRef.current?.querySelector(`[data-index="${active}"]`)?.scrollIntoView?.({ block: "nearest" });
  }, [open, active]);

  const openList = (index = Math.max(0, selectedIndex)) => {
    typed.current = { text: "", at: 0 }; // a fresh type-ahead search per opening
    setActive(index);
    setOpen(true);
  };

  const choose = (index: number) => {
    const option = options[index];
    if (option) onValueChange(option.value);
    close();
  };

  const onKeyDown = (e: KeyboardEvent) => {
    if (disabled) return;
    const last = options.length - 1;
    if (!open) {
      if (["ArrowDown", "ArrowUp", "Enter", " "].includes(e.key)) {
        e.preventDefault();
        openList(e.key === "ArrowUp" && selectedIndex < 0 ? last : undefined);
        return;
      }
    } else {
      const moves: Record<string, number> = {
        ArrowDown: Math.min(last, active + 1),
        ArrowUp: Math.max(0, active - 1),
        Home: 0,
        End: last,
        PageDown: Math.min(last, active + 5),
        PageUp: Math.max(0, active - 5),
      };
      if (e.key in moves) {
        e.preventDefault();
        setActive(moves[e.key]);
        return;
      }
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        choose(active);
        return;
      }
      if (e.key === "Escape") {
        e.preventDefault();
        close();
        return;
      }
      if (e.key === "Tab") {
        close(false);
        return;
      }
    }
    // Type-ahead: printable characters jump to matching labels.
    if (e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) {
      const now = Date.now();
      typed.current = { text: now - typed.current.at > 600 ? e.key : typed.current.text + e.key, at: now };
      const from = open ? active : Math.max(0, selectedIndex);
      const match = typeaheadMatch(options, typed.current.text, typed.current.text.length > 1 ? from - 1 : from);
      if (match >= 0) {
        if (open) setActive(match);
        else onValueChange(options[match].value);
      }
    }
  };

  return (
    <FieldShell id={id} hint={hint} error={error} invalid={invalid} bare className={className}>
      <div ref={rootRef} className="relative">
        <span id={labelId} className="sr-only">
          {label}
        </span>
        <button
          ref={triggerRef}
          id={id}
          type="button"
          role="combobox"
          aria-labelledby={labelId}
          aria-haspopup="listbox"
          aria-expanded={open}
          aria-controls={open ? listId : undefined}
          aria-activedescendant={open ? `${id}-option-${active}` : undefined}
          aria-invalid={invalid || undefined}
          aria-describedby={describedBy(id, { hint, error })}
          disabled={disabled}
          onClick={() => (open ? close(false) : openList())}
          onKeyDown={onKeyDown}
          className={cn(outlineFieldClass, invalid && "border-danger", error && "rounded-b-none")}
        >
          <span className="flex min-w-0 flex-1 flex-col">
            {!hideLabel && (
              <span aria-hidden className="text-description text-field-label">
                {label}
              </span>
            )}
            <span
              className={cn(
                "flex items-center gap-2 truncate text-body",
                hideLabel ? "text-fg-muted" : selected ? "text-fg" : "text-field-placeholder",
              )}
            >
              {selected?.icon}
              {selected?.label ?? placeholder}
            </span>
          </span>
          {/* eslint-disable-next-line @next/next/no-img-element -- Figma "Ero down" asset */}
          <img
            src={chevronSrc}
            alt=""
            width={11.5}
            height={6.5}
            className={cn("shrink-0 transition-transform", open && "rotate-180")}
          />
        </button>
        {name && <input type="hidden" name={name} value={value} />}
        {open && (
          <ul
            ref={listRef}
            id={listId}
            role="listbox"
            aria-labelledby={labelId}
            tabIndex={-1}
            className={cn(
              popoverCardClass,
              "max-h-[292px] w-max min-w-[max(100%,187px)] max-w-[min(320px,90vw)] overflow-y-auto p-1.5",
              placement === "bottom" ? "top-full mt-2" : "bottom-full mb-2",
            )}
          >
            {options.map((option, i) => {
              const isSelected = option.value === value;
              return (
                <li
                  key={option.value}
                  id={`${id}-option-${i}`}
                  data-index={i}
                  role="option"
                  aria-selected={isSelected}
                  onMouseDown={(e) => e.preventDefault()}
                  onMouseEnter={() => setActive(i)}
                  onClick={() => choose(i)}
                  className={cn(
                    "flex h-[46px] cursor-pointer items-center gap-3 rounded-sm px-4 text-body font-medium [&_svg]:size-5",
                    i === active ? "bg-surface-sunken text-fg" : "text-fg-muted",
                    isSelected && "text-brand-fg",
                  )}
                >
                  {option.icon}
                  <span className="flex-1 truncate">{option.label}</span>
                  {isSelected && <CheckIcon size={18} aria-hidden />}
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </FieldShell>
  );
}
