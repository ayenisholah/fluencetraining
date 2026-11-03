"use client";

import { useId } from "react";
import { cn } from "@/lib/cn";
import { CloseIcon, SearchIcon } from "../icons";

/**
 * Search input with a leading icon and a clear button. Controlled; debounce
 * the value in the caller (lib/useDebouncedValue) before querying.
 */
export function SearchField({
  label,
  value,
  onChange,
  placeholder,
  className,
}: {
  /** Accessible name; also shown as the placeholder when none is given. */
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
}) {
  const id = useId();
  return (
    <div role="search" aria-label={label} className={cn("relative", className)}>
      <label htmlFor={id} className="sr-only">
        {label}
      </label>
      <SearchIcon size={18} className="pointer-events-none absolute top-1/2 left-4 -translate-y-1/2 text-fg-subtle" />
      <input
        id={id}
        type="search"
        value={value}
        placeholder={placeholder ?? label}
        maxLength={100}
        autoComplete="off"
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Escape" && value) {
            e.preventDefault();
            onChange("");
          }
        }}
        className="h-12 w-full rounded-md border border-field-border bg-surface pr-11 pl-11 text-body text-fg outline-none placeholder:text-field-placeholder focus-visible:ring-4 focus-visible:ring-focus-ring [&::-webkit-search-cancel-button]:hidden"
      />
      {value && (
        <button
          type="button"
          aria-label="Clear search"
          onClick={() => onChange("")}
          className="absolute top-1/2 right-2 flex size-8 -translate-y-1/2 items-center justify-center rounded-full text-fg-muted outline-none hover:bg-surface-sunken focus-visible:ring-4 focus-visible:ring-focus-ring"
        >
          <CloseIcon size={16} />
        </button>
      )}
    </div>
  );
}
